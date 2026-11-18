# ChattreeHostApi — Host API Reference

The **ChattreeHostApi** is the bridge between a WASM plugin and Chattree's internal services.
Your plugin communicates with it through a single imported function: `chattree.host_call`.

> [!NOTE]
> **Slash-Command Input (`lang=<code>`)**  
> When a user invokes a plugin slash command from chat, Chattree appends the active app language to plain-text arguments (e.g., `/mycmd` passes `"lang=es"` and `/mycmd test` passes `"test lang=es"`). Strip trailing `lang=<code>` tokens before matching exact subcommands.

---

## Import the host function

Your WASM module must declare this import to use any Host API:

```wat
(import "chattree" "host_call"
  (func $host_call (param i32 i32 i32 i32) (result i32))
)
```

**Parameters:**

| Param | Type | Meaning |
|-------|------|---------|
| `reqPtr` | i32 | Memory offset where the request JSON string starts |
| `reqLen` | i32 | Byte length of the request JSON string |
| `resPtr` | i32 | Memory offset where Chattree will write the response JSON |
| `resMaxLen` | i32 | Maximum bytes Chattree can write to the response buffer |

**Return value:**

| Value | Meaning |
|-------|---------|
| `> 0` | Synchronous response written at `resPtr`, length = return value |
| `0` | Async operation started — WASM must export a `resume` function |
| `-1` | Error parsing request or memory out of bounds |

---

## Request JSON format

```json
{
  "api": "storage",
  "operation": "set",
  "payload": { "key": "my_key", "value": "my_value" }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `api` | string | Yes | Namespace identifier (see table below) |
| `operation` | string | Yes | Operation name within the namespace |
| `payload` | any | Yes | Operation-specific parameters |

---

## Response JSON format

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` if the operation succeeded |
| `data` | object | Operation result (present when `success == true`) |
| `error` | string | Error message (present when `success == false`) |

---

## Registered namespaces

| Namespace | Description | Mode | Capability Required |
|-----------|-------------|------|---------------------|
| `core` | Plugin metadata and logging | Sync | None |
| `storage` | Private key-value store | Sync | `storage.private` (auto) |
| `network` | HTTP/HTTPS requests | Async | `network.http` (+ `allowedDomains` in `plugin.json`; optional `network.local` for LAN/loopback) |
| `files` | File pick / read / write | Async | `files.pick`/`files.read`/`files.write` |
| `notifications` | Local alerts, Notification Hub & Listener | Async | `notifications.send`, `notifications.read`, `notifications.query`, `notifications.reply`, `notifications.action` |
| `location` | GPS position | Async | `location.current` |
| `camera` | Photo capture | Async | `camera.capture` |
| `contacts` | Address book | Async | `contacts.read`/`.create`/`.update` |
| `calendar` | Device calendar | Async | `calendar.read`/`.create`/`.update`/`.delete` |
| `email` | Native IMAP/SMTP email & inbox | Async | `email.read`/`email.send` |
| `clipboard` | System clipboard read/write | Async | `clipboard.read`/`clipboard.write` |
| `share` | Share sheet | Async | `share.text`/`share.file` |
| `open` | Launch URLs and apps | Async | `open.url`/`open.app` |
| `chattree.notes` | Chattree Notes CRUD | Async | `chattree.notes.*` |
| `chattree.reminders` | Chattree Reminders CRUD | Async | `chattree.reminders.*` |
| `chattree.context` | Current message & bounded chat history | Async | `chattree.context.read` / `chat.history.read` |
| `ai` | Single-turn LLM completion, embeddings & RAG | Async | `ai.context` / `ai.embeddings` |
| `websocket` | Real-time bidirectional WebSockets | Async | `network.websocket` (+ optional `network.local`) |
| `ui` | Declarative rich UI cards, badges, progress & buttons | Async (`ui.validate` is Sync) | `ui.components` / `ui.render` |
| `scheduler` | Wall-clock Cron & periodic background tasks | Async | `scheduler.task` / `scheduler.cron` |
| `database` | Private isolated relational SQLite & transactions | Async | `database.sql` / `storage.database` |

---

## Synchronous vs. asynchronous calls

**Synchronous** operations complete within the same WASM execution call:
- `core.get_manifest`, `core.log`
- All `storage.*` operations

**Asynchronous** operations require a second execution round-trip:
1. Your WASM calls `host_call(…)` → receives `0` (async pending).
2. Chattree executes the async operation (e.g. network request).
3. Chattree calls your exported `resume(resPtr, resLen)` function.
4. Your WASM reads the response and continues.

