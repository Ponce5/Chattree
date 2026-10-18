# Installation & Environment Setup

This guide walks you through installing Chattree on your Android device and configuring a complete development environment for authoring WebAssembly plugins.

---

## 1. Installing Chattree

### From Google Play Store (Recommended)
1. Open the [Google Play Store](https://play.google.com/store/apps/details?id=com.chattree.app).
2. Tap **Install**.
3. Launch Chattree and complete initial model download if you intend to run local inference.

### Hardware & System Requirements

| Specification | Minimum | Recommended |
|---|---|---|
| Operating System | Android 10 (API Level 29) | Android 13+ (API Level 33+) |
| RAM (Cloud AI only) | 3 GB | 4 GB |
| RAM (On-device LLMs) | 6 GB | 8 GB or 12 GB |
| Free Storage | 500 MB (app & plugins) | 4 GB+ (for local model weights) |
| Architecture | 64-bit ARM (`arm64-v8a`) | 64-bit ARM (`arm64-v8a`) with NEON/v8.2-A |

---

## 2. Developer Toolchain Setup

To create `.chattree-plugin` packages, you need a compiler capable of targeting WebAssembly (`wasm32`).

### Option A: WebAssembly Text Format (WAT) — Simplest
No SDK or heavy toolchain required. Perfect for simple text tools and utilities.

1. Install `wabt` (The WebAssembly Binary Toolkit):
   - **macOS (Homebrew):** `brew install wabt`
   - **Ubuntu/Debian:** `sudo apt-get install wabt`
   - **Windows (Chocolatey/Scoop):** `choco install wabt` or `scoop install wabt`
   - **Manual Download:** [wabt GitHub Releases](https://github.com/WebAssembly/wabt/releases)
2. Verify installation:
   ```bash
   wat2wasm --version
   ```

### Option B: Rust Toolchain — Recommended for Complex Plugins
Provides high-level ergonomics, memory management, and JSON serialization.

1. Install Rust via `rustup`:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. Add the `wasm32-unknown-unknown` compilation target:
   ```bash
   rustup target add wasm32-unknown-unknown
   ```
3. Verify target:
   ```bash
   rustup target list | grep "wasm32-unknown-unknown (installed)"
   ```

### Option C: C / C++ with WASI SDK
For existing C/C++ libraries:
1. Download the [wasi-sdk](https://github.com/WebAssembly/wasi-sdk/releases).
2. Compile with `clang --target=wasm32 -O3 -nostdlib -Wl,--no-entry -Wl,--export-all`.

---

## 3. Packaging Utilities

A Chattree plugin package is a ZIP archive with a `.chattree-plugin` extension.

### Command-Line Archivers
- **Linux / macOS:** Built-in `zip` utility.
  ```bash
  zip my-plugin.chattree-plugin plugin.json plugin.wasm
  ```
- **Windows (PowerShell):** Built-in `Compress-Archive`.
  ```powershell
  Compress-Archive -Path plugin.json, plugin.wasm -DestinationPath my-plugin.zip
  Rename-Item my-plugin.zip my-plugin.chattree-plugin
  ```

---

## 4. Deploying Plugins to Android

During development, transfer your `.chattree-plugin` package to your test device:

### Method 1: Android Debug Bridge (ADB) — Fastest for Developers
1. Enable **Developer Options** and **USB Debugging** on your phone.
2. Connect your device via USB or Wi-Fi.
3. Push the package directly to your Downloads folder:
   ```bash
   adb push my-plugin.chattree-plugin /sdcard/Download/
   ```
4. In Chattree, go to **Settings → Plugins → Import Plugin** and pick the file.

### Method 2: Cloud Drive or File Sharing
Transfer the `.chattree-plugin` file via Google Drive, Telegram, email, or a local HTTP server (`python3 -m http.server`), then open it with Chattree.

---

## 5. Live Debugging and Logs

To view real-time plugin execution logs and `core.log` output:

```bash
adb logcat -s Flutter:D | grep "\[Plugin:"
```

When your plugin calls `core.log`:
```json
{ "api": "core", "operation": "log", "payload": { "level": "info", "message": "Initialized" } }
```
The output will appear in the system log stream:
```text
D/Flutter: [Plugin:com.example.myplugin] Initialized
```
