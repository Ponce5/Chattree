# Chattree Official Open-Source Plugins

This directory is the reserved workspace for first-party, official open-source plugins maintained directly by the Chattree core team.

---

## Purpose & Scope

Plugins located in this directory provide official extensions to the Chattree platform, serving as core functionality enhancements and authoritative benchmarks for plugin development.

This directory is strictly separated from:
- **Developer Examples** (located in `/examples/`): which serve primarily as learning tutorials.
- **Community Plugins**: which are submitted, distributed, and maintained by third-party community authors.

---

## Standards for Official Plugins

Every official plugin maintained here must adhere to the highest quality and security standards:

1. **Official Package Structure**: Strict compliance with the official Chattree plugin directory and packaging structure.
2. **Valid Manifest**: Complete, schema-validated `plugin.json` (or equivalent manifest) defining metadata, entry points, and capabilities.
3. **Permission & Capability Declarations**: Explicit declaration of minimum required permissions. Unscoped or excessive privilege requests are prohibited.
4. **Sandbox & Security Compliance**: Full compatibility with Chattree's sandbox isolation model and zero unvetted external runtime dependencies.
5. **Testing & Documentation**: Comprehensive unit/integration tests and complete developer documentation for each plugin.

---

## Official Plugins Catalog

| Plugin | Package ID | Primary Command | Capabilities | Status |
|---|---|---|---|---|
| [Device Calendar](./calendar/README.md) | `com.chattree.official.calendar` | `/calendar` | `calendar.create`, `calendar.read` | ✅ Available |

