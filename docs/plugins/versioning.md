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
| `1` | ✅ Current (only supported version) |

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
| 1.0.x | 1 | 1.0.0 |
| Future | 1 (minimum) | 1.0.0+ |

### `minAppVersion`

If your plugin uses features only available from a specific Chattree version,
set `minAppVersion` in `plugin.json`:

```json
"minAppVersion": "1.1.0"
```

Chattree will refuse to install the plugin if the app version is lower.

> Currently Chattree does not check `minAppVersion` at import time —
> this field is reserved for future enforcement. Set it anyway as documentation.

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

Users must manually import the new `.chattree-plugin` to update.
(Automatic update via URL is planned for a future release.)

---

## Distributing updates

Currently, plugin updates are distributed the same way as first-time installs:
users import the new `.chattree-plugin` package.

A future **Marketplace** will provide update notifications and one-tap upgrades.
The package format will be identical.

---

## Backward compatibility commitment

Chattree commits to:
- Never breaking existing plugins without a `runtimeApiVersion` increment.
- Keeping `schemaVersion: 1` parseable indefinitely.
- Providing at least one release of deprecation notices before removing any capability.

Plugins built today against `runtimeApiVersion: "1.0.0"` will continue working
in future Chattree versions until a documented breaking release.
