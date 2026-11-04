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

## 1. Loopback HTTP Server & Android Lifecycle

The local webhook listener is powered by `InboundHttpServer`.

### Key Characteristics:
- **Loopback by Default + Optional LAN Mode:** By default, the server binds strictly to `127.0.0.1` (`InternetAddress.loopbackIPv4`). Users can optionally enable **LAN / Wi-Fi connections (`0.0.0.0`)** in **Settings → Plugins → [Plugin] → Webhooks Entrantes** to receive authenticated webhooks from desktop machines, Home Assistant, or IoT devices on the same local network.
- **Configurable Port:** The default listening port is `8765`. Users can configure any custom port (0–65535) in **Settings → Inbound Webhooks**.
- **Foreground Operation:** To respect mobile battery life and avoid requiring a permanent, intrusive foreground service notification in Android, the server operates while Chattree is active.
- **Graceful Pause and Resume:**
  - When the app is backgrounded or minimized, Android suspends open socket listeners. Chattree cleans up the socket safely without dropping database records.
  - As soon as the user returns to Chattree, the listener **automatically restarts** on the configured port if enabled in Settings.
- **Port Conflict Recovery:** If the selected port is occupied by another local service, the server transitions to an informative error state (`InboundHttpServerState.error`), reports the conflict in Settings, and allows the user to specify an alternative port without crashing app startup.

---

## 2. Security Architecture

The inbound pipeline implements defense-in-depth:

### A. SSRF Protection (`WebhookSsrfGuard`)
Prevents server-side request forgery by ensuring all internal routing targets adhere to strict loopback constraints:
- Rejects non-loopback IP addresses and loopback bypass attempts (`0.0.0.0`, external IPv4/IPv6, multicast).
- Blocks sensitive internal system ports and unauthorized redirection.

### B. Endpoint Authentication (`bearer` & `hmacSha256Raw`)
Inbound webhook endpoints support two cryptographic authentication modes configured in `inboundWebhooks`:
- **Bearer Token (`bearer`):** Validates `Authorization: Bearer <token>` against the active (or rotating) endpoint secret stored in `WebhookSecretStore`.
- **HMAC-SHA256 Signature (`hmacSha256Raw`):** Validates `X-Chattree-Signature-256: sha256=<hex_digest>` computed over the raw UTF-8 request body using the endpoint secret.
- **Timing-Attack Resistance:** Both token and signature comparisons use constant-time byte comparison (`fixedTimeEquals`) to prevent side-channel timing attacks.

### C. Idempotency & Deduplication
Every request includes a unique delivery identifier:
- **Header:** `X-Chattree-Delivery-Id: <unique-id>`
- The `EventJournal` stores delivery receipts. If a duplicate delivery ID is received for an endpoint, Chattree recognizes the previous processing outcome and returns HTTP `200 OK` (or `202 Accepted`) immediately without re-executing downstream plugin logic.

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
- **Port Configuration:** Customize the listening port (default `8765`).
- **Endpoint URL Preview:** Displays the active listener URL (e.g., `http://127.0.0.1:8765`).
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
      "handlerExport": "handle_alert"
    }
  ]
}
```

### In WebAssembly Binary:
When an event arrives, Chattree invokes the plugin's exported `handle_alert` function passing the deserialized event payload. The plugin can then interact with the Chattree Host API (e.g., creating a note, scheduling a reminder, or updating conversational context).

---

## 6. 24/7 Cloud Webhooks (Cloudflare Worker Relay + Google FCM)

To receive webhooks 24/7 from external cloud platforms (such as GitHub, Stripe, GitLab, CI/CD pipelines, or remote IoT servers) without running battery-draining foreground services or violating Google Play background socket policies, Chattree introduces the **FCM + Cloudflare Worker Relay Architecture**:

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
1. **100% Free & Open Source:** Uses Cloudflare Workers free tier (up to 100,000 requests/day) and Google Firebase Cloud Messaging free Spark tier.
2. **Strict Google Play Compliance:** Does not keep persistent TCP sockets open in the background. Android wakes the app briefly via FCM data push only when an actual event arrives.
3. **Guaranteed Delivery:** If the app is closed, events are queued safely in the persistent pending inbox. Once Chattree opens, `drainPendingInbox()` processes every pending event through the full validation and WASM dispatch pipeline.

---

## 7. Automated Cloudflare Worker Deployment

Chattree features an automated in-app deployment workflow (`CloudflareDeployService`) allowing users to deploy their personal relay Worker in seconds:

1. **In-App Deployment Dialog (**Settings → Inbound Webhooks → Auto-desplegar en Cloudflare**):**
   - The user creates a Cloudflare API Token using the official `Edit Cloudflare Workers` template.
   - The user pastes their token into the single-field dialog and taps **Desplegar Worker ahora**.
2. **Automated Provisioning Sequence:**
   - **Account Verification:** Authenticates against `GET /client/v4/accounts` and resolves the account identifier.
   - **Subdomain Resolution:** Checks `GET /client/v4/accounts/{id}/workers/subdomain`.
   - **Script Upload:** Bundles `tools/cloudflare-relay-worker.js` as an ES Module multipart payload and uploads it to `PUT /client/v4/accounts/{id}/workers/scripts/chattree-webhook-relay`.
   - **Secret Binding:** Automatically configures Cloudflare secrets via `PUT /scripts/{name}/secrets`:
     - `FCM_TOKEN`: The device's unique FCM registration token.
     - `FIREBASE_SERVICE_ACCOUNT`: Secure relay credentials.
   - **Subdomain Routing:** Enables the public route via `POST /scripts/{name}/subdomain`.
3. **One-Tap Verification:** The resulting URL (`https://chattree-webhook-relay.<subdomain>.workers.dev`) is saved to app preferences, and the user can test the end-to-end pipeline with the **Probar conexión en la nube** button.

---

## 8. Testing Inbound Webhooks with PowerShell & cURL

### A. Local Testing (USB / Wi-Fi LAN)
```powershell
# Forward local port if Android is connected via USB:
adb forward tcp:8765 tcp:8765

$headers = @{
    "Content-Type"           = "application/json"
    "Authorization"          = "Bearer <TU_SECRET_COPIADO_DE_AJUSTES>"
    "X-Chattree-Delivery-Id" = [System.Guid]::NewGuid().ToString()
}
$body = @{
    event   = "webhook.alert"
    title   = "Prueba Local"
    message = "Enviando alerta local a Chattree"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:8765/plugins/com.developer.webhook.hub/alerts" -Method Post -Headers $headers -Body $body
```

### B. Remote Cloud Testing (24/7 Cloudflare Relay)
```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$url = "https://chattree-webhook-relay.<tu-subdominio>.workers.dev/plugins/com.developer.webhook.hub/alerts"

$headers = @{
    "Content-Type"           = "application/json"
    "Authorization"          = "Bearer <TU_SECRET_COPIADO_DE_AJUSTES>"
    "X-Chattree-Delivery-Id" = [System.Guid]::NewGuid().ToString()
}
$body = @{
    event   = "webhook.alert"
    title   = "Alerta Cloud 24/7"
    message = "Webhook recibido exitosamente a traves de Cloudflare y FCM!"
} | ConvertTo-Json

Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
```
