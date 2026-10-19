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
- No size limit per key, but total storage is limited by device.
- Data persists across plugin reinstalls (tied to plugin ID).

**Example:**
```

---

### 🟢 canvas.render

**Category:** UI / Visual  
**Status:** ✅ Available (Phase 3G+)  
**Permission required:** None (granted automatically — core visual sandbox capability)  
**Host API namespace:** `canvas`

Grants access to Chattree's **native interactive visual canvas engine**. Enables plugins to render high-impact 1080×1080 slide presentations, interactive metric cards, and theme-accented components directly into the conversation feed without external webviews.

**Operations:**

| Operation | Input | Output |
|-----------|-------|--------|
| `canvas.render_slide` | `{ title, badge?, paletteName?, primaryColor?, backgroundColor?, surfaceColor?, metric?, metricLabel?, code? }` | `{ rendered: true, slideId, title, dimensions: "1080x1080" }` |
| `canvas.create_slide` | Alias for `canvas.render_slide` | `{ rendered: true, slideId, title, dimensions: "1080x1080" }` |
| `canvas.render_card` | `{ title, subtitle?, badge?, metrics: [...], codeSnippet? }` | `{ rendered: true, cardId, title }` |
| `canvas.export_png` | `{ slideId?, targetWidth?: 1080, targetHeight?: 1080 }` | `{ ready: true, exportUrl, width, height }` |
| `canvas.get_capabilities` | `{}` | `{ supportedFormats: ["1:1", "16:9", "4:5"], hardwareAccelerated: true, maxResolution: "4K" }` |

**Limitations & Features:**
- Native client-side rendering with Flutter widgets and smooth animations.
- Preserves clean copyable TSX source code and social media copy.
- Interactive share sheet integration for instant social sharing.

**Example:**
```json
{
  "api": "canvas",
  "operation": "render_slide",
  "payload": {
    "title": "Arquitectura de IA 2026",
    "badge": "TECH & ARCHITECTURE",
    "paletteName": "Cyberpunk Obsidian",
    "primaryColor": "#00F0FF",
    "backgroundColor": "#0A0A0F",
    "surfaceColor": "#12121E",
    "metric": "99.8%",
    "metricLabel": "Latencia submilisegundo",
    "code": "export const Slide1 = () => <div ... />;"
  }
}
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
| `network.http_request` | `{ url, method?, headers?, body? }` | `{ statusCode, headers, body }` |

**Input fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | ✅ | Full HTTPS/HTTP URL |
| `method` | string | ❌ | `GET` (default), `POST`, `PUT`, `DELETE` |
| `headers` | object | ❌ | Custom headers (hop-by-hop headers are stripped) |
| `body` | string | ❌ | Request body (max 64 KB) |

**Limitations:**
- Only `http` and `https` schemes allowed.
- Loopback, private LAN, link-local addresses blocked (SSRF protection).
- Max request body: 64 KB. Max response body: 128 KB.
- Timeout: 10 seconds.
- Max concurrent requests per plugin: 2.
- Allowed methods: GET, POST, PUT, DELETE only.

**Possible errors:**
- `Permiso denegado` — capability not granted
- `Protocolo no permitido` — non-HTTP scheme
- `Acceso bloqueado` — private/local IP blocked
- `Método HTTP no permitido` — unsupported method
- `La respuesta HTTP excedió el tamaño máximo` — response > 128 KB
- `Tiempo de espera agotado` — timeout

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
- Rate limit: **5 notifications per plugin per session**.
- A plugin can only cancel its own notifications.
- Android only (iOS not yet tested on physical hardware).

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
**Limitations:** Max 4 MB per file. Handle must belong to the calling plugin.

**Possible errors:**
- `Handle invalido o expirado` — call `files.pick` first
- `Archivo supera el limite de lectura` — file > 4 MB
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
**Limitations:** Max 2 MB per file. Path traversal (`../`) blocked.

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

**Limitations:** Max 4000 characters.

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

## Not yet available from WASM

These capabilities are registered in the system but not yet routed through the WASM runtime:

| Capability | Status |
|---|---|
| `chat.history.read` | 🔒 Prepared — not yet available |
| `ai.context` | 🔒 Prepared — not yet available |
| `ai.embeddings` | 🔒 Prepared — not yet available |

Do not declare these in `plugin.json` — Chattree will reject plugins that request
capabilities that cannot be fulfilled.