> If your plugin only uses sync operations (core + storage), you do NOT need to
> export a `resume` function.

---

## Namespace operations reference

### core.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `core.get_manifest` | Yes | `{}` | `{ id, version, name, description, author, runtimeApiVersion }` |
| `core.log` | Yes | `{ level: "info"\|"warning"\|"error", message: string }` | `{ logged: true, level }` |

`core.log` messages appear in Flutter debug logs prefixed with `[Plugin:<id>]`.

---

### storage.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `storage.set` | Yes | `{ key, value }` | `{ stored: true, key, value }` |
| `storage.get` | Yes | `{ key }` | `{ value: string\|null, exists: boolean }` |
| `storage.delete` | Yes | `{ key }` | `{ deleted: boolean, key }` |
| `storage.has` | Yes | `{ key }` | `{ exists: boolean, key }` |
| `storage.keys` | Yes | `{}` | `{ keys: string[], count: number }` |

**Quotas enforced by `PluginStorageStore`:**
- Max key length: **256 chars**
- Max value size: **256 KB (`262,144` bytes)**
- Max keys per plugin: **500 keys**
- Max total storage per plugin: **2 MB (`2,097,152` bytes)**

---

### network.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `network.http_request` | No | `{ url, method?, headers?, body?, bodyEncoding?, responseType?, timeoutMs? }` | `{ statusCode, headers, body, encoding?, isBase64? }` |

> **Domain Allowlist (`allowedDomains` — SEC-4.3.4-05):** Imported and Marketplace plugins calling `network.http_request` must explicitly declare every destination hostname or subdomain wildcard (`*.domain.com`) in `"allowedDomains"` inside `plugin.json`. Requests to undeclared hosts are blocked at runtime.

---

### files.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `files.pick` | No | `{ allowedExtensions?, title? }` | `{ cancelled, handle, name, size, extension, mimeType }` |
| `files.read` | No | `{ handle, asText? }` | `{ handle, name, size, encoding, content }` |
| `files.write` | No | `{ name, content, encoding? }` | `{ name, size, written, handle }` |

---

### Returning a generated file to the chat

A plugin can generate a file with `files.write` and return its opaque `handle` as part of the WASM tool result. Chattree then renders a file card in the chat with **Save** and **Share** actions.

1. Declare `files.write` in the plugin or tool capabilities and request/grant it as required by the app.
2. Call `files.write` with a safe filename and content. Use `encoding: "utf8"` for text formats such as Markdown, or `encoding: "base64"` for binary data.
3. Read the returned `data.handle` and `data.name`.
4. Return a direct result from the WASM entrypoint in this shape:

```json
{
  "type": "direct",
  "displayText": "Generated report is ready.",
  "fileHandle": "f_<handle returned by files.write>",
  "fileName": "report.md"
}
```

The Host API response from `files.write` has the form `{"success":true,"data":{"name":"report.md","size":123,"written":true,"handle":"f_…"}}`. In the final tool result, Chattree verifies that the handle exists and belongs to the calling plugin; the handle registry is authoritative for the actual filename and file path.

The chat file card shows the filename/type, the `displayText`, and **Save** and **Share** buttons. Save opens the native save flow; Share opens the platform share sheet. These are user-triggered actions. They do not require the plugin to call `share.file`, because the app performs them from the card. The file itself still requires the `files.write` capability to create.

For a `.md` file, `files.write` stores Markdown text and the card identifies it as a Markdown/text file. The card’s `displayText` is currently shown as plain text rather than rendered Markdown; the generated file can be saved or shared and then opened in a Markdown viewer/editor.

If you return an unknown, unavailable, or another plugin’s handle, Chattree drops the file attachment. Do not invent or persist handles between sessions; create the file and return its handle in the same execution flow.

---

### notifications.*

The `notifications` namespace covers local notification dispatch and the full universal Notification Hub device integration (querying active alerts, listening to real-time incoming notifications, direct replies via `RemoteInput`, programmatically dismissing notifications, and invoking native actions via cryptographically secure `ActionHandle` tokens).

> [!IMPORTANT]
> **Package Scope Isolation (`allowedNotificationPackages`)**  
> Every notification operation (`getActive`, `reply`, `dismiss`, `invokeAction`, and push event delivery) requires the target application's Android package name to be explicitly declared in the plugin manifest (`plugin.json` under `allowedNotificationPackages`). Calls targeting undeclared packages are rejected with `403 Forbidden` (`packageScopeViolation: true`).

