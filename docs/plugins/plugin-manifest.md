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
  "allowedDomains": ["api.example.com", "*.example.com"],
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
| `schemaVersion` | `integer` | Yes | Manifest schema version (`1` for standard plugins, or `2` when declaring `inboundWebhooks` / `eventConsumers`). |
| `id` | `string` | Yes | Reverse-domain unique ID. E.g. `"com.example.my-plugin"`. Must be globally unique and not match a reserved internal ID. |
| `version` | `string` | Yes | Semantic version: `"MAJOR.MINOR.PATCH"`. E.g. `"1.0.0"`. |
| `minAppVersion` | `string` | No | Minimum Chattree version required. Omit if unknown. |

**`id` constraints:**
- Lowercase letters, digits, dots, hyphens only.
- Must contain at least one dot (e.g. `com.you.plugin`).
- Cannot start or end with a dot.
- Cannot use reserved internal IDs (`com.chattree.note`, `com.chattree.reminder`, `com.chattree.visual`, `com.chattree.weather`, `com.chattree.translate`, `com.chattree.calendar`, `com.chattree.internal`).

---

### Display

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Human-readable plugin name shown in settings. |
| `description` | `string` | Yes | One-line description for the plugin list. |
| `author` | `string` | Yes | Author name. |
| `authorEmail` | `string` | No | Contact email. |
| `homepageUrl` | `string` | No | Plugin homepage or repository URL. |
| `iconUrl` | `string` | No | Public raw HTTPS URL for the 512x512 icon image. |
| `bannerUrl` | `string` | No | Public raw HTTPS URL for the 1200x630 Marketplace banner. |
| `category` | `string` | No | Marketplace category (`productivity`, `utilities`, `devtools`, `ai`, `automation`, `files`, `communication`, `media`, `education`, `other`). |
| `tags` | `string[]` | No | Keywords used for discovery metadata. |
| `changelog` | `string` | No | Human-readable release notes. |

---

### Commands

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `primaryCommand` | `string` | Yes | Main slash-command (without `/`). E.g. `"hello"` → `/hello`. |
| `aliases` | `string[]` | No | Additional command aliases. E.g. `["h", "hi"]`. |
| `type` | `string` | Yes | Must be `"imported"` for third-party plugins. |

**`primaryCommand` constraints:**
- Lowercase letters, digits, hyphens only.
- No spaces, no slash.
- Must be unique across all installed plugins.

---

### Capabilities, permissions, and egress domains

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `capabilities` | `string[]` | No | Capability IDs required by this plugin. See [capabilities.md](capabilities.md). |
| `optionalCapabilities` | `string[]` | No | Capabilities the plugin can use if available, but does not strictly require. |
| `allowedDomains` | `string[]` | Conditional | **Required when `network.http` is used in imported/marketplace plugins (`SEC-4.3.4-05`).** Explicit allowlist of destination domains (e.g. `["api.github.com", "*.example.com"]`). Global wildcards (`"*"`), bare TLD wildcards (`"*.com"`), and multi-part public suffixes (`"*.co.uk"`) are rejected. |
| `allowedNotificationPackages` | `string[]` | Conditional | Whitelist of application package IDs permitted for notification access (e.g. `["com.whatsapp", "com.google.android.gm"]` or `["*"]`). Enforced strictly across Push, EventBus, and Host APIs whenever `notifications.read`, `notifications.query`, `notifications.reply`, or `notifications.action` is requested. If omitted, access is denied by default (`[]`). |

**Examples:**
```json
"capabilities": ["network.http", "notifications.read", "notifications.reply"],
"allowedDomains": ["api.openai.com", "*.example.com"],
"allowedNotificationPackages": ["com.whatsapp", "org.telegram.messenger"]
```

> Do NOT list capabilities, domains, or packages you do not use. Users see every item in the permission dialog.

---

### Tools

