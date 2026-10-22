# Publishing and Updating Plugins in the Chattree Marketplace

This guide describes how to package a community plugin, host it on GitHub Releases, and submit its listing to the Chattree Marketplace. Official plugins follow a separate maintainer workflow. Portal/API behavior and app update discovery can change; verify against the deployed service before announcing a release.

Plugins are distributed as `.chattree-plugin` ZIP packages, commonly attached to GitHub Releases, and registered through the web portal or REST API. The WASM SHA-256 is an integrity check, not a digital signature; submission does not authenticate the package author or independently audit source code.

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
│ 6. Catalog listing and in-app discovery (verify deployment) │
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
   - The validation engine downloads the package, checks ZIP structure, parses `plugin.json`, validates the WASM header and SHA-256, and checks declared capabilities against its catalog. This is structural validation, not a code security audit.
4. Review the auto-detected metadata (Plugin ID, Name, Description, Commands, Capabilities).
5. Provide a raw GitHub URL for your plugin's icon:
   ```text
   https://raw.githubusercontent.com/<owner>/<repo>/main/icon.png
   ```
6. Click **Publish to Marketplace**.
   - The service validates the package and, when database credentials are configured, records the listing/version. A successful response is not a manual security review or source-code audit.

---

### Method B: Automated REST API

You can publish programmatically via the submission endpoint:

```http
POST https://chattree.chat/api/plugins/submit
Content-Type: application/json
```

#### Request Headers
| Header | Value | Required | Description |
|---|---|---|---|
| `Content-Type` | `application/json` | ✅ | Must specify JSON body |
| `User-Agent` | `your-tool/1.0` | ⚪ | Recommended identifier |

#### Request Payload Specification
| Parameter | Type | Required | Description |
|---|---|---|---|
| `download_url` | string (URL) | ✅ | Direct HTTPS download URL to the `.chattree-plugin` asset attached to a GitHub Release. |
| `icon_url` | string (URL) | ✅ | Public HTTPS URL for the 512x512 plugin icon, strictly hosted on GitHub domains (`raw.githubusercontent.com`, `user-images.githubusercontent.com`, `github.com`). |
| `banner_url` | string (URL) | ⚪ | Optional promotional banner image (1200x630 px) hosted on GitHub. |
| `source_url` | string (URL) | ⚪ | Public GitHub repository URL containing the plugin source code. |
| `homepage_url` | string (URL) | ⚪ | Project or author website URL. |
| `author_url` | string (URL) | ⚪ | GitHub profile or personal page of the developer. |
| `license` | string | ⚪ | SPDX license identifier (default: `"MIT"`). |
| `category` | string | ⚪ | One of: `productivity`, `utilities`, `devtools`, `ai`, `automation`, `files`, `communication`, `media`, `education`, `other` (default: `"utilities"`). |
| `name` | string | ⚪ | Overrides manifest display name if desired. |
| `short_description` | string | ⚪ | Brief summary shown in mobile cards (max 120 chars). |
| `description` | string | ⚪ | Extended description shown on the plugin details page. |
| `changelog` | string | ⚪ | Release notes describing the updates in this version. |

#### JSON Payload Example
```json
{
  "download_url": "https://github.com/<owner>/<repo>/releases/download/v1.0.0/weather-v1.0.0.chattree-plugin",
  "icon_url": "https://raw.githubusercontent.com/<owner>/<repo>/main/icon.png",
  "source_url": "https://github.com/<owner>/<repo>",
  "category": "utilities",
  "license": "MIT",
  "changelog": "1.0.0: Initial public release."
}
```

#### Example via PowerShell
```powershell
$body = @{
  download_url = "https://github.com/<owner>/<repo>/releases/download/v1.0.0/weather-v1.0.0.chattree-plugin"
  icon_url     = "https://raw.githubusercontent.com/<owner>/<repo>/main/icon.png"
  source_url   = "https://github.com/<owner>/<repo>"
  category     = "utilities"
  license      = "MIT"
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
    "source_url": "https://github.com/<owner>/<repo>",
    "category": "utilities",
    "license": "MIT"
  }'
```

#### HTTP Response Statuses & Error Codes

