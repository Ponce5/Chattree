# Capabilities Reference

A **capability** is a declared privilege that a plugin requests in `plugin.json`.
Chattree enforces capabilities at the Host API layer — if a plugin tries to use an
API without the required capability, the call is rejected with a `permissionDenied` response.

---

## Danger levels

| Level | Icon | Meaning |
|-------|------|---------|
| `normal` | 🟢 | Low-risk. Granted automatically or with minimal friction. |
| `sensitive` | 🟡 | Accesses data or outbound communication. Requires user consent. |
| `critical` | 🔴 | Hardware sensors or highly personal data. Requires explicit user authorization. |

---

## Capability catalogue

### 🟢 storage.private

**Category:** Data  
**Status:** ✅ Available  
**Permission required:** None (granted automatically — core sandbox capability)  
**Host API namespace:** `storage`

Grants access to the plugin's **isolated key-value store**. Each plugin has its own
private keyspace. No other plugin or user can read it.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `storage.set` | `{ key: string, value: string }` | `{ stored: true, key, value }` |
| `storage.get` | `{ key: string }` | `{ value: string\|null, exists: boolean }` |
| `storage.delete` | `{ key: string }` | `{ deleted: boolean }` |
| `storage.has` | `{ key: string }` | `{ exists: boolean }` |
| `storage.keys` | `{}` | `{ keys: string[], count: number }` |

**Limitations:**
- Values are stored as strings.
- Maximum key length: **256 characters**.
- Maximum value size per key: **256 KB (`262,144` bytes)**.
- Maximum keys per plugin: **500 keys**.
- Maximum total storage quota per plugin: **2 MB (`2,097,152` bytes)**.
- Data persists across plugin reinstalls (tied to plugin ID).

**Example:**
```json
{ "api": "storage", "operation": "set", "payload": { "key": "counter", "value": "42" } }
```

---

### 🟡 network.http

**Category:** Network  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `network`

Allows the plugin to make outbound **HTTP/HTTPS** requests.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `network.http_request` | `{ url, method?, headers?, body?, bodyEncoding?, responseType?, timeoutMs? }` | `{ statusCode, headers, body, encoding, isBase64 }` |

**Input fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | ✅ | Full HTTPS/HTTP URL |
| `method` | string | ❌ | `GET` (default), `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS` |
| `headers` | object | ❌ | Custom headers (hop-by-hop headers are stripped) |
| `body` | string | ❌ | Request body (max 4 MB) |
| `bodyEncoding` | string | ❌ | `"utf8"` (default) or `"base64"` for sending binary data |
| `responseType` | string | ❌ | `"utf8"` or `"base64"`. If omitted, binary MIME types (audio, image, video, pdf, zip) are auto-encoded to `"base64"` |
| `timeoutMs` | integer | ❌ | Timeout in ms (default 30000, 1000 to 60000) |

**Limitations:**
- Only `http` and `https` schemes allowed.
- Loopback and private LAN addresses are blocked by default (SSRF protection) unless the plugin also holds the critical `network.local` capability.
- Max request body: 4 MB. Max response body: 8 MB.
- Default timeout: 30 seconds (configurable up to 60s per call via `timeoutMs`).
- Max concurrent requests per plugin: **20**.
- Allowed methods: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS.

**Possible errors:**
- `Permiso denegado` — capability not granted
- `Protocolo no permitido` — non-HTTP scheme
- `Acceso bloqueado` — private/local IP blocked
- `Método HTTP no permitido` — unsupported method
- `La respuesta HTTP excedió el tamaño máximo` — response > 8 MB
- `Tiempo de espera agotado` — timeout

---

### 🔴 network.local

**Category:** Network  
**Status:** ✅ Available  
**Permission required:** Critical user consent  
**Host API namespace:** `network` (used together with `network.http`)

Allows outbound HTTP/HTTPS requests through `network.http_request` to private LAN IPv4 addresses (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), IPv6 Unique Local Addresses (`fc00::/7`), loopback (`localhost` / `127.0.0.1` / `::1`), and local mDNS/LAN domains (`.local`, `.lan`, `.home`). Ideal for integrating local services such as Ollama, LM Studio, Home Assistant, or NAS devices.

**Security boundaries:** Even when `network.local` is granted, cloud metadata endpoints (`169.254.0.0/16`, `fe80::/10`), multicast addresses, and `0.0.0.0` remain strictly blocked.

---

### 🟡 notifications.send

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `notifications`

Allows sending and cancelling **local device notifications**.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `notifications.send` | `{ title, body? }` | `{ notificationId, sent, remainingQuota }` |
| `notifications.cancel` | `{ notificationId }` | `{ notificationId, cancelled }` |

