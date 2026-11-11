# Security Policy

The Chattree team takes the security of our platform, ecosystem, and plugins very seriously. We appreciate the efforts of the security research community to improve our security posture through responsible disclosure.

---

## Supported Versions

Security updates and patches will be provided for currently supported versions once initial stable releases are published:

| Version | Supported          |
| ------- | ------------------ |
| Initial | Under Active Setup |

---

## Security Architecture & Cryptographic Trust Boundaries

Chattree enforces defense-in-depth principles across the application runtime, marketplace, and plugin ecosystem:

1. **Root Key Custody:** The official Ed25519 private signing key is held strictly offline in secure hardware custody. The mobile client embeds solely the immutable public root key constant (`officialKeyBytesV1`). No private keys, mock keypairs, or deterministic seeds are included in production code or release binaries.
2. **Community Developer PKI:** Community developer public keys are registered via digital certificates signed by the official root authority (`rootKeyId = "chattree-official-v1"`), validating developer identity, public key fingerprint, validity dates, and minimum app version compatibility.
3. **Anti-Downgrade Version Watermarks:** A persistent watermark tracks the maximum historical version installed per plugin. Reverting to older, potentially vulnerable plugin versions is blocked unconditionally.
4. **WASM Execution Authorization:** Execution of plugin binaries requires a single-use token cryptographically validated by `PluginPackageManager` and bound to the production runtime singleton.
5. **Runtime Mutator Sealing:** Production singletons are permanently locked at startup (`lockForProduction()`), disabling all test mutators (`clearMemoryCache`, `clearForTesting`, `setBaseDirectoryForTesting`, `setMockArchiveProviderForTesting`) with `SecurityException`.
6. **Atomic Transactional Rollback:** Installation and update failures trigger an immediate fail-closed rollback, preventing orphan files or unverified keys from remaining in memory or disk.
7. **Cloud Relay Store-and-Forward & Secret Isolation:** Inbound cloud webhooks pass through an isolated personal Cloudflare Worker (`chattree-relay-<hash>`) storing up to 256 KB payloads in Cloudflare KV with a 72h TTL. The push notification delivered through Google FCM v1 carries solely cryptographic metadata references (`v: '2', id, ts, path, sig`) signed with HMAC-SHA256; zero secrets, tokens, or webhook bodies travel across Google FCM. If FCM delivery fails, payloads in KV are purged atomically.
8. **SSRF Defense with IANA Special Range Filtering & DNS Fallback:** Network connections are validated against all IANA special-purpose IPv4 and IPv6 registries (Carrier-Grade NAT, Benchmarking, ULA, 6to4, Teredo, loopback, link-local, cloud metadata). For multi-IP DNS resolutions, `connectWithDnsFallback` pre-validates every individual IP address before opening a socket.
9. **Android Lifecycle & Zero Background Sockets:** The local LAN HTTP server (`InboundHttpServer`) operates strictly in the foreground. It listens for OS lifecycle events (`WidgetsBindingObserver`) and suspends open sockets immediately upon backgrounding, eliminating battery drain and eliminating the need for invasive `FOREGROUND_SERVICE` permissions.
10. **Activity Log Transactional Concurrency & Privacy:** Webhook activity entries are stored in `InboundActivityStore` protected by OS-level `FileLock.blockingExclusive` and atomic file renames across multi-isolate environments. Request bodies, authorization headers, and secret tokens are strictly excluded from logs to protect user privacy.
11. **Release Hygiene & KeyStore Scanning:** Automated Gradle verification tasks (`scanSecretsBeforeReleasePackaging` and `scanReleaseArtifacts`) inspect production build inputs and final APK/AAB artifacts against Java KeyStore magic bytes (`0xFEEDFEED` / `0xCECECECE`) and credential file patterns, ensuring signing keys and private configurations are never bundled into release distributions.

---

## Reporting a Vulnerability

If you discover a potential security vulnerability within Chattree, its official plugins, schemas, or developer tools:

1. **Do not open a public issue.** Please avoid disclosing the vulnerability publicly on issue trackers, forums, or social networks until it has been reviewed and resolved.
2. **Responsible Disclosure**: Official dedicated security contact channels (such as private security advisories or a dedicated security reporting email) will be announced alongside the security team setup.
3. **Information to Include**:
   - A detailed description of the vulnerability.
   - Clear steps or a proof of concept (PoC) to reproduce the issue.
   - The affected components, versions, and configurations.
   - Any potential mitigations or workarounds you have identified.

---

## Response Process

Once a vulnerability report is received through official security channels:
- Receipt will be acknowledged in a timely manner.
- The core engineering team will investigate and determine severity and impact.
- Regular updates will be provided during the remediation process.
- Fixes will be coordinated and released with appropriate security advisories.
