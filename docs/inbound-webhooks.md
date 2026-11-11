# Inbound Webhooks & Local Event Pipeline

Chattree features an integrated inbound webhook and local event processing pipeline. It enables third-party desktop tools, local automations, and WebAssembly plugins to securely deliver external triggers, notifications, and event streams directly into the Chattree event runtime.

---

## Architectural Overview

```text
External Source (e.g., Local CLI / Dev Tool / Service)
                   │
                   ▼  HTTP POST /plugins/<pluginId>/<path> (Headers: X-Chattree-Signature-256, X-Chattree-Delivery-Id)
┌─────────────────────────────────────────────────────────────┐
│                 InboundHttpServer (127.0.0.1)               │
│  - Loopback-only socket listener (default port: 8765)        │
│  - Active in foreground; auto-resumes on app return         │
│  - Concurrent request throttling & rate limiting            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     InboundHttpRouter                       │
│  - WebhookSsrfGuard: blocks non-loopback / unsafe targets   │
│  - InboundEndpointResolver: authenticates endpoint token    │
│  - WebhookSigner: validates HMAC-SHA256 signature           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       EventJournal                          │
│  - Persistent SQLite storage for events and receipts        │
│  - Idempotency deduplication by (endpointId, deliveryId)   │
│  - Delivery status tracking: pending, dispatched, failed    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              HostEventBus & EventDispatcher                 │
│  - EventSubscriptionRegistry: maps event types to consumers │
│  - Permission check: verifies network.webhook_inbound       │
│  - Dispatches to targetAction in WASM plugin runtime        │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Loopback HTTP Server & Android Lifecycle (P0 Hardened)

The local webhook listener is powered by `InboundHttpServer`.

### Key Characteristics:
- **Zero Foreground Service Permissions (Google Play Android 14/15 Compliant):** To strictly respect mobile battery life and adhere to modern Google Play Store policies, all `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_SPECIAL_USE` permissions have been completely removed from `AndroidManifest.xml`.
- **Operating System Lifecycle Hooks (`WidgetsBindingObserver`):** The server actively monitors Android application lifecycle states:
  - When the user minimizes the app, locks the screen, or the app transitions to `paused`, `inactive`, `detached`, or `hidden`, the server immediately tears down its TCP sockets (`stop(preserveLifecycleObserver: true)`), leaving 0 background sockets and 0 background processes (`startForegroundCount = 0`).
  - When the user brings Chattree back to the screen (`resumed`), the listener automatically re-binds to the configured port without requiring manual toggle or configuration.
- **Concurrent Request Throttling & Rate Limiting:** Enforces a strict ceiling of **32 concurrent in-flight requests** (`maxConcurrentRequests = 32`). If the ceiling is reached, incoming requests receive an immediate HTTP `503 Service Unavailable` with a `Retry-After: 1` header, protecting mobile memory from connection floods.
- **Loopback by Default + Optional LAN Mode (IPv4 & IPv6):** By default, the server binds strictly to `127.0.0.1` (`InternetAddress.loopbackIPv4`) and accepts IPv4/IPv6 loopback (`127.0.0.1`, `::1`, `[::1]`). Users can enable **Permitir dispositivos en red local (LAN)** directly in **Settings → Inbound Webhooks** (or in **Settings → Plugins → [Plugin] → Webhooks Entrantes**) to bind to `0.0.0.0` and accept authenticated requests from RFC 1918 LAN addresses (`10.x`, `172.16–31.x`, `192.168.x`) and IPv6 ULA (`fc00::/7`).
- **Configurable Port:** The default listening port is `8765`. Users can configure any custom port (0–65535) in **Settings → Inbound Webhooks**.
- **Immediate Dispatch on Local Ingestion:** Validated `2xx` requests ingested by `InboundHttpRouter` immediately trigger `EventRuntime.instance.processDueDeliveries()` so subscribed WASM handlers execute without polling latency.
- **Built-In Local Diagnostic Route (`/plugins/system/test`):** `InboundHttpRouter` natively supports authenticated diagnostic pings on `/plugins/system/test` (matching the cloud relay behavior) so users can verify local and LAN connectivity even before installing a third-party webhook plugin.
- **Port Conflict Recovery:** If the selected port is occupied by another local service, the server transitions to an informative error state (`InboundHttpServerState.error`), reports the conflict in Settings, and allows the user to specify an alternative port without crashing app startup.

---

## 2. Security Architecture

The inbound pipeline implements defense-in-depth:

### A. SSRF Protection & Resilient DNS Fallback (`WebhookSsrfGuard` — P2.5)
Prevents server-side request forgery by ensuring all internal routing targets adhere to strict loopback or explicitly authorized LAN constraints:
- **Comprehensive IANA Special Range Filtering:** In addition to RFC 1918, `WebhookSsrfGuard` blocks all IANA special-purpose IPv4 and IPv6 ranges:
  - IPv4: `0.0.0.0/8`, `10.0.0.0/8`, Carrier-Grade NAT (`100.64.0.0/10`), Loopback (`127.0.0.0/8`), Link-Local (`169.254.0.0/16`), `172.16.0.0/12`, IETF Protocol Assignments (`192.0.0.0/24`), TEST-NET-1/2/3 (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`), 6to4 Relay (`192.88.99.0/24`), Private (`192.168.0.0/16`), Benchmarking (`198.18.0.0/15`), Multicast (`224.0.0.0/4`), Reserved (`240.0.0.0/4`), Limited Broadcast (`255.255.255.255/32`).
  - IPv6: Loopback (`::1/128`), Unspecified (`::/128`), IPv4-mapped (`::ffff:0:0/96`), IPv4-IPv6 translation (`64:ff9b::/96`, `64:ff9b:1::/48`), Discard-only (`100::/64`), Teredo (`2001::/32`), BMWG (`2001:2::/48`), ORCHIDv2 (`2001:10::/28`, `2001:20::/28`), Documentation (`2001:db8::/32`), 6to4 (`2002::/16`), ULA (`fc00::/7` blocked unless LAN mode enabled), Link-Local (`fe80::/10`), Multicast (`ff00::/8`).