| Operation | Sync | Capability Required | Input | Output | Description |
|-----------|------|---------------------|-------|--------|-------------|
| `notifications.send` | No | `notifications.send` | `{ title: string, body?: string }` | `{ notificationId, sent, remainingQuota }` | Sends a local system alert (rate limited to 15/hr). |
| `notifications.cancel` | No | `notifications.send` | `{ notificationId: number }` | `{ notificationId, cancelled: boolean }` | Cancels a local notification previously posted by this plugin. |
| `notifications.getStatus` | No | `notifications.query` or `notifications.read` | `{}` | `{ status: "active" \| "disconnected" \| "permission_required" \| "reconnecting" \| "unsupported", isListenerEnabled: boolean, isSupported: boolean }` | Returns current Android Notification Listener service status. |
| `notifications.getActive` | No | `notifications.query` | `{ packageName?: string, category?: string, canReplyOnly?: boolean, excludeOngoing?: boolean, excludeFromMe?: boolean, includeRecent?: boolean, limit?: number }` | `DeviceNotificationSummary[]` | Queries active status bar alerts (and optionally recent RAM history), filtered strictly by `allowedNotificationPackages`. |
| `notifications.query` | No | `notifications.query` | `{ packageName?: string, category?: string, canReplyOnly?: boolean, excludeOngoing?: boolean, excludeFromMe?: boolean, includeRecent?: boolean, limit?: number }` | `DeviceNotificationSummary[]` | Alias of `notifications.getActive`. |
| `notifications.getRecent` | No | `notifications.query` | `{ limit?: number, packageName?: string, category?: string, canReplyOnly?: boolean, excludeOngoing?: boolean, excludeFromMe?: boolean }` | `DeviceNotificationSummary[]` | Queries the ephemeral in-memory circular buffer (up to 100 recent non-ongoing notifications), filtered by `allowedNotificationPackages`. |
| `notifications.reply` | No | `notifications.reply` | `{ logicalId: string, message: string }` | `{ replied: boolean, logicalId: string }` | Sends inline quick reply via Android native `RemoteInput` (max 4,000 characters). Package scope is verified from `logicalId`. |
| `notifications.dismiss` | No | `notifications.action` | `{ logicalId: string }` | `{ dismissed: boolean, logicalId: string }` | Swipes away / cancels an active notification from the Android status bar. |
| `notifications.invokeAction` | No | `notifications.action` | `{ actionHandle: string, logicalId?: string, packageName?: string, actionIndex?: number }` | `{ invoked: boolean, actionHandle: string }` | Triggers a native action button via its single-use, cryptographically secure `ActionHandle` (or `logicalId` + `actionIndex`). |
| `notifications.subscribe` | No | `notifications.read` | `{}` | `{ subscribed: boolean, status: string, isListenerEnabled: boolean, isSupported: boolean }` | Ensures the platform event listener is initialized. |
| `notifications.openSettings` | No | `notifications.query` or `notifications.read` | `{}` | `{ opened: boolean, isSupported: boolean }` | Launches Android OS Notification Listener Access settings screen. |

#### Real-Time EventBus Subscriptions (`notifications.read`)

When `notifications.read` is granted, the plugin receives ephemeral in-memory events on `HostEventBus`. Events are filtered at the dispatcher level so that the plugin **only** receives notifications from applications declared in its `allowedNotificationPackages` whitelist:

- **`device.notification.received`**: Published when a new notification arrives on the device.
- **`device.notification.updated`**: Published when an existing active notification thread updates (e.g. new message in conversation).
  ```json
  {
    "logicalId": "com.whatsapp_1042_null",
    "packageName": "com.whatsapp",
    "appName": "WhatsApp",
    "channelId": "group_chat_notifications_1",
    "postTime": 1711234567890,
    "title": "Juan Pérez",
    "body": "Hola, ¿cómo estás?",
    "subText": "WhatsApp",
    "infoText": "",
    "category": "msg",
    "isGroupSummary": false,
    "isOngoing": false,
    "isClearable": true,
    "isFromMe": false,
    "canReply": true,
    "conversationTitle": "Familia",
    "isGroup": true,
    "senderName": "Juan Pérez",
    "textLines": ["Juan: Hola, ¿cómo estás?"],
    "messageHistory": [
      {
        "text": "Hola, ¿cómo estás?",
        "timestamp": 1711234567890,
        "sender": "Juan Pérez",
        "isSelf": false
      }
    ],
    "actions": [
      {
        "actionHandle": "act_4f8b9123cde4a7812bcdeff012345678",
        "title": "Responder",
        "isReply": true,
        "semanticAction": "reply",
        "index": 0
      },
      {
        "actionHandle": "act_8e2a149b561c437a89ff0123456789ab",
        "title": "Marcar como leído",
        "isReply": false,
        "semanticAction": "mark_as_read",
        "index": 1
      }
    ]
  }
  ```
