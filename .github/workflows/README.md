# GitHub Actions Workflows

This directory is designated for continuous integration, testing, and deployment workflows powered by GitHub Actions.

---

## Validation & CI Checks

Before submitting changes or cutting a release, run the repository validation suite locally:
- **Schema & Plugin Validation**: `node scripts/validate-all.mjs` validates all examples, templates, and official plugins against `schemas/`.
- **Web Docs Sync & Type-Checking**: `npm run lint` and `npx tsc --noEmit` in `Web/` verify documentation synchronization and Next.js build integrity.
