# Chattree Calendar Plugin

The **Official Calendar Plugin** provides local, on-device integration with the Android system calendar. It allows users and the Chattree conversational AI to schedule, inspect, and manage calendar events through natural language and slash commands.

---

## Features

- **Direct Slash Command:**
  - Create event: `/calendar <event title>` (e.g. `/calendar Dentista mañana a las 4pm`)
  - List events: `/calendar list`
- **Conversational AI Tool Integration:**
  - Registered as `calendar.create` and `calendar.list` in Chattree's tool registry.
  - When you say *"Agéndame una reunión con Carlos mañana a las 10 am"*, the AI invokes this plugin's tool with the structured parameters.
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
├── plugin.json        # Schema-validated manifest
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
1. Transfer `com.chattree.official.calendar-v1.0.0.chattree-plugin` to your device.
2. In Chattree, navigate to **Settings → Plugins → Import plugin**.
3. Select the file, review the `calendar.create` and `calendar.read` capabilities, and confirm installation.
