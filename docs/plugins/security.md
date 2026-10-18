# Security — Plugin Sandbox Model

Chattree's WASM plugin runtime is designed with security as a first-class concern.
This document explains the sandbox model and what plugins can and cannot do.

---

## Isolation guarantees

A WASM plugin runs inside a **WebAssembly linear memory sandbox**.

### What a plugin cannot do

| Access | Status |
|--------|--------|
| Native filesystem paths | ❌ Blocked |
| Operating system sockets / raw TCP | ❌ Blocked |
| SharedPreferences / SQLite directly | ❌ Blocked |
| Other plugins' private data | ❌ Blocked |
| Full chat history | ❌ Blocked |
| AI model context / prompts | ❌ Blocked |
| Dart VM heap or native objects | ❌ Blocked |
| Device hardware without a capability | ❌ Blocked |
| Private IPs / loopback addresses | ❌ Blocked (SSRF protection) |
| `file://`, `javascript:`, `intent:` URIs | ❌ Blocked |
| Spawning background threads or processes | ❌ Blocked |
| Persisting data without `storage.private` | ❌ Blocked |
| Running indefinitely (no timeout) | ❌ Blocked |
| Consuming unlimited CPU (no fuel limit) | ❌ Blocked |
| Consuming unlimited memory | ❌ Blocked |

### What a plugin can do

Only what is **explicitly granted by the user through capabilities**:

- Access its own isolated key-value storage.
- Make HTTP/HTTPS requests to public internet servers.
- Display local notifications.
- Read/write files through the user's explicit file-picker selection.
- Get a one-shot GPS position.
- Capture a photo through the system camera UI.
- Read/write/delete the user's Chattree notes and reminders.
- Read the current message context.
- Open URLs or other apps.

---

## Capability enforcement

Every capability is checked by `PermissionGateway` before any operation runs:

```
WASM calls host_call("chattree.notes", "create", {...})
    ↓
PermissionGateway.hasCapability(pluginId, "chattree.notes.create")
    ↓ denied?
HostApiResponse.error("permissionDenied", missingCapabilities: [...])
    ↓ granted?
NotesApiHandler._handleCreate(...)
```

The `pluginId` is **always injected by the runtime** — the plugin cannot forge it.

---

## Memory limits

| Resource | Default | Configurable? |
|----------|---------|---------------|
| WASM linear memory | 16 MB | Yes — `maxMemoryPages` in manifest |
| Execution timeout | 5 seconds | Yes — `timeoutMs` (max 5000) |
| CPU fuel | 50 000 000 instructions | Yes — `fuelLimit` |
| Async iterations | 10 round-trips | No |
| Max concurrent HTTP per plugin | 2 | No |
| HTTP request body | 64 KB | No |
| HTTP response body | 128 KB | No |
| Notification rate | 5 per session | No |
| File read limit | 4 MB | No |
| File write limit | 2 MB | No |
| Note content max | 50 000 chars | No |
| Storage key max | 300 chars (by convention) | No |

---

## Path traversal protection

File operations use **opaque handles** instead of real paths:

- `files.pick` returns a `handle` (e.g. `f_a1b2c3...`).
- `files.read` accepts only a handle, never a path string.
- `files.write` saves to the plugin's private sandbox — path is determined by Chattree.
- A handle can only be used by the plugin that created it.

This completely prevents path traversal (`../`) attacks.

---

## SSRF protection (network)

The `network.http_request` operation blocks:

- `localhost`, `127.0.0.1`, `::1`, `0.0.0.0`
- `*.localhost`, `*.local`, `*.internal`, `*.lan`, `*.home`, `*.corp`
- RFC 1918 private ranges: `10.x.x.x`, `172.16–31.x.x`, `192.168.x.x`
- Link-local: `169.254.x.x`
- Carrier-grade NAT: `100.64–127.x.x`
- IPv6 unique local (`fc00::/7`) and link-local (`fe80::/10`)
- DNS resolution is checked to prevent DNS rebinding attacks.

Only public internet addresses resolve.

---

## URL and URI safety

The `open.url` operation blocks these schemes:

- `file://` — local filesystem access
- `javascript:` — code injection
- `content://` — Android content provider direct access
- `intent://` — Android intent exploitation
- `blob:` — blob URL exploitation
- `data:` — data URL injection
- `chrome://`, `about:` — browser internals

Only `https://` and `http://` are allowed for `open.url`.

---

## What a plugin MUST NOT do

Beyond technical enforcement, these are **behavioral requirements**:

1. **Do not store sensitive data unnecessarily** — if you read a note or a contact,
   don't save it to `storage.private` unless the user explicitly requested it.

2. **Do not exfiltrate data** — do not send user's notes, contacts, or reminders
   to an external server without an obvious, explicit user action.

3. **Do not abuse notifications** — use them only for genuinely useful alerts,
   not to spam the user.

4. **Do not claim capabilities you don't need** — only declare the minimum
   capabilities required. Users will see the full list in the permission dialog.

5. **Do not loop indefinitely** — plugins have a fuel limit. Infinite loops will
   be terminated.

6. **Do not store API keys in plaintext** — use `isSecret: true` in settings
   definitions; Chattree will obscure them in the UI.

---

## Android and iOS platform limits

Some capabilities depend on OS-level permissions that **Chattree itself must have**
in its `AndroidManifest.xml` or iOS `Info.plist`. These are pre-configured:

| Capability | Android permission | iOS Info.plist key |
|---|---|---|
| `location.current` | `ACCESS_FINE_LOCATION` | `NSLocationWhenInUseUsageDescription` |
| `camera.capture` | `CAMERA` | `NSCameraUsageDescription` |
| `contacts.read` | `READ_CONTACTS` | `NSContactsUsageDescription` |
| `contacts.create` | `WRITE_CONTACTS` | `NSContactsUsageDescription` |
| `calendar.read` | `READ_CALENDAR` | `NSCalendarsUsageDescription` |
| `calendar.create` | `WRITE_CALENDAR` | `NSCalendarsUsageDescription` |
| `notifications.send` | `POST_NOTIFICATIONS` (Android 13+) | — |

A plugin cannot access these features if the OS-level permission is denied.
Chattree will report the OS denial clearly in the Host API error response.

> iOS Note: Camera, location, calendar, and contacts capabilities have NOT been
> tested on a physical iOS device. Android (tested on Motorola Edge 30) is the
> primary supported platform.

---

## Summary for plugin developers

> **Your plugin runs in a strict, auditable sandbox.**  
> Every access to user data or device hardware requires a capability listed in
> your `plugin.json` AND accepted by the user.  
> The user can revoke permissions at any time.  
> Chattree verifies your WASM binary's SHA-256 before execution.  
> No background execution, no persistent processes, no raw system access.
