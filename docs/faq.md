# Frequently Asked Questions (FAQ)

Answers to common questions about Chattree, on-device AI inference, and WebAssembly plugin development.

---

## General & Architecture

### What is Chattree?
Chattree is an on-device, privacy-focused artificial intelligence chat application for Android available on Google Play. It runs neural language models locally on your phone, features built-in Notes and Reminders with Vector RAG, and provides an extensible WebAssembly plugin sandbox.

### Does Chattree send my conversations to the cloud?
No. When using on-device models, 100% of token inference, embedding calculations, and vector database queries occur locally on your device. There is zero telemetry, and your conversations are never uploaded to any remote server.

### What hardware is required to run local models?
An Android device running Android 10 or later with a 64-bit ARM processor (`arm64-v8a`) is required. For running local models, at least 6 GB of RAM is recommended (8 GB+ provides optimal speed).

---

## WebAssembly Plugins

### Why does Chattree use WebAssembly for plugins?
WebAssembly (WASM) provides several advantages for mobile extensions:
- **Strict Sandboxing:** Plugins have zero access to memory or files outside their allocated linear memory buffer.
- **Language Agnostic:** Developers can write plugins in WAT, Rust, C, C++, Go (TinyGo), or Zig.
- **Near-Native Speed:** Compiled WASM bytecode executes with minimal overhead on Android devices.
- **Fast Startup:** Modules instantiate in milliseconds without background runtime overhead.

### Can plugins run in the background or drain battery?
No. Chattree plugins only execute when a slash command is explicitly triggered by the user in chat. They are subject to a 5-second timeout and an instruction fuel limit (50,000,000 instructions). Plugins cannot spawn background threads, background services, or persistent daemons.

### Can plugins read my chat history?
No. The Host API strictly prevents plugins from reading previous conversation history. The `chattree.context.read` capability only provides the single text message passed to the slash command, never past conversation turns.

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
It is a standard ZIP archive containing `plugin.json` (manifest), `plugin.wasm` (compiled bytecode), and an optional `icon.png` (512×512 image) at the root level.
