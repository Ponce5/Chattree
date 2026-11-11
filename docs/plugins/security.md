# Security — Plugin Sandbox Model

Chattree's WASM plugin runtime is designed with security as a first-class concern.
This document explains the sandbox model and what plugins can and cannot do.

---

## Isolation guarantees

A WASM plugin runs inside a **WebAssembly linear memory sandbox**.

### What a plugin cannot do

| Access | Status |
|--------|--------|
| Native filesystem paths | ❌ Blocked |
| Operating system sockets / raw TCP | ❌ Blocked |
| SharedPreferences / host SQLite directly | ❌ Blocked (plugins must use sandboxed `database.sql` private SQLite databases; direct host DB access is prohibited) |
| Other plugins' private data | ❌ Blocked |
| Unbounded full chat history | ❌ Blocked (`chat.history.read` is strictly capped at the 20 most recent messages) |
| Unbounded or recursive AI tool loops | ❌ Blocked (`ai.context` is strictly single-turn and capped at 2,048 output tokens) |
| Dart VM heap or native objects | ❌ Blocked |
| Device hardware without a capability | ❌ Blocked |
| Private IPs / loopback addresses | ❌ Blocked by default (`WebhookSsrfGuard` blocks all IANA special IPv4/IPv6 ranges including Carrier-Grade NAT, Benchmarking, ULA, 6to4, Teredo, loopback, and cloud metadata `169.254.x.x`; multi-IP DNS pre-validates every IP with fallback; requires critical `network.local` capability for LAN/loopback) |
| Inbound Webhook Replay / Body Leaks | ❌ Blocked (max 72h replay window; request bodies and secrets strictly censored from activity logs; KV store-and-forward purged atomically) |
| Persistent Background Sockets | ❌ Blocked (LAN server operates strictly in foreground with immediate OS lifecycle suspension, zero foreground services) |
| `file://`, `javascript:`, `intent:` URIs | ❌ Blocked |
| Spawning background threads or processes | ❌ Blocked |
| Persisting data without `storage.private` | ❌ Blocked |
| Running indefinitely (no timeout) | ❌ Blocked |
| Consuming unlimited CPU (no fuel limit) | ❌ Blocked |
| Consuming unlimited memory | ❌ Blocked |

### What a plugin can do

Only what is **explicitly granted by the user through capabilities**:

- Access its own isolated key-value storage.
- Make HTTP/HTTPS requests to public internet servers.
- Display local notifications.
- Read/write files through the user's explicit file-picker selection.
- Get a one-shot GPS position.
- Capture a photo through the system camera UI.
- Read/write/delete the user's Chattree notes and reminders.
- Read the current message context.
- Open URLs or other apps.

---

## Capability enforcement

Every capability is checked by `PermissionGateway` before any operation runs:

```
WASM calls host_call("chattree.notes", "create", {...})
    ↓
PermissionGateway.hasCapability(pluginId, "chattree.notes.create")
    ↓ denied?
HostApiResponse.error("permissionDenied", missingCapabilities: [...])
    ↓ granted?
NotesApiHandler._handleCreate(...)
```

The `pluginId` is **always injected by the runtime** — the plugin cannot forge it.

### Zero-Trust Permission Policy & Reserved Internal IDs
- **No external auto-grants:** Every imported or Marketplace plugin (`type: "imported"`) starts with zero sensitive/critical capabilities granted, regardless of its reverse-domain prefix (including `com.chattree.*` or `com.chattree.official.*`). Only built-in `PluginType.internal` tools shipped inside the application binary receive pre-approved internal capabilities.
- **Reserved internal IDs:** Third-party packages cannot use reserved system identifiers (`com.chattree.note`, `com.chattree.reminder`, `com.chattree.visual`, `com.chattree.weather`, `com.chattree.translate`, `com.chattree.calendar`, `com.chattree.internal`).

---

## Memory limits

