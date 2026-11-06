# Guides & Tutorials

Practical, step-by-step tutorials for building WebAssembly plugins and integrating with Chattree.

---

## Tutorial 1: Building a Minimal Plugin in WebAssembly Text Format (WAT)

This tutorial demonstrates how to build a `/greet <name>` plugin using only raw WAT.

### 1. Project Setup
Create a folder named `greet-plugin`:
```
greet-plugin/
├── plugin.json
└── plugin.wat
```

### 2. The Manifest (`plugin.json`)
```json
{
  "schemaVersion": 1,
  "id": "com.example.greet",
  "version": "1.0.0",
  "name": "Greeter",
  "description": "Greets user with an emphatic welcome.",
  "author": "Your Name",
  "primaryCommand": "greet",
  "aliases": [],
  "type": "imported",
  "capabilities": [],
  "runtime": "wasm",
  "entrypoint": "greet",
  "wasmPath": "plugin.wasm",
  "wasmSha256": "REPLACE_WITH_SHA256",
  "runtimeApiVersion": "1.0.0",
  "maxMemoryPages": 2,
  "timeoutMs": 5000,
  "fuelLimit": 50000000,
  "tools": [
    {
      "id": "com.example.greet.greet",
      "command": "greet",
      "displayName": "Greet",
      "description": "Greets you: /greet <name>",
      "capabilities": []
    }
  ]
}
```

### 3. The WebAssembly Logic (`plugin.wat`)
```wat
(module
  ;; Export 2 memory pages (128 KB)
  (memory (export "memory") 2)

  ;; Pre-load "Welcome to Chattree, " (21 bytes) at offset 1024
  (data (i32.const 1024) "Welcome to Chattree, ")

  ;; Exported function: (inputPtr, inputLen) -> outputLen
  (func (export "greet") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $prefix_len i32)
    (local.set $prefix_len (i32.const 21))

    ;; Copy the user's input string right after the prefix
    (memory.copy
      (i32.add (i32.const 1024) (local.get $prefix_len))
      (local.get $in_ptr)
      (local.get $in_len)
    )

    ;; Append exclamation mark "!"
    (i32.store8
      (i32.add
        (i32.add (i32.const 1024) (local.get $prefix_len))
        (local.get $in_len)
      )
      (i32.const 33)
    )

    ;; Return total output length: 21 + inputLen + 1
    (i32.add
      (i32.add (local.get $prefix_len) (local.get $in_len))
      (i32.const 1)
    )
  )
)
```

### 4. Compiling & Packaging
```bash
# 1. Compile WAT to binary WASM
wat2wasm plugin.wat -o plugin.wasm

# 2. Compute SHA-256
# On Linux/macOS:
sha256sum plugin.wasm
# On Windows PowerShell:
# Get-FileHash plugin.wasm -Algorithm SHA256

# 3. Update "wasmSha256" in plugin.json with the generated 64-char hash

# 4. Create package
zip greet.chattree-plugin plugin.json plugin.wasm
```

---

## Tutorial 2: Building a Plugin in Rust (`wasm32-unknown-unknown`)

Rust provides memory safety, easy string handling, and `serde_json` for interacting with the Host API.

### 1. Initialize Rust Project
```bash
cargo new --lib chattree_counter
cd chattree_counter
```

### 2. Configure `Cargo.toml`
```toml
[package]
name = "chattree_counter"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
serde = { version = "1.0", default-features = false, features = ["derive", "alloc"] }
serde_json = { version = "1.0", default-features = false, features = ["alloc"] }

[profile.release]
opt-level = "s"
lto = true
```

### 3. Implement Counter Logic (`src/lib.rs`)
```rust
use std::slice;
use std::str;

// Import the Chattree Host API bridge function
extern "C" {
    fn host_call(req_ptr: i32, req_len: i32, res_ptr: i32, res_max_len: i32) -> i32;
}

// Global static buffer for output (starts at offset 1024 convention)
static mut OUTPUT_BUFFER: [u8; 8192] = [0; 8192];
static mut RES_BUFFER: [u8; 4096] = [0; 4096];

#[no_mangle]
pub extern "C" fn count(input_ptr: *const u8, input_len: usize) -> i32 {
    let _input = unsafe {
        let bytes = slice::from_raw_parts(input_ptr, input_len);
        str::from_utf8(bytes).unwrap_or("")
    };

    // 1. Fetch current counter from storage
    let get_req = r#"{"api":"storage","operation":"get","payload":{"key":"visits"}}"#;
    let mut current_val = 0;

    unsafe {
        let len = host_call(
            get_req.as_ptr() as i32,
            get_req.len() as i32,
            RES_BUFFER.as_mut_ptr() as i32,
            RES_BUFFER.len() as i32,
        );

        if len > 0 {
            if let Ok(res_str) = str::from_utf8(&RES_BUFFER[..len as usize]) {
                // Parse: {"success":true,"data":{"value":"5"}}
                if let Some(pos) = res_str.find("\"value\":\"") {
                    let rest = &res_str[pos + 9..];
                    if let Some(end) = rest.find('"') {
                        current_val = rest[..end].parse::<i32>().unwrap_or(0);
                    }
                }
            }
        }
    }

    current_val += 1;

    // 2. Save incremented counter
    let set_req = format!(
        r#"{{"api":"storage","operation":"set","payload":{{"key":"visits","value":"{}"}}}}"#,
        current_val
    );
    unsafe {
        host_call(
            set_req.as_ptr() as i32,
            set_req.len() as i32,
            RES_BUFFER.as_mut_ptr() as i32,
            RES_BUFFER.len() as i32,
        );
    }

    // 3. Format response string
    let response = format!("You have called this command {} times!", current_val);
    let bytes = response.as_bytes();

    unsafe {
        let len = bytes.len().min(OUTPUT_BUFFER.len());
        OUTPUT_BUFFER[..len].copy_from_slice(&bytes[..len]);
        len as i32
    }
}
```

