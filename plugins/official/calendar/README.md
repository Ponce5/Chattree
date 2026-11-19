# Chattree Calendar Plugin (v1.9.5)

Official on-device Calendar integration (`com.chattree.official.calendar`) for Chattree, using the device calendar as the single source of truth with exact date-filtered factual text responses for queries and English Flutter UI cards showing the exact calendar name for `/calendar` and event creation.

## What Changed in v1.9.5

1. **Matching Event Times**: /calendar now shows the same hours as Google Calendar (works together with the Chattree app update that reads event instants in the device local time).

## Previously in v1.9.4

1. **Correct Event Hours**: Added varied morning/afternoon/noon examples and an explicit local wall-clock rule so the AI uses the exact hour the user said (10 AM stays 10:00, never copied from an example or time-zone shifted).

## Previously in v1.9.3

1. **Exact Calendar Visibility**:
   - Displays the resolved Android/Google calendar name on both the `Upcoming Events` subtitle and as a `Calendar` row in `Event Scheduled` so users always know exactly which calendar holds their events.
2. **Single Source of Truth & Exact Day/Range Filtering**:
   - Date-only (`YYYY-MM-DD`) and start-only `events` queries are automatically normalized to exact day bounds (`00:00:00` to `23:59:59`) so asking about a specific day (e.g., today or tomorrow) never spills into the host's default 37-day window (`-7d..+30d`).
   - Responses display the exact queried date or range (`Calendar events for YYYY-MM-DD (N):` / `No events found for YYYY-MM-DD.`) with verbatim device calendar entries (`type: "direct"` plain text, 0% hallucination, 0 extra LLM tokens).
   - Aligned `calendar.events` to resolve the same default writable `calendarId` via `calendar.calendars` used by `calendar.create`.
2. **Token & Performance Optimization**:
   - Compacted `plugin.json` tool descriptions, `intentContract`, fields, and examples to reduce prompt token usage on every chat turn.
   - Zero `ai.complete` calls on UI cards and conversational event queries/edits.
3. **All Predefined UI Copy & Action Button Labels in English**:
   - Action buttons display clean English action names (`View Events`, `Refresh`, `Retry`) instead of raw slash commands.

## Usage

- `/calendar` — Show upcoming device calendar events in a Flutter UI card.
- Natural language — Ask to schedule, list, update, or delete events in any language.
- Pipe format — `/calendar Title | YYYY-MM-DDTHH:mm:ss | YYYY-MM-DDTHH:mm:ss | Optional description`
- `/calendar help` — Concise usage guide.

## Capabilities

- `calendar.read`, `calendar.create`, `calendar.update`, `calendar.delete`
- `ui.components`
- `ai.context`

## Build & Package (Maintainers)

```bash
node scripts/build-calendar-wat.mjs
node tools/package-plugin.mjs plugins/official/calendar
node tools/validate-plugin.mjs plugins/official/calendar
```
