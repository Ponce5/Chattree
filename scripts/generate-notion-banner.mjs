import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function decodePng(buffer) {
  let offset = 8;
  let width, height;
  const idatParts = [];
  while (offset < buffer.length) {
    const len = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'IHDR') {
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
    } else if (type === 'IDAT') {
      idatParts.push(buffer.subarray(offset + 8, offset + 8 + len));
    }
    offset += 12 + len;
  }
  const decompressed = zlib.inflateSync(Buffer.concat(idatParts));
  const bpp = 4;
  const stride = width * bpp;
  const pixels = Buffer.alloc(width * height * 4);
  let srcOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = decompressed[srcOffset++];
    for (let x = 0; x < stride; x++) {
      let val = decompressed[srcOffset++];
      const a = x >= bpp ? pixels[y * stride + x - bpp] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const c = (x >= bpp && y > 0) ? pixels[(y - 1) * stride + x - bpp] : 0;
      if (filter === 1) val = (val + a) & 0xff;
      else if (filter === 2) val = (val + b) & 0xff;
      else if (filter === 3) val = (val + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
        val = (val + pr) & 0xff;
      }
      pixels[y * stride + x] = val;
    }
  }
  return { width, height, pixels };
}

function encodePng(width, height, rgbaBuffer) {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }
  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
    }
    return (crc ^ (-1)) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const toCrc = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(toCrc), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Filter 0 for each scanline
  const rawScanlines = Buffer.alloc(height * (1 + width * 4));
  let dest = 0;
  let src = 0;
  for (let y = 0; y < height; y++) {
    rawScanlines[dest++] = 0; // Filter: None
    rgbaBuffer.copy(rawScanlines, dest, src, src + width * 4);
    dest += width * 4;
    src += width * 4;
  }

  const idatData = zlib.deflateSync(rawScanlines, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const bannerWidth = 1024;
const bannerHeight = 504;
const banner = Buffer.alloc(bannerWidth * bannerHeight * 4);

// Background: Elegant dark radial-linear gradient reminiscent of Notion's dark mode
for (let y = 0; y < bannerHeight; y++) {
  const normY = y / bannerHeight;
  for (let x = 0; x < bannerWidth; x++) {
    const normX = x / bannerWidth;
    // Radial falloff from center-left
    const dx = normX - 0.35;
    const dy = normY - 0.5;
    const dist = Math.sqrt(dx * dx * 1.5 + dy * dy);

    // Subtle dark gradient from #2a2a2e to #121214
    const r = Math.max(16, Math.min(42, Math.floor(40 - dist * 28)));
    const g = Math.max(16, Math.min(42, Math.floor(40 - dist * 28)));
    const b = Math.max(20, Math.min(46, Math.floor(44 - dist * 26)));

    const idx = (y * bannerWidth + x) * 4;
    banner[idx] = r;
    banner[idx + 1] = g;
    banner[idx + 2] = b;
    banner[idx + 3] = 255;
  }
}

// Draw subtle grid dots
for (let y = 20; y < bannerHeight; y += 32) {
  for (let x = 20; x < bannerWidth; x += 32) {
    const idx = (y * bannerWidth + x) * 4;
    banner[idx] = Math.min(255, banner[idx] + 25);
    banner[idx + 1] = Math.min(255, banner[idx + 1] + 25);
    banner[idx + 2] = Math.min(255, banner[idx + 2] + 30);
  }
}

// Decode Notion icon and scale/composite onto banner
const iconFile = path.resolve(__dirname, '../plugins/official/notion/icon.png');
const icon = decodePng(fs.readFileSync(iconFile));

// Draw icon on left-center: size 260x260, at (120, 122)
const iconTargetSize = 256;
const iconX = 110;
const iconY = 124;

// White rounded card behind Notion icon
const cardPad = 20;
const cardRadius = 36;
const cx1 = iconX - cardPad;
const cy1 = iconY - cardPad;
const cx2 = iconX + iconTargetSize + cardPad;
const cy2 = iconY + iconTargetSize + cardPad;

for (let y = cy1; y < cy2; y++) {
  for (let x = cx1; x < cx2; x++) {
    if (x >= 0 && x < bannerWidth && y >= 0 && y < bannerHeight) {
      // Check rounded corners
      let inside = true;
      const rx = x < cx1 + cardRadius ? cx1 + cardRadius - x : (x > cx2 - cardRadius ? x - (cx2 - cardRadius) : 0);
      const ry = y < cy1 + cardRadius ? cy1 + cardRadius - y : (y > cy2 - cardRadius ? y - (cy2 - cardRadius) : 0);
      if (rx * rx + ry * ry > cardRadius * cardRadius) {
        inside = false;
      }
      if (inside) {
        const bIdx = (y * bannerWidth + x) * 4;
        banner[bIdx] = 255;
        banner[bIdx + 1] = 255;
        banner[bIdx + 2] = 255;
        banner[bIdx + 3] = 255;
      }
    }
  }
}

// Bilinear scale icon into (iconX, iconY, iconTargetSize, iconTargetSize)
for (let ty = 0; ty < iconTargetSize; ty++) {
  const sy = (ty / iconTargetSize) * icon.height;
  const iy = Math.min(icon.height - 1, Math.floor(sy));
  for (let tx = 0; tx < iconTargetSize; tx++) {
    const sx = (tx / iconTargetSize) * icon.width;
    const ix = Math.min(icon.width - 1, Math.floor(sx));

    const sIdx = (iy * icon.width + ix) * 4;
    const sa = icon.pixels[sIdx + 3] / 255;
    if (sa > 0) {
      const bx = iconX + tx;
      const by = iconY + ty;
      if (bx >= 0 && bx < bannerWidth && by >= 0 && by < bannerHeight) {
        const bIdx = (by * bannerWidth + bx) * 4;
        banner[bIdx] = Math.round(icon.pixels[sIdx] * sa + banner[bIdx] * (1 - sa));
        banner[bIdx + 1] = Math.round(icon.pixels[sIdx + 1] * sa + banner[bIdx + 1] * (1 - sa));
        banner[bIdx + 2] = Math.round(icon.pixels[sIdx + 2] * sa + banner[bIdx + 2] * (1 - sa));
      }
    }
  }
}

// Save output
const outPath = path.resolve(__dirname, '../plugins/official/notion/banner.png');
const pngData = encodePng(bannerWidth, bannerHeight, banner);
fs.writeFileSync(outPath, pngData);
console.log('✅ Generated banner.png successfully:', outPath, 'Bytes:', pngData.length);