| Status Code | Code Identifier | Description |
|---|---|---|
| **`200 OK`** | *(Success)* | Package successfully downloaded from GitHub, validated, and registered in the catalog. |
| **`400 Bad Request`** | `MISSING_DOWNLOAD_URL` | The `download_url` property was missing or empty. |
| **`400 Bad Request`** | `MISSING_ICON_URL` | The `icon_url` property was missing or empty. |
| **`400 Bad Request`** | `INVALID_ICON_HOST` | The icon URL is not hosted on an allowed GitHub domain. |
| **`400 Bad Request`** | `GITHUB_FETCH_FAILED` | Failed to download package from GitHub Release (verify asset is public). |
| **`400 Bad Request`** | `PACKAGE_TOO_LARGE` | The package exceeds the maximum limit of 25 MB. |
| **`400 Bad Request`** | `VALIDATION_FAILED` | Package failed structural or integrity validation (see `details` array). |
| **`409 Conflict`** | `VERSION_ALREADY_EXISTS` | The exact plugin ID and version are already registered. |
| **`429 Too Many Requests`** | `RATE_LIMIT_EXCEEDED` | Production process-local limiter observed more than 5 submissions in an hour for the IP; multi-instance deployments may not share this counter. |
| **`500 Internal Error`** | `SERVER_ERROR` | Internal database or registry failure. |

##### Successful Response (`200 OK`)
```json
{
  "success": true,
  "submissionId": "5329803a-25ef-41ad-bfdd-6baba3e78e91",
  "status": "published",
  "message": "Plugin registered and published successfully. It is now live and available in the Chattree mobile app.",
  "plugin": {
    "id": "com.example.weather",
    "slug": "live-weather",
    "version": "1.0.0",
    "name": "Live Weather",
    "category": "utilities",
    "downloadUrl": "https://github.com/.../weather-v1.0.0.chattree-plugin",
    "packageSize": 1436,
    "sha256": "07298334903f19a2ff897156103187781292e36d742b31f78315ef7a1a088a68",
    "capabilities": ["network.http", "location.current"]
  },
  "warnings": []
}
```

##### Validation Failure Response (`400 / 422 Unprocessable Entity`)
```json
{
  "error": "Plugin package validation failed.",
  "code": "VALIDATION_FAILED",
  "details": [
    "WASM SHA-256 checksum mismatch! The hash in plugin.json does not match plugin.wasm.",
    "Capability \"chat.history.read\" is marked as not available in the current WASM runtime."
  ],
  "warnings": [
    "Declared capability \"custom.sensor\" is not recognized in the standard catalogue."
  ]
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
  source_url        = "https://github.com/<owner>/<repo>"
  author_url        = "https://github.com/<owner>"
  organization      = "Acme"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://chattree.chat/api/plugins/submit" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

---

## 7. How Users Receive Updates

When an update is submitted:
1. **Version registration:** The submit API rejects an exact duplicate plugin ID/version. It does not compare SemVer ordering in the route; publish monotonically increasing versions yourself and verify catalog latest-version behavior.
2. **Update discovery:** Whether installed users see an update depends on marketplace catalog state and app version. Verify the flow on a test device before promising a badge or notification.
3. **Installation:** Follow the update action in the target app and verify the downloaded package and preserved plugin data. Do not assume atomic replacement or storage migration unless confirmed for that app release.
4. **Permission changes:** The app permission gateway controls Host API calls. Test newly requested capabilities and denied permissions in the target release.

### Submission behavior notes

- `POST /api/plugins/submit` requires `download_url` and `icon_url`; the icon must use HTTPS and an allowed GitHub host. `banner_url`, `source_url`, `author_url`, `homepage_url`, `organization`, `license`, `category`, listing text, and changelog are optional.
- The request uses `source_url`; fields such as `repository_url`, `publisher_name`, and `publisher_email` in older examples are not consumed by the current route.
- The API returns HTTP 200 with `status: "draft"` when Supabase is not configured (validation-only dry run), and `status: "published"` after successful database registration. Do not interpret dry-run success as a live listing.
- The route currently limits packages to 25 MiB. The mobile importer accepts compressed archives up to 10 MiB, so keep packages below 10 MiB to support direct in-app import.
- The rate limit is stored in process memory and may not be globally consistent across multiple server instances.

---

## 8. Publisher Checklist & Best Practices

| Check | Requirement | Reason |
|-------|-------------|--------|
| ✅ **No Subfolders** | `plugin.json` and `plugin.wasm` at ZIP root | Chattree extractor looks at root entries only. |
| ✅ **Version Sync** | Manifest `version` matches GitHub Release tag | Prevents version mismatch errors during validation. |
| ✅ **WASM Hash Sync** | `wasmSha256` in manifest matches `plugin.wasm` | Detects mismatched binary contents; it is not publisher authentication. |
| ✅ **Version discipline** | Publish a strictly higher SemVer for each update | The API only rejects exact duplicate plugin ID/version pairs; publishers must enforce ordering. |
| ✅ **Raw Image URLs** | Use `raw.githubusercontent.com` for icons | Ensures public accessibility without HTML page wrappers. |
| ✅ **Minimal Capabilities** | Only declare capabilities actually used | Excessive permissions lower community adoption and trust. |
