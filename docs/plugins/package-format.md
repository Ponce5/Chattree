# .chattree-plugin — Package Format Specification

A `.chattree-plugin` file is a standard **ZIP archive** with a `.chattree-plugin` extension.
Chattree treats any file with this extension as a plugin package.

---

## Archive structure

```
my-plugin.chattree-plugin  (ZIP archive)
├── plugin.json            ← REQUIRED — plugin manifest
├── plugin.wasm            ← REQUIRED for runtime="wasm"
└── icon.png               ← OPTIONAL — plugin icon
```

### Rules

- All entries must be at the **root level** of the archive (no subdirectories).
- `plugin.json` must be present and parseable.
- `plugin.wasm` must match `plugin.json → wasmPath` (always `"plugin.wasm"`).
- The `wasmSha256` field in `plugin.json` must match the actual SHA-256 of `plugin.wasm`.
  Chattree computes this on import and will reject mismatches.
- `icon.png` is optional. If absent, Chattree uses a default icon.
  Recommended size: 512 × 512 pixels.

---

## How Chattree imports a `.chattree-plugin`

1. User opens **Settings → Plugins → Importar plugin**.
2. File picker opens (or a `.chattree-plugin` file is tapped in the file manager).
3. Chattree reads the ZIP bytes entirely in memory.
4. Extracts `plugin.json` → validates all fields.
5. Extracts `plugin.wasm` → verifies SHA-256.
6. If both validations pass, shows the install preview.
7. User confirms → Chattree stores the package in its private data directory.
8. Plugin appears in the plugin list. No code is executed yet.

---

## Creating the archive

### Using a standard ZIP tool

```bash
# Linux / macOS
zip my-plugin.chattree-plugin plugin.json plugin.wasm
zip my-plugin.chattree-plugin icon.png   # optional, run after above

# Windows PowerShell
Compress-Archive -Path plugin.json, plugin.wasm -DestinationPath my-plugin.zip
Rename-Item my-plugin.zip my-plugin.chattree-plugin
```

### Using the reference Dart build scripts

The `tool/` directory in the Chattree repository contains reference scripts:

| Script | Purpose |
|--------|---------|
| `tool/build_echo_plugin.dart` | Builds the echo demo plugin |
| `tool/build_http_plugin.dart` | Builds the HTTP demo plugin |
| `tool/build_storage_plugin.dart` | Builds the storage demo plugin |

Run any of them with:

```bash
dart run tool/build_echo_plugin.dart
```

This outputs the `.chattree-plugin` file in `tool/`.

### Adapting for your own plugin

Copy and modify `build_echo_plugin.dart`:

1. Replace the WASM bytes (or read from file).
2. Update the manifest fields.
3. Set your command name, ID, capabilities.
4. Run the script to produce your `.chattree-plugin`.

---

## Distributing your plugin

You can share a `.chattree-plugin` file through any channel:

- GitHub Releases (attach to a release)
- Personal website download
- Email / messaging apps
- USB / ADB transfer for testing
- Google Drive or similar cloud storage

Users can import it directly in Chattree's **Settings → Plugins → Importar plugin**,
or by tapping the file in any file manager or download manager.

---

## Verifying the archive (optional)

To verify your archive before distributing:

```bash
# List archive contents
unzip -l my-plugin.chattree-plugin

# Verify SHA-256 of wasm inside
unzip -p my-plugin.chattree-plugin plugin.wasm | sha256sum
```

Compare the SHA-256 with the `wasmSha256` field in `plugin.json`.

---

## Size limits

| Resource | Limit |
|----------|-------|
| Total archive size | No hard limit (limited by device storage) |
| `plugin.wasm` size | No hard limit (loaded entirely into memory) |
| WASM linear memory at runtime | `maxMemoryPages × 64 KB` (default 16 MB) |
| icon.png (recommended) | ≤ 512 KB |
