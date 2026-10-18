# Errors Reference — Plugin Developer Guide

This document describes all error conditions a plugin developer may encounter,
their causes, and how to fix them.

---

## Host API errors (returned inside the response JSON)

These errors are returned in `{ "success": false, "error": "..." }` when calling
the Host API from WASM.

---

### `capability denied` / `Permiso denegado`

**What it means:** The plugin attempted to call a Host API operation without
the required capability being granted.

**Probable cause:**
- The capability is not listed in `plugin.json → capabilities`.
- The user has not granted the permission (or revoked it).
- You are using an incorrect capability name.

**How to fix:**
1. Add the required capability to `capabilities` in `plugin.json`.
2. Ask the user to go to **Settings → Plugins → [Plugin] → Permisos** and grant the permission.
3. Check capability names against [capabilities.md](capabilities.md).

**Response signature:**
```json
{
  "success": false,
  "error": "Permiso denegado: el plugin requiere \"network.http\".",
  "data": {
    "permissionDenied": true,
    "missingCapabilities": ["network.http"]
  }
}
```

---

### `unknown capability`

**What it means:** The plugin declared a capability that does not exist in Chattree's registry.

**Probable cause:**
- Typo in the capability name.
- Using a capability from a newer version of Chattree.
- Using `chat.history.read`, `ai.context`, or `ai.embeddings` (registered but not yet available).

**How to fix:**
- Review [capabilities.md](capabilities.md) for the exact capability ID.
- Remove capabilities you don't actually use.

---

### `plugin disabled`

**What it means:** The plugin is installed but has been disabled by the user.

**Probable cause:**
- The user turned off the plugin in **Settings → Plugins**.

**How to fix:**
- The user must re-enable the plugin in Settings.
- This is not a code error — plugins cannot re-enable themselves.

---

### `plugin not installed`

**What it means:** The command was invoked but no plugin is registered for that command.

**Probable cause:**
- Plugin was uninstalled.
- The `primaryCommand` in `plugin.json` doesn't match what was typed.

**How to fix:**
- Verify that `primaryCommand` in `plugin.json` matches the command.
- Reinstall the plugin.

---

### `invalid manifest`

**What it means:** The `plugin.json` file failed validation.

**Probable cause:**
- Missing required field (`id`, `version`, `name`, `author`, `primaryCommand`, `runtime`, `entrypoint`, `wasmSha256`).
- Malformed JSON.
- `id` doesn't match required format (missing dot, invalid chars).
- `version` not in semver format.
- `primaryCommand` contains illegal characters.
- Unknown capability name in `capabilities`.

**How to fix:**
- Read the specific validation error shown in Chattree's import dialog.
- Cross-reference all required fields in [plugin-manifest.md](plugin-manifest.md).
- Validate your JSON with any online JSON linter.

---

### `invalid package`

**What it means:** The `.chattree-plugin` file is malformed or unreadable.

**Probable cause:**
- The archive is not a valid ZIP.
- `plugin.json` is missing from the archive root.
- `plugin.wasm` is missing from the archive root.
- File is corrupted during transfer.

**How to fix:**
- Verify the archive with `unzip -l my-plugin.chattree-plugin`.
- Re-create the archive ensuring all files are at the root level.
- Re-transfer the file to the device.

---

### `runtime version mismatch`

**What it means:** The `runtimeApiVersion` in `plugin.json` is not compatible with
the current Chattree version.

**Probable cause:**
- Using an outdated `runtimeApiVersion`.
- Plugin built for a future version of Chattree.

**How to fix:**
- Set `runtimeApiVersion` to `"1.0.0"` (the current stable version).
- See [versioning.md](versioning.md) for compatibility table.

---

### `WASM execution error`

**What it means:** The WASM module crashed or produced an invalid result during execution.

**Probable cause:**
- Exported function not found (wrong `entrypoint` name).
- Memory out-of-bounds access in the WASM code.
- The WASM module is not a valid binary (compilation error).
- `plugin.wasm` is corrupted.
- WASM does not export `memory`.

**How to fix:**
- Verify the `entrypoint` in `plugin.json` matches the exported function name.
- Ensure your WASM exports `(memory (export "memory") N)`.
- Re-compile the WASM and verify with `wat2wasm --validate plugin.wat`.
- Verify the SHA-256 of `plugin.wasm` matches `wasmSha256` in `plugin.json`.

