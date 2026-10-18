# Example Plugin: /hello

This is the simplest possible Chattree plugin.

It:
- Accepts any text input.
- Returns a greeting: `Hello, <input>!`
- Uses **no capabilities** (no network, no storage, no device data).

---

## Files

```
examples/hello/
├── README.md          ← this file
├── plugin.json        ← manifest
└── plugin.wat         ← WASM source (WebAssembly Text format)
```

---

## How to use this example

### Step 1 — Compile WAT to WASM

```bash
# Install wabt: https://github.com/WebAssembly/wabt
wat2wasm plugin.wat -o plugin.wasm
```

### Step 2 — Compute SHA-256

```bash
# Linux / macOS
sha256sum plugin.wasm

# Windows PowerShell
Get-FileHash plugin.wasm -Algorithm SHA256
```

### Step 3 — Update plugin.json

Replace `REPLACE_WITH_SHA256` in `plugin.json` with the actual SHA-256 value.

### Step 4 — Package

```bash
zip hello.chattree-plugin plugin.json plugin.wasm
```

### Step 5 — Import in Chattree

1. Transfer `hello.chattree-plugin` to your Android device.
2. **Settings → Plugins → Importar plugin**.
3. Select the file → **Instalar**.

### Step 6 — Test

```
/hello World
```

Expected output: `Hello, World!`

---

## Understanding the WASM code

```wat
(module
  (memory (export "memory") 2)      ;; 2 pages = 128 KB linear memory

  ;; Pre-load "Hello, " at offset 1024 (the output start)
  (data (i32.const 1024) "Hello, ")

  ;; Exported function called by Chattree:
  ;;   param $in_ptr  = where Chattree wrote the input string
  ;;   param $in_len  = byte length of the input
  ;;   returns        = total output length
  (func (export "hello") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $prefix_len i32)
    (local $suffix_len i32)

    ;; "Hello, " is 7 bytes
    (local.set $prefix_len (i32.const 7))

    ;; Copy input after "Hello, " (at offset 1024 + 7 = 1031)
    (memory.copy
      (i32.add (i32.const 1024) (local.get $prefix_len))
      (local.get $in_ptr)
      (local.get $in_len)
    )

    ;; Append "!" after the input
    (i32.store8
      (i32.add
        (i32.add (i32.const 1024) (local.get $prefix_len))
        (local.get $in_len)
      )
      (i32.const 33)  ;; ASCII '!'
    )

    ;; Return total length: 7 + inputLen + 1
    (i32.add
      (i32.add (local.get $prefix_len) (local.get $in_len))
      (i32.const 1)
    )
  )
)
```

### Memory layout

```
Offset 0:    [ input written by Chattree ]  → "World"
Offset 1024: [ output written by plugin ]   → "Hello, World!"
```

Chattree reads the output from offset 1024 for the returned length bytes.