**Limitations:**
- Max title: 100 characters.
- Max body: 500 characters.
- Rate limit: **15 notifications per plugin per hour** (sliding 60-minute window).
- A plugin can only cancel its own notifications.
- Supported on Android, iOS, and macOS.

---

### 🔴 notifications.read

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** Explicit user authorization + Android Notification Listener Access + Package Whitelist (`allowedNotificationPackages`)  
**Host API namespace:** `notifications`, `events`

Allows plugins to receive real-time streaming events when notifications are posted or updated by other applications on the device (e.g., messaging apps, email, calendar).

> [!IMPORTANT]
> **Package Scope Isolation:** Access is strictly bounded by `allowedNotificationPackages` in the plugin manifest. A plugin configured with `["com.whatsapp"]` will only receive notifications originating from WhatsApp. Omission of this field results in a strict deny-all.

**Events Emitted on `HostEventBus`:**

| Event Type | Description | Payload Schema |
|------------|-------------|----------------|
| `device.notification.received` | Fired when a notification arrives or updates | `{ id, logicalId, packageName, title, text, category, postTime, isClearable, hasReplyAction, isUpdate, actions }` |
| `device.notification.removed` | Fired when a notification is dismissed | `{ id, logicalId, packageName, postTime }` |

**Event Payload Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique notification identifier from Android (`StatusBarNotification.id` + tag) |
| `logicalId` | string | Deterministic key for deduplication: `${packageName}_${id}_${tag}` |
| `packageName` | string | Originating app package ID (e.g. `com.whatsapp`, `org.telegram.messenger`) |
| `title` | string | Notification title or sender name |
| `text` | string | Message body or summary text |
| `category` | string? | Android category (`msg`, `email`, `social`, `alarm`, `promo`, etc.) |
| `postTime` | integer | Timestamp when notification was posted (ms since Unix epoch) |
| `isClearable` | boolean | True if the notification can be swiped away or dismissed |
| `hasReplyAction` | boolean | True if an inline `RemoteInput` direct reply is available |
| `isUpdate` | boolean | True if this event updates an already active notification session |
| `actions` | array | Available quick actions: `[{ title: string, hasRemoteInput: boolean, isQuickReply: boolean, actionHandle: string }]` |

**Security & Privacy Safeguards:**
- **Native OTP / 2FA Exclusion:** Any notification containing one-time passwords, verification codes (regex `\b\d{4,8}\b` with security keywords like *code*, *OTP*, *2FA*, *verificación*), or marked with security flags is immediately dropped in the Android native service. It never enters Dart memory, EventBus, or plugin sandboxes.
- **True Zero-Persistence Core:** Chattree Core does NOT persist notification text or metadata to disk or SQLite `EventJournal`. Notifications are delivered as transient in-memory signals. Plugins requiring historical retention must manage their own storage using their isolated SQLite database (`database.sql`).
- **Debounced Stream:** Burst updates (e.g. rapid group chat messages) are throttled with a 200ms debounce per notification session to protect CPU and memory.

---

### 🟡 notifications.query

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** User consent + Package Whitelist (`allowedNotificationPackages`)  
**Host API namespace:** `notifications`

Allows plugins to inspect the status of the native notification listener service and retrieve currently active status bar notifications filtered by the plugin's package authorization.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `notifications.getStatus` | `{}` | `{ status: "active" \| "disconnected" \| "unsupported" }` |
| `notifications.getActive` | `{}` | `{ notifications: DeviceNotificationSummary[] }` |

**Example Response (`notifications.getStatus`):**
```json
{
  "status": "active"
}
```

**Example Response (`notifications.getActive`):**
```json
{
  "notifications": [
    {
      "id": "1001",
      "logicalId": "com.whatsapp_1001_chat_42",
      "packageName": "com.whatsapp",
      "title": "Alice Smith",
      "text": "Are we still meeting at 3 PM?",
      "category": "msg",
      "postTime": 1711234567890,
      "isClearable": true,
      "hasReplyAction": true,
      "isUpdate": false,
      "actions": [
        { "title": "Reply", "hasRemoteInput": true, "isQuickReply": true, "actionHandle": "act_8f7b2c1409d1e56b..." }
      ]
    }
  ]
}
```

---

### 🔴 notifications.reply

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** Explicit user authorization + Package Whitelist (`allowedNotificationPackages`)  
**Host API namespace:** `notifications`

Allows plugins to execute inline direct replies to active notifications using Android's native `RemoteInput` API (e.g. auto-replies or AI-drafted responses to WhatsApp, Telegram, or SMS).

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `notifications.reply` | `{ notificationKey: string, reply: string }` | `{ success: boolean, notificationKey: string }` |

**Input fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `notificationKey` | string | ✅ | Identifier of the active notification (as received in `DeviceNotificationSummary.id` or `logicalId`) |
| `reply` | string | ✅ | Text content to send (max **4,000 characters**) |

