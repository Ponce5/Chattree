import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../plugins/official/habits');
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

// ── 1. Generate 512x512 Icon ─────────────────────────────────────────────
function generateIcon() {
  const W = 512, H = 512;
  const buf = Buffer.alloc(W * H * 4);
  const cx = 256, cy = 256;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.hypot(dx, dy);

      // Deep obsidian radial background
      const bgT = clamp(dist / 380);
      buf[idx] = Math.round(16 * (1 - bgT) + 9 * bgT);
      buf[idx + 1] = Math.round(24 * (1 - bgT) + 13 * bgT);
      buf[idx + 2] = Math.round(32 * (1 - bgT) + 19 * bgT);
      buf[idx + 3] = 255;

      // Subtle emerald ambient glow
      const glow = Math.exp(-(dist * dist) / (2 * 165 * 165)) * 0.22;
      blend(buf, idx, 16, 185, 129, glow);

      // Outer subtle track ring (r = 152, thickness = 24)
      const ringD = Math.abs(dist - 152) - 13;
      if (ringD < 2) {
        const a = 1 - smoothstep(-1.2, 1.2, ringD);
        blend(buf, idx, 36, 48, 62, a * 0.9);
      }

      // Active emerald progress arc (~78% around, starting from top -90 deg)
      let ang = Math.atan2(dy, dx) + Math.PI / 2;
      if (ang < 0) ang += Math.PI * 2;
      const arcMax = Math.PI * 2 * 0.78;
      if (ang <= arcMax && ringD < 8) {
        const a = 1 - smoothstep(-1.2, 1.2, ringD);
        const grad = ang / arcMax;
        const r = Math.round(16 + 36 * grad);
        const g = Math.round(185 + 45 * grad);
        const b = Math.round(129 + 30 * grad);
        blend(buf, idx, r, g, b, a);
      }
      // Rounded end caps for the arc
      for (const capAng of [-Math.PI / 2, -Math.PI / 2 + arcMax]) {
        const capX = cx + Math.cos(capAng) * 152;
        const capY = cy + Math.sin(capAng) * 152;
        const capD = Math.hypot(x - capX, y - capY) - 13;
        if (capD < 2) {
          const a = 1 - smoothstep(-1.2, 1.2, capD);
          const isEnd = capAng !== -Math.PI / 2;
          blend(buf, idx, isEnd ? 52 : 16, isEnd ? 230 : 185, isEnd ? 159 : 129, a);
        }
      }

      // Crisp inner check mark
      const d1 = sdSegment(x, y, 196, 260, 238, 304);
      const d2 = sdSegment(x, y, 238, 304, 322, 212);
      const chkD = Math.min(d1, d2) - 15;
      if (chkD < 2) {
        const a = 1 - smoothstep(-1.2, 1.2, chkD);
        blend(buf, idx, 240, 253, 244, a);
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'icon.png'), encodePng(W, H, buf));
  console.log('[OK] Generated plugins/official/habits/icon.png (512x512)');
}