- **`device.notification.removed`**: Published when a notification is dismissed by the user or cancelled by the source app.
  ```json
  {
    "logicalId": "com.whatsapp_1042_null",
    "packageName": "com.whatsapp",
    "postTime": 1711234567890
  }
  ```
- **`device.notification.status`**: Published when the listener service status transitions (e.g. `active`, `disconnected`).

#### Action Invocation (`notifications.invokeAction`) & ActionHandle Security

Action buttons attached to Android notifications (such as *Mark as read*, *Archive*, *Snooze*, or *Approve*) are exposed to plugins via opaque, cryptographically random `ActionHandle` tokens:

```json
{
  "api": "notifications",
  "operation": "invokeAction",
  "payload": {
    "actionHandle": "act_4f8b9123cde4a7812bcdeff012345678",
    "packageName": "com.whatsapp",
    "logicalId": "com.whatsapp_1042_null"
  }
}
```

**Security Guarantees:**
1. **Cryptographic Unpredictability:** `actionHandle` tokens are generated using UUID v4 (128-bit entropy) prefixed with `act_`. They cannot be synthesized or guessed.
2. **Replay Protection (Single-Use):** Once an action is executed, it is immediately marked as used and evicted from memory. Subsequent calls with the same handle return `ACTION_ALREADY_USED` or `ACTION_EXPIRED`.
3. **Dual-Layer Cross-App Binding (Dart + Kotlin):** Calling `invokeAction` validates that the caller plugin is authorized for `packageName`, and native Kotlin strictly verifies `boundAction.packageName == packageName`. Cross-application action hijacking is impossible.
4. **Time-To-Live (TTL):** Action handles expire automatically after **5 minutes** or immediately when the notification is dismissed from the status bar.
5. **Background Activity Launch (BAL) Safety:** Compliant with Android 14+ (API 34+) `MODE_BACKGROUND_ACTIVITY_START_ALLOWED` restrictions.

#### True Zero-Persistence Architecture

Device notification payloads (titles, bodies, sender names, and message text) are treated as strictly ephemeral in-memory signals:
* **Zero Disk Persistence:** Notification events are never written to SQLite `events` or `deliveries` tables in `EventJournal`.
* **Zero Leakage on Crash or Failure:** In the event of plugin exceptions, timeouts, or application crashes, no notification data remains on disk.
* **Independent Plugin Storage:** Plugins requiring retention (e.g. an expense tracker or CRM logger) must explicitly request `database.sql` / `storage.database` and persist structured data into their own private, isolated SQLite database file (`plugin_<id>.db`).

---

### location.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `location.current` | No | `{ accuracy? }` | `{ latitude, longitude, accuracy, timestamp, provider }` |
| `location.permission_status` | No | `{}` | `{ serviceEnabled, permission, isGranted, isDeniedForever }` |

---

### camera.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `camera.capture` | No | `{ preferredCamera?, quality? }` | `{ cancelled, handle, name, size, mimeType }` |

---

### contacts.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `contacts.get` | No | `{ query?, limit? }` | `{ contacts: [...] }` |
| `contacts.search` | No | `{ query, limit? }` | `{ contacts: [...] }` |
| `contacts.create` | No | `{ displayName, phones?, emails? }` | `{ id, displayName, created }` |
| `contacts.update` | No | `{ id, displayName?, phones?, emails? }` | `{ id, updated }` |

---

### calendar.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `calendar.calendars` | No | `{}` | `{ calendars: [...] }` |
| `calendar.events` | No | `{ calendarId, startDate, endDate }` | `{ events: [...] }` |
| `calendar.create` | No | `{ calendarId, title, startDate, endDate, description? }` | `{ eventId, created }` |
| `calendar.update` | No | `{ calendarId, eventId, ...fields }` | `{ updated }` |
| `calendar.delete` | No | `{ calendarId, eventId }` | `{ deleted }` |

---

### email.*

