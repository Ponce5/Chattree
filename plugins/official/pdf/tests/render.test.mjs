import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wasmBytes = fs.readFileSync(path.join(pluginDir, "plugin.wasm"));

async function generate(title, content) {
  let memory;
  let hostRequest;
  const { instance } = await WebAssembly.instantiate(wasmBytes, {
    chattree: {
      host_call(reqPtr, reqLen) {
        const requestText = new TextDecoder().decode(
          new Uint8Array(memory.buffer, reqPtr, reqLen),
        );
        hostRequest = JSON.parse(requestText);
        return 0;
      },
    },
  });
  memory = instance.exports.memory;

  const input = new TextEncoder().encode(JSON.stringify({ title, content }));
  new Uint8Array(memory.buffer).set(input, 0);
  assert.equal(instance.exports.pdf_entry(0, input.length), 0);
  assert.equal(hostRequest.api, "files");
  assert.equal(hostRequest.operation, "write");
  assert.equal(hostRequest.payload.encoding, "base64");

  const pdf = Buffer.from(hostRequest.payload.content, "base64");
  if (process.env.PDF_TEST_OUTPUT_DIR) {
    fs.mkdirSync(process.env.PDF_TEST_OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.PDF_TEST_OUTPUT_DIR, hostRequest.payload.name), pdf);
  }
  const hostResponse = new TextEncoder().encode(
    JSON.stringify({ success: true, data: { handle: "test-file-handle" } }),
  );
  new Uint8Array(memory.buffer).set(hostResponse, 4096);
  const outputLength = instance.exports.resume(4096, hostResponse.length);
  const toolResult = JSON.parse(
    new TextDecoder().decode(new Uint8Array(memory.buffer, 1024, outputLength)),
  );

  return { pdf, toolResult, fileName: hostRequest.payload.name };
}

function pageCount(pdf) {
  const match = pdf.toString("latin1").match(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/);
  assert.ok(match, `PDF contains a valid page tree: ${pdf.toString("latin1").slice(0, 1800)}`);
  return Number(match[1]);
}

function assertValidXref(pdf) {
  const text = pdf.toString("latin1");
  const xrefOffset = text.lastIndexOf("\nxref\n0 ") + 1;
  const startXref = Number(text.match(/startxref\n(\d+)\n%%EOF\n$/)?.[1]);
  assert.ok(xrefOffset > 0);
  assert.equal(startXref, xrefOffset);
  const xrefText = text.slice(xrefOffset).split("\n");
  const objectCount = Number(xrefText[1].split(" ")[1]);
  for (let id = 1; id < objectCount; id += 1) {
    const offset = Number(xrefText[id + 2].slice(0, 10));
    assert.ok(text.startsWith(`${id} 0 obj\n`, offset), `xref entry ${id} points to its object`);
  }
}

test("short structured Spanish document creates one valid file page", async () => {
  const { pdf, toolResult, fileName } = await generate(
    "Guía de acción (edición rápida)",
    "## Introducción\nLa solución requiere atención y coordinación.\n\n- Revisar el área\n- Registrar resultados\n\n| Área | Acción |\n|---|---|\n| Datos | Verificar resultados |",
  );
  assert.equal(pdf.subarray(0, 8).toString("ascii"), "%PDF-1.4");
  assert.equal(pageCount(pdf), 1);
  assertValidXref(pdf);
  assert.ok(pdf.includes(Buffer.from("coordinaci\xf3n", "latin1")));
  assert.ok(pdf.includes(Buffer.from("Verificar resultados", "latin1")));
  assert.ok(pdf.toString("latin1").endsWith("%%EOF\n"));
  assert.equal(fileName, "guia_de_accion_edicion_rapida.pdf");
  assert.equal(toolResult.type, "direct");
  assert.equal(toolResult.fileHandle, "test-file-handle");
  assert.equal(toolResult.fileName, fileName);
});

test("long content is flowed into as many pages as needed", async () => {
  const longParagraph = "El diseño y la validación deben conservar cada dato importante. ".repeat(150);
  const { pdf } = await generate("Informe extenso", longParagraph);
  assert.ok(pageCount(pdf) >= 3, `expected 3+ pages, got ${pageCount(pdf)}`);
  assertValidXref(pdf);
  assert.ok(pdf.toString("latin1").includes("/Type /Page /Parent 2 0 R"));
  assert.ok(pdf.toString("latin1").includes("/Count "));
  assert.ok(pdf.toString("latin1").endsWith("%%EOF\n"));
});

test("long lists continue onto later pages without dropping their final items", async () => {
  const content = Array.from(
    { length: 120 },
    (_, index) => `- Elemento ${String(index + 1).padStart(3, "0")}: detalle que debe conservarse en el documento`,
  ).join("\n");
  const { pdf } = await generate("Lista de verificación", content);
  assert.ok(pageCount(pdf) >= 3);
  assertValidXref(pdf);
  assert.ok(pdf.toString("latin1").includes("Elemento 120: detalle"));
});

test("page breaks happen at the line boundary without adding a trailing blank page", async () => {
  const onePage = Array.from({ length: 43 }, (_, index) => `Línea ${index + 1}`).join("\n");
  const twoPages = Array.from({ length: 44 }, (_, index) => `Línea ${index + 1}`).join("\n");
  const first = await generate("Límite", onePage);
  const second = await generate("Continuación", twoPages);
  assert.equal(pageCount(first.pdf), 1);
  assert.equal(pageCount(second.pdf), 2);
  assertValidXref(first.pdf);
  assertValidXref(second.pdf);
});

test("Spanish letters and common Unicode punctuation map to WinAnsi", async () => {
  const { pdf } = await generate(
    "Ñandú y acción",
    "El niño revisó el árbol; ‘sí’, “acción”—vale • € …",
  );
  for (const byte of [0xd1, 0xf1, 0xf3, 0x93, 0x94, 0x97, 0x95, 0x80, 0x85]) {
    assert.ok(pdf.includes(Buffer.from([byte])), `PDF is missing WinAnsi byte 0x${byte.toString(16)}; bytes: ${[...new Set(pdf.filter((value) => value >= 128))].map((value) => value.toString(16))}`);
  }
});

test("parentheses and backslashes are escaped inside PDF text strings", async () => {
  const { pdf } = await generate("Notas", "Texto con (paréntesis) y ruta C:\\datos\\revisión.");
  const text = pdf.toString("latin1");
  assert.ok(text.includes("\\(par\xe9ntesis\\)"));
  assert.ok(text.includes("C:\\\\datos\\\\revisi\xf3n"));
});