### 4. Build and Package
```bash
# Build target
cargo build --target wasm32-unknown-unknown --release

# Copy and rename wasm
cp target/wasm32-unknown-unknown/release/chattree_counter.wasm plugin.wasm

# Compute SHA-256 and package with plugin.json
sha256sum plugin.wasm
zip counter.chattree-plugin plugin.json plugin.wasm
```

---

## Tutorial 3: Making Outbound HTTP Calls with `network.http`

When fetching data from public APIs:
1. Declare `"capabilities": ["network.http"]` in `plugin.json`.
2. Ensure your target URL uses `https://` (unencrypted `http://` is restricted).
3. Do not attempt to query `localhost` or internal LAN IPs (SSRF guard blocks private addresses).
4. `network.http_request` is asynchronous:
   - Call `host_call` → receives `0`.
   - Implement exported `resume(resPtr, resLen)` to receive the response.

---

## Tutorial 4: Real-Time Sockets with `network.websocket`

This tutorial walks through building a real-time event listener or bridge plugin.

### 1. Requirements & Capabilities
Declare `network.websocket` in `plugin.json`. If your plugin connects to a local gateway on your home Wi-Fi (e.g. Home Assistant or local bridge), also declare the critical capability `network.local`.

```json
{
  "capabilities": ["network.websocket"]
}
```

### 2. Handshake & Connection Pooling
Chattree manages a connection pool allowing up to **10 concurrent sockets per plugin**:
1. When calling `websocket.connect`, Chattree **pre-reserves connection capacity atomically** before beginning the network handshake. This prevents quota race conditions when multiple handshakes initiate simultaneously.
2. If the connection fails or times out, the reservation is immediately released.
3. Keep-alive heartbeat pings are handled automatically via `pingIntervalSeconds` (default 30 seconds).

### 3. Inbound Frame Buffering & Size Limits
- Inbound frames are buffered in an in-memory queue holding up to **500 messages**.
- Use `websocket.receive` (or `websocket.poll`) with `maxMessages: 50` to periodically drain the queue.
- **16 MB Frame Ceiling:** Individual frames exceeding **16 MB** are rejected and terminate the socket with RFC 6455 close status code **`1009`** to protect mobile RAM.

### 4. Teardown
Always close unused connections via `websocket.close`. If your plugin crashes or is disabled, Chattree's lifecycle manager automatically purges and terminates all open sockets.

---

## Tutorial 5: Building Interactive Dashboards with `ui.components`

Chattree plugins can move beyond plain text or Markdown by emitting rich declarative UI cards.

### 1. Declaring Capability
Add `ui.components` to `capabilities` in `plugin.json`.

### 2. The Declarative Card Model
Your WASM binary can write a structured JSON card directly to linear memory offset 1024 as a `ToolResult.ui`:

```json
{
  "type": "card",
  "displayText": "Deployment #42",
  "ui": {
    "title": "Continuous Deployment",
    "elements": [
      { "type": "badge", "text": "RUNNING", "variant": "warning" },
      { "type": "progress", "value": 60, "label": "Deploying containers..." },
      {
        "type": "key_value",
        "items": [
          { "label": "Service", "value": "api-gateway" },
          { "label": "Revision", "value": "v2.4.1" }
        ]
      },
      { "type": "divider" },
      {
        "type": "button_row",
        "buttons": [
          { "label": "Cancel Build", "action": "command", "payload": "/build cancel 42", "variant": "danger" }
        ]
      }
    ]
  }
}
```

### 3. Card Constraints & Safety
- **Density Bounds:** Each card supports up to **60 elements**, **40 key-value items**, and **8 buttons per row**.
- **Sanitization:** All nodes pass through `UiApiHandler.sanitizeUiCard` to strip malicious scripts or malformed nodes.
- **Security Confirmation Dialog:** Any button with `action: "command"` that targets a slash command (starts with `/`) triggers an explicit confirmation dialog showing the user the exact command before sending it to the chat.

---

## Tutorial 6: Background Automation with `scheduler.task`

This tutorial shows how to schedule recurrent jobs and receive event callbacks.

