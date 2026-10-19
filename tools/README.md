# Chattree Developer Tools

This directory contains official developer tools and command-line utilities for creating, validating, and packaging Chattree WebAssembly plugins.

---

## Utilities Overview

| Tool | Script | Description |
|---|---|---|
| **Plugin Validator** | [`validate-plugin.mjs`](./validate-plugin.mjs) / [`.js`](./validate-plugin.js) | Validates manifests, WASM headers, SHA-256 hashes, capabilities, and archive root structure. |
| **Plugin Packager** | [`package-plugin.mjs`](./package-plugin.mjs) / [`.js`](./package-plugin.js) | Computes `wasmSha256`, updates `plugin.json`, and bundles files into a `.chattree-plugin` ZIP. |

---

## 1. Plugin Validator (`validate-plugin.mjs`)

Validates either a **source directory** or an assembled **`.chattree-plugin` archive** against Chattree's strict security and schema criteria.

### Checks Performed:
- **Root Layout:** In archives, ensures `plugin.json` and `plugin.wasm` reside strictly at the archive root without subdirectories.
- **WASM Binary Integrity:** Verifies the `\0asm` binary header and ensures the compiled code has valid exports.
- **SHA-256 Checksum:** Verifies that `manifest.wasmSha256` exactly matches the SHA-256 hash of `plugin.wasm`.
- **Manifest Specification:** Enforces reverse-domain ID syntax, SemVer versioning, primary command rules, and execution constraints.
- **Capability Scrutiny:** Verifies declared capabilities against the official Chattree Host API capabilities catalogue.

### Usage:
```bash
# Validate a plugin directory
node tools/validate-plugin.mjs path/to/my-plugin/

# Validate a compiled .chattree-plugin archive
node tools/validate-plugin.mjs path/to/my-plugin.chattree-plugin
```

---

## 2. Plugin Packager (`package-plugin.mjs`)

Zero-dependency bundler that packages your plugin files into a ready-to-distribute `.chattree-plugin` archive.

### Features:
- Automatically calculates the SHA-256 hash of `plugin.wasm`.
- Automatically syncs the `wasmSha256` field in `plugin.json` if it was outdated or placeholder.
- Bundles `plugin.json`, `plugin.wasm`, and optional `icon.png`, `README.md`, `LICENSE` at root level.
- Generates `<plugin-id>-v<version>.chattree-plugin` ready for GitHub Releases and Marketplace submission.

### Usage:
```bash
# Package the plugin in the current directory
node tools/package-plugin.mjs

# Package a specific directory
node tools/package-plugin.mjs examples/hello/
```
