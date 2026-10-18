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