- **Iterative DNS Fallback (`connectWithDnsFallback`):** When a target resolves to multiple IP addresses, Chattree validates each individual IP against the SSRF guard before attempting connection. If a valid IP fails to connect, it falls back to the next valid IP, ensuring that DNS round-robin or multi-homed services work reliably without ever contacting an unauthorized private IP.

### B. Endpoint Authentication & Path Canonicalization (P1)
- **Bearer Token (`bearer`):** Validates `Authorization: Bearer <token>` against the active (or rotating) endpoint secret stored in `WebhookSecretStore`.
- **HMAC-SHA256 Signature (`hmacSha256Raw`):** Validates `X-Chattree-Signature-256: sha256=<hex_digest>` computed over the raw UTF-8 request body using the UTF-8 encoded endpoint secret.
- **Timing-Attack Resistance:** Both token and signature comparisons use constant-time SHA-256 digest comparison (`WebhookSigner.secureSignatureCompare`) to prevent side-channel timing attacks.
- **Strict Path Canonicalization (`sanitizeActivityPath`):** Prohibits path traversal attacks (`..`), percent-encoded path evasion (`%`), and query strings.

### C. Replay Protection & Idempotency
- **Cryptographic Replay Window:** Inbound relay messages enforce a maximum timestamp validity window of 72 hours and a 5-minute future skew tolerance. Messages outside this window are rejected with `stale_relay_message`.
- **Idempotency Deduplication:** Every request includes a unique delivery identifier (`X-Chattree-Delivery-Id: <unique-id>`). Receipts are stored in `EventJournal` to prevent duplicate execution of plugin handlers.

---

## 3. Storage & Delivery Guarantee (`EventJournal`)

All incoming webhook events are recorded in an embedded SQLite database before dispatch:

1. **Ingestion & Persistence:** When a valid HTTP request arrives, an `InboundEvent` is created and committed to the database.
2. **Delivery Receipt:** A receipt record links the event to the designated plugin endpoint with initial state `pending`.
3. **Dispatch & Retry:** The `EventDispatcher` pulls pending events and dispatches them to registered consumers. If a plugin handler fails, exponential backoff retries are tracked in the database.
4. **Crash Resilience:** If the application process is terminated while an event is in flight, the pending delivery is recovered and completed upon the next app launch.

---

## 4. User Settings & Per-Plugin Endpoint Controls

Users have full control over both the global listener and per-plugin webhook endpoints:

