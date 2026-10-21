# Core Concepts & System Architecture

Chattree is a privacy-first AI platform for Android designed to run neural language models directly on-device and execute extensible slash-command tools inside a secure WebAssembly sandbox.

---

## Architectural Overview

Chattree is structured into decoupled, modular layers:

```
┌─────────────────────────────────────────────────────────────┐
│                       Flutter UI Layer                      │
│   Chat Screen  ·  Command Palette  ·  Settings  ·  Marketplace │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Chat Controller                        │
│   Intent Routing  ·  Token Streaming  ·  Prompt Assembly    │
└───────────────┬──────────────────────────────┬──────────────┘
                │                              │
                ▼                              ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│   Local Inference Engine    │ │   External AI Subsystem     │
│   LlamaFlutterEngine (GGUF) │ │   RemoteInferenceEngine     │
│   On-Device Embeddings      │ │   OpenAI / Gemini / Claude  │
└───────────────┬─────────────┘ └──────────────┬──────────────┘
                │                              │
                ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vector RAG Subsystem                     │
│   Notes & Reminders Store (SQLite + Local Vector Index)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              WebAssembly Plugin Runtime (WASM)              │
│   PluginLoader  ·  Linear Memory Sandbox  ·  Fuel Metering  │
└──────────────────────────────┬──────────────────────────────┘
                               │ host_call()
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  ChattreeHostApi Bridge                     │
│   PermissionGateway  ·  Namespace Handlers (Storage/Net)   │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. On-Device Inference Engine

At the core of Chattree is its local inference engine:
- **Quantized GGUF Model Execution:** Runs lightweight LLMs directly on the smartphone's CPU, GPU, or NPU with no network connectivity required.
- **Zero Telemetry:** User conversations, prompt tokens, and system messages are stored only in the application's local sandbox database.
- **Streaming Response:** Generates tokens in real time, dispatched through an asynchronous stream with a 33ms throttle (~30 FPS) for smooth visual rendering.

---

## 2. Vector Retrieval-Augmented Generation (RAG)

Chattree incorporates an on-device vector search pipeline:
- **Local Embeddings:** When a note is created or edited, an on-device embedding model produces a dense vector representation.
- **Vector Index:** Vectors are indexed in an embedded database alongside note content.
- **Context Augmentation:** During conversation, relevant notes matching the user's query via cosine similarity are retrieved and injected into the model's context window.
- **Deterministic Removal:** Deleting a note automatically deletes its corresponding vector index entries.

---

## 3. WebAssembly Plugin Sandbox

To extend chat capabilities without exposing device security, Chattree runs plugins as isolated WebAssembly modules:
- **WASM 1.0 MVP + Bulk Memory:** Supports standard WebAssembly binaries compiled from WAT, Rust, C, C++, or Zig.
- **Linear Memory Protocol:** Plugins operate within an isolated linear memory buffer (default maximum 16 MB).
- **Instruction Fuel Limits:** Every plugin call is allocated an instruction budget (default 50,000,000 instructions) and a 5-second timeout, preventing infinite loops and freezing.
- **No Direct System Access:** Plugins cannot access operating system sockets, filesystem paths, threads, or hardware directly.

---

## 4. The Host API Bridge (`ChattreeHostApi`)

Plugins communicate with Chattree through a single imported function:
```wat
(import "chattree" "host_call" (func (param i32 i32 i32 i32) (result i32)))
```

### Call Protocol
1. **Request:** The plugin writes a JSON request payload into its linear memory at `reqPtr`.
2. **Dispatch:** The plugin calls `host_call(reqPtr, reqLen, resPtr, resMaxLen)`.
3. **Permission Check:** The `PermissionGateway` intercepts the call and verifies that the plugin possesses the declared and user-granted capability.
4. **Execution:**
   - **Synchronous Operations** (e.g., `storage.*`, `core.*`): Executed immediately. The return value is the byte length written to `resPtr`.
   - **Asynchronous Operations** (e.g., `network.*`, `chattree.notes.*`): Returns `0` immediately. The host performs the operation asynchronously and invokes the plugin's exported `resume(resPtr, resLen)` function once complete.
5. **Memory Safety:** If `reqLen` or `resMaxLen` exceeds allocated memory boundaries, `host_call` returns `-1` and aborts.

---

## 5. Dynamic Permission Gateway

Chattree implements a capability-based security model:
- **Normal Capabilities:** Low-risk sandbox privileges (such as `storage.private` or `share.text`) granted automatically.
- **Sensitive Capabilities:** Network requests, local file access, and note management require user authorization upon installation or first invocation.
- **Critical Capabilities:** Hardware sensors (camera, GPS location, contacts) require explicit user consent and standard Android OS runtime permissions.
- **User Control:** Users can inspect, modify, or revoke permissions at any time from **Settings → Plugins → [Plugin] → Permissions**.

---

## 6. Generative Visual Design Subsystem (`/visual`)

Chattree integrates a specialized vector design pipeline:
- **Natural Language Vector Generation:** Generates and refines professional SVG vector graphics (advertisements, marketplace cards, infographics, branding) through `/visual`.
- **Two-Pass Self-Correction:** Resilient multi-pass loop that automatically diagnoses and recovers from unclosed XML tags or model truncation errors.
- **Strict SVG Sanitizer:** Enforces a secure whitelist of static vector elements and strips scripts, external URLs, and event listeners.
- **Interactive UI:** Interactive zoom/pan preview, SVG/PNG export, and contextual design modification.

For full architectural details and developer APIs, refer to the [Visual Design Architecture Guide](./visual-design.md).

