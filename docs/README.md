# Chattree Technical Documentation Portal

Welcome to the technical documentation library for the **Chattree** ecosystem — an on-device AI platform featuring local Vector RAG, hybrid cloud model orchestration, and a sandboxed WebAssembly (WASM) plugin runtime for Android.

---

## Documentation Directory Index

### 1. Core Architecture & System Concepts
- **[Chattree App Features](./app-features.md)**: User-facing onboarding, local model management, chat history, settings, embeddings/RAG, and external AI provider workflows.
- **[Core Concepts & Architecture](./core-concepts.md)**: High-level architectural overview covering on-device LLMs, local Vector RAG embeddings, and the WebAssembly isolation boundary.
- **[Installation & Toolchain Setup](./installation.md)**: Device prerequisites for Android and developer toolchain setup for compiling WebAssembly plugins.
- **[Authentication & Configuration](./authentication-configuration.md)**: Zero-telemetry hardware keystore security, API keys for remote models, and plugin permission controls.
- **[Notes & Reminders (Vector RAG)](./notes-reminders.md)**: Conversational slash commands (`/note`, `/reminder`) and programmatic Host API access with vector indexing.
- **[Visual Design Architecture (`/visual`)](./visual-design.md)**: Generative vector SVG graphics pipeline, resilient two-pass extraction, SvgSanitizer security, and atomic persistence.
- **[External AI Providers](./ai_providers/architecture.md)**: Interface contracts, encrypted credential storage, and provider adapters for OpenAI, Gemini, and Anthropic.

### 2. WebAssembly Plugin SDK
- **[Plugin SDK Overview](./plugins/README.md)**: Architecture of the plugin subsystem, execution lifecycle, memory layout, and runtime host boundary.
- **[Getting Started with Plugins](./plugins/getting-started.md)**: Hands-on walkthrough building, compiling, hashing, and packaging your first plugin from scratch.
- **[Plugin Manifest Specification (`plugin.json`)](./plugins/plugin-manifest.md)**: Authoritative specification for manifest fields, limits, tools, and permission requests.
- **[ChattreeHostApi Reference](./plugins/host-api.md)**: Complete specification of all `chattree.host_call` namespaces, synchronous vs. asynchronous execution, and data payloads.
- **[Capabilities & Permissions Catalogue](./plugins/capabilities.md)**: Full taxonomy of security tiers (normal, sensitive, critical) and permissions required per Host API operation.
- **[Package Format Specification (`.chattree-plugin`)](./plugins/package-format.md)**: ZIP container rules, root-level layout, SHA-256 cryptographic verification, and packaging tools.
- **[Security & Sandbox Model](./plugins/security.md)**: Linear memory isolation, instruction fuel limits, timeout enforcement, and network SSRF guards.
- **[Versioning & Compatibility](./plugins/versioning.md)**: SemVer rules for plugins, `schemaVersion`, `runtimeApiVersion`, and backward compatibility guarantees.
- **[Marketplace Publishing Guide](./plugins/marketplace_publishing_guide.md)**: End-to-end publishing via GitHub Releases and the submission portal or REST API.
- **[Host API Error Codes](./plugins/errors.md)**: Comprehensive diagnostic reference for runtime faults, permission rejections, and execution errors.

### 3. Developer Tutorials, Examples & Diagnostics
- **[Guides & Tutorials](./tutorials.md)**: Step-by-step tutorials for building plugins in WAT and Rust, HTTP networking, and private storage.
- **[Code Examples](./code-examples.md)**: Copy-pasteable recipes and patterns for common extension scenarios.
- **[Runnable Examples (`examples/`)](../examples/README.md)**:
  - **[`/hello`](../examples/hello/)**: Zero-capability minimal WAT greeting plugin.
  - **[`/notes-demo`](../examples/notes-demo/)**: Asynchronous integration with Chattree Notes Host API.
- **[Official Starter Template (`templates/plugin/`)](../templates/plugin/README.md)**: Turnkey starter kit featuring WAT and Rust configurations.
- **[Troubleshooting & Diagnostics](./troubleshooting.md)**: Solutions for common installation, compilation, timeout, and permission issues.
- **[Frequently Asked Questions (FAQ)](./faq.md)**: Answers to common questions regarding offline inference, storage, and privacy.

---

## Synchronization with Chattree Web

English technical documentation in this directory is the source for the website's canonical English reference pages. The web application synchronizes Markdown and examples using `Web/scripts/sync-docs.mjs`. Some localized pages are maintained separately in `Web/lib/docs.ts`; update those translations when their English source behavior changes.