**Safety & Lifetime Boundaries:**
- The native `RemoteInput` and `PendingIntent` objects reside exclusively in an Android in-memory `LruCache` (500 capacity). They are never saved to disk and are invalidated immediately when the user dismisses the notification.
- Double-checked package authorization: The plugin must have the target app in its `allowedNotificationPackages`.
- Max payload length is strictly capped at **4,000 characters** to protect against Android Binder `TransactionTooLargeException`.
- Fails safely with `reply_action_unavailable` or `notification_not_found` if the notification has been dismissed or lacks a reply action.

---

### 🔴 notifications.action

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** Explicit user authorization + Package Whitelist (`allowedNotificationPackages`)  
**Host API namespace:** `notifications`

Allows plugins to programmatically interact with active notifications: dismiss them from the status bar or trigger interactive quick actions (e.g. "Mark as Read", "Archive", "Call Back", custom inline prompts).

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `notifications.dismiss` | `{ notificationKey: string }` | `{ success: boolean, notificationKey: string }` |
| `notifications.invokeAction` | `{ actionHandle: string, notificationKey?: string, actionIndex?: integer, actionTitle?: string, inputs?: object }` | `{ success: boolean, actionHandle: string, executedAt: integer }` |

**Input fields (`notifications.dismiss`):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `notificationKey` | string | ✅ | Target notification identifier (`StatusBarNotification.key` or `id`) |

**Input fields (`notifications.invokeAction`):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `actionHandle` | string | ✅ | Cryptographic single-use token (`act_<uuid4>`) identifying the action |
| `notificationKey` | string | ❌ | Expected notification key (validated against token binding) |
| `actionIndex` | integer | ❌ | Expected action index (validated against token binding) |
| `actionTitle` | string | ❌ | Action title label (informative) |
| `inputs` | object | ❌ | Optional key-value inputs for actions requiring `RemoteInput` parameters |

**Security & Lifetime Boundaries for Actions:**
- **Cryptographic Handle:** `actionHandle` is an unguessable 128-bit UUID v4 token generated when the notification is parsed.
- **Single-Use Guard:** Once triggered, the token is marked `isUsed` and immediately purged to prevent replay attacks.
- **Triple-Binding Verification:** Tokens are cryptographically bound to `(pluginId, notificationKey, packageName)`. A plugin cannot invoke an action from another plugin or another app.
- **TTL Expiration:** Actions expire automatically after **5 minutes** or upon notification dismissal.
- **Background Activity Launch (BAL):** On Android 14+ (API 34+), actions execute with `PendingIntent.send(ActivityOptions.makeBasic().setPendingIntentBackgroundActivityStartMode(...))`. On Android 10–13, background activity launches are restricted by the OS if no foreground service is active.

---

### 🟡 files.pick

**Category:** Data  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `files`

Opens the **native file picker** so the user selects a file.
Returns an opaque **handle** — the plugin never receives a real filesystem path.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `files.pick` | `{ allowedExtensions?: string[], title?: string }` | `{ cancelled, handle, name, size, extension, mimeType }` |

**Example output (success):**
```json
{
  "cancelled": false,
  "handle": "f_a1b2c3d4e5f6...",
  "name": "document.pdf",
  "size": 45678,
  "extension": "pdf",
  "mimeType": "application/pdf"
}
```

---

### 🟡 files.read

**Category:** Data  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `files`

Reads the content of a file previously selected with `files.pick`.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `files.read` | `{ handle, asText?: boolean }` | `{ handle, name, size, encoding, content }` |

**Encoding:** `"utf8"` for text files, `"base64"` for binary files.  
**Limitations:** Max 8 MB per file. Handle must belong to the calling plugin.

**Possible errors:**
- `Handle invalido o expirado` — call `files.pick` first
- `Archivo supera el limite de lectura` — file > 8 MB
- `El archivo ya no existe` — file deleted after picking

---

### 🟡 files.write

**Category:** Data  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `files`

Writes a file to the **plugin's private sandbox directory** inside Chattree.  
The plugin does not control the final path — Chattree determines it.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `files.write` | `{ name, content, encoding? }` | `{ name, size, written, handle }` |

**Encoding:** `"utf8"` (default) or `"base64"`.  
**Limitations:** Max 8 MB per file. Path traversal (`../`) blocked.

---

### 🔴 location.current

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** Explicit user authorization + OS permission  
**Host API namespace:** `location`

Returns the **current device GPS position** (one-shot, no streaming).

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `location.current` | `{ accuracy?: "high"\|"medium"\|"low"\|"lowest" }` | `{ latitude, longitude, accuracy, timestamp, provider }` |
| `location.permission_status` | `{}` | `{ serviceEnabled, permission, isGranted, isDeniedForever }` |

