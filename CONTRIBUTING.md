# Contributing to Chattree

Thank you for your interest in contributing to Chattree! We aim to build a welcoming, robust, and collaborative open-source ecosystem.

---

## Getting Started

1. **Review Standards**: Familiarize yourself with our [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
2. **Issue Discussions**: Before starting substantial work or proposing new plugins/features, check existing issues or open a new discussion to align with the core maintainers.
3. **Repository Scope**: This repository focuses on technical documentation, official open-source plugins, developer examples, and ecosystem schemas.

---

## Development Workflow

1. **Fork & Branch**: Create a feature branch with a descriptive name (e.g., `docs/plugin-guide`, `feature/schema-validator`).
2. **Commit Hygiene**: Write clear, concise commit messages adhering to standard conventions.
3. **Documentation**: Ensure all changes are thoroughly documented and consistent with Chattree technical references.
4. **Pull Requests**: Open a pull request using our [PULL_REQUEST_TEMPLATE.md](./.github/PULL_REQUEST_TEMPLATE.md). Clearly describe the motivation, scope, and testing steps.

---

## Plugin Lifecycle: Development, Packaging, Publishing & Updates

All plugins distributed through the Chattree Marketplace follow a standardized lifecycle. Whether creating a new plugin or shipping an update to an existing one, follow the steps below:

### 1. Plugin Directory Structure
Official and community plugins are organized under `plugins/official/<plugin-slug>/`:

```text
plugins/official/calendar/
├── src/                      # Source code (WAT, Rust, C, etc.)
├── plugin.wat                # WebAssembly text source (if applicable)
├── plugin.wasm               # Compiled WebAssembly binary
├── plugin.json               # Required manifest
├── icon.png                  # 512x512 transparent/dark PNG icon
└── calendar-vX.Y.Z.chattree-plugin  # Packaged bundle
```

### 2. Building the `.chattree-plugin` Package
The bundle is a standard ZIP archive with files located directly in the root (no enclosing subfolders):

```powershell
# Windows (PowerShell)
Compress-Archive -Path plugin.json, plugin.wasm, icon.png -DestinationPath calendar-v1.0.2.zip -Force
Rename-Item "calendar-v1.0.2.zip" "calendar-v1.0.2.chattree-plugin"
```

```bash
# Linux / macOS
zip -9 calendar-v1.0.2.chattree-plugin plugin.json plugin.wasm icon.png
```

### 3. Publishing an Initial Release
1. **GitHub Release:** Create a tag matching the manifest version (e.g. `v1.0.0`) in the repository and attach the `.chattree-plugin` binary asset.
2. **Obtain Asset URL:** Copy the direct download URL for the asset:
   ```text
   https://github.com/<owner>/<repo>/releases/download/v1.0.0/<plugin-name>-v1.0.0.chattree-plugin
   ```
3. **Submit to Marketplace:**
   - **Via Web Portal:** Navigate to [Chattree Plugin Submission Portal](https://chattree.chat/submit-plugin), paste the asset URL, review auto-detected metadata, and click **Publish**.
   - **Via REST API:** Send a `POST` request to `https://chattree.chat/api/plugins/submit` with the package asset URL and metadata.

### 4. Updating an Existing Plugin
To release a new version of an already published plugin:

1. **Modify Code & Recompile:** Implement bug fixes or features, then recompile `plugin.wasm`.
2. **Update `plugin.json`:**
   - Increment `version` following Semantic Versioning (e.g. `1.0.1` -> `1.0.2`).
   - Update `wasmSha256` with the new SHA-256 hash of `plugin.wasm`.
   - Update `changelog` describing what changed in this version.
3. **Repackage:** Build the new `calendar-vX.Y.Z.chattree-plugin` bundle.
4. **Git Commit & Release:** Commit changes, push to GitHub, and draft a new GitHub Release with the new version tag (e.g. `v1.0.2`), attaching the new `.chattree-plugin` file.
5. **Marketplace Update:** Submit the new release download URL via the [Web Portal](https://chattree.chat/submit-plugin) or the REST API.
   - The marketplace automatically detects the plugin ID, validates that the new version is greater than the previous version, registers the new release, and marks it active.
   - Chattree mobile app users automatically receive an **"Update"** prompt on their devices.

---

## Coding and Contribution Standards

- **Code Style**: Follow the conventions specified in [`.editorconfig`](./.editorconfig).
- **Security & Permissions**: Any plugin or tooling contribution must respect Chattree's strict capability isolation and permission models.
- **Continuous Integration**: Once automated workflows are introduced, ensure all linting, schema validation, and test checks pass.

---

## Questions & Help

If you have questions about contributing, please refer to [SUPPORT.md](./SUPPORT.md).
