# Flashcards Tutor (`/flashcards`)

Official Chattree Spaced Repetition (SRS) study tutor backed by your plugin's private isolated SQLite database (`database.sql`) with minimalist purple interactive Flutter UI cards.

## Features
- **SM-2 Spaced Repetition (`database.sql`)**: Automatically schedules each flashcard based on your recall (`Hard`, `Good`, `Easy`) using native SQLite timestamps.
- **Minimalist Interactive Study Flow (`ui.components`)**: Clean purple-accented cards with `QUESTION` / `ANSWER` status pills, mastery progress bar, and 1-tap `Show Answer`, `Hard`, `Good`, and `Easy` buttons.
- **Seamless Session Progression**: Rating a card immediately advances to the next due flashcard until your session is complete.
- **Natural Language & Slash Commands**: Create and study cards naturally in English or Spanish.

## Commands
- `/flashcards` — Study the next due flashcard
- `/flashcards add <Question> | <Answer>` — Create a new flashcard
- `/flashcards practice` — Practice cards early even when none are due
- `/flashcards list` — View your saved flashcards and mastery levels
- `/flashcards stats` — View mastery progress and due count
- `/flashcards delete <id>` — Delete a flashcard
- `/flashcards help` — Show command guide