### 1. Manifest Configuration
Use `schemaVersion: 2` and declare `scheduler.task`:

```json
{
  "schemaVersion": 2,
  "capabilities": ["scheduler.task", "notifications.send"],
  "eventConsumers": [
    {
      "id": "morning_check",
      "eventTypes": ["scheduler.trigger"],
      "targetAction": "run_morning_check"
    }
  ]
}
```

### 2. Cron Syntax & Wall-Clock Evaluation
Chattree evaluates 5-field Cron expressions:
`minute (0-59) hour (0-23) day (1-31) month (1-12) weekday (0-6)`

Examples:
- `*/15 * * * *` — Every 15 minutes
- `0 9 * * *` — Every day at 9:00 AM
- `0 18 * * 1-5` — Weekdays at 6:00 PM

### 3. Anti-Battery Drain Guard
To protect device battery and prevent runaway loops, Chattree strictly enforces a **60-second minimum interval**. Any schedule attempting to run faster than once per 60 seconds is rejected with `minimumIntervalViolation`.

### 4. Lifecycle & Quotas
Plugins can register up to **25 active scheduled tasks** with payloads up to **128 KB**. All tasks are automatically cleaned up when the plugin is uninstalled.

---

## Tutorial 7: Relational Data Persistence with `database.sql`

For complex data structures, Chattree provisions a private SQLite database for your plugin.

### 1. Private Database Isolation
Each plugin has a dedicated SQLite database (`plugin_<pluginId>.db`). No other plugin or host service can read or alter your tables.

### 2. Executing Queries & Transactions
- **DDL & DML:** Use `database.execute` for `CREATE TABLE`, `INSERT`, `UPDATE`, `DELETE`.
- **Queries:** Use `database.query` for `SELECT`. Queries return up to **2,000 rows** per call.
- **Batch Transactions:** Use `database.transaction` with multiple statements. If any statement fails, the entire batch rolls back atomically.

### 3. Type Normalization
You can pass native types in `params` or `values`:
- Booleans (`true`/`false`) are automatically converted to `1`/`0`.
- Maps and Lists are serialized to valid JSON strings.

### 4. Storage Quota (200 MB)
Chattree enforces a **200 MB quota** measuring the primary `.db` file plus SQLite write-ahead log files (`.db-wal`, `.db-shm`, and `.db-journal`). If your database approaches 200 MB, delete obsolete rows or run `VACUUM`. Dangerous SQL commands (`ATTACH DATABASE`, `DETACH DATABASE`, `VACUUM INTO`, and `PRAGMA writable_schema`) are blocked.

---

## Best Practices: Memory & Buffer Management in Rust / C

When building plugins in Rust or C, understanding linear memory layout and UTF-8 safety is critical to prevent crashes, fuel exhaustion, or memory corruption.

### 1. The Linear Memory Layout
Chattree uses a well-defined shared memory convention:
- **Offset `0` to `1023`**: Reserved for input strings passed from Chattree.
- **Offset `1024` onwards**: Destination for plugin output text.
- **High Offsets (e.g. `2048`, `4096`)**: Request and response scratch buffers for Host API calls.

### 2. Preventing Buffer Overflow on Output
Writing past the allocated linear memory space causes runtime traps (`out of bounds memory access`).

```rust
// Static output buffer sized appropriately
static mut OUTPUT_BUFFER: [u8; 16384] = [0; 16384]; // 16 KB

#[no_mangle]
pub extern "C" fn my_command(input_ptr: *const u8, input_len: usize) -> i32 {
    let result_string = generate_large_report();
    let bytes = result_string.as_bytes();

    unsafe {
        // Enforce boundary check against maximum buffer size
        let copy_len = bytes.len().min(OUTPUT_BUFFER.len());
        OUTPUT_BUFFER[..copy_len].copy_from_slice(&bytes[..copy_len]);
        copy_len as i32
    }
}
```

### 3. Safe UTF-8 Boundary Handling
Never slice a UTF-8 byte stream at arbitrary indices. If a multi-byte Unicode character (e.g. emojis or accented characters) is split mid-codepoint, `std::str::from_utf8` will fail or produce replacement characters (``).

```rust
/// Truncates a UTF-8 string safely at the nearest valid character boundary.
fn safe_truncate_utf8(s: &str, max_bytes: usize) -> &str {
    if max_bytes >= s.len() {
        return s;
    }
    let mut boundary = max_bytes;
    while boundary > 0 && !s.is_char_boundary(boundary) {
        boundary -= 1;
    }
    &s[..boundary]
}
```

### 4. Memory Growth & Page Allocation
Each WebAssembly memory page represents **64 KB**. If your plugin processes large datasets, ensure `plugin.json` allocates sufficient pages:

```json
{
  "maxMemoryPages": 8  // 8 pages = 512 KB
}
```

In Rust, the default allocator (`wee_alloc` or standard `dlmalloc`) will grow linear memory via the `memory.grow` instruction automatically within the limit defined by `maxMemoryPages` (up to 1024 pages / 64 MB).

