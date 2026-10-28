# plugin.json — Full Manifest Reference

The `plugin.json` is the complete descriptor of a Chattree plugin.
Chattree reads it before executing any WASM code.

---

## Complete example

```json
{
  "schemaVersion": 1,
  "id": "com.example.my-plugin",
  "version": "1.2.0",
  "minAppVersion": "1.0.0",
  "name": "My Plugin",
  "description": "Short description shown in the plugin list.",
  "author": "Your Name",
  "authorEmail": "you@example.com",
  "homepageUrl": "https://github.com/you/my-plugin",
  "primaryCommand": "myplugin",
  "aliases": ["mp", "myplugin"],
  "type": "imported",
  "capabilities": ["network.http", "storage.private"],
  "optionalCapabilities": ["notifications.send"],
  "tags": ["utility", "network"],
  "changelog": "1.2.0: Added optional notification support.",
  "runtime": "wasm",
  "entrypoint": "run",
  "wasmPath": "plugin.wasm",
  "wasmSha256": "a1b2c3d4e5f6...",
  "runtimeApiVersion": "1.0.0",
  "maxMemoryPages": 4,
  "timeoutMs": 5000,
  "fuelLimit": 50000000,
  "tools": [
    {
      "id": "com.example.my-plugin.run",
      "command": "myplugin",
      "displayName": "My Plugin",
      "description": "Does something useful: /myplugin <input>",
      "capabilities": ["network.http"]
    }
  ],
  "settings": [
    {
      "key": "api_endpoint",
      "label": "API Endpoint",
      "type": "string",
      "defaultValue": "https://api.example.com",
      "description": "The remote API to call."
    }
  ]
}
```

---

## Field reference

### Identity

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | `integer` | ✅ | Must be `1`. |
| `id` | `string` | ✅ | Reverse-domain unique ID. E.g. `"com.example.my-plugin"`. Must be globally unique. |
| `version` | `string` | ✅ | Semantic version: `"MAJOR.MINOR.PATCH"`. E.g. `"1.0.0"`. |
| `minAppVersion` | `string` | ❌ | Minimum Chattree version required. Omit if unknown. |

**`id` constraints:**
- Lowercase letters, digits, dots, hyphens only.
- Must contain at least one dot (e.g. `com.you.plugin`).
- Cannot start or end with a dot.

---

### Display

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | ✅ | Human-readable plugin name shown in settings. |
| `description` | `string` | ✅ | One-line description for the plugin list. |
| `author` | `string` | ✅ | Author name. |
| `authorEmail` | `string` | ❌ | Contact email. |
| `homepageUrl` | `string` | ❌ | Plugin homepage or repository URL. |
| `tags` | `string[]` | ❌ | Keywords used for discovery metadata. |
| `changelog` | `string` | ❌ | Human-readable release notes. |

---

### Commands

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `primaryCommand` | `string` | ✅ | Main slash-command (without `/`). E.g. `"hello"` → `/hello`. |
| `aliases` | `string[]` | ❌ | Additional command aliases. E.g. `["h", "hi"]`. |
| `type` | `string` | ✅ | Must be `"imported"` for third-party plugins. |

**`primaryCommand` constraints:**
- Lowercase letters, digits, hyphens only.
- No spaces, no slash.
- Must be unique across all installed plugins.

---

### Capabilities and permissions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `capabilities` | `string[]` | ❌ | Capability IDs required by this plugin. See [capabilities.md](capabilities.md). |
| `optionalCapabilities` | `string[]` | ❌ | Capabilities the plugin can use if available, but does not strictly require. |

**Examples:**
```json
"capabilities": ["network.http", "chattree.notes.read", "storage.private"]
```

> Do NOT list capabilities you do not use. Users see every item in the permission dialog.

---

### Tools

