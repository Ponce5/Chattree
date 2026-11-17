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

---

## 5. Real-Time WebSocket Streaming Client (`network.websocket`)

Demonstrates establishing a bidirectional WebSocket connection, dispatching structured messages, polling the in-memory buffer (up to 500 frames), and closing cleanly.

### `plugin.json` snippet
```json
{
  "schemaVersion": 1,
  "id": "com.example.streamer",
  "version": "1.0.0",
  "name": "Live Streamer",
  "primaryCommand": "stream",
  "capabilities": ["network.websocket"],
  "entrypoint": "run"
}
```

### Step 1: Connect (`websocket.connect`)
```json
{
  "api": "websocket",
  "operation": "connect",
  "payload": {
    "url": "wss://echo.websocket.events",
    "headers": {
      "X-Client-Version": "1.0.0"
    },
    "timeoutMs": 15000
  }
}
```
*Successful Response:*
```json
{
  "success": true,
  "data": {
    "socketId": "ws_com.example.streamer_1",
    "connected": true,
    "url": "wss://echo.websocket.events",
    "protocol": null
  }
}
```

### Step 2: Send Message (`websocket.send`)
```json
{
  "api": "websocket",
  "operation": "send",
  "payload": {
    "socketId": "ws_com.example.streamer_1",
    "data": "{\"action\":\"subscribe\",\"topic\":\"crypto_ticker\"}",
    "isBinary": false
  }
}
```
*Successful Response:*
```json
{
  "success": true,
  "data": {
    "sent": true,
    "socketId": "ws_com.example.streamer_1"
  }
}
```

### Step 3: Poll Inbound Messages (`websocket.receive` / `websocket.poll`)
```json
{
  "api": "websocket",
  "operation": "receive",
  "payload": {
    "socketId": "ws_com.example.streamer_1",
    "limit": 10
  }
}
```
*Successful Response:*
```json
{
  "success": true,
  "data": {
    "socketId": "ws_com.example.streamer_1",
    "messages": [
      {
        "isBinary": false,
        "data": "{\"topic\":\"crypto_ticker\",\"price\":68500.50}"
      }
    ],
    "count": 1,
    "remainingInQueue": 0,
    "isOpen": true
  }
}
```

### Step 4: Close Connection (`websocket.close`)
```json
{
  "api": "websocket",
  "operation": "close",
  "payload": {
    "socketId": "ws_com.example.streamer_1",
    "code": 1000,
    "reason": "Normal stream termination"
  }
}
```
*Successful Response:*
```json
{
  "success": true,
  "data": {
    "closed": true,
    "socketId": "ws_com.example.streamer_1"
  }
}
```

---

## 6. Declarative Interactive UI Card (`ui.components` / `ui.render`)

Demonstrates returning a rich declarative UI card containing a status badge, a progress bar, formatted key-value metrics, and action buttons (`command`, `url`, and `copy`).

### `plugin.json` snippet
```json
{
  "schemaVersion": 1,
  "id": "com.example.dashboard",
  "version": "1.0.0",
  "name": "Cloud Monitor",
  "primaryCommand": "monitor",
  "capabilities": ["ui.components"],
  "entrypoint": "run"
}
```

### Direct WASM Execution Output (`ToolResult.ui`)
The plugin writes this JSON to linear memory (or returns it via ABI v2):

```json
{
  "type": "ui",
  "displayText": "Production Server Status: Operational",
  "ui": {
    "title": "Cloud Cluster EU-West",
    "subtitle": "Node health & resource allocation",
    "badge": "HEALTHY",
    "badgeColor": "green",
    "icon": "analytics",
    "hideText": true,
    "elements": [
      {
        "type": "badge",
        "text": "OPERATIONAL",
        "color": "green"
      },
      {
        "type": "progress",
        "value": 0.725,
        "label": "CPU & Memory Load",
        "color": "blue"
      },
      {
        "type": "key_value",
        "items": [
          { "key": "Region", "value": "eu-central-1" },
          { "key": "Active Pods", "value": "48 / 50" },
          { "key": "Latency", "value": "18 ms" },
          { "key": "Uptime", "value": "99.98%" }
        ]
      },
      {
        "type": "divider"
      },
      {
        "type": "button_row",
        "buttons": [
          {
            "label": "Grafana Dashboard",
            "action": "url",
            "value": "https://grafana.example.com/d/cluster-eu",
            "style": "secondary"
          },
          {
            "label": "Copy Cluster IP",
            "action": "copy",
            "value": "10.240.0.1",
            "style": "secondary"
          },
          {
            "label": "Restart Pods",
            "action": "command",
            "value": "/monitor restart eu-west",
            "style": "danger",
            "confirm": true
          }
        ]
      }
    ]
  }
}
```

> **Security Note:** Clicking the **Restart Pods** button (`action: "command"` with target `/monitor restart eu-west`) automatically triggers Chattree's **Security Confirmation Modal** before execution, allowing the user to review the command and confirm with one tap.

---

## 7. Scheduled Cron Task & EventBus Ingestion (`scheduler.task`)