### Global Listener (**Settings → Inbound Webhooks**)
- **Enable / Disable Toggle:** Starts or stops the HTTP listener on demand. The preference is persisted across app restarts.
- **LAN / Wi-Fi Access Toggle (`Permitir dispositivos en red local (LAN)`):** Switches the listener between loopback-only (`127.0.0.1`) and local network binding (`0.0.0.0`) directly from the global server card.
- **Port Configuration:** Customize the listening port (default `8765`).
- **Dynamic Endpoint Route Preview:** Displays the active listener base URL (`http://127.0.0.1:8765` or `http://0.0.0.0:8765`) along with the active plugin webhook path (or `/plugins/system/test` diagnostic route).
- **Clear Status & Diagnostics:** Displays live status badges (`Activo`, `Detenido`, `Iniciando`, `Error`) with actionable error messages when conflicts occur.

### Per-Plugin Endpoint Management (**Settings → Plugins → [Plugin] → Webhooks Entrantes**)
For any plugin that declares `inboundWebhooks` or `network.webhook_inbound`, the plugin detail screen displays a dedicated **Webhooks Entrantes** section where users can:
- Toggle **Permitir conexiones desde red local (LAN / Wi-Fi)** to switch `InboundHttpServer` between loopback-only (`127.0.0.1`) and local network binding (`0.0.0.0`).
- View the complete local URL for each endpoint (`http://127.0.0.1:<port><path>`) and copy it to the clipboard.
- Inspect the authentication mode (`Bearer` or `HMAC-SHA256`) and copy the active secret token stored in `WebhookSecretStore`.
- Rotate the endpoint secret with a single tap (`beginRotation` + `finalizeRotation`), immediately generating a fresh 256-bit secret.

---

## 5. WebAssembly Plugin Integration

WASM plugins consume inbound webhooks by declaring `schemaVersion: 2` (or `1`), the `network.webhook_inbound` capability, and `inboundWebhooks` / `eventConsumers` in `plugin.json`.

### In Manifest (`plugin.json`):
```json
{
  "schemaVersion": 2,
  "id": "com.example.notifier",
  "version": "1.0.0",
  "name": "Local Notifier",
  "description": "Receives local webhook alerts.",
  "author": "Example Dev",
  "primaryCommand": "notifier",
  "type": "imported",
  "runtime": "wasm",
  "entrypoint": "run",
  "wasmPath": "plugin.wasm",
  "wasmSha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "runtimeApiVersion": "1.0.0",
  "capabilities": [
    "network.webhook_inbound",
    "chattree.notes.create"
  ],
  "tools": [
    {
      "id": "com.example.notifier.alert",
      "command": "notifier",
      "entrypoint": "run",
      "displayName": "Local Notifier",
      "description": "Processes incoming webhook and notification alerts.",
      "capabilities": ["network.webhook_inbound", "chattree.notes.create"]
    }
  ],
  "inboundWebhooks": [
    {
      "id": "alert_hook",
      "path": "/webhooks/com.example.notifier/alert_hook",
      "authType": "bearer",
      "eventType": "alert.critical"
    }
  ],
  "eventConsumers": [
    {
      "id": "alert_consumer",
      "eventTypes": ["alert.critical"],
      "targetAction": "com.example.notifier.alert",
      "filter": {
        "severity": ["high", "critical"]
      },
      "requiredPermissions": ["network.webhook_inbound", "chattree.notes.create"]
    }
  ]
}
```

### In WebAssembly Binary:
When an event arrives and matches the optional `filter`, Chattree invokes the tool specified in `targetAction` (`com.example.notifier.alert` -> exported `run` function), passing the serialized event envelope (`eventId`, `type`, `source`, `timestamp`, `data`). Event deliveries have a **45-second execution timeout** (`EventDispatcher.defaultHandlerTimeout`) so handlers can safely invoke `ai.complete` (`ai.context`), `chattree.notes.*`, `database.sql`, or `notifications.reply`.

---

## 6. 24/7 Cloud Webhooks (Cloudflare Worker Relay + KV Store-and-Forward + Google FCM — P2.2)

To receive webhooks 24/7 from external cloud platforms (such as GitHub, Stripe, GitLab, CI/CD pipelines, or remote IoT servers) without running battery-draining foreground services or violating Google Play background socket policies, Chattree introduces the **Cloudflare Worker KV Store-and-Forward + FCM Architecture (P2.2)**:

```text
External Cloud Emitter (GitHub / Stripe / IoT / CLI)
                        │
                        ▼ HTTPS POST https://<worker>.<subdomain>.workers.dev/plugins/<pluginId>/<path>
┌─────────────────────────────────────────────────────────────┐
│              Personal Cloudflare Worker (Free)              │
│  - Receives standard HTTP webhooks over the public web      │
│  - Reads encrypted secrets (FCM_TOKEN, SERVICE_ACCOUNT)    │
│  - Signs OAuth2 JWT and forwards via Google FCM HTTP v1     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ FCM Data Push Message
┌─────────────────────────────────────────────────────────────┐
│                Google Play Services (FCM Push)              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ High-Priority Wake Signal
┌─────────────────────────────────────────────────────────────┐
│                 Chattree on Android (Closed)                │
│  - Lightweight isolate: fcmBackgroundHandler (entry point) │
│  - Zero heavy AI / WASM engine overhead                     │
│  - Appends raw message to pending inbox (SQLite/Prefs)      │
│  - Fires native Android status bar notification             │
└──────────────────────────────┬──────────────────────────────┘
                               │ User taps notification / opens app
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 FcmInboundRelayService                      │
│  - drainPendingInbox() runs on app resume / launch          │
│  - Validates authentication token & idempotency key         │
│  - Ingests into InboundWebhookService & EventJournal        │
│  - Dispatches event to registered WASM plugin runtime       │
└─────────────────────────────────────────────────────────────┘
```

### Key Technical Properties:
1. **100% Free & Open Source:** Operates entirely within Cloudflare Workers free tier (up to 100,000 requests/day) and Google Firebase Cloud Messaging free Spark tier.
2. **Strict Google Play & Android 14/15 Compliance (P0):** Eliminates all foreground service requirements. Sockets are never kept open in background; Android wakes up briefly only upon receiving high-priority FCM data signals.
3. **Payload Capacity & KV Isolation (P2.2):** Supports full webhook payloads up to **256 KB** and headers up to **32 KB** (100 headers maximum), overcoming FCM's legacy 4 KB limit through Cloudflare KV store-and-forward.
4. **Hermetic Security & Zero Secret Leakage:** The FCM push notification carries solely cryptographic metadata references (`v: '2', id, ts, path, sig`). No payload bodies, authorization headers, or secrets ever travel across Firebase servers.
5. **Atomic Cleanup & Rollback:** If FCM dispatch fails, the Worker deletes the KV record immediately to prevent orphan accumulation and returns `502 Bad Gateway` or `503 Service Unavailable`. When Chattree receives and stores the payload, it sends an authenticated `DELETE` to purge the record from KV.
6. **Visual Notifications in All App States:**
   - **Background or Closed:** `fcmBackgroundHandler` displays native status bar notifications localized in Spanish, English, or French.
   - **Foreground / Active Use:** `FirebaseMessaging.onMessage` immediately triggers a heads-up visual notification (`FlutterLocalNotificationsPlugin.show` with `Importance.high` / `Priority.high`) and updates the Activity Log seamlessly.
7. **Priority Plugin Route Resolution:** Cloud relay routes resolve against installed plugins in `InboundEndpointResolver` first before falling back to built-in diagnostic handlers, ensuring custom and official webhook plugins (such as `com.developer.webhook.hub`) execute their WASM handlers end-to-end.
8. **Guaranteed Delivery with Serialized Drain & Bounded Retries:** If the app is closed, events are queued safely in the persistent pending inbox. Once Chattree opens, `drainPendingInbox()` processes pending events under an atomic concurrency lock (`_drainInFlight`) and caps unresolvable route retries (`404`) at 3 attempts to prevent infinite retry loops.

---

## 7. Automated Cloudflare Worker Deployment (P2.1 & P2.3)

Chattree features an automated in-app deployment workflow (`CloudflareDeployService`) allowing users to deploy and configure their personal relay Worker in seconds:

1. **Deployment Isolation & Safe Account Selection (P2.1):**
   - Multi-account Cloudflare API tokens present an explicit interactive account selection dialog to the user, eliminating blind selection of the first account (`result[0]`).
   - Workers and KV namespaces are provisioned with an isolated, installation-specific prefix `chattree-relay-<hash>` derived from `installationId`, preventing collisions or accidental deletion of other worker scripts in the user's account.
2. **API Token UI Security & Privacy (P2.3):**
   - The Cloudflare API Token input field is masked with `obscureText: true` by default (`••••••••`).
   - Includes an interactive eye toggle to reveal or hide the token on demand.
   - Stored securely in Android Keystore (`FlutterSecureStorage`) and strictly redacted from all system logs, error messages, and telemetry.
