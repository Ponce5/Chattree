# Chattree Gmail Plugin (v2.4.0)

Official on-device Gmail and IMAP/SMTP integration (`com.chattree.official.gmail`) for Chattree, optimized for minimal token usage, fast execution, English Flutter UI cards for status and setup, and natural-language responses for inbox, reading, and sending.

## What Changed in v2.4.0

1. **Major Token & Performance Optimization**:
   - Compacted `plugin.json` tool descriptions, `intentContract`, fields, and examples to reduce prompt token usage on every chat turn.
   - Eliminated redundant `ai.complete` calls inside WASM for status/setup/config Flutter UI cards and for conversational `inbox`, `read`, `send`, and `disconnect` operations, which now return compact JSON directly to Chattree's conversational AI for normal natural-language responses.
   - Direct `/gmail read <id>` formats email headers and body directly with zero AI token usage.
   - Refactored `plugin.wat` and `plugin.wasm`, reducing binary size and execution overhead.
2. **All Predefined UI Copy & Action Button Labels in English**:
   - All card titles, badges, field labels, and fallbacks are in English (`Gmail Status`, `Gmail Setup`, `Gmail Connected`, `Connection Error`, `Connection Failed`).
   - Action buttons display clean English action names (`View Inbox`, `Check Status`, `Help`, `Disconnect`, `Retry`) instead of raw slash commands.
3. **Balanced Flutter UI + Natural-Language Responses**:
   - **Flutter UI Cards**: bare `/gmail` / `/gmail status` (live IMAP verification card) and `/gmail config` (connection confirmation/error card).
   - **Natural-Language Text**: inbox summaries, reading emails, sending emails, disconnecting, and help.

## Quick Setup: Google 16-Letter App Password

1. Go to [myaccount.google.com/security](https://myaccount.google.com/security).
2. Enable **2-Step Verification**.
3. Create a 16-letter **App Password** (e.g. `abcd efgh ijkl mnop`).
4. Connect your account in Chattree:

```text
/gmail config user@gmail.com abcd efgh ijkl mnop
```

Check your live status anytime with `/gmail`.

## Capabilities & Security

- `storage.private`, `email.read`, `email.send`, `ui.components`, `ai.context`
- Credentials are stored on-device via `FlutterSecureStorage`, and passwords are never sent to AI prompts or UI outputs.

## Build & Package (Maintainers)

```bash
node scripts/build-mail-wat.mjs
node tools/package-plugin.mjs plugins/official/mail
node tools/validate-plugin.mjs plugins/official/mail
```
