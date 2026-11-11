# Changelog

All notable changes to the Chattree official repository will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Webhook Subsystem Technical Audit & Production Readiness Specifications
- **Comprehensive Local vs. Cloud Inbound Audit**:
  - Formalized dual-entrypoint architecture specifications and operational boundaries across local loopback (`InboundHttpServer`, 256 KB) and cloud relay (`Cloudflare Worker + FCM`, ~3.5 KB).
  - Clarified payload capacity disparity: documented strict FCM `data` envelope limits (`MAX_DATA_BYTES = 3800` bytes) and HTTP 413 handling in Cloudflare Workers.
- **P0 Security Hardening & Credential Protection**:
  - Prohibited plaintext Firebase Service Account private key bundling in application sources. Documented secure provisioning via Android Keystore AES-256 (`SecureCredentialStore`) and compile-time defines (`--dart-define=FIREBASE_SERVICE_ACCOUNT_JSON=...`).
  - Hardened diagnostic ping handling (`/plugins/system/test`): mandated Bearer token verification across both local and FCM ingress paths to eliminate notification spoofing and status bar spam.
- **Resilience & Concurrency Hardening**:
  - Documented Cloudflare Worker OAuth2 access token cache invalidation (`cachedToken = null` upon FCM 401 response) to eliminate multi-minute delivery lockouts.
  - Documented FCM token refresh tracking (`onTokenRefresh`) and automated re-deployment alerts to resolve silent 502/UNREGISTERED dropouts.
  - Specified isolate-safe pending inbox serialization and bounded retries (`kFcmMaxInboxRetries = 3`) to prevent race conditions during webhook bursts while Chattree is closed.

### Inbound Webhooks, Cloudflare Relay, Concurrency & Security Hardening (P0, P1, P2 & Real Hardware Verification)
- **P0 — Elimination of Foreground Service & Clean Android Lifecycle Management**:
  - Permanently removed `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_SPECIAL_USE` permissions from `AndroidManifest.xml`, ensuring 100% compliance with Google Play Store policies for Android 14 (API 34) and Android 15.
  - Replaced the intrusive background service with a foreground-only HTTP server (`InboundHttpServer`) monitored via `WidgetsBindingObserver`.
  - When the application is minimized, paused, detached, or hidden (`paused`, `inactive`, `detached`, `hidden`), the LAN socket is immediately and cleanly suspended (`stop(preserveLifecycleObserver: true)`), leaving 0 zombie sockets or background processes (`startForegroundCount = 0`).
  - Upon returning to foreground (`resumed`), the listener automatically re-binds to the configured port without user intervention.
  - Enforced a hard concurrency ceiling of 32 in-flight requests, returning HTTP `503 Service Unavailable` with `Retry-After: 1` if saturated.
- **P1 — Cryptographic HMAC Signatures, Canonical Sanitization & Background Decoupling**:
  - Enforced constant-time HMAC-SHA256 signature verification (`secureSignatureCompare`) across all inbound payloads to eliminate side-channel timing attacks.
  - Strict path canonicalization (`sanitizeActivityPath`) blocking relative path traversal (`..`), percent-encoding exploits (`%`), and query strings.
  - Enforced strict replay attack prevention with a maximum timestamp window of 72 hours and a 5-minute future tolerance window.
  - Complete sanitization of activity logging: zero storage of request bodies, `Authorization` headers, credentials, or tokens in the activity log (preserving strict user data privacy).
  - Diagnostic ping deduplication and burst throttling (`kDiagnosticCooldownMs`) to protect against notification floods.
  - Architectural decoupling between the main UI isolate and background FCM isolates for resilient event capture.
- **P2.1 — Cloudflare Deployment Isolation**:
  - Eliminated arbitrary default account selection (`result[0]`) in `CloudflareDeployService`. Multi-account API tokens now present an explicit interactive account selection dialog to the user.
  - Implemented strict per-installation resource isolation: Workers and Cloudflare KV namespaces are deterministically prefixed with `chattree-relay-<hash>` derived from `installationId`, preventing collisions or accidental overwrites of existing user workers.
