# Publishing and Updating Plugins in the Chattree Marketplace

This guide covers the complete, end-to-end process for packaging, hosting, publishing, and updating official and community plugins in the **Chattree Marketplace**. 

Plugins are distributed as cryptographically verified `.chattree-plugin` packages hosted on **GitHub Releases** and registered with the **Chattree Marketplace Registry** via the web submission portal or automated REST API.

---

## The Publishing & Update Lifecycle

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Code & Compile                                           │
│    Write source code (WAT, Rust, C) and compile plugin.wasm │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Configure Manifest (plugin.json)                         │
│    Define id, version (SemVer), capabilities, and changelog │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Build .chattree-plugin Package                           │
│    ZIP bundle containing plugin.json, plugin.wasm, and icon │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Create GitHub Release                                    │
│    Publish tag (e.g. v1.0.2) and attach .chattree-plugin    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Register with Marketplace (Web Portal or REST API)       │
│    Submit the public release download URL for validation    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Instant Availability & In-App Updates                    │
│    Available in Chattree app: One-tap install or update     │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Directory Structure & Source Layout

Host your plugin code in a public GitHub repository. Standard layout:

```text
my-plugin/
├── src/                  # Source code (WAT, Rust, C, etc.)
├── plugin.json           # Required plugin manifest
├── plugin.wasm           # Compiled WebAssembly binary
├── icon.png              # 512x512 PNG icon (transparent or dark bg)
└── README.md             # Documentation and usage instructions
```

---

## 2. Manifest Configuration (`plugin.json`)

The `plugin.json` file is the contract that defines your plugin's identity, permissions, commands, and security boundaries.

```json
{
  "schemaVersion": 1,
  "id": "com.example.weather",
  "version": "1.0.0",
  "minAppVersion": "1.0.0",
  "name": "Live Weather",
  "description": "Real-time weather forecasts and alerts.",
  "author": "Acme Developer",
  "authorEmail": "developer@example.com",
  "homepageUrl": "https://example.com/weather",
  "primaryCommand": "weather",
  "aliases": ["clima", "forecast"],
  "type": "imported",
  "capabilities": [
    "network.http",
    "location.current"
  ],
  "changelog": "1.0.0: Initial public release.",
  "runtime": "wasm",
  "entrypoint": "weather_entry",
  "wasmPath": "plugin.wasm",
  "wasmSha256": "62d79bbba364d13b49f3eba731b6f05974917e16ffd154fc3036ea536ce16310",
  "runtimeApiVersion": "1.0.0",
  "maxMemoryPages": 4,
  "timeoutMs": 5000,
  "fuelLimit": 50000000,
  "tools": [
    {
      "id": "com.example.weather.current",
      "command": "weather",
      "displayName": "Check Current Weather",
      "description": "Get current weather: /weather [city]",
      "capabilities": [
        "network.http",
        "location.current"
      ]
    }
  ]
}
```

> **Rules:**
> - `id`: Must be a unique reverse-domain identifier (e.g. `com.developer.plugin-name`).
> - `version`: Must follow Semantic Versioning (`MAJOR.MINOR.PATCH`).
> - `wasmSha256`: Must exactly match the SHA-256 hash (in lowercase) of the compiled `plugin.wasm`.

---

## 3. Building the `.chattree-plugin` Package

A `.chattree-plugin` package is a standard ZIP archive containing the manifest, the compiled WebAssembly binary, and an optional icon at the root level.

> **CRITICAL:** All files must reside directly in the **root of the ZIP archive**. Do not package them inside an enclosing subfolder.

### Windows (PowerShell)
```powershell
# In the directory containing plugin.json, plugin.wasm, and icon.png:
Compress-Archive -Path plugin.json, plugin.wasm, icon.png -DestinationPath weather-v1.0.0.zip -Force
Rename-Item "weather-v1.0.0.zip" "weather-v1.0.0.chattree-plugin"
```

### Linux / macOS (Bash)
```bash
zip -9 weather-v1.0.0.chattree-plugin plugin.json plugin.wasm icon.png
```

---

## 4. Hosting on GitHub Releases