| Resource | Default | Configurable? |
|----------|---------|---------------|
| WASM linear memory | 32 MB default | Yes — `maxMemoryPages` (up to 1024 pages / 64 MB); fresh isolated linear memory per call |
| Compiled WASM module cache | 8 modules (LRU) | Bounded in-memory LRU cache (`maxCachedModules = 8`) in `PluginRuntime` |
| ABI v1 Input Buffer | 1,024 bytes default | Yes — Configurable via `"outputOffset"` in `plugin.json` (capacity = `outputOffset - inputOffset`) |
| ABI v2 Dynamic Payload | 12 MB default | Yes — Configurable up to 16 MB via `"maxPayloadSizeBytes"` in `plugin.json` |
| Execution timeout | 5 seconds by default | Current manifest validators accept up to 60000 ms; enforced per invocation by runtime |
| CPU fuel | 50 000 000 instructions | Yes — `fuelLimit` |
| Async iterations | 50 round-trips | No |
| Max concurrent HTTP per plugin | 20 | No |
| HTTP request body | 4 MB (`4,194,304` bytes) | No |
| HTTP response body | 8 MB (`8,388,608` bytes) | No |
| Notification rate | 15 per hour (sliding window) | No |
| Notification title max | 100 characters | No |
| Notification body max | 500 characters | No |
| File read limit | 8 MB (`8,388,608` bytes) | No |
| File write limit | 8 MB (`8,388,608` bytes) | No |
| Share text limit | 32,768 chars (32 KB) | No |
| Share subject limit | 200 characters | No |
| Clipboard read/write limit | 100 KB (`102,400` chars) | No |
| Note title max | 300 characters | No |
| Note content max | 50,000 characters | No |
| Note search limit | 100 results (default 50) | No |
| Reminder title max | 300 characters | No |
| Reminder list limit | 100 results (default 50) | No |
| Chat history messages limit | 20 recent messages | No |
| Chat history message char limit | 4,000 characters per message | No |
| AI embed text length max | 50,000 characters | No |
| AI prompt length max | 16,000 characters | No |
| AI completion max tokens | 2,048 tokens (default 512) | Configurable (16–2048) |
| Inbound webhook max payload | 256 KB (`262,144` bytes) | No |
| Inbound webhook body timeout | 10 seconds | No |
| Inbound HTTP concurrent requests | 32 requests | No |
| Outbound webhook response drain | 8 KB (`8,192` bytes) | No |
| Outbound webhook concurrent | 16 global / 5 per extension | No |
| Outbound webhook retry backoff | Base 10s + jitter (0..2s), up to 5 retries | Built-in |
| Package archive size (compressed) | 25 MB (`26,214,400` bytes) | No |
| Package uncompressed total size | 50 MB (`52,428,800` bytes) | No |
| Package archive file count | 50 entries max | No |
| Private storage key max | 256 chars | No |
| Private storage value max | 256 KB (`262,144` bytes) | No |
| Private storage quota per plugin | 500 keys / 2 MB (`2,097,152` bytes) total | No |
| WebSocket concurrent sockets | 10 active connections per plugin | Atomic pre-handshake reservations |
| WebSocket max frame size | 16 MB (`16,777,216` bytes) | Enforces RFC 6455 1009 closure on exceed |
| WebSocket memory buffer | 500 messages per socket | Automatic FIFO queue |
| UI elements per card | 60 elements max | Validated via `UiApiHandler.sanitizeUiCard` |
| UI key-value items | 40 items max | Validated |
| UI buttons per row | 8 buttons max | Security confirmation dialog for `/` commands |
| Scheduled tasks per plugin | 25 active tasks max | Enforced by `PluginTaskScheduler` |
| Scheduled task min interval | 60 seconds minimum | Anti-battery drain protection |
| Scheduled task payload | 128 KB (`131,072` bytes) max | Structured JSON payload |
| SQLite database storage quota | 200 MB (`209,715,200` bytes) | Calculates `.db` + `-wal` + `-shm` + `-journal` |
| SQLite query result limit | 2,000 rows max per query | Memory OOM guard |
| SQLite sandbox defense | Blocked `ATTACH`, `DETACH`, `VACUUM INTO`, `PRAGMA writable_schema` | Security boundary |
| Notification reply max length | 4,000 characters | Android Binder IPC `TransactionTooLargeException` guard |
| Notification native cache | 500 sessions max (Android `LruCache`) | Ephemeral in-memory only; zero disk persistence in Core |
| Notification burst debounce | 200 ms per notification thread | Prevents CPU/EventBus flooding |
| Notification OTP/2FA filter | Native Android regex & category drop | Strips 4-8 digit codes, passwords, and 2FA tokens before Dart |

