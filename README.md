<p align="center">
  <img src="assets/chattree-icon.jpg" width="96" height="96" alt="Chattree Logo" style="border-radius: 20%;" />
</p>

# Chattree — Official Repository

Welcome to the official **Chattree** open-source repository.

Chattree is a next-generation platform for conversational tree architectures, modular AI agent orchestration, and extensible plugin ecosystems. This repository serves as the central hub for Chattree's public technical documentation, developer examples, official open-source plugins, schemas, and community contribution resources.

---

## Repository Purpose & Scope

The goal of this repository is to empower developers, system integrators, and contributors to build on and extend the Chattree ecosystem.

Here you will find:
- **Technical Documentation**: Comprehensive architecture guides, plugin lifecycle specifications, and API references.
- **Official Plugins**: First-party, core-maintained plugins adhering to strict security and capability standards.
- **Developer Examples**: Functional, end-to-end integration patterns and code samples.
- **Templates & Schemas**: Authoritative manifests, validation schemas, and plugin starter kits.
- **Developer Tools**: Utilities and scripts for testing, packaging, and validation.

---

## Directory Structure

```text
chattree-repo/
├── .github/              # Issue/PR templates and workflow definitions
├── assets/               # Brand assets, logos, and ecosystem icons
├── docs/                 # Public technical documentation & architecture guides
├── examples/             # Official developer examples and integration patterns
├── plugins/
│   └── official/         # Core-maintained official open source plugins
├── templates/
│   └── plugin/           # Official plugin starter templates
├── schemas/              # Official JSON schemas (manifests, packages, configs)
├── tools/                # Developer utilities and CLI tools
├── scripts/              # Maintenance, automation, and validation scripts
├── CHANGELOG.md          # Release history and unreleased changes
├── CODE_OF_CONDUCT.md    # Community standards and conduct expectations
├── CONTRIBUTING.md       # Contribution guidelines and development workflow
├── LICENSE               # MIT License
├── README.md             # Repository overview and entry point
├── SECURITY.md           # Responsible vulnerability disclosure policy
└── SUPPORT.md            # Getting help and support resources
```

---

## Official Plugins & Marketplace

Chattree features an extensible WebAssembly (WASM) plugin ecosystem. Official plugins are maintained within this repository under `plugins/official/`.

The runtime provides high-performance, sandboxed host capabilities for plugins:
- **Real-Time WebSockets (`network.websocket`):** Full-duplex streaming connections (up to 10 sockets, 16 MB max frame size, 500 queued messages buffer, SSRF protected).
- **Declarative Interactive UI (`ui.components`):** Rich cards in chat with progress bars, status badges, metric tables (up to 40 items), and action buttons with security confirmation modals.
- **Scheduled Tasks & Cron Automations (`scheduler.task`):** Standard 5-field Cron jobs and periodic background tasks with anti-battery drain protection (minimum 60s interval, up to 25 tasks, 128 KB payload).
- **Private Relational SQLite Database (`database.sql`):** Fully isolated relational databases (`plugin_<pluginId>.db`) with 200 MB storage quota, atomic batch transactions, and up to 2,000 rows per query.
- **Notification Hub Subsystem (`notifications.read`, `notifications.query`, `notifications.reply`, `notifications.action`):** Deep integration with Android system notifications. Plugins can stream real-time incoming alerts via `HostEventBus`, query active status bar notifications, perform inline direct replies using native `RemoteInput` (capped at 4,000 chars), and dismiss alerts, with automatic OS-level OTP/2FA redaction and zero core persistence.
- **Inbound Webhooks & 24/7 Cloud Relay (`network.webhook_inbound`):** Local HTTP listener (loopback `127.0.0.1` and LAN `0.0.0.0`) in foreground with automatic lifecycle pause/resume on Android (0 battery drain, zero foreground service) and Cloudflare Worker + KV Store-and-Forward relay delivering encrypted triggers via Firebase FCM v1 (up to 256 KB, zero secret leaks, immediate foreground and background visual push notifications).
- **Hardened Network & SSRF Guard (`WebhookSsrfGuard`):** Strict loopback/LAN validation, blocking of all IANA special IPv4/IPv6 ranges (Carrier-Grade NAT, Benchmarking, ULA, 6to4, Teredo) with iterative multi-IP DNS fallback prior to connection.
- **Cryptographic Trust Boundaries & Release Hygiene:** Immutable Ed25519 root authority (`rootKeyId = "chattree-official-v1"`), community developer certificate validation, single-use runtime WASM execution authorizations (`WasmExecutionAuthorization`), persistent anti-downgrade watermarks in `PluginStateStore`, atomic transaction rollbacks, OS-level `FileLock` activity logging, UI token masking (`obscureText`), and pre-packaging Gradle scanners detecting Java KeyStore magic bytes (`0xFEEDFEED` / `0xCECECECE`).

Plugins are distributed as `.chattree-plugin` ZIP archives. In addition to SHA-256 integrity verification, packages can be cryptographically signed using Ed25519 keypairs anchored to the Chattree root PKI. Marketplace submission is available through the **Chattree Marketplace**:
- **Distribution:** Hosted as public binary assets on GitHub Releases.
- **Publication & Updates:** Submitted via the [Chattree Plugin Submission Portal](https://chattree.chat/submit-plugin) or the automated REST API (`POST /api/plugins/submit`).
- **In-App Delivery:** Marketplace listings can be installed from the Chattree app. Availability and update behavior depend on the configured marketplace service and app version; submission is not an approval or signing process.

For step-by-step instructions on packaging, publishing, and updating plugins, refer to the [Marketplace Publishing Guide](./docs/plugins/marketplace_publishing_guide.md).

---

## Contributing

We welcome community feedback and contributions! Please review [CONTRIBUTING.md](./CONTRIBUTING.md) and our [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) before submitting pull requests or opening discussions.

---

## License

This project is licensed under the terms of the [MIT License](./LICENSE).
