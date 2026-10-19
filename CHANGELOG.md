# Changelog

All notable changes to the Chattree official repository will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-18

### Added
- **Plugin SDK & Host API Documentation:** Complete technical specifications for the WebAssembly plugin runtime, linear memory protocol, `chattree.host_call`, and async resume mechanics.
- **Capabilities & Permissions Catalogue:** Authoritative taxonomy defining risk tiers (`normal`, `sensitive`, `critical`) and access requirements across private storage, HTTP, location, camera, notes, and reminders.
- **Formal JSON Schema (`schemas/plugin.manifest.v1.schema.json`):** Draft-07 schema for strict validation of `plugin.json` manifests, including SemVer, command syntax, capability identifiers, and resource thresholds.
- **Developer Tools (`tools/`):**
  - `validate-plugin.mjs` / `.js`: Multi-platform command-line tool validating manifests, WASM headers, SHA-256 integrity, and ZIP root layout.
  - `package-plugin.mjs` / `.js`: Zero-dependency packager automatically calculating `wasmSha256` and assembling `.chattree-plugin` archives.
- **Turnkey Starter Template (`templates/plugin/`):** Complete starter kit with preconfigured `plugin.json`, WAT source (`src/plugin.wat`), Rust source (`src/lib.rs`, `Cargo.toml`), and a 512x512 icon.
- **Runnable Developer Examples (`examples/`):**
  - `examples/hello/`: Zero-capability greeting plugin in WAT.
  - `examples/notes-demo/`: Asynchronous integration with Chattree Notes Host API.
- **Official Plugins (`plugins/official/`):** First-party `echo/` plugin demonstrating minimal, isolated text transformation.
- **Marketplace Publishing Guide:** Detailed instructions and REST API specifications (`POST /api/plugins/submit`) for registering plugins via GitHub Releases.
- **Architecture Guides:** Comprehensive documentation for local Vector RAG, hybrid AI providers (OpenAI, Gemini, Anthropic), and Android keystore security.

### Changed
- Unified documentation source across Web and GitHub repositories, establishing `chattree-repo/docs/` as the single source of truth.
- Synchronized Web docs build pipeline with hybrid multi-language support (ES, FR, EN) and localized navigation.
- Fixed relative markdown links and removed deprecated private build script references.

---

## [0.1.0] - 2026-10-14

### Added
- Initial repository layout and organization structure.
- Community guidelines (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`).
- Repository baseline configuration (`.editorconfig`, `.gitattributes`, `.gitignore`, `.github/`).