The `email` namespace provides native IMAP and SMTP connectivity with TLS/SSL encryption for reading inboxes, inspecting message content, and sending emails.
- **Capability enforcement:** `email.read` is strictly required for `inbox`, `list`, `events`, and `read`; `email.send` is required for `send` and `create`; either `email.read` or `email.send` is required for `config`, `setup`, `disconnect`, and `logout`.
- **Credential security:** Email app passwords are encrypted at rest in `FlutterSecureStorage` (`EncryptedSharedPreferences` / Keychain) and are never stored in plaintext inside `PluginStorageStore`.

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `email.config` / `email.setup` | No | `{ email, password, imapHost?, imapPort? }` | `{ configured: true, email, provider, message }` |
| `email.inbox` / `email.list` / `email.events` | No | `{}` | `{ status: "success", account, unread_count, total_count, emails: [...] }` |
| `email.read` | No | `{ id }` | `{ id, from, to, subject, date, body }` |
| `email.send` / `email.create` | No | `{ to, subject, body }` | `{ sent: true, to, subject, response }` |
| `email.disconnect` / `email.logout` | No | `{}` | `{ disconnected: true, message }` |

---

### clipboard.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `clipboard.read` / `clipboard.get` | No | `{}` | `{ text: string, hasContent: boolean, length: number }` |
| `clipboard.write` / `clipboard.set` | No | `{ text: string }` | `{ copied: true, length: number }` |
| `clipboard.has` | No | `{}` | `{ hasContent: boolean }` |

---

### share.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `share.text` | No | `{ text, subject? }` | `{ shared: true, type: "text" }` |
| `share.file` | No | `{ handle, text? }` | `{ shared: true, type: "file", handle, fileName }` |

---

### open.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `open.url` | No | `{ url }` | `{ opened: boolean, url }` |
| `open.app` | No | `{ uri }` | `{ opened: boolean, target }` |

---

### chattree.notes.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `chattree.notes.search` | No | `{ query, limit? }` | `{ notes: [...], count }` |
| `chattree.notes.get` | No | `{ id }` | `{ note: { id, title, content, createdAt, updatedAt } }` |
| `chattree.notes.create` | No | `{ title, content? }` | `{ note: { id, title, content, createdAt, updatedAt } }` |
| `chattree.notes.update` | No | `{ id, title?, content? }` | `{ note: { ... } }` |
| `chattree.notes.delete` | No | `{ id }` | `{ deleted: true, id }` |

---

### chattree.reminders.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `chattree.reminders.list` | No | `{ limit? }` | `{ reminders: [...], count }` |
| `chattree.reminders.get` | No | `{ id }` | `{ reminder: { ... } }` |
| `chattree.reminders.create` | No | `{ title, scheduledAt? }` | `{ reminder: { ... } }` |
| `chattree.reminders.update` | No | `{ id, title?, scheduledAt? }` | `{ reminder: { ... } }` |
| `chattree.reminders.delete` | No | `{ id }` | `{ deleted: true, id }` |
| `chattree.reminders.complete` | No | `{ id }` | `{ completed: true, id }` |

---

### chattree.context.*

The `chattree.context` namespace allows a plugin to inspect the conversational invocation context (`chattree.context.read`) or read a bounded window of recent messages (`chat.history.read`).

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `chattree.context.read` | No | `{}` | `{ currentMessage, explicitContext, authorized, restricted, timestamp }` |
| `chattree.context.history` / `chattree.context.messages` | No | `{ limit?: number }` | `{ messages: [{ role, content, timestamp }], count, maxLimit: 20, restricted, timestamp }` |

---

### ai.*

The `ai` namespace provides bounded access to single-turn LLM completions (`ai.context`) and on-device vector embeddings / semantic search (`ai.embeddings`).

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `ai.complete` / `ai.generate` / `ai.prompt` / `ai.context` | No | `{ prompt, systemPrompt?, maxTokens?, temperature?, timeoutMs? }` | `{ text, length }` |
| `ai.embed` / `ai.embeddings` | No | `{ text, type?: "document"\|"query" }` | `{ embedding: number[], dimensions }` |
| `ai.search` / `ai.rag_search` | No | `{ query, topK?, minScore? }` | `{ results: [...], count }` |
| `ai.index_document` / `ai.index` | No | `{ id, text (or content), title? }` | `{ indexed: boolean, sourceId, id }` |
| `ai.remove_document` / `ai.remove` | No | `{ id }` | `{ removed: boolean, sourceId, id }` |

#### Context Payload Specification

