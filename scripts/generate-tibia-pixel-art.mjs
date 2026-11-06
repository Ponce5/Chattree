import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDir = path.resolve(__dirname, '../plugins/official/rpg');

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
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawScanlines = Buffer.alloc(height * (1 + width * 4));
  let dest = 0;
  let src = 0;
  for (let y = 0; y < height; y++) {
    rawScanlines[dest++] = 0;
    rgbaBuffer.copy(rawScanlines, dest, src, src + width * 4);
    dest += width * 4;
    src += width * 4;
  }

  const compressed = zlib.deflateSync(rawScanlines, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// ============================================================================
// PIXEL FONT DEFINITION (5x7 classic arcade / retro RPG font)
// ============================================================================

const FONT = {
  'A': [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  'B': [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  'C': [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  'D': [0x1c, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1c],
  'E': [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  'F': [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  'G': [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  'H': [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  'I': [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  'J': [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  'M': [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  'N': [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  'O': [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  'P': [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  'Q': [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  'R': [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  'S': [0x0e, 0x11, 0x10, 0x0e, 0x01, 0x11, 0x0e],
  'T': [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  'X': [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  'Y': [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  'Z': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ':': [0x00, 0x04, 0x04, 0x00, 0x04, 0x04, 0x00],
  '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  '•': [0x00, 0x04, 0x0e, 0x0e, 0x04, 0x00, 0x00],
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
};

function drawPixelText(canvas, text, startX, startY, color, scale = 1, shadowColor = null) {
  let curX = startX;
  const upper = text.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i];
    const glyph = FONT[ch] || FONT[' '];
    for (let row = 0; row < 7; row++) {
      const bits = glyph[row];
      for (let col = 0; col < 5; col++) {
        if ((bits >> (4 - col)) & 1) {
          // Shadow
          if (shadowColor) {
            for (let sy = 0; sy < scale; sy++) {
              for (let sx = 0; sx < scale; sx++) {
                canvas.setPixel(curX + col * scale + sx + scale, startY + row * scale + sy + scale, shadowColor);
              }
            }
          }
          // Pixel glyph
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              canvas.setPixel(curX + col * scale + sx, startY + row * scale + sy, color);
            }
          }
        }
      }
    }
    curX += 6 * scale;
  }
}

class PixelCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.buf = Buffer.alloc(width * height * 4);
  }

  setPixel(x, y, [r, g, b, a = 255]) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    this.buf[idx] = r;
    this.buf[idx + 1] = g;
    this.buf[idx + 2] = b;
    this.buf[idx + 3] = a;
  }

  fillRect(x, y, w, h, color) {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        this.setPixel(px, py, color);
      }
    }
  }

  scaleUp(targetWidth, targetHeight) {
    const out = Buffer.alloc(targetWidth * targetHeight * 4);
    const scaleX = targetWidth / this.width;
    const scaleY = targetHeight / this.height;
    for (let ty = 0; ty < targetHeight; ty++) {
      const sy = Math.floor(ty / scaleY);
      for (let tx = 0; tx < targetWidth; tx++) {
        const sx = Math.floor(tx / scaleX);
        const sIdx = (sy * this.width + sx) * 4;
        const tIdx = (ty * targetWidth + tx) * 4;
        out[tIdx] = this.buf[sIdx];
        out[tIdx + 1] = this.buf[sIdx + 1];
        out[tIdx + 2] = this.buf[sIdx + 2];
        out[tIdx + 3] = this.buf[sIdx + 3];
      }
    }
    return out;
  }
}

// ============================================================================
// 1. TIBIA-STYLE PIXEL ART ICON (64x64 scaled x8 to 512x512)
// A classic Tibia Crusader/Demon Helmet with fiery red rubies & gold horns
// ============================================================================

console.log('Rendering Tibia-style Pixel Art Icon (64x64 -> 512x512)...');
const iconCanvas = new PixelCanvas(64, 64);

// Palette Tibia:
const T_BG_DARK = [14, 13, 20];       // Deep stone dark
const T_BG_BRICK1 = [24, 22, 32];
const T_BG_BRICK2 = [32, 28, 42];
const T_OUTLINE = [8, 8, 12];         // Authentic Tibia 1-px black contour
const T_IRON_LIGHT = [200, 210, 225];
const T_IRON_MID = [130, 145, 165];
const T_IRON_DARK = [70, 80, 98];
const T_GOLD_BRIGHT = [255, 220, 60];
const T_GOLD_MID = [215, 165, 30];
const T_GOLD_DARK = [120, 85, 15];
const T_RUBY_LIGHT = [255, 90, 100];
const T_RUBY_MID = [210, 30, 45];
const T_RUBY_DARK = [110, 10, 20];
const T_EYE_GLOW = [40, 240, 255];   // Soul/Mana blue eye glow in dark visor

// Background: Dungeon Stone Floor Tile (Tibia style)
for (let y = 0; y < 64; y++) {
  for (let x = 0; x < 64; x++) {
    const isBorder = (x % 16 === 0) || (y % 16 === 0);
    const noise = ((x * 13 + y * 27) % 7) > 3;
    if (isBorder) {
      iconCanvas.setPixel(x, y, T_BG_DARK);
    } else {
      iconCanvas.setPixel(x, y, noise ? T_BG_BRICK2 : T_BG_BRICK1);
    }
  }
}

// Isometric Pedestal in center
for (let y = 46; y < 58; y++) {
  for (let x = 14; x < 50; x++) {
    const edge = (y === 46 || y === 57 || x === 14 || x === 49);
    iconCanvas.setPixel(x, y, edge ? T_OUTLINE : [55, 50, 65]);
  }
}

// Draw Pixel Art Tibia Demon/Crusader Helmet (Center x: 32, y: 16 to 46)
// 1. Golden Horns / Wings
const horns = [
  // Left Horn
  [20, 18], [19, 17], [18, 15], [17, 13], [16, 11], [15, 8], [16, 7], [18, 8], [19, 10], [20, 13], [21, 16],
  // Right Horn
  [43, 18], [44, 17], [45, 15], [46, 13], [47, 11], [48, 8], [47, 7], [45, 8], [44, 10], [43, 13], [42, 16]
];
for (const [hx, hy] of horns) {
  iconCanvas.setPixel(hx - 1, hy, T_OUTLINE);
  iconCanvas.setPixel(hx + 1, hy, T_OUTLINE);
  iconCanvas.setPixel(hx, hy - 1, T_OUTLINE);
  iconCanvas.setPixel(hx, hy + 1, T_OUTLINE);
  iconCanvas.setPixel(hx, hy, T_GOLD_BRIGHT);
}

// 2. Helmet Dome (x: 21 to 42, y: 16 to 36)
for (let y = 16; y <= 45; y++) {
  const dy = y - 28;
  const halfW = Math.floor(Math.sqrt(Math.max(0, 144 - dy * dy * 0.75)));
  for (let x = 32 - halfW; x <= 32 + halfW; x++) {
    // 1-px Black Contour
    if (x === 32 - halfW || x === 32 + halfW || y === 16 || y === 45) {
      iconCanvas.setPixel(x, y, T_OUTLINE);
    } else {
      // Metallic Shading (light coming from top-left)
      if (x < 30 && y < 27) {
        iconCanvas.setPixel(x, y, T_IRON_LIGHT);
      } else if (x > 36 || y > 38) {
        iconCanvas.setPixel(x, y, T_IRON_DARK);
      } else {
        iconCanvas.setPixel(x, y, T_IRON_MID);
      }
    }
  }
}

// 3. Central Golden Crest / Ridge (x: 31..33, y: 15..32)
for (let y = 15; y <= 32; y++) {
  iconCanvas.setPixel(30, y, T_OUTLINE);
  iconCanvas.setPixel(31, y, T_GOLD_BRIGHT);
  iconCanvas.setPixel(32, y, T_GOLD_MID);
  iconCanvas.setPixel(33, y, T_GOLD_DARK);
  iconCanvas.setPixel(34, y, T_OUTLINE);
}

// 4. Large Glowing Ruby Gem in forehead
for (let ry = 22; ry <= 26; ry++) {
  for (let rx = 30; rx <= 34; rx++) {
    const isEdge = (rx === 30 || rx === 34 || ry === 22 || ry === 26);
    if (isEdge) {
      iconCanvas.setPixel(rx, ry, T_OUTLINE);
    } else if (rx === 31 && ry === 23) {
      iconCanvas.setPixel(rx, ry, T_RUBY_LIGHT);
    } else {
      iconCanvas.setPixel(rx, ry, T_RUBY_MID);
    }
  }
}

// 5. Visor Slits & Menacing Soul Glow (y: 33..36)
// Dark T-slit visor
for (let vy = 33; vy <= 36; vy++) {
  iconCanvas.setPixel(25, vy, T_OUTLINE);
  iconCanvas.setPixel(26, vy, T_EYE_GLOW);
  iconCanvas.setPixel(27, vy, T_EYE_GLOW);
  iconCanvas.setPixel(28, vy, T_OUTLINE);

  iconCanvas.setPixel(35, vy, T_OUTLINE);
  iconCanvas.setPixel(36, vy, T_EYE_GLOW);
  iconCanvas.setPixel(37, vy, T_EYE_GLOW);
  iconCanvas.setPixel(38, vy, T_OUTLINE);
}

// 6. Medieval Crossed Blades Behind Helmet (Pixel Art)
// Left-to-right sword
for (let i = 0; i < 28; i++) {
  const sx = 10 + i;
  const sy = 12 + i;
  if (iconCanvas.buf[(sy * 64 + sx) * 4 + 3] === 255 && (sx < 22 || sx > 42)) {
    iconCanvas.setPixel(sx, sy, T_IRON_LIGHT);
    iconCanvas.setPixel(sx + 1, sy, T_OUTLINE);
    iconCanvas.setPixel(sx - 1, sy, T_OUTLINE);
  }
}
// Right-to-left sword
for (let i = 0; i < 28; i++) {
  const sx = 53 - i;
  const sy = 12 + i;
  if (iconCanvas.buf[(sy * 64 + sx) * 4 + 3] === 255 && (sx < 22 || sx > 42)) {
    iconCanvas.setPixel(sx, sy, T_IRON_LIGHT);
    iconCanvas.setPixel(sx + 1, sy, T_OUTLINE);
    iconCanvas.setPixel(sx - 1, sy, T_OUTLINE);
  }
}

// Scale icon to 512x512 with nearest-neighbor crisp pixel scaling
const finalIconBuf = iconCanvas.scaleUp(512, 512);
fs.writeFileSync(path.join(pluginDir, 'icon.png'), encodePng(512, 512, finalIconBuf));
console.log('Saved Tibia-style icon.png (512x512)');

// ============================================================================
// 2. TIBIA-STYLE PIXEL ART BANNER (300x157.5 scaled x4 to 1200x630)
// Complete Dungeon Scene with Braziers, Chest, Pixel Text in English
// ============================================================================

console.log('Rendering Tibia-style Pixel Art Banner (300x158 -> 1200x632)...');
const bWidth = 300;
const bHeight = 158;
const bCanvas = new PixelCanvas(bWidth, bHeight);

// Dungeon Wall Background (Dark stone blocks with mortar lines)
for (let y = 0; y < bHeight; y++) {
  for (let x = 0; x < bWidth; x++) {
    const isFloor = y > 115;
    if (isFloor) {
      // Dungeon Stone Slabs (Isometric lines)
      const floorTile = (Math.floor(x / 20) + Math.floor(y / 12)) % 2 === 0;
      bCanvas.setPixel(x, y, floorTile ? [38, 35, 48] : [28, 25, 36]);
      if (y % 12 === 0 || x % 20 === 0) bCanvas.setPixel(x, y, [16, 14, 22]);
    } else {
      // Ancient Dungeon Wall with moss and dark blocks
      const blockRow = Math.floor(y / 16);
      const shift = (blockRow % 2) * 16;
      const isMortar = (y % 16 === 0) || ((x + shift) % 32 === 0);
      const torchGlowLeft = Math.max(0, 1 - Math.hypot(x - 45, y - 55) / 55);
      const torchGlowRight = Math.max(0, 1 - Math.hypot(x - 255, y - 55) / 55);
      const glow = Math.max(torchGlowLeft, torchGlowRight);

      if (isMortar) {
        bCanvas.setPixel(x, y, [12, 10, 16]);
      } else {
        const base = 25 + ((x * 7 + y * 13) % 8);
        const r = Math.min(255, Math.floor(base + 80 * glow));
        const g = Math.min(255, Math.floor(base + 40 * glow));
        const b = Math.min(255, Math.floor(base + 10 * glow));
        bCanvas.setPixel(x, y, [r, g, b]);
      }
    }
  }
}

// Draw Wall Braziers with Pixel Flames at x: 45 and x: 255
function drawBrazier(bx, by) {
  // Sconce Bracket
  bCanvas.fillRect(bx - 3, by, 7, 10, [15, 15, 20]);
  bCanvas.fillRect(bx - 5, by - 2, 11, 4, [160, 130, 40]);
  // Pixel Fire
  const firePixels = [
    [0, -4, [255, 240, 120]], [1, -5, [255, 200, 60]], [-1, -5, [255, 170, 40]],
    [0, -6, [255, 100, 20]], [2, -6, [255, 70, 20]], [-2, -6, [255, 60, 20]],
    [0, -8, [255, 240, 100]], [1, -9, [255, 120, 30]], [-1, -8, [230, 40, 20]],
    [0, -11, [255, 220, 50]]
  ];
  for (const [fx, fy, col] of firePixels) {
    bCanvas.setPixel(bx + fx, by + fy, col);
    bCanvas.setPixel(bx + fx + 1, by + fy, col);
  }
}
drawBrazier(45, 65);
drawBrazier(255, 65);

// Pixel Art Treasure Chest on floor (x: 235, y: 122)
bCanvas.fillRect(235, 124, 28, 18, T_OUTLINE);
bCanvas.fillRect(236, 125, 26, 16, [130, 80, 35]); // Wood
bCanvas.fillRect(235, 128, 28, 3, [230, 180, 40]);   // Gold Band
bCanvas.fillRect(247, 129, 4, 6, [255, 220, 60]);    // Keyhole

// Potions on floor (x: 55, y: 130)
// Red Health Potion
bCanvas.fillRect(52, 132, 6, 9, T_OUTLINE);
bCanvas.fillRect(53, 133, 4, 7, [230, 30, 40]);
bCanvas.setPixel(54, 131, [160, 110, 60]); // Cork
// Blue Mana Potion
bCanvas.fillRect(62, 133, 6, 8, T_OUTLINE);
bCanvas.fillRect(63, 134, 4, 6, [30, 150, 240]);
bCanvas.setPixel(64, 132, [160, 110, 60]); // Cork

// Draw Hero Sprite silhouette in center-left (x: 88, y: 92)
bCanvas.fillRect(86, 95, 14, 26, T_OUTLINE);
bCanvas.fillRect(87, 96, 12, 12, T_IRON_MID); // Helmet
bCanvas.fillRect(89, 100, 8, 2, [40, 230, 255]); // Visor Glow
bCanvas.fillRect(87, 108, 12, 13, [160, 40, 50]); // Crimson Cape
// Sword in Hand
for (let k = 0; k < 18; k++) {
  bCanvas.setPixel(101 + k, 110 - k, T_IRON_LIGHT);
  bCanvas.setPixel(101 + k, 111 - k, T_OUTLINE);
}

// ============================================================================
// PIXEL TYPOGRAPHY IN ENGLISH (TIER-1 RETRO MMORPG AESTHETIC)
// ============================================================================

// Top Badge
drawPixelText(bCanvas, "OFFICIAL CHATTREE PLUGIN", 85, 22, [215, 175, 55], 1, [10, 8, 14]);

// Main Title: CHATTREE RPG
drawPixelText(bCanvas, "CHATTREE RPG", 68, 36, [255, 225, 75], 3, [10, 8, 14]);

// Subtitle: CHRONICLES OF ELDORIA
drawPixelText(bCanvas, "CHRONICLES OF ELDORIA", 82, 65, [255, 255, 255], 1, [10, 8, 14]);

// Category Tagline: RETRO TEXT MMORPG SIMULATOR
drawPixelText(bCanvas, "RETRO TEXT RPG SIMULATOR", 78, 77, [240, 110, 120], 1, [10, 8, 14]);

// Features Row: AI NARRATOR • DETERMINISTIC ROLLS • SQLITE LOOT
drawPixelText(bCanvas, "AI NARRATOR  -  D20 DICE ROLLS  -  SQLITE PERSISTENCE", 38, 93, [170, 215, 255], 1, [10, 8, 14]);

// Scale banner to 1200x630 (aspect ~ 1.9)
const finalBannerBuf = bCanvas.scaleUp(1200, 630);
fs.writeFileSync(path.join(pluginDir, 'banner.png'), encodePng(1200, 630, finalBannerBuf));
console.log('Saved Tibia-style banner.png (1200x630) with English text');
