import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../plugins/official/briefing');
fs.mkdirSync(outDir, { recursive: true });

function encodePng(width, height, rgba) {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c >>> 0;
  }
  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const tb = Buffer.from(type, 'ascii');
    const cb = Buffer.alloc(4);
    cb.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
    return Buffer.concat([len, tb, data, cb]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp(v, a = 0, b = 1) { return v < a ? a : v > b ? b : v; }
function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay;
  const bax = bx - ax, bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay));
  return Math.hypot(pax - bax * h, pay - bay * h);
}
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r;
  const qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function blend(buf, idx, r, g, b, a) {
  const ia = clamp(a);
  if (ia <= 0) return;
  const inv = 1 - ia;
  buf[idx] = Math.round(r * ia + buf[idx] * inv);
  buf[idx + 1] = Math.round(g * ia + buf[idx + 1] * inv);
  buf[idx + 2] = Math.round(b * ia + buf[idx + 2] * inv);
  buf[idx + 3] = 255;
}

// 1. 512x512 Icon: Minimalist Morning Horizon + Emerald Sun Rays + Briefing Lines
function generateIcon() {
  const W = 512, H = 512;
  const buf = Buffer.alloc(W * H * 4);
  const cx = 256, horizonY = 278;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const dist = Math.hypot(x - cx, y - 240);

      // Deep obsidian background
      const bgT = clamp(dist / 390);
      buf[idx] = Math.round(15 * (1 - bgT) + 9 * bgT);
      buf[idx + 1] = Math.round(23 * (1 - bgT) + 13 * bgT);
      buf[idx + 2] = Math.round(31 * (1 - bgT) + 19 * bgT);
      buf[idx + 3] = 255;

      // Sapphire blue sunrise ambient glow
      const glow = Math.exp(-(dist * dist) / (2 * 165 * 165)) * 0.25;
      blend(buf, idx, 59, 130, 246, glow);

      // Rising half-sun above horizon (electric blue -> sky blue gradient)
      if (y <= horizonY) {
        const sunD = Math.hypot(x - cx, y - horizonY) - 82;
        if (sunD < 2) {
          const a = 1 - smoothstep(-1.2, 1.2, sunD);
          const gT = clamp((horizonY - y) / 82);
          blend(buf, idx, Math.round(37 + 59 * gT), Math.round(99 + 66 * gT), Math.round(235 + 15 * gT), a);
        }
      }

      // 5 clean sun rays above the half-sun
      const rayAngles = [-Math.PI * 0.85, -Math.PI * 0.68, -Math.PI * 0.5, -Math.PI * 0.32, -Math.PI * 0.15];
      for (const ang of rayAngles) {
        const ax = cx + Math.cos(ang) * 112;
        const ay = horizonY + Math.sin(ang) * 112;
        const bx = cx + Math.cos(ang) * 144;
        const by = horizonY + Math.sin(ang) * 144;
        const rd = sdSegment(x, y, ax, ay, bx, by) - 10;
        if (rd < 2) {
          blend(buf, idx, 96, 165, 250, (1 - smoothstep(-1.2, 1.2, rd)) * 0.92);
        }
      }

      // Horizon bar
      const horD = sdRoundRect(x, y, cx, horizonY + 8, 156, 9, 9);
      if (horD < 2) {
        blend(buf, idx, 239, 246, 255, 1 - smoothstep(-1.2, 1.2, horD));
      }

      // 3 crisp briefing summary lines below horizon
      const lines = [
        { y: 332, hw: 126, alpha: 0.85 },
        { y: 368, hw: 98, alpha: 0.6 },
        { y: 404, hw: 70, alpha: 0.38 },
      ];
      for (const ln of lines) {
        const ld = sdRoundRect(x, y, cx, ln.y, ln.hw, 7, 7);
        if (ld < 2) {
          blend(buf, idx, 147, 197, 253, (1 - smoothstep(-1.2, 1.2, ld)) * ln.alpha);
        }
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'icon.png'), encodePng(W, H, buf));
  console.log('[OK] Generated plugins/official/briefing/icon.png (512x512)');
}

