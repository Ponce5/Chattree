#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";

/**
 * Minimal zero-dependency ZIP encoder for creating .chattree-plugin archives.
 * Guarantees all files reside at root level without subdirectories.
 */
function createZipBuffer(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  // CRC-32 table
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }
  function computeCrc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ (-1)) >>> 0;
  }

  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, "utf8");
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = computeCrc32(data);
    const uncompressedSize = data.length;
    const compressedSize = compressed.length;

    // Local file header (30 bytes + name)
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0); // Local header signature
    local.writeUInt16LE(20, 4);          // Version needed
    local.writeUInt16LE(0, 6);           // Flags
    local.writeUInt16LE(8, 8);           // Compression: Deflate
    local.writeUInt16LE(0, 10);          // Mod time
    local.writeUInt16LE(0, 12);          // Mod date
    local.writeUInt32LE(crc, 14);        // CRC-32
    local.writeUInt32LE(compressedSize, 18); // Compressed size
    local.writeUInt32LE(uncompressedSize, 22); // Uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);          // Extra field length
    nameBuf.copy(local, 30);

    const localChunk = Buffer.concat([local, compressed]);
    localHeaders.push(localChunk);

    // Central directory header (46 bytes + name)
    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0); // Central header signature
    central.writeUInt16LE(20, 4);         // Version made by
    central.writeUInt16LE(20, 6);         // Version needed
    central.writeUInt16LE(0, 8);          // Flags
    central.writeUInt16LE(8, 10);         // Compression: Deflate
    central.writeUInt16LE(0, 12);         // Mod time
    central.writeUInt16LE(0, 14);         // Mod date
    central.writeUInt32LE(crc, 16);       // CRC-32
    central.writeUInt32LE(compressedSize, 20);
    central.writeUInt32LE(uncompressedSize, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);         // Extra length
    central.writeUInt16LE(0, 32);         // Comment length
    central.writeUInt16LE(0, 34);         // Disk number start
    central.writeUInt16LE(0, 36);         // Internal attributes
    central.writeUInt32LE(0, 38);         // External attributes
    central.writeUInt32LE(offset, 42);    // Local header offset
    nameBuf.copy(central, 46);

    centralHeaders.push(central);
    offset += localChunk.length;
  }

  const centralDirOffset = offset;
  const centralDirBuffer = Buffer.concat(centralHeaders);
  const centralDirSize = centralDirBuffer.length;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);   // EOCD signature
  eocd.writeUInt16LE(0, 4);            // Disk number
  eocd.writeUInt16LE(0, 6);            // Disk with central dir
  eocd.writeUInt16LE(files.length, 8); // Entries on this disk
  eocd.writeUInt16LE(files.length, 10);// Total entries
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);           // Comment length

  return Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
}

function computeSha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function main() {
  const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  console.log(`\nChattree Plugin Packager`);
  console.log(`Packaging directory: ${targetDir}`);

  const manifestPath = path.join(targetDir, "plugin.json");
  const wasmPath = path.join(targetDir, "plugin.wasm");

  if (!fs.existsSync(manifestPath)) {
    console.error(`Error: Missing required manifest 'plugin.json' in ${targetDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(wasmPath)) {
    console.error(`Error: Missing required binary 'plugin.wasm' in ${targetDir}`);
    process.exit(1);
  }

  const wasmBytes = fs.readFileSync(wasmPath);
  const realWasmSha256 = computeSha256(wasmBytes);

  let manifestText = fs.readFileSync(manifestPath, "utf8");
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (err) {
    console.error(`Error: Failed to parse plugin.json: ${err.message}`);
    process.exit(1);
  }

  if (manifest.wasmSha256 !== realWasmSha256) {
    console.log(`Notice: Updating wasmSha256 in plugin.json to match compiled binary:`);
    console.log(`   Old: ${manifest.wasmSha256}`);
    console.log(`   New: ${realWasmSha256}`);
    manifest.wasmSha256 = realWasmSha256;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    manifestText = fs.readFileSync(manifestPath, "utf8");
  }

  const filesToBundle = [
    { name: "plugin.json", data: Buffer.from(manifestText, "utf8") },
    { name: "plugin.wasm", data: wasmBytes },
  ];

  const iconPath = path.join(targetDir, "icon.png");
  if (fs.existsSync(iconPath)) {
    filesToBundle.push({ name: "icon.png", data: fs.readFileSync(iconPath) });
    console.log(`Attached icon.png (${fs.statSync(iconPath).size} bytes)`);
  }

  const readmePath = path.join(targetDir, "README.md");
  if (fs.existsSync(readmePath)) {
    filesToBundle.push({ name: "README.md", data: fs.readFileSync(readmePath) });
  }

  const licensePath = path.join(targetDir, "LICENSE");
  if (fs.existsSync(licensePath)) {
    filesToBundle.push({ name: "LICENSE", data: fs.readFileSync(licensePath) });
  }

  const zipBuffer = createZipBuffer(filesToBundle);
  const pkgSha256 = computeSha256(zipBuffer);

  const baseName = manifest.id ? `${manifest.id}-v${manifest.version || "1.0.0"}` : path.basename(targetDir);
  const outFileName = `${baseName}.chattree-plugin`;
  const outPath = path.join(targetDir, outFileName);

  fs.writeFileSync(outPath, zipBuffer);

  console.log(`\nPackage successfully built!`);
  console.log(`File:           ${outPath}`);
  console.log(`Size:           ${zipBuffer.length} bytes`);
  console.log(`Package SHA256: ${pkgSha256}`);
  console.log(`WASM SHA256:    ${realWasmSha256}`);
  console.log(`Entries:        ${filesToBundle.map((f) => f.name).join(", ")}\n`);
}

main();
