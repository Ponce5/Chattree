# Notification Smart Tracker & Responder Example

This developer example demonstrates how to leverage Chattree's **Notification Hub** architecture to:
1. Request notification permissions and capabilities (`notifications.read`, `notifications.query`, `notifications.reply`, `notifications.action`).
2. Manage custom relational tables inside your plugin's private, sandboxed SQLite database (`database.sql` / `storage.database`).
3. Subscribe to real-time `device.notification.received` events delivered over `HostEventBus`.
4. Check whether a notification has an inline reply action (`hasReplyAction: true`) and send automated or user-directed replies using Android's native `RemoteInput` via `notifications.reply`.
5. Dismiss active notifications via `notifications.dismiss`.

---

## Architecture Overview

```text
Android System (Status Bar)
    ↓ NotificationListenerService (drops OTP/2FA natively)
Chattree Host Bridge (Kotlin)
    ↓ EventChannel + 200ms debounce
Chattree Core (DeviceNotificationService)
    ↓ HostEventBus ('device.notification.received')
WASM Plugin (com.chattree.notification.tracker)
    ├── 1. Saves to private SQLite (database.insert -> plugin_com_chattree_notification_tracker.db)
    └── 2. Sends reply if configured (notifications.reply -> Android RemoteInput)
```

---

## 1. Capabilities Declaration

In `plugin.json`, declare the required capabilities:

```json
"capabilities": [
  "notifications.read",
  "notifications.query",
  "notifications.reply",
  "notifications.action",
  "database.sql",
  "storage.database",
  "ai.context"
]
```

---

## 2. Setting Up the Private SQLite Database

Upon initialization or first execution, create your private schema using `database.execute`:

```json
{
  "api": "database",
  "operation": "execute",
  "payload": {
    "sql": "CREATE TABLE IF NOT EXISTS notification_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, logical_id TEXT UNIQUE, package_name TEXT, title TEXT, body TEXT, category TEXT, can_reply INTEGER, created_at INTEGER);"
  }
}
```

---

## 3. Handling Incoming Notification Events

When `device.notification.received` arrives on `HostEventBus`, record it in your private SQLite database:

```json
{
  "api": "database",
  "operation": "insert",
  "payload": {
    "table": "notification_logs",
    "values": {
      "logical_id": "com.whatsapp_101_thread_42",
      "package_name": "com.whatsapp",
      "title": "Alice Smith",
      "body": "Can you check the latest report?",
      "category": "msg",
      "can_reply": 1,
      "created_at": 1711234567890
    }
  }
}
```

---

## 4. Querying Active Status Bar Notifications

Check the connection status and list currently active notifications:

### 4.1. Check Service Status
```json
{
  "api": "notifications",
  "operation": "getStatus",
  "payload": {}
}
```
**Response:**
```json
{
  "status": "active"
}
```

### 4.2. Query Active Notifications
```json
{
  "api": "notifications",
  "operation": "getActive",
  "payload": {}
}
```

---

## 5. Direct Reply via Android RemoteInput

If `hasReplyAction` is `true`, dispatch a direct reply:

```json
{
  "api": "notifications",
  "operation": "reply",
  "payload": {
    "notificationKey": "com.whatsapp_101_thread_42",
    "reply": "I'll review the report right away!"
  }
}
```

> **Safety note:**
> - The maximum reply message length is **4,000 characters** to protect against Android Binder buffer exhaustion (`TransactionTooLargeException`).
> - The target notification must still be alive in Android's ephemeral RAM `LruCache`.

---

## 6. Dismissing Notifications

To remove a clearable notification from the system status bar:

```json
{
  "api": "notifications",
  "operation": "dismiss",
  "payload": {
    "notificationKey": "com.whatsapp_101_thread_42"
  }
}
```

---

## 7. Privacy & Security Rules

1. **OTP & 2FA:** Chattree's native layer automatically redacts and drops all one-time passwords, verification codes, and security notices before they reach plugins.
2. **Zero Core Persistence:** Chattree does not store notification bodies in host databases. All logs belong to your plugin's private sandbox.
3. **Data Retention:** Implement a periodic cleanup query (e.g. `DELETE FROM notification_logs WHERE created_at < ?`) to purge old records.
