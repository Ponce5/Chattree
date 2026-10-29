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
| [`echo/`](./echo/) | `/echo <message>` | Minimal echo utility demonstrating zero-overhead WebAssembly execution. | *(None)* |
| [`calendar/`](./calendar/) | `/calendar <event title>` | Official device calendar integration with AI tool support for scheduling and querying events. | `calendar.create`, `calendar.read` |
| [`mail/`](./mail/) | `/mail <command>` | Official IMAP/SMTP mail integration for inbox inspection and message composition. | `email.read`, `email.send` |
| [`pdf/`](./pdf/) | `/pdf <command>` | Official PDF processing and extraction plugin. | `files.read`, `files.write` |
| [`elevenlabs/`](./elevenlabs/) | `/elevenlabs <text>` | Official ElevenLabs AI voice & speech synthesis plugin. | `network.http`, `storage.private`, `files.write` |
| [`github/`](./github/) | `/github <command>` | Official GitHub integration for inspecting repos, managing issues, and viewing PRs. | `network.http`, `storage.private`, `open.url` |
