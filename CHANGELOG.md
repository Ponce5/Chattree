# Changelog

All notable changes to the Chattree official repository will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Resilient Local Plugin Importer & In-Place Plugin Updates (`PluginImporter`, `PluginPackageManager`, `PluginRegistry`)**:
  - **In-Place Plugin Updates & Reinstalls (`allowUpdate: true`)**: Importing a `.chattree-plugin` or `.json` manifest for an already-installed plugin ID now updates or reinstalls the plugin directly in place without requiring manual uninstallation first. Preserves original `installedAt` metadata, user settings, private storage, and isolated SQLite databases, and displays a version diff badge (`v1.0.0 → v2.0.0`) with localized **Actualizar plugin** / **Reinstalar plugin** confirmation dialogs.
  - **OS/Browser Copy-Suffix Normalization**: Automatically normalizes duplicate filename suffixes added by operating systems and browsers (e.g., `plugin (1).chattree-plugin`, `my-plugin (2).zip`, `plugin.chattree-plugin (1)`, `plugin - copia.json`, `plugin (1).wasm`).
  - **Single-Folder ZIP Flattening & OS Metadata Filtering**: Transparently flattens archives re-compressed with a single parent directory (`my-plugin/plugin.json`) during local import and ignores OS metadata artifacts (`__MACOSX/`, `.DS_Store`, `Thumbs.db`, `desktop.ini`).
  - **Magic-Byte Package Inspection**: Inspects ZIP magic bytes (`PK\x03\x04`) and JSON headers (`{`) so packages renamed by mobile download managers or content URIs are validated accurately.
- **Inbound Webhooks Subsystem Hardening (Local HTTP & 24/7 Cloud Relay)**:
  - **Priority Route Resolution for Installed Plugins (`FcmInboundRelayService`)**: Cloud relay routes now resolve against installed plugins in `InboundEndpointResolver` first before falling back to built-in diagnostic handlers, ensuring custom and official webhook plugins (such as `com.developer.webhook.hub`) execute their WASM handlers end-to-end.
  - **Serialized Inbox Drain & Bounded Retries (`kFcmMaxInboxRetries = 3`)**: Added an in-flight mutex (`_drainInFlight`) to `drainPendingInbox()` to prevent duplicate concurrent processing on app resume, and capped retries for unresolvable routes (`404`) at 3 attempts to prevent infinite retry loops.
  - **Cloudflare Worker Payload Byte Guard (`MAX_DATA_BYTES = 3800`) & Stack-Safe Base64URL**: Enforced total UTF-8 byte validation across `path` + `body` + `headers` in `cloudflare-relay-worker.js` before calling FCM HTTP v1 (returning a deterministic `413 payload_too_large` instead of `502 fcm_rejected`) and replaced spread-based `b64url` encoding with a loop-safe implementation.
  - **Local `/plugins/system/test` Diagnostic Route & IPv6 Support (`InboundHttpRouter`)**: Added authenticated local diagnostic ping support on `/plugins/system/test`, IPv6 loopback (`::1` / `[::1]`) and IPv6 ULA (`fc00::/7`) validation in `WebhookSsrfGuard`, and immediate `EventRuntime.instance.processDueDeliveries()` dispatch upon 2xx local ingestion.
  - **Global LAN Toggle & Real Worker Reachability Probe (`InboundWebhookListenerSettings`)**: Added the LAN/Wi-Fi switch (`Permitir dispositivos en red local (LAN)`) directly inside **Settings → Inbound Webhooks**, dynamic active plugin endpoint paths in test dialogs, FCM token rotation tracking (`last_deployed_fcm_token`), and real `/plugins/system/test` reachability verification.
- **Phase 1 — Real-Time WebSockets (`WebSocketApiHandler`, capability `network.websocket`)**:
  - Full-duplex WebSocket connection manager allowing plugins to establish up to 10 concurrent sockets isolated per plugin.
  - Memory message buffer supporting up to 500 queued frames per socket with polling and streaming support.
  - 16 MB frame ceiling (`16,777,216` bytes) with automatic RFC 6455 status code 1009 termination upon violation.
  - Pre-handshake atomic connection quota reservations preventing race conditions during concurrent asynchronous handshakes.
  - Built-in SSRF defense (`WebhookSsrfGuard.validateTarget`) with `network.local` critical capability gating for LAN/localhost connections and permanent cloud metadata protection.
