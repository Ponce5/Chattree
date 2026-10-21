# Chattree Mail Plugin

The **Official Mail Plugin** provides sandboxed, on-device email integration for Chattree. It allows the conversational AI to inspect, read, search, and draft emails through direct slash commands.

---

## Features

- **Exclusive Slash Command Activation:**
  - In accordance with privacy and security principles, the Mail plugin is strictly triggered by slash commands: `/mail`, `/correo`, or `/email`.
  - It does not intercept general chat messages without an explicit slash command.
- **Conversational AI Analysis:**
  - Returns structured inbox and message data directly to Chattree's conversational engine.
  - The AI analyzes the email content dynamically and responds conversationally without rigid pre-defined phrases.
- **Subcommands:**
  - `/mail` or `/mail inbox`: Lists recent messages, senders, dates, and unread count.
  - `/mail read <id>`: Inspects the full body and metadata of a specific message (e.g. `/mail read msg_01`).
  - `/mail search <query>`: Filters messages matching a keyword, sender, or subject.
  - `/mail send <to> | <subject> | <body>`: Drafts and dispatches a message.
- **Privacy & Sandboxing:**
  - Operates inside the WebAssembly linear-memory sandbox.
  - Requires explicit user authorization for `storage.private` and `network.http` capabilities.
  - Zero telemetry or third-party tracking.

---

## Required Capabilities

| Capability | Tier | Reason |
|---|---|---|
| `storage.private` | Standard | Allows isolated local caching of user email metadata and accounts. |
| `network.http` | Sensitive | Allows communicating with email servers or webhooks. |

---

## Package Structure

```text
plugins/official/mail/
├── icon.png           # 512x512 Pure black icon with white envelope glyph
├── banner.png         # 1200x630 Pure black cover banner with white typography
├── plugin.json        # Schema-validated manifest (v1.0.0)
├── plugin.wat         # WebAssembly Text format source
├── plugin.wasm        # Compiled WebAssembly binary
└── README.md          # Plugin documentation
```

---

## How to Package & Install

### 1. Validate the Plugin
```bash
node tools/validate-plugin.mjs plugins/official/mail/
```

### 2. Package into `.chattree-plugin`
```bash
node tools/package-plugin.mjs plugins/official/mail/
```

### 3. Install in the Chattree App
1. Transfer `mail-v1.0.0.chattree-plugin` to your device.
2. In Chattree, navigate to **Settings → Plugins → Import plugin**.
3. Select the file, review the capabilities, and confirm installation.
