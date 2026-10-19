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

### Option 1: Using the Chattree Developer Packager Tool

The official CLI packager automatically computes the SHA-256 hash of `plugin.wasm`, ensures `plugin.json` is updated, and bundles all required files at the root of the archive:

```bash
# From the repository root
node tools/package-plugin.mjs path/to/my-plugin/
```

This outputs `<id>-v<version>.chattree-plugin` ready for installation or marketplace publishing.

### Option 2: Using Standard ZIP Tools

Ensure that all files (`plugin.json`, `plugin.wasm`, and optionally `icon.png`) are located at the **root** of the ZIP archive:

```bash
# Linux / macOS
zip -9 my-plugin.chattree-plugin plugin.json plugin.wasm icon.png

# Windows PowerShell
Compress-Archive -Path plugin.json, plugin.wasm, icon.png -DestinationPath my-plugin.zip
Rename-Item my-plugin.zip my-plugin.chattree-plugin
```

> **Warning:** Never zip the parent directory itself (e.g. `zip my-plugin.zip my-plugin/`). The extractor requires `plugin.json` to be at the root entry of the archive.


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
