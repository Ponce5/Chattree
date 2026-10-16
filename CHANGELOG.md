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
- Official Device Calendar plugin (`plugins/official/calendar/`) upgraded to v1.2.0:
  - Unified all calendar features under a single `/calendar` command with the minimalist calendar icon.
  - Calling `/calendar` without arguments queries the device calendar and displays the upcoming agenda and scheduled meetings.
  - Calling `/calendar` with arguments or conversational requests (e.g. `créame una reunión`) triggers intelligent AI scheduling.
  - Consolidated slash command palette, removing duplicate tool commands.
  - Cleaned up obsolete package archives and verified WebAssembly test runner.



