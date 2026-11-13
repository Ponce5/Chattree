# Text RPG Simulator (`com.chattree.official.rpg`)

A D&D-inspired interactive text RPG plugin for Chattree (`v2.0.0`) featuring AI-generated opening stories, predefined Knight & Archer character selection in Flutter UI, persistent 3-slot campaigns, a compact live campaign memory summary, and tension-driven narrative pacing with deterministic `d20` rolls.

## Features

- **Dynamic 3-Story Start**: On `/rpg new`, the AI generates 3 distinct short story premises rendered in a minimalist Chattree Flutter UI card (`Choose Your Story`).
- **Predefined Character Selection**: After choosing a story, a Flutter UI card presents **Knight** and **Archer** with predefined ASCII symbol art and stats.
- **3-Slot Persistent Campaigns**: Save up to 3 independent campaigns in `storage.private` (`rpg_slot_1`, `rpg_slot_2`, `rpg_slot_3`) and switch at any time via `/rpg games`.
- **Live Campaign Summary**: Maintains a compact running summary of locations visited, key NPCs, decisions, and combat outcomes so the AI stays consistent across turns.
- **D&D Narrative Pacing**: Uses `tension (0–100)`, `d20` skill/combat rolls, and explicit narrative states (`OPENING`, `EXPLORATION`, `SKILL_CHECK`, `COMBAT_AMBUSH`, `COMBAT_ROUND`, `COMBAT_VICTORY`, `CAMP_REST`, `GAME_OVER`).
- **Two-Step Reset/Delete**: `/rpg delete` displays a confirmation card before clearing the active slot.

## Slash Commands

| Command | Description |
| :--- | :--- |
| `/rpg` | Start or continue the active campaign |
| `/rpg new` | Generate 3 fresh story premises for the active slot |
| `/rpg games` | View all 3 campaign slots and switch or manage saves |
| `/rpg status` | Show current character sheet, tension, and summary |
| `/rpg delete` | Clear the active campaign slot (with confirmation) |
| `/rpg help` | Show plugin commands and overview |

## Build

Requires `wat2wasm` (WABT):

```bash
wat2wasm plugin.wat -o plugin.wasm
```
