# Getting Started — Your First Chattree Plugin

This guide walks you through creating a minimal Chattree plugin from scratch.
No prior Chattree knowledge required.

---

## Prerequisites

- A compiler that can produce WebAssembly `.wasm` binaries:
  - **WAT** (WebAssembly Text format) via `wat2wasm` — simplest, no toolchain needed
  - **Rust** via `cargo build --target wasm32-unknown-unknown`
  - **C/C++** via Emscripten or `wasi-sdk`
  - **Go** via `tinygo build -target wasm`
- Standard archive utility (`zip`, PowerShell `Compress-Archive`, or Node.js)
- Chattree installed on a supported device. Import UI and OS capability support vary by platform and release; check current release information before targeting platform-specific APIs.

> **No Chattree source code required.**  
> You only need the public SDK documentation and a WASM compiler.

---

## Step 1 — Create the plugin directory

```
my-hello-plugin/
├── plugin.json        ← manifest
├── plugin.wat         ← source (optional — human-readable WAT)
└── plugin.wasm        ← compiled binary
```

---

## Step 2 — Create the manifest (`plugin.json`)

Every plugin needs a `plugin.json` manifest.
This is the contract between your plugin and Chattree.

```json
{
  "schemaVersion": 1,
  "id": "com.example.hello",
  "version": "1.0.0",
  "name": "Hello Plugin",
  "description": "Greets the user. Example minimal plugin.",
  "author": "Your Name",
  "primaryCommand": "hello",
  "aliases": [],
  "type": "imported",
  "capabilities": [],
  "tags": ["demo", "hello"],
  "runtime": "wasm",
  "entrypoint": "hello",
  "wasmPath": "plugin.wasm",
  "wasmSha256": "REPLACE_WITH_ACTUAL_SHA256",
  "runtimeApiVersion": "1.0.0",
  "maxMemoryPages": 2,
  "timeoutMs": 5000,
  "fuelLimit": 50000000,
  "tools": [
    {
      "id": "com.example.hello.hello",
      "command": "hello",
      "displayName": "Hello",
      "description": "Greets you: /hello <name>",
      "capabilities": []
    }
  ]
}
```

Key points:
- `id` must be a **globally unique reverse-domain identifier** — use your own domain.
- `primaryCommand` is the slash-command (without the `/`).
- `entrypoint` is the **exported WASM function name** that Chattree will call.
- `capabilities` is the list of Host API capabilities your plugin needs (see [capabilities.md](capabilities.md)).
- `wasmSha256` must be the SHA-256 hex digest of `plugin.wasm`.

---

## Step 3 — Write the WASM module

The simplest way to start is **WebAssembly Text format (WAT)**.

### Memory protocol & ABI Versions

Chattree supports two ABI architectures for communicating with plugins via linear memory:

#### 1. Universal ABI v2 (Recommended for modern plugins & large payloads)
ABI v2 provides dynamic memory allocation and supports payloads up to **16 MB** (2 MB by default):
- The plugin exports `chattree_allocate(size: i32) -> i32`
- The plugin exports `chattree_deallocate(ptr: i32, size: i32)`
- The plugin exports `chattree_dispatch(req_ptr: i32, req_len: i32) -> i64`
- The return value is a packed 64-bit integer: `(out_ptr << 32) | out_len`
- Asynchronous yields return `0` while waiting for Host API calls, and resume via `resume(res_ptr, res_len) -> i64`.

#### 2. Legacy ABI v1 (Static Memory)
For simple plugins with small payloads:
| Offset | Content |
|--------|---------|
| `0` (or `inputOffset`) | Input string (UTF-8, written by Chattree) |
| `inputLen` | End of input |
| `1024` (or `outputOffset`) | **Output string starts here** (written by your WASM) |

Your exported function receives `(i32 inputPtr, i32 inputLen)` and must:
1. Read the input from `[inputPtr … inputPtr+inputLen]`
2. Write the result string starting at `outputOffset` (default 1024)
3. **Return the output length** as `i32`

> **Tip:** If your ABI v1 plugin needs to receive payloads larger than 1024 bytes without implementing ABI v2, you can specify `"outputOffset": 32768` (or another offset) in `plugin.json`.

### Minimal example (WAT)

```wat
(module
  ;; Export at least 1 memory page (64 KB)
  (memory (export "memory") 2)

  ;; Pre-load the greeting prefix at offset 1024
  (data (i32.const 1024) "Hello, ")

  ;; exported function: (inputPtr, inputLen) -> outputLen
  (func (export "hello") (param $in_ptr i32) (param $in_len i32) (result i32)
    ;; Copy input (the user's name) after "Hello, " at offset 1031
    (memory.copy
      (i32.const 1031)  ;; dst: 1024 + len("Hello, ")
      (local.get $in_ptr)
      (local.get $in_len)
    )
    ;; Return total output length: 7 + inputLen
    (i32.add (local.get $in_len) (i32.const 7))
  )
)
```

### Compile WAT to WASM

```bash
# Install wabt (https://github.com/WebAssembly/wabt)
wat2wasm plugin.wat -o plugin.wasm
```

### Compute SHA-256 and update plugin.json

```bash
# macOS / Linux
sha256sum plugin.wasm

# Windows (PowerShell)
Get-FileHash plugin.wasm -Algorithm SHA256
```

Update the `wasmSha256` field in `plugin.json` with the result.

---

## Step 4 — Define the command

Your `tools` array in `plugin.json` declares every slash-command.
For a single `/hello` command:

```json
"tools": [
  {
    "id": "com.example.hello.hello",
    "command": "hello",
    "displayName": "Hello",
    "description": "Greets you by name: /hello <name>",
    "capabilities": []
  }
]
```

