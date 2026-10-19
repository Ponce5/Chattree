# Official Echo Plugin

The **Official Echo Plugin** is a first-party utility plugin demonstrating zero-capability text processing in WebAssembly.

---

## Features
- Command: `/echo <message>`
- Returns: `Echo: <message>`
- Capabilities: None (completely sandboxed and isolated)

---

## Building & Packaging
```bash
# Compile WAT to WASM
wat2wasm plugin.wat -o plugin.wasm

# Package with developer tool
node ../../../tools/package-plugin.mjs ./
```
