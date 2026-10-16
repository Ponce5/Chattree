# Changelog

All notable changes to the Chattree official repository will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Initial repository layout and organization structure.
- Community guidelines (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`).
- Placeholder directories and structure guides for `docs/`, `examples/`, `plugins/official/`, `templates/`, `schemas/`, `tools/`, and `scripts/`.
- Repository baseline configuration (`.editorconfig`, `.gitattributes`, `.gitignore`, `.github/`).
- Official Device Calendar plugin (`plugins/official/calendar/`) upgraded to v1.1.0:
  - 100% conversational AI tool execution (`créame una reunión`, natural requests).
  - Robust parameter parsing for dates (`startDate`, `endDate`), titles, pipe syntax, and direct JSON payloads.
  - New minimalist black-and-white icon (`icon.png`) and official brand logo banner (`logo.png`).
  - Standardized `ToolResult` output contract without static/canned error messages.
  - Added direct command alias `/reunion` and expanded command aliases (`reunion`, `meeting`, `cita`, `agenda`).
  - Automated WebAssembly test runner (`scripts/test_calendar_wasm.js`).


