# Chattree Gmail Plugin (v2.3.0)

Official on-device Gmail and IMAP/SMTP integration (`com.chattree.official.gmail`) for Chattree, featuring multilingual AI orchestration (`ai.complete` + `ai.context`), live Flutter declarative UI status/inbox/composer cards (`ui.components`), and encrypted on-device credential storage (`storage.private`).

## What Changed in v2.3.0

1. **Fixed `/gmail config` Host API Namespace Routing**: When invoked through Chattree's AI pipeline, tool payloads carry `"api":"gmail"`. Previously the plugin forwarded `"gmail"` to the host runtime, which only exposes the `"email"` namespace. v2.3.0 always normalizes Host API calls to `"email"` and maps AI-lowercased keys (`imaphost`, `imapport`, `smtphost`, `smtpport`) back to camelCase (`imapHost`, `imapPort`, `smtpHost`, `smtpPort`).
2. **Full 4-Group App Password Preservation & Validation**: Supports both spaced 16-letter Google App Passwords (`/gmail config user@gmail.com abcd efgh ijkl mnop`) and direct pipe/token forms, automatically joining and stripping whitespace while never forwarding passwords to AI prompts or UI responses.
3. **Action Normalization Fix (`read` -> `get`)**: Compatible with `ToolRegistry.normalizeArgs`, which rewrites `"action":"read"` into `"action":"get"`.
4. **Live Configuration & IMAP Verification Card on Bare `/gmail`**: Running `/gmail` with no arguments reads `storage.private` synchronously (`chattree_email_account`, IMAP/SMTP host & port), runs a live `email.inbox` verification check when configured, and renders a color-coded Flutter UI card showing account status, IMAP/SMTP verification, unread count, or setup instructions.
5. **100% Multilingual AI Responses (Zero Hardcoded User Messages)**: All user-facing summaries, card titles, field labels, button labels, errors, and onboarding guides are generated dynamically via `ai.complete` in the active conversation language (`lang=<code>`), with clean structured UI fallbacks if offline AI is unavailable.

## Quick Setup: Google 16-Letter App Password

1. Go to [myaccount.google.com/security](https://myaccount.google.com/security).
2. Enable **2-Step Verification**.
3. Search for **App Passwords** (`Contrasenas de aplicaciones`), create an app password (e.g., `Chattree`), and copy the 16 letters shown by Google (`abcd efgh ijkl mnop`).
4. In Chattree, connect your account using:

```text
/gmail config user@gmail.com abcd efgh ijkl mnop
```

Or check your status at any time with:

```text
/gmail
```

## Supported Commands & Natural Language

- `/gmail` — Inspect configuration in private storage, run live IMAP verification, and render a Flutter UI status card.
- `/gmail config <email> <app_password>` — Verify and save IMAP/SMTP credentials (works with 4 space-separated 4-letter groups).
- `/gmail status` — Explicit connection and IMAP/SMTP verification check.
- `/gmail inbox` — Fetch recent messages, unread counts, and render an interactive Flutter inbox card.
- `/gmail read <id>` — Open and read the full body of a specific message by ID.
- `/gmail send <to> | <subject> | <body>` — Send an email via SMTP (or simply ask naturally in any language, e.g. *"Send an email to ana@example.com..."*).
- `/gmail disconnect` — Remove stored credentials from secure device storage.
- `/gmail help` — AI-generated multilingual guide tailored to your language.

## Capabilities & Security

- `storage.private` — Reads configured account metadata (`chattree_email_account`, IMAP/SMTP host and port) to render instant status cards.
- `email.read` — Authenticates and reads recent inbox messages via IMAP.
- `email.send` — Sends emails via authenticated SMTP.
- `ui.components` — Renders declarative Flutter cards for status, connection results, inbox lists, message reader, send confirmations, and errors.
- `ai.context` — Generates localized explanations, summaries, and UI copy in the user's language (`ai.complete`).
- **Credential Protection**: Passwords are stored exclusively via `FlutterSecureStorage` on the host runtime and are stripped before any AI prompt or UI output.

## Build & Package (Maintainers)

```bash
node scripts/build-mail-wat.mjs
node tools/package-plugin.mjs plugins/official/mail
node tools/validate-plugin.mjs plugins/official/mail
```