**Limitations:**
- One-shot only (no continuous tracking).
- Requires `ACCESS_FINE_LOCATION` in Android manifest.
- Does not store or share location between plugins.
- OS permission prompt is shown to user if not yet granted.
- Timeout: 15 seconds.

---

### 🔴 camera.capture

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** Explicit user authorization  
**Host API namespace:** `camera`

Opens the **system camera interface** to capture a photo.  
Returns an opaque file handle. No direct hardware access.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `camera.capture` | `{ preferredCamera?: "rear"\|"front", quality?: 10–100 }` | `{ cancelled, handle, name, size, mimeType }` |

**Limitations:**
- Single photo only (no video, no live preview).
- Photo saved to plugin sandbox, accessible via `files.read` with returned handle.
- The plugin never receives a raw filesystem path.

---

### 🔴 contacts.read

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** Explicit user authorization  
**Host API namespace:** `contacts`

Searches or retrieves contacts from the **device address book**.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `contacts.get` | `{ query?: string, limit?: number }` | `{ contacts: [{ id, displayName, phones, emails }] }` |
| `contacts.search` | `{ query: string, limit?: number }` | same as above |

**Limitations:** Max 50 contacts per call. Strips internal metadata.

---

### 🟡 contacts.create

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `contacts`

Creates a new contact in the device address book.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `contacts.create` | `{ displayName, phones?, emails? }` | `{ id, displayName, created }` |

---

### 🟡 contacts.update

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `contacts`

Updates an existing contact.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `contacts.update` | `{ id, displayName?, phones?, emails? }` | `{ id, updated }` |

---

### 🟡 calendar.read

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `calendar`

Reads events from the **device calendar**.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `calendar.events` | `{ calendarId, startDate, endDate }` | `{ events: [...] }` |
| `calendar.calendars` | `{}` | `{ calendars: [{ id, name, isDefault }] }` |

---

### 🟡 calendar.create / calendar.update / calendar.delete

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `calendar`

Creates, updates or deletes calendar events.

| Operation | Input |
|-----------|-------|
| `calendar.create` | `{ calendarId, title, startDate, endDate, description? }` |
| `calendar.update` | `{ calendarId, eventId, title?, startDate?, endDate?, description? }` |
| `calendar.delete` | `{ calendarId, eventId }` |

---

### 🟢 share.text

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** None (low-risk)  
**Host API namespace:** `share`

Opens the **native system share sheet** to share text or a URL.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `share.text` | `{ text, subject? }` | `{ shared: true }` |

**Limitations:** Max **32,768 characters (32 KB)**.

---

### 🟡 share.file

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `share`

Shares a file (via its handle) through the native share sheet.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `share.file` | `{ handle, text? }` | `{ shared: true, type: "file", handle, fileName }` |

**Limitations:** Handle must belong to the calling plugin.

---

### 🟢 open.url

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** None (low-risk)  
**Host API namespace:** `open`

Opens a **URL in the device's default browser**.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `open.url` | `{ url }` | `{ opened: boolean, url }` |

**Limitations:** Only `https` and `http` schemes. Blocks `file://`, `javascript:`, `intent:`, etc.

---

### 🟡 open.app

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `open`

Opens an installed app using a **URI scheme** (e.g. `maps://`, `tel:`, `mailto:`).

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `open.app` | `{ uri }` | `{ opened: boolean, target }` |

---

### 🟡 chattree.notes.read

**Category:** Data  
**Status:** ✅ Available (Phase 3G)  
**Permission required:** User consent  
**Host API namespace:** `chattree.notes`

Retrieves a specific note from **Chattree Notes** by ID or title.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `chattree.notes.get` | `{ id: string }` | `{ note: { id, title, content, createdAt, updatedAt } }` |

**Limitations:** Max title: 300 chars. Content may be up to 50 000 chars.

---

### 🟡 chattree.notes.search

**Category:** Data  
**Status:** ✅ Available (Phase 3G)  
**Permission required:** User consent  
**Host API namespace:** `chattree.notes`

Searches Chattree Notes by keyword.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `chattree.notes.search` | `{ query: string, limit?: number }` | `{ notes: [...], count }` |

**Limitations:** Max 100 results per call. Query truncated at 300 chars.

---

### 🟡 chattree.notes.create

**Category:** Data  
**Status:** ✅ Available (Phase 3G)  
**Permission required:** User consent  
**Host API namespace:** `chattree.notes`

Creates a new note in Chattree Notes.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `chattree.notes.create` | `{ title: string, content?: string }` | `{ note: { id, title, content, createdAt, updatedAt } }` |

**Limitations:** Title required, max 300 chars. Content max 50 000 chars.

---

### 🟡 chattree.notes.update

**Category:** Data  
**Status:** ✅ Available (Phase 3G)  
**Permission required:** User consent  
**Host API namespace:** `chattree.notes`

