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

Plugins are distributed as `.chattree-plugin` ZIP archives. The package includes a SHA-256 digest for the WASM binary; this detects package changes, but is not a publisher signature or proof of publisher identity. Marketplace submission is available through the **Chattree Marketplace**:
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
