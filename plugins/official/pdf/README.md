# Chattree PDF Generator Plugin

The **Official PDF Generator Plugin** uses Chattree's AI to create downloadable PDF documents on any topic. Simply describe what you want and receive a formatted, two-page PDF directly in the chat.

---

## Features

- **Slash Command:**
  - `/pdf <topic>` — Generate a PDF on the given topic (e.g., `/pdf un archivo de dos páginas sobre la fotosíntesis`)
  - `/pdf <topic> | <pages>` — Specify the number of pages (e.g., `/pdf inteligencia artificial | 2`)
- **Natural Language (via `intentContract`):**
  - *"Crea un PDF sobre la fotosíntesis"*
  - *"Genera un documento sobre el cambio climático"*
  - *"Necesito un PDF de dos páginas sobre la historia de México"*
  - When the plugin is pinned (📌), just type naturally and the AI routes automatically.
- **Native file actions:**
  - The generated PDF is stored through Chattree's `files.write` capability and appears in the chat's standard file card.
  - Save and share are available when the user selects those actions. The plugin never opens the system share sheet automatically.
- **Privacy & Sandboxing:**
  - Runs entirely inside the WebAssembly linear-memory sandbox.
  - Requires explicit user authorization via `files.write`.
  - Zero cloud telemetry; PDF content is generated and saved locally.

---

## Required Capabilities

| Capability | Tier | Reason |
|---|---|---|
| `files.write` | Standard | Saves the generated PDF to the device sandbox. |

---

## Package Structure

```text
plugins/official/pdf/
├── icon.png           # 512x512 Pure black icon with white PDF/document glyph
├── banner.png         # 1200x630 Pure black cover banner with white typography
├── plugin.json        # Schema-validated manifest (v1.2.1)
├── plugin.wat         # WebAssembly Text format source
├── plugin.wasm        # Compiled WebAssembly binary
└── README.md          # Plugin documentation
```

---

## How to Package & Install

### 1. Validate the Plugin
```bash
node tools/validate-plugin.mjs plugins/official/pdf/
```

### 2. Package into `.chattree-plugin`
```bash
node tools/package-plugin.mjs plugins/official/pdf/
```

### 3. Install in the Chattree App
1. Transfer `com.chattree.official.pdf-v1.2.1.chattree-plugin` to your device.
2. In Chattree, navigate to **Settings → Plugins → Import plugin**.
3. Select the file, review the `files.write` capability, and confirm installation.

---

## Usage Examples

| Input | Result |
|---|---|
| `/pdf fotosíntesis` | Generates a 2-page PDF about photosynthesis |
| `/pdf inteligencia artificial` | Generates a 2-page PDF about artificial intelligence |
| `Crea un pdf sobre el sistema solar` | AI detects intent and generates the PDF |
| `Necesito un documento sobre historia de México` | AI detects intent and generates the PDF |