- **Phase 2 — Declarative Interactive UI Components (`DeclarativeUiBubble`, capability `ui.components` / `ui.render`)**:
  - Rich interactive UI rendering in chat for progress bars, status badges, structured key-value tables (up to 40 items), and action button rows (up to 8 buttons per row).
  - Global centralized card sanitization (`UiApiHandler.sanitizeUiCard`) enforcing schema constraints across both Host API `ui.render` calls and direct WASM `ToolResult.ui` returns (max 60 elements per card, max depth 3).
  - Interactive Action Security Confirmation: Mandatory user confirmation modal before executing sensitive action buttons or commands starting with `/` (`command`, `prompt`, `message`, `send`, `url`, `copy`) to prevent clickjacking or unauthorized commands by third-party plugins.
- **Phase 3 — Scheduled Tasks & Cron Automations (`PluginTaskScheduler`, capability `scheduler.task` / `scheduler.cron`)**:
  - Wall-clock Cron evaluation (`calculateNextCronExecution`) supporting standard 5-part cron syntax (`*/N * * * *`, `0 * * * *`, `0 0 * * *`, `M H * * *`, Vixie Cron DOM/DOW OR semantics) and periodic intervals, with dynamic timer re-arming when earlier tasks are scheduled.
  - Anti-battery drain guard enforcing a strict minimum execution interval of 60 seconds.
  - Central event publication on `HostEventBus` (`scheduler.trigger`) with automatic event consumer registration for plugins declaring `scheduler.task` or `scheduler.cron`, delivering payloads up to 128 KB and up to 25 active tasks per plugin.
  - Automatic task cleanup and cancellation upon plugin disable or uninstallation.
- **Phase 4 — Private Relational SQLite Database (`PluginDatabaseManager`, capability `database.sql` / `storage.database`)**:
  - Private isolated SQLite database file per plugin (`plugin_<pluginId>.db`) with complete sandbox separation and path sanitization.
  - Production-expanded 200 MB storage quota accurately measuring `.db`, `.db-wal`, `.db-shm`, and `.db-journal` files, plus `PRAGMA busy_timeout = 5000` concurrency protection.
  - Accurate query dispatch distinguishing `SELECT`, `WITH ... SELECT`, and allowed `PRAGMA` statements (`rawQuery`) from `INSERT`, `UPDATE`, and `DELETE` mutations (`rawInsert`/`rawUpdate`/`rawDelete`).
  - Atomic batch transactions (`database.transaction`) with automatic rollback on error.
  - Query memory guard returning up to 2,000 rows per query with column metadata.
  - Automatic type normalization for booleans (`1`/`0`) and structured maps/lists (JSON strings).
  - Sandbox escape protection prohibiting `ATTACH DATABASE`, `DETACH DATABASE`, `VACUUM INTO`, and unauthorized pragma operations.
  - Zero-orphan file cleanup purging all database files on plugin uninstallation.
- **Notification Hub Subsystem (`NotificationCaptureService`, `DeviceNotificationService`, capabilities `notifications.read`, `notifications.query`, `notifications.reply`, `notifications.action`)**:
  - Native Android `NotificationListenerService` capturing active status bar notifications and streaming `device.notification.received` and `device.notification.removed` events to Flutter through `EventChannel` (`chattree/notification_events`) and `HostEventBus`.
  - Collision-free `logicalId` construction (`${packageName}_${sbn.id}_${sbn.tag}`) and automatic cleanup of debounce state on notification dismissal (`onNotificationRemoved`).
  - Zero-persistence in Chattree Core: external notification bodies and metadata are never persisted to core database tables, ensuring data minimization. Plugins requiring historical retention must manage their own storage using their isolated SQLite database (`database.sql`).
  - Strict native OTP and security redaction: automatic OS-level filtering of one-time passwords, verification codes, and 2FA credentials before events ever cross into Flutter or `HostEventBus`.
  - Ephemeral Android `LruCache` session manager (500 capacity) for native `PendingIntent` and `RemoteInput` references, avoiding storage on disk and preventing memory leaks.
  - Granular RBAC capabilities: `notifications.read` for event bus subscriptions (and active queries), `notifications.query` for active alerts inspection (`getStatus`, `getActive`), `notifications.reply` for direct replies via `RemoteInput`, and `notifications.action` for programmatic dismissals (`notifications.dismiss`).
  - IPC and Binder protection: enforced 4,000-character payload ceiling on `notifications.reply` preventing Android `TransactionTooLargeException`.
  - Debounced event dispatching (200ms per thread) preventing UI thread starvation during group chat message bursts.