```json
{
  "api": "chattree.context",
  "operation": "read",
  "payload": {}
}
```

##### Successful Response (`success: true`)
```json
{
  "success": true,
  "data": {
    "currentMessage": "Can you summarize /myplugin notes.md for our weekly sync?",
    "explicitContext": {},
    "authorized": true,
    "restricted": false,
    "timestamp": "2026-10-18T18:20:00.000Z"
  }
}
```

#### Field Explanations

- **`currentMessage` (string):** The complete, untruncated text of the user prompt in which the plugin command was invoked. This allows tools to understand the conversational intent, natural language modifiers, and surrounding prompt context without granting access to the full historical chat tree.
- **`explicitContext` (object):** Scoped metadata map explicitly attached to the plugin's execution context (or `{}` when none).
- **`authorized` (boolean):** Indicates whether the active user has granted the `chattree.context.read` capability to the plugin.
- **`restricted` (boolean):** Evaluates to `true` if the conversation is running under restricted privacy mode. In restricted mode, `currentMessage` returns `""` and `explicitContext` returns `{}` even if authorized, preventing context leakage.
- **`timestamp` (string):** ISO-8601 timestamp when the context snapshot was created.

---

## `websocket` Namespace

The `websocket` namespace (`WebSocketApiHandler`) manages full-duplex WebSocket connections.

### Operations

#### `websocket.connect`
Establishes a WebSocket connection with pre-reserved socket quota to prevent race conditions.
- **Payload:**
  - `url` (string, required): Target `ws://` or `wss://` endpoint.
  - `headers` (object, optional): Custom headers for handshake.
  - `protocols` (string[], optional): Subprotocols requested.
  - `timeoutMs` (number, optional, default 15000): Connection handshake timeout in ms.
- **Response `data`:**
  - `socketId` (string): Unique identifier for this socket (e.g. `"ws_<pluginId>_1"`).
  - `connected` (boolean): `true`.
  - `url` (string): Endpoint connected to.
  - `protocol` (string | null): Negotiated subprotocol.

#### `websocket.send`
Sends a text or binary message over the active socket.
- **Payload:**
  - `socketId` (string, required): Identifier returned by `connect`.
  - `data` (string | number[], required): Text payload, byte array, or Base64-encoded string when `isBinary: true`.
  - `isBinary` (boolean, optional, default false): Set to `true` when sending binary data.
- **Response `data`:**
  - `sent` (boolean): `true` on successful dispatch.
  - `socketId` (string): The target socket ID.

#### `websocket.receive` / `websocket.poll`
Drains queued incoming messages from the in-memory socket buffer (up to 500 frames).
- **Payload:**
  - `socketId` (string, required): Identifier returned by `connect`.
  - `limit` (number, optional, default 500): Maximum messages to retrieve in one call (`1..500`).
- **Response `data`:**
  - `socketId` (string): The socket queried.
  - `messages` (array): Array of objects: `[{ "isBinary": boolean, "data": string }]`.
  - `count` (number): Number of messages drained.
  - `remainingInQueue` (number): Messages still queued in buffer.
  - `isOpen` (boolean): Whether the socket is still open.

#### `websocket.status` / `websocket.list`
Queries current connection state and memory buffer statistics.
- **Payload:**
  - `socketId` (string, optional): Specific socket to inspect. If omitted, lists all active sockets for the plugin.
- **Response `data` (with `socketId`):**
  - `{ "socketId": string, "url": string, "isOpen": boolean, "queueLength": number, "connectedAt": string }`
- **Response `data` (without `socketId`):**
  - `{ "activeSockets": [...], "count": number, "maxAllowed": 10 }`

#### `websocket.close`
Closes an active socket cleanly with optional status code and reason string.
- **Payload:**
  - `socketId` (string, required): Identifier returned by `connect`.
  - `code` (number, optional, default 1000): WebSocket close code.
  - `reason` (string, optional): Close reason string.
- **Response `data`:**
  - `closed` (boolean): `true`.
  - `socketId` (string): The socket closed.

---

## `ui` Namespace

The `ui` namespace (`UiApiHandler`) enables plugins to emit and validate structured interactive UI cards and alerts.

### Operations

