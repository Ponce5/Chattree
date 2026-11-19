# Chattree Calendar Plugin (v1.9.0)

Official on-device Calendar integration (`com.chattree.official.calendar`) for Chattree, optimized for minimal token usage, fast execution, English Flutter UI cards for event creation and `/calendar` overviews, and natural-language responses for queries and edits.

## What Changed in v1.9.0

1. **Major Token & Performance Optimization**:
   - Compacted `plugin.json` tool descriptions, `intentContract`, fields, and examples to reduce prompt token usage on every chat turn.
   - Eliminated redundant `ai.complete` calls inside WASM for Flutter UI cards (`bare /calendar` and `create`) and for conversational queries/edits (`events`, `update`, `delete`, `help`), which now return compact JSON directly to Chattree's conversational AI for normal natural-language responses.
   - Refactored `plugin.wat` and `plugin.wasm`, reducing binary size and execution overhead.
2. **All Predefined UI Copy & Action Button Labels in English**:
   - All card titles, badges, field labels, empty states, and fallbacks are in English (`Event Scheduled`, `Upcoming Events`, `Calendar Error`, `Title`, `Date`, `Time`, `Description`, `All day`).
   - Action buttons display clean English action names (`View Events`, `Refresh`, `Retry`) instead of raw slash commands.
3. **Balanced Flutter UI + Natural-Language Responses**:
   - **Flutter UI Cards**: bare `/calendar` (upcoming events list) and creating an event (`Event Scheduled` with title, date, time, and description).
   - **Natural-Language Text**: conversational event queries, updates, deletions, and help responses.

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
