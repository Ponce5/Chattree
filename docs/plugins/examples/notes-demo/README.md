# Example Plugin: /notes-demo

This example demonstrates how to use the **Chattree Notes API** from a WASM plugin.

It shows:
- How to import and call `chattree.host_call` from WAT.
- How to handle the **async round-trip** (notes operations are asynchronous).
- How to parse a JSON response in WASM.
- Real use of the `chattree.notes.create` and `chattree.notes.search` capabilities.

---

## What it does

| Command | Action |
|---------|--------|
| `/notes-demo save <title>` | Creates a new Chattree note with title `<title>` |
| `/notes-demo search <query>` | Searches notes and returns matching titles |
| `/notes-demo` | Shows usage |

---

## Required capabilities

```json
"capabilities": ["chattree.notes.create", "chattree.notes.search"]
```

The user will be prompted to grant these permissions on first use.

---

## Files

```
examples/notes-demo/
├── README.md          ← this file
├── plugin.json        ← manifest
└── plugin.wat         ← WASM source (WebAssembly Text format)
```

---

## How to use this example

### Step 1 — Compile WAT to WASM

```bash
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

Replace `REPLACE_WITH_SHA256_OF_YOUR_COMPILED_PLUGIN_WASM` with the actual hash.

### Step 4 — Package the Plugin

```bash
# Linux / macOS
zip notes-demo.chattree-plugin plugin.json plugin.wasm

# Windows PowerShell
Compress-Archive -Path plugin.json, plugin.wasm -DestinationPath notes-demo.chattree-plugin
```

---

## Host API calls used

### Create a note

**Request:**
```json
{
  "api": "chattree.notes",
  "operation": "create",
  "payload": {
    "title": "My Note Title",
    "content": "Note content here."
  }
}
```

**Response (success):**
```json
{
  "success": true,
  "data": {
    "note": {
      "id": "abc123",
      "title": "My Note Title",
      "content": "Note content here.",
      "createdAt": "2026-10-05T14:00:00.000Z",
      "updatedAt": "2026-10-05T14:00:00.000Z"
    }
  }
}
```

### Search notes

**Request:**
```json
{
  "api": "chattree.notes",
  "operation": "search",
  "payload": {
    "query": "meeting",
    "limit": 10
  }
}
```

**Response (success):**
```json
{
  "success": true,
  "data": {
    "notes": [
      {
        "id": "abc123",
        "title": "Team Meeting Notes",
        "content": "...",
        "createdAt": "2026-10-05T14:00:00.000Z",
        "updatedAt": "2026-10-05T14:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

---

## Permission denied handling

If the user has not granted `chattree.notes.create`, the response is:

```json
{
  "success": false,
  "error": "Permiso denegado: el plugin requiere \"chattree.notes.create\".",
  "data": {
    "permissionDenied": true,
    "missingCapabilities": ["chattree.notes.create"]
  }
}
```

Your WASM must check `success == false` and handle it gracefully.

---

## WAT skeleton for notes calls (for WAT developers)

This shows the minimum WASM structure for making an async Host API call:

```wat
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  (memory (export "memory") 4)

  ;; Input: offset 0
  ;; Output: offset 1024
  ;; Request buffer: offset 2048
  ;; Response buffer: offset 4096

  (func (export "notes_demo") (param $in_ptr i32) (param $in_len i32) (result i32)
    ;; 1. Build JSON request at offset 2048
    ;; {"api":"chattree.notes","operation":"create","payload":{"title":"..."}}

    ;; 2. Call host_call(reqPtr=2048, reqLen=N, resPtr=4096, resMaxLen=4096)
    (drop (call $host_call
      (i32.const 2048)  ;; reqPtr
      (i32.const 120)   ;; reqLen (length of your JSON)
      (i32.const 4096)  ;; resPtr
      (i32.const 4096)  ;; resMaxLen
    ))

    ;; Return 0 to signal async pending
    ;; Chattree will call resume(resPtr, resLen) when done
    (i32.const 0)
  )

  ;; Chattree calls resume after async operation completes
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    ;; 3. Parse response at $res_ptr
    ;; {"success":true,"data":{"note":{...}}}

    ;; 4. Write output to offset 1024
    ;; 5. Return output length

    ;; (simplified: echo the response back)
    (memory.copy (i32.const 1024) (local.get $res_ptr) (local.get $res_len))
    (local.get $res_len)
  )
)
```

---

## Testing checklist

Before distributing this plugin:

- [ ] Import `.chattree-plugin` in Chattree
- [ ] Grant `chattree.notes.create` and `chattree.notes.search` permissions
- [ ] Run `/notes-demo save My Test Note` → verify note appears in Chattree Notes
- [ ] Run `/notes-demo search test` → verify note is found
- [ ] Revoke `chattree.notes.create` permission → run `/notes-demo save X` → verify error shown