- **P2.2 — Cloudflare Worker & FCM Store-and-Forward Architecture**:
  - Upgraded the Cloudflare Worker to a 2-stage **Store-and-Forward** architecture with Cloudflare KV (`RELAY_STORE`):
    - Ingests payloads up to **256 KB** and headers up to **32 KB** (100 headers max) over public HTTPS.
    - Stores the payload in KV with a 72-hour TTL.
    - Dispatches a lightweight, signed notification envelope via Google Firebase Cloud Messaging (FCM HTTP v1) containing solely cryptographic references (`v: '2', id, ts, path, sig`). No webhook body or secrets ever travel through FCM push.
    - Android retrieves the payload securely via `handleFetch` (`GET /r/:relayId/fetch/:id`) using the shared `RELAY_SECRET` and acknowledges delivery via `handleAck` (`DELETE /r/:relayId/fetch/:id`), atomically deleting the record from KV.
    - If FCM dispatch or OAuth2 authentication fails, the Worker performs an immediate atomic deletion from KV and returns `502`/`503` without leaving orphaned data.
  - Automated test suite in Node.js (`tool/worker_relay_test.mjs`, 24 tests, 100% pass) and hermetic Dart E2E integration test suite (`test/cloudflare_fcm_e2e_integration_test.dart`, 9 tests, 100% pass).
- **P2.3 — Cloudflare Token UI Security**:
  - The Cloudflare API Token input field in deployment dialogs is now masked with `obscureText: true` by default (`••••••••`).
  - Added an interactive visibility toggle button (eye icon) to allow users to reveal or hide the token on demand.
  - Tokens are stored exclusively in Android Keystore (`FlutterSecureStorage`) and censored in logs, error dialogues, and diagnostics.
- **P2.4 — Activity Log Concurrency & Transactional Persistence**:
  - Migrated the webhook activity log from legacy SharedPreferences to a dedicated transactional store (`InboundActivityStore` / `inbound_activity_v2.json`).
  - Enforced operating system-level file locking (`FileLock.blockingExclusive`) on `inbound_activity_v2.lock` to eliminate race conditions between the main isolate and background FCM isolates.
  - Atomic persistence using temporary files (`.tmp`) and atomic file renaming to guarantee zero data loss.
  - Cryptographic ID generator with microsecond timestamps and random entropy (`in_<timestamp>_<seq>_<hash>_<path>`).
- **P2.5 — SSRF Defense & Resilient DNS Fallback**:
  - Comprehensive blocking in `WebhookSsrfGuard` of all IANA special-purpose IPv4 and IPv6 ranges (Carrier-Grade NAT `100.64.0.0/10`, Benchmarking `198.18.0.0/15`, IPv4-mapped `::ffff:0:0/96`, 6to4 `2002::/16`, Teredo `2001::/32`, ULA `fc00::/7`, Link-Local, etc.).
  - Implemented iterative DNS fallback (`connectWithDnsFallback`): iterates over all IP addresses returned by DNS resolution, validates each against the SSRF guard individually prior to opening any TCP socket, and falls back to subsequent valid IPs upon connection failures.
- **P2.6 — Release Hygiene & Automated Build Secret Scanner**:
  - Integrated custom Gradle tasks (`:app:scanSecretsBeforeReleasePackaging` and `:app:scanReleaseArtifacts`) into the release build pipeline (`assembleRelease` and `bundleRelease`).
  - Pre-packaging and post-packaging inspection detects prohibited keystore extensions (`.jks`, `.keystore`, `.p12`, `.pk8`, `key.properties`) and scans for Java KeyStore magic bytes (`0xFEEDFEED` / `0xCECECECE`) to guarantee no signing credentials leak into APK or AAB artifacts.
  - Hardened packaging exclusion rules (`packaging.resources.excludes`) in `android/app/build.gradle.kts`.
- **Foreground Visual Push Notifications & Real Hardware Verification**:
  - Enhanced `FirebaseMessaging.onMessage` to trigger immediate heads-up visual notifications using `FlutterLocalNotificationsPlugin.show` with high priority (`Importance.high` / `Priority.high`) when incoming Cloudflare/FCM webhooks arrive while the app is actively open in the foreground.
  - Native trilingual localization (Spanish, English, French) for notification titles and bodies.
  - Verified 100% on physical Android 14 hardware (Motorola Edge 30): validated token obscurity, LAN server lifecycle suspension on background, automatic re-attachment on resume, Cloudflare KV relay dispatch, and foreground/background push notifications.
  - Global test suite: 1,148 / 1,148 tests passed (100%), 0 analyze issues.
- **Elimination of Mock Keys & Deterministic Seeds from Production (SEC-4.3.7 P0)**:
  - Completely purged any deterministic private seeds and mock key pairs from the production tree (`lib/`).
  - `PluginTrustStore` maintains solely the public key byte constant (`officialKeyBytesV1`) for the official Ed25519 root of trust. The corresponding private signing key is held strictly offline in secure custody.
  - Test fixtures and cryptographic key pairs are isolated exclusively to `test/fixtures/` and cannot leak into production artifacts.
- **Cryptographic WASM Execution Authorization (`WasmExecutionAuthorization`)**:
  - WASM module execution requires a single-use authorization token minted only after full package and manifest validation.
  - Tokens are referentially bound to `PluginPackageManager.instance` (`identical(_packageManager, PluginPackageManager.instance)`). Tokens minted by isolated test instances or forged contexts are rejected with `SecurityException` by the production runtime.
