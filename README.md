<div align="center">

<img src="client/public/favicon.svg" width="80" height="80" alt="KAGE Logo" />

# KAGE

### Secure Multi-Agent Personal AI Assistant

**4 AI agents working together. One seamless experience.**

Self-hosted. Multi-provider. Desktop app. Remote control via LINE / WhatsApp / Messenger.

[![GitHub release](https://img.shields.io/github/v/release/jun-omise/KAGE?style=flat-square&color=6366F1)](https://github.com/jun-omise/KAGE/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-blue?style=flat-square)](https://github.com/jun-omise/KAGE/releases)

[Download](#-download--ダウンロード) · [Getting Started](#-getting-started--はじめかた) · [Features](#-features--機能) · [Developer Setup](#-developer-setup--開発者向け) · [Architecture](#-architecture--アーキテクチャ) · [API Reference](#-api-reference)

</div>

---

## ⬇️ Download / ダウンロード

> **No terminal required** — download, install, start chatting.
>
> **ターミナル不要** — ダウンロードしてすぐ使えます。

| Platform | Download | Size |
|----------|----------|------|
| **🍎 macOS** | [**KAGE-macOS.dmg**](https://github.com/jun-omise/KAGE/releases/latest/download/KAGE-macOS.dmg) | ~120 MB |
| **🪟 Windows** | [**KAGE-Windows-Setup.exe**](https://github.com/jun-omise/KAGE/releases/latest/download/KAGE-Windows-Setup.exe) | ~90 MB |

> 💡 Alternatively, visit the [**Releases page**](https://github.com/jun-omise/KAGE/releases/latest) to see all versions.

---

## 🚀 Getting Started / はじめかた

### Step 1 — Install / インストール

**macOS**: Open the `.dmg` → drag **KAGE** to your Applications folder → double-click to launch.

**Windows**: Run the `.exe` installer → follow the prompts → KAGE launches automatically.

### Step 2 — Enter your API Key / APIキーを入力

On first launch, the **Setup Wizard** appears. Paste your AI provider API key:

| Provider | Get your key |
|----------|-------------|
| Anthropic (recommended) | [console.anthropic.com](https://console.anthropic.com/) |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) |
| Google AI | [aistudio.google.com](https://aistudio.google.com/apikey) |

Set a password for KAGE, then click **Complete Setup**.

### Step 3 — Start Chatting / チャット開始 🎉

That's it! Type a message and KAGE's 4-agent pipeline handles the rest:

```
You: "Organize my project files and create a summary report"

  Sentinel  → security check
  Planner   → break into subtasks
  Executor  → run tools (filesystem, search, code...)
  Reviewer  → verify results & quality
  ✅ Done    → files organized + summary delivered
```

---

## ✨ Features / 機能

### 🔒 Security-First Architecture

KAGE's **Sentinel agent** runs before and after every task:

- **Input validation** — blocks dangerous commands before execution
- **PII detection** — auto-masks credit card numbers, SSNs, phone numbers
- **Plan review** — validates execution plans for safety
- **Output sanitization** — ensures no sensitive data leaks
- **Loop detection** — prevents infinite agent loops
- **Cost enforcement** — hard limits on per-task / daily / monthly API costs

### 🤖 MCP Auto-Discovery (50+ Tools)

KAGE automatically detects which tools are needed from your message and connects them:

```
You: "Search GitHub for React component libraries"
  → Auto-connects github + brave_search servers
  → Searches, analyzes, summarizes
```

| Category | Examples |
|----------|---------|
| **Development** | GitHub, GitLab, Docker, Kubernetes, Git |
| **Productivity** | Slack, Notion, Google Drive, Todoist |
| **Data** | PostgreSQL, MySQL, MongoDB, Redis |
| **Search** | Brave Search, Google Search |
| **Cloud** | AWS, GCP, Azure, Vercel |
| **Communication** | Gmail, Discord, Telegram |

### 💰 Smart Cost Optimization

Automatically routes each agent to the cheapest suitable model — up to **90% cost reduction**:

| Agent | Role | Model Tier |
|-------|------|-----------|
| Sentinel | Security check | Fast (cheapest) |
| Planner | Task planning | Scales with complexity |
| Executor | Tool execution | Your chosen model |
| Reviewer | Quality check | Fast (cheapest) |

Real token tracking with per-agent cost breakdown. No more estimated costs.

### 🧠 Multi-Provider AI (8 Providers, 35+ Models)

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

### 📱 Remote Control via Messaging

Run KAGE on your PC at home, control it from your phone:

```
You (LINE): authenticate my-passphrase
KAGE: ✅ Authenticated.

You (WhatsApp): check my project build status
KAGE: Build passed. 142 tests green. Deploy ready.
```

Supported: **LINE**, **WhatsApp**, **Facebook Messenger** — same full 4-agent pipeline.

### 📋 Task Templates

Save frequently-used instructions as reusable templates with `{{variables}}`:

```
Template: "{{folder}}内のファイルを{{format}}形式で整理して"
→ Fill in: folder=~/Desktop, format=日付別
→ One-click execution
```

### 🌐 Bilingual (English + 日本語)

Full UI and agent responses in both English and Japanese.

---

## 🔄 Auto-Update / 自動アップデート

KAGE checks for updates automatically on launch. When a new version is available:

1. A dialog asks: **"v{x.y.z} is available. Download?"**
2. The update downloads in the background
3. When ready: **"Restart to install?"**
4. KAGE restarts and you're on the latest version

No manual re-download needed. Updates are delivered through GitHub Releases.

---

## 🏗️ Architecture / アーキテクチャ

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
| **Desktop** | Electron + electron-updater | Native macOS / Windows app with auto-update |
| **Frontend** | React 18 + Vite + Tailwind CSS | Fast, responsive dark UI |
| **Backend** | Node.js + Express | API server & orchestration |
| **Database** | SQLite (better-sqlite3) | Zero-config persistent storage |
| **AI** | Anthropic SDK + MCP SDK | Multi-model & tool integration |
| **Cost Engine** | ModelRouter + TokenTracker | Smart routing & real cost tracking |
| **Auth** | bcryptjs + JWT | Secure authentication |
| **Realtime** | Server-Sent Events (SSE) | Live agent status streaming |
| **i18n** | Custom hooks | English + Japanese |

---

## 👩‍💻 Developer Setup / 開発者向け

<details>
<summary><strong>Click to expand / クリックして展開</strong></summary>

### Prerequisites

| Requirement | Version |
|------------|---------|
| **Node.js** | 18+ |
| **npm** | 9+ |
| **API Key** | Anthropic, OpenAI, Google, or any supported provider |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/jun-omise/KAGE.git
cd KAGE

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
```

Edit `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...your-key...
JWT_SECRET=any-random-string-here
PORT=3456
```

```bash
# 4. Start development server
npm run dev
```

Open **http://localhost:5173** — the Setup Wizard will guide you through the rest.

### Commands

```bash
# Development
npm run dev              # Start client + server (recommended)
npm run server           # Express server only (port 3456)
npm run client           # Vite dev server only (port 5173)
npm run build            # Production build (client)

# Desktop App Build
npm run electron:dev         # Run Electron in dev mode
npm run electron:build:mac   # Build macOS .dmg
npm run electron:build:win   # Build Windows .exe
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | — | Anthropic API key |
| `JWT_SECRET` | Yes | — | Secret for JWT signing |
| `PORT` | No | `3456` | Server port |

*At least one AI provider key is required. Additional keys can be configured through the Settings UI.

### Project Structure

```
KAGE/
├── electron/                      # Desktop app (Electron)
│   ├── main.js                    # Main process + auto-updater
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
│   │   └── builtin-servers.js     # 50+ server definitions
│   ├── security/                  # PII, cost, audit, loop detection
│   ├── notifications/             # Webhook, LINE, WhatsApp, Messenger
│   └── routes/                    # API route modules
│
├── .env.example
├── package.json
└── README.md
```

### Releasing a New Version

KAGE uses GitHub Actions for automated builds. To release:

```bash
# 1. Bump version in package.json
npm version patch   # or minor / major

# 2. Push the tag
git push origin main --tags
```

GitHub Actions will automatically:
- Build macOS `.dmg` and Windows `.exe`
- Create a GitHub Release
- Upload installers as release assets
- Generate `latest-mac.yml` / `latest.yml` for auto-updater

</details>

---

## 📡 API Reference

<details>
<summary><strong>Click to expand / クリックして展開</strong></summary>

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

</details>

---

## ❓ Troubleshooting / トラブルシューティング

| Issue | Solution |
|-------|---------|
| macOS: "App is damaged" / 開けません | Run: `xattr -cr /Applications/KAGE.app` |
| Windows: SmartScreen warning | Click **More info** → **Run anyway** |
| Port 3456 in use | Change `PORT` in `.env` or Settings UI |
| "API key not set" | Add key in the Setup Wizard or Settings page |
| MCP server won't connect | Check: `npx -y @modelcontextprotocol/server-filesystem /tmp` |
| `npm install` fails (dev) | macOS: `xcode-select --install` / Windows: install Build Tools |
| Electron build fails (dev) | Run `npm run build` first, then `npm run electron:build:mac` |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push and open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with [Anthropic Claude](https://anthropic.com) + [MCP](https://modelcontextprotocol.io)**

[Report Bug](https://github.com/jun-omise/KAGE/issues) · [Request Feature](https://github.com/jun-omise/KAGE/issues) · [Discussions](https://github.com/jun-omise/KAGE/discussions)

</div>
