# Frequently Asked Questions (FAQ)

Answers to common questions about Chattree, on-device AI inference, and WebAssembly plugin development.

---

## General & Architecture

### What is Chattree?
Chattree is an on-device, privacy-focused artificial intelligence chat application for Android available on Google Play. It runs neural language models locally on your phone, features built-in Notes and Reminders with Vector RAG, and provides an extensible WebAssembly plugin sandbox.

### Does Chattree send my conversations to the cloud?
No. When using on-device models, 100% of token inference, embedding calculations, and vector database queries occur locally on your device. There is zero telemetry, and your conversations are never uploaded to any remote server.

### What hardware is required to run local models?
An Android device running Android 8.0 Oreo (API Level 26) or later with a 64-bit ARM processor (`arm64-v8a`) or `x86_64` is supported. Memory requirements scale according to the model size:
- **Ultralight models (< 1B parameters, e.g. SmolLM2 360M, Qwen2.5 0.5B, Qwen3 0.6B):** require only 1.2 GB to 1.6 GB of available RAM and run comfortably on devices with 3 GB or 4 GB of total RAM.
- **Medium models (1B to 4B parameters, e.g. Llama 3.2 3B, Qwen 3B, Gemma 3 4B):** recommend 4 GB to 8 GB of RAM.
- **Heavy models (7B to 8B parameters, e.g. Qwen2.5 7B, Qwen3 8B):** recommend 8 GB to 12 GB+ of RAM.

---

## WebAssembly Plugins

### Why does Chattree use WebAssembly for plugins?
WebAssembly (WASM) provides several advantages for mobile extensions:
- **Strict Sandboxing:** Plugins have zero access to memory or files outside their allocated linear memory buffer.
- **Language Agnostic:** Developers can write plugins in WAT, Rust, C, C++, Go (TinyGo), or Zig.
- **Near-Native Speed:** Compiled WASM bytecode executes with minimal overhead on Android devices.
- **Fast Startup:** Modules instantiate in milliseconds without background runtime overhead.

### Can plugins run in the background or drain battery?
Plugins cannot spawn background threads, persistent OS daemons, or unmetered background processes. However, plugins can schedule recurring background automations via the `scheduler.task` capability using standard 5-part Cron expressions or periodic intervals. To prevent battery drain, Chattree strictly enforces a **minimum interval of 60 seconds** and caps tasks at 25 per plugin. When a scheduled time arrives, Chattree dispatches an event via `HostEventBus`, waking the plugin's declared event consumer cleanly.

### Can plugins open real-time WebSocket connections?
Yes. Plugins declaring the `network.websocket` capability can establish up to **10 concurrent full-duplex WebSocket connections** (`ws://` or `wss://`). Inbound and outbound frames are capped at **16 MB** (frames exceeding 16 MB are terminated cleanly with WebSocket status code `1009`). Unpolled messages are buffered in an in-memory queue of up to **500 frames**. Connections to private LAN IPs or `localhost` are blocked by default unless the plugin also holds the critical `network.local` capability.

### Can plugins render custom interactive buttons and UI widgets?
Yes. Plugins declaring the `ui.components` capability can return rich declarative cards (`DeclarativeUiBubble`) containing status badges (color-coded or monochrome), progress bars, metric key-value tables or `list` items (up to 40 items), `hideText: true` to hide redundant intro text, and action button rows (up to 8 buttons with `command`, `url`, and `copy` actions). For user safety, any button that triggers a slash command (`/`) prompts the user with an explicit **Security Confirmation Modal** before execution.

### Can plugins use a relational SQL database?
Yes. Plugins declaring `database.sql` are provisioned a private, fully isolated **relational SQLite database** (`plugin_<pluginId>.db`). Each plugin has a generous **200 MB storage quota** (measuring the `.db`, `.db-wal`, `.db-shm`, and `.db-journal` files), supports full multi-statement ACID batch transactions (`database.transaction`) with rollback, returns up to **2,000 rows per query**, and includes automatic type normalization for booleans and JSON structures. Plugins are strictly isolated and cannot query or attach databases belonging to other plugins.

### How does Chattree handle background execution and notifications on Android?
Reminders are scheduled using Android's native `AlarmManager` (exact alarms via `flutter_local_notifications`). This allows Android to wake up and fire scheduled notifications at the exact target time with zero battery drain while the app is closed.