#### `ui.render` / `ui.card` *(Async)*
Sanitizes and validates an interactive UI card payload.
- **Payload:**
  - `title` (string, optional): Card headline (max 100 chars).
  - `subtitle` (string, optional): Secondary caption (max 200 chars).
  - `badge` (string, optional): Header status badge text (max 30 chars).
  - `badgeColor` (string, optional): Header badge color (`green`/`success`, `orange`/`warning`, `red`/`danger`/`error`, `blue`/`info`, `purple`, `gray`/`grey`/`neutral`, `white`/`mono`/`primary`).
  - `icon` (string, optional): Header icon (`check`, `warning`, `error`, `info`, `shipping`, `payment`, `message`, `analytics`, `alarm`, `note`).
  - `hideText` (boolean, optional): When `true`, hides the plain-text intro bubble above the rendered card.
  - `elements` (array, required): Array of UI element objects (max 60 elements).
- **Supported Elements:**
  - `text`: `{ "type": "text", "content": "Hello" }` (max 4000 chars)
  - `badge`: `{ "type": "badge", "text": "OK", "color": "green" }` (`text` max 30 chars; `color` supports `green`, `orange`, `red`, `blue`, `purple`, `gray`, `grey`, `white`, `success`, `warning`, `error`, `info`, `neutral`, `mono`)
  - `progress`: `{ "type": "progress", "value": 0.75, "label": "CPU Load", "color": "blue" }` (`value` is `0.0..1.0`; percentages `1..100` are automatically normalized to `0.01..1.0`)
  - `key_value` (or `kv` alias): `{ "type": "key_value", "items": [{ "key": "Status", "value": "Active" }] }` (`label` is also accepted as an alias for `key`; max 40 items; `key` max 50 chars, `value` max 200 chars)
  - `list`: `{ "type": "list", "items": [{ "title": "Note Title", "subtitle": "Preview snippet..." }] }` (max 40 items; `title` max 100 chars, `subtitle` max 160 chars)
  - `divider`: `{ "type": "divider" }`
  - `button_row`: `{ "type": "button_row", "buttons": [{ "label": "Run", "action": "command", "value": "/mycommand", "style": "primary", "confirm": true }] }` (max 8 buttons; `action` is `"command"` | `"url"` | `"copy"`; `value`, `payload`, `command`, or `url` holds the target; `style` or `variant` is `"primary"` | `"secondary"` | `"danger"`)
- **Response `data`:**
  - `rendered` (boolean): `true`.
  - `pluginId` (string): The plugin ID.
  - `ui` (object): Sanitized UI card payload.

#### `ui.alert` / `ui.toast` *(Async)*
Displays a lightweight alert or toast message.
- **Payload:**
  - `message` (string, required): Alert text.
  - `title` (string, optional): Alert title.
  - `level` (string, optional): Severity level (`info`, `success`, `warning`, `error`; default `info`).
- **Response `data`:**
  - `type`: `"alert"`, `title`, `message`, `level`.

#### `ui.validate` *(Sync)*
Synchronously validates a UI card payload against schema and size limits without rendering.
- **Response `data`:** `{ "valid": true }`.

---

## `scheduler` Namespace

The `scheduler` namespace (`PluginTaskScheduler` / `SchedulerApiHandler`) registers recurring Cron, interval-based, and one-shot background tasks.

### Operations

#### `scheduler.schedule`
Schedules a recurring or one-shot task with anti-battery drain enforcement.
- **Payload:**
  - `targetAction` (string, required): Action or command name to dispatch when triggered (max 100 chars, `[a-zA-Z0-9_.:-]+`).
  - `taskId` (string, optional): Custom task identifier (replaces existing task with the same `taskId` if present).
  - `cronExpression` (string, optional): Supported 5-field Cron pattern (`*/N * * * *` every N minutes, `0 * * * *` hourly, `0 0 * * *` daily at midnight, or `M H * * *` daily at hour `H` and minute `M`).
  - `intervalMs` (number, optional): Recurrent interval in milliseconds (minimum `60000` ms / 60 seconds).
  - `scheduledAt` (string, optional): ISO-8601 timestamp for a one-shot task (e.g., `2026-11-15T15:30:00Z`).
  - `payload` (object, optional): Structured JSON payload dispatched with the event (max 128 KB).
- **Response `data`:**
  - `scheduled` (boolean): `true`.
  - `taskId` (string): Generated or supplied unique task ID.
  - `targetAction` (string): Registered target action.
  - `isPeriodic` (boolean): Whether the task recurs.
  - `intervalMs` (number, optional): Effective interval in ms.
  - `createdAt` (string): ISO-8601 creation timestamp.

#### `scheduler.cancel`
Cancels and removes an active scheduled task.
- **Payload:**
  - `taskId` (string, required): Task ID to cancel.