Updates an existing Chattree note.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `chattree.notes.update` | `{ id, title?, content? }` | `{ note: { id, title, content, createdAt, updatedAt } }` |

---

### 🟡 chattree.notes.delete

**Category:** Data  
**Status:** ✅ Available (Phase 3G)  
**Permission required:** User consent  
**Host API namespace:** `chattree.notes`

Permanently deletes a Chattree note.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `chattree.notes.delete` | `{ id }` | `{ deleted: true, id }` |

---

### 🟡 chattree.reminders.read

**Category:** Data  
**Status:** ✅ Available (Phase 3G)  
**Permission required:** User consent  
**Host API namespace:** `chattree.reminders`

Lists and retrieves reminders from Chattree.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `chattree.reminders.list` | `{ limit?: number }` | `{ reminders: [...], count }` |
| `chattree.reminders.get` | `{ id }` | `{ reminder: { id, title, scheduledAt, completed, ... } }` |

---

### 🟡 chattree.reminders.create

**Category:** Data  
**Status:** ✅ Available (Phase 3G)  
**Permission required:** User consent  
**Host API namespace:** `chattree.reminders`

Creates a new reminder with an optional alarm.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `chattree.reminders.create` | `{ title, scheduledAt?: ISO8601 }` | `{ reminder: { id, title, scheduledAt, ... } }` |

**Limitations:** Title max 300 chars.

---

### 🟡 chattree.reminders.update / delete / complete

**Category:** Data  
**Status:** ✅ Available (Phase 3G)  
**Permission required:** User consent  
**Host API namespace:** `chattree.reminders`

Updates, deletes or marks reminders as complete.

| Operation | Input |
|-----------|-------|
| `chattree.reminders.update` | `{ id, title?, scheduledAt? }` |
| `chattree.reminders.delete` | `{ id }` |
| `chattree.reminders.complete` | `{ id }` |

---

### 🟡 chattree.context.read

**Category:** AI  
**Status:** ✅ Available (Phase 3G)  
**Permission required:** User consent  
**Host API namespace:** `chattree.context`

Reads the **current message** explicitly provided to the plugin's execution scope.  
This is strictly limited — it does NOT expose full chat history or all previous messages.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `chattree.context.read` | `{}` | `{ currentMessage, explicitContext, authorized, restricted, timestamp }` |

---

### 🟡 email.read

**Category:** Communication & Personal Data  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `email`

Allows the plugin to read email accounts, inspect inbox messages, and fetch message bodies via secure IMAP. App passwords configured via `email.config` / `email.setup` are encrypted at rest in `FlutterSecureStorage` (`EncryptedSharedPreferences` on Android / Keychain on iOS) and never stored in plaintext in `PluginStorageStore`.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `email.inbox` / `email.list` / `email.events` | `{}` | `{ status, account, unread_count, total_count, emails: [...] }` |
| `email.read` | `{ id: string }` | `{ id, from, to, subject, date, body }` |
| `email.config` / `email.setup` | `{ email, password, imapHost?, imapPort? }` | `{ configured: true, email, provider, message }` |
| `email.disconnect` / `email.logout` | `{}` | `{ disconnected: true, message }` |

---

### 🟡 email.send

**Category:** Communication  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `email`

Allows the plugin to dispatch outgoing emails via secure SMTP. Both `email.read` and `email.send` are strictly verified by `PermissionGateway` before any operation executes.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `email.send` / `email.create` | `{ to: string, subject: string, body: string }` | `{ sent: true, to, subject, response }` |

---

### 🟡 network.webhook_inbound

**Category:** Network & Automation  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** Inbound Webhook Pipeline (`InboundHttpServer` / `EventRuntime`)

Allows the plugin to register HTTP webhook endpoints (`127.0.0.1` by default, or LAN `0.0.0.0` when explicitly enabled by the user in Settings) and receive authenticated inbound events (via Bearer token or `HMAC-SHA256` signature). Users can inspect the endpoint URL, toggle LAN/Wi-Fi access, copy the active secret, and rotate endpoint secrets at any time from **Settings → Plugins → [Plugin] → Webhooks Entrantes**.

---

### 🟡 network.webhook_outbound

**Category:** Network & Connectivity  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `network` (`WebhookEgressSender`)

Allows the plugin to dispatch automated outbound webhook events to external HTTPS services (such as Slack, Notion, Discord, or CI/CD pipelines) when internal Chattree events occur. Outbound webhooks implement SSRF validation, DNS pinning, exponential backoff retries (base 10s + jitter 0..2s), maximum 16 concurrent global dispatches (max 5 per extension), and response body drainage capped at 8 KB to protect mobile resources.

---

### 🟡 clipboard.read / 🟢 clipboard.write