// ── 2. Generate 1200x630 Marketplace Banner ──────────────────────────────
function generateBanner() {
  const W = 1200, H = 630;
  const buf = Buffer.alloc(W * H * 4);

  const cards = [
    { cx: 790, cy: 195, w: 300, h: 48, fill: 1.0, done: true },
    { cx: 790, cy: 315, w: 300, h: 48, fill: 0.78, done: true },
    { cx: 790, cy: 435, w: 300, h: 48, fill: 0.45, done: false },
  ];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const gx = x / W, gy = y / H;

      // Dark obsidian gradient
      buf[idx] = Math.round(10 + 7 * gx);
      buf[idx + 1] = Math.round(14 + 10 * gy);
      buf[idx + 2] = Math.round(20 + 14 * (1 - gx));
      buf[idx + 3] = 255;

      // Subtle architectural dot grid
      if (x % 40 === 0 || y % 40 === 0) {
        blend(buf, idx, 255, 255, 255, 0.025);
      }

      // Soft emerald radial glows
      const dGlow1 = Math.hypot(x - 310, y - 315);
      blend(buf, idx, 16, 185, 129, Math.exp(-(dGlow1 * dGlow1) / (2 * 220 * 220)) * 0.2);
      const dGlow2 = Math.hypot(x - 860, y - 260);
      blend(buf, idx, 52, 211, 153, Math.exp(-(dGlow2 * dGlow2) / (2 * 260 * 260)) * 0.1);

      // Left emblem: large progress ring + check mark
      const lcx = 310, lcy = 315;
      const ld = Math.hypot(x - lcx, y - lcy);
      const lRingD = Math.abs(ld - 145) - 14;
      if (lRingD < 2) {
        const a = 1 - smoothstep(-1.2, 1.2, lRingD);
        blend(buf, idx, 35, 47, 62, a * 0.9);
      }
      let lang = Math.atan2(y - lcy, x - lcx) + Math.PI / 2;
      if (lang < 0) lang += Math.PI * 2;
      const lArc = Math.PI * 2 * 0.82;
      if (lang <= lArc && lRingD < 2) {
        const a = 1 - smoothstep(-1.2, 1.2, lRingD);
        const t = lang / lArc;
        blend(buf, idx, Math.round(16 + 36 * t), Math.round(185 + 45 * t), Math.round(129 + 30 * t), a);
      }
      for (const capA of [-Math.PI / 2, -Math.PI / 2 + lArc]) {
        const capD = Math.hypot(x - (lcx + Math.cos(capA) * 145), y - (lcy + Math.sin(capA) * 145)) - 14;
        if (capD < 2) {
          const isEnd = capA !== -Math.PI / 2;
          blend(buf, idx, isEnd ? 52 : 16, isEnd ? 230 : 185, isEnd ? 159 : 129, 1 - smoothstep(-1.2, 1.2, capD));
        }
      }
      const cd1 = sdSegment(x, y, lcx - 56, lcy + 4, lcx - 16, lcy + 46);
      const cd2 = sdSegment(x, y, lcx - 16, lcy + 46, lcx + 62, lcy - 42);
      const chkD = Math.min(cd1, cd2) - 14;
      if (chkD < 2) {
        blend(buf, idx, 240, 253, 244, 1 - smoothstep(-1.2, 1.2, chkD));
      }

      // Right dashboard card container
      const panelD = sdRoundRect(x, y, 790, 315, 290, 225, 26);
      if (panelD < 2) {
        const pa = 1 - smoothstep(-1.2, 1.2, panelD);
        blend(buf, idx, 19, 27, 38, pa * 0.92);
        if (panelD > -2) {
          blend(buf, idx, 52, 211, 153, pa * 0.28);
        }
      }

      // 3 sleek habit rows inside the right dashboard card
      for (const c of cards) {
        const rowD = sdRoundRect(x, y, c.cx, c.cy, 245, 42, 14);
        if (rowD < 2) {
          blend(buf, idx, 26, 36, 50, (1 - smoothstep(-1.2, 1.2, rowD)) * 0.95);
        }
        // Check circle on left of row
        const ccx = c.cx - 205, ccy = c.cy;
        const ccd = Math.hypot(x - ccx, y - ccy) - 16;
        if (ccd < 2) {
          const ca = 1 - smoothstep(-1.2, 1.2, ccd);
          if (c.done) blend(buf, idx, 16, 185, 129, ca);
          else blend(buf, idx, 55, 70, 90, ca);
        }
        if (c.done) {
          const rc1 = sdSegment(x, y, ccx - 6, ccy + 1, ccx - 1, ccy + 6);
          const rc2 = sdSegment(x, y, ccx - 1, ccy + 6, ccx + 7, ccy - 5);
          const rcd = Math.min(rc1, rc2) - 2.3;
          if (rcd < 1.5) blend(buf, idx, 240, 253, 244, 1 - smoothstep(-0.8, 0.8, rcd));
        }

        // Progress bar track
        const barLeft = c.cx - 160, barW = 360, barY = c.cy + 10;
        const trD = sdRoundRect(x, y, barLeft + barW / 2, barY, barW / 2, 6, 6);
        if (trD < 2) blend(buf, idx, 40, 54, 72, 1 - smoothstep(-1, 1, trD));

        // Progress bar fill
        const fw = barW * c.fill;
        const flD = sdRoundRect(x, y, barLeft + fw / 2, barY, fw / 2, 6, 6);
        if (flD < 2) {
          const a = 1 - smoothstep(-1, 1, flD);
          if (c.done) blend(buf, idx, 16, 185, 129, a);
          else blend(buf, idx, 59, 130, 246, a);
        }

        // Title bar placeholder pill
        const tlW = c.done ? 180 : 145;
        const tlD = sdRoundRect(x, y, barLeft + tlW / 2, c.cy - 14, tlW / 2, 5, 5);
        if (tlD < 2) blend(buf, idx, 215, 226, 238, (1 - smoothstep(-1, 1, tlD)) * 0.85);

        // 7-day streak dots on top-right of row
        for (let d = 0; d < 7; d++) {
          const dotX = c.cx + 95 + d * 19;
          const dotY = c.cy - 14;
          const dotD = Math.hypot(x - dotX, y - dotY) - 5;
          if (dotD < 1.5) {
            const lit = c.done ? (d < 6 || c.fill === 1.0) : (d < 3);
            const a = 1 - smoothstep(-0.8, 0.8, dotD);
            if (lit) blend(buf, idx, 16, 185, 129, a);
            else blend(buf, idx, 55, 70, 90, a * 0.8);
          }
        }
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'banner.png'), encodePng(W, H, buf));
  console.log('[OK] Generated plugins/official/habits/banner.png (1200x630)');
}

generateIcon();
generateBanner();
