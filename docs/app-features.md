# Chattree App Features

This guide maps the main user-facing app features to their technical references. The exact catalog contents and provider model availability may change with app releases.

## First launch and local models

On first launch, Chattree can inspect device information and recommend a local model. You can continue through the recommendation and download flow or skip to chat. In **Manage Models**, the catalog shows model details such as download size, quantization, approximate memory requirements, and compatibility metadata. You can download an available model with progress, cancel an active download, select an installed model for chat, unload the current model from memory, or delete an installed model.

Local generation runs on the device after a compatible model is installed and selected. Hardware and memory affect which models are practical. The app's displayed requirements are estimates; check the catalog in the version you use.

## Chat and conversation history

The chat drawer lets you start a conversation, switch between saved conversations, and manage conversation names and entries. Conversation records retain their messages, timestamps, selected model metadata, and reasoning-mode preference where supported. The chat options menu can change the active model, control reasoning mode for compatible models, adjust generation settings, and clear the current conversation. **Settings → Data** provides a separate action to delete all conversations.

The input supports slash-command discovery: type `/` or use the slash button to browse available commands. Built-in Notes (`/note`), Reminders (`/reminder`), Visual (`/visual`), and installed plugin tools are exposed through their current registrations. 

Chattree follows an **explicit tool invocation model**: tools and side-effect operations are never executed secretly or unprompted during regular conversational chat. Users have deterministic control through slash commands. When an unknown or invalid command is entered (e.g. `/unknown`), Chattree intercepts it and guides the user with a list of all currently available commands and their descriptions.

> [!NOTE]
> **Built-in tools boundary:** Chattree includes native core tools for Notes (`/note`), Reminders (`/reminder`), and Visual Design (`/visual`). Chattree does **not** include a built-in calculator tool in the core application; any mathematical calculation, formula parsing, or spreadsheet automation can be cleanly implemented by community developers as an isolated WebAssembly plugin using deterministic Rust, AssemblyScript, or the `ai.context` Host API capability.

## Model and generation settings

**Settings** includes appearance (dark, light, or system theme), app language (English, Spanish, or French), temperature, maximum response tokens (up to 8,192), automatic keyboard opening, and local AI optimization. Chat-level options may expose a subset of these controls as well. Some inference settings are relevant only to compatible local or remote models.

The model catalog manages chat models. The embedding model is a separate download and does not replace the chat model.

## Notes, semantic search, and embeddings

Chattree Notes and Reminders are built-in chat features; see the [Notes and Reminders guide](./notes-reminders.md) for their commands and behavior. A separate ONNX embedding model supports semantic search. After it is installed, Settings can enable or disable RAG, show indexing progress, rebuild the index, and clear the vector index. When RAG is enabled and initialized, conversational chat (`sendMessage`) automatically retrieves and injects relevant note and plugin-indexed document context via an in-memory vector cache (`SqliteVectorStore`) for fast zero-I/O cosine similarity search. Plugins granted `ai.embeddings` can also compute embeddings, query semantic search, and index custom plugin-scoped text documents. Notes and their local embedding index are stored on the device.

## Inbound webhooks, local events, and 24/7 cloud relay

Chattree includes a comprehensive dual-entrypoint webhook architecture for local and remote automations:
- **Local Loopback & LAN Listener (`InboundHttpServer`):** A foreground HTTP server that allows local desktop tools, CLI scripts, and LAN/Wi-Fi devices to deliver triggers directly to `http://127.0.0.1:<port>` (or `http://0.0.0.0:<port>` with IPv4 RFC 1918 and IPv6 loopback/ULA support), accepting payloads up to **256 KB**. In **Settings → Inbound Webhooks**, users can configure custom ports (default `8765`), toggle LAN access directly from the global server card, test `/plugins/system/test` diagnostic routes, and inspect live activity logs.
- **24/7 Cloud Relay (Cloudflare Worker + Google FCM):** External internet services (GitHub, Stripe, CI/CD, IoT) deliver webhooks to a personal, free Cloudflare Worker. The Worker enforces total UTF-8 payload byte boundaries (`MAX_DATA_BYTES = 3800`, ~3.5 KB) complying with FCM's 4 KB limit, signs requests with Google Firebase credentials, and dispatches data messages to Google FCM HTTP v1. `FcmInboundRelayService` resolves installed plugin endpoints with priority, serializes pending inbox drains (`_drainInFlight`), and bounds unresolvable route retries (`kFcmMaxInboxRetries = 3`).
- **One-Click Automated Deployment:** In **Settings → Inbound Webhooks**, users can deploy their personal Cloudflare Worker in seconds by entering their Cloudflare API Token. Chattree communicates directly with Cloudflare API v4, uploads the relay script, registers secrets (FCM device token and Firebase relay credentials securely managed without hardcoded plaintext keys), tracks FCM token rotation (`last_deployed_fcm_token`), and verifies authenticated `/plugins/system/test` reachability with a responsive, theme-adaptive UI.
- **Persistent Activity History (`InboundActivityLog`):** Every incoming webhook (foreground, background with app closed, or diagnostic ping) is durably saved to disk, preserving delivery records across app restarts with atomic de-duplication.
- **Per-Plugin Management:** In **Settings → Plugins → [Plugin] → Webhooks Entrantes**, users can view endpoint paths, copy active Bearer/HMAC secrets, and rotate secrets with one tap (`beginRotation` + `finalizeRotation`).