Each entry in `tools` declares one slash-command exposed by the plugin.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tools[].id` | `string` | ✅ | Unique tool ID. Convention: `"<pluginId>.<command>"`. |
| `tools[].command` | `string` | ✅ | Slash-command keyword (without `/`). |
| `tools[].displayName` | `string` | ✅ | Label in the slash-menu. |
| `tools[].description` | `string` | ✅ | One-line description in the slash-menu. |
| `tools[].capabilities` | `string[]` | ❌ | Per-tool capability subset (merged with top-level). |
| `tools[].intentContract` | `object` | ❌ | Declarative intent schema for conversational AI invocation without typing `/`. |

#### Natural Language Invocation (`intentContract`)

Plugins can declare an optional `intentContract` inside any tool definition. When declared, Chattree's intent resolution engine allows the model to automatically invoke the tool in conversational natural language without requiring the user to type the explicit `/` slash command:

```json
"intentContract": {
  "intent": "check_status",
  "description": "Triggered when the user asks to check cluster, service, or server health",
  "fields": [
    {
      "name": "target",
      "type": "string",
      "description": "Cluster, service name, or endpoint (e.g. 'prod', 'auth')",
      "required": false
    }
  ],
  "maxResponseTokens": 100
}
```

---

### Runtime and WASM

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `runtime` | `string` | ✅ | Must be `"wasm"` for WebAssembly plugins. |
| `entrypoint` | `string` | ✅ | Exported WASM function name Chattree will call. |
| `wasmPath` | `string` | ✅ | Path to the WASM binary inside the archive. Always `"plugin.wasm"`. |
| `wasmSha256` | `string` | ✅ | SHA-256 hex digest of `plugin.wasm` (64 hex chars). |
| `runtimeApiVersion` | `string` | ✅ | Must be `"1.0.0"`. |
| `maxMemoryPages` | `integer` | ❌ | WASM memory ceiling in 64 KiB pages. Runtime default: 512 pages (32 MiB); accepts up to 1024 pages (64 MiB). |
| `maxPayloadSizeBytes` | `integer` | ❌ | Maximum request/response payload size in bytes (ABI v2). Default: 2 MiB (2097152 bytes); maximum: 16 MiB. |
| `outputOffset` | `integer` | ❌ | Static output memory offset in bytes for legacy ABI v1 plugins. Default: 1024. Increase this (e.g. 32768) to expand ABI v1 input capacity. |
| `inputOffset` | `integer` | ❌ | Static input memory offset in bytes for legacy ABI v1 plugins. Default: 0. |
| `timeoutMs` | `integer` | ❌ | Per-call timeout in milliseconds. Runtime default: 5000; current validators accept up to 60000. Keep calls short and test on device. |
| `fuelLimit` | `integer` | ❌ | Instruction fuel budget. Default: 50 000 000. |

**Memory sizing guide:**

| Use case | Recommended `maxMemoryPages` |
|----------|------------------------------|
| Text-only processing | 2 (128 KB) |
| Moderate JSON parsing | 4–16 (256 KB – 1 MB) |
| Image processing / large responses | 64–256 (4 MB – 16 MB) |

> Chattree will reject modules that exceed `maxMemoryPages` at load time.

---

### Settings (optional)

The manifest parser accepts a `settings` array with declarative field metadata, but the current app does not display these fields in plugin details and provides no Host API for reading their values. Do not rely on this field for user configuration until the app implements that behavior.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `settings[].key` | `string` | ✅ | Storage key. |
| `settings[].label` | `string` | ✅ | UI label. |
| `settings[].type` | `string` | ✅ | `"string"`, `"boolean"`, `"number"`, or `"select"`. |
| `settings[].defaultValue` | `string` | ❌ | Default value string. |
| `settings[].description` | `string` | ❌ | Help text shown under the field. |
| `settings[].options` | `string[]` | ❌ | Required when `type == "select"`. |
| `settings[].isSecret` | `boolean` | ❌ | Metadata flag only in the current app; it does not provide a secret-input UI or secure storage for plugin settings. |

Settings are currently parsed metadata only; no plugin settings UI or value-reading API is implemented. Do not place credentials in these fields.

---

## Validation rules enforced by Chattree

When you import a plugin, Chattree validates:

1. `schemaVersion` == 1
2. `id` matches `^[a-z0-9][a-z0-9._-]*[a-z0-9]$` with at least one dot
3. `version` is valid semver (`MAJOR.MINOR.PATCH`)
4. `primaryCommand` matches `^[a-z0-9-]+$`
5. All declared `capabilities` exist in the capability registry
6. `wasmSha256` is present and 64 hex chars
7. `runtime` == `"wasm"` and `entrypoint` is non-empty
8. No command conflict with already-installed plugins

If any validation fails, Chattree shows the specific error and refuses to install.
