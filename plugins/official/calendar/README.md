# Chattree Calendar Plugin

The **Official Calendar Plugin** provides local, on-device integration with the Android system calendar. It allows users and the Chattree conversational AI to schedule, inspect, and manage calendar events through natural language and slash commands.

---

## Features

- **Direct Slash Command:**
  - Create event: `/calendar <event title>` (e.g. `/calendar Dentista`)
  - Create with exact date/time: `/calendar <event title> | <ISO startDate>` (e.g. `/calendar Reunión en Teams | 2026-10-22T09:40:00`)
  - Create via JSON payload: `/calendar {"title": "Reunión", "startDate": "2026-10-22T09:40:00"}`
  - List events: `/calendar list`
- **Conversational AI Tool Integration (`intentContract`):**
  - Declares an `intentContract` for intent `calendar_create` with fields `TITLE`, `START_DATE` (ISO-8601), and `DURATION`.
  - When you say *"Reunión hoy a las 9:40"* or *"Agéndame una reunión en Teams mañana a las 10 am"*, the AI automatically resolves the future date/time into ISO-8601 and invokes the plugin with the structured parameters.
- **Privacy & Sandboxing:**
  - Operates inside the WebAssembly linear-memory sandbox.
  - Requires explicit user authorization via `calendar.create` and `calendar.read` capabilities.
  - Zero cloud telemetry; events are created directly in your device's local calendar provider.

---

## Required Capabilities

| Capability | Tier | Reason |
|---|---|---|
| `calendar.create` | Sensitive | Allows scheduling and writing new events into the device calendar. |
| `calendar.read` | Sensitive | Allows reading upcoming events from the device calendar. |

---

## Package Structure

```text
plugins/official/calendar/
├── icon.png           # 512x512 Pure black icon with white calendar glyph
├── banner.png         # 1200x630 Pure black cover banner with white typography
├── plugin.json        # Schema-validated manifest (v1.4.0)
├── plugin.wat         # WebAssembly Text format source
├── plugin.wasm        # Compiled WebAssembly binary
└── README.md          # Plugin documentation
```

---

## How to Package & Install

### 1. Validate the Plugin
```bash
node tools/validate-plugin.mjs plugins/official/calendar/
```

### 2. Package into `.chattree-plugin`
```bash
node tools/package-plugin.mjs plugins/official/calendar/
```

### 3. Install in the Chattree App
1. Transfer `calendar-v1.4.0.chattree-plugin` to your device.
2. In Chattree, navigate to **Settings → Plugins → Import plugin**.
3. Select the file, review the `calendar.create` and `calendar.read` capabilities, and confirm installation.