Demonstrates scheduling a recurring background job using standard 5-part Cron syntax with anti-battery drain enforcement (minimum 60-second interval).

### `plugin.json` manifest with Event Consumer
```json
{
  "schemaVersion": 2,
  "id": "com.example.notifier",
  "version": "1.0.0",
  "name": "Daily Digest Scheduler",
  "primaryCommand": "digest",
  "capabilities": ["scheduler.task", "notifications.send"],
  "entrypoint": "run",
  "tools": [
    {
      "id": "com.example.notifier.handle_cron",
      "command": "digest",
      "displayName": "Daily Digest",
      "description": "Runs daily digest task",
      "capabilities": ["scheduler.task", "notifications.send"]
    }
  ],
  "eventConsumers": [
    {
      "id": "cron_trigger_handler",
      "eventTypes": ["scheduler.trigger"],
      "targetAction": "com.example.notifier.handle_cron"
    }
  ]
}
```

### Schedule Task (`scheduler.schedule`)
```json
{
  "api": "scheduler",
  "operation": "schedule",
  "payload": {
    "taskId": "daily_morning_digest",
    "targetAction": "com.example.notifier.handle_cron",
    "cronExpression": "0 8 * * *",
    "payload": {
      "channel": "daily_summary",
      "includeWeather": true
    }
  }
}
```
*Successful Response:*
```json
{
  "success": true,
  "data": {
    "scheduled": true,
    "taskId": "daily_morning_digest",
    "targetAction": "com.example.notifier.handle_cron",
    "isPeriodic": true,
    "createdAt": "2026-11-05T12:00:00.000Z"
  }
}
```

### Event Received in Plugin via `HostEventBus` (`scheduler.trigger`)
When the clock strikes 8:00 AM, Chattree invokes `com.example.notifier.handle_cron` with:
```json
{
  "type": "scheduler.trigger",
  "data": {
    "taskId": "daily_morning_digest",
    "pluginId": "com.example.notifier",
    "targetAction": "com.example.notifier.handle_cron",
    "payload": {
      "channel": "daily_summary",
      "includeWeather": true
    },
    "runCount": 1,
    "isPeriodic": true
  }
}
```

---

## 8. Relational SQLite Storage & Batch Transactions (`database.sql`)

Demonstrates creating tables, inserting parameterized records, querying with filters, and executing atomic batch transactions in the plugin's dedicated private database (`plugin_<pluginId>.db`).

### `plugin.json` snippet
```json
{
  "schemaVersion": 1,
  "id": "com.example.inventory",
  "version": "1.0.0",
  "name": "Inventory Manager",
  "primaryCommand": "stock",
  "capabilities": ["database.sql"],
  "entrypoint": "run"
}
```

### Step 1: Create Table (`database.execute`)
```json
{
  "api": "database",
  "operation": "execute",
  "payload": {
    "sql": "CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT UNIQUE, name TEXT, stock INTEGER, price REAL, in_stock INTEGER, tags TEXT, updated_at INTEGER)"
  }
}
```
*Successful Response:*
```json
{
  "success": true,
  "data": {
    "executed": true,
    "result": 0
  }
}
```

### Step 2: Insert Records (`database.insert`)
Automatic type normalization converts `in_stock: true` to `1` and the array `tags` to a JSON string:
```json
{
  "api": "database",
  "operation": "insert",
  "payload": {
    "table": "products",
    "values": {
      "sku": "KB-MEC-RGB",
      "name": "Mechanical Gaming Keyboard",
      "stock": 45,
      "price": 89.99,
      "in_stock": true,
      "tags": ["hardware", "peripherals", "gaming"],
      "updated_at": 1793880000000
    }
  }
}
```
*Successful Response:*
```json
{
  "success": true,
  "data": {
    "inserted": true,
    "id": 1,
    "table": "products"
  }
}
```

### Step 3: Query Records (`database.query`)
```json
{
  "api": "database",
  "operation": "query",
  "payload": {
    "sql": "SELECT id, sku, name, stock, price FROM products WHERE stock < ? ORDER BY stock ASC LIMIT 10",
    "args": [50]
  }
}
```
*Successful Response:*
```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "id": 1,
        "sku": "KB-MEC-RGB",
        "name": "Mechanical Gaming Keyboard",
        "stock": 45,
        "price": 89.99
      }
    ],
    "count": 1,
    "limit": 2000
  }
}
```

### Step 4: Atomic Batch Transaction (`database.transaction`)
Executes multiple SQL statements atomically. If any statement encounters an error, all changes rollback immediately:
```json
{
  "api": "database",
  "operation": "transaction",
  "payload": {
    "operations": [
      {
        "sql": "UPDATE products SET stock = stock - 1 WHERE sku = ?",
        "args": ["KB-MEC-RGB"]
      },
      {
        "sql": "INSERT INTO sales_log (sku, quantity, created_at) VALUES (?, ?, ?)",
        "args": ["KB-MEC-RGB", 1, 1793880050000]
      }
    ]
  }
}
```
*Successful Response:*
```json
{
  "success": true,
  "data": {
    "transaction": true,
    "results": [1, 1],
    "operationCount": 2
  }
}
```
