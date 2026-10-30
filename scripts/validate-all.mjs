#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validatePlugin } from "../tools/validate-plugin.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
  "examples/hello",
  "examples/notes-demo",
  "templates/plugin",
  "plugins/official/echo",
  "plugins/official/calendar",
  "plugins/official/mail",
  "plugins/official/pdf",
  "plugins/official/elevenlabs",
  "plugins/official/notion",
];

console.log("Running comprehensive validation on all repository plugins...\n");

let hasErrors = false;
for (const rel of targets) {
  const full = path.join(root, rel);
  console.log(`Checking [${rel}]...`);
  const res = validatePlugin(full);
  if (!res.valid) {
    hasErrors = true;
    console.error(`  ❌ FAILED: ${rel}`);
    for (const err of res.errors) {
      console.error(`     - ${err}`);
    }
  } else {
    console.log(`  ✅ PASSED (${res.manifest?.id} v${res.manifest?.version})`);
  }
}

if (hasErrors) {
  console.error("\nValidation failed across one or more plugins.\n");
  process.exit(1);
} else {
  console.log("\nAll repository plugins and templates are valid and schema-compliant!\n");
}
