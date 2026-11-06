# Chattree Official Open-Source Plugins

This directory is the official workspace for first-party plugins maintained directly by the Chattree core team.

---

## Standards for Official Plugins

Every official plugin maintained here adheres to strict security, performance, and architecture standards:

1. **Official Package Structure**: Strict compliance with the root-level archive layout (`plugin.json`, `plugin.wasm`, `icon.png`).
2. **Schema-Compliant Manifest**: Fully validated against `schemas/plugin.manifest.v1.schema.json`.
3. **Explicit Permissions**: Minimal capability declarations following the principle of least privilege.
4. **Sandbox Compliance**: Zero unsafe native bindings; runs exclusively within WebAssembly linear memory.

---

## Official Plugins Catalog

| Plugin | Command | Description | Capabilities |
|---|---|---|---|
| [`calendar/`](./calendar/) | `/calendar <event title>` | Official device calendar integration with AI tool support for scheduling and querying events. | `calendar.create`, `calendar.read` |
| [`mail/`](./mail/) | `/gmail <command>` | Official IMAP/SMTP mail integration for inbox inspection and message composition (aliases: `/mail`, `/email`). | `storage.private`, `email.read`, `email.send` |
| [`pdf/`](./pdf/) | `/pdf <command>` | Official AI-powered PDF generator and document exporter. | `files.write` |
| [`elevenlabs/`](./elevenlabs/) | `/elevenlabs <text>` | Official ElevenLabs AI voice & speech synthesis plugin (aliases: `/tts`, `/voice`, `/audio`). | `network.http`, `storage.private`, `files.write` |
| [`notion/`](./notion/) | `/notion <command>` | Official Notion workspace integration for searching pages, databases, and creating structured notes. | `network.http`, `storage.private` |
| [`github/`](./github/) | `/github <command>` | Official GitHub workspace integration for technical issue drafting, repository inspection, and search. | `network.http`, `storage.private` |
| [`rpg/`](./rpg/) | `/rpg <action>` | Official Text RPG simulator and deterministic adventure engine with declarative UI cards and SQLite save persistence. | `database.sql`, `storage.private`, `ui.components` |
