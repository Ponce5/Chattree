# Chattree Mail Plugin

The **Official Mail Plugin** provides sandboxed, on-device email drafting and dispatch integration for Chattree. It assists users in composing, preparing, and launching emails directly into **Gmail**, **Outlook**, or their default email client via strict `/mail` slash commands.

---

## Features

- **Exclusive Slash Command Activation:**
  - Strictly triggered only by `/mail`.
  - No aliases (`/correo`, `/email` removed) and no accidental conversational triggers.
- **Real Integration (Gmail & Outlook):**
  - Connects to **Gmail** (`mail.google.com`) and **Outlook** (`outlook.office.com`) via deep links pre-filled with recipient, subject, and body.
  - Zero mock or fake emails: the AI will never invent non-existent previous emails.
- **Conversational AI Assistance:**
  - Ask Chattree to draft professional emails, follow-ups, or meeting responses.
  - Generates ready-to-send action links for Gmail and Outlook.

---

## Commands

| Command | Description |
| :--- | :--- |
| `/mail` | Checks local status and displays options to compose for Gmail or Outlook. |
| `/mail send <destinatario> \| <asunto> \| <mensaje>` | Prepares an email and generates direct launch links for Gmail and Outlook. |
| `/mail gmail` | Displays instructions and direct URL to compose in Gmail. |
| `/mail outlook` | Displays instructions and direct URL to compose in Outlook. |
| `/mail <indicaciones>` | Asks the AI to compose a professional email without inventing prior correspondence. |

---

## Privacy & Security

- Runs in WebAssembly sandbox.
- Does not require accessing private inbox credentials without user authorization.
- Composed emails are opened directly in your trusted browser or email client.
