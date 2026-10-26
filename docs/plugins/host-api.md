# ChattreeHostApi — Host API Reference

The **ChattreeHostApi** is the bridge between a WASM plugin and Chattree's internal services.
Your plugin communicates with it through a single imported function: `chattree.host_call`.

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
| `api` | string | ✅ | Namespace identifier (see table below) |
| `operation` | string | ✅ | Operation name within the namespace |
| `payload` | any | ✅ | Operation-specific parameters |

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

| Namespace | Description | Sync? | Capability Required |
|-----------|-------------|-------|---------------------|
| `core` | Plugin metadata and logging | ✅ Sync | None |
| `storage` | Private key-value store | ✅ Sync | `storage.private` (auto) |
| `network` | HTTP/HTTPS requests | ❌ Async | `network.http` |
| `files` | File pick / read / write | ❌ Async | `files.pick`/`files.read`/`files.write` |
| `notifications` | Local notifications | ❌ Async | `notifications.send` |
| `location` | GPS position | ❌ Async | `location.current` |
| `camera` | Photo capture | ❌ Async | `camera.capture` |
| `contacts` | Address book | ❌ Async | `contacts.read`/`.create`/`.update` |
| `calendar` | Device calendar | ❌ Async | `calendar.read`/`.create`/`.update`/`.delete` |
| `email` | Native IMAP/SMTP email & inbox | ❌ Async | `email.read`/`email.send` |
| `share` | Share sheet | ❌ Async | `share.text`/`share.file` |
| `open` | Launch URLs and apps | ❌ Async | `open.url`/`open.app` |
| `chattree.notes` | Chattree Notes CRUD | ❌ Async | `chattree.notes.*` |
| `chattree.reminders` | Chattree Reminders CRUD | ❌ Async | `chattree.reminders.*` |
| `chattree.context` | Current message context | ❌ Async | `chattree.context.read` |

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
| `core.get_manifest` | ✅ | `{}` | `{ id, version, name, description, author, runtimeApiVersion }` |
| `core.log` | ✅ | `{ level: "info"\|"warning"\|"error", message: string }` | `{ logged: true, level }` |

`core.log` messages appear in Flutter debug logs prefixed with `[Plugin:<id>]`.

---

### storage.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `storage.set` | ✅ | `{ key, value }` | `{ stored: true, key, value }` |
| `storage.get` | ✅ | `{ key }` | `{ value: string\|null, exists: boolean }` |
| `storage.delete` | ✅ | `{ key }` | `{ deleted: boolean, key }` |
| `storage.has` | ✅ | `{ key }` | `{ exists: boolean, key }` |
| `storage.keys` | ✅ | `{}` | `{ keys: string[], count: number }` |

---

### network.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `network.http_request` | ❌ | `{ url, method?, headers?, body? }` | `{ statusCode, headers, body }` |

---

### files.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `files.pick` | ❌ | `{ allowedExtensions?, title? }` | `{ cancelled, handle, name, size, extension, mimeType }` |
| `files.read` | ❌ | `{ handle, asText? }` | `{ handle, name, size, encoding, content }` |
| `files.write` | ❌ | `{ name, content, encoding? }` | `{ name, size, written, handle }` |

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

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `notifications.send` | ❌ | `{ title, body? }` | `{ notificationId, sent, remainingQuota }` |
| `notifications.cancel` | ❌ | `{ notificationId }` | `{ notificationId, cancelled }` |

---

### location.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `location.current` | ❌ | `{ accuracy? }` | `{ latitude, longitude, accuracy, timestamp, provider }` |
| `location.permission_status` | ❌ | `{}` | `{ serviceEnabled, permission, isGranted, isDeniedForever }` |

---

### camera.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `camera.capture` | ❌ | `{ preferredCamera?, quality? }` | `{ cancelled, handle, name, size, mimeType }` |

---

### contacts.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `contacts.get` | ❌ | `{ query?, limit? }` | `{ contacts: [...] }` |
| `contacts.search` | ❌ | `{ query, limit? }` | `{ contacts: [...] }` |
| `contacts.create` | ❌ | `{ displayName, phones?, emails? }` | `{ id, displayName, created }` |
| `contacts.update` | ❌ | `{ id, displayName?, phones?, emails? }` | `{ id, updated }` |

---

### calendar.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `calendar.calendars` | ❌ | `{}` | `{ calendars: [...] }` |
| `calendar.events` | ❌ | `{ calendarId, startDate, endDate }` | `{ events: [...] }` |
| `calendar.create` | ❌ | `{ calendarId, title, startDate, endDate, description? }` | `{ eventId, created }` |
| `calendar.update` | ❌ | `{ calendarId, eventId, ...fields }` | `{ updated }` |
| `calendar.delete` | ❌ | `{ calendarId, eventId }` | `{ deleted }` |