**Category:** Device  
**Status:** ✅ Available  
**Permission required:** User consent (`clipboard.read`) / Normal (`clipboard.write`)  
**Host API namespace:** `clipboard`

Allows reading text from (`clipboard.read`, max 100 KB) or copying text to (`clipboard.write`, max 100 KB) the system clipboard.

| Operation | Input | Output |
|-----------|-------|--------|
| `clipboard.read` / `clipboard.get` | `{}` | `{ text: string, hasContent: boolean, length: number }` |
| `clipboard.write` / `clipboard.set` | `{ text: string }` | `{ copied: true, length: number }` |
| `clipboard.has` | `{}` | `{ hasContent: boolean }` |

---

### 🟡 chat.history.read

**Category:** AI & Conversation  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `chattree.context` (`chat` / `chat.history`)

Allows reading a bounded window of recent messages from the active conversation so plugins can summarize threads, extract tasks, or maintain multi-turn context.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `chattree.context.history` / `chattree.context.messages` | `{ limit?: number }` | `{ messages: [{ role, content, timestamp }], count: number, maxLimit: 20, restricted: boolean, timestamp: string }` |

**Limitations:**
- Returns at most **20 recent messages** (`limit` clamped between 1 and 20, default 10).
- Individual message `content` is truncated at **4 000 characters**.
- Returns an empty list if the conversation is in restricted mode.

---

### 🟡 ai.context

**Category:** AI  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `ai` (`ai.context`)

Allows the plugin to request a bounded, single-turn text completion from the active AI model (either a configured remote provider or the loaded on-device GGUF model) without recursive tool execution.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `ai.complete` / `ai.generate` / `ai.prompt` / `ai.context` | `{ prompt: string, systemPrompt?: string, maxTokens?: number, temperature?: number }` | `{ text: string, engine: "remote" \| "local", providerId?: string, modelId: string }` |

**Limitations:**
- `prompt` max **16 000 characters**; `systemPrompt` max **4 000 characters**.
- `maxTokens` clamped between **1 and 2 048** (default 512).
- Single-turn inference only; plugins cannot trigger nested tool calls.

---

### 🟡 ai.embeddings

**Category:** AI & Vector RAG  
**Status:** ✅ Available  
**Permission required:** User consent  
**Host API namespace:** `ai` (`ai.embeddings`)

Allows the plugin to generate on-device vector embeddings, perform semantic search over the local vector store, and index or remove custom plugin-scoped text documents.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `ai.embed` / `ai.embeddings` | `{ text: string }` | `{ embedding: number[], dimensions: number, modelId: string }` |
| `ai.search` / `ai.rag_search` | `{ query: string, topK?: number, minSimilarity?: number }` | `{ results: [{ noteId, noteTitle, chunkText, similarity, chunkIndex }], count: number }` |
| `ai.index_document` / `ai.index` | `{ id: string, title: string, content: string }` | `{ indexed: true, documentId: string, originalId: string, chunksCount: number }` |
| `ai.remove_document` / `ai.remove` | `{ id: string }` | `{ removed: true, documentId: string }` |

**Limitations:**
- Requires the on-device embedding model (`RagService`) to be downloaded and initialized.
- Input text/content max **50 000 characters** per call.
- `topK` clamped between **1 and 20** (default 5).
- Indexed documents are automatically namespaced as `plugin_<pluginId>_<id>` so a plugin can only overwrite or remove its own indexed documents.

---

### 🟡 network.websocket

**Category:** Network  
**Status:** ✅ Available (Phase 1)  
**Permission required:** User consent (`network.websocket`)  
**Host API namespace:** `websocket`

Allows plugins to establish and manage **bidirectional, full-duplex WebSocket connections** for streaming data, live push notifications, real-time messaging, and IoT/telemetry channels.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `websocket.connect` | `{ url: string, headers?: object, protocols?: string[], pingIntervalSeconds?: number }` | `{ connectionId: string, status: "connected" \| "connecting", url: string }` |
| `websocket.send` | `{ connectionId: string, message: string, isBinary?: boolean }` | `{ sent: true, bytes: number }` |
| `websocket.receive` / `websocket.poll` | `{ connectionId: string, maxMessages?: number }` | `{ messages: [{ data: string, isBinary: boolean, timestamp: string }], count: number }` |
| `websocket.status` | `{ connectionId: string }` | `{ connectionId: string, state: "connected" \| "connecting" \| "closing" \| "closed", bufferedAmount: number, queuedMessages: number }` |
| `websocket.close` | `{ connectionId: string, code?: number, reason?: string }` | `{ closed: true, connectionId: string }` |

**Input fields for `websocket.connect`:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | ✅ | `ws://` or `wss://` URI |
| `headers` | object | ❌ | Custom handshake headers (restricted hop-by-hop headers stripped) |
| `protocols` | string[] | ❌ | WebSocket subprotocols requested |
| `pingIntervalSeconds` | number | ❌ | Periodic ping heartbeat interval (default 30s) |

