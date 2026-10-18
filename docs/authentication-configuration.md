# Authentication & Configuration Guide

This guide details how credentials, API keys, plugin configuration, and device permissions are managed securely within Chattree.

---

## 1. Security Architecture for External Credentials

When users configure cloud providers (OpenAI, Google Gemini, Anthropic Claude), credentials must be protected against malicious apps, physical extraction, and inadvertent leaks.

```
┌─────────────────────────────────────────────────────────────┐
│                          User Input                         │
│       Settings → AI Providers → Enter API Key               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    SecureCredentialStore                    │
│   - Strips leading/trailing whitespace                     │
│   - Validates key format (e.g. sk-..., AIza...)             │
│   - Disallows logging (debugPrint strips values)            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Hardware-Backed Operating System Keystore       │
│   Android: EncryptedSharedPreferences (AES-256 GCM)         │
│   iOS: Apple Keychain Services                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Security Commitments
- **Zero Intermediary Relays:** Chattree runs no proxy servers. API calls connect directly from the user's phone to the provider's official HTTPS domain.
- **Never Logged:** The `SecureCredentialStore` guarantees that API keys and authentication tokens are never written to disk logs, crash reports, or debug outputs.
- **Excluded from Cloud Backups:** Storage files are flagged with `allowBackup="false"` to prevent unencrypted cloud sync via Google Drive or iCloud device backups.

---

## 2. Plugin Configuration & User Settings

Plugins can declare configurable parameters in their `plugin.json` manifest:

```json
"settings": [
  {
    "key": "api_endpoint",
    "label": "Custom API Endpoint",
    "type": "string",
    "defaultValue": "https://api.example.com/v1",
    "description": "The base URL for custom remote services."
  },
  {
    "key": "auth_token",
    "label": "API Token",
    "type": "string",
    "isSecret": true,
    "description": "Personal access token for remote authentication."
  },
  {
    "key": "timeout_seconds",
    "label": "Request Timeout",
    "type": "number",
    "defaultValue": 10,
    "description": "Timeout in seconds for external requests."
  },
  {
    "key": "theme_preference",
    "label": "Result Style",
    "type": "select",
    "defaultValue": "compact",
    "options": ["compact", "detailed", "json"],
    "description": "Format for displayed results."
  }
]
```

### Supported Setting Field Types

| Type | UI Presentation | Stored Value |
|---|---|---|
| `string` | Single-line text input | String |
| `number` | Numeric keyboard input | Number |
| `boolean`| Switch / Toggle | Boolean |
| `select` | Dropdown picker (`options` required) | String |

### Handling Secrets (`isSecret: true`)
When `isSecret: true` is configured:
- The UI masks the value using a password field (`••••••••`).
- The value is stored inside the plugin's isolated sandbox storage.
- It can be read programmatically by the plugin at runtime via `storage.get`.

### Reading Settings from WebAssembly
Settings values are stored in the plugin's private key-value namespace. The plugin reads them synchronously:

```json
{
  "api": "storage",
  "operation": "get",
  "payload": { "key": "auth_token" }
}
```

Response:
```json
{
  "success": true,
  "data": { "key": "auth_token", "value": "secret_token_12345", "exists": true }
}
```

---

## 3. Dynamic Capability & Permission Lifecycle

Chattree categorizes capabilities into three danger tiers:

### Danger Tiers

| Level | Badge | Permissions Included | User Consent Mechanism |
|---|---|---|---|
| **Normal** | 🟢 | `storage.private`, `share.text`, `open.url` | Granted automatically upon installation. |
| **Sensitive** | 🟡 | `network.http`, `files.*`, `chattree.notes.*`, `chattree.reminders.*`, `notifications.send` | Explicit confirmation dialog presented during installation or first invocation. |
| **Critical** | 🔴 | `location.current`, `camera.capture`, `contacts.*`, `calendar.*` | Explicit confirmation prompt AND Android runtime permission prompt. |

### Permission Workflow

```text
User runs: /plugin-command
         │
         ▼
Does plugin declare required capability in plugin.json?
         ├─► NO  ──► Host API returns permissionDenied
         ▼ YES
Has user granted permission in Chattree?
         ├─► NO  ──► Chattree presents PermissionDialog
         │           ├─► Denied ──► Execution halts
         │           └─► Granted
         ▼
Does operation require OS-level permission (Camera/Location/Contacts)?
         ├─► NO  ──► Operation executes
         ▼ YES
Is Android runtime permission granted?
         ├─► NO  ──► System permission prompt shown
         │           ├─► Denied ──► Error returned to plugin
         │           └─► Granted
         ▼
Operation executes successfully
```

### Managing Permissions in Settings
Users can review and revoke permissions at any time:
1. Open Chattree.
2. Navigate to **Settings → Plugins**.
3. Select any installed plugin.
4. Tap **Permissions** to toggle individual capabilities on or off.
