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

## 2. Plugin Manifest Settings Support

The plugin manifest schema accepts an optional `settings` array with declarative fields such as `key`, `label`, `type`, `defaultValue`, `options`, and `isSecret`. In the current app implementation, the plugin details screen does not render a settings editor, and the plugin Host API does not expose these values. Treat `settings` as parsed metadata only; plugin developers must not rely on the app to collect or provide these values. See the [manifest reference](./plugins/plugin-manifest.md) for the current boundary.

Chattree's own user preferences (theme, language, inference parameters, local model optimization, RAG controls, provider credentials, and history deletion) are managed in the app's Settings screens. See [Chattree App Features](./app-features.md).

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