**Limitations & Security Guarantees:**
- **Connection limit:** Up to **10 concurrent active sockets** per plugin.
- **Atomic connection reservations:** Connection quotas are pre-reserved before the asynchronous network handshake begins. This completely prevents race conditions where multiple parallel connect calls bypass the 10-socket quota. If a handshake fails, times out, or is cancelled, the reservation is automatically released.
- **Maximum frame size:** **16 MB (`16,777,216` bytes)** per incoming or outgoing frame. If an inbound frame exceeds 16 MB, the socket is immediately terminated with WebSocket close code **`1009`** (Message Too Large / RFC 6455) to protect device memory.
- **In-memory message buffer:** Up to **500 queued messages** per socket retained in memory before polling.
- **SSRF protection:** Connections to loopback (`127.0.0.1`, `localhost`) or private RFC 1918 subnets (`192.168.x.x`, `10.x.x.x`, `172.16.x.x`) are rejected unless the plugin also holds the critical `network.local` capability. Cloud metadata endpoints (`169.254.169.254`) are permanently blocked.
- **Lifecycle cleanup:** All active sockets are cleanly closed when a plugin is uninstalled, disabled, or unloaded.

**Example:**
```json
{
  "api": "websocket",
  "operation": "connect",
  "payload": {
    "url": "wss://echo.websocket.events"
  }
}
```

---

### 🟡 ui.components / ui.render

**Category:** Device / UI  
**Status:** ✅ Available (Phase 2)  
**Permission required:** User consent (`ui.components` or `ui.render`)  
**Host API namespace:** `ui`

Allows plugins to emit rich, interactive declarative UI cards in the chat rather than plain text. Enables progress bars, badges, formatted metric key-value tables, and action buttons.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `ui.render` / `ui.show_card` | `{ card: UiCard }` | `{ rendered: true, elementCount: number }` |

> **Direct WASM Tool Result:** Plugins can also emit declarative UI directly by returning `{ "text": "Summary", "ui": { "type": "card", ... } }` in the result of any tool call.

**Card Schema (`UiCard`):**

```json
{
  "title": "Build Status",
  "subtitle": "Production Deployment Pipeline",
  "elements": [
    { "type": "badge", "text": "SUCCESS", "variant": "success" },
    { "type": "progress", "value": 100, "label": "Deployment Complete" },
    {
      "type": "key_value",
      "items": [
        { "label": "Commit", "value": "a1b2c3d" },
        { "label": "Environment", "value": "production" }
      ]
    },
    { "type": "divider" },
    {
      "type": "button_row",
      "buttons": [
        { "label": "View Logs", "action": "url", "payload": "https://ci.example.com/build/123" },
        { "label": "Rollback", "action": "command", "payload": "/deploy rollback", "variant": "danger" }
      ]
    }
  ]
}
```

**Supported Component Elements:**

| Component | Properties | Description |
|-----------|------------|-------------|
| `text` | `content` (string), `style` (`"body"` \| `"caption"` \| `"headline"` \| `"code"`), `markdown` (boolean) | Text block with optional markdown formatting |
| `badge` | `text` (string), `variant` (`"info"` \| `"success"` \| `"warning"` \| `"error"` \| `"neutral"`), `icon` (string?) | Color-coded status badge |
| `progress` | `value` (number 0.0 to 1.0 or 0 to 100), `label` (string?), `status` (string?) | Progress bar with optional indicator text |
| `key_value` | `items`: `[{ label: string, value: string, copyable?: boolean }]` | Structured label-value grid (up to 40 items) |
| `divider` | None | Subtle horizontal separator line |
| `button_row` | `buttons`: `[{ label: string, action: "command" \| "url" \| "copy", payload: string, variant?: "primary" \| "secondary" \| "danger" }]` | Interactive action row (up to 8 buttons per row) |

**Limitations & Security Guarantees:**
- **Element density limits:** Max **60 elements** per card; max **40 key-value items** per table; max **8 buttons** per button row; max nesting depth of 3 levels.
- **Centralized sanitization:** All UI cards are sanitized through `UiApiHandler.sanitizeUiCard` regardless of source (Host API call or direct WASM return). Invalid nodes, oversized strings, and unknown types are safely stripped.
- **Security Confirmation Modal for sensitive actions:** If an action button has `action: "command"` and the target payload begins with `/` (e.g., `/deploy`, `/delete`, `/reboot`) or executes commands, Chattree intercepts the click and displays an explicit user confirmation dialog showing the command before execution. This prevents clickjacking or unauthorized actions from third-party plugins.

---

### 🟡 scheduler.task / scheduler.cron

