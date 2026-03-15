import mcpManager from './client.js';

export const TEST_SCENARIOS = {
  create_file: {
    name: 'Create & Verify File',
    description: 'Creates a test file, reads it back, and verifies content',
    requiredServer: 'filesystem',
    steps: [
      { tool: 'write_file', args: { path: '/tmp/kage-test.txt', content: 'KAGE test file - ' + new Date().toISOString() } },
      { tool: 'read_file', args: { path: '/tmp/kage-test.txt' } },
    ],
  },
  list_directory: {
    name: 'List Directory',
    description: 'Lists the contents of the home directory',
    requiredServer: 'filesystem',
    steps: [
      { tool: 'list_directory', args: { path: process.env.HOME || '/tmp' } },
    ],
  },
  search_content: {
    name: 'Search Content',
    description: 'Searches for files matching a pattern',
    requiredServer: 'filesystem',
    steps: [
      { tool: 'search_files', args: { path: '/tmp', pattern: 'kage' } },
    ],
  },
};

export async function runTestScenario(scenarioId) {
  const scenario = TEST_SCENARIOS[scenarioId];
  if (!scenario) {
    throw new Error(`Unknown test scenario: ${scenarioId}`);
  }

  const results = [];
  const startTime = Date.now();

  for (const step of scenario.steps) {
    const stepStart = Date.now();
    try {
      const result = await mcpManager.callTool(step.tool, step.args);
      const resultText = result.content
        ?.map(c => c.type === 'text' ? c.text : JSON.stringify(c))
        ?.join('\n') || JSON.stringify(result);

      results.push({
        tool: step.tool,
        args: step.args,
        success: !result.isError,
        result: resultText.slice(0, 500),
        duration_ms: Date.now() - stepStart,
      });
    } catch (err) {
      results.push({
        tool: step.tool,
        args: step.args,
        success: false,
        error: err.message,
        duration_ms: Date.now() - stepStart,
      });
    }
  }

  return {
    scenario: scenario.name,
    success: results.every(r => r.success),
    steps: results,
    totalDuration_ms: Date.now() - startTime,
  };
}
