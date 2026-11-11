# .chattree-plugin — Package Format Specification

A `.chattree-plugin` file is a standard **ZIP archive** with a `.chattree-plugin` extension.
Chattree treats any file with this extension as a plugin package.

---

## Archive structure

```text
my-plugin.chattree-plugin  (ZIP archive)
├── plugin.json            ← REQUIRED — plugin manifest
├── plugin.wasm            ← REQUIRED for runtime="wasm"
├── icon.png               ← OPTIONAL — plugin icon (512x512 PNG)
├── README.md              ← OPTIONAL — documentation / usage notes
└── LICENSE                ← OPTIONAL — license text (.txt, .md, or bare)
```

### Rules & Safety Quotas

- **Root Level Layout (with Smart Local Import Normalization):** Standard packages place all files at the archive root. Path traversal sequences (`..`), leading slashes, and drive letters are always rejected. During local import in the app, if an archive was re-compressed with a single outer folder (`my-plugin/plugin.json`) or includes OS metadata entries (`__MACOSX/`, `.DS_Store`, `Thumbs.db`, `desktop.ini`) or duplicate copy suffixes (`plugin (1).json`, `plugin (1).wasm`), `PluginPackageManager` automatically flattens the single root directory, strips OS artifacts, and normalizes copy suffixes.
- **Allowed Archive Root Files:** Only the following filenames (case-insensitive) are permitted at the package root:
  - `plugin.json` (mandatory)
  - `plugin.wasm` (mandatory for WASM runtime)
  - `icon.png` (optional icon, recommended 512×512 PNG)
  - `readme.md` (optional)
  - `license`, `license.txt`, `license.md` (optional)
- **Compressed Package Size Limit:** Maximum **25 MB (`26,214,400` bytes)**.
- **Uncompressed Total Size Limit:** Maximum **50 MB (`52,428,800` bytes)** across all entries (zip-bomb defense).
- **Entry Count Limit:** Maximum **50 files** per archive.
- `plugin.json` must be present and parseable.
- `plugin.wasm` must match `plugin.json → wasmPath` (always `"plugin.wasm"`).
- The `wasmSha256` field in `plugin.json` must match the actual SHA-256 of `plugin.wasm`. Chattree computes this on import and rejects any mismatch.
- `icon.png` is optional. If absent, Chattree uses a default icon. Recommended size: 512 × 512 pixels.

---

## How Chattree imports or updates a `.chattree-plugin`

1. User opens **Settings → Plugins → Importar plugin**.
2. File picker opens (or a `.chattree-plugin` / `.zip` file is selected, including files with browser/OS copy suffixes like `my-plugin (1).chattree-plugin` or `my-plugin - copia.chattree-plugin`).
3. Chattree inspects the file header (magic bytes `PK\x03\x04` for ZIP archives or `{` for JSON manifests) and reads the package in memory.
4. Normalizes single-folder wrapper directories and ignores OS metadata (`__MACOSX`, `.DS_Store`, `Thumbs.db`).
5. Extracts `plugin.json` → validates all fields and schema structure.
6. Extracts `plugin.wasm` → verifies SHA-256 integrity against `manifest.wasmSha256`.
7. **Cryptographic Signature & Trust Verification:** If signed, verifies Ed25519 signatures and community certificates against `rootKeyId = "chattree-official-v1"`.
8. **Anti-Downgrade Watermark Check:** Verifies against `PluginStateStore` that the version is not lower than the maximum version historically installed for that plugin ID. Any version downgrade is blocked immediately.
9. If the plugin ID is **already installed**, Chattree detects the existing installation and displays an **in-place update / reinstall preview** (`v1.0.0 → v2.0.0`) with an **Actualizar plugin** (or **Reinstalar plugin**) button—no manual uninstallation required.
10. User confirms → Chattree executes an **atomic transaction**: extracts to staging, verifies state, atomically commits to package directory, updates metadata, and preserves existing settings, storage, and SQLite databases. Any failure triggers a clean, fail-closed rollback with zero leftover artifacts.

---

## Creating the archive

### Option 1: Using the Official Chattree CLI (Recommended)

The official `@chattree/cli` automatically validates the manifest, computes the SHA-256 checksum of `plugin.wasm`, updates `manifest.wasmSha256`, and packages all required files at the root of the archive:

```bash
# Inside your plugin project directory
npx @chattree/cli package

# Or specifying a path
npx @chattree/cli package path/to/my-plugin/
```

This outputs `<id>-v<version>.chattree-plugin` ready for installation or marketplace publishing.

### Option 2: Using the Standalone Repository Script

From the repository root:

```bash
node tools/package-plugin.mjs path/to/my-plugin/
```

### Option 3: Using Standard ZIP Tools

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

Limits are aligned across the mobile importer, repository CLI, and web submission service:

| Resource | Limit |
|----------|-------|
| Compressed archive for in-app import | 25 MB maximum |
| Total uncompressed archive contents | 50 MB maximum in app import |
| Archive entries | 50 maximum in app import |
| Marketplace submission package | 25 MB maximum |
| WASM linear memory | 32 MB default (up to 64 MB / 1024 pages) |
| `icon.png` | Optional; web validator warns above 1 MB (512×512 recommended) |
| Root files | `plugin.json`, `plugin.wasm`, `icon.png`, `readme.md`, `license`, `license.txt`, `license.md` |