---

## Notification Hub Security Model

The Notification Hub subsystem connects Chattree plugins to Android status bar notifications with strict privacy, authorization, and memory safety guarantees:

1. **True Zero-Persistence Core:** Chattree Core maintains zero historical tables, journals, or disk logs for device notifications. Notifications are treated as ephemeral in-memory signals and bypass the SQLite `EventJournal` (0 rows created in `events` / `event_deliveries`). Any plugin wishing to record notification history must request `database.sql` / `storage.database` and persist data in its own private, isolated SQLite database (`chattree_plugin_<id>.db`).
2. **Package Scope Whitelist (`allowedNotificationPackages`):** Notification events, active status queries, direct replies, and action invocations are strictly bounded by the `allowedNotificationPackages` list declared in the plugin manifest. A plugin cannot observe or interact with notifications from unauthorized applications. Omission of this field results in a strict deny-all default (`[]`).
3. **Cryptographically Secure Action Handles:** Quick actions are identified by unguessable, 128-bit UUID v4 tokens (`act_<uuid4>`). Deterministic or sequential IDs are prohibited.
4. **Single-Use Replay Protection:** Each `actionHandle` can only be invoked once. Upon triggering, the native service flags `isUsed = true` and purges the token immediately to prevent replay or race conditions.
5. **Triple-Binding Validation:** Actions are cryptographically bound to the tuple `(pluginId, notificationKey, packageName)`. Dart and native Kotlin independently verify that the caller matches the authorized plugin and target application package before executing any `PendingIntent`.
6. **Action Lifespan & TTL:** Action handles expire automatically after **5 minutes** from generation, or immediately upon notification dismissal/removal from the status bar. Obsolete actions cannot be executed.
7. **Background Activity Launch (BAL) Restrictions:** On Android 14+ (API 34+), actions that trigger background activities are invoked with explicit `ActivityOptions.makeBasic().setPendingIntentBackgroundActivityStartMode(...)`. On Android 10–13, background activity launches remain governed by native OS restrictions when no foreground service is active.
8. **Hardware & Native OTP / 2FA Exclusion:** Before any notification crosses into the Flutter engine or `HostEventBus`, the Android native listener evaluates titles, bodies, and Android notification categories against regular expressions and security keywords (`\b\d{4,8}\b`, *código*, *verification code*, *OTP*, *2FA*, *seguridad*). All matching alerts are discarded at the OS level.
9. **Binder IPC Protection:** Plugin replies sent via `notifications.reply` are enforced with a strict 4,000-character limit, preventing Android system server `TransactionTooLargeException` crashes.
10. **Granular RBAC:** A plugin cannot listen to notifications without `notifications.read`, cannot query active notifications without `notifications.query`, cannot reply without `notifications.reply`, and cannot dismiss or invoke actions without `notifications.action`. Every capability requires explicit user approval.

---

## Path traversal protection

File operations use **opaque handles** instead of real paths:

- `files.pick` returns a `handle` (e.g. `f_a1b2c3...`).
- `files.read` accepts only a handle, never a path string.
- `files.write` saves to the plugin's private sandbox — path is determined by Chattree.
- A handle can only be used by the plugin that created it.

This completely prevents path traversal (`../`) attacks.

---

## SSRF protection (network)

The `network.http_request` operation blocks:

- `localhost`, `127.0.0.1`, `::1`, `0.0.0.0`
- `*.localhost`, `*.local`, `*.internal`, `*.lan`, `*.home`, `*.corp`
- RFC 1918 private ranges: `10.x.x.x`, `172.16–31.x.x`, `192.168.x.x`
- Link-local: `169.254.x.x`
- Carrier-grade NAT: `100.64–127.x.x`
- IPv6 unique local (`fc00::/7`) and link-local (`fe80::/10`)
- DNS resolution is checked to prevent DNS rebinding attacks.