- **Persistent Anti-Downgrade Version Watermark (`PluginStateStore`)**:
  - Enforced a persistent version watermark tracking the maximum historical SemVer installed per plugin.
  - Any attempt to import or install an older version than previously recorded is unconditionally rejected (`Degradación de versión rechazada`), permanently eliminating rollback attacks.
- **Atomic Transnational Installation & Fail-Closed Rollback**:
  - Package installation operates through staging sandboxes (`.staging_<uuid>`).
  - Enforced strict atomic rollback: if file renaming, manifest validation, or SharedPreferences persistence fails at any stage, all staged files and in-memory key registrations are reverted immediately (fail-closed, leaving zero leftover artifacts).
- **Inmutable Official Root Authority & Community Developer PKI (`PluginTrustStore`)**:
  - The official root key is strictly immutable in production. Dynamic re-registration or modification of the official root is blocked.
  - Added support for community developer certificates chained to `rootKeyId = "chattree-official-v1"`, validating cryptographic Ed25519 signatures, `developerId`, public key fingerprints, validity intervals (`validFrom` / `validUntil`), and `minAppVersion`.
- **Runtime Mutator Sealing (`lockForProduction()`)**:
  - Engaged permanent startup sealing in `main()` across `PluginStateStore.instance`, `PluginPackageManager.instance`, and `PluginDownloadManager`.
  - Testing mutators (`clearMemoryCache()`, `clearForTesting()`, `setBaseDirectoryForTesting()`, `setMockArchiveProviderForTesting()`) throw `SecurityException` when called on production singletons, preventing in-memory tampering with revocation lists, watermarks, or package roots.
- **Production Release Build & Cryptographic Signature Verification**:
  - Verified `flutter build apk --release` clean build (Exit code 0).
  - Verified Android APK signature schemes v1 (JAR), v2, and v3 using `apksigner` (Exit code 0).
  - Scanned compiled native ELF binaries (`libapp.so` across `arm64-v8a`, `armeabi-v7a`, `x86_64`): zero test mutator strings, service accounts, or private key leaks.
  - 100% test pass rate across all suites (1,518 tests passed, 0 failed, 0 skipped).

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
- **Universal Notification System Overhaul — Phase 6 (`NotificationCaptureService`, `NotificationBridge`, `DeviceNotificationService`, `EventDispatcher`, `HostEventBus`, `NotificationsApiHandler`)**:
  - **Push Channel & Event Scope Isolation (`allowedNotificationPackages`)**: Enforced strict application package whitelisting directly in the `EventDispatcher` push pipeline, `HostEventBus`, and Host APIs. Plugins only receive `device.notification.*` events and can only interact with active notifications originating from apps explicitly declared in their manifest's `allowedNotificationPackages` array. Omission of this field strictly defaults to deny-all.
  - **Cryptographically Secure Action Handles (`actionHandle`)**: Replaced sequential identifiers with unguessable 128-bit UUID v4 tokens (`act_<uuid4>`).
  - **Single-Use Replay Protection**: Each `actionHandle` is marked `isUsed = true` upon invocation and purged immediately, preventing replay attacks and race conditions.
  - **Triple-Binding Validation**: Each action handle is strictly linked to `(pluginId, notificationKey, packageName)` in both Dart and native Kotlin, preventing cross-plugin or cross-app action hijacking.
  - **Action Lifespan & Automatic Cleanup (TTL)**: Action handles expire automatically after 5 minutes or immediately upon notification dismissal/removal from the status bar.
  - **Universal Action Invocation (`notifications.invokeAction`)**: Added support for triggering native Android notification quick actions (e.g. "Mark as Read", "Archive", "Call Back", custom inline inputs) with Background Activity Launch (BAL) flags on Android 14+ (API 34+).
  - **True Zero-Persistence in Core**: Device notifications bypass the SQLite `EventJournal` completely during ingestion and dispatch. They are delivered as transient in-memory signals with 0 rows stored in `events` or `event_deliveries`, ensuring absolute privacy and data minimization. Plugins requiring historical retention manage their own private SQLite databases (`database.sql`).
  - **Concurrent Multi-Consumer Delivery**: Decoupled consumer deliveries so that multiple plugins subscribing to notification events process independently without race conditions or premature cascade deletions.
  - **Native OTP & Security Redaction**: Hardened native Android regex and category filtering dropping verification codes (`\b\d{4,8}\b`), 2FA tokens, and sensitive security alerts before entering Dart memory.
  - **IPC & Binder Protection**: Enforced 4,000-character payload ceiling on replies and inputs to protect against Android `TransactionTooLargeException`.
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
