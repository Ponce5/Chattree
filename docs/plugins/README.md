# Chattree Plugin SDK

> **SDK for WebAssembly plugin developers — Chattree 1.x**
>
> This documentation covers everything you need to create, package, and distribute
> a Chattree plugin without reading a single line of the Chattree source code.

---

## What is a Chattree plugin?

A Chattree plugin is a sandboxed **WebAssembly** (WASM) module that registers one or
more slash-commands (`/hello`, `/translate`, `/my-tool`…) in Chattree's command palette.

When the user types a command, Chattree:

1. Loads the plugin's `.wasm` binary.
2. Calls the exported function declared in `plugin.json`.
3. Intercepts any **Host API** calls the WASM makes to access device data.
4. Checks that every capability is granted by the user before forwarding the call.
5. Returns the plugin's text output back to the chat.

```
Developer
    ↓
plugin.json + plugin.wasm → .chattree-plugin (ZIP)
    ↓
Chattree (import plugin)
    ↓
User grants capabilities
    ↓
User types /command
    ↓
PluginRuntime (WASM sandbox)
    ↓
ChattreeHostApi (namespace router)
    ↓
Native service (Notes, Network, Storage, …)
```

---

## Documentation index

| Document | Description |
|---|---|
| [getting-started.md](getting-started.md) | Step-by-step guide to create your first plugin |
| [plugin-manifest.md](plugin-manifest.md) | Full reference for `plugin.json` |
| [package-format.md](package-format.md) | `.chattree-plugin` archive specification |
| [capabilities.md](capabilities.md) | Complete capability catalogue |
| [host-api.md](host-api.md) | ChattreeHostApi reference (operations, inputs, outputs) |
| [security.md](security.md) | Sandbox model and security boundaries |
| [errors.md](errors.md) | Error codes and troubleshooting guide |
| [versioning.md](versioning.md) | Plugin versioning and compatibility |
| [marketplace_publishing_guide.md](marketplace_publishing_guide.md) | Publishing to the Chattree Marketplace |
| [examples/hello/](examples/hello/) | Minimal `/hello` example plugin |
| [examples/notes-demo/](examples/notes-demo/) | `/notes-demo` example using Notes API |

> For the built-in chat commands `/note` and `/reminder`, their natural-language
> behavior, and the Notes/RAG flow, see the [Notes and Reminders guide](../notes-reminders.md).
> Plugin access to Notes and Reminders remains governed by the Host API and
> capability contracts below; it is independent of those chat interactions.

---

## Quick summary — Capability availability

| Capability | Status |
|---|---|
| `storage.private` | ✅ Available |
| `network.http` | ✅ Available |
| `notifications.send` | ✅ Available |
| `files.pick` / `files.read` / `files.write` | ✅ Available |
| `location.current` | ✅ Available |
| `camera.capture` | ✅ Available |
| `contacts.read` / `contacts.create` / `contacts.update` | ✅ Available |
| `calendar.read` / `calendar.create` / `calendar.update` / `calendar.delete` | ✅ Available |
| `share.text` / `share.file` | ✅ Available |
| `open.url` / `open.app` | ✅ Available |
| `chattree.notes.*` | ✅ Available (Phase 3G) |
| `chattree.reminders.*` | ✅ Available (Phase 3G) |
| `chattree.context.read` | ✅ Available (Phase 3G) |
| `chat.history.read` | 🔒 Prepared — not yet available from WASM |
| `ai.context` / `ai.embeddings` | 🔒 Prepared — not yet available from WASM |

See [capabilities.md](capabilities.md) for full details.

---

## Open source and distribution

Chattree plugins are designed to be open and auditable.  
A developer can distribute:

- **Source code** — WAT/C/Rust source that compiles to `plugin.wasm`
- **`plugin.json`** — manifest, always human-readable
- **`plugin.wasm`** — compiled binary
- **`.chattree-plugin`** — complete importable package (ZIP of the above)

Users can inspect `plugin.json` before granting any permissions.

> **Marketplace**: A future official Marketplace will let you publish packages
> for discovery by all Chattree users. The format is identical — no changes needed.

---

## Runtime requirements

| Requirement | Value |
|---|---|
| WASM spec | WebAssembly 1.0 MVP + `memory.copy` (bulk-memory proposal) |
| Memory (default) | 16 MB max (`maxMemoryPages` × 64 KB) |
| Fuel limit | 50 000 000 instructions |
| Execution timeout | 5 seconds per call |
| Async iterations | 10 max (for Host API round-trips) |
| Min `schemaVersion` | 1 |
| Min `runtimeApiVersion` | 1.0.0 |
