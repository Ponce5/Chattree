# Daily Briefing (`com.chattree.official.briefing`)

Official **Daily Briefing** plugin for **Chattree**, compiled to WebAssembly (`WASM`). Combines today's device calendar events (`calendar.events`), pending reminders (`chattree.reminders`), unread emails (`email.inbox`), and live local weather (`network.http` via Open-Meteo — zero API key required) into a single morning summary card (`ui.components`), with automatic daily scheduling (`scheduler.cron`) and local alerts (`notifications.send`).

---

## Features

- **All-in-One Morning Digest (`/briefing`):** Aggregates today's calendar events, pending Chattree reminders, unread inbox count, your `"Daily"` Chattree note (`chattree.notes`), and current weather (temperature, high/low, condition) in one crisp blue Flutter UI card.
- **Daily Note Integration (`/briefing note <title>`):** Automatically reads and displays your Chattree note titled `"Daily"` (or any custom note title you choose) right inside your briefing card.
- **Zero API Key Weather (`/briefing city <name>`):** Uses Open-Meteo Geocoding & Forecast APIs over HTTPS with no API key required.
- **Automatic Daily Schedule (`/briefing schedule 08:00`):** Registers a recurring daily cron task via `scheduler.cron` and sends a local morning notification (`notifications.send`).
- **Graceful Fallbacks:** If email is not configured or a city hasn't been set yet, the briefing still renders all available sections cleanly without failing.

---

## Usage Examples

Invoke `/briefing` (or aliases `/morning`, `/resumen`, `/digest`):

- **Get today's briefing now:**
  ```text
  /briefing
  ```
- **Set your city for local weather:**
  ```text
  /briefing city Madrid
  ```
  Or in natural language: *"Set my briefing city to Mexico City"*
- **Schedule your automatic morning briefing:**
  ```text
  /briefing schedule 08:00
  ```
  Or in natural language: *"Schedule my daily briefing every morning at 7:30"*
- **Cancel automatic schedule:**
  ```text
  /briefing unschedule
  ```
- **Check configuration status / help:**
  ```text
  /briefing status
  /briefing help
  ```

---

## Permissions & Security

- `storage.private`: Saves your preferred city coordinates and daily schedule time locally on-device.
- `calendar.read`: Reads today's events from your device calendar.
- `chattree.reminders.read`: Reads pending Chattree reminders.
- `email.read`: Checks unread email count and recent subjects when email is configured.
- `network.http`: Connects exclusively to `api.open-meteo.com` and `geocoding-api.open-meteo.com` for weather.
- `scheduler.cron`: Schedules or cancels the recurring daily briefing task.
- `notifications.send`: Sends the morning briefing notification when triggered.
- `ui.components`: Renders interactive Flutter briefing cards in chat.