- **24/7 Cloud Background Webhooks (`FcmInboundRelayService`)**: Added cloud webhook delivery pipeline combining a personal, free Cloudflare Worker relay and Google Firebase Cloud Messaging (FCM HTTP v1). When the app is closed or locked, FCM data messages wake a dedicated lightweight background isolate (`fcmBackgroundHandler`) without battery drain or keeping open TCP sockets, queuing raw payloads in `kFcmPendingInboxKey` and triggering native notifications. On app launch/resume, `drainPendingInbox` completes full validation and event dispatch.
- **Automated Cloudflare Worker Deployment (`CloudflareDeployService`)**: Integrated in-app deployment from **Settings → Inbound Webhooks**. Users enter their Cloudflare API Token, and Chattree automatically connects to Cloudflare API v4, uploads the Worker script, registers encrypted secrets (`FCM_TOKEN` and Firebase credentials), and binds public subdomain routes in seconds.
- **Tolerant Webhook Idempotency Fallback**: If an external webhook payload does not supply `X-Chattree-Delivery-Id`, `FcmInboundRelayService` automatically generates a deterministic fallback delivery key (`fcm-{timestamp}-{hashCode}`) to prevent event loss while guaranteeing deduplication.
- **Multi-language Cloud Webhook UI**: Added localized UI strings and dialogs in Spanish, English, and French across Light and Dark themes, with real-time test connectivity button.
- **Inbound Webhooks Management UI (`PluginDetailScreen`)**: Added the *Webhooks Entrantes* panel in **Settings → Plugins → [Plugin]** for plugins declaring `inboundWebhooks` or `network.webhook_inbound`. Users can inspect active local endpoint URLs (`http://127.0.0.1:<port><path>`), copy the URL, copy the active Bearer/HMAC secret from `WebhookSecretStore`, and rotate secrets with one tap (`beginRotation` + `finalizeRotation`).
- **Automatic Conversational Vector RAG**: Connected `RAGService.instance.buildContextForQuery` directly to `ChatController.sendMessage` so conversational turns automatically retrieve and inject relevant semantic context from Notes whenever RAG is enabled and initialized.
- **In-Memory Vector Search Cache (`SqliteVectorStore`)**: Added a decoded float vector cache (`_memoryCache`) for zero-I/O cosine similarity search across notes, with deterministic invalidation on insert, update, delete, and clear operations.
- **Bounded WASM Module LRU Cache (`PluginRuntime`)**: Added an in-memory compiled module cache (`maxCachedModules = 8`) while instantiating a fresh, isolated linear memory per execution.
- **Persistent Inbound Activity Log (`InboundActivityLog`)**: Hardened webhook history storage against app restarts and closed-state transitions. Ensured `_loaded` disk guard prevents premature overwrites, implemented atomic deduplication by unique delivery/receipt IDs, and unified background FCM isolates with foreground event rendering.
- **Android 15+ 16 KB Page Size Alignment**: Configured automated ELF patching hooks across all native `.so` libraries (`p_align >= 0x4000`) and declared `android:extractNativeLibs="false"` in `AndroidManifest.xml` for full Google Play Console compliance.
- **Production Readiness Audit Test Suite**: Added unit and regression tests (`test/audit_production_readiness_test.dart`) covering `EmailApiHandler` capability checks, `PluginStateStore` secret encryption, `PluginStorageStore` per-plugin quotas, and `SqliteVectorStore` cache invalidation.

### Changed
- **Hardened `EmailApiHandler` Security**:
  - Enforced `email.read` (for `inbox`, `list`, `events`, `read`), `email.send` (for `send`, `create`), and either capability (for `config`, `setup`, `disconnect`, `logout`) via `PermissionGateway.instance.hasCapability`.
  - Encrypted email app passwords at rest in `FlutterSecureStorage` (`EncryptedSharedPreferences` / Keychain) with automatic migration and cleanup of legacy plaintext keys from `PluginStorageStore`.
- **Zero-Trust Permission Default & Reserved Internal IDs**:
  - Removed automatic permission pre-approval for external `com.chattree.official.*` plugin IDs; only built-in `PluginType.internal` tools receive pre-approved internal capabilities.
  - Expanded reserved internal IDs in `PluginPackageManager.validatePackage` (`com.chattree.note`, `com.chattree.reminder`, `com.chattree.visual`, `com.chattree.weather`, `com.chattree.translate`, `com.chattree.calendar`, `com.chattree.internal`) to prevent third-party spoofing.
