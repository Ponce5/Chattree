# Chattree Official Calendar Plugin

The **Chattree Official Calendar Plugin** enables the on-device AI assistant and conversational slash commands to schedule, manage, and query events directly in the smartphone's native device calendar (Android `CalendarContract` and iOS `EventKit`).

---

## 1. Overview & Use Cases

This plugin bridges the conversational intelligence of Chattree with the physical device's calendar database, running inside an isolated WebAssembly sandbox:

- **AI-Driven Scheduling**: Users can converse naturally in chat (e.g. *"Agenda una reunión con el equipo mañana a las 10:00 AM para revisar el presupuesto"*). Chattree's intent router formats the parameters and invokes the calendar plugin.
- **Direct Slash Commands**: Power users can use `/calendar` or `/calendar-add` to create events quickly from the chat interface without switching apps.
- **Privacy & Local Execution**: Event scheduling happens directly on the device through the `ChattreeHostApi`. No calendar data, titles, or dates are relayed to external cloud proxies.

---

## 2. Capabilities & Permissions

This plugin requires explicit, scoped capabilities declared in [`plugin.json`](./plugin.json):

| Capability | Tier | Category | Purpose |
|---|---|---|---|
| `calendar.create` | 🟡 Sensitive | Device | Allows creating new events in the default or specified calendar. |
| `calendar.read` | 🟡 Sensitive | Device | Reads available calendar accounts and checks for schedule conflicts. |
| `calendar.update` | 🟡 Sensitive (Optional) | Device | Allows editing existing calendar events. |
| `calendar.delete` | 🟡 Sensitive (Optional) | Device | Allows removing events upon explicit user instruction. |

> **User Consent Prompt:** Because calendar operations are categorized under the **Sensitive** tier, Chattree prompts the user for explicit permission upon the first invocation.

---

## 3. Command & Tool Specifications

### Primary Slash Command: `/calendar`
Aliases: `/cal`, `/schedule`, `/evento`

#### Syntax:
```text
/calendar add <title> | <startDate> [| <endDate>] [| <description>]
/calendar list <startDate> <endDate>
```

#### Examples:
```text
/calendar add "Reunión de Diseño" | 2026-10-15T15:00:00Z | 2026-10-15T16:00:00Z | "Discutir arquitectura UI"
/calendar add "Dentista" | 2026-10-20T09:30:00Z
/calendar list 2026-10-15T00:00:00Z 2026-10-15T23:59:59Z
```

---

## 4. Host API Communication Protocol

The plugin interacts with the host app through the imported `chattree.host_call` function:

```wat
(import "chattree" "host_call"
  (func $host_call (param i32 i32 i32 i32) (result i32))
)
```

### Request Payload (`calendar.create`):
```json
{
  "api": "calendar",
  "operation": "create",
  "payload": {
    "calendarId": "primary",
    "title": "Reunión de Diseño",
    "startDate": "2026-10-15T15:00:00Z",
    "endDate": "2026-10-15T16:00:00Z",
    "description": "Discutir arquitectura UI"
  }
}
```

### Response Payload:
```json
{
  "success": true,
  "data": {
    "eventId": "cal_evt_98412",
    "created": true,
    "calendarName": "Personal"
  },
  "error": null
}
```

Because calendar interactions involve asynchronous OS permissions and I/O, `host_call` returns `0` immediately. When the system completes the operation, Chattree invokes the plugin's exported `resume(resPtr, resLen)` callback with the result.

---

## 5. Building & Packaging

### Prerequisites
- [wabt (WebAssembly Binary Toolkit)](https://github.com/WebAssembly/wabt) installed (`wat2wasm`).

### Step 1: Compile WebAssembly
```bash
wat2wasm plugin.wat -o plugin.wasm
```

### Step 2: Compute SHA-256 Hash
- **Linux/macOS:**
  ```bash
  sha256sum plugin.wasm
  ```
- **Windows (PowerShell):**
  ```powershell
  (Get-FileHash -Algorithm SHA256 .\plugin.wasm).Hash.ToLower()
  ```

Update the `"wasmSha256"` field in [`plugin.json`](./plugin.json) with this 64-character hash.

### Step 3: Package as `.chattree-plugin`
All files must be at the root of the ZIP archive:

- **Linux / macOS:**
  ```bash
  zip calendar.chattree-plugin plugin.json plugin.wasm
  ```
- **Windows (PowerShell):**
  ```powershell
  Compress-Archive -Path plugin.json, plugin.wasm -DestinationPath calendar.zip
  Rename-Item calendar.zip calendar.chattree-plugin
  ```

---

## 6. Testing & Deployment on Mobile

### Option A: Via ADB (Fastest for Developers)
1. Enable USB Debugging on your Android test phone.
2. Push the package directly to device storage:
   ```bash
   adb push calendar.chattree-plugin /sdcard/Download/
   ```
3. In Chattree on your phone:
   - Navigate to **Settings → Plugins → Import Plugin**.
   - Select `calendar.chattree-plugin` from your Downloads.
   - Accept the requested `calendar.create` permission when prompted.

### Option B: Chattree Marketplace
Submit the package through the Chattree Developer Portal or submit directly to the official catalog.