// 2. 1200x630 Marketplace Banner
function generateBanner() {
  const W = 1200, H = 630;
  const buf = Buffer.alloc(W * H * 4);

  const tiles = [
    { cx: 655, cy: 215, hw: 130, hh: 78, accent: [59, 130, 246] },   // Weather
    { cx: 940, cy: 215, hw: 130, hh: 78, accent: [96, 165, 250] },   // Calendar
    { cx: 655, cy: 405, hw: 130, hh: 78, accent: [59, 130, 246] },   // Reminders & Daily Note
    { cx: 940, cy: 405, hw: 130, hh: 78, accent: [96, 165, 250] },   // Inbox
  ];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const gx = x / W, gy = y / H;

      buf[idx] = Math.round(10 + 7 * gx);
      buf[idx + 1] = Math.round(14 + 10 * gy);
      buf[idx + 2] = Math.round(22 + 16 * (1 - gx));
      buf[idx + 3] = 255;

      if (x % 40 === 0 || y % 40 === 0) blend(buf, idx, 255, 255, 255, 0.024);

      // Sapphire blue sunrise glow on left
      const dGlow = Math.hypot(x - 275, y - 300);
      blend(buf, idx, 59, 130, 246, Math.exp(-(dGlow * dGlow) / (2 * 215 * 215)) * 0.24);

      // Left sunrise emblem
      const lcx = 275, lhy = 325;
      if (y <= lhy) {
        const sd = Math.hypot(x - lcx, y - lhy) - 78;
        if (sd < 2) {
          const t = clamp((lhy - y) / 78);
          blend(buf, idx, Math.round(37 + 59 * t), Math.round(99 + 66 * t), Math.round(235 + 15 * t), 1 - smoothstep(-1.2, 1.2, sd));
        }
      }
      for (const ang of [-Math.PI * 0.85, -Math.PI * 0.68, -Math.PI * 0.5, -Math.PI * 0.32, -Math.PI * 0.15]) {
        const rd = sdSegment(x, y, lcx + Math.cos(ang) * 106, lhy + Math.sin(ang) * 106, lcx + Math.cos(ang) * 138, lhy + Math.sin(ang) * 138) - 9;
        if (rd < 2) blend(buf, idx, 96, 165, 250, (1 - smoothstep(-1.2, 1.2, rd)) * 0.9);
      }
      const hd = sdRoundRect(x, y, lcx, lhy + 8, 148, 8, 8);
      if (hd < 2) blend(buf, idx, 239, 246, 255, 1 - smoothstep(-1.2, 1.2, hd));
      for (const [dy, hw, al] of [[52, 118, 0.82], [84, 90, 0.55], [116, 62, 0.34]]) {
        const ld = sdRoundRect(x, y, lcx, lhy + dy, hw, 6, 6);
        if (ld < 2) blend(buf, idx, 147, 197, 253, (1 - smoothstep(-1.2, 1.2, ld)) * al);
      }

      // Right 2x2 briefing widget panel
      const panelD = sdRoundRect(x, y, 798, 310, 315, 218, 26);
      if (panelD < 2) {
        const pa = 1 - smoothstep(-1.2, 1.2, panelD);
        blend(buf, idx, 18, 26, 38, pa * 0.92);
        if (panelD > -2) blend(buf, idx, 96, 165, 250, pa * 0.3);
      }

      for (const t of tiles) {
        const td = sdRoundRect(x, y, t.cx, t.cy, t.hw, t.hh, 16);
        if (td < 2) {
          blend(buf, idx, 25, 36, 49, (1 - smoothstep(-1.2, 1.2, td)) * 0.96);
        }
        // Accent pill on top-left of each tile
        const pd = sdRoundRect(x, y, t.cx - 84, t.cy - 44, 24, 9, 9);
        if (pd < 2) blend(buf, idx, t.accent[0], t.accent[1], t.accent[2], 1 - smoothstep(-1.2, 1.2, pd));
        // Two clean content lines inside each tile
        const l1 = sdRoundRect(x, y, t.cx - 12, t.cy + 4, 94, 6, 6);
        if (l1 < 2) blend(buf, idx, 226, 236, 245, (1 - smoothstep(-1.2, 1.2, l1)) * 0.85);
        const l2 = sdRoundRect(x, y, t.cx - 32, t.cy + 32, 74, 5, 5);
        if (l2 < 2) blend(buf, idx, 148, 163, 184, (1 - smoothstep(-1.2, 1.2, l2)) * 0.65);
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'banner.png'), encodePng(W, H, buf));
  console.log('[OK] Generated plugins/official/briefing/banner.png (1200x630)');
}

generateIcon();
generateBanner();
