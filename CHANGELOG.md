# Changelog

All notable changes to the Chattree official repository will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Phase 1 — Real-Time WebSockets (`WebSocketApiHandler`, capability `network.websocket`)**:
  - Full-duplex WebSocket connection manager allowing plugins to establish up to 10 concurrent sockets.
  - Memory message buffer supporting up to 500 queued frames per socket with polling and streaming support.
  - 16 MB frame ceiling (`16,777,216` bytes) with automatic RFC 6455 status code 1009 termination upon violation.
  - Pre-handshake atomic connection quota reservations preventing race conditions during concurrent asynchronous handshakes.
  - Built-in SSRF defense with `network.local` critical capability gating for LAN/localhost connections and permanent cloud metadata protection.
- **Phase 2 — Declarative Interactive UI Components (`DeclarativeUiBubble`, capability `ui.components` / `ui.render`)**:
  - Rich interactive UI rendering in chat for progress bars, status badges, structured key-value tables (up to 40 items), and action button rows (up to 8 buttons per row).
  - Global centralized card sanitization (`UiApiHandler.sanitizeUiCard`) enforcing schema constraints across both Host API `ui.render` calls and direct WASM `ToolResult.ui` returns (max 60 elements per card, max depth 3).
  - Interactive Action Security Confirmation: Mandatory user confirmation modal before executing sensitive action buttons or commands starting with `/` to prevent clickjacking or unauthorized commands by third-party plugins.
- **Phase 3 — Scheduled Tasks & Cron Automations (`PluginTaskScheduler`, capability `scheduler.task` / `scheduler.cron`)**:
  - Wall-clock Cron evaluation (`calculateNextCronExecution`) supporting standard 5-part cron syntax (`*/N * * * *`, `0 * * * *`, `0 0 * * *`, `M H * * *`) and periodic intervals.
  - Anti-battery drain guard enforcing a strict minimum execution interval of 60 seconds.
  - Central event publication on `HostEventBus` (`scheduler.trigger`) delivering task payloads up to 128 KB, with a ceiling of 25 active tasks per plugin.
  - Automatic task cleanup and cancellation upon plugin disable or uninstallation.
- **Phase 4 — Private Relational SQLite Database (`PluginDatabaseManager`, capability `database.sql` / `storage.database`)**:
  - Private isolated SQLite database file per plugin (`plugin_<pluginId>.db`) with complete sandbox separation.
  - Production-expanded 200 MB storage quota accurately measuring `.db`, `.db-wal`, `.db-shm`, and `.db-journal` files.
  - Atomic batch transactions (`database.transaction`) with automatic rollback on error.
  - Query memory guard returning up to 2,000 rows per query with column metadata.
  - Automatic type normalization for booleans (`1`/`0`) and structured maps/lists (JSON strings).
  - Sandbox escape protection prohibiting `ATTACH DATABASE`, `DETACH DATABASE`, `VACUUM INTO`, and unauthorized pragma operations.
  - Zero-orphan file cleanup purging all database files on plugin uninstallation.
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
