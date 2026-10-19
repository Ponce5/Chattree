# Chattree Developer Examples

This directory contains official, runnable developer examples demonstrating how to build, compile, package, and execute WebAssembly plugins for Chattree.

---

## Examples Catalogue

### 1. [`/hello` (`examples/hello/`)](./hello/)
- **Command:** `/hello <name>`
- **Language:** WebAssembly Text format (WAT)
- **Host API Capabilities:** None (Zero-capability minimal plugin)
- **Features Demonstrated:**
  - Standard memory layout: reading input from offset `0` and returning output from offset `1024`.
  - Basic string concatenation and argument handling in raw WebAssembly.
  - Manifest configuration without capabilities.

### 2. [`/notes-demo` (`examples/notes-demo/`)](./notes-demo/)
- **Commands:** 
  - `/notes-demo save <title>`
  - `/notes-demo search <query>`
- **Language:** WebAssembly Text format (WAT)
- **Host API Capabilities:** `chattree.notes.create`, `chattree.notes.search`
- **Features Demonstrated:**
  - Importing and invoking `chattree.host_call` from WebAssembly.
  - Asynchronous round-trip execution using the exported `resume(resPtr, resLen)` callback.
  - JSON payload serialization and deserialization in linear memory.
  - Real integration with Chattree's local Vector RAG Notes subsystem.

---

## Quick Start: Building & Packaging Examples

Each example directory contains a complete source module (`plugin.wat`) and manifest (`plugin.json`).

### Step 1: Compile to WebAssembly
Using the WebAssembly Binary Toolkit (`wat2wasm`):

```bash
cd examples/hello
wat2wasm plugin.wat -o plugin.wasm
```

### Step 2: Verify or Compute SHA-256 Checksum

```bash
# On Linux / macOS
sha256sum plugin.wasm

# On Windows PowerShell
(Get-FileHash plugin.wasm -Algorithm SHA256).Hash.ToLower()
```

Ensure the hash in `plugin.json` matches this value.

### Step 3: Bundle into a `.chattree-plugin` Package
Use the bundled CLI packaging utility or standard ZIP tools:

```bash
# Using the developer tool from repository root:
node ../../tools/package-plugin.mjs ./

# Or using standard archive tools:
# Linux/macOS:
zip hello.chattree-plugin plugin.json plugin.wasm

# Windows PowerShell:
Compress-Archive -Path plugin.json, plugin.wasm -DestinationPath hello.zip
Rename-Item hello.zip hello.chattree-plugin
```

### Step 4: Import and Run in Chattree
1. Transfer the `.chattree-plugin` file to your Android device via ADB, local storage, or download.
2. Open Chattree and navigate to **Settings → Plugins → Import plugin**.
3. Select `hello.chattree-plugin` and tap **Install**.
4. In any conversation, run the registered slash command:
   ```text
   /hello World
   ```