### Can the inbound webhook server run in the background?
The local webhook listener (`127.0.0.1`) operates while Chattree is in the foreground. Mobile operating systems suspend unprivileged TCP listener sockets when apps are minimized. To avoid draining your battery with an intrusive persistent Android Foreground Service notification, Chattree pauses the socket when backgrounded and automatically re-binds it when you bring the app back to the foreground.

### What is the maximum payload size for inbound webhooks?
- **Local Webhooks (`InboundHttpServer`):** Supports payloads up to **256 KB** (`maxInboundHttpPayloadBytes`), accommodating local tools, large JSON reports, and automated scripts.
- **Cloud Webhooks (`Cloudflare Worker + FCM`):** Bounded to **~3.5 KB** (`MAX_DATA_BYTES = 3800` bytes total) because Google Firebase Cloud Messaging imposes a strict 4 KB limit on the `data` message envelope. Payloads exceeding this limit receive an HTTP `413 payload_too_large` response from the Worker.

### Do cloud webhooks execute WebAssembly plugin logic when Chattree is closed?
When Chattree is closed or the device is locked, Google FCM push wakes a lightweight background isolate (`fcmBackgroundHandler`). To protect mobile battery life and comply with Android memory limits, this isolate does not start heavy AI or WASM engines; it commits the payload safely to disk (`kFcmPendingInboxKey`) and alerts you via a native notification. When you tap the notification or open Chattree, `drainPendingInbox()` immediately feeds the queue into `EventJournal` and executes the plugin.

### How are Firebase Service Account credentials secured?
Production guidelines strictly prohibit embedding plaintext Firebase Service Account private keys in source code. Credentials are stored in hardware-backed Android Keystore (`SecureCredentialStore` with AES-256) or provided as encrypted secrets directly in Cloudflare Workers (`wrangler secret put FIREBASE_SERVICE_ACCOUNT`).

### What happens if Google Play Services rotates my device's FCM token?
Google Play Services periodically rotates FCM registration tokens. Chattree listens for `onTokenRefresh`, flags the outdated deployment in Settings (`last_deployed_fcm_token` mismatch), and allows you to push the new token to Cloudflare with a single tap of **Auto-desplegar en Cloudflare**.

### Can plugins read my chat history?
By default, no. The `chattree.context.read` capability only exposes the single message passed to the current command. If a plugin explicitly declares the sensitive `chat.history.read` capability and you grant consent, it can read a bounded window of up to **20 recent messages** (truncated at 4,000 characters each) from the active conversation, and returns an empty list in restricted mode.

### How do plugins access device features like camera, GPS, or storage?
Plugins must declare the corresponding capability (e.g., `camera.capture`, `location.current`, `storage.private`) in their `plugin.json` manifest. At runtime, calls route through `chattree.host_call`, which is verified by the `PermissionGateway`. If the user has not granted permission, the call is rejected immediately.

---

## External AI Providers

### Which external providers can I use with Chattree?
Chattree includes integrations for OpenAI, Google Gemini, Anthropic Claude, and OpenRouter as alternatives to local models. Remote requests require network access and send the request context to the selected provider.

### Where are my API keys stored?
API keys are saved in hardware-backed secure storage on the operating system (`EncryptedSharedPreferences` backed by AES-256 Android Keystore on Android, and Keychain on iOS). They are never written to unencrypted preferences, logs, or backups.

### Does Chattree proxy requests through its own servers?
No. When you configure an external provider, requests travel directly via HTTPS from your phone to the provider's official API endpoint.

---

## Packaging & Marketplace

### How do I distribute my plugin?
You can distribute the `.chattree-plugin` package directly (via GitHub Releases, personal websites, or messaging apps) for users to import via **Settings → Plugins → Import Plugin**. Additionally, you can publish to the official Chattree Marketplace by registering your package and metadata.

### What is the `.chattree-plugin` file format?
It is a standard ZIP archive containing `plugin.json` (manifest), `plugin.wasm` (compiled WebAssembly binary), and optionally `icon.png` (512×512 image), `README.md`, and `LICENSE` (`license`, `license.txt`, or `license.md`) at the root level. Packages are bounded to a maximum of 25 MB compressed, 50 MB uncompressed, and 50 files total to protect device resources.
