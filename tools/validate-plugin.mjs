#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";

const ID_REGEX = /^[a-z0-9][a-z0-9._-]*[a-z0-9]$/;
const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
const COMMAND_REGEX = /^[a-z0-9-]+$/;
const HEX64_REGEX = /^[0-9a-f]{64}$/;

const VALID_CAPABILITIES = new Set([
  "storage.private",
  "share.text",
  "share.file",
  "open.url",
  "open.app",
  "network.http",
  "notifications.send",
  "files.pick",
  "files.read",
  "files.write",
  "calendar.read",
  "calendar.create",
  "calendar.update",
  "calendar.delete",
  "contacts.read",
  "contacts.create",
  "contacts.update",
  "location.current",
  "camera.capture",
  "chattree.notes.read",
  "chattree.notes.search",
  "chattree.notes.create",
  "chattree.notes.update",
  "chattree.notes.delete",
  "chattree.reminders.read",
  "chattree.reminders.create",
  "chattree.reminders.update",
  "chattree.reminders.delete",
  "chattree.reminders.complete",
  "chattree.context.read",
  "chat.history.read",
  "ai.context",
  "ai.embeddings",
]);

function computeSha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function parseZip(buf) {
  const files = {};
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error("Invalid ZIP archive: End of Central Directory signature not found.");
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  let current = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(current) !== 0x02014b50) {
      break;
    }
    const method = buf.readUInt16LE(current + 10);
    const compressedSize = buf.readUInt32LE(current + 20);
    const uncompressedSize = buf.readUInt32LE(current + 24);
    const nameLen = buf.readUInt16LE(current + 28);
    const extraLen = buf.readUInt16LE(current + 30);
    const commentLen = buf.readUInt16LE(current + 32);
    const localHeaderOffset = buf.readUInt32LE(current + 42);

    const filename = buf.toString("utf8", current + 46, current + 46 + nameLen);
    current += 46 + nameLen + extraLen + commentLen;

    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedData = buf.subarray(dataStart, dataStart + compressedSize);

    let decompressed;
    if (method === 0) {
      decompressed = compressedData;
    } else if (method === 8) {
      decompressed = zlib.inflateRawSync(compressedData);
    } else {
      throw new Error(`Unsupported compression method (${method}) for file ${filename}`);
    }
    files[filename] = decompressed;
  }
  return files;
}

