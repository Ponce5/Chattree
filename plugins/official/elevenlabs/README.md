# ElevenLabs Voice — Chattree Official Plugin

Official ElevenLabs AI voice and speech synthesis plugin for Chattree. Converts text into downloadable MP3 audio using natural-language `intentContract` routing or direct slash commands.

## Setup

1. Create or copy your API key from [ElevenLabs](https://elevenlabs.io).
2. Save your key in Chattree:
   ```text
   /elevenlabs config <your_api_key>
   ```
3. Verify your configuration:
   ```text
   /elevenlabs status
   ```

## Usage

- `/elevenlabs <text>` — Generate MP3 audio with the default voice (`George`)
- `/tts <text>` — Quick alias for speech synthesis
- `/elevenlabs disconnect` — Remove your saved API key
- Natural language: ask Chattree in plain text (for example, *"Read this summary aloud with Sarah's voice"*)

## Supported Voices

- `george` (default)
- `sarah`
- `rachel`
- `adam`
- `antoni`
- `josh`
- `elli`
- `sam`
- Or pass any 20-character ElevenLabs `voice_id` directly.