**Error message pattern:**
```
Función exportada "my_func" no encontrada en el módulo WASM.
```
or
```
El módulo WASM no exporta la memoria ("memory").
```

---

### `timeout`

**What it means:** The WASM execution exceeded the allowed time limit.

**Probable cause:**
- Infinite loop in WASM code.
- A Host API async call that never resolved.
- Slow computation that exceeds `timeoutMs`.

**How to fix:**
- Add bounds to all loops.
- Increase `timeoutMs` in `plugin.json` (max 5000 ms).
- Reduce computation complexity.
- Split work into smaller calls if needed.

---

### `memory limit`

**What it means:** The WASM module's linear memory exceeded `maxMemoryPages × 64 KB`.

**Probable cause:**
- WASM module requests more memory than declared in `maxMemoryPages`.
- Processing very large input strings.
- Stack overflow in recursive WASM code.

**How to fix:**
- Increase `maxMemoryPages` in `plugin.json`.
- Optimize memory usage in your WASM code.
- Note: The absolute maximum is 256 pages (16 MB).

---

### `invalid arguments`

**What it means:** A Host API operation received incorrect or missing parameters.

**Probable cause:**
- Forgot a required field (e.g. `key` for `storage.get`).
- Wrong JSON structure in the request payload.
- Value exceeds allowed limits (e.g., title too long).

**How to fix:**
- Review the operation's input specification in [host-api.md](host-api.md).
- Log the request JSON before calling `host_call` for debugging.

---

### `network denied`

**What it means:** The HTTP request was blocked by Chattree's SSRF protection or
the URL violates allowed schemes.

**Probable cause:**
- Requesting a local/private IP address.
- Using a non-HTTP scheme (e.g. `ftp://`).
- HTTP method not allowed (only GET, POST, PUT, DELETE).

**How to fix:**
- Use only public `https://` or `http://` URLs.
- Don't connect to `localhost`, `192.168.x.x`, `10.x.x.x`, etc.
- Use only supported HTTP methods.

---

### `file handle invalid`

**What it means:** A `files.read` or `share.file` call used an invalid handle.

**Probable cause:**
- The handle was never created (you didn't call `files.pick` or `files.write` first).
- The handle belongs to a different plugin.
- The session was restarted (handles are not persisted across sessions).

**How to fix:**
- Always call `files.pick` before `files.read`.
- Never hardcode handles — they are randomly generated per-session.
- Check `cancelled == false` before using the handle from `files.pick`.

---

## Runtime-level errors (shown in chat)

These errors are displayed directly in the Chattree chat as a tool error message.

| Error shown | Cause | Fix |
|-------------|-------|-----|
| `El módulo WASM no exporta la memoria ("memory")` | Missing memory export | Add `(memory (export "memory") N)` |
| `Función exportada "..." no encontrada` | Wrong `entrypoint` name | Fix `entrypoint` in `plugin.json` |
| `Error de timeout WASM: ...` | Execution timed out | Reduce computation, increase `timeoutMs` |
| `El buffer de entrada excede el tamaño de memoria` | Input too large | Increase `maxMemoryPages` |
| `Tamaño o puntero de salida fuera de los límites` | Output buffer too small | Check output offset and length math |
| `El plugin WASM no retornó un tamaño de salida válido` | Function returned invalid value | Ensure function returns a non-negative `i32` |
| `pluginId inválido o no proporcionado por el runtime` | Internal error | File a bug report |

---

## Debugging tips

1. **Use `core.log`** — write debug messages with:
   ```json
   { "api": "core", "operation": "log", "payload": { "level": "info", "message": "reached step 3" } }
   ```
   Messages appear in Flutter debug logs with `[Plugin:your.plugin.id]` prefix.

2. **Test your WASM locally** — use `wabt`'s `wasm-interp` or Wasm-standalone tools to
   validate execution before packaging.

3. **Validate the archive** — use `unzip -l` to verify archive structure before importing.

4. **Check SHA-256** — run `sha256sum plugin.wasm` and compare with `wasmSha256` in `plugin.json`.

5. **Start with minimal capabilities** — comment out capabilities and add them back one by one
   to isolate permission issues.
