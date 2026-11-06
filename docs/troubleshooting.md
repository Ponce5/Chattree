# Troubleshooting & Diagnostic Guide

This guide helps you identify, diagnose, and resolve common issues encountered while developing, packaging, or running Chattree WebAssembly plugins.

---

## Diagnostic Checklist

When a plugin behaves unexpectedly, verify these items first:
1. **Archive Root Level:** Ensure `plugin.json` and `plugin.wasm` are at the root of the `.chattree-plugin` ZIP, not inside a subfolder.
2. **SHA-256 Checksum:** Ensure `wasmSha256` in `plugin.json` matches the lowercase SHA-256 hash of `plugin.wasm`.
3. **Exported Memory:** Verify that your WASM exports linear memory with the exact name `"memory"`: `(memory (export "memory") N)`.
4. **Exported Entrypoint:** Verify that the function name in `entrypoint` exists in your WASM module exports.
5. **Declared Capabilities:** Check that any Host API call you make has its required capability declared in `plugin.json`.
6. **Permission Status:** Verify in **Settings → Plugins → [Plugin] → Permissions** that the user has granted the required capability.

---

## Installation & Import Issues

### Error: "Invalid Package / Archive Corrupted"
- **Cause:** The archive is either corrupted during transfer or contains a nested folder.
- **Solution:** Run `unzip -l my-plugin.chattree-plugin` on Linux/macOS or inspect the archive. You should see:
  ```text
  Archive:  my-plugin.chattree-plugin
    Length      Date    Time    Name
  ---------  ---------- -----   ----
        849  2026-10-14 12:00   plugin.json
       1944  2026-10-14 12:00   plugin.wasm
  ```
  If `my-plugin/plugin.json` appears with a prefix path, recreate the archive from inside the directory:
  ```bash
  cd my-plugin && zip ../my-plugin.chattree-plugin plugin.json plugin.wasm
  ```

### Error: "SHA-256 Mismatch"
- **Cause:** `plugin.wasm` was recompiled or modified without updating `wasmSha256` in `plugin.json`.
- **Solution:** Recompute the hash and update `plugin.json`:
  ```bash
  # Linux/macOS
  sha256sum plugin.wasm
  # Windows PowerShell
  Get-FileHash plugin.wasm -Algorithm SHA256
  ```

### Error: "Command Conflict"
- **Cause:** Another installed plugin already registered the same `primaryCommand` or alias.
- **Solution:** Change `primaryCommand` in `plugin.json` to a unique identifier or uninstall the conflicting plugin.

---

## Runtime Execution Issues

### Error: "El módulo WASM no exporta la memoria ("memory")"
- **Cause:** The WASM module does not export its linear memory under the name `"memory"`.
- **Solution:**
  - In WAT: Add `(memory (export "memory") 2)`.
  - In Rust: Add `#![no_main]` and ensure `--target wasm32-unknown-unknown` is used.
  - In C/Clang: Pass `-Wl,--export-memory` to the linker.

### Error: "Función exportada '...' no encontrada"
- **Cause:** The `entrypoint` in `plugin.json` does not match any exported function name in the WASM binary.
- **Solution:** Inspect exports with `wasm-objdump -x plugin.wasm` or verify spelling in `entrypoint`.

### Error: "Error de timeout WASM: Execution timed out"
- **Cause:** The plugin exceeded the configured `timeoutMs` (runtime default is 5000 ms, configurable up to 60,000 ms in `plugin.json`) or entered an infinite loop.
- **Solution:** Add termination bounds to loops, optimize expensive string operations, increase `timeoutMs` up to 60000 in `plugin.json` if network operations require more time, or split workloads into smaller chunks.

### Error: "Fuel exhausted / Instruction limit exceeded"
- **Cause:** The plugin consumed more than the allocated instruction budget (default 50,000,000 instructions).
- **Solution:** Optimize algorithms and avoid heavy recursion or tight loops.

