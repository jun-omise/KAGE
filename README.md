<div align="center">

<img src="client/public/favicon.svg" width="80" height="80" alt="KAGE Logo" />

# KAGE

### Secure Multi-Agent Personal AI Assistant

**4 AI agents working together. One seamless experience.**

Self-hosted. Multi-provider. Desktop app. Remote control via LINE / WhatsApp / Messenger.

[![GitHub release](https://img.shields.io/github/v/release/jun-omise/KAGE?style=flat-square&color=6366F1)](https://github.com/jun-omise/KAGE/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-blue?style=flat-square)](https://github.com/jun-omise/KAGE/releases)

[Download](#-download) &nbsp;&bull;&nbsp; [Quick Start](#-quick-start) &nbsp;&bull;&nbsp; [Features](#-features) &nbsp;&bull;&nbsp; [vs OpenCraw](#-kage-vs-opencraw) &nbsp;&bull;&nbsp; [Architecture](#-architecture) &nbsp;&bull;&nbsp; [API Reference](#-api-reference)

</div>

---

## Why KAGE?

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

**No cloud dependency. Your data stays on your machine. No terminal needed.**

---

## KAGE vs OpenCraw

KAGE is designed from the ground up for **security, accessibility, and cost efficiency** — areas where existing open-source agents fall short.

| Feature | **KAGE** | **OpenCraw** |
|---------|----------|-------------|
| **Security Architecture** | 4-layer security (Sentinel agent, PII detection, loop detection, cost limits) | Basic sandboxing |
| **PII Auto-Masking** | Automatic detection & masking of SSN, credit cards, etc. | Not built-in |
| **Cost Control** | Per-task / daily / monthly limits with real-time tracking | No cost limits |
| **Audit Logging** | Full action history with security events | Minimal logging |
| **Emergency Stop** | Kill all agents instantly with one click | Not available |
| **User Interface** | Full web UI — anyone can use it, no terminal needed | CLI-focused, developer-only |
| **Desktop App** | Native macOS (.dmg) & Windows (.exe) installer | Terminal only |
| **Multi-Provider** | 8 AI providers, 35+ models, smart cost routing | Single provider |
| **Cost Optimization** | Auto-routes cheap models for simple agents (up to 90% savings) | Same model for everything |
| **MCP Auto-Install** | Detects needed tools from your message, auto-connects | Manual configuration |
| **Remote Control** | Control from LINE / WhatsApp / Messenger while away | Not available |
| **Task Templates** | Save & reuse chat instructions with variables | Not available |
| **Real-time Monitoring** | Agent Monitor with Cards / Timeline views, live progress | Basic status |
| **Bilingual** | English + Japanese | English only |
| **Self-Hosted** | 100% local, your data never leaves your machine | Requires cloud services |

### Security is Everything

KAGE's **Sentinel agent** runs before and after every task, performing:

- **Input validation** — blocks dangerous commands before execution
- **PII detection** — auto-masks credit card numbers, SSNs, phone numbers
- **Plan review** — validates execution plans for safety
- **Output sanitization** — ensures no sensitive data leaks in responses
- **Loop detection** — prevents infinite agent loops
- **Cost enforcement** — hard limits prevent runaway API costs

This is not an afterthought — it's the core architecture. Every single request passes through security checks twice (before planning and after planning), and outputs are sanitized before delivery.

### Anyone Can Use It

No terminal. No Docker. No technical setup.

1. **Download** the desktop app (.dmg for Mac, .exe for Windows)
2. **Double-click** to launch
3. **Enter your API key** in the Setup Wizard
4. **Start chatting** — KAGE handles everything else

The GUI makes KAGE accessible to non-developers: designers, managers, researchers — anyone who wants AI task automation without touching a command line.

---

## Download

### Option 1: Desktop App (Recommended)

> **No terminal required** — download, install, double-click.

| Platform | Download |
|----------|----------|
| **macOS** | [Download .dmg](https://github.com/jun-omise/KAGE/releases/latest) |
| **Windows** | [Download .exe](https://github.com/jun-omise/KAGE/releases/latest) |

### Option 2: Clone & Run (Developers)

```bash
git clone https://github.com/jun-omise/KAGE.git
cd KAGE
npm install
cp .env.example .env
npm run dev
```

### Option 3: Download ZIP

> [**Download Latest (ZIP)**](https://github.com/jun-omise/KAGE/archive/refs/heads/main.zip)

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

Open **http://localhost:5173** — the Setup Wizard will guide you.

---

## Features

### MCP Auto-Discovery & Auto-Install

KAGE automatically detects which tools are needed from your message and connects them — no manual setup required.

```
You: "Organize the files on my Desktop"

  KAGE auto-detects: filesystem needed
  → Auto-connects @modelcontextprotocol/server-filesystem
  → Executes task using file tools
  → Returns results
```

```
You: "Search GitHub for React component libraries and summarize the top 5"

  KAGE auto-detects: github + brave_search needed
  → Auto-connects both servers
  → Searches, analyzes, summarizes
  → Returns formatted comparison
```

50+ MCP servers available out of the box. KAGE matches keywords in your message (Japanese + English) to the right tools and connects them automatically.

### Smart Cost Optimization

KAGE automatically routes each agent to the cheapest suitable model:

| Agent | Role | Model Tier | Why |
|-------|------|-----------|-----|
| **Sentinel** | Security check | Fast (cheapest) | Simple validation, no reasoning needed |
| **Planner** | Task planning | Scales with complexity | Simple → Fast, Complex → Flagship |
| **Executor** | Tool execution | Your chosen model | Needs full capability |
| **Reviewer** | Quality check | Fast (cheapest) | Simple verification |

**Result**: Up to 90% cost reduction compared to using the same expensive model for everything.

Real token tracking with per-agent cost breakdown — no more estimated costs.

### Remote Control via Messaging

Run KAGE on your PC at home, control it from anywhere via your phone:

```
You (WhatsApp): authenticate my-passphrase
KAGE: ✅ Authenticated.

You (WhatsApp): check my project build status
KAGE: [Sentinel → Planner → Executor → Reviewer]
KAGE: Build passed. 142 tests green. Deploy ready.

You (LINE): organize downloads folder by file type
KAGE: Done. Moved 47 files into Images/, Documents/, Videos/.
```

| Feature | Detail |
|---------|--------|
| **Platforms** | LINE, WhatsApp, Facebook Messenger |
| **Auth** | Passphrase-based per session |
| **Security** | HMAC-SHA256 signature verification |
| **Rate Limit** | 30 requests/hour per user |
| **Full Pipeline** | Same 4-agent pipeline as web UI |

### Task Templates

Save frequently-used instructions as reusable templates with variables:

```
Template: "{{folder}}内のファイルを{{format}}形式で整理して"
Variables: folder = ~/Desktop, format = 日付別

→ Executes: "~/Desktop内のファイルを日付別形式で整理して"
```

- Save any chat message as a template
- Add `{{variable}}` placeholders
- Configure labels & default values
- One-click execution from task list

### Multi-Agent Pipeline

<table>
<tr>
<td width="50%">

**4 specialized agents** work in sequence:

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
- Live tool call previews
- Elapsed time & real cost tracking
- Model routing info per agent
- Pause / Resume / Stop controls

</td>
</tr>
</table>

### 50+ MCP Tool Integrations

| Category | Examples |
|----------|---------|
| **Development** | GitHub, GitLab, Docker, Kubernetes, Git |
| **Productivity** | Slack, Notion, Google Drive, Todoist |
| **Data** | PostgreSQL, MySQL, MongoDB, Redis |
| **Search** | Brave Search, Google Search |
| **Cloud** | AWS, GCP, Azure, Vercel |
| **AI** | Hugging Face, Replicate |
| **Communication** | Gmail, Discord, Telegram |
| **Design** | Figma |

### Multi-Provider AI (8 Providers, 35+ Models)

| Provider | Models |
|----------|--------|
| **Anthropic** | Claude Opus 4.6, Sonnet 4.6, Haiku 4.5 |
| **OpenAI** | GPT-5, GPT-4.1, o3, o4-mini |
| **Google** | Gemini 3.1 Pro, 2.5 Flash |
| **Groq** | Llama 4, DeepSeek R1 |
| **xAI** | Grok 4.20 |
| **Alibaba** | Qwen 3, Qwen Max |
| **Moonshot** | Kimi K2 |
| **OpenRouter** | 100+ models |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       KAGE Architecture                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐    ┌──────────────────────────────────────────┐  │
│  │  Electron   │    │           Express Server                │  │
│  │  Desktop    │    │                                        │  │
│  │  App        │    │  ┌──────────────────────────────────┐   │  │
│  │  (.dmg/exe) │    │  │        Orchestrator              │   │  │
│  ├────────────┤    │  │                                  │   │  │
│  │  React UI  │◄──►│  │  ModelRouter → Complexity Check  │   │  │
│  │            │SSE │  │  TokenTracker → Real Cost        │   │  │
│  │  Chat      │    │  │                                  │   │  │
│  │  Monitor   │    │  │  Sentinel → Planner              │   │  │
│  │  Tools     │    │  │      ↓         ↓                 │   │  │
│  │  Templates │    │  │  AutoMCP → Executor (×N)         │   │  │
│  │  Settings  │    │  │      ↓         ↓                 │   │  │
│  └────────────┘    │  │  Reviewer → Response             │   │  │
│                    │  └──────────────────────────────────┘   │  │
│  ┌────────────┐    │                                        │  │
│  │  LINE      │    │  ┌────────────┐  ┌──────────────────┐  │  │
│  │  WhatsApp  │◄──►│  │  SQLite   │  │  MCP Servers     │  │  │
│  │  Messenger │    │  │  DB       │  │  (50+ auto-inst) │  │  │
│  └────────────┘    │  └────────────┘  └──────────────────┘  │  │
│                    └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Desktop** | Electron | Native macOS / Windows app |
| **Frontend** | React 18 + Vite + Tailwind CSS | Fast, responsive dark UI |
| **Backend** | Node.js + Express | API server & orchestration |
| **Database** | SQLite (better-sqlite3) | Zero-config persistent storage |
| **AI** | Anthropic SDK + MCP SDK | Multi-model & tool integration |
| **Cost Engine** | ModelRouter + TokenTracker | Smart routing & real cost tracking |
| **Auth** | bcryptjs + JWT | Secure authentication |
| **Realtime** | Server-Sent Events (SSE) | Live agent status streaming |
| **i18n** | Custom hooks | English + Japanese |

---

## Project Structure

```
KAGE/
├── electron/                      # Desktop app (Electron)
│   ├── main.js                    # Main process
│   ├── preload.js                 # Preload script
│   └── builder.config.js          # Build config (dmg/exe)
│
├── client/                        # Frontend (React + Vite)
│   └── src/
│       ├── components/
│       │   ├── ChatPanel.jsx      # Chat interface
│       │   ├── AgentMonitor.jsx   # Agent status (Cards / Timeline)
│       │   ├── ProgressIndicator.jsx  # Pipeline progress bar
│       │   ├── TemplateEditor.jsx     # Template variable editor
│       │   ├── TemplateRunner.jsx     # Template execution
│       │   ├── SaveAsTemplateDialog.jsx # Save message as template
│       │   ├── ToolManager.jsx    # 50+ MCP server catalog
│       │   └── ...
│       ├── hooks/
│       │   ├── useTemplates.js    # Template CRUD
│       │   └── useSSE.js          # Real-time events + MCP auto-connect
│       └── i18n/                  # en.json, ja.json
│
├── server/                        # Backend (Express)
│   ├── core/
│   │   ├── orchestrator.js        # 4-agent pipeline + auto MCP
│   │   ├── ai-client.js           # Multi-provider AI client
│   │   ├── model-router.js        # Complexity-based model routing
│   │   ├── model-registry.js      # 35+ model catalog & pricing
│   │   ├── token-tracker.js       # Real token counting
│   │   └── agents/                # Sentinel, Planner, Executor, Reviewer
│   ├── mcp/
│   │   ├── client.js              # MCP connection manager
│   │   ├── auto-resolver.js       # Auto-detect & auto-connect MCP
│   │   ├── tool-server-map.js     # Tool → Server ID mapping
│   │   ├── suggestion-engine.js   # Keyword → MCP server matching
│   │   └── builtin-servers.js     # 50+ server definitions
│   ├── security/                  # PII, cost, audit, loop detection
│   ├── notifications/             # Webhook, LINE, WhatsApp, Messenger
│   └── routes/                    # 13+ API route modules
│
├── .env.example
├── package.json
└── README.md
```

---

## API Reference

### Core

| Method | Endpoint | Description |
|--------|----------|------------|
| `POST` | `/api/chat` | Send message → triggers 4-agent pipeline |
| `GET` | `/api/stream/:id` | SSE stream for real-time agent updates |
| `GET` | `/api/conversations` | List conversations |
| `POST` | `/api/approval` | Approve / reject agent actions |

### Models & Routing

| Method | Endpoint | Description |
|--------|----------|------------|
| `GET` | `/api/models` | List all 35+ models by provider |
| `GET` | `/api/models/routing` | Get model routing config |
| `POST` | `/api/models/routing/preview` | Preview routing for a message |
| `PUT` | `/api/models/active` | Switch active model |

### Tools & MCP

| Method | Endpoint | Description |
|--------|----------|------------|
| `GET` | `/api/tools/builtin` | List 50+ available MCP servers |
| `POST` | `/api/tools/connect` | Connect an MCP server |
| `POST` | `/api/suggestions/mcp` | Get smart MCP suggestions |

### Tasks & Templates

| Method | Endpoint | Description |
|--------|----------|------------|
| `GET` | `/api/tasks?is_template=true` | List templates |
| `POST` | `/api/tasks` | Create task/template |
| `POST` | `/api/tasks/:id/run` | Execute with variable substitution |

### SSE Events

| Event | Payload |
|-------|---------|
| `pipeline:progress` | `{ phase, stepIndex, totalSteps, elapsed_ms }` |
| `pipeline:routing` | `{ complexity, mainModel, routing }` |
| `agent:detail` | `{ agent, currentAction, model, toolName }` |
| `mcp:auto_connecting` | `{ serverId, serverName }` |
| `mcp:auto_connected` | `{ serverId, tools[] }` |
| `result:file` | `{ action, path }` |

---

## Commands

```bash
# Development
npm run dev              # Start client + server
npm run server           # Express server only (port 3456)
npm run client           # Vite dev server only (port 5173)
npm run build            # Production build

# Desktop App
npm run electron:dev     # Run Electron in dev mode
npm run electron:build:mac   # Build macOS .dmg
npm run electron:build:win   # Build Windows .exe
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | — | Anthropic API key |
| `JWT_SECRET` | Yes | — | Secret for JWT signing |
| `PORT` | No | `3456` | Server port |

*At least one AI provider key is required. Additional keys can be set through the Settings UI.

### Security Levels

| Level | Behavior |
|-------|----------|
| **Strict** | All actions require approval |
| **Balanced** | Read = auto, Write/Delete = confirm |
| **Relaxed** | Most actions auto-approved |

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| `npm install` fails | `xcode-select --install` (macOS) or install build tools |
| Port 3456 in use | Change `PORT` in `.env` |
| "API key not set" | Add key to `.env` or Settings UI |
| MCP server won't connect | Check: `npx -y @modelcontextprotocol/server-filesystem /tmp` |
| Electron build fails | Run `npm run build` first, then `npm run electron:build:mac` |

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push and open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with [Anthropic Claude](https://anthropic.com) + [MCP](https://modelcontextprotocol.io)**

[Report Bug](https://github.com/jun-omise/KAGE/issues) &nbsp;&bull;&nbsp; [Request Feature](https://github.com/jun-omise/KAGE/issues) &nbsp;&bull;&nbsp; [Discussions](https://github.com/jun-omise/KAGE/discussions)

</div>
