# Chattree Official Plugin Starter Template

Welcome to the official starter template for creating custom WebAssembly plugins for **Chattree**.

This template provides a turnkey, schema-validated starting point that you can clone, customize, compile, package, and deploy.

---

## Template Directory Structure

```text
templates/plugin/
├── Cargo.toml          # Rust build configuration (wasm32-unknown-unknown target)
├── icon.png            # 512x512 PNG icon
├── plugin.json         # Pre-configured, schema-validated plugin manifest
├── plugin.wasm         # Pre-compiled WebAssembly binary (from WAT source)
├── README.md           # This step-by-step guide
└── src/
    ├── lib.rs          # Starter source implementation in Rust
    └── plugin.wat      # Starter source implementation in WebAssembly Text format
```

---

## Step 1: Customize Your Manifest (`plugin.json`)

Open `plugin.json` and adjust the identifying metadata for your plugin:

1. **`id`**: Replace `com.example.starter` with your reverse-domain identifier (e.g. `com.yourdomain.plugin-name`).
2. **`name` & `description`**: Set the public title and description of your plugin.
3. **`primaryCommand`**: The slash command users will type (e.g. `echo`, `calendar`, `todo`).
4. **`capabilities`**: Add any Host API permissions needed (e.g. `["storage.private", "network.http"]`).
5. **`entrypoint`**: Must match the exported function name in your WebAssembly source (default: `starter_entry`).

---

## Step 2: Implement Your Logic

Choose between **WebAssembly Text format (WAT)** or **Rust**:

### Option A: WebAssembly Text Format (`src/plugin.wat`)
Ideal for minimal, lightweight plugins with zero external dependencies.

1. Edit `src/plugin.wat`.
2. Compile to `.wasm` using `wat2wasm`:
   ```bash
   wat2wasm src/plugin.wat -o plugin.wasm
   ```

### Option B: Rust (`src/lib.rs`)
Ideal for complex data transformations, algorithms, and structured JSON parsing.

1. Ensure the WebAssembly compilation target is installed:
   ```bash
   rustup target add wasm32-unknown-unknown
   ```
2. Build optimized release binary:
   ```bash
   cargo build --target wasm32-unknown-unknown --release
   ```
3. Copy the compiled binary:
   ```bash
   cp target/wasm32-unknown-unknown/release/chattree_plugin_starter.wasm plugin.wasm
   ```

---

## Step 3: Compute SHA-256 Checksum

Chattree strictly verifies the cryptographic checksum of `plugin.wasm` before execution.

```bash
# On Linux / macOS
sha256sum plugin.wasm

# On Windows PowerShell
(Get-FileHash plugin.wasm -Algorithm SHA256).Hash.ToLower()
```

Copy the 64-character lowercase hex digest and paste it into the `wasmSha256` field of `plugin.json`.

---

## Step 4: Validate Your Plugin

Use the included Chattree validation utility to ensure the package complies with the manifest schema and runtime safety rules:

```bash
# From repository root
node tools/validate-plugin.mjs templates/plugin/
```

---

## Step 5: Package into `.chattree-plugin`

A `.chattree-plugin` package is a standard ZIP archive where all required files reside at the root level (no parent directory inside the ZIP).

### Using the Developer Packaging Tool
```bash
node tools/package-plugin.mjs templates/plugin/
```

### Using Standard Archive Tools
```bash
# Linux / macOS
zip -9 my-starter.chattree-plugin plugin.json plugin.wasm icon.png

# Windows PowerShell
Compress-Archive -Path plugin.json, plugin.wasm, icon.png -DestinationPath my-starter.zip
Rename-Item my-starter.zip my-starter.chattree-plugin
```

---

## Step 6: Test in the Chattree Mobile App

1. Transfer `my-starter.chattree-plugin` to your Android device (via USB, ADB, Google Drive, or email).
2. In Chattree, navigate to **Settings → Plugins → Import plugin**.
3. Select the `.chattree-plugin` file and tap **Install**.
4. In any chat window, invoke your command:
   ```text
   /starter Hello Chattree!
   ```
5. You should receive:
   ```text
   Starter Plugin received: Hello Chattree!
   ```
