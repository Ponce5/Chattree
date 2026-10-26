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
- **Loopback-Only Binding:** The server binds strictly to `127.0.0.1` (`InternetAddress.loopbackIPv4`). It is never reachable from the Internet or other machines on the local Wi-Fi/LAN, preventing external network probing.
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

### B. Cryptographic Signatures (`WebhookSigner`)
Inbound webhook payloads must be signed using HMAC-SHA256:
- **Header:** `X-Chattree-Signature-256: sha256=<hex_digest>`
- **Verification:** Computed over the raw UTF-8 body using the endpoint's provisioning secret.
- **Timing-Attack Resistance:** Signature comparison uses constant-time byte comparison (`crypto_utils` / `fixedTimeEquals`) to prevent side-channel timing attacks.

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

## 4. User Settings & Controls

Users have full control over the inbound webhook listener from **Settings**:

- **Enable / Disable Toggle:** Starts or stops the HTTP listener on demand. The preference is persisted across app restarts.
- **Port Configuration:** Customize the listening port (default `8765`).
- **Endpoint URL Preview:** Displays the active listener URL (e.g., `http://127.0.0.1:8765`).
- **Clear Status & Diagnostics:** Displays live status badges (`Activo`, `Detenido`, `Iniciando`, `Error`) with actionable error messages when conflicts occur.

---

## 5. WebAssembly Plugin Integration

WASM plugins consume inbound webhooks by declaring the `network.webhook_inbound` capability and registering event subscriptions.

### In Manifest (`plugin.json`):
```json
{
  "id": "com.example.notifier",
  "name": "Local Notifier",
  "capabilities": [
    "network.webhook_inbound",
    "chattree.notes.create"
  ],
  "eventSubscriptions": [
    {
      "eventType": "alert.critical",
      "targetAction": "handle_alert"
    }
  ]
}
```

### In WebAssembly Binary:
When an event arrives, Chattree invokes the plugin's exported `handle_alert` function passing the deserialized event payload. The plugin can then interact with the Chattree Host API (e.g., creating a note, scheduling a reminder, or updating conversational context).