export function validatePlugin(targetPath) {
  const errors = [];
  const warnings = [];
  const resolved = path.resolve(targetPath);

  if (!fs.existsSync(resolved)) {
    return { valid: false, errors: [`Target does not exist: ${resolved}`], warnings: [] };
  }

  const stat = fs.statSync(resolved);
  let files = {};
  let isArchive = false;

  if (stat.isFile() && (resolved.endsWith(".chattree-plugin") || resolved.endsWith(".zip"))) {
    isArchive = true;
    try {
      const buf = fs.readFileSync(resolved);
      files = parseZip(buf);
    } catch (e) {
      return { valid: false, errors: [`Corrupted or invalid ZIP archive: ${e.message}`], warnings: [] };
    }
  } else if (stat.isDirectory()) {
    const dirEntries = fs.readdirSync(resolved);
    for (const entry of dirEntries) {
      const full = path.join(resolved, entry);
      if (fs.statSync(full).isFile()) {
        files[entry] = fs.readFileSync(full);
      }
    }
  } else {
    return { valid: false, errors: [`Target must be a directory or .chattree-plugin archive: ${resolved}`], warnings: [] };
  }

  // 1. Check root structure (enforce strict root whitelist for archives)
  const ALLOWED_ROOT_FILES = new Set(["plugin.json", "plugin.wasm", "icon.png", "readme.md", "license"]);
  if (isArchive) {
    for (const name of Object.keys(files)) {
      if (name.includes("/") || name.includes("\\")) {
        errors.push(`File '${name}' is in a subdirectory. All plugin files must be in the archive root.`);
      } else if (!ALLOWED_ROOT_FILES.has(name.toLowerCase())) {
        errors.push(`Disallowed file in package root: '${name}'. Allowed files are: plugin.json, plugin.wasm, icon.png, README.md, LICENSE.`);
      }
    }
  }

  // 2. Check plugin.json
  const manifestBuf = files["plugin.json"];
  if (!manifestBuf) {
    errors.push("Missing required 'plugin.json' manifest file.");
  }

  // 3. Check plugin.wasm
  const wasmBuf = files["plugin.wasm"];
  if (!wasmBuf) {
    errors.push("Missing required 'plugin.wasm' binary file.");
  }

  let manifest;
  if (manifestBuf) {
    try {
      manifest = JSON.parse(manifestBuf.toString("utf8"));
    } catch (e) {
      errors.push(`'plugin.json' is not valid JSON: ${e.message}`);
    }
  }

  if (manifest) {
    if (manifest.schemaVersion !== 1) {
      errors.push(`Invalid schemaVersion (${manifest.schemaVersion}). Must be 1.`);
    }
    if (!manifest.id || !ID_REGEX.test(manifest.id) || !manifest.id.includes(".")) {
      errors.push(`Invalid 'id' ("${manifest.id}"). Must be reverse-domain formatted with lowercase alphanumeric chars, dots, and hyphens.`);
    }
    if (!manifest.version || !SEMVER_REGEX.test(manifest.version)) {
      errors.push(`Invalid 'version' ("${manifest.version}"). Must adhere to SemVer (MAJOR.MINOR.PATCH).`);
    }
    if (!manifest.name || typeof manifest.name !== "string" || manifest.name.trim().length === 0) {
      errors.push("Missing or empty required field 'name'.");
    }
    if (!manifest.description || typeof manifest.description !== "string" || manifest.description.trim().length === 0) {
      errors.push("Missing or empty required field 'description'.");
    }
    if (!manifest.author || typeof manifest.author !== "string" || manifest.author.trim().length === 0) {
      errors.push("Missing or empty required field 'author'.");
    }
    if (!manifest.primaryCommand || !COMMAND_REGEX.test(manifest.primaryCommand)) {
      errors.push(`Invalid 'primaryCommand' ("${manifest.primaryCommand}"). Must contain only lowercase alphanumeric chars and hyphens.`);
    }
    if (manifest.type !== "imported" && manifest.type !== "builtin") {
      errors.push(`Field 'type' must be "imported" for third-party plugins.`);
    }
    if (manifest.runtime !== "wasm") {
      errors.push(`Field 'runtime' must be "wasm".`);
    }
    if (!manifest.entrypoint || typeof manifest.entrypoint !== "string") {
      errors.push("Missing required field 'entrypoint'.");
    }
    if (manifest.wasmPath !== "plugin.wasm") {
      errors.push(`Field 'wasmPath' must be "plugin.wasm".`);
    }
    if (manifest.runtimeApiVersion !== "1.0.0") {
      errors.push(`Field 'runtimeApiVersion' must be "1.0.0".`);
    }
    if (!manifest.wasmSha256 || !HEX64_REGEX.test(manifest.wasmSha256)) {
      errors.push("Field 'wasmSha256' must be a 64-character lowercase hex SHA-256 hash.");
    }

    if (Array.isArray(manifest.capabilities)) {
      for (const cap of manifest.capabilities) {
        if (!VALID_CAPABILITIES.has(cap)) {
          warnings.push(`Declared capability '${cap}' is not recognized in the standard Chattree capabilities catalogue.`);
        }
      }
    }

    if (manifest.timeoutMs && (manifest.timeoutMs <= 0 || manifest.timeoutMs > 60000)) {
      errors.push(`timeoutMs (${manifest.timeoutMs}) exceeds safety threshold (100 - 60000 ms).`);
    }
    if (manifest.maxMemoryPages && (manifest.maxMemoryPages <= 0 || manifest.maxMemoryPages > 256)) {
      errors.push(`maxMemoryPages (${manifest.maxMemoryPages}) exceeds allowed maximum of 256 pages (16 MB).`);
    }

    if (Array.isArray(manifest.tools)) {
      const seenToolCmds = new Set();
      for (let i = 0; i < manifest.tools.length; i++) {
        const t = manifest.tools[i];
        const cmd = t.command ? String(t.command).toLowerCase().trim() : "";
        if (!cmd) {
          errors.push(`Tool #${i + 1} (${t.id || "unnamed"}): 'command' cannot be empty.`);
        } else if (seenToolCmds.has(cmd)) {
          errors.push(`Tool command '/${cmd}' is duplicated within manifest tools.`);
        } else {
          seenToolCmds.add(cmd);
        }
      }
    }
  }

  // 4. Validate WASM binary
  if (wasmBuf) {
    if (
      wasmBuf.length < 4 ||
      wasmBuf[0] !== 0x00 ||
      wasmBuf[1] !== 0x61 ||
      wasmBuf[2] !== 0x73 ||
      wasmBuf[3] !== 0x6d
    ) {
      errors.push("The file 'plugin.wasm' does not have a valid WebAssembly binary header (\\0asm).");
    } else {
      const computedHash = computeSha256(wasmBuf);
      if (manifest?.wasmSha256 && manifest.wasmSha256.toLowerCase() !== computedHash.toLowerCase()) {
        errors.push(
          `WASM SHA-256 mismatch! Manifest declares '${manifest.wasmSha256}', but plugin.wasm has '${computedHash}'.`
        );
      }
    }
  }

  // 5. Validate icon.png if present
  const iconBuf = files["icon.png"];
  if (iconBuf) {
    if (iconBuf.length < 8 || iconBuf[0] !== 0x89 || iconBuf[1] !== 0x50 || iconBuf[2] !== 0x4e || iconBuf[3] !== 0x47) {
      warnings.push("icon.png does not appear to have a valid PNG file signature.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    manifest,
    isArchive,
    fileCount: Object.keys(files).length,
  };
}

function main() {
  const target = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  console.log(`\nChattree Plugin Validator`);
  console.log(`Analyzing: ${target}\n`);

  const result = validatePlugin(target);

  if (result.warnings.length > 0) {
    console.log(`Warnings (${result.warnings.length}):`);
    for (const w of result.warnings) {
      console.log(`  ⚠️  ${w}`);
    }
    console.log();
  }

  if (!result.valid) {
    console.error(`Validation FAILED with ${result.errors.length} error(s):`);
    for (const err of result.errors) {
      console.error(`  ❌ ${err}`);
    }
    console.log();
    process.exit(1);
  }

  console.log(`Plugin successfully validated! All checks passed.`);
  if (result.manifest) {
    console.log(`  ID:           ${result.manifest.id}`);
    console.log(`  Version:      ${result.manifest.version}`);
    console.log(`  Command:      /${result.manifest.primaryCommand}`);
    console.log(`  Capabilities: ${result.manifest.capabilities?.join(", ") || "(none)"}`);
  }
  console.log();
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main();
}
