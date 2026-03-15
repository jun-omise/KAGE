# KAGE

**Secure Multi-Agent Personal AI Assistant**

KAGE is a self-hosted, multi-agent AI assistant platform that orchestrates multiple specialized AI agents to handle complex tasks securely. It features a 4-agent pipeline, real-time progress tracking, MCP (Model Context Protocol) integrations, multi-platform notifications, and remote control via messaging platforms.

---

## Features

### Multi-Agent Orchestration
- **4-agent pipeline**: Sentinel (security) → Planner → Executor → Reviewer
- Real-time pipeline progress with segmented progress bar
- Agent Monitor with Cards / Timeline views
- Pause, resume, and stop controls
- Cost tracking per task and session

### Chat Interface
- Markdown rendering with syntax highlighting
- File result cards with "Open in Finder" / "Open in VS Code" actions
- Inline progress indicator during task execution
- Conversation history management

### MCP Tool Integration
- 50+ built-in MCP server definitions across 10 categories
- Smart MCP suggestion engine (auto-detects needed servers from message keywords, Japanese & English)
- One-click connect for MCP servers
- MCP Test Runner with predefined test scenarios
- Custom MCP server support

### Notification System
- Multi-channel: Webhook, LINE, WhatsApp (Twilio), Facebook Messenger
- Configurable event filters (task start/complete/error, approval needed)
- Notification log with history
- Test send functionality

### Messaging Platform Integration (Remote Control)
- Control KAGE from LINE, WhatsApp, or Facebook Messenger
- Passphrase-based authentication per session
- Rate limiting (30 req/hour/user)
- Platform signature verification (HMAC-SHA256)
- Command allowlist/blocklist

### Security
- Passphrase-based authentication with JWT
- PII detection & masking
- Infinite loop detection
- Cost limits (per-task, daily, monthly)
- Permission policies (auto-approve, always confirm, first-time confirm)
- Audit logging
- Emergency stop

### Multi-Provider AI Support
Anthropic (Claude), OpenAI (GPT), Google (Gemini), Groq, xAI (Grok), Alibaba (Qwen), Moonshot, OpenRouter

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Lucide Icons |
| Backend | Node.js, Express |
| Database | SQLite (better-sqlite3) |
| AI | Anthropic SDK, MCP SDK |
| Auth | bcryptjs, JWT |
| Realtime | Server-Sent Events (SSE) |
| i18n | English, Japanese |

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Clone
git clone https://github.com/jun-omise/KAGE.git
cd KAGE

# Configure environment
cp .env.example .env
# Edit .env and set:
#   ANTHROPIC_API_KEY=your-api-key
#   JWT_SECRET=your-random-secret
#   PORT=3456 (optional)

# Install dependencies
npm install

# Start development
npm run dev
```

The app will be available at:
- **Client**: http://localhost:5173
- **Server**: http://localhost:3456

On first launch, a setup wizard will guide you through passphrase creation, API key configuration, and security level selection.

---

## Project Structure

```
KAGE/
├── client/                    # React frontend
│   └── src/
│       ├── components/        # 22 React components
│       │   ├── ChatPanel.jsx          # Chat interface
│       │   ├── AgentMonitor.jsx       # Agent status panel
│       │   ├── ProgressIndicator.jsx  # Pipeline progress bar
│       │   ├── PipelineTimeline.jsx   # Timeline view
│       │   ├── ResultPresenter.jsx    # File result cards
│       │   ├── MCPSuggestionBanner.jsx # Smart MCP suggestions
│       │   ├── MCPTestRunner.jsx      # MCP test scenarios
│       │   ├── NotificationSettings.jsx # Notification config
│       │   ├── MessagingConfig.jsx    # Messaging platform config
│       │   ├── ToolManager.jsx        # MCP tool management
│       │   ├── SecurityPanel.jsx      # Security settings
│       │   ├── TaskBuilder.jsx        # Task creation
│       │   └── ...
│       ├── hooks/             # Custom React hooks
│       │   ├── useChat.js             # Chat state management
│       │   ├── useSSE.js              # SSE event handling
│       │   ├── useAgentState.js       # Agent state aggregation
│       │   └── useMCPSuggestions.js   # MCP suggestion logic
│       ├── i18n/              # Translations (en.json, ja.json)
│       └── styles/            # Global styles
│
├── server/                    # Express backend
│   ├── index.js               # Entry point
│   ├── core/
│   │   ├── orchestrator.js    # Multi-agent pipeline orchestration
│   │   ├── ai-client.js       # Unified AI client
│   │   ├── claude-client.js   # Claude API integration
│   │   ├── model-registry.js  # Provider registry
│   │   ├── sse-manager.js     # SSE event management
│   │   └── agents/            # Agent implementations
│   ├── db/
│   │   └── init.js            # SQLite schema & migrations
│   ├── mcp/
│   │   ├── client.js          # MCP client manager
│   │   ├── builtin-servers.js # 50+ built-in server definitions
│   │   ├── suggestion-engine.js # Keyword-based MCP suggestions
│   │   └── test-scenarios.js  # MCP test scenarios
│   ├── notifications/
│   │   ├── service.js         # Notification dispatcher
│   │   └── channels/          # webhook, line, whatsapp, messenger
│   ├── webhooks/
│   │   ├── base.js            # Webhook handler base class
│   │   ├── line.js            # LINE webhook
│   │   ├── whatsapp.js        # WhatsApp webhook
│   │   └── messenger.js       # Messenger webhook
│   ├── security/              # PII detection, cost tracking, audit
│   ├── memory/                # Long-term memory
│   └── routes/                # API route handlers
│
├── .env.example
├── package.json
└── .gitignore
```

---

## API Endpoints

| Endpoint | Description |
|----------|------------|
| `POST /api/chat` | Send message to AI pipeline |
| `GET /api/stream/:id` | SSE stream for real-time updates |
| `GET/POST /api/conversations` | Conversation management |
| `GET/POST /api/tasks` | Task scheduling & management |
| `GET/POST /api/tools` | MCP tool configuration |
| `POST /api/tools/test-scenario` | Run MCP test scenarios |
| `POST /api/suggestions/mcp` | Get MCP server suggestions |
| `GET/POST /api/notifications` | Notification channel config |
| `POST /api/webhooks/{platform}` | Messaging platform webhooks |
| `GET/POST /api/messaging` | Messaging platform config |
| `POST /api/auth/login` | Authentication |
| `POST /api/approval` | Approve/reject agent actions |
| `GET /api/health` | Health check |

---

## SSE Events

| Event | Description |
|-------|------------|
| `agent:status` | Agent status change (idle/active/complete/error) |
| `agent:log` | Agent log message |
| `agent:detail` | Detailed agent action info (tool name, I/O preview) |
| `pipeline:progress` | Pipeline phase progress (step X/Y) |
| `executor:subtask_progress` | Executor subtask progress |
| `result:file` | File operation result (created/modified/read) |
| `cost:update` | Real-time cost tracking |
| `approval:request` | Agent requesting user approval |

---

## Scripts

```bash
npm run dev      # Start both client & server (development)
npm run server   # Start Express server only
npm run client   # Start Vite dev server only
npm run build    # Build client for production
npm start        # Alias for npm run dev
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `JWT_SECRET` | Yes | Secret for JWT token signing |
| `PORT` | No | Server port (default: 3456) |

Additional API keys can be configured through the UI for other providers (OpenAI, Google, Groq, etc.).

---

## License

MIT
