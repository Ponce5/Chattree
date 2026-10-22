# Chattree PDF Generator

The PDF plugin asks Chattree AI to write the document, then composes the supplied text inside its WebAssembly module. It flows content across A4 pages based on printable width and remaining vertical space. The renderer does not request page breaks or split the document into fixed-size page fields.

## Document content

The AI returns a title and a Spanish Markdown body. The renderer supports section headings, paragraphs, list lines, and table rows as readable text. Headings receive a separate bold style. Long paragraphs and list items wrap at the text measure; a page transition happens between rendered lines. The PDF uses WinAnsi standard fonts and maps Spanish letters, common punctuation, and currency symbols before writing PDF string literals.

## Chattree integration

- Requires only `files.write`.
- Uses the existing asynchronous `chattree.host_call` protocol.
- Returns the same `ToolResult.direct` file bubble fields: `fileHandle` and `fileName`.
- Does not open the share sheet. The app's file card provides its existing actions.

## Build and verify

From the repository root:

```bash
wat2wasm plugins/official/pdf/plugin.wat -o plugins/official/pdf/plugin.wasm
node --test plugins/official/pdf/tests/render.test.mjs
node tools/validate-plugin.mjs plugins/official/pdf/
node tools/package-plugin.mjs plugins/official/pdf/
```

The renderer integration tests exercise a one-page Spanish document, a longer document that flows across multiple pages, PDF literal escaping, and the file handle response contract.
