# Visual Design & Vector Graphics Architecture Guide

Chattree incorporates an integrated, high-fidelity visual design subsystem orchestrated through the `/visual` command. It enables users and developers to generate, preview, edit, and export publication-ready SVG (Scalable Vector Graphics) vector artwork directly within the conversational interface.

This guide details the architectural pipeline, prompt engineering directives, security sanitization contracts, and programmatic interfaces available for developers extending the Chattree visual ecosystem.

---

## Architectural Pipeline Overview

The Visual Design subsystem operates as a multi-stage resilient pipeline that bridges generative LLM inference with strict deterministic security, structural XML validation, and reactive Flutter rendering.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           User Interaction                              │
│   /visual <design prompt>   OR   /visual <refinement modification>      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    VisualDesignTool (ChattreeTool)                      │
│   · Assembles system art direction prompt (Creation or Refinement)      │
│   · Allocates high token budget (4096 tokens)                            │
│   · Disables reasoning/thinking mode (allocating full budget to SVG)    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   Inference Engine (Cloud / Local)                      │
│   · Cloud Providers (OpenAI, Gemini, Anthropic, OpenRouter) or Local    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Raw stream / completion
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   Pass 1: Structural SVG Extraction                     │
│               VisualDesignTool.extractSvgDetailed()                     │
│   · Strips code fences (```svg, ```xml, ```) and surrounding prose      │
│   · Tolerates <?xml ...?> declarations and parses XML DOM               │
│   · Detects: unclosed tags, multiple documents, or malformed syntax     │
└───────────────────┬─────────────────────────────────┬───────────────────┘
                    │                                 │
           Extraction Failure                  Extraction Success
                    │                                 │
                    ▼                                 ▼
┌────────────────────────────────────────┐ ┌──────────────────────────────┐
│        Pass 2: Auto-Retry Loop         │ │ Stage 3: Security Sanitizer  │
│  · Injects specific XML repair prompt  │ │        SvgSanitizer.sanitize │
│  · Exact failure diagnosis passed      │ │  · Whitelist element check   │
│  · Automatic second chance generation  │ │  · Strips XSS / scripts / URI│
└───────────────────┬────────────────────┘ └──────────────┬───────────────┘
                    │                                     │
            Retry succeeded                        Sanitization Pass
                    │                                     │
                    └───────────────────┬─────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   Atomic Persistence (VisualChatRefs)                   │
│   · Path traversal & identifier sanitization                            │
│   · Two-phase atomic write (temp file -> target .svg)                   │
│   · Links to ChatMessageModel.svgRef in SQLite                          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Flutter Presentation Layer                          │
│   · VisualPreviewBubble (in-chat card with flutter_svg)                 │
│   · Fullscreen Pan & Zoom interactive viewer                            │
│   · Actions: Copy SVG XML, Export PNG/SVG, Undo / Redo modifications    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Conversational Commands & Usage

### Creating New Graphics from Scratch
Users can initiate visual design using the `/visual` slash command followed by a descriptive prompt:

```text
/visual Modern minimalist banner for a specialty coffee roastery with warm earthy tones, clean typography, and geometric badge
/visual Marketplace product card for wireless noise-cancelling headphones, high contrast dark mode, featuring a sleek hero silhouette
/visual Clean infographic flowchart explaining the 3-tier WebAssembly security model with connecting lines and labels
```

### Contextual Refinements
When an SVG has already been generated in the active conversation, typing `/visual` with modification instructions automatically initiates the **Refinement Pipeline**:

```text
/visual Change the background to deep navy blue #0B132B and make the title font bolder
/visual Replace the circular icon with an angular badge and add a subtle gold linear gradient
/visual Make the composition lighter and increase the negative space around the headline
```

---

## 2. Art Direction & Prompt Engineering

The system prompt instructed to the AI model enforces strict professional graphic design criteria rather than generic clip-art templates.

### Design Principles Enforced
* **Originality in Spatial Composition:** Forbids repetitive "centered title + subtitle + 3 cards" boilerplate. Encourages dynamic asymmetrical layouts, split-screen color blocking, hero focal points, architectural typography, and purposeful negative space.
* **Commercial & Marketplace Quality:** Emphasizes focal points that grab attention in the first second, bold headlines, balanced hierarchy, and clean secondary information.
* **Anti-Hallucination Commercial Guardrail:** The model is strictly prohibited from inventing fake prices, discount percentages, statistics, reviews, or fake trademark endorsements not provided by the user.
* **Intentional Minimalism:** Discourages arbitrary decoration, visual clutter, and heavy gradients. Uses typography, scale, alignment, and calibrated spacing to achieve elegance.
* **Typographic Rigor:** High contrast between primary headlines (`font-weight="700"/"800"`), subheaders (`font-weight="500"`), and labels, keeping text sizes readable (≥11px on a `500x500` viewBox) and inside safe canvas margins.

---

## 3. Structural Extraction & Resilient Parsing

LLMs frequently output conversational explanations or Markdown wrappers alongside code. `VisualDesignTool.extractSvgDetailed()` parses the response with structural XML awareness:

| Feature | Behavior |
| :--- | :--- |
| **Code Fences** | Handles and strips ```` ```svg ````, ```` ```xml ````, and plain ```` ``` ```` wrappers automatically. |
| **Prologues & Epilogues** | Discards introductory greetings and conversational follow-ups outside the `<svg>...</svg>` root. |
| **XML Declarations** | Tolerates and strips `<?xml version="1.0" ...?>` preceding `<svg>`. |
| **Nested Viewports** | Accurately identifies the outer root boundary even if the SVG includes nested `<svg>` sub-elements. |
| **Single Document Invariant** | Strictly rejects model responses containing multiple concatenated `<svg>` documents to prevent corruption. |

### Extraction Status Codes
```dart
enum SvgExtractionStatus {
  success,           // Valid, complete root SVG element extracted
  emptyResponse,     // Raw model response was empty or whitespace
  notFound,          // No <svg> tag discovered in response
  unclosed,          // Opening <svg> found but missing closing </svg>
  multipleDocuments, // Multiple separate <svg> roots detected
  malformed,         // Syntax errors or crossed XML tags
}
```

---

## 4. Two-Pass Self-Correction Loop

If extraction encounters an unclosed SVG (often caused by token truncation) or malformed XML syntax, Chattree does **not** fail immediately. It triggers a second pass:

1. **Pass 1 Failure Detection:** The error is captured along with the raw response and diagnostic failure reason.
2. **Targeted Correction Prompt:** `buildCorrectionHistory()` builds a correction message sent to the model:
   ```text
   [Error de validación en el código SVG anterior]:
   El documento SVG está incompleto (falta la etiqueta de cierre </svg>).

   Instrucciones obligatorias de corrección:
   1. Corrige el diseño asegurando que sea código SVG válido y bien formado (XML estándar).
   2. Cierra explícitamente todas las etiquetas XML abiertas.
   3. Utiliza únicamente los elementos y atributos permitidos.
   4. Devuelve únicamente el código <svg>...</svg> corregido sin texto explicativo.
   ```
3. **Pass 2 Recovery:** The model re-evaluates and repairs the output. If Pass 2 succeeds, the user receives their graphic seamlessly without noticing the intermediate correction.

---

## 5. Security & SvgSanitizer Specification

To guarantee safety against cross-site scripting (XSS), XML External Entity (XXE) attacks, and malicious payloads, all extracted vector markup must pass through `SvgSanitizer`.

### Whitelist of Allowed SVG Elements
Only safe static presentation elements are permitted:
* **Containers & Structure:** `svg`, `g`, `defs`, `clipPath`, `pattern`, `marker`
* **Vector Shapes:** `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `path`
* **Typography:** `text`, `tspan`
* **Gradients & Styling:** `linearGradient`, `radialGradient`, `stop`

### Forbidden Elements & Attributes
| Category | Prohibited Elements / Attributes | Security Rationale |
| :--- | :--- | :--- |
| **Executable Code** | `<script>`, `<style>`, `<a>`, `<foreignObject>` | Prevents script execution, redirection, and HTML injection. |
| **External Resources** | `<image>`, `<use>`, external `href`, external `url(...)` | Prevents remote tracking, SSRF, and external asset dependencies. |
| **Filters & Complexity** | `<filter>`, `<symbol>`, animation elements (`<animate*>`) | Prevents ReDoS, GPU memory exhaustion, and CPU denial-of-service. |
| **Event Handlers** | `onclick`, `onload`, `onerror`, `onmouseover`, etc. | Eliminates DOM event hijacking. |

---

## 6. Token Budgeting & Configuration

SVG vector code is token-dense due to floating-point coordinates and XML attributes.

* **4096-Token Floor for `/visual`:**  
  When `/visual` is invoked, `ChatController` automatically overrides the runtime token limit to a minimum of **4096 tokens**, ensuring sufficient headroom for both initial generation and repair passes.
* **Thinking Suppression:**  
  Internal reasoning (`<think>...</think>`) is explicitly deactivated during `/visual` invocations (`toolThinking = false`). This guarantees that 100% of the token allocation is reserved for the vector XML output.
* **User Configurable:**  
  Users can adjust the global token limit from **128 up to 4096 tokens** directly in **Settings** or the in-chat **Chat Options Sheet**.

---

## 7. Developer API Reference

Developers building custom plugins, tools, or extensions can programmatically sanitize, validate, and store SVG graphics using Chattree's native services:

### Validating & Sanitizing SVG
```dart
import 'package:chattree/features/visual_design/services/svg_sanitizer.dart';

final String rawSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500"><rect width="500" height="500" fill="#1e1e2e"/><text x="50" y="80" fill="#cdd6f4">Hello Chattree</text></svg>';

final SanitizationResult result = SvgSanitizer.sanitize(rawSvg);

if (result.isValid) {
  print('Clean SVG: ${result.cleanSvg}');
} else {
  print('Sanitization rejected: ${result.error}');
}
```

### Extracting from AI Output
```dart
import 'package:chattree/features/visual_design/tools/visual_design_tool.dart';

final SvgExtractionResult extraction = VisualDesignTool.extractSvgDetailed(modelResponse);

if (extraction.isSuccess) {
  final String svgCode = extraction.svg!;
  // Proceed to sanitization or rendering
} else {
  print('Extraction failed: ${extraction.errorMessage}');
}
```

### Atomic File Persistence
```dart
import 'package:chattree/features/visual_design/services/visual_chat_refs.dart';

// Saves SVG cleanly to app storage with path-traversal prevention
final String? svgRef = await VisualChatRefs.saveVisualSvg(
  conversationId: 'conv_123',
  messageId: 'msg_456',
  cleanSvg: sanitizedSvg,
);

// Read back SVG content
final String? storedSvg = await VisualChatRefs.readVisualSvg(svgRef!);
```

### Rendering SVGs in Custom Plugins (Without the `/visual` Command)

Third-party plugins, DevOps tools, and background monitors can render interactive SVG graphics directly in the conversation without requiring the user to type `/visual`:

#### Pattern A: Direct SVG Output (Deterministic)
When your plugin computes or templates the SVG directly (e.g., network topologies, charts, dashboards):
```dart
// 1. Validate and sanitize
final sanitization = SvgSanitizer.sanitize(mySvgString);

// 2. Persist atomically to the active conversation
final svgRef = await VisualChatRefs.saveVisualSvg(
  conversationId: conversationId,
  messageId: messageId,
  cleanSvg: sanitization.cleanSvg!,
);

// 3. Return ToolResult.direct with svgRef (Chattree displays the interactive visual card)
return ToolResult.direct(
  'Cluster status: 12/12 microservices healthy.',
  svgRef: svgRef,
);
```

#### Pattern B: Delegating Design to the Generative LLM
When your plugin retrieves raw data and asks the AI to design the vector composition:
```dart
return ToolResult.needsLlm(
  historyWithSystemData,
  visualPostProcessor: VisualDesignTool.instance.createPostProcessor(
    conversationId: conversationId,
    messageId: messageId,
  ),
);
```


---

## Summary Checklist for Developers Creating Visual Tools

1. **Always use standard viewBox:** Set `viewBox="0 0 500 500"` with `width="100%"` and `height="100%"`.
2. **Never include `<script>` or external links:** Rely exclusively on the whitelisted SVG vector elements.
3. **Assign unique IDs to defs:** Ensure gradients or patterns defined in `<defs>` have unique IDs (e.g., `id="grad1"`) referenced via `fill="url(#grad1)"`.
4. **Close all XML tags:** Ensure self-closing elements (e.g., `<rect ... />`, `<stop ... />`) or explicit closing tags are properly terminated to maintain XML 1.0 validity.
5. **Leverage the 4096-token headroom:** Keep geometry clean and avoid excessively verbose paths to maximize rendering speed and responsiveness.