### Error: "El payload excede la capacidad del buffer de entrada de la ABI v1"
- **Cause:** The input payload exceeds the default ABI v1 static input buffer (1,024 bytes).
- **Solution:**
  1. **Configurable offsets (ABI v1):** In `plugin.json`, set `"outputOffset": 32768` (or larger) and optionally `"maxPayloadSizeBytes": 65536`.
  2. **Universal ABI v2 (Dynamic Memory):** Export `chattree_allocate`, `chattree_deallocate`, and `chattree_dispatch` to receive dynamic allocations up to 16 MB without fixed static buffer limits.

---

## Host API & Permission Issues

### Error: `permissionDenied` / `Permiso denegado`
- **Cause:** The plugin called a Host API operation without the required capability or the user revoked it.
- **Solution:**
  1. Verify the capability is listed in `plugin.json → capabilities`.
  2. Navigate to **Settings → Plugins → [Plugin] → Permissions** and toggle the permission on.
  3. Ensure the capability name is spelled correctly according to the [Capabilities Catalogue](./plugins/capabilities.md).

### Error: Network Request Blocked (SSRF Protection)
- **Cause:** The URL targets `localhost`, `127.0.0.1`, `192.168.x.x`, or another private IP range without the `network.local` capability.
- **Solution:** Chattree blocks connections to local networks and loopback addresses by default to prevent server-side request forgery. Use public HTTPS endpoints, or declare the critical `network.local` capability alongside `network.http` in `plugin.json` if your plugin integrates with local LAN/loopback services.

### Error: File Handle Expired or Invalid
- **Cause:** Calling `files.read` with a fabricated or expired handle.
- **Solution:** File handles are ephemeral and generated by `files.pick` or `files.write`. Never hardcode handles across sessions.

### Error: WebSocket Connection Limit Reached or Closed with Code 1009
- **Cause:**
  - `connection limit reached`: The plugin already has **10 active connections** or in-flight handshakes. Additional connection requests are blocked.
  - `close code 1009`: An incoming or outgoing frame exceeded the **16 MB (`16,777,216` bytes)** ceiling. Chattree terminates the connection to prevent mobile memory exhaustion.
- **Solution:**
  - Close unused sockets via `websocket.close` before opening new connections.
  - If streaming large files, chunk them into payloads under 16 MB before sending.

### Error: Declarative UI Card Validation Failure
- **Cause:** A returned UI card was rejected or stripped by `UiApiHandler.sanitizeUiCard`.
- **Solution:**
  - Verify your card does not exceed **60 total elements**, **40 key-value items**, or **8 buttons per row**.
  - Ensure tree depth does not exceed 3 levels.
  - Check that all element types are supported (`text`, `badge`, `progress`, `key_value`, `divider`, `button_row`).

### Error: Scheduler `minimumIntervalViolation` or Task Limit Exceeded
- **Cause:**
  - `minimumIntervalViolation`: The Cron schedule or interval frequency is shorter than **60 seconds**.
  - `task limit reached`: The plugin already has **25 active scheduled tasks**.
- **Solution:**
  - Increase your Cron or interval schedule so it executes at most once every 60 seconds (anti-battery drain guard).
  - Cancel obsolete tasks via `scheduler.cancel_task` before registering new ones.

### Error: Database `quotaExceeded` or `unauthorizedStatement`
- **Cause:**
  - `quotaExceeded`: The plugin's SQLite database files (`.db` + `-wal` + `-shm` + `-journal`) have exceeded the **200 MB** limit.
  - `unauthorizedStatement`: The query attempted forbidden operations (`ATTACH DATABASE`, `DETACH DATABASE`, `VACUUM INTO`, or modifying `sqlite_master`).
- **Solution:**
  - Clean up older records using `DELETE` queries and run `VACUUM` to reclaim disk space.
  - Remove prohibited database attachment statements; each plugin must operate strictly within its private database.

---

## Viewing Diagnostic Logs

View live Flutter and plugin logs via Android Debug Bridge (ADB):

```bash
adb logcat -s Flutter:D | grep "\[Plugin:"
```

To enable verbose logging from your plugin, make `core.log` calls:
```json
{
  "api": "core",
  "operation": "log",
  "payload": {
    "level": "info",
    "message": "Step 1 passed"
  }
}
```