1. In your GitHub repository, navigate to **Releases** (`https://github.com/<owner>/<repo>/releases`).
2. Click **Draft a new release**.
3. Create a version tag matching your manifest (e.g. `v1.0.0`).
4. Enter a release title (e.g. `Weather Plugin v1.0.0`).
5. In the binary attachment area, drag and drop your `.chattree-plugin` file (e.g. `weather-v1.0.0.chattree-plugin`).
6. Click **Publish release**.

### Obtaining the Direct Download URL
After publication, copy the direct asset URL from the release assets list. The format is:
```text
https://github.com/<owner>/<repo>/releases/download/v1.0.0/weather-v1.0.0.chattree-plugin
```

---

## 5. Submitting a New Plugin (Initial Publication)

You can publish your plugin through either the web interface or the REST API.

### Method A: The Web Submission Portal (Recommended)

1. Open the [Chattree Plugin Submission Portal](https://chattree.chat/submit-plugin).
2. Paste the **GitHub Release direct download URL** for your `.chattree-plugin` file.
3. Click **Inspect & Validate Package**.
   - The validation engine downloads the package, checks the ZIP structure, extracts `plugin.json` and `plugin.wasm`, calculates cryptographic SHA-256 checksums, and verifies capability declarations.
4. Review the auto-detected metadata (Plugin ID, Name, Description, Commands, Capabilities).
5. Provide a raw GitHub URL for your plugin's icon:
   ```text
   https://raw.githubusercontent.com/<owner>/<repo>/main/icon.png
   ```
6. Click **Publish to Marketplace**.
   - Your plugin is verified and instantly published to the global catalog.

---

### Method B: Automated REST API

You can publish programmatically via the submission endpoint:

```http
POST /api/plugins/submit
Content-Type: application/json
```

#### Request Payload
```json
{
  "download_url": "https://github.com/<owner>/<repo>/releases/download/v1.0.0/weather-v1.0.0.chattree-plugin",
  "icon_url": "https://raw.githubusercontent.com/<owner>/<repo>/main/icon.png",
  "repository_url": "https://github.com/<owner>/<repo>",
  "publisher_name": "Acme Developer",
  "publisher_email": "developer@example.com",
  "publisher_website": "https://example.com",
  "auto_approve": true
}
```

#### Example via PowerShell
```powershell
$body = @{
  download_url      = "https://github.com/<owner>/<repo>/releases/download/v1.0.0/weather-v1.0.0.chattree-plugin"
  icon_url          = "https://raw.githubusercontent.com/<owner>/<repo>/main/icon.png"
  repository_url    = "https://github.com/<owner>/<repo>"
  publisher_name    = "Acme Developer"
  publisher_email   = "developer@example.com"
  publisher_website = "https://example.com"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://chattree.chat/api/plugins/submit" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

#### Example via cURL
```bash
curl -X POST https://chattree.chat/api/plugins/submit \
  -H "Content-Type: application/json" \
  -d '{
    "download_url": "https://github.com/<owner>/<repo>/releases/download/v1.0.0/weather-v1.0.0.chattree-plugin",
    "icon_url": "https://raw.githubusercontent.com/<owner>/<repo>/main/icon.png",
    "repository_url": "https://github.com/<owner>/<repo>",
    "publisher_name": "Acme Developer",
    "publisher_email": "developer@example.com"
  }'
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "submissionId": "5329803a-25ef-41ad-bfdd-6baba3e78e91",
  "status": "published",
  "message": "Plugin registered and published successfully.",
  "plugin": {
    "id": "com.example.weather",
    "slug": "live-weather",
    "version": "1.0.0",
    "name": "Live Weather",
    "downloadUrl": "https://github.com/.../weather-v1.0.0.chattree-plugin",
    "packageSize": 1436,
    "sha256": "07298334903f19a2ff897156103187781292e36d742b31f78315ef7a1a088a68",
    "capabilities": ["network.http", "location.current"]
  }
}
```

---

## 6. Updating an Existing Plugin

Releasing an update to an existing plugin follows a clean, automated lifecycle.

### Step 1: Update Your Source Code
Implement bug fixes, performance optimizations, or new capabilities in your code.

### Step 2: Recompile the WebAssembly Binary
Recompile `plugin.wasm` using your toolchain (e.g. `wat2wasm`, `cargo build --target wasm32-unknown-unknown`, etc.).

### Step 3: Bump the Version in `plugin.json`
Open `plugin.json` and apply the changes:
1. Increment the `version` string following SemVer (e.g., `1.0.0` → `1.0.1` or `1.1.0`).
2. Update `wasmSha256` with the new SHA-256 hash of `plugin.wasm`.
3. Update `changelog` with a concise summary of the update.

```json
{
  "id": "com.example.weather",
  "version": "1.0.1",
  "wasmSha256": "new_sha256_hash_of_plugin_wasm...",
  "changelog": "1.0.1: Fixed city query parsing and improved offline caching."
}
```

### Step 4: Re-bundle the Package
Generate the new package file named with the new version:

```powershell
Compress-Archive -Path plugin.json, plugin.wasm, icon.png -DestinationPath weather-v1.0.1.zip -Force
Rename-Item "weather-v1.0.1.zip" "weather-v1.0.1.chattree-plugin"
```

### Step 5: Push and Publish a New GitHub Release
1. Commit and push your changes to your Git repository:
   ```bash
   git add .
   git commit -m "chore: bump version to 1.0.1"
   git push origin main
   ```
2. On GitHub, create a new Release with tag `v1.0.1`.
3. Attach `weather-v1.0.1.chattree-plugin` to the release.
4. Publish the release and copy the asset download URL.

### Step 6: Submit the Update to Marketplace
Submit the new download URL through the [Web Submission Portal](https://chattree.chat/submit-plugin) or via the REST API (`POST /api/plugins/submit`):

```powershell
$body = @{
  download_url      = "https://github.com/<owner>/<repo>/releases/download/v1.0.1/weather-v1.0.1.chattree-plugin"
  icon_url          = "https://raw.githubusercontent.com/<owner>/<repo>/main/icon.png"
  repository_url    = "https://github.com/<owner>/<repo>"
  publisher_name    = "Acme Developer"
  publisher_email   = "developer@example.com"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://chattree.chat/api/plugins/submit" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

---

## 7. How Users Receive Updates

When an update is submitted:
1. **Automated Version Registration:** The marketplace registry automatically verifies that the new version is strictly greater than the previous version, registers the release, and marks it as the latest active version.
2. **In-App Notification:** When users open Chattree, the app checks the marketplace registry. Users who have an older version installed will see an **"Update"** badge and button in both the Marketplace and Plugin Details screens.
3. **Atomic Installation:** Tapping "Update" downloads the new `.chattree-plugin`, verifies its SHA-256 checksum, and atomically replaces the previous sandbox files without corrupting private plugin storage.
4. **Permission Delta Enforcement:** 
   - If the update requires **the same capabilities** as before, it updates seamlessly without disturbing the user.
   - If the update introduces **new capabilities** (e.g. `notifications.send`), Chattree's `PermissionGateway` will prompt the user with a permission dialog specifically for the new capability before allowing it to run.

---

## 8. Publisher Checklist & Best Practices

| Check | Requirement | Reason |
|-------|-------------|--------|
| ✅ **No Subfolders** | `plugin.json` and `plugin.wasm` at ZIP root | Chattree extractor looks at root entries only. |
| ✅ **Version Sync** | Manifest `version` matches GitHub Release tag | Prevents version mismatch errors during validation. |
| ✅ **WASM Hash Sync** | `wasmSha256` in manifest matches `plugin.wasm` | Cryptographic integrity verification fails otherwise. |
| ✅ **SemVer Integrity** | Updates must have a strictly higher version | The marketplace rejects downgrades and duplicate versions. |
| ✅ **Raw Image URLs** | Use `raw.githubusercontent.com` for icons | Ensures public accessibility without HTML page wrappers. |
| ✅ **Minimal Capabilities** | Only declare capabilities actually used | Excessive permissions lower community adoption and trust. |