**Category:** Automation / Device  
**Status:** ✅ Available (Phase 3)  
**Permission required:** User consent (`scheduler.task` or `scheduler.cron`)  
**Host API namespace:** `scheduler`

Allows plugins to schedule recurring tasks and background automations using standard Cron expressions or periodic intervals, with events delivered through Chattree's central `HostEventBus`.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `scheduler.schedule_task` | `{ taskId: string, cron?: string, intervalSeconds?: number, payload?: any, description?: string }` | `{ scheduled: true, taskId: string, nextExecution: string }` |
| `scheduler.cancel_task` | `{ taskId: string }` | `{ cancelled: true, taskId: string }` |
| `scheduler.list_tasks` | `{}` | `{ tasks: [{ taskId, cron, intervalSeconds, nextExecution, payload, createdAt }], count: number }` |
| `scheduler.get_task` | `{ taskId: string }` | `{ task: object \| null }` |

**Cron Syntax & Precision:**
- Evaluated via exact wall-clock calculations (`calculateNextCronExecution`).
- Standard 5-field format: `minute hour day-of-month month day-of-week`
  - `*/15 * * * *` — Every 15 minutes
  - `0 * * * *` — Every hour on the hour
  - `0 9 * * *` — Daily at 9:00 AM
  - `0 0 * * 1` — Weekly on Mondays at midnight
  - `30 14 1 * *` — 1st of every month at 2:30 PM

**Limitations & Security Guarantees:**
- **Anti-battery drain threshold:** Enforces a strict minimum execution interval of **60 seconds**. Tasks specifying intervals or cron schedules with frequency under 60 seconds are rejected with `minimumIntervalViolation`.
- **Task quota:** Up to **25 active scheduled tasks** per plugin.
- **Payload capacity:** Up to **128 KB (`131,072` bytes)** per task payload.
- **Event distribution:** When a task triggers, the system publishes a `scheduler.trigger` event on `HostEventBus` containing `{ taskId, pluginId, payload, timestamp }`.
- **Automatic cleanup:** All scheduled tasks registered by a plugin are cleanly deleted from the persistent schedule store when the plugin is uninstalled or disabled.

---

### 🟡 database.sql / storage.database

**Category:** Data  
**Status:** ✅ Available (Phase 4)  
**Permission required:** User consent (`database.sql` or `storage.database`)  
**Host API namespace:** `database`

Provides a fully managed, private, and isolated **relational SQLite database** for each plugin. Perfect for plugins that need complex queries, indexes, relational filtering, and atomic multi-step transactions.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `database.query` | `{ sql: string, params?: any[] }` | `{ rows: object[], rowCount: number, columns: string[] }` |
| `database.execute` | `{ sql: string, params?: any[] }` | `{ changes: number, lastInsertRowId?: number }` |
| `database.insert` | `{ table: string, values: object }` | `{ insertedId: number }` |
| `database.update` | `{ table: string, values: object, where: string, whereArgs?: any[] }` | `{ rowsAffected: number }` |
| `database.delete` | `{ table: string, where: string, whereArgs?: any[] }` | `{ rowsAffected: number }` |
| `database.transaction` | `{ statements: [{ sql: string, params?: any[] }] }` | `{ success: true, results: object[] }` |
| `database.tables` | `{}` | `{ tables: string[] }` |

**Limitations & Security Guarantees:**
- **Dedicated private database file:** Each plugin operates on `plugin_<pluginId>.db` stored in a protected app sandbox directory. Zero cross-plugin access.
- **Storage quota:** **200 MB (`209,715,200` bytes)** maximum database size. The quota calculates the cumulative size of the `.db` primary file, `.db-wal` write-ahead log, `.db-shm` shared memory file, and `.db-journal`. If an execution would exceed 200 MB, the operation is blocked with `quotaExceeded`.
- **Query result cap:** Max **2,000 rows** returned per query to prevent memory exhaustion.
- **Automatic type normalization:** Booleans are mapped to SQLite integers (`1` or `0`), and structured objects/arrays are serialized to valid JSON strings.
- **Atomic transactions:** `database.transaction` runs multiple SQL statements within a single atomic SQLite transaction with immediate automatic rollback on error.
- **Sandbox escape defense:** Strictly blocks unauthorized SQL statements including `ATTACH DATABASE`, `DETACH DATABASE`, `VACUUM INTO`, direct modifications to `sqlite_master`, and `PRAGMA writable_schema`.
- **Zero-orphan uninstall:** Uninstalling a plugin automatically removes its `.db`, `.db-wal`, `.db-shm`, and `.db-journal` files, leaving zero residual data on disk.

**Example:**
```json
{
  "api": "database",
  "operation": "execute",
  "payload": {
    "sql": "CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, sender TEXT, content TEXT, created_at INTEGER)"
  }
}
```