Only public internet addresses resolve by default. If the plugin declares and is granted the critical `network.local` capability, RFC 1918 LAN IPv4 addresses, IPv6 Unique Local (`fc00::/7`), loopback (`localhost` / `127.0.0.1`), and `.local`/`.lan`/`.home` domains are permitted, while cloud metadata (`169.254.0.0/16`, `fe80::/10`), multicast, and `0.0.0.0` remain strictly blocked.

---

## URL and URI safety

The `open.url` operation blocks these schemes:

- `file://` — local filesystem access
- `javascript:` — code injection
- `content://` — Android content provider direct access
- `intent://` — Android intent exploitation
- `blob:` — blob URL exploitation
- `data:` — data URL injection
- `chrome://`, `about:` — browser internals

Only `https://` and `http://` are allowed for `open.url`.

---

## What a plugin MUST NOT do

Beyond technical enforcement, these are **behavioral requirements**:

1. **Do not store sensitive data unnecessarily** — if you read a note or a contact,
   don't save it to `storage.private` unless the user explicitly requested it.

2. **Do not exfiltrate data** — do not send user's notes, contacts, or reminders
   to an external server without an obvious, explicit user action.

3. **Do not abuse notifications** — use them only for genuinely useful alerts,
   not to spam the user.

4. **Do not claim capabilities you don't need** — only declare the minimum
   capabilities required. Users will see the full list in the permission dialog.

5. **Do not loop indefinitely** — plugins have a fuel limit. Infinite loops will
   be terminated.

6. **Do not store API keys in plaintext** — use `isSecret: true` in settings
   definitions; Chattree will obscure them in the UI.

---

## Android and iOS platform limits

Some capabilities depend on OS-level permissions that **Chattree itself must have**
in its `AndroidManifest.xml` or iOS `Info.plist`. These are pre-configured:

| Capability | Android permission | iOS Info.plist key |
|---|---|---|
| `location.current` | `ACCESS_FINE_LOCATION` | `NSLocationWhenInUseUsageDescription` |
| `camera.capture` | `CAMERA` | `NSCameraUsageDescription` |
| `contacts.read` | `READ_CONTACTS` | `NSContactsUsageDescription` |
| `contacts.create` | `WRITE_CONTACTS` | `NSContactsUsageDescription` |
| `calendar.read` | `READ_CALENDAR` | `NSCalendarsUsageDescription` |
| `calendar.create` | `WRITE_CALENDAR` | `NSCalendarsUsageDescription` |
| `notifications.send` | `POST_NOTIFICATIONS` (Android 13+) | — |

A plugin cannot access these features if the OS-level permission is denied.
Chattree will report the OS denial clearly in the Host API error response.

> Platform support and OS permission behavior must be checked against the specific Chattree release and target device. Host API registration does not guarantee every operation is available on every platform.

---

## Cryptographic Trust Boundaries & Signature Architecture

The Chattree plugin ecosystem incorporates an enterprise-grade trust architecture to guarantee package authenticity, prevent rollback attacks, and secure the execution runtime against in-memory tampering:

### 1. Inmutable Ed25519 Root of Trust (`PluginTrustStore`)
- **Official Public Root:** Chattree embeds a single, immutable official Ed25519 public root key constant (`officialKeyBytesV1`) in production.
- **Offline Private Key Custody:** The official private signing key is held strictly offline in secure hardware custody by Chattree maintainers. No private keys, mock keypairs, or deterministic test seeds exist anywhere within the production codebase (`lib/`) or compiled application binaries (`libapp.so`).
- **Sealed Production Authority:** Dynamic re-registration or runtime mutation of the official root key is strictly blocked in production instances. Test injection helpers (`createIsolatedForTesting`) operate exclusively within isolated test contexts and cannot influence the production trust store.

