# Chattree Calendar Plugin (v1.9.1)

Official on-device Calendar integration (`com.chattree.official.calendar`) for Chattree, optimized for minimal token usage, fast execution, English Flutter UI cards for event creation and `/calendar` overviews, and strictly grounded factual text responses for queries and edits.

## What Changed in v1.9.1

1. **Zero-Hallucination Grounded Responses**:
   - Conversational `events`, `update`, and `delete` queries now return verbatim device calendar data directly (`type: "direct"` plain text) instead of passing raw JSON through a second LLM pass, preventing on-device models from fabricating events, dates, or times.
   - Aligned `calendar.events` to resolve the same default writable `calendarId` via `calendar.calendars` used by `calendar.create`, ensuring created events always appear when listing events.
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
