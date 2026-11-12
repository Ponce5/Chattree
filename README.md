<p align="center">
  <a href="https://chattree.chat">
    <img src="assets/chattree-logo.png" width="128" height="128" alt="Chattree Logo" style="border-radius: 24px;" />
  </a>
</p>

<h1 align="center">Chattree</h1>

<p align="center">
  <strong>Private, on-device AI assistant for Android with sandboxed WebAssembly extensions and vector RAG.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@chattree/cli"><img src="https://img.shields.io/npm/v/@chattree/cli?color=00d4ff&label=%40chattree%2Fcli" alt="CLI Version" /></a>
  <a href="https://www.npmjs.com/package/@chattree/sdk"><img src="https://img.shields.io/npm/v/@chattree/sdk?color=00e699&label=%40chattree%2Fsdk" alt="SDK Version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License MIT" /></a>
  <a href="https://chattree.chat"><img src="https://img.shields.io/badge/web-chattree.chat-blueviolet" alt="Website" /></a>
  <a href="https://chattree.chat/en/docs"><img src="https://img.shields.io/badge/docs-reference-success" alt="Documentation" /></a>
</p>

---

## 🌟 Highlights

- **🔒 100% Private & Offline:** Complete on-device model execution via llama.cpp. Zero telemetry, zero external tracking.
- **⚡ WebAssembly Sandbox:** Run high-performance plugins in WAT, AssemblyScript, and Rust under strict linear memory and instruction-fuel boundaries.
- **🧠 Vector RAG & Local Notes:** On-device semantic search powered by SQLite FTS5 and mobile vector embeddings.
- **🛠 Universal Extension Contract (ABI v2):** 20 comprehensive Host API namespaces with dynamic 64-bit memory descriptors and cooperative async suspension.
- **🛡 Enterprise Security Hardening:** Multi-layer defense with SSRF protection, DNS rebinding guards, SQLite jailbreaking filters, and Hardware KeyStore credential storage.

---

## 🚀 Quickstart: Build a Plugin in 60 Seconds

You don't need to install any global dependencies. Create, compile, test, and bundle your first plugin directly with `npx`:

```bash
# 1. Launch the interactive scaffold wizard
npx @chattree/cli create plugin my-plugin

# 2. Enter the plugin directory
cd my-plugin

# 3. Install devDependencies (if using AssemblyScript)
npm install

# 4. Compile source to WebAssembly and sync SHA-256
npx @chattree/cli build

# 5. Simulate execution locally in your terminal
npx @chattree/cli test --input "Hello from terminal"

# 6. Validate manifest schema and contracts
npx @chattree/cli validate

# 7. Generate .chattree-plugin distribution package
npx @chattree/cli package
```

### Supported Starter Templates

| Template | Language | Prerequisites | Best For |
|---|---|---|---|
| **AssemblyScript** *(Recommended)* | TypeScript | Node.js (`npm install`) | Rich business logic, full `@chattree/sdk` Host API support. |
| **WAT (WebAssembly Text)** | WebAssembly | None (Zero dependencies) | Instant lightweight commands with embedded WABT engine. |
| **Rust** | Rust | Rust toolchain (`cargo wasm32`) | High-performance cryptographic or algorithmic tasks. |

---