3. **One-Tap Provisioning Sequence:**
   - **Account Verification:** Authenticates against `GET /client/v4/accounts` using the user's Cloudflare API Token.
   - **KV Namespace Creation:** Creates or reuses `chattree-relay-<hash>-store`.
   - **Script Upload:** Bundles the modern Store-and-Forward Worker as an ES Module multipart payload and uploads it to `PUT /client/v4/accounts/{id}/workers/scripts/chattree-relay-<hash>`.
   - **Automated Secret Binding:** Configures Cloudflare Worker secrets automatically:
     - `RELAY_ID`: Unique cryptographic relay identifier.
     - `RELAY_SECRET`: 256-bit cryptographic shared secret for HMAC signing and fetch authorization.
     - `FIREBASE_SERVICE_ACCOUNT`: Firebase relay service account credentials integrated securely from device Keystore or compile-time configuration (never hardcoded in plain code).
   - **Subdomain Routing:** Enables public routing via `POST /scripts/{name}/subdomain`.
4. **Verified Public Relay URL:** The resulting URL follows the isolated format:
   ```text
   https://chattree-relay-<hash>.<subdomain>.workers.dev/r/<relayId>/plugins/<path>
   ```

---

## 8. Transactional Webhook Activity Store (`InboundActivityStore` — P2.4)

To guarantee complete auditability, thread-safety, and crash resilience, Chattree includes a transactional activity log (**Settings → Historial de actividad de webhooks**):

- **OS-Level Multi-Isolate Concurrency:** Replaced legacy SharedPreferences with `InboundActivityStore` (`inbound_activity_v2.json`) guarded by operating system-level file locking (`FileLock.blockingExclusive`) on `inbound_activity_v2.lock`. Eliminates all race conditions between the main UI isolate and background FCM isolates.
- **Atomic File Replacement:** Entries are written to a temporary file (`.tmp`) and atomically renamed over the target file, ensuring zero corruption during sudden app termination or power loss.
- **Cryptographic Event Identifiers:** Each entry is assigned an atomic cryptographic ID with microsecond timestamp precision and random entropy:
  ```text
  in_<microseconds>_<sequence>_<hash>_<path>
  # Example: in_1794195920500235_12_3eef08_pluginssystemtest
  ```
- **Strict User Privacy Protection (P1):** Request bodies, authorization tokens, passwords, and sensitive headers are strictly excluded from storage. The log retains exclusively status codes, execution durations, byte lengths, event types, and delivery IDs.
- **Diagnostic System Ping (`/plugins/system/test`):** A dedicated diagnostic route processed directly by the core runtime. Users can send test pings at any time to verify cloud delivery and trigger native notifications without requiring any third-party plugin to be installed.

---

## 9. Technical Audit, Security Hardening & Production Readiness

A comprehensive architectural and security audit of the local and cloud webhook pipelines establishes the following production standards and operational guidelines:

### A. Local vs. Cloud Comparison Matrix

| Dimension | Local Server (`InboundHttpServer`) | Cloud Relay (`Cloudflare Worker + FCM`) |
| :--- | :--- | :--- |
| **Availability** | Active in foreground only | 24/7 globally reachable |
| **Network Scope** | `127.0.0.1` (or local Wi-Fi LAN `0.0.0.0`) | Public internet via HTTPS |
| **Payload Ceiling** | **256 KB** (`maxInboundHttpPayloadBytes`) | **~3.5 KB** direct / **256 KB** with KV store-and-forward |
| **Background Processing** | Suspends when minimized (0 battery drain) | Wakes lightweight isolate, queues for app open |
| **Latency** | < 15 ms (direct socket) | 200 ms – 3 s (FCM delivery network) |
| **Authentication** | Bearer token / HMAC-SHA256 (constant-time) | Bearer / HMAC-SHA256 validated in device |
| **Concurrency Guard** | 32 concurrent requests (503 on saturation) | Serialized drain lock (`_drainInFlight`) |

### B. Security Directives & Secret Hardening (P0 Audit Directives)
1. **Zero Hardcoded Private Keys in Source Code:**
   - Service Account JSON keys (`FIREBASE_SERVICE_ACCOUNT`) must **never** be committed in plain source code or bundled as plain constants.
   - In production builds, service credentials must be supplied exclusively via:
     - Android Keystore AES-256 (`SecureCredentialStore.instance.save`).
     - Build-time defines: `--dart-define=FIREBASE_SERVICE_ACCOUNT_JSON=...`.
     - Direct secret entry via Cloudflare dashboard or Wrangler: `wrangler secret put FIREBASE_SERVICE_ACCOUNT`.