`tools[].command` is the user-facing slash command. `entrypoint` is the WASM export invoked by the current runtime; the runtime uses this manifest-level entrypoint when executing plugin tools. For a simple plugin, use one command and one export. Multiple commands do not currently select distinct WASM exports; verify dispatch behavior before shipping a multi-command plugin.

---

## Step 5 — Declare capabilities

If your plugin only processes text and returns a response, no capabilities are needed.  
If your plugin needs to access device data (network, notes, camera, etc.),  
list the required capabilities:

```json
"capabilities": ["network.http", "storage.private"]
```

See the full list in [capabilities.md](capabilities.md).

---

## Step 6 — Use ChattreeHostApi (optional)

If your plugin needs to call a Host API (e.g., save something to storage or make
an HTTP request), your WASM must:

1. Import the `chattree.host_call` function from the host.
2. Serialize the request as a JSON string into memory.
3. Call `host_call(reqPtr, reqLen, resPtr, resMaxLen)`.
4. Read the JSON response from memory.

### Import declaration (WAT)

```wat
(import "chattree" "host_call"
  (func $host_call (param i32 i32 i32 i32) (result i32))
)
```

### Request format (JSON string in memory)

```json
{
  "api": "storage",
  "operation": "set",
  "payload": { "key": "counter", "value": "42" }
}
```

### Response format (JSON string written by Chattree)

```json
{
  "success": true,
  "data": { "stored": true, "key": "counter", "value": "42" }
}
```

See [host-api.md](host-api.md) for all operations and their exact inputs/outputs.

---

## Step 7 — Package the plugin

A `.chattree-plugin` file is a standard **ZIP archive** containing:

```
plugin.json     ← manifest (required)
plugin.wasm     ← compiled WASM binary (required for runtime="wasm")
icon.png        ← optional icon (512×512 PNG recommended)
```

### Option A: Using the Chattree Developer Packager Tool

The official CLI tool automatically synchronizes the `wasmSha256` checksum and bundles the files at root level:

```bash
node tools/package-plugin.mjs path/to/my-hello-plugin/
```

### Option B: Using Standard ZIP Tools

Ensure `plugin.json` and `plugin.wasm` are at the **root** of the ZIP archive:

```bash
# Linux / macOS
zip -9 my-plugin.chattree-plugin plugin.json plugin.wasm

# Windows (PowerShell)
Compress-Archive -Path plugin.json, plugin.wasm -DestinationPath my-plugin.zip
Rename-Item my-plugin.zip my-plugin.chattree-plugin
```

> **Important**: The ZIP archive must contain `plugin.json` at the root (not inside a nested subdirectory).

---

## Step 8 — Import the plugin in Chattree

Transfer `my-plugin.chattree-plugin` to your Android device, then:

1. Open Chattree.
2. Go to **Settings → Plugins**.
3. Tap **Importar plugin** (Import plugin).
4. Select the `.chattree-plugin` file.
5. Chattree validates the manifest and shows a preview.
6. Tap **Instalar**.

---

## Step 9 — Grant permissions

Capabilities are enforced by Chattree’s permission gateway when the plugin calls the Host API. Consent prompts and OS permission flows depend on the capability, grant state, platform, and app version. Keep the declared set minimal and handle denied or unavailable operations. Confirm the current settings UI in the app release you target; labels and navigation can change.

---

## Step 10 — Execute the command

In any Chattree conversation, type:

```
/hello World
```

Chattree will:
1. Find the plugin registered under `/hello`.
2. Load `plugin.wasm`.
3. Call the exported `hello` function with input `"World"` written at offset 0.
4. Read the output from offset 1024.
5. Display the response: **`Hello, World`**

---

## Direct Markdown Output Formatting

Every Chattree plugin can return **pre-formatted Markdown** directly to the user (instead of raw JSON or plain unformatted text).

When your exported function or `resume()` writes formatted Markdown into the output buffer:
- **Direct Chat Rendering:** Chattree renders the output directly in the chat bubble using Flutter's rich Markdown engine (headers `###`, blockquotes `>`, bold `**`, bullet lists, emojis like 📅, 📝, 📊, and tables).
- **Secondary LLM Bypass:** If the returned text is formatted Markdown (i.e. does not start and end with `{ ... }` or `[ ... ]`), Chattree **automatically bypasses the second LLM generation pass**.
- **Deterministic UI & Zero Hallucination:** On mobile devices with local LLMs (1.5B–7B models), asking the AI to re-interpret tool output can cause hallucinations, corrupted characters, or weird symbols. Returning Markdown directly guarantees 100% deterministic, immediate, and beautiful visual presentation.

### Example Markdown Output Structure:
```markdown
### 📅 Evento agendado

> **Título:** Reunión con el equipo
> **Inicio:** 2026-10-29 15:00
> **Fin:** 2026-10-29 15:30

*Agendado correctamente en tu calendario.*
```

---

## Optional — Natural-language invocation

Chattree registers declared tool metadata, but natural-language invocation is mediated by the app’s intent interpreter and is not guaranteed for every provider or command. An `intentContract` can describe valid actions and fields (see [plugin-manifest.md](plugin-manifest.md)); test each supported provider and retain a usable slash-command path. Do not rely on a specific model JSON shape as a public runtime ABI.

---

## What next?

- Read [plugin-manifest.md](plugin-manifest.md) for every manifest field.
- Study [capabilities.md](capabilities.md) to learn what APIs you can access.
- See [examples/hello/](../../examples/hello) for the complete Hello example.
- See [examples/notes-demo/](../../examples/notes-demo) for a plugin that reads and creates Notes.
- Run the validator and packager from the cloned `chattree-repo` directory; examples assume that repository is your current working directory.
- Read [security.md](security.md) to understand the sandbox boundaries.
