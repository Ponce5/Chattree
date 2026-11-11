# Versioning and Compatibility

---

## Plugin version (`version`)

Plugin versions follow **Semantic Versioning**: `MAJOR.MINOR.PATCH`.

| Change type | Increment | Example |
|-------------|-----------|---------|
| Breaking change (new required capability, command rename) | MAJOR | `1.0.0` → `2.0.0` |
| New feature (new optional capability, new tool) | MINOR | `1.0.0` → `1.1.0` |
| Bug fix, text change, optimization | PATCH | `1.0.0` → `1.0.1` |

---

## Schema version (`schemaVersion`)

The `schemaVersion` field describes the **plugin.json format version**,
not the plugin's own version.

| `schemaVersion` | Status |
|-----------------|--------|
| `1` | ✅ Current standard manifest schema |
| `2` | ✅ Supported extended schema (adds declarative `inboundWebhooks` and `eventConsumers`) |

Chattree will refuse to install a plugin with an unknown `schemaVersion`.

---

## Runtime API version (`runtimeApiVersion`)

The `runtimeApiVersion` declares which version of the **ChattreeHostApi** your
plugin was built against.

| `runtimeApiVersion` | Status | Notes |
|--------------------|--------|-------|
| `"1.0.0"` | ✅ Current stable | Use this for all plugins today |

### What changes between runtime API versions

A new `runtimeApiVersion` is declared when:
- New Host API namespaces are added (e.g. `payment.*`).
- Existing operations change their input/output format in a breaking way.
- Memory protocol changes.

Minor additions (new optional operations within existing namespaces) do NOT require
a version bump — they are backward compatible.

---

## Compatibility matrix

| Chattree version | Supported `schemaVersion` | Supported `runtimeApiVersion` |
|-----------------|--------------------------|-------------------------------|
| 1.0.x | 1, 2 | 1.0.0 |
| Future | 1 (minimum) | 1.0.0+ |

### `minAppVersion`

If your plugin uses features only available from a specific Chattree version,
set `minAppVersion` in `plugin.json`:

```json
"minAppVersion": "1.1.0"
```

Chattree will refuse to install the plugin if the app version is lower.

> The package manager evaluates `minAppVersion` during compatibility checks. Provide a valid semantic version when your plugin depends on a minimum app release; verify target app behavior before publishing.

---

## What happens when a capability is removed

If Chattree removes a capability in a future version:
1. Plugins declaring that capability will show a warning at install time.
2. At runtime, the Host API returns `unknown capability` error.
3. The plugin should handle this gracefully (check `success == false`).

Capabilities will never be silently replaced — the old name will return errors
and a migration path will be documented.

---

## What happens when an API operation changes

If an operation's input/output changes in a backward-incompatible way:
- A new `runtimeApiVersion` is declared.
- Old operations are kept with their old behavior for one transition version.
- The changelog documents exactly what changed.

---

## How to update your plugin

1. Increment `version` in `plugin.json` following semver.
2. Recompile `plugin.wasm` if the WASM source changed.
3. Recompute `wasmSha256` and update `plugin.json`.
4. Update `changelog` with release notes.
5. Rebuild the `.chattree-plugin` archive.
6. Distribute the new archive.

Users can import the new `.chattree-plugin` manually. Marketplace updates depend on the deployed catalog and app update flow; test the actual release path before promising automatic updates.

---

## Distributing updates

Plugin updates can be distributed through two channels:
1. **Marketplace:** Publish a new unique version record using the portal/API in the publishing guide. The submit endpoint enforces strict SemVer monotonicity (`409 VERSION_NOT_NEWER` if the submitted version is lower than or equal to an existing version) and rejects duplicate `(plugin id, version)` pairs (`409 VERSION_ALREADY_EXISTS`). Verify in-app update discovery in the target app release.
2. **Direct local import (`.chattree-plugin`):** Share the updated `.chattree-plugin` archive directly; users import it via **Settings → Plugins → Importar plugin** without needing to uninstall the previous version first. Chattree detects the existing plugin ID, displays the version transition (`v1.0.0 → v1.1.0`), and performs an in-place update (`allowUpdate: true`) that preserves the plugin's `installedAt` timestamp, user settings, private key-value storage, and SQLite database. Duplicate filename suffixes added by browsers or file managers (such as `my-plugin (1).chattree-plugin` or `my-plugin - copia.chattree-plugin`) are automatically normalized during import.

### Anti-Downgrade Version Watermark Guarantee

Both distribution channels are backed by a persistent anti-downgrade watermark enforced in the mobile client runtime (`PluginStateStore`):
- Chattree tracks the highest historical SemVer installed for each plugin ID across the lifetime of the application instance.
- Any attempt to install, import, or update a plugin to an older version (e.g., attempting to install `v1.0.0` after having installed `v2.0.0`) is rejected with a `SecurityException`:
  > *"Degradación de versión rechazada: La versión \"1.0.0\" es inferior a la versión máxima registrada históricamente (\"2.0.0\")."*
- Reinstalling the exact active version (`v2.0.0 → v2.0.0`) is supported for repair or re-synchronization, but downgrades are strictly prevented to eliminate rollback attacks.


---

## Backward compatibility commitment

Chattree commits to:
- Never breaking existing plugins without a `runtimeApiVersion` increment.
- Keeping `schemaVersion: 1` parseable indefinitely.
- Providing at least one release of deprecation notices before removing any capability.

Plugins built today against `runtimeApiVersion: "1.0.0"` will continue working
in future Chattree versions until a documented breaking release.
