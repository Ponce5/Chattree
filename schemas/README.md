# Chattree Schemas Directory

This directory houses the authoritative JSON Schemas and structural validation contracts governing the Chattree ecosystem.

---

## Active Schemas

### 1. Plugin Manifest Schema v1 (`plugin.manifest.v1.schema.json`)

- **File:** [`plugin.manifest.v1.schema.json`](./plugin.manifest.v1.schema.json)
- **Specification Version:** Draft-07
- **Schema Version:** `1`
- **Target File:** `plugin.json` in `.chattree-plugin` package root

#### Key Validations Enforced:
- **Identifier (`id`):** Reverse-domain notation (`com.developer.plugin-name`) containing lowercase letters, numbers, hyphens, and dots.
- **Semantic Versioning (`version`):** Strict SemVer specification (`MAJOR.MINOR.PATCH`).
- **Primary Command (`primaryCommand`):** Lowercase alphanumeric and hyphens without slashes (e.g. `echo`).
- **Runtime Environment:** Mandatory `"runtime": "wasm"`, `"wasmPath": "plugin.wasm"`, and `"runtimeApiVersion": "1.0.0"`.
- **Integrity Checksum (`wasmSha256`):** Exactly 64 lowercase hexadecimal characters matching the SHA-256 digest of `plugin.wasm`.
- **Capabilities (`capabilities`):** Validated against the official Chattree Host API capability catalogue (e.g. `storage.private`, `network.http`, `chattree.notes.*`).
- **Runtime Limits:** Enforces safety constraints on `maxMemoryPages` (≤ 256 pages / 16 MB) and `timeoutMs` (≤ 60000 ms).

---

## Usage in Code Editors

To enable real-time autocompletion, field documentation, and validation in Visual Studio Code or JetBrains IDEs, add the `$schema` property at the top of your `plugin.json`:

```json
{
  "$schema": "https://chattree.chat/schemas/plugin.manifest.v1.schema.json",
  "schemaVersion": 1,
  "id": "com.example.my-plugin",
  "version": "1.0.0",
  "name": "My Plugin",
  "description": "A custom WebAssembly extension for Chattree.",
  "author": "Your Name",
  "primaryCommand": "mycmd",
  "type": "imported",
  "capabilities": ["storage.private"],
  "runtime": "wasm",
  "entrypoint": "mycmd",
  "wasmPath": "plugin.wasm",
  "wasmSha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "runtimeApiVersion": "1.0.0"
}
```

Or reference it locally via relative path:
```json
"$schema": "../../schemas/plugin.manifest.v1.schema.json"
```

---

## Command Line Validation

Validate your manifest against this schema using `tools/validate-plugin.mjs`:

```bash
node tools/validate-plugin.mjs path/to/my-plugin/
```
