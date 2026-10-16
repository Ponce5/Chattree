<p align="center">
  <img src="logo.png" width="720" alt="Chattree Calendar Logo" style="border-radius: 12px; margin-bottom: 16px;" />
</p>

<p align="center">
  <img src="icon.png" width="96" height="96" alt="Chattree Calendar Minimalist Icon" style="border-radius: 20%;" />
</p>

# Chattree Official Calendar Plugin (v1.1.0)

The **Chattree Official Calendar Plugin** empowers Chattree's on-device AI assistant and users to schedule, manage, and query native calendar events directly on Android (`CalendarContract`) and iOS (`EventKit`) through conversational chat interactions and slash commands.

---

## 1. Overview & 100% AI Integration

This plugin bridges conversational intelligence with the physical device's calendar database inside an isolated WebAssembly sandbox:

- **100% Conversational AI Support**: When a user says *"créame una reunión con el equipo mañana a las 10:00 AM para revisar el presupuesto"*, Chattree's AI assistant executes the calendar action via the plugin tool, extracting the title, start date, and end date directly without canned or static automated messages.
- **Direct & Flexible Syntax**: Accepts conversational phrases, pipe-delimited parameters, and direct JSON function payloads:
  - Natural / Direct: `/calendar Reunión de Producto | 2026-10-16T15:00:00Z | 2026-10-16T16:00:00Z | Discutir roadmap`
  - Quick Meeting Command: `/reunion Reunión con proveedores`
  - Function Calling JSON: `{"title":"Reunión","startDate":"2026-10-16T10:00:00Z","endDate":"2026-10-16T11:00:00Z"}`
- **Automated Fallback & Time Normalization**: If the user or AI specifies an event title without dates, the plugin automatically provides valid default ISO timestamps for the upcoming hour, ensuring the host calendar API never rejects the event.
- **Standardized ToolResult Output**: Returns clean, native `ToolResult` JSON (`{"type":"direct","displayText":"..."}`) allowing the AI to present real confirmation data seamlessly in the chat.
- **Privacy & Local Execution**: Scheduling occurs directly on-device via `ChattreeHostApi`. No private schedule data leaves the phone.

---

## 2. Capabilities & Permissions

Declared in [`plugin.json`](./plugin.json):

| Capability | Tier | Category | Purpose |
|---|---|---|---|
| `calendar.create` | 🟡 Sensitive | Device | Creates events in the device default or specified calendar. |
| `calendar.read` | 🟡 Sensitive | Device | Queries available calendar accounts and inspects event schedules. |
| `calendar.update` | 🟡 Sensitive (Optional) | Device | Modifies existing calendar entries upon request. |
| `calendar.delete` | 🟡 Sensitive (Optional) | Device | Removes events upon explicit user instruction. |

> **User Consent:** Categorized under the **Sensitive** tier; Chattree requests user consent upon first invocation.

---

## 3. Command & Tool Specifications

### Primary Command: `/calendar`
**Aliases:** `/cal`, `/schedule`, `/evento`, `/reunion`, `/meeting`, `/cita`, `/agenda`, `/agendar`

#### Syntax Patterns:
```text
/calendar <título> | <fecha_inicio_ISO> [| <fecha_fin_ISO>] [| <descripción>]
/calendar add <título> | <fecha_inicio_ISO>
/reunion <título> [| <fecha_inicio_ISO>]
/calendar-list <fecha_inicio> <fecha_fin>
```

#### Examples:
```text
/calendar Reunión de Diseño | 2026-10-16T15:00:00Z | 2026-10-16T16:00:00Z | Discutir arquitectura UI
/reunion Revisión de sprint con equipo móvil
/calendar add Dentista | 2026-10-20T09:30:00Z
```

---

## 4. Host API Communication Protocol

The plugin interacts with Chattree through the imported `chattree.host_call` function:

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
    "startDate": "2026-10-16T15:00:00Z",
    "endDate": "2026-10-16T16:00:00Z",
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
    "created": true
  },
  "error": null
}
```

When completed, Chattree calls `resume(resPtr, resLen)`. The plugin formats a `ToolResult` payload written to linear memory offset `1024`:
```json
{
  "type": "direct",
  "displayText": "✅ Reunión agendada con éxito en el calendario."
}
```

---

## 5. Building, Testing & Packaging

### Prerequisites
- [wabt](https://github.com/WebAssembly/wabt) (`wat2wasm`)
- Node.js (for testing and cryptographic hash verification)

### Step 1: Compile WebAssembly
```bash
wat2wasm plugin.wat -o plugin.wasm
```

### Step 2: Run Automated Tests
```bash
node ../../../scripts/test_calendar_wasm.js
```

### Step 3: Package as `.chattree-plugin`
```bash
node -e "
const fs = require('fs');
const { zipSync } = require('../../../Web/node_modules/fflate');
const zip = zipSync({
  'plugin.json': fs.readFileSync('plugin.json'),
  'plugin.wasm': fs.readFileSync('plugin.wasm'),
  'icon.png': fs.readFileSync('icon.png')
});
fs.writeFileSync('calendar-v1.1.0.chattree-plugin', zip);
fs.writeFileSync('calendar.chattree-plugin', zip);
"
```

---

## 6. Installation & Deployment on Mobile

1. In Chattree on your device, navigate to **Settings → Plugins → Import Plugin**.
2. Select `calendar-v1.1.0.chattree-plugin`.
3. Accept the `calendar.create` and `calendar.read` permissions.
4. Tell the AI assistant: *"Créame una reunión con el equipo mañana a las 10 AM"* or type `/calendar` to schedule events instantly.
