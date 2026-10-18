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
- Official Device Calendar plugin (`plugins/official/calendar/`) upgraded to v1.2.2:
  - Removed `logo.png` from `.chattree-plugin` package to comply with Chattree archive whitelist rules (`allowedArchiveFiles`).
  - Reduced package distribution bundle size from 191 KB to 10.2 KB.
  - Sincronized package validation in `pluginValidation.ts`.
- Official Device Calendar plugin (`plugins/official/calendar/`) upgraded to v1.2.1:
  - Corregido el parsing de respuestas del Host API para admitir cualquier formato JSON (con o sin espacios).
  - Protegido el buffer de memoria en offset 0 para evitar corrupción de entrada.
  - Resuelto falso error de permisos al agendar reuniones.
- Official Device Calendar plugin (`plugins/official/calendar/`) upgraded to v1.2.0:
  - Unified all calendar features under a single `/calendar` command with the minimalist calendar icon.
  - Calling `/calendar` without arguments queries the device calendar and displays the upcoming agenda and scheduled meetings.
  - Calling `/calendar` with arguments or conversational requests (e.g. `créame una reunión`) triggers intelligent AI scheduling.
  - Consolidated slash command palette, removing duplicate tool commands.
  - Cleaned up obsolete package archives and verified WebAssembly test runner.



