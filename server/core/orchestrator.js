import { v4 as uuid } from 'uuid';
import aiClient from './ai-client.js';
import sseManager from './sse-manager.js';
import { SentinelAgent } from './agents/sentinel.js';
import { PlannerAgent } from './agents/planner.js';
import { ExecutorAgent } from './agents/executor.js';
import { ReviewerAgent } from './agents/reviewer.js';
import { ResearchAgent } from './agents/researcher.js';
import { detectPII, maskPII } from '../security/pii-detector.js';
import { LoopDetector } from '../security/loop-detector.js';
import { CostTracker } from '../security/cost-tracker.js';
import { AuditLogger } from '../security/audit-logger.js';
import { checkPermission, recordApprovalSync } from '../security/permission-engine.js';
import { getDb } from '../db/init.js';
import notificationService from '../notifications/service.js';
import { classifyComplexity, getModelForAgent, getRoutingPlan } from './model-router.js';
import { TokenTracker } from './token-tracker.js';
import autoResolver from '../mcp/auto-resolver.js';
import mcpManager from '../mcp/client.js';
import skillLoader from '../mcp/skill-loader.js';
import agentMemory from '../memory/store.js';

class AgentOrchestrator {
  constructor() {
    this.ai = aiClient;
    this.agents = {
      sentinel: new SentinelAgent(this.ai),
      planner: new PlannerAgent(this.ai),
      researcher: new ResearchAgent(this.ai),
      executor: new ExecutorAgent(this.ai),
      reviewer: new ReviewerAgent(this.ai),
    };
    this.pendingApprovals = new Map();
    this.activeTasks = new Map();
    this.loopDetector = new LoopDetector();
    this.costTracker = new CostTracker();
    this.auditLogger = new AuditLogger();
  }

  _emitProgress(conversationId, phase, stepIndex, totalSteps, description, startTime) {
    sseManager.send(conversationId, 'pipeline:progress', {
      phase,
      stepIndex,
      totalSteps,
      description,
      elapsed_ms: Date.now() - startTime,
    });
  }

  _emitAgentDetail(conversationId, agent, data) {
    sseManager.send(conversationId, 'agent:detail', {
      agent,
      ...data,
    });
  }

