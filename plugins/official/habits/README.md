# Habit Tracker (`com.chattree.official.habits`)

Official **Habit & Streak Tracker** plugin for **Chattree**, compiled to WebAssembly (`WASM`) with 100% local private storage (`storage.private`), instant declarative Flutter UI cards (`ui.components`), and natural-language AI tool calling (`intentContract`).

No API keys, no external servers, and zero configuration required.

---

## Features

- **Daily Habit Dashboard (`/habits`):** View all your habits, today's completion progress bar, active streaks, and best streaks in a crisp interactive Flutter UI card.
- **Natural Language & Direct Commands:** Add habits, check them off, undo check-ins, view statistics, or remove habits using either natural language or quick slash commands.
- **Automatic Streak Tracking:** Calculates consecutive-day streaks (`streak`), all-time best streak (`best`), and lifetime check-ins (`total`), preventing duplicate check-ins on the same day.
- **100% Local & Private:** All habit data is stored exclusively on your device in Chattree's isolated `storage.private` key-value store.

---

## Usage Examples

Invoke `/habits` (or aliases `/habit`, `/habitos`, `/streak`):

- **View today's habits:**
  ```text
  /habits
  ```
- **Add a new habit:**
  ```text
  /habits add Drink 2L of water
  ```
  Or in natural language: *"Add a daily habit to read 20 minutes"*
- **Mark a habit as done today (by name or number):**
  ```text
  /habits done water
  /habits done 1
  ```
  Or in natural language: *"I already drank my water today"*
- **Undo today's check-in:**
  ```text
  /habits undo water
  ```
- **View overall statistics:**
  ```text
  /habits stats
  ```
- **Delete a habit:**
  ```text
  /habits delete water
  ```
- **Show help:**
  ```text
  /habits help
  ```

---

## Permissions & Security

- `storage.private`: Stores your habit list and streak history locally on-device in isolated per-plugin storage.
- `ui.components`: Renders interactive Flutter dashboard, progress, and confirmation cards in chat.