## 🏛 System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Chattree Mobile Core                            │
│  ┌───────────────────────┐  ┌───────────────────┐  ┌────────────────┐  │
│  │   Local LLM Engine    │  │  Vector RAG & DB  │  │ Intent Routing │  │
│  │   (llama.cpp GGUF)    │  │ (FTS5 + Embeddings│  │ (/slash & AI)  │  │
│  └───────────┬───────────┘  └─────────┬─────────┘  └────────┬───────┘  │
│              │                        │                     │          │
│  ┌───────────┴────────────────────────┴─────────────────────┴───────┐  │
│  │                    ChattreeHostApi Gateway                       │  │
│  │   [Consent Tokens] [Permission Guard] [SSRF Firewall] [Quotas]   │  │
│  └────────────────────────────────────┬─────────────────────────────┘  │
└───────────────────────────────────────┼────────────────────────────────┘
                                        │ Universal ABI v2 (Memory Descriptors)
┌───────────────────────────────────────┴────────────────────────────────┐
│                   Sandboxed WebAssembly Plugins                        │
│   ┌─────────────────────┐ ┌───────────────────┐ ┌──────────────────┐   │
│   │   AssemblyScript    │ │  WebAssembly Text │ │   Rust Native    │   │
│   │   (@chattree/sdk)   │ │      (WAT)        │ │  (wasm32 crate)  │   │
│   └─────────────────────┘ └───────────────────┘ └──────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔌 Host API Capabilities (20 Namespaces)

Chattree grants plugins sandboxed access to device and core features through declared manifest permissions:

| Namespace | Capabilities | Description |
|---|---|---|
| `core` | None | Read app version, platform environment, and runtime diagnostic info. |
| `storage` | `storage.private` | Isolated Key-Value persistence scoped per plugin. |
| `database` | `database.sql`, `storage.database` | Private dedicated SQLite database with up to 200 MB storage quota. |
| `network` | `network.http`, `network.local` | SSRF-guarded outbound HTTP requests and local network access. |
| `websocket` | `network.websocket` | Full-duplex streaming connections (up to 16 MB frame size). |
| `ui` | `ui.components`, `ui.render` | Render interactive cards with buttons, metrics, and progress bars. |
| `scheduler`| `scheduler.task`, `scheduler.cron` | Background periodic tasks and standard 5-field Cron jobs. |
| `ai` | `ai.context`, `ai.embeddings` | Access conversational context and generate semantic vector embeddings. |
| `notes` | `chattree.notes.read`, `.create`, `.update` | Interacting with native notes and semantic knowledge store. |
| `reminders`| `chattree.reminders.read`, `.create` | Create scheduled notifications and Android AlarmManager alarms. |
| `notifications` | `notifications.read`, `.reply`, `.action` | Read system alerts and trigger native inline replies. |
| `files` | `files.pick`, `files.read`, `files.write` | Sandboxed file selection and storage I/O. |
| `location` | `location.current` | Acquire coarse or fine geographic coordinates. |
| `camera` | `camera.capture` | Request photo capture from the device camera. |
| `contacts` | `contacts.read`, `contacts.create` | Access and search address book contacts. |
| `calendar` | `calendar.read`, `calendar.create` | Read and schedule calendar events. |
| `email` | `email.read`, `email.send` | Compose drafts and inspect mailbox messages. |
| `clipboard`| `clipboard.read`, `clipboard.write` | Access system clipboard with user authorization. |
| `share` | `share.text`, `share.file` | Invoke system sharing sheets for text and media. |
| `open` | `open.url`, `open.app` | Launch external URLs in browser or open installed apps. |

---

## 📂 Repository Layout

```text
chattree-repo/
├── assets/               # High-res branding logos and icons
├── docs/                 # Complete technical documentation & architecture guides
│   ├── ai_providers/     # Cloud & local LLM provider specifications
│   ├── plugins/          # Plugin contracts, host APIs, security & package formats
│   ├── app-features.md   # Core application features and capabilities
│   └── LIMITACIONES.md   # Platform boundaries and sandbox quotas
├── examples/             # Official developer examples (hello, notes-demo, trackers)
├── plugins/official/     # First-party plugins (calendar, mail, pdf, elevenlabs, notion)
├── templates/plugin/     # Authoritative starter templates
├── schemas/              # JSON Schemas (plugin manifest v1 & v2)
├── scripts/              # Validation test scripts (validate-all.mjs)
├── CHANGELOG.md          # Release history and ecosystem milestones
└── README.md             # This document
```

---

## 🌐 Official Resources

- **Website & Documentation:** [chattree.chat](https://chattree.chat)
- **Technical Documentation:** [chattree.chat/en/docs](https://chattree.chat/en/docs)
- **Marketplace Submissions:** [chattree.chat/submit-plugin](https://chattree.chat/submit-plugin)
- **NPM Packages:**
  - [`@chattree/cli`](https://www.npmjs.com/package/@chattree/cli)
  - [`@chattree/sdk`](https://www.npmjs.com/package/@chattree/sdk)

---

## 🤝 Contributing

We welcome community feedback, pull requests, and plugin submissions! Please review [CONTRIBUTING.md](./CONTRIBUTING.md) and our [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) before opening issues or submitting code.

---

## 📄 License

This project is licensed under the terms of the [MIT License](./LICENSE).
