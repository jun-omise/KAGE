<div align="center">

<img src="client/public/favicon.svg" width="80" height="80" alt="KAGE Logo" />

# KAGE

### Secure Multi-Agent Personal AI Assistant

**4 AI agents working together. One seamless experience.**

Self-hosted. Multi-provider. Fully controllable from LINE, WhatsApp, or your browser.

[![GitHub release](https://img.shields.io/github/v/release/jun-omise/KAGE?style=flat-square&color=6366F1)](https://github.com/jun-omise/KAGE/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)

[Download](#-download) &nbsp;&bull;&nbsp; [Quick Start](#-quick-start) &nbsp;&bull;&nbsp; [Features](#-features) &nbsp;&bull;&nbsp; [Architecture](#-architecture) &nbsp;&bull;&nbsp; [API Reference](#-api-reference)

</div>

---

## What is KAGE?

KAGE is a **self-hosted AI assistant** that orchestrates 4 specialized agents to handle complex tasks securely on your local machine. Unlike single-model chatbots, KAGE's multi-agent pipeline ensures every task is security-checked, planned, executed, and reviewed before delivering results.

```
You: "Organize my project files and create a summary report"

  Sentinel  ─── security check & PII scan
      ↓
  Planner   ─── break into subtasks
      ↓
  Executor  ─── run tools (filesystem, search, code...)
      ↓
  Reviewer  ─── verify results & quality
      ↓
  Result    ─── files created + summary delivered
```

No cloud dependency. Your data stays on your machine.

---

## Download

### Option 1: Clone & Run (Recommended)

```bash
git clone https://github.com/jun-omise/KAGE.git
cd KAGE
npm install
cp .env.example .env
npm run dev
```

### Option 2: Download ZIP

> [**Download Latest Release (ZIP)**](https://github.com/jun-omise/KAGE/archive/refs/heads/main.zip)

After extracting:

```bash
cd KAGE-main
npm install
cp .env.example .env
npm run dev
```

### Option 3: Release Package

> [**Releases Page**](https://github.com/jun-omise/KAGE/releases) - Download versioned release packages

---

## Quick Start

### Prerequisites

| Requirement | Version |
|------------|---------|
| **Node.js** | 18+ |
| **npm** | 9+ |
| **API Key** | Anthropic, OpenAI, Google, or any supported provider |

### 3-Step Setup

```bash
# 1. Install
git clone https://github.com/jun-omise/KAGE.git && cd KAGE && npm install

# 2. Configure
cp .env.example .env
```

Edit `.env`:
```env
ANTHROPIC_API_KEY=sk-ant-...your-key...
JWT_SECRET=any-random-string-here
PORT=3456
```

```bash
# 3. Launch
npm run dev
```

Open **http://localhost:5173** — the Setup Wizard will guide you through initial configuration.

<div align="center">

| Step | What Happens |
|------|-------------|
| **Passphrase** | Set your login passphrase |
| **API Key** | Enter your AI provider key |
| **Security Level** | Choose Strict / Balanced / Relaxed |
| **Tools** | Connect MCP servers (optional) |
| **Done!** | Start chatting with KAGE |

</div>

---

## Features

### Multi-Agent Pipeline

<table>
<tr>
<td width="50%">

**4 specialized agents** work in sequence to ensure quality and security:

| Agent | Role |
|-------|------|
| **Sentinel** | Security check, PII detection, risk assessment |
| **Planner** | Task decomposition & strategy |
| **Executor** | Tool calls, file operations, API requests |
| **Reviewer** | Quality verification & response generation |

</td>
<td width="50%">

**Real-time visibility** into every step:

- Segmented progress bar (Step 2/7: Executing...)
- Agent Monitor with Cards & Timeline views
- Live tool call previews with JSON viewer
- Elapsed time & cost tracking
- Pause / Resume / Stop controls

</td>
</tr>
</table>

### Chat Interface

<table>
<tr>
<td width="50%">

- Markdown rendering with syntax highlighting
- File result cards (Created / Modified / Read)
- **Open in Finder** / **Open in VS Code** buttons
- Inline progress during task execution
- Conversation history & management

</td>
<td width="50%">

- Smart MCP suggestion banner
- Auto-detects needed tools from your message
- One-click server connection
- Bilingual support (English / Japanese)

</td>
</tr>
</table>

### 50+ MCP Tool Integrations

Connect to external tools via [Model Context Protocol](https://modelcontextprotocol.io):

| Category | Examples |
|----------|---------|
| **Development** | GitHub, GitLab, Docker, Kubernetes |
| **Productivity** | Slack, Notion, Google Drive, Todoist |
| **Data** | PostgreSQL, MySQL, MongoDB, Redis |
| **Search** | Brave Search, Google Search |
| **Cloud** | AWS, GCP, Azure, Vercel |
| **AI** | Hugging Face, Replicate |
| **Communication** | Gmail, Discord, Telegram |

**Smart Suggestion Engine** — type "search the web for..." and KAGE auto-suggests connecting Brave Search.

### Notification System

Get notified when tasks complete, fail, or need approval:

| Channel | Integration |
|---------|------------|
| **Webhook** | Any HTTP endpoint |
| **LINE** | LINE Notify API |
| **WhatsApp** | Twilio WhatsApp API |
| **Messenger** | Facebook Send API |

Configure event filters: task start, task complete, task error, approval needed.

### Remote Control via Messaging

Control KAGE from your phone:

```
You (LINE): authenticate my-secret-passphrase
KAGE: Authenticated successfully.

You (LINE): check disk usage on my server
KAGE: Running task... [Sentinel → Planner → Executor → Reviewer]
KAGE: Disk usage: 42% (210GB / 500GB). /var/log is using 38GB.
```

| Feature | Detail |
|---------|--------|
| **Platforms** | LINE, WhatsApp, Facebook Messenger |
| **Auth** | Passphrase-based per session |
| **Security** | HMAC-SHA256 signature verification |
| **Rate Limit** | 30 requests/hour per user |
| **Commands** | Configurable allowlist/blocklist |

### Security First

| Feature | Description |
|---------|-------------|
| **Authentication** | Passphrase + JWT |
| **PII Detection** | Auto-masks sensitive data |
| **Loop Detection** | Prevents infinite agent loops |
| **Cost Limits** | Per-task, daily, monthly caps |
| **Permissions** | Auto-approve / Always confirm / First-time confirm |
| **Audit Log** | Full action history |
| **Emergency Stop** | Kill all agents instantly |

### Multi-Provider AI

Switch between providers on the fly:

| Provider | Models |
|----------|--------|
| **Anthropic** | Claude 4, 3.5 Sonnet, Haiku |
| **OpenAI** | GPT-4o, GPT-4, GPT-3.5 |
| **Google** | Gemini 2.5 Pro, Flash |
| **Groq** | Llama, Mixtral |
| **xAI** | Grok |
| **Alibaba** | Qwen |
| **Moonshot** | Kimi |
| **OpenRouter** | 100+ models |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    KAGE Architecture                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐    ┌──────────────────────────────────────┐   │
│  │  React   │◄──►│          Express Server               │   │
│  │  Client  │SSE │                                      │   │
│  │          │    │  ┌────────────────────────────────┐   │   │
│  │ Chat     │    │  │      Orchestrator              │   │   │
│  │ Monitor  │    │  │                                │   │   │
│  │ Tools    │    │  │  Sentinel → Planner            │   │   │
│  │ Settings │    │  │      ↓         ↓               │   │   │
│  │          │    │  │  Sentinel → Executor (×N)      │   │   │
│  └──────────┘    │  │      ↓         ↓               │   │   │
│                  │  │  Reviewer → Response            │   │   │
│  ┌──────────┐    │  └────────────────────────────────┘   │   │
│  │  LINE    │    │                                      │   │
│  │ WhatsApp │◄──►│  ┌──────────┐  ┌──────────────────┐   │   │
│  │Messenger │    │  │  SQLite  │  │   MCP Servers    │   │   │
│  └──────────┘    │  │   DB     │  │  (50+ built-in)  │   │   │
│                  │  └──────────┘  └──────────────────┘   │   │
│                  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + Vite + Tailwind CSS | Fast, responsive dark UI |
| **Backend** | Node.js + Express | API server & orchestration |
| **Database** | SQLite (better-sqlite3) | Zero-config persistent storage |
| **AI** | Anthropic SDK + MCP SDK | Multi-model & tool integration |
| **Auth** | bcryptjs + JWT | Secure authentication |
| **Realtime** | Server-Sent Events (SSE) | Live agent status streaming |
| **i18n** | Custom hooks | English + Japanese |

---

## Project Structure

```
KAGE/
├── client/                         # Frontend (React + Vite)
│   └── src/
│       ├── App.jsx                 # Main app with 6-tab navigation
│       ├── components/
│       │   ├── ChatPanel.jsx       # Chat interface
│       │   ├── AgentMonitor.jsx    # Agent status (Cards / Timeline)
│       │   ├── ProgressIndicator.jsx # Pipeline progress bar
│       │   ├── PipelineTimeline.jsx  # Vertical timeline view
│       │   ├── ResultPresenter.jsx   # File result cards
│       │   ├── MCPSuggestionBanner.jsx # Smart tool suggestions
│       │   ├── MCPTestRunner.jsx     # MCP test scenarios
│       │   ├── ToolManager.jsx       # 50+ MCP server catalog
│       │   ├── NotificationSettings.jsx # Multi-channel notifications
│       │   ├── MessagingConfig.jsx   # LINE/WhatsApp/Messenger
│       │   ├── SecurityPanel.jsx     # Security dashboard
│       │   └── TaskBuilder.jsx       # Task scheduling
│       ├── hooks/                  # useChat, useSSE, useAgentState...
│       └── i18n/                   # en.json, ja.json
│
├── server/                         # Backend (Express)
│   ├── index.js                    # Entry point & route mounting
│   ├── core/
│   │   ├── orchestrator.js         # 4-agent pipeline engine
│   │   ├── ai-client.js            # Multi-provider AI client
│   │   ├── sse-manager.js          # Real-time event streaming
│   │   └── agents/                 # Sentinel, Planner, Executor, Reviewer
│   ├── mcp/
│   │   ├── client.js               # MCP connection manager
│   │   ├── builtin-servers.js      # 50+ server definitions
│   │   └── suggestion-engine.js    # Keyword → MCP server matching
│   ├── notifications/              # Webhook, LINE, WhatsApp, Messenger
│   ├── webhooks/                   # Inbound message handlers
│   ├── security/                   # PII, cost, audit, loop detection
│   ├── db/                         # SQLite schema & init
│   └── routes/                     # 13 API route modules
│
├── .env.example                    # Environment template
├── package.json                    # Monorepo scripts
└── README.md
```

---

## API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|------------|
| `POST` | `/api/chat` | Send message → triggers 4-agent pipeline |
| `GET` | `/api/stream/:id` | SSE stream for real-time agent updates |
| `GET` | `/api/conversations` | List conversations |
| `POST` | `/api/conversations` | Create new conversation |
| `POST` | `/api/approval` | Approve / reject / modify agent actions |

### Tools & MCP

| Method | Endpoint | Description |
|--------|----------|------------|
| `GET` | `/api/tools` | List connected tools |
| `GET` | `/api/tools/builtin` | List 50+ available MCP servers |
| `POST` | `/api/tools/connect` | Connect an MCP server |
| `POST` | `/api/tools/test-scenario` | Run MCP test scenario |
| `POST` | `/api/suggestions/mcp` | Get smart MCP suggestions |

### Notifications & Messaging

| Method | Endpoint | Description |
|--------|----------|------------|
| `GET/POST` | `/api/notifications/channels` | Notification channel CRUD |
| `POST` | `/api/notifications/channels/:id/test` | Send test notification |
| `POST` | `/api/webhooks/line` | LINE inbound webhook |
| `POST` | `/api/webhooks/whatsapp` | WhatsApp inbound webhook |
| `POST` | `/api/webhooks/messenger` | Messenger inbound webhook |
| `GET/POST` | `/api/messaging/config` | Messaging platform config |

### SSE Events

| Event | Payload |
|-------|---------|
| `agent:status` | `{ agent, status }` |
| `agent:detail` | `{ agent, currentAction, toolName, inputPreview, outputPreview }` |
| `pipeline:progress` | `{ phase, stepIndex, totalSteps, description, elapsed_ms }` |
| `executor:subtask_progress` | `{ subtaskIndex, totalSubtasks, description }` |
| `result:file` | `{ action, path, size, type }` |
| `cost:update` | `{ current, limit }` |
| `approval:request` | `{ id, tool, args, risk }` |

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | — | Anthropic API key |
| `JWT_SECRET` | Yes | — | Secret for JWT signing |
| `PORT` | No | `3456` | Server port |

*At least one AI provider key is required. Additional keys (OpenAI, Google, etc.) can be set through the Settings UI.

### Security Levels

| Level | Behavior |
|-------|----------|
| **Strict** | All actions require approval |
| **Balanced** | Read = auto, Write/Delete = confirm |
| **Relaxed** | Most actions auto-approved |

---

## Commands

```bash
npm run dev      # Start client + server (development)
npm run server   # Express server only (port 3456)
npm run client   # Vite dev server only (port 5173)
npm run build    # Production build
npm start        # Alias for npm run dev
```

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| `npm install` fails with native module errors | Ensure you have build tools: `xcode-select --install` (macOS) |
| Port 3456 already in use | Change `PORT` in `.env` or kill the existing process |
| "ANTHROPIC_API_KEY not set" | Add your key to `.env` file |
| Database locked errors | Delete `server/db/kage.db*` files and restart |
| MCP server won't connect | Check the server command works standalone: `npx -y @modelcontextprotocol/server-filesystem /tmp` |

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with [Anthropic Claude](https://anthropic.com) + [MCP](https://modelcontextprotocol.io)**

[Report Bug](https://github.com/jun-omise/KAGE/issues) &nbsp;&bull;&nbsp; [Request Feature](https://github.com/jun-omise/KAGE/issues) &nbsp;&bull;&nbsp; [Discussions](https://github.com/jun-omise/KAGE/discussions)

</div>