Each entry in `tools` declares one slash-command exposed by the plugin.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tools[].id` | `string` | Yes | Unique tool ID. Convention: `"<pluginId>.<command>"`. |
| `tools[].command` | `string` | Yes | Slash-command keyword (without `/`). |
| `tools[].entrypoint` | `string` | No | Optional per-tool WASM exported function name. Overrides the top-level `entrypoint` for this specific tool. |
| `tools[].displayName` | `string` | Yes | Label in the slash-menu. |
| `tools[].description` | `string` | Yes | One-line description in the slash-menu. |
| `tools[].capabilities` | `string[]` | No | Per-tool capability subset (merged with top-level). |
| `tools[].intentContract` | `object` | No | Declarative intent schema for conversational AI invocation without typing `/`. |

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
| `runtime` | `string` | Yes | Must be `"wasm"` for WebAssembly plugins. |
| `entrypoint` | `string` | Yes | Exported WASM function name Chattree will call. |
| `wasmPath` | `string` | Yes | Path to the WASM binary inside the archive. Always `"plugin.wasm"`. |
| `wasmSha256` | `string` | Yes | SHA-256 hex digest of `plugin.wasm` (64 hex chars). |
| `runtimeApiVersion` | `string` | Yes | Must be `"1.0.0"`. |
| `maxMemoryPages` | `integer` | No | WASM memory ceiling in 64 KiB pages. Runtime default: 512 pages (32 MiB); accepts up to 1024 pages (64 MiB). |
| `maxPayloadSizeBytes` | `integer` | No | Maximum request/response payload size in bytes (ABI v2). Default: 12 MiB (12582912 bytes); maximum: 16 MiB. |
| `outputOffset` | `integer` | No | Static output memory offset in bytes for legacy ABI v1 plugins. Default: 1024. Increase this (e.g. 32768) to expand ABI v1 input capacity. |
| `inputOffset` | `integer` | No | Static input memory offset in bytes for legacy ABI v1 plugins. Default: 0. |
| `timeoutMs` | `integer` | No | Per-call timeout in milliseconds. Runtime default: 5000; current validators accept up to 60000. Keep calls short and test on device. |
| `fuelLimit` | `integer` | No | Instruction fuel budget. Default: 50 000 000. |

**Memory sizing guide:**

| Use case | Recommended `maxMemoryPages` |
|----------|------------------------------|
| Text-only processing | 2 (128 KB) |
| Moderate JSON parsing | 4–16 (256 KB – 1 MB) |
| Image processing / large responses | 64–256 (4 MB – 16 MB) |

> Chattree will reject modules that exceed `maxMemoryPages` at load time. When authoring WAT directly, always specify both initial and maximum page bounds (e.g., `(memory (export "memory") 8 8)`). Chattree's Wasmtime engine uses dynamic memory sizing (`staticMemoryMaximumSize: 0`) and immediately disposes each `WasmInstance` after execution so virtual address space is never retained across calls.

---

### Inbound Webhooks & Event Consumers (`schemaVersion: 2`, optional)

Plugins that register HTTP webhook routes (`inboundWebhooks`) or react to device notifications (`device.notification.received`, `device.notification.updated`), scheduled tasks (`scheduler.trigger`), or inbound webhooks declare `eventConsumers`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `inboundWebhooks[].id` | `string` | Yes | Unique endpoint identifier within the plugin. |
| `inboundWebhooks[].path` | `string` | Yes | Canonical absolute route path starting with `/` (no `..`, `%`, `?`, or `#`). |
| `inboundWebhooks[].authType` | `string` | Yes | Must be `"bearer"` or `"hmacSha256Raw"`. |
| `inboundWebhooks[].eventType` | `string` | Yes | Explicit event type emitted on receipt (must match an `eventConsumers[].eventTypes` entry). |
| `inboundWebhooks[].idempotencyHeader` | `string` | Yes | HTTP header supplying deduplication IDs (e.g. `"X-Chattree-Delivery-Id"`). |
| `inboundWebhooks[].requiredPermissions` | `string[]` | No | Must include `"network.webhook_inbound"`. |
| `eventConsumers[].id` | `string` | Yes | Unique consumer identifier within the plugin. |
| `eventConsumers[].eventTypes` | `string[]` | Yes | Explicit event types to subscribe to (wildcards `*` are rejected). |
| `eventConsumers[].targetAction` | `string` | Yes | Exact `tools[].id` invoked when a matching event is dispatched. |
| `eventConsumers[].filter` | `object` | No | Declarative pre-filter evaluated by `EventFilterMatcher` before instantiating WASM. Supports scalar equality, arrays, boolean guards (`excludeOngoing`, `excludeFromMe`, `excludeGroupSummary`), and operator objects (`in`, `notIn`, `contains`, `containsAny`, `regex`, `not`). |
| `eventConsumers[].requiredPermissions` | `string[]` | No | Capabilities required before the event delivery is dispatched. |

---

### Settings (optional)

The manifest parser accepts an optional `settings` array with declarative field metadata (`key`, `label`, `type`, `defaultValue`, `description`, `options`, `isSecret`) rendered in **Settings → Plugins → [Plugin]** when configured.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `settings[].key` | `string` | Yes | Storage key. |
| `settings[].label` | `string` | Yes | UI label. |
| `settings[].type` | `string` | Yes | `"string"`, `"boolean"`, `"number"`, or `"select"`. |
| `settings[].defaultValue` | `string` | No | Default value string. |
| `settings[].description` | `string` | No | Help text shown under the field. |
| `settings[].options` | `string[]` | No | Required when `type == "select"`. |
| `settings[].isSecret` | `boolean` | No | Masks the input in the UI and encrypts the stored value at rest in `FlutterSecureStorage` (`EncryptedSharedPreferences` / Keychain), writing only a `__SECURE_STORED__` sentinel in `SharedPreferences`. |

---

## Validation rules enforced by Chattree

When you import a plugin, Chattree validates:

1. `schemaVersion` is `1` or `2` (`inboundWebhooks` and `eventConsumers` require `schemaVersion: 2`)
2. `id` matches `^[a-z0-9][a-z0-9._-]*[a-z0-9]$` with at least one dot and is not a reserved internal ID
3. `version` is valid semver (`MAJOR.MINOR.PATCH`)
4. `primaryCommand` matches `^[a-z0-9-]+$`
5. All declared `capabilities` exist in the capability registry
6. All `allowedDomains` entries are valid exact domains or subdomain patterns (`*.domain.com`), required whenever `network.http` is used in imported plugins
7. `wasmSha256` is present and 64 hex chars
8. `runtime` == `"wasm"` and `entrypoint` is non-empty
9. No command conflict with already-installed plugins

If any validation fails, Chattree shows the specific error and refuses to install.