  async processMessage({ conversationId, messageId, message: userMessage, attachments, history = [] }) {
    const trace = [];
    const taskId = uuid();
    const startTime = Date.now();
    this.activeTasks.set(taskId, { conversationId, cancelled: false });
    this.loopDetector.startTask(taskId);

    // Initialize per-session token tracker
    const tokenTracker = new TokenTracker();

    // Classify complexity and determine model routing
    const complexity = classifyComplexity(userMessage);
    const mainModelId = this.ai.activeModel;
    const routingPlan = getRoutingPlan(complexity, mainModelId);

    // Emit routing info to client
    sseManager.send(conversationId, 'pipeline:routing', {
      complexity,
      mainModel: mainModelId,
      routing: routingPlan,
    });

    // Notify task start
    notificationService.notify('task_start', { taskId, conversationId, message: userMessage.slice(0, 100) }).catch(() => {});

    // Load security config from DB for loop detection limits
    let securityConfig = {};
    try {
      const db = getDb();
      const row = db.prepare("SELECT value FROM config WHERE key = 'security_config'").get();
      if (row) securityConfig = JSON.parse(row.value);
    } catch {}

    try {
      // --- PII Detection on input ---
      const piiFindings = detectPII(userMessage);
      if (piiFindings.length > 0) {
        this.auditLogger.log('pii_detected', {
          conversationId,
          findings: piiFindings.map(f => f.type),
          action: 'masked',
        });
        sseManager.send(conversationId, 'agent:warning', {
          agent: 'sentinel',
          message: `PII detected and masked: ${piiFindings.map(f => f.type).join(', ')}`,
        });
        userMessage = maskPII(userMessage);
      }

      // --- Cost limit pre-check ---
      const costLimits = this.costTracker.checkLimits();
      if (costLimits.exceeded) {
        this.auditLogger.log('cost_limit', {
          conversationId,
          reason: costLimits.reason,
        });
        return {
          response: `⚠️ Cost limit reached: ${costLimits.reason}. Please adjust limits in Security Settings.`,
          trace,
          cost: 0,
          blocked: true,
        };
      }

      // Compute total steps (will be updated after planning)
      let totalSteps = 6; // sentinel_input + planning + sentinel_plan + execution(1) + review + response

      // Step 1: Sentinel — input validation
      const sentinelModel = getModelForAgent('sentinel', complexity, mainModelId);
      this._emitProgress(conversationId, 'sentinel_input', 1, totalSteps, 'Validating input...', startTime);
      const sentinelStart = Date.now();
      sseManager.send(conversationId, 'agent:start', { agent: 'sentinel', action: 'Validating input...', model: sentinelModel });
      this._emitAgentDetail(conversationId, 'sentinel', { currentAction: 'Input validation', inputPreview: userMessage.slice(0, 200), model: sentinelModel });
      const inputCheck = await this.agents.sentinel.validateInput(userMessage, { model: sentinelModel });
      const sentinelDuration = Date.now() - sentinelStart;
      if (inputCheck.usage) tokenTracker.record('sentinel', sentinelModel, inputCheck.usage);
      trace.push({ agent: 'sentinel', phase: 'input_check', result: inputCheck, duration_ms: sentinelDuration, model: sentinelModel });
      sseManager.send(conversationId, 'agent:complete', { agent: 'sentinel', result: 'success', duration_ms: sentinelDuration });
      this._emitAgentDetail(conversationId, 'sentinel', { currentAction: 'Complete', outputPreview: JSON.stringify(inputCheck).slice(0, 200) });
      if (inputCheck.blocked) {
        this.auditLogger.log('blocked', { conversationId, reason: inputCheck.reason, agent: 'sentinel' });
        return { response: inputCheck.reason, trace, cost: 0, blocked: true };
      }

      if (this.activeTasks.get(taskId)?.cancelled) return this._cancelledResponse(trace, tokenTracker);

      // Auto MCP: resolve servers from message keywords
      try {
        this._emitProgress(conversationId, 'mcp_setup', 1, totalSteps, 'Connecting tools...', startTime);
        const autoConnected = await autoResolver.resolveForMessage(userMessage, conversationId);
        if (autoConnected.length > 0) {
          trace.push({ agent: 'system', phase: 'mcp_auto_connect', result: { connected: autoConnected } });
        }
      } catch (e) {
        console.error('Auto MCP resolve error:', e);
      }

      // Inject memory context
      let memoryContext = '';
      try {
        memoryContext = agentMemory.getContextForPrompt(userMessage);
      } catch {}

      // Step 2: Planner — task decomposition
      const plannerModel = getModelForAgent('planner', complexity, mainModelId);
      this._emitProgress(conversationId, 'planning', 2, totalSteps, 'Creating execution plan...', startTime);
      const plannerStart = Date.now();
      sseManager.send(conversationId, 'agent:start', { agent: 'planner', action: 'Analyzing task...', model: plannerModel });
      this._emitAgentDetail(conversationId, 'planner', { currentAction: 'Task analysis & decomposition', inputPreview: userMessage.slice(0, 200), model: plannerModel });
      const availableTools = mcpManager.getRegisteredTools();
      const plannerInput = memoryContext ? userMessage + memoryContext : userMessage;
      const plan = await this.agents.planner.createPlan(plannerInput, { model: plannerModel, availableTools });
      const plannerDuration = Date.now() - plannerStart;
      if (plan.usage) tokenTracker.record('planner', plannerModel, plan.usage);
      trace.push({ agent: 'planner', phase: 'planning', result: plan, duration_ms: plannerDuration, model: plannerModel });
      sseManager.send(conversationId, 'agent:complete', { agent: 'planner', result: 'success', duration_ms: plannerDuration });

      // Update totalSteps now that we know how many subtasks
      const subtaskCount = plan.subtasks?.length || 1;
      this._emitAgentDetail(conversationId, 'planner', {
        currentAction: 'Complete',
        outputPreview: `Plan: ${plan.type || 'tool_required'} — ${subtaskCount} subtask(s) - ${plan.summary || ''}`.slice(0, 200),
      });

      if (this.activeTasks.get(taskId)?.cancelled) return this._cancelledResponse(trace, tokenTracker);

      // === DIRECT ANSWER OPTIMIZATION ===
      // For simple questions/conversations, skip Executor/Reviewer entirely
      if (plan.type === 'direct_answer') {
        totalSteps = 3; // sentinel_input + planning + response
        this._emitProgress(conversationId, 'response', 3, totalSteps, 'Generating response...', startTime);

        const { response: directResponse, usage: directUsage } = await this.agents.planner.generateDirectAnswer(
          userMessage, { model: plannerModel, history }
        );
        if (directUsage) tokenTracker.record('planner', plannerModel, directUsage);
        trace.push({ agent: 'planner', phase: 'direct_answer', duration_ms: Date.now() - startTime, model: plannerModel });

        // Stream chunks if available
        if (conversationId && directResponse) {
          sseManager.send(conversationId, 'response:chunk', { chunk: directResponse });
        }

        const sessionTotal = tokenTracker.getSessionTotal();
        const totalCost = sessionTotal.totalCost;
        const totalTime = Date.now() - startTime;

        this.costTracker.recordCost(totalCost, { conversationId, taskId, agents: ['sentinel', 'planner'] });
        this.auditLogger.log('agent_action', {
          conversationId, taskId, action: 'completed_direct',
          total_cost: totalCost, total_time_ms: totalTime,
          agents_used: ['sentinel', 'planner'], complexity,
          token_breakdown: sessionTotal.breakdown,
        });

        sseManager.send(conversationId, 'response:done', {
          total_cost: `$${totalCost.toFixed(4)}`,
          total_time_ms: totalTime,
          complexity,
          optimized: true,
          token_usage: { input: sessionTotal.totalInputTokens, output: sessionTotal.totalOutputTokens },
        });

        // Extract memories from direct conversation
        try {
          const msgs = [
            { role: 'user', content: userMessage },
            { role: 'assistant', content: directResponse },
          ];
          agentMemory.extractFromConversation(msgs).catch(() => {});
        } catch { /* non-blocking */ }

        this.activeTasks.delete(taskId);
        this.loopDetector.cleanup(taskId);

        notificationService.notify('task_complete', {
          taskId, conversationId,
          cost: `$${totalCost.toFixed(4)}`,
          elapsed: `${Math.round(totalTime / 1000)}s`,
        }).catch(() => {});

        return {
          response: directResponse,
          trace,
          cost: totalCost,
          tools_used: [],
          complexity,
          token_usage: sessionTotal,
        };
      }

      // === FULL PIPELINE (tool_required / multi_step) ===
      totalSteps = 3 + subtaskCount + 3; // sentinel_input + planning + sentinel_plan + research + N subtasks + review + response

      // Auto MCP: resolve servers from plan's required tools
      try {
        const planAutoConnected = await autoResolver.resolveForPlan(plan, conversationId);
        if (planAutoConnected.length > 0) {
          trace.push({ agent: 'system', phase: 'mcp_plan_connect', result: { connected: planAutoConnected } });
        }
      } catch (e) {
        console.error('Auto MCP plan resolve error:', e);
      }

      // Step 3: Sentinel — plan validation
      this._emitProgress(conversationId, 'sentinel_plan', 3, totalSteps, 'Validating execution plan...', startTime);
      const planCheckStart = Date.now();
      sseManager.send(conversationId, 'agent:start', { agent: 'sentinel', action: 'Validating plan...', model: sentinelModel });
      this._emitAgentDetail(conversationId, 'sentinel', { currentAction: 'Plan validation', inputPreview: `${subtaskCount} subtasks`, model: sentinelModel });
      const planCheck = await this.agents.sentinel.validatePlan(plan, { model: sentinelModel });
      const planCheckDuration = Date.now() - planCheckStart;
      if (planCheck.usage) tokenTracker.record('sentinel', sentinelModel, planCheck.usage);
      trace.push({ agent: 'sentinel', phase: 'plan_check', result: planCheck, duration_ms: planCheckDuration, model: sentinelModel });
      sseManager.send(conversationId, 'agent:complete', { agent: 'sentinel', result: 'success', duration_ms: planCheckDuration });
      this._emitAgentDetail(conversationId, 'sentinel', { currentAction: 'Complete', outputPreview: planCheck.requires_approval ? 'Approval required' : 'Plan approved' });

      // --- Loop detection pre-check (e.g. duration/token limits before execution starts) ---
      const loopCheck = this.loopDetector.checkLimits(taskId, securityConfig);
      if (loopCheck.exceeded) {
        this.auditLogger.log('alert', { conversationId, type: 'loop_detected', reason: loopCheck.reason });
        sseManager.send(conversationId, 'agent:warning', { agent: 'system', message: `Safety limit reached: ${loopCheck.reason}` });
        // For duration/token limits, still halt; but log clearly
        const sessionTotal = tokenTracker.getSessionTotal();
        return {
          response: `⚠️ Safety limit reached before execution: ${loopCheck.reason}. Please try a simpler request or adjust limits in Security Settings.`,
          trace,
          cost: sessionTotal.totalCost,
          blocked: true,
        };
      }

      console.log("[Orchestrator] Step 4: requires_approval =", planCheck.requires_approval, "permission_checks =", planCheck.permission_checks);
      // Step 4: Check if approval needed
      if (planCheck.requires_approval) {
        const approvalId = uuid();
        // Determine risk level from permission checks
        const riskLevel = planCheck.permission_checks?.some(w => w.includes('delete') || w.includes('shell'))
          ? 'high'
          : planCheck.permission_checks?.length > 0 ? 'medium' : 'low';

        // Extract first tool requiring approval for display
        const firstApprovalTool = (plan.subtasks || []).flatMap(s => s.tools || []).find(t => {
          const pc = checkPermission(t);
          return pc.requiresApproval;
        });

        console.log("[Orchestrator] Setting pending approval:", approvalId);
        this.pendingApprovals.set(approvalId, {
          plan,
          tool: firstApprovalTool || null,
          reason: planCheck.approval_reason,
          description: planCheck.approval_reason || `Plan requires approval: ${plan.summary || ''}`,
          estimated_cost: plan.total_estimated_cost,
          riskLevel,
          conversationId,
          taskId,
          argsPreview: plan.subtasks?.map(s => s.description).join('\n'),
        });

        // Persist to DB
        try {
          const db = getDb();
          db.prepare(
            "INSERT INTO approval_queue (id, conversation_id, action_type, action_details, status) VALUES (?, ?, ?, ?, 'pending')"
          ).run(approvalId, conversationId, 'plan_approval', JSON.stringify({
            plan_summary: plan.summary,
            tool: firstApprovalTool,
            reason: planCheck.approval_reason,
          }));
        } catch {}

        sseManager.send(conversationId, 'approval:required', {
          id: approvalId,
          plan,
          tool: firstApprovalTool,
          reason: planCheck.approval_reason,
          description: planCheck.approval_reason,
          estimated_cost: plan.total_estimated_cost,
          riskLevel,
          permissions: planCheck.permission_checks || [],
          argsPreview: plan.subtasks?.map(s => s.description).join('\n'),
        });
        this.auditLogger.log('approved', {
          conversationId,
          approvalId,
          status: 'pending',
          plan_summary: plan.summary,
          riskLevel,
        });
        // Wait for approval (with timeout)
        console.log("[Orchestrator] Waiting for approval:", approvalId, "pendingApprovals size:", this.pendingApprovals.size);
        const approved = await this.waitForApproval(approvalId, 300000);
        console.log("[Orchestrator] Approval result:", approved);
        if (!approved) {
          this.auditLogger.log('approved', { conversationId, approvalId, status: 'rejected_or_timeout' });
          return { response: 'Operation cancelled or timed out.', trace, cost: 0 };
        }
        this.auditLogger.log('approved', { conversationId, approvalId, status: 'approved' });
      }

      if (this.activeTasks.get(taskId)?.cancelled) return this._cancelledResponse(trace, tokenTracker);

      // Step 4.5: Research — gather quality references and benchmarks
      let qualityResearch = null;
      const needsResearch = plan.subtasks?.some(s =>
        s.tools?.some(t => ['generate_svg', 'generate_html', 'create_presentation', 'write_excel'].includes(t))
      );
      if (needsResearch) {
        try {
          const researcherModel = getModelForAgent('researcher', complexity, mainModelId);
          this._emitProgress(conversationId, 'research', 4, totalSteps, 'Researching quality standards...', startTime);
          sseManager.send(conversationId, 'agent:start', { agent: 'researcher', action: 'Researching quality references...', model: researcherModel });
          const researchStart = Date.now();
          qualityResearch = await this.agents.researcher.research(userMessage, plan, { model: researcherModel, conversationId });
          const researchDuration = Date.now() - researchStart;
          if (qualityResearch.usage) tokenTracker.record('researcher', researcherModel, qualityResearch.usage);
          trace.push({ agent: 'researcher', phase: 'quality_research', result: qualityResearch, duration_ms: researchDuration, model: researcherModel });
          sseManager.send(conversationId, 'agent:complete', { agent: 'researcher', result: 'success', duration_ms: researchDuration });
          console.log(`[Orchestrator] Quality research: type=${qualityResearch.task_type}, criteria=${qualityResearch.quality_criteria?.length || 0}`);
        } catch (e) {
          console.error('[Orchestrator] Research phase error (non-fatal):', e.message);
        }
      }

      // Step 5: Executor — execute subtasks
      const executorModel = getModelForAgent('executor', complexity, mainModelId);
      const results = [];
      const fileResults = [];
      const subtasks = plan.subtasks || [{ id: 1, description: userMessage }];
      // Inject original user message into subtasks for content-generation tools
      // This ensures the executor knows the user's actual topic (not KAGE defaults)
      for (const st of subtasks) {
        if (st.tools?.some(t => ['create_presentation', 'write_excel', 'generate_html', 'generate_svg'].includes(t))) {
          st.userRequest = userMessage;
        }
      }
      const subtaskStartTimes = [];
      for (let i = 0; i < subtasks.length; i++) {
        const subtask = subtasks[i];
        const execStart = Date.now();
        subtaskStartTimes.push(execStart);
        const currentStep = (needsResearch ? 5 : 4) + i; // adjust for research phase
        this._emitProgress(conversationId, 'execution', currentStep, totalSteps, `Executing: ${subtask.description}`, startTime);

        // Emit subtask-level progress
        const avgDuration = subtaskStartTimes.length > 1
          ? (execStart - subtaskStartTimes[0]) / i
          : 0;
        const estimatedRemaining = avgDuration > 0 ? Math.round(avgDuration * (subtasks.length - i)) : 0;
        sseManager.send(conversationId, 'executor:subtask_progress', {
          subtaskIndex: i,
          totalSubtasks: subtasks.length,
          description: subtask.description,
          estimatedRemaining_ms: estimatedRemaining,
        });

        sseManager.send(conversationId, 'agent:start', {
          agent: 'executor',
          action: `Executing: ${subtask.description}`,
          progress: `${i + 1}/${subtasks.length}`,
          model: executorModel,
        });
        this._emitAgentDetail(conversationId, 'executor', {
          currentAction: `Subtask ${i + 1}/${subtasks.length}: ${subtask.description}`,
          inputPreview: JSON.stringify(subtask).slice(0, 200),
          model: executorModel,
        });

        // Inject skill instructions into executor context
        const skillInstructions = skillLoader.buildPromptInstructions();
        const result = await this.agents.executor.execute(subtask, results, { model: executorModel, qualityResearch, skillInstructions });
                const execDuration = Date.now() - execStart;
        if (result.usage) tokenTracker.record('executor', executorModel, result.usage);
        results.push(result);
        trace.push({ agent: 'executor', phase: 'execution', subtask: subtask.id, result, duration_ms: execDuration, model: executorModel });

        // Emit tool call/result SSE events for real-time Agent Monitor display
        if (result.toolUsed) {
          sseManager.send(conversationId, 'agent:tool_call', {
            agent: 'executor',
            tool: result.toolUsed,
            args: result.details?.arguments || {},
            subtaskId: subtask.id,
          });
          sseManager.send(conversationId, 'agent:tool_result', {
            agent: 'executor',
            tool: result.toolUsed,
            success: result.success,
            result: (result.result || result.error || '').toString().slice(0, 500),
            duration_ms: execDuration,
            subtaskId: subtask.id,
          });
        }

        // Detect file operations for result presentation
        if (result.toolUsed && result.details?.tool) {
          const toolName = result.details.tool.toLowerCase();
          const args = result.details.arguments || {};
          const filePath = args.filePath || args.file_path || args.path || '';
          if (toolName.includes('generate_svg') || toolName.includes('generate_html')) {
            if (filePath) fileResults.push({ action: 'created', path: filePath, type: toolName.includes('svg') ? 'svg' : 'html' });
          } else if (toolName.includes('write_file') || toolName.includes('create')) {
            if (filePath) fileResults.push({ action: 'created', path: filePath });
          } else if (toolName.includes('read_file')) {
            if (filePath) fileResults.push({ action: 'read', path: filePath });
          } else if (toolName.includes('edit') || toolName.includes('update') || toolName.includes('move')) {
            if (filePath) fileResults.push({ action: 'modified', path: filePath });
          } else if (toolName.includes('write_excel')) {
            if (filePath) fileResults.push({ action: 'created', path: filePath, type: 'excel' });
          } else if (toolName.includes('create_presentation')) {
            if (filePath) fileResults.push({ action: 'created', path: filePath, type: 'pptx' });
          }
        }

        this._emitAgentDetail(conversationId, 'executor', {
          currentAction: result.success ? 'Subtask complete' : 'Subtask failed',
          toolName: result.toolUsed || null,
          outputPreview: (result.result || result.error || '').toString().slice(0, 200),
        });

        sseManager.send(conversationId, 'agent:complete', {
          agent: 'executor',
          result: result.success ? 'success' : 'error',
          subtask: subtask.id,
          duration_ms: execDuration,
        });

        // Log tool usage based on ACTUAL execution (not planned tools)
        // This prevents over-counting when plan lists tools that don't get called
        if (result.toolUsed) {
          this.loopDetector.trackToolCall(taskId, result.toolUsed);
          this.auditLogger.log('tool_call', { conversationId, tool: result.toolUsed, subtaskId: subtask.id });
        }

        if (this.activeTasks.get(taskId)?.cancelled) return this._cancelledResponse(trace, tokenTracker);

        // Mid-execution loop check — instead of hard stop, break loop and continue to review/response
        const midLoopCheck = this.loopDetector.checkLimits(taskId, securityConfig);
                if (midLoopCheck.exceeded) {
          this.auditLogger.log('alert', { conversationId, type: 'loop_mid_execution', reason: midLoopCheck.reason });
          sseManager.send(conversationId, 'agent:warning', {
            agent: 'system',
            message: `Safety limit reached: ${midLoopCheck.reason}. Continuing with partial results.`,
          });
          // Break loop but continue to review & response generation with partial results
          break;
        }
      }

      // Step 6: Reviewer — verification
      const reviewerModel = getModelForAgent('reviewer', complexity, mainModelId);
      this._emitProgress(conversationId, 'review', totalSteps - 1, totalSteps, 'Reviewing results...', startTime);
      const reviewerStart = Date.now();
      sseManager.send(conversationId, 'agent:start', { agent: 'reviewer', action: 'Verifying results...', model: reviewerModel });
      this._emitAgentDetail(conversationId, 'reviewer', { currentAction: 'Verifying execution results', inputPreview: `${results.length} result(s)`, model: reviewerModel });
      const review = await this.agents.reviewer.review(userMessage, plan, results, { model: reviewerModel, qualityResearch });
      const reviewerDuration = Date.now() - reviewerStart;
      if (review.usage) tokenTracker.record('reviewer', reviewerModel, review.usage);
      trace.push({ agent: 'reviewer', phase: 'review', result: review, duration_ms: reviewerDuration, model: reviewerModel });
      sseManager.send(conversationId, 'agent:complete', { agent: 'reviewer', result: 'success', duration_ms: reviewerDuration });
      this._emitAgentDetail(conversationId, 'reviewer', { currentAction: 'Complete', outputPreview: JSON.stringify(review).slice(0, 200) });

      // Step 7: Generate final response (streamed via SSE)
      const finalResponseModel = getModelForAgent('final_response', complexity, mainModelId);
      this._emitProgress(conversationId, 'response', totalSteps, totalSteps, 'Generating response...', startTime);
      const { response: finalResponse, usage: finalUsage } = await this.generateFinalResponse(userMessage, plan, results, review, finalResponseModel, conversationId, history);
      if (finalUsage) tokenTracker.record('final_response', finalResponseModel, finalUsage);

      // Get real cost from token tracker
      const sessionTotal = tokenTracker.getSessionTotal();
      const totalCost = sessionTotal.totalCost;
      const totalTime = Date.now() - startTime;

      // --- Record cost ---
      this.costTracker.recordCost(totalCost, {
        conversationId,
        taskId,
        agents: trace.map(t => t.agent),
      });

      // --- PII check on output ---
      const outputPII = detectPII(finalResponse);
      let safeResponse = finalResponse;
      if (outputPII.length > 0) {
        safeResponse = maskPII(finalResponse);
        this.auditLogger.log('pii_detected', { conversationId, phase: 'output', action: 'masked' });
      }

      // --- Audit log completion ---
      this.auditLogger.log('agent_action', {
        conversationId,
        taskId,
        action: 'completed',
        total_cost: totalCost,
        total_time_ms: totalTime,
        agents_used: [...new Set(trace.map(t => t.agent))],
        complexity,
        token_breakdown: sessionTotal.breakdown,
      });

      // --- Extract memories from conversation ---
      try {
        const conversationMessages = [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: safeResponse },
        ];
        agentMemory.extractFromConversation(conversationMessages).catch(() => {});
      } catch { /* non-blocking */ }

      // Emit file results
      for (const fr of fileResults) {
        sseManager.send(conversationId, 'result:file', fr);
      }

      // Stream final response with real cost data
      sseManager.send(conversationId, 'response:done', {
        total_cost: `$${totalCost.toFixed(4)}`,
        total_time_ms: totalTime,
        complexity,
        token_usage: {
          input: sessionTotal.totalInputTokens,
          output: sessionTotal.totalOutputTokens,
        },
        routing: routingPlan,
      });

      this.activeTasks.delete(taskId);
      this.loopDetector.cleanup(taskId);

      // Notify task complete
      notificationService.notify('task_complete', {
        taskId, conversationId,
        cost: `$${totalCost.toFixed(4)}`,
        elapsed: `${Math.round(totalTime / 1000)}s`,
      }).catch(() => {});

      return {
        response: safeResponse,
        trace,
        cost: totalCost,
        tools_used: this.extractToolsUsed(trace),
        complexity,
        token_usage: sessionTotal,
      };
    } catch (error) {
      this.activeTasks.delete(taskId);
      this.loopDetector.cleanup(taskId);
      this.auditLogger.log('alert', { conversationId, error: error.message, phase: 'orchestrator' });
      console.error('Orchestrator error:', error);
      sseManager.send(conversationId, 'agent:error', { error: error.message });
      notificationService.notify('task_error', { taskId, conversationId, error: error.message }).catch(() => {});
      throw error;
    }
  }

  _cancelledResponse(trace, tokenTracker) {
    const sessionTotal = tokenTracker ? tokenTracker.getSessionTotal() : { totalCost: 0 };
    return { response: 'Task cancelled.', trace, cost: sessionTotal.totalCost };
  }

  async generateFinalResponse(userMessage, plan, results, review, model, conversationId, history = []) {
    // Build messages with conversation history for context
    const messages = [];
    for (const h of history.slice(-10)) {
      messages.push({ role: h.role, content: h.content });
    }
    messages.push({
      role: 'user',
      content: `Original request: ${userMessage}

Plan: ${JSON.stringify(plan)}
Execution results: ${JSON.stringify(results)}
Review: ${JSON.stringify(review)}

Based on the above, generate a natural, helpful response to the user's original request.
Respond in the same language as the user's message.`,
    });

    const systemPrompt = `You are KAGE, a secure multi-agent AI assistant running locally on the user's machine.

YOUR CAPABILITIES — you CAN do all of the following:
- Remember all previous messages within the SAME conversation (conversation history is provided)
- Read, write, create, move, and search files on the local filesystem
- Open and control local applications (via AppleScript on macOS)
- Generate HTML, SVG, Excel, PowerPoint files and save them to disk
- Execute shell commands (with security approval)
- Browse the web (with Puppeteer/browser automation)
- Search the web (with Brave Search)
- Interact with GitHub, Slack, databases, and other integrations via MCP tools
- Take screenshots, control windows, send keystrokes to apps
- Perform multi-step tasks: research → plan → execute → review

IMPORTANT RULES:
- NEVER say you cannot remember previous messages — you have full conversation history within this chat
- NEVER say you cannot access files or applications — you have local filesystem and app control tools
- NEVER claim limitations that don't exist — you are a fully capable local AI assistant
- Be specific — include file paths, results, and concrete details
- Use proper Markdown formatting
- Respond in the SAME LANGUAGE as the user's original request
- NEVER suggest installing plugins, extensions, or MCP servers`;

    // Use streaming to emit response:chunk events in real-time
    const { response, usage } = await this.ai.chatStream(messages, {
      systemPrompt,
      maxTokens: 2048,
      model,
      onChunk: (chunk) => {
        if (conversationId && chunk) {
          sseManager.send(conversationId, 'response:chunk', { chunk });
        }
      },
    });

    return {
      response: response || 'I apologize, I was unable to generate a response.',
      usage,
    };
  }

  async waitForApproval(approvalId, timeoutMs = 300000) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingApprovals.delete(approvalId);
        resolve(false);
      }, timeoutMs);

      const check = setInterval(() => {
        const approval = this.pendingApprovals.get(approvalId);
        if (!approval) {
          clearInterval(check);
          clearTimeout(timeout);
          resolve(false);
        } else if (approval.resolved !== undefined) {
          clearInterval(check);
          clearTimeout(timeout);
          this.pendingApprovals.delete(approvalId);
          resolve(approval.resolved);
        }
      }, 500);
    });
  }

  resolveApproval(approvalId, approved) {
    const approval = this.pendingApprovals.get(approvalId);
    if (approval) {
      approval.resolved = approved;
    }
  }

  cancelTask(taskId) {
    const task = this.activeTasks.get(taskId);
    if (task) task.cancelled = true;
  }

  killAll() {
    for (const [taskId, task] of this.activeTasks) {
      task.cancelled = true;
    }
    this.activeTasks.clear();
    this.pendingApprovals.clear();
    this.auditLogger.log('alert', { action: 'kill_all', message: 'Emergency stop activated' });
  }

  calculateTotalCost(trace) {
    // Legacy method — kept for backward compatibility
    // Real cost is now computed by TokenTracker
    const agentCalls = trace.length;
    const estimatedInputTokens = agentCalls * 500;
    const estimatedOutputTokens = agentCalls * 800;
    return (estimatedInputTokens * 3 / 1_000_000) + (estimatedOutputTokens * 15 / 1_000_000);
  }

  extractToolsUsed(trace) {
    return trace
      .filter(t => t.phase === 'execution')
      .map(t => t.subtask);
  }
}

// Singleton
const orchestrator = new AgentOrchestrator();
export default orchestrator;