---

### email.*

The `email` namespace provides native IMAP and SMTP connectivity with TLS/SSL encryption for reading inboxes, inspecting message content, and sending emails.

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `email.config` | ❌ | `{ email, password, imapHost?, imapPort? }` | `{ configured: true, email, provider, message }` |
| `email.inbox` | ❌ | `{}` | `{ status: "success", account, unread_count, total_count, emails: [...] }` |
| `email.read` | ❌ | `{ id }` | `{ id, from, to, subject, date, body }` |
| `email.send` | ❌ | `{ to, subject, body }` | `{ sent: true, to, subject, response }` |
| `email.disconnect` | ❌ | `{}` | `{ disconnected: true, message }` |

---

### share.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `share.text` | ❌ | `{ text, subject? }` | `{ shared: true, type: "text" }` |
| `share.file` | ❌ | `{ handle, text? }` | `{ shared: true, type: "file", handle, fileName }` |

---

### open.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `open.url` | ❌ | `{ url }` | `{ opened: boolean, url }` |
| `open.app` | ❌ | `{ uri }` | `{ opened: boolean, target }` |

---

### chattree.notes.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `chattree.notes.search` | ❌ | `{ query, limit? }` | `{ notes: [...], count }` |
| `chattree.notes.get` | ❌ | `{ id }` | `{ note: { id, title, content, createdAt, updatedAt } }` |
| `chattree.notes.create` | ❌ | `{ title, content? }` | `{ note: { id, title, content, createdAt, updatedAt } }` |
| `chattree.notes.update` | ❌ | `{ id, title?, content? }` | `{ note: { ... } }` |
| `chattree.notes.delete` | ❌ | `{ id }` | `{ deleted: true, id }` |

---

### chattree.reminders.*

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `chattree.reminders.list` | ❌ | `{ limit? }` | `{ reminders: [...], count }` |
| `chattree.reminders.get` | ❌ | `{ id }` | `{ reminder: { ... } }` |
| `chattree.reminders.create` | ❌ | `{ title, scheduledAt? }` | `{ reminder: { ... } }` |
| `chattree.reminders.update` | ❌ | `{ id, title?, scheduledAt? }` | `{ reminder: { ... } }` |
| `chattree.reminders.delete` | ❌ | `{ id }` | `{ deleted: true, id }` |
| `chattree.reminders.complete` | ❌ | `{ id }` | `{ completed: true, id }` |

---

### chattree.context.*

The `chattree.context.read` operation allows a plugin to inspect the conversational invocation context.

| Operation | Sync | Input | Output |
|-----------|------|-------|--------|
| `chattree.context.read` | ❌ | `{}` | `{ currentMessage, explicitContext, authorized, restricted, timestamp }` |

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
    "explicitContext": "notes.md",
    "authorized": true,
    "restricted": false,
    "timestamp": 1729278000000
  }
}
```

#### Field Explanations

- **`currentMessage` (string):** The complete, untruncated text of the user prompt in which the plugin command was invoked. This allows tools to understand the conversational intent, natural language modifiers, and surrounding prompt context without granting access to the full historical chat tree.
- **`explicitContext` (string):** The specific string argument passed directly after the slash command. For example, if the prompt is `Please run /calendar schedule team standup tomorrow`, `explicitContext` will contain strictly `"schedule team standup tomorrow"`, while `currentMessage` contains the entire sentence.
- **`authorized` (boolean):** Indicates whether the active user has granted the `chattree.context.read` capability to the plugin. If the user revokes or declines this permission, `authorized` is `false`, and `currentMessage` and `explicitContext` return empty strings (`""`).
- **`restricted` (boolean):** Evaluates to `true` if the conversation is running under restricted privacy mode (e.g., incognito chats, ephemeral trees, or system prompts containing confidential keys). In restricted mode, external plugins cannot inspect surrounding text even if authorized, preventing context leakage.
- **`timestamp` (number):** Unix epoch timestamp in milliseconds when the message was dispatched by the user.

---

## Output format from your WASM function

When your exported function finishes, it must:

1. Write the response string to linear memory starting at **offset 1024**.
2. Return the **byte length** of the response as `i32`.

### Supported output formats

**Plain text** (simplest):
```
Hello, World!
```
Chattree wraps this in `ToolResult.direct(text)`.

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

**Generic success/error** (alternative form):
```json
{ "success": true, "message": "Done!" }
{ "success": false, "error": "Failed to connect." }
```