- **Response `data`:**
  - `cancelled` (boolean): `true`.
  - `taskId` (string): The cancelled task ID.

#### `scheduler.list` *(Sync & Async)*
Lists all active scheduled tasks for this plugin.
- **Payload:** `{}`
- **Response `data`:**
  - `tasks` (array): Array of registered task descriptors.
  - `count` (number): Total tasks registered.
  - `maxAllowed` (number): Maximum allowed active tasks per plugin (`25`).

#### `scheduler.status` *(Sync & Async)*
Retrieves the current state of a single scheduled task.
- **Payload:**
  - `taskId` (string, required): Task ID to inspect.
- **Response `data`:** Full task descriptor object.

---

## `database` Namespace

The `database` namespace (`PluginDatabaseManager` / `DatabaseApiHandler`) provides an isolated relational SQLite database (`plugin_<pluginId>.db`) with 200 MB quota and atomic transactions.

### Operations

#### `database.query`
Executes a SQL SELECT query returning rows.
- **Payload:**
  - `sql` (string, required): SQL query string (e.g. `SELECT * FROM items WHERE status = ?`).
  - `args` (array, optional): Positional query parameter bindings.
- **Response `data`:**
  - `rows` (array): Array of result row objects (up to 2,000 rows).
  - `count` (number): Number of returned rows.
  - `limit` (number): Maximum rows per query (`2000`).

#### `database.execute`
Executes a DDL or DML statement (`CREATE TABLE`, `INSERT`, `UPDATE`, `DELETE`).
- **Payload:**
  - `sql` (string, required): SQL statement string.
  - `args` (array, optional): Positional parameter bindings.
- **Response `data`:**
  - `executed` (boolean): `true`.
  - `result` (number): Last inserted row ID for `INSERT`, affected row count for `UPDATE`/`DELETE`, or `0` for DDL.

#### `database.insert` / `database.update` / `database.delete`
Structured table helpers with automatic boolean (`1`/`0`) and JSON normalization:
- `database.insert`: `{ "table": string, "values": object }` → `{ "inserted": true, "id": number, "table": string }`
- `database.update`: `{ "table": string, "values": object, "where"?: string, "whereArgs"?: any[] }` → `{ "updated": true, "affected": number, "table": string }`
- `database.delete`: `{ "table": string, "where"?: string, "whereArgs"?: any[] }` → `{ "deleted": true, "affected": number, "table": string }`

#### `database.transaction`
Executes an atomic batch transaction with automatic rollback if any statement fails.
- **Payload:**
  - `operations` (array, required): Array of `{ "sql": string, "args"?: any[] }`.
- **Response `data`:**
  - `transaction` (boolean): `true`.
  - `results` (array): Execution result per operation.
  - `operationCount` (number): Total statements executed.

#### `database.tables`
Inspects all user tables created within the plugin's private database.
- **Payload:** `{}`
- **Response `data`:**
  - `tables` (string[]): List of table names.
  - `count` (number): Number of tables.

---

## Output format from your WASM function

When your exported function finishes:
- **Universal ABI v2 (`chattree_dispatch`):** Return the packed 64-bit descriptor `(outPtr << 32) | outLen`.
- **Legacy ABI v1:** Write the response string to linear memory starting at **offset 1024** (or `outputOffset`) and return the **byte length** as `i32`.

### Supported output formats

**Plain text or Markdown** (simplest):
```
Hello, World!
```
Chattree wraps this in `ToolResult.direct(text)` and renders Markdown directly.

**Explicit JSON contract**:
```json
{ "type": "direct", "displayText": "Hello, World!" }
```

**Error output**:
```json
{ "type": "error", "errorMessage": "Something went wrong." }
```

**Permission denied output** (for plugins that detect missing permissions):
```json
{
  "type": "permissionDenied",
  "missingCapabilities": ["network.http"],
  "operation": "network.http_request"
}
```

**Declarative UI Card output (`"type": "ui"` or `"type": "direct"`)**:
```json
{
  "type": "ui",
  "displayText": "Task Summary",
  "ui": {
    "title": "System Monitor",
    "badge": "ONLINE",
    "badgeColor": "green",
    "elements": [
      { "type": "badge", "text": "HEALTHY", "color": "green" },
      { "type": "progress", "value": 0.45, "label": "CPU Load", "color": "blue" }
    ]
  }
}
```

**Generic success/error** (alternative form):
```json
{ "success": true, "message": "Done!" }
{ "success": false, "error": "Failed to connect." }
```