2. **Strict Authentication on Diagnostic Endpoints (`/plugins/system/test`):**
   - The diagnostic test route **must always enforce Bearer token authentication** (`PreferencesService.getDiagnosticWebhookSecret()`) across both local HTTP requests and cloud FCM relay messages.
   - Unauthenticated FCM payloads or spoofed messages targeting `/plugins/system/test` are rejected immediately, preventing notification spam and status bar flooding.
3. **Constant-Time Verification:**
   - All token and signature checks use `WebhookSigner.secureSignatureCompare` to eliminate side-channel timing attacks.

### C. Resilience & Concurrency Mitigations
1. **Cloudflare Worker OAuth2 Token Cache Invalidation:**
   - The Worker caches OAuth2 access tokens in global memory (`cachedToken`). If Google FCM returns `401 Unauthorized` (e.g., token revocation or clock skew), the Worker immediately invalidates `cachedToken = null` rather than serving stale tokens for up to 60 minutes.
2. **FCM Token Rotation Awareness:**
   - When Google Play Services rotates the device's FCM token (`onTokenRefresh`), the app flags the deployment as needing an update (`last_deployed_fcm_token` mismatch) and prompts the user to auto-sync the secret to Cloudflare.
3. **Atomic Inbox Concurrency:**
   - Background FCM delivery isolates avoid concurrent read-modify-write races on pending inbox storage by using atomic queuing and mutex serialization before draining events into `EventJournal`.

### D. Production Readiness Checklist

- [x] **SSRF Protection:** Loopback binding enforced; LAN mode restricted to RFC 1918 / IPv6 ULA; cloud metadata (`169.254.0.0/16`) blocked.
- [x] **Canonical Path Sanitization:** Rejects percent-encoding, relative traversals (`..`), query parameters, and fragmented URIs.
- [x] **Idempotency & Deduplication:** Atomic SQLite commit with `(endpointId, idempotencyKey)` before HTTP response.
- [x] **Google Play Battery Compliance:** Zero background foreground services; sockets pause cleanly when minimized.
- [x] **Activity Log Concurrency:** Multi-isolate OS-level file locking (`inbound_activity_v2.lock`) with atomic replacement.
- [ ] **Credentials Sanitization (Required before Store Release):** Eliminate bundled Service Account private keys from repository; enforce Keystore/compile-time define injection.
- [ ] **Diagnostic Route Hardening:** Enforce Bearer secret verification on FCM diagnostic paths.

---

## 10. Testing Inbound Webhooks with PowerShell & cURL

### A. Diagnostic Cloud Ping (Verifies Cloudflare + KV + FCM with App Open or Closed)
```powershell
$url = "https://chattree-relay-<hash>.<subdomain>.workers.dev/r/<relayId>/plugins/system/test"
$body = '{"event":"diagnostic_test","source":"powershell"}'
$headers = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer <DIAGNOSTIC_SECRET_COPIADO_DE_AJUSTES>"
}

Invoke-RestMethod -Uri $url -Method POST -Body $body -Headers $headers -ContentType "application/json"
```

### B. Local Testing (LAN Wi-Fi / USB Loopback)
```powershell
# Reemplaza <IP_TELEFONO> con la IP local que muestra la app (ej. 192.168.1.100)
$url = "http://<IP_TELEFONO>:8765/plugins/system/test"
$body = '{"event":"local_lan_test"}'
$headers = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer <DIAGNOSTIC_SECRET_COPIADO_DE_AJUSTES>"
}

Invoke-RestMethod -Uri $url -Method POST -Body $body -Headers $headers -ContentType "application/json"
```

### C. Remote Cloud Testing (Plugin Webhook)
```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$url = "https://chattree-relay-<hash>.<subdomain>.workers.dev/r/<relayId>/plugins/com.example.webhook/alerts"
$headers = @{
    "Content-Type"           = "application/json"
    "Authorization"          = "Bearer <TU_SECRET_DE_PLUGIN>"
    "X-Chattree-Delivery-Id" = "deliv_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
}
$body = @{
    event     = "alert.critical"
    title     = "Prueba Cloudflare 24/7"
    message   = "Webhook recibido exitosamente a traves de Cloudflare KV y FCM!"
    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
} | ConvertTo-Json

Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body
```