### 2. Marketplace & Certified Developer PKI
- **Marketplace Community Packages:** Distributed freely via GitHub Releases and cataloged via the official Chattree directory. Integrity is enforced by SHA-256 binary validation, manifest conformance, and sandbox memory/capability boundaries without requiring community developers to handle complex offline cryptographic key signing.
- **Enterprise & Certified Packages:** Where required, developer keys can be accompanied by an Ed25519 certificate issued and signed by the Chattree official root authority (`rootKeyId = "chattree-official-v1"`).
- **Strict Validation Matrix:** When a signature envelope is present, the runtime enforces verification across multiple critical dimensions:
  1. `rootKeyId` must match the embedded official root authority.
  2. The certificate's cryptographic signature is verified against the official root public key.
  3. `developerId` and package publisher identity must bind strictly to the public key.
  4. Validity timestamps (`validFrom` / `validUntil`) are strictly validated against UTC time.
  5. Minimum application version compatibility (`minAppVersion`) is checked prior to trust registration.
- **Atomic Registration:** Community key and certificate registration enforces atomic, fail-closed disk persistence. If storage persistence fails, in-memory registrations are immediately rolled back.

### 3. Persistent Anti-Downgrade Watermark (`PluginStateStore`)
To prevent **rollback attacks** (where an attacker supplies an older, officially signed version containing known vulnerabilities):
- Chattree maintains an append-only, persistent version watermark in `PluginStateStore` recording the maximum historical SemVer installed for every plugin ID.
- Any attempt to import, install, or update a plugin to a version lower than the recorded historical maximum is unconditionally rejected with a `SecurityException`:
  > *"Degradación de versión rechazada: La versión \"X\" es inferior a la versión máxima registrada históricamente (\"Y\")."*
- Reinstalling the *same* version (`v1.0.0 → v1.0.0`) is permitted for repairs, but any downgrade is blocked.

### 4. Single-Use Cryptographic WASM Authorization (`WasmExecutionAuthorization`)
- **Execution Tokens:** A WASM module cannot be executed directly by calling the runtime. The runtime requires a cryptographically validated, single-use `WasmExecutionAuthorization` token.
- **Package Manager Identity Binding:** Tokens are minted exclusively by `PluginPackageManager` after full package integrity and manifest validation, and are referentially bound to `PluginPackageManager.instance`. Any token generated by an isolated test instance or forged context is rejected with `SecurityException` by the production runtime.
- **One-Time Consumption:** Tokens are invalidated immediately upon first use (`claimAndConsumeSync()`), preventing token reuse or replay attacks.

### 5. Production Runtime Mutator Sealing (`lockForProduction`)
To prevent test mutators from compromising security state in production:
- On application startup (`main()`), production singletons are permanently locked:
  - `PluginStateStore.instance.lockForProduction()`
  - `PluginPackageManager.instance.lockForProduction()`
  - `PluginDownloadManager.lockForProduction()`
- Once locked, calls to memory clearing or test directory overrides (`clearMemoryCache()`, `clearForTesting()`, `setBaseDirectoryForTesting()`, `setMockArchiveProviderForTesting()`) immediately throw `SecurityException`.
- This guarantees that revocation lists, version watermarks, package storage paths, and download providers remain completely immutable during production app execution.

### 6. Atomic Transnational Installation & Fail-Closed Rollback
Plugin installations follow strict ACID transaction semantics:
1. Packages are validated and extracted into a staging directory (`.staging_<uuid>`).
2. Manifest structure, WASM SHA-256 hash, and digital signatures are verified before any permanent state change.
3. If any step fails (extraction failure, I/O error, signature mismatch, storage persistence failure), Chattree initiates a clean, fail-closed rollback:
   - Staging directories and partial files are permanently purged.
   - Any temporary in-memory key or certificate registrations are reverted.
   - Zero orphaned files or residual untrusted state remain on disk or memory.

---

## Summary for plugin developers

> **Your plugin runs in a strict, auditable sandbox.**  
> Every access to user data or device hardware requires a capability listed in
> your `plugin.json` AND accepted by the user.  
> The user can revoke permissions at any time.  
> Chattree verifies your WASM binary's SHA-256 before execution.  
> Package authenticity is secured via Ed25519 digital signatures and anti-downgrade watermarks.  
> No background execution, no persistent processes, no raw system access.