All payloads are authenticated via Bearer tokens (`Authorization: Bearer <token>`) or HMAC-SHA256 signatures (`X-Chattree-Signature-256`), protected against loopback SSRF bypasses, and deduplicated in an embedded SQLite journal (`EventJournal`) before dispatching to subscribed WebAssembly plugin handlers. See the [Inbound Webhooks guide](./inbound-webhooks.md) for full architecture and protocol specifications.

## Background execution and Android services model

Chattree is designed for maximum privacy, compliance with Google Play store policies, and zero unwanted battery drain:
- **Scheduled Reminders:** Reminders use Android's system `AlarmManager` (exact alarms via `flutter_local_notifications`). This allows scheduled alerts to ring reliably on time without running persistent background services or holding CPU wake locks.
- **24/7 Background Webhook Wake-Up (`FcmInboundRelayService`):** When Chattree is closed or the screen is locked, Google FCM data messages wake a lightweight, dedicated Android isolate (`fcmBackgroundHandler`). This handler consumes near-zero CPU and memory, loads no heavy AI or WASM engines, persists raw incoming payloads safely to disk, and triggers native Android notifications. When the user opens Chattree, pending payloads are automatically drained and delivered to WASM plugins.
- **Local Webhook Socket:** The loopback HTTP server operates while Chattree is in the foreground. Mobile operating systems suspend unprivileged TCP listener sockets when apps are minimized. Chattree pauses the listener safely when backgrounded and **automatically re-establishes it** upon returning to the foreground, eliminating the need for an intrusive, permanent Android status bar notification.
- **Zero Hidden Daemons:** Neither the local inference engine nor WebAssembly plugins run uncontrolled background tasks or background processes.

## External AI providers

Chattree includes configured provider integrations for OpenAI, Google Gemini, Anthropic Claude, and OpenRouter. In **Settings → AI Providers**, a user can add or replace an API key, test connectivity, enable or disable a provider, and remove its key. Provider/model selection is exposed through chat model selection. Remote inference requires network access and sends the prompt context needed for that request to the selected provider; review that provider's data and retention policies. The local model path does not send prompts to those providers.

See the [External AI Providers architecture](./ai_providers/architecture.md) for the client, credential storage, and provider integration details.

## Plugins and visual design

Third-party WASM plugins can be imported locally or installed from the Marketplace, updated in place without uninstalling (`allowUpdate: true` preserving user settings, private storage, and SQLite databases), enabled or disabled, and managed from Settings. The local importer automatically normalizes browser/OS duplicate copy suffixes (`(1)`, `(2)`, `- copia`), flattens single wrapper folders in re-zipped archives, and verifies magic bytes. Per-plugin capability grants can be reviewed and revoked. The [Plugin SDK](./plugins/README.md) documents how to create and publish plugins, with full support for full-duplex WebSockets (`network.websocket`), declarative interactive UI bubbles (`ui.components`), scheduled Cron automations (`scheduler.task`), private isolated SQLite databases (`database.sql`), device notification listener/reply (`notifications.read`, `notifications.query`, `notifications.reply`, `notifications.action`), and generated-file results with Save and Share actions in chat.

The built-in `/visual` tool generates and refines SVG artwork and provides preview and export actions. See the [Visual Design guide](./visual-design.md) for the design, sanitization, persistence, and export pipeline.

## Current implementation boundary

Plugin `settings` declared in `plugin.json` are rendered in the plugin detail screen (**Settings → Plugins → [Plugin]**), and any setting marked with `isSecret: true` (or matching secret/token/password/api_key keys) is encrypted at rest via `FlutterSecureStorage` (`EncryptedSharedPreferences` / Keychain), storing only a `__SECURE_STORED__` sentinel in `SharedPreferences`.