- **Encrypted Secret Plugin Settings (`PluginStateStore`)**: Settings declared with `isSecret: true` (or matching secret/token/password/api_key identifiers) are now encrypted in `FlutterSecureStorage`, storing only a `__SECURE_STORED__` sentinel in `SharedPreferences`.
- **Per-Plugin Storage Quotas (`PluginStorageStore`)**: Enforced strict quotas per plugin (`maxKeysPerPlugin = 500`, `maxValueLength = 262,144` bytes / 256 KB, and `maxTotalBytesPerPlugin = 2,097,152` bytes / 2 MB) to prevent storage exhaustion.
- **Strict Disabled-Plugin Dispatch Guard**: Blocked `ChatController` fallback to `ToolRegistry.instance.dispatch` when the owning plugin is disabled in `PluginRegistry`.
- **Clean WASM Payload Forwarding**: Scoped legacy calendar field normalization in `WasmMarketplaceTool.handle` strictly to calendar commands so general-purpose WASM plugins receive unmodified `operation` and `payload` structures.
- **Persistent HTTP Client Reuse for Cloud Providers**: `OpenAiProvider`, `GeminiProvider`, and `ClaudeProvider` now reuse persistent `HttpClient` instances (60s idle timeout, 15s connection timeout) to avoid repeated TCP/TLS handshakes, with clean re-creation on `cancelGeneration()`.
- **Startup & UI Streaming Optimization**:
  - Parallelized essential startup stores with `Future.wait` in `main.dart` and deferred heavy background services (`EmbeddingService`, `RAGService`, `ReminderExecutor`, `EventRuntime`, `InboundHttpServer`) until after the first frame (`addPostFrameCallback`).
  - Scoped token-streaming rebuilds in `ChatScreen` using `ListenableBuilder` around the message list and input bar so the outer `Scaffold`, `ChatDrawer`, and `AppBar` do not rebuild on every token tick.
  - Sequenced `EmbeddingService.embedNote` and `RAGService.onNoteChanged` in `NotesService` to eliminate concurrent ONNX isolate contention.
- **Localized `ChatController` Messages**: System status and error messages in `ChatController` (`switchModel`, `stopGeneration`, `handleUnknownCommand`) dynamically adapt to the user's selected language (`es` / `en`).
- **Android Production Packaging**: Configured `applicationId = "com.chattree.app"`, `android:fullBackupContent="false"`, and release signing via `key.properties` with safe debug fallback.
- **App core (VisualDesignTool):** `refine` / `new` English keyword aliases added alongside existing Spanish aliases so both languages are accepted as `/visual` subcommands.
- Synchronized SDK documentation, schemas, and website reference docs with the production runtime implementation.

---

## [1.0.0] - 2026-10-18

### Added
- **Plugin SDK & Host API Documentation:** Complete technical specifications for the WebAssembly plugin runtime, linear memory protocol, `chattree.host_call`, and async resume mechanics.
- **Capabilities & Permissions Catalogue:** Authoritative taxonomy defining risk tiers (`normal`, `sensitive`, `critical`) and access requirements across private storage, HTTP, location, camera, notes, and reminders.
- **Formal JSON Schema (`schemas/plugin.manifest.v1.schema.json`):** Draft-07 schema for strict validation of `plugin.json` manifests, including SemVer, command syntax, capability identifiers, and resource thresholds.
- **Developer Tools (`tools/`):**
  - `validate-plugin.mjs` / `.js`: Multi-platform command-line tool validating manifests, WASM headers, SHA-256 integrity, and ZIP root layout.
  - `package-plugin.mjs` / `.js`: Zero-dependency packager automatically calculating `wasmSha256` and assembling `.chattree-plugin` archives.
- **Turnkey Starter Template (`templates/plugin/`):** Complete starter kit with preconfigured `plugin.json`, WAT source (`src/plugin.wat`), Rust source (`src/lib.rs`, `Cargo.toml`), and a 512x512 icon.
- **Runnable Developer Examples (`examples/`):**
  - `examples/hello/`: Zero-capability greeting plugin in WAT.
  - `examples/notes-demo/`: Asynchronous integration with Chattree Notes Host API.
- **Official Plugins (`plugins/official/`):** First-party `echo/` plugin demonstrating minimal, isolated text transformation.
- **Marketplace Publishing Guide:** Detailed instructions and REST API specifications (`POST /api/plugins/submit`) for registering plugins via GitHub Releases.
- **Architecture Guides:** Comprehensive documentation for local Vector RAG, hybrid AI providers (OpenAI, Gemini, Anthropic), and Android keystore security.

### Changed
- Unified documentation source across Web and GitHub repositories, establishing `chattree-repo/docs/` as the single source of truth.
- Synchronized Web docs build pipeline with hybrid multi-language support (ES, FR, EN) and localized navigation.
- Fixed relative markdown links and removed deprecated private build script references.

---

## [0.1.0] - 2026-10-14

### Added
- Initial repository layout and organization structure.
- Community guidelines (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`).
- Repository baseline configuration (`.editorconfig`, `.gitattributes`, `.gitignore`, `.github/`).
