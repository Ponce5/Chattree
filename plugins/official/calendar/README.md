<p align="center">
  <img src="icon.png" width="96" height="96" alt="Chattree Calendar Minimalist Icon" style="border-radius: 20%;" />
</p>

# Chattree Official Calendar Plugin (v1.2.4)

The **Chattree Official Calendar Plugin** provides a unified, intelligent calendar extension for Chattree. It consolidates all features under a single `/calendar` command with a minimalist calendar icon:

- **Empty Invocations (`/calendar`)**: Instantly inspects the device calendar and displays your scheduled agenda and upcoming meetings.
- **Conversational & AI-Driven Scheduling**: The AI of Chattree interprets your natural language (e.g. *"agenda una reunión con el equipo mañana a las 10:00 AM"*), computes the exact dates and times relative to today, and schedules the event directly in the phone's native calendar without requiring manual bars or rigid formatting.

---

## 1. Overview & Single-Command Architecture

- **Unified Slash Command**: Only one clean command in the slash palette: `/calendar`.
- **Query Agenda (`/calendar`)**: Without parameters, queries the device calendar via `calendar.events` and reports upcoming commitments.
- **Schedule Events (`/calendar ...`)**: The AI of Chattree extracts title, date, time, and description, and creates the calendar event via `calendar.create`.
- **Pure Natural Language**:
  - Empty: `/calendar` (shows agenda)
  - Natural conversation: `/calendar agenda una reunión con proveedores mañana a las 3pm`
  - Conversational request directly to AI: *"Programa una cita con el dentista el viernes a las 4 de la tarde"*
- **Standardized ToolResult Output**: Always returns native JSON (`{"type":"direct","displayText":"..."}`) allowing the AI to present real confirmation data seamlessly in the chat.
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

## 3. Command Specification

### Command: `/calendar`
**Alias:** `/cal`

#### Usage:
```text
/calendar                                  -> Muestra tu agenda y próximos eventos
/calendar <título>                         -> Crea una reunión con fechas automáticas
/calendar "Reunión de Diseño" | 2026-10-16T15:00:00Z | 2026-10-16T16:00:00Z
/calendar Cita Médica
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

### Step 2: Package as `.chattree-plugin`
Empaqueta los 4 archivos permitidos en un archivo ZIP renombrado a `.chattree-plugin`:
```bash
zip -9 calendar-v1.2.4.chattree-plugin plugin.json plugin.wasm icon.png README.md
```

> **Archivos permitidos:** `plugin.json`, `plugin.wasm`, `icon.png`, `README.md`. No incluir `logo.png` u otros archivos — el validador de Chattree los rechazará.

---

## 6. Installation & Deployment on Mobile

1. En Chattree, navega a **Ajustes → Plugins → Importar Plugin**.
2. Selecciona `calendar-v1.2.4.chattree-plugin`.
3. Acepta los permisos `calendar.create` y `calendar.read` cuando el sistema los solicite.
4. Dile a la IA: *"Agéndame una reunión con el equipo mañana a las 10 AM"*, o escribe `/calendar` para ver tu agenda al instante.
