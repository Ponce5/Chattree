import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../plugins/official/flashcards');
fs.mkdirSync(outDir, { recursive: true });

// Minimal pure-Node PNG encoder (RGBA)
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp(v, lo = 0, hi = 1) { return v < lo ? lo : v > hi ? hi : v; }
function mix(a, b, t) { return a + (b - a) * t; }
function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
function blendOver(dst, sr, sg, sb, sa) {
  const a = clamp(sa);
  dst[0] = dst[0] * (1 - a) + sr * a;
  dst[1] = dst[1] * (1 - a) + sg * a;
  dst[2] = dst[2] * (1 - a) + sb * a;
}

// Signed distance to rounded box centered at (0,0) with half-extents (bx, by) and corner radius r
function sdRoundedBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function rot(x, y, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [x * c - y * s, x * s + y * c];
}

// Iconic minimalist vector mark: two sleek overlapping geometric flashcards + crisp 4-point spark
// Centered at (cx, cy) with scale S (e.g. S = 1.0 for 512px icon)
function sampleLogoMark(x, y, cx, cy, s, col) {
  const lx = (x - cx) / s;
  const ly = (y - cy) / s;

  // Back card: deep electric indigo (#4F46E5 -> #6366F1), tilted -13 deg, offset left-up
  const [bx, by] = rot(lx + 36, ly + 8, -0.22);
  const dBack = sdRoundedBox(bx, by, 92, 126, 26);
  const aBack = 1 - smoothstep(-1.2 / s, 1.2 / s, dBack);
  if (aBack > 0) {
    const t = clamp((by + 126) / 252);
    const r = mix(99, 67, t);
    const g = mix(102, 56, t);
    const b = mix(241, 202, t);
    blendOver(col, r, g, b, aBack);
  }

  // Subtle clean dark separation shadow under front card (sharp, minimalist)
  const [sx, sy] = rot(lx - 22, ly - 8, 0.14);
  const dShad = sdRoundedBox(sx + 8, sy + 10, 96, 130, 28);
  const aShad = (1 - smoothstep(-2 / s, 14 / s, dShad)) * 0.42;
  if (aShad > 0) {
    blendOver(col, 8, 8, 14, aShad);
  }

  // Front card: vibrant violet-to-magenta linear vector gradient (#8B5CF6 -> #EC4899), tilted +8 deg
  const [fx, fy] = rot(lx - 26, ly - 6, 0.14);
  const dFront = sdRoundedBox(fx, fy, 94, 128, 26);
  const aFront = 1 - smoothstep(-1.2 / s, 1.2 / s, dFront);
  if (aFront > 0) {
    const tg = clamp((fx + 94 + fy + 128) / 444);
    const r = mix(139, 236, tg);
    const g = mix(92, 72, tg);
    const b = mix(246, 153, tg);
    blendOver(col, r, g, b, aFront);

    // Crisp pure-white 4-point geometric spark (astroid superellipse) centered on front card
    const sr = 38;
    const ax = Math.abs(fx) / sr;
    const ay = Math.abs(fy) / sr;
    const starVal = Math.pow(ax, 0.56) + Math.pow(ay, 0.56);
    const aStar = 1 - smoothstep(0.96, 1.04, starVal);
    if (aStar > 0) {
      blendOver(col, 255, 255, 255, aStar * aFront);
    }
  }
}

// 1. Generate 512x512 ultra-minimalist vector brand icon (2x2 supersampling)
function generateIcon() {
  const W = 512, H = 512;
  const rgba = Buffer.alloc(W * H * 4);
  const subs = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let rr = 0, gg = 0, bb = 0;
      for (const [ox, oy] of subs) {
        const px = x + ox, py = y + oy;
        // Pure matte obsidian background (#0D0D12) with whisper-soft center lift
        const d = Math.hypot((px - W / 2) / 260, (py - H / 2) / 260);
        const lift = Math.exp(-d * d * 2.2) * 14;
        const col = [13 + lift * 0.7, 13 + lift * 0.4, 18 + lift * 1.4];
        sampleLogoMark(px, py, W * 0.5, H * 0.5, 1.05, col);
        rr += col[0]; gg += col[1]; bb += col[2];
      }
      const idx = (y * W + x) * 4;
      rgba[idx] = Math.round(clamp(rr / 4, 0, 255));
      rgba[idx + 1] = Math.round(clamp(gg / 4, 0, 255));
      rgba[idx + 2] = Math.round(clamp(bb / 4, 0, 255));
      rgba[idx + 3] = 255;
    }
  }
  const out = path.join(outDir, 'icon.png');
  fs.writeFileSync(out, encodePng(W, H, rgba));
  console.log(`[OK] Generated ${out} (${W}x${H})`);
}

// 2. Generate 1200x630 ultra-minimalist editorial tech brand banner (Linear/Apple/Netflix vibe)
function generateBanner() {
  const W = 1200, H = 630;
  const rgba = Buffer.alloc(W * H * 4);
  const subs = [[-0.25, -0.25], [0.25, 0.25]];
  const logoCx = W * 0.5;
  const logoCy = H * 0.46;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let rr = 0, gg = 0, bb = 0;
      for (const [ox, oy] of subs) {
        const px = x + ox, py = y + oy;
        // Deep obsidian canvas (#0A0A0F) with clean ambient violet-indigo halo behind the mark
        const dx = (px - logoCx) / 420;
        const dy = (py - logoCy) / 260;
        const glow = Math.exp(-(dx * dx + dy * dy) * 1.4);
        const col = [
          10 + glow * 32,
          10 + glow * 16,
          15 + glow * 58,
        ];

        // Minimalist whisper-thin horizon hairline across the lower third
        const hy = H * 0.80;
        const dh = Math.abs(py - hy);
        const hx = Math.abs(px - W * 0.5) / (W * 0.32);
        if (dh < 1.5 && hx < 1.0) {
          const lineA = (1 - smoothstep(0.4, 1.4, dh)) * (1 - hx * hx) * 0.45;
          const lt = clamp((px - W * 0.18) / (W * 0.64));
          blendOver(col, mix(99, 236, lt), mix(102, 72, lt), mix(241, 153, lt), lineA);
        }

        // Three tiny minimalist SRS mastery dots (Hard coral, Good violet, Easy emerald) centered below hairline
        const dotY = H * 0.865;
        const dots = [
          [W * 0.5 - 28, 244, 63, 94],   // Hard (#F43F5E)
          [W * 0.5,      139, 92, 246],  // Good (#8B5CF6)
          [W * 0.5 + 28, 16, 185, 129],  // Easy (#10B981)
        ];
        for (const [dotX, dr, dg, db] of dots) {
          const dd = Math.hypot(px - dotX, py - dotY) - 4.5;
          const da = 1 - smoothstep(-0.8, 0.8, dd);
          if (da > 0) blendOver(col, dr, dg, db, da * 0.9);
        }

        // Centered iconic vector brand mark
        sampleLogoMark(px, py, logoCx, logoCy, 1.18, col);

        rr += col[0]; gg += col[1]; bb += col[2];
      }
      const idx = (y * W + x) * 4;
      rgba[idx] = Math.round(clamp(rr / 2, 0, 255));
      rgba[idx + 1] = Math.round(clamp(gg / 2, 0, 255));
      rgba[idx + 2] = Math.round(clamp(bb / 2, 0, 255));
      rgba[idx + 3] = 255;
    }
  }
  const out = path.join(outDir, 'banner.png');
  fs.writeFileSync(out, encodePng(W, H, rgba));
  console.log(`[OK] Generated ${out} (${W}x${H})`);
}

generateIcon();
generateBanner();
