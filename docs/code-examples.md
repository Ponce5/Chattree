# Code Examples

Complete, copy-pasteable, verified code examples demonstrating WebAssembly plugin patterns for Chattree.

---

## 1. Minimal Echo / Greeter Plugin (WAT)

A lightweight WebAssembly plugin that receives user input, prepends a greeting, and returns the result without requesting capabilities.

### `plugin.json`
```json
{
  "schemaVersion": 1,
  "id": "com.example.echo",
  "version": "1.0.0",
  "name": "Echo Plugin",
  "description": "Echoes back your text input.",
  "author": "Chattree Team",
  "primaryCommand": "echo",
  "aliases": ["say"],
  "type": "imported",
  "capabilities": [],
  "runtime": "wasm",
  "entrypoint": "run",
  "wasmPath": "plugin.wasm",
  "wasmSha256": "REPLACE_WITH_SHA256",
  "runtimeApiVersion": "1.0.0",
  "maxMemoryPages": 2,
  "timeoutMs": 5000,
  "fuelLimit": 50000000,
  "tools": [
    {
      "id": "com.example.echo.run",
      "command": "echo",
      "displayName": "Echo",
      "description": "Echoes your text: /echo <text>",
      "capabilities": []
    }
  ]
}
```

### `plugin.wat`
```wat
(module
  (memory (export "memory") 2)
  (data (i32.const 1024) "Echo: ")

  (func (export "run") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $prefix_len i32)
    (local.set $prefix_len (i32.const 6))

    ;; Copy input after "Echo: "
    (memory.copy
      (i32.add (i32.const 1024) (local.get $prefix_len))
      (local.get $in_ptr)
      (local.get $in_len)
    )

    ;; Total length = prefix_len + in_len
    (i32.add (local.get $prefix_len) (local.get $in_len))
  )
)
```

---

## 2. Private Key-Value Storage Counter (WAT)

Demonstrates synchronous Host API calls with `storage.get` and `storage.set`.

### `plugin.json`
```json
{
  "schemaVersion": 1,
  "id": "com.example.counter",
  "version": "1.0.0",
  "name": "Visit Counter",
  "description": "Tracks how many times you invoke the command.",
  "author": "Chattree Team",
  "primaryCommand": "counter",
  "aliases": [],
  "type": "imported",
  "capabilities": ["storage.private"],
  "runtime": "wasm",
  "entrypoint": "counter",
  "wasmPath": "plugin.wasm",
  "wasmSha256": "REPLACE_WITH_SHA256",
  "runtimeApiVersion": "1.0.0",
  "maxMemoryPages": 4,
  "tools": [
    {
      "id": "com.example.counter.counter",
      "command": "counter",
      "displayName": "Counter",
      "description": "Tracks invocations: /counter",
      "capabilities": ["storage.private"]
    }
  ]
}
```

---

## 3. Asynchronous HTTP API Requester (JSON Contract)

Demonstrates how to structure async Host API round-trips with `chattree.host_call` and `resume`.

### Lifecycle Diagram
```text
Chattree                      Plugin WASM
   │                              │
   │── call entrypoint(0, len) ──►│
   │                              │ (writes HTTP JSON request to memory)
   │◄── host_call(req, res) ──────│
   │    returns 0 (async pending) │
   │◄── returns 0 ────────────────│
   │                              │
(performs HTTP fetch)             │
   │                              │
   │── resume(resPtr, resLen) ───►│
   │                              │ (reads JSON response, formats result)
   │◄── returns outputLen ────────│
```

### Request Payload (`network.http_request`)
```json
{
  "api": "network",
  "operation": "http_request",
  "payload": {
    "url": "https://api.github.com/zen",
    "method": "GET",
    "headers": {
      "User-Agent": "Chattree-Plugin"
    }
  }
}
```

### Response Payload Received in `resume`
```json
{
  "success": true,
  "data": {
    "statusCode": 200,
    "headers": { "content-type": "text/plain; charset=utf-8" },
    "body": "Non-blocking is better than blocking."
  }
}
```

---

## 4. Chattree Notes Quick-Save Plugin

Demonstrates programmatic creation of a note via `chattree.notes.create`.

### Request Payload (`chattree.notes.create`)
```json
{
  "api": "chattree.notes",
  "operation": "create",
  "payload": {
    "title": "Quick Thought",
    "content": "Captured via slash command."
  }
}
```

### Successful Response
```json
{
  "success": true,
  "data": {
    "note": {
      "id": "not_104f98e21a",
      "title": "Quick Thought",
      "content": "Captured via slash command.",
      "createdAt": "2026-10-14T19:30:00.000Z",
      "updatedAt": "2026-10-14T19:30:00.000Z"
    }
  }
}
```
