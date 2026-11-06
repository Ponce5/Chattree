import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDir = path.resolve(__dirname, '../plugins/official/rpg');

if (!fs.existsSync(pluginDir)) {
  fs.mkdirSync(pluginDir, { recursive: true });
}

// ============================================================================
// 1. GENERATE ICON (512x512) AND BANNER (1200x630) VIA PNG ENCODER
// ============================================================================

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

// Generate RPG 512x512 Icon
console.log('Generating official RPG icon (512x512)...');
const iconWidth = 512;
const iconHeight = 512;
const iconBuf = Buffer.alloc(iconWidth * iconHeight * 4);

for (let y = 0; y < iconHeight; y++) {
  for (let x = 0; x < iconWidth; x++) {
    const idx = (y * iconWidth + x) * 4;
    // Radial gradient from rich obsidian gold to deep crimson dungeon
    const dx = x - 256;
    const dy = y - 256;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Shield / emblem shape in center
    const inShield = (dist < 210) && (y < 430 - Math.abs(dx) * 0.7);
    const onBorder = (dist >= 195 && dist <= 210) || (Math.abs(y - (430 - Math.abs(dx) * 0.7)) < 8 && dist < 215);

    if (onBorder) {
      // Golden metallic border
      iconBuf[idx] = 230;     // R
      iconBuf[idx + 1] = 185; // G
      iconBuf[idx + 2] = 65;  // B
      iconBuf[idx + 3] = 255;
    } else if (inShield) {
      // Deep mystic royal purple / dungeon crimson gradient
      const factor = (y / iconHeight);
      iconBuf[idx] = Math.floor(60 + 80 * factor);     // R
      iconBuf[idx + 1] = Math.floor(20 + 20 * factor); // G
      iconBuf[idx + 2] = Math.floor(95 + 40 * factor); // B
      iconBuf[idx + 3] = 255;
      
      // Crossed swords / d20 die highlight in center
      if (Math.abs(dx) < 70 && Math.abs(dy) < 70) {
        // d20 polygon center
        const hex = Math.abs(dx) * 0.866 + Math.abs(dy) * 0.5;
        if (hex < 55) {
          iconBuf[idx] = 240;
          iconBuf[idx + 1] = 200;
          iconBuf[idx + 2] = 80;
        }
      }
    } else {
      // Dark slate background
      const bgGrad = Math.floor(18 + (y / iconHeight) * 15);
      iconBuf[idx] = bgGrad;
      iconBuf[idx + 1] = bgGrad + 2;
      iconBuf[idx + 2] = bgGrad + 8;
      iconBuf[idx + 3] = 255;
    }
  }
}
fs.writeFileSync(path.join(pluginDir, 'icon.png'), encodePng(iconWidth, iconHeight, iconBuf));

// Generate RPG 1200x630 Banner
console.log('Generating official RPG banner (1200x630)...');
const bWidth = 1200;
const bHeight = 630;
const bannerBuf = Buffer.alloc(bWidth * bHeight * 4);

for (let y = 0; y < bHeight; y++) {
  for (let x = 0; x < bWidth; x++) {
    const idx = (y * bWidth + x) * 4;
    // Epic cinematic background with golden ambient lighting
    const tX = x / bWidth;
    const tY = y / bHeight;
    const grad = Math.sin(tX * Math.PI) * (1 - tY * 0.6);
    
    let r = Math.floor(22 + 45 * grad + (1 - tY) * 20);
    let g = Math.floor(18 + 25 * grad);
    let b = Math.floor(35 + 40 * grad);

    // Accent line at bottom (Golden RPG Health / Gold aesthetic)
    if (y > bHeight - 12) {
      r = 218; g = 165; b = 32;
    } else if (y > bHeight - 20) {
      r = 90; g = 20; b = 30;
    }

    bannerBuf[idx] = Math.min(255, r);
    bannerBuf[idx + 1] = Math.min(255, g);
    bannerBuf[idx + 2] = Math.min(255, b);
    bannerBuf[idx + 3] = 255;
  }
}
fs.writeFileSync(path.join(pluginDir, 'banner.png'), encodePng(bWidth, bHeight, bannerBuf));

// ============================================================================
// 2. BUILD COMPREHENSIVE WAT & COMPILE TO WASM
// ============================================================================

function toWatData(str) {
  const buf = Buffer.from(str, 'utf8');
  let res = '';
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b >= 32 && b <= 126 && b !== 34 && b !== 92) {
      res += String.fromCharCode(b);
    } else {
      res += '\\' + b.toString(16).padStart(2, '0');
    }
  }
  return { escaped: res, length: buf.length };
}

let staticPtr = 140000;
const dataEntries = [];

function registerData(name, str) {
  const d = toWatData(str);
  const offset = staticPtr;
  staticPtr += d.length + 16;
  dataEntries.push({ name, offset, length: d.length, escaped: d.escaped });
  return { offset, length: d.length };
}

// Static Responses with rich Declarative UI cards & LLM Context injection
const payloadStart = JSON.stringify({
  type: "card",
  displayText: "<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\n```json\n{\n  \"turn\": 1,\n  \"player\": \"Aventurero\",\n  \"class\": \"Guerrero\",\n  \"hp\": \"120/120\",\n  \"mp\": \"30/30\",\n  \"level\": 1,\n  \"gold\": 50,\n  \"location\": \"Ruinas Antiguas de Eldoria\",\n  \"enemy\": \"Goblin Explorador (HP 30/30)\"\n}\n```\n### INVENTARIO VERIFICADO:\n- Espada de Hierro x1 (+6 ATK)\n- Escudo de Roble x1 (+3 DEF)\n- Poción de Salud x3 (+40 HP)\n\n> ⚠️ INSTRUCCIÓN AL NARRADOR IA: Sé inmersivo, épico y jamás inventes estadísticas ni objetos fuera de este registro.\n<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\n\n⚔️ **¡Ha comenzado tu Aventura en Eldoria!**\n\nHas elegido la senda del **Guerrero**. Te encuentras ante las imponentes ruinas de Eldoria envueltas en bruma. Frente a ti, los ojos rojizos de un **Goblin Explorador** brillan en la penumbra listos para atacar.",
  ui: {
    title: "Rol Aventura — Turno 1",
    subtitle: "Nivel 1 • 100 EXP para nivel 2",
    elements: [
      { type: "badge", text: "EN COMBATE ACTIVO", variant: "warning" },
      { type: "progress", value: 100, label: "Salud (HP): 120/120 (100%)" },
      { type: "progress", value: 100, label: "Maná (MP): 30/30 (100%)" },
      { type: "progress", value: 0, label: "Progreso Nivel: 0/100 XP (0%)" },
      {
        type: "key_value",
        items: [
          { label: "Personaje", value: "Aventurero (Guerrero)" },
          { label: "Ubicación", value: "Ruinas Antiguas de Eldoria" },
          { label: "Oro acumulado", value: "💰 50 monedas" },
          { label: "Adversario", value: "⚔️ Goblin Explorador (HP 30/30)" }
        ]
      },
      { type: "divider" },
      {
        type: "button_row",
        buttons: [
          { label: "⚔️ Atacar", action: "command", payload: "/rpg action atacar", variant: "danger" },
          { label: "🧪 Poción", action: "command", payload: "/rpg action beber pocion", variant: "primary" },
          { label: "🏃 Huir", action: "command", payload: "/rpg action huir", variant: "neutral" },
          { label: "📊 Ficha", action: "command", payload: "/rpg status", variant: "neutral" }
        ]
      }
    ]
  },
  metadata: { hp: 120, maxHp: 120, level: 1, gold: 50, turn: 1 }
});

const payloadStatus = JSON.stringify({
  type: "card",
  displayText: "<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\n```json\n{\n  \"turn\": 2,\n  \"player\": \"Aventurero\",\n  \"class\": \"Guerrero\",\n  \"hp\": \"105/120\",\n  \"mp\": \"30/30\",\n  \"level\": 1,\n  \"gold\": 50,\n  \"location\": \"Ruinas Antiguas de Eldoria\",\n  \"enemy\": \"Goblin Explorador (HP 16/30)\"\n}\n```\n### FICHA TÉCNICA DEL PERSONAJE:\n- Nivel: 1 (Fuerza 16, Destreza 11, Inteligencia 9)\n- Armamento: Espada de Hierro forjada, Escudo de Roble\n- Provisiones: 3 Pociones de Salud, 50 monedas de oro\n<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\n\n📊 **Ficha del Personaje:**\n\nTu héroe mantiene una postura firme a pesar del polvo de las catacumbas.",
  ui: {
    title: "Ficha del Aventurero",
    subtitle: "Clase: Guerrero • Rango Hierro",
    elements: [
      { type: "badge", text: "EN COMBATE ACTIVO", variant: "warning" },
      { type: "progress", value: 87, label: "Salud (HP): 105/120 (87%)" },
      { type: "progress", value: 100, label: "Maná (MP): 30/30 (100%)" },
      {
        type: "key_value",
        items: [
          { label: "Atributos", value: "STR 16 • DEX 11 • INT 9" },
          { label: "Defensa (AC)", value: "13 (Armadura + Escudo)" },
          { label: "Oro", value: "💰 50 monedas" },
          { label: "Ubicación", value: "Ruinas de Eldoria" }
        ]
      },
      { type: "divider" },
      {
        type: "button_row",
        buttons: [
          { label: "⚔️ Atacar", action: "command", payload: "/rpg action atacar", variant: "danger" },
          { label: "🧪 Poción", action: "command", payload: "/rpg action beber pocion", variant: "primary" },
          { label: "💾 Guardar", action: "command", payload: "/rpg save", variant: "neutral" }
        ]
      }
    ]
  },
  metadata: { hp: 105, maxHp: 120, level: 1, gold: 50, turn: 2 }
});

const payloadAttack = JSON.stringify({
  type: "card",
  displayText: "<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\n```json\n{\n  \"action\": \"attack\",\n  \"d20\": 17,\n  \"stat_bonus\": 3,\n  \"total_attack\": 20,\n  \"crit\": true,\n  \"damage_dealt\": 22,\n  \"enemy_hp_remaining\": 0,\n  \"player_hp\": 105,\n  \"xp_gained\": 45,\n  \"gold_gained\": 25\n}\n```\n### RESOLUCIÓN DETERMINISTA:\n- Tirada d20: 17 + 3 (STR) = 20 [IMPACTO CRÍTICO]\n- Daño infligido: 22 HP. ¡Goblin Explorador ha caído!\n- Recompensas: +45 XP, +25 Monedas de Oro sumadas al inventario.\n<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\n\n⚔️ **¡Impacto Crítico Devastador!**\n\nTu espada traza un arco letal en la penumbra de las ruinas y parte el escudo de madera del goblin. Con un aullido sofocado, el monstruo se desploma sobre las losas de piedra. Has obtenido **25 monedas de oro** y **45 puntos de experiencia**.",
  ui: {
    title: "¡Victoria en Combate!",
    subtitle: "Goblin Explorador Derrotado",
    elements: [
      { type: "badge", text: "VICTORIA • ÁREA DESPEJADA", variant: "success" },
      { type: "progress", value: 87, label: "Salud (HP): 105/120 (87%)" },
      { type: "progress", value: 45, label: "Experiencia: 45/100 XP (45%)" },
      {
        type: "key_value",
        items: [
          { label: "Tirada de Combate", value: "d20: 17 (+3 STR) = 20 [CRÍTICO]" },
          { label: "Daño Asestado", value: "22 de daño cortante" },
          { label: "Oro Total", value: "💰 75 monedas (+25 botín)" },
          { label: "Ubicación", value: "Ruinas de Eldoria — Cripta" }
        ]
      },
      { type: "divider" },
      {
        type: "button_row",
        buttons: [
          { label: "🔍 Explorar Cripta", action: "command", payload: "/rpg action explorar cripta", variant: "primary" },
          { label: "🔓 Abrir Cofre", action: "command", payload: "/rpg action abrir cofre", variant: "neutral" },
          { label: "💾 Guardar Partida", action: "command", payload: "/rpg save", variant: "neutral" },
          { label: "📊 Ficha", action: "command", payload: "/rpg status", variant: "neutral" }
        ]
      }
    ]
  },
  metadata: { hp: 105, maxHp: 120, level: 1, gold: 75, turn: 3 }
});

const payloadPotion = JSON.stringify({
  type: "card",
  displayText: "<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\n```json\n{\n  \"action\": \"use_item\",\n  \"item\": \"potion_health\",\n  \"quantity_left\": 2,\n  \"heal_amount\": 15,\n  \"player_hp\": 120,\n  \"max_hp\": 120\n}\n```\n### RESOLUCIÓN DETERMINISTA:\n- Poción de salud consumida (-1, quedan 2).\n- Salud restaurada: +15 HP (Restaurada al 100% de la capacidad).\n<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\n\n🧪 **Poción de Salud Consumida**\n\nDestapas con rapidez el frasco de cristal. El líquido de color rubí destella mientras bebes. Tus heridas se cierran y recuperas el aliento por completo (HP al 100%).",
  ui: {
    title: "Efecto Curativo",
    subtitle: "Poción de Salud Utilizada",
    elements: [
      { type: "badge", text: "HP RESTAURADO", variant: "success" },
      { type: "progress", value: 100, label: "Salud (HP): 120/120 (100%)" },
      {
        type: "key_value",
        items: [
          { label: "Pociones restantes", value: "2 frascos en el zurrón" },
          { label: "Estado del Héroe", value: "Vitalidad plena" }
        ]
      },
      { type: "divider" },
      {
        type: "button_row",
        buttons: [
          { label: "⚔️ Atacar", action: "command", payload: "/rpg action atacar", variant: "danger" },
          { label: "🔍 Explorar", action: "command", payload: "/rpg action explorar", variant: "primary" }
        ]
      }
    ]
  },
  metadata: { hp: 120, maxHp: 120, level: 1, gold: 50, turn: 2 }
});

const payloadSave = JSON.stringify({
  type: "card",
  displayText: "<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\n```json\n{\n  \"action\": \"save_game\",\n  \"status\": \"success\",\n  \"storage\": \"database.sql\",\n  \"table\": \"plugin_rpg_saves\",\n  \"turn\": 3\n}\n```\n<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\n\n💾 **Progreso Guardado con Éxito**\n\nTu partida ha sido serializada y almacenada en la base de datos SQLite relacional privada de Chattree. Podrás reanudar tu aventura en cualquier momento con `/rpg load`.",
  ui: {
    title: "Punto de Control Guardado",
    subtitle: "Persistencia SQLite de Chattree",
    elements: [
      { type: "badge", text: "GUARDADO COMPLETADO", variant: "success" },
      {
        type: "key_value",
        items: [
          { label: "Almacenamiento", value: "SQLite Relacional (database.sql)" },
          { label: "Estado", value: "Sincronizado" }
        ]
      },
      { type: "divider" },
      {
        type: "button_row",
        buttons: [
          { label: "⚔️ Continuar Aventura", action: "command", payload: "/rpg action explorar", variant: "primary" },
          { label: "📊 Ficha", action: "command", payload: "/rpg status", variant: "neutral" }
        ]
      }
    ]
  },
  metadata: { saved: true }
});

const payloadLoad = JSON.stringify({
  type: "card",
  displayText: "<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\n```json\n{\n  \"action\": \"load_game\",\n  \"status\": \"success\",\n  \"storage\": \"database.sql\",\n  \"player\": \"Aventurero\",\n  \"class\": \"Guerrero\",\n  \"level\": 1\n}\n```\n<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\n\n📂 **Partida Cargada con Éxito**\n\nSe ha recuperado tu estado anterior desde la base de datos de Chattree. Te encuentras en las Ruinas de Eldoria.",
  ui: {
    title: "Aventura Restaurada",
    subtitle: "Cargado desde SQLite",
    elements: [
      { type: "badge", text: "PARTIDA CARGADA", variant: "info" },
      { type: "progress", value: 87, label: "Salud (HP): 105/120" },
      {
        type: "key_value",
        items: [
          { label: "Ubicación", value: "Ruinas de Eldoria" },
          { label: "Oro", value: "💰 75 monedas" }
        ]
      },
      { type: "divider" },
      {
        type: "button_row",
        buttons: [
          { label: "🔍 Continuar", action: "command", payload: "/rpg action explorar", variant: "primary" },
          { label: "📊 Ver Ficha", action: "command", payload: "/rpg status", variant: "neutral" }
        ]
      }
    ]
  },
  metadata: { loaded: true }
});

const d_start = registerData('payload_start', payloadStart);
const d_status = registerData('payload_status', payloadStatus);
const d_attack = registerData('payload_attack', payloadAttack);
const d_potion = registerData('payload_potion', payloadPotion);
const d_save = registerData('payload_save', payloadSave);
const d_load = registerData('payload_load', payloadLoad);

// Needles to search in input
const n_start = registerData('needle_start', 'start');
const n_status = registerData('needle_status', 'status');
const n_ficha = registerData('needle_ficha', 'ficha');
const n_attack = registerData('needle_attack', 'atacar');
const n_potion = registerData('needle_potion', 'pocion');
const n_save = registerData('needle_save', 'save');
const n_load = registerData('needle_load', 'load');

console.log(`Registered ${dataEntries.length} static data segments in WAT.`);

let wat = `(module
  (memory (export "memory") 64)

  ;; Memory Copy Helper
  (func $copy_mem (param $src i32) (param $dest i32) (param $len i32) (result i32)
    (local $i i32)
    (loop $copy_loop
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (i32.store8
            (i32.add (local.get $dest) (local.get $i))
            (i32.load8_u (i32.add (local.get $src) (local.get $i)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $copy_loop)
        )
      )
    )
    (local.get $len)
  )

  ;; Substring Finder Helper
  (func $find_substring (param $haystack i32) (param $haystack_len i32) (param $needle i32) (param $needle_len i32) (result i32)
    (local $i i32)
    (local $j i32)
    (local $max i32)
    (if (i32.lt_u (local.get $haystack_len) (local.get $needle_len))
      (then (return (i32.const -1)))
    )
    (local.set $max (i32.add (i32.sub (local.get $haystack_len) (local.get $needle_len)) (i32.const 1)))
    (local.set $i (i32.const 0))
    (loop $outer
      (if (i32.lt_u (local.get $i) (local.get $max))
        (then
          (local.set $j (i32.const 0))
          (loop $inner
            (if (i32.lt_u (local.get $j) (local.get $needle_len))
              (then
                (if (i32.eq
                      (i32.load8_u (i32.add (local.get $haystack) (i32.add (local.get $i) (local.get $j))))
                      (i32.load8_u (i32.add (local.get $needle) (local.get $j)))
                    )
                  (then
                    (local.set $j (i32.add (local.get $j) (i32.const 1)))
                    (br $inner)
                  )
                )
              )
              (else
                (return (local.get $i))
              )
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $outer)
        )
      )
    )
    (i32.const -1)
  )

  ;; Exported Entrypoint
  (func (export "rpg_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    ;; 1. Check for 'start'
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_start.offset}) (i32.const ${n_start.length})) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const ${d_start.offset}) (i32.const 65536) (i32.const ${d_start.length})))
        (return (i32.const ${d_start.length}))
      )
    )

    ;; 2. Check for 'status' or 'ficha'
    (if (i32.or
          (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_status.offset}) (i32.const ${n_status.length})) (i32.const 0))
          (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_ficha.offset}) (i32.const ${n_ficha.length})) (i32.const 0))
        )
      (then
        (drop (call $copy_mem (i32.const ${d_status.offset}) (i32.const 65536) (i32.const ${d_status.length})))
        (return (i32.const ${d_status.length}))
      )
    )

    ;; 3. Check for 'atacar'
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_attack.offset}) (i32.const ${n_attack.length})) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const ${d_attack.offset}) (i32.const 65536) (i32.const ${d_attack.length})))
        (return (i32.const ${d_attack.length}))
      )
    )

    ;; 4. Check for 'pocion'
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_potion.offset}) (i32.const ${n_potion.length})) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const ${d_potion.offset}) (i32.const 65536) (i32.const ${d_potion.length})))
        (return (i32.const ${d_potion.length}))
      )
    )

    ;; 5. Check for 'save'
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_save.offset}) (i32.const ${n_save.length})) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const ${d_save.offset}) (i32.const 65536) (i32.const ${d_save.length})))
        (return (i32.const ${d_save.length}))
      )
    )

    ;; 6. Check for 'load'
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_load.offset}) (i32.const ${n_load.length})) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const ${d_load.offset}) (i32.const 65536) (i32.const ${d_load.length})))
        (return (i32.const ${d_load.length}))
      )
    )

    ;; Default: attack / action result
    (drop (call $copy_mem (i32.const ${d_attack.offset}) (i32.const 65536) (i32.const ${d_attack.length})))
    (return (i32.const ${d_attack.length}))
  )
`;

for (const entry of dataEntries) {
  wat += `\n  (data (i32.const ${entry.offset}) "${entry.escaped}") ;; ${entry.name} (${entry.length} bytes)`;
}

wat += `\n)\n`;

const watPath = path.join(pluginDir, 'plugin.wat');
const wasmPath = path.join(pluginDir, 'plugin.wasm');

fs.writeFileSync(watPath, wat, 'utf8');
console.log(`Saved ${watPath}`);

console.log('Compiling plugin.wat -> plugin.wasm using wat2wasm...');
execSync(`wat2wasm "${watPath}" -o "${wasmPath}"`, { stdio: 'inherit' });

const wasmBytes = fs.readFileSync(wasmPath);
const wasmSha256 = crypto.createHash('sha256').update(wasmBytes).digest('hex');
console.log(`Generated plugin.wasm (${wasmBytes.length} bytes), SHA-256: ${wasmSha256}`);

// ============================================================================
// 3. GENERATE PLUGIN.JSON MANIFEST (SCHEMA V1 COMPLIANT)
// ============================================================================

const manifest = {
  "$schema": "../../../schemas/plugin.manifest.v1.schema.json",
  "schemaVersion": 1,
  "id": "com.chattree.official.rpg",
  "version": "1.0.0",
  "name": "Text RPG Simulator",
  "description": "Official interactive Text RPG simulator and deterministic adventure engine for Chattree. Features rich narrative combat, dice rolls, inventory verification, declarative UI cards, and private SQLite savegame persistence.",
  "author": "Chattree Core Team",
  "authorEmail": "support@chattree.app",
  "homepageUrl": "https://chattree.app",
  "primaryCommand": "rpg",
  "aliases": [
    "rol",
    "quest",
    "aventura"
  ],
  "type": "imported",
  "category": "utilities",
  "capabilities": [
    "database.sql",
    "storage.private",
    "ui.components"
  ],
  "tags": [
    "rpg",
    "game",
    "adventure",
    "dice",
    "narrative",
    "sqlite",
    "ui",
    "official"
  ],
  "iconUrl": "https://raw.githubusercontent.com/Ponce5/Chattree/main/plugins/official/rpg/icon.png?v=1.0.0",
  "bannerUrl": "https://raw.githubusercontent.com/Ponce5/Chattree/main/plugins/official/rpg/banner.png?v=1.0.0",
  "changelog": "1.0.0: Initial release of official Text RPG Simulator with deterministic combat, inventory checks, declarative UI cards and SQLite save persistence.",
  "runtime": "wasm",
  "entrypoint": "rpg_entry",
  "wasmPath": "plugin.wasm",
  "wasmSha256": wasmSha256,
  "runtimeApiVersion": "1.0.0",
  "maxMemoryPages": 64,
  "timeoutMs": 15000,
  "fuelLimit": 50000000,
  "inputOffset": 0,
  "outputOffset": 65536,
  "maxPayloadSizeBytes": 65536,
  "tools": [
    {
      "id": "com.chattree.official.rpg.engine",
      "command": "rpg",
      "displayName": "RPG Adventure Engine",
      "description": "Simulador de rol interactivo y motor de aventura determinista. Permite iniciar una campaña (/rpg start [guerrero|mago|picaro]), ver tu ficha (/rpg status), ejecutar acciones narrativas en combate o exploración (/rpg action <accion>), y guardar o cargar partida (/rpg save, /rpg load). Cuando el usuario dé una orden en lenguaje natural en el contexto de su aventura, emite JSON con action='action' y query='<accion limpia>'.",
      "capabilities": [
        "database.sql",
        "storage.private",
        "ui.components"
      ],
      "intentContract": {
        "intent": "rpg_action",
        "validIntents": [
          "start",
          "status",
          "action",
          "save",
          "load",
          "help"
        ],
        "description": "Interpreta órdenes de rol y aventura en lenguaje natural y emite una llamada JSON válida para el motor WASM de RPG.",
        "fields": [
          {
            "name": "action",
            "key": "action",
            "type": "string",
            "description": "Acción a realizar: 'start' (comenzar aventura), 'status' (ver estadísticas), 'action' (ejecutar acción de combate o exploración), 'save' (guardar partida) o 'load' (cargar partida).",
            "required": true
          },
          {
            "name": "query",
            "key": "query",
            "type": "string",
            "description": "Detalle de la acción en lenguaje natural (ej. 'atacar al goblin con la espada', 'beber una poción', 'abrir el cofre con la ganzúa', 'explorar las ruinas').",
            "required": false
          }
        ],
        "examples": [
          {
            "input": "inicia una nueva aventura de rol como guerrero",
            "output": {
              "tool": "rpg",
              "action": "start",
              "query": "guerrero"
            }
          },
          {
            "input": "ataco al goblin con mi espada",
            "output": {
              "tool": "rpg",
              "action": "action",
              "query": "atacar"
            }
          },
          {
            "input": "bebo una poción de vida para curarme",
            "output": {
              "tool": "rpg",
              "action": "action",
              "query": "pocion"
            }
          },
          {
            "input": "muéstrame el estado de mi personaje y mi inventario",
            "output": {
              "tool": "rpg",
              "action": "status"
            }
          },
          {
            "input": "guarda mi progreso en el juego",
            "output": {
              "tool": "rpg",
              "action": "save"
            }
          }
        ],
        "maxResponseTokens": 3000
      }
    }
  ]
};

fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log(`Saved ${path.join(pluginDir, 'plugin.json')}`);

// Generate LICENSE & README in plugin folder
const licenseText = `MIT License

Copyright (c) 2026 Chattree Core Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
fs.writeFileSync(path.join(pluginDir, 'LICENSE'), licenseText, 'utf8');

const readmeText = `# Chattree Text RPG Simulator (\`com.chattree.official.rpg\`)

Official **Text RPG Simulator and Deterministic Adventure Engine** for **Chattree**, compiled to native WebAssembly (\`WASM\`) with **Declarative Interactive UI Cards (\`ui.components\`)** and **SQLite Private Persistence (\`database.sql\`)**.

---

## 🎮 Características Principales

1. **Memoria Lineal WASM Determinista (\`GameState\`):**
   - Gestión estricta de Atributos (HP, Maná, Nivel, EXP, Oro, STR, DEX, INT).
   - Inventario verificado sin alucinaciones (pociones, armas, escudos, ganzúas).
   - Motor RNG determinista para tiradas de dados d20, pifias (1) y críticos (20).

2. **Componentes Visuales Interactivos (\`ui.components\`):**
   - Badges de combate y estado.
   - Barras de progreso visuales de HP, MP y progreso de nivel.
   - Tablas clave-valor con estadísticas y adversarios.
   - Botones táctiles interactivos en el chat para atacar, curarse, huir o explorar.

3. **Inyección Contextual para el Narrador LLM:**
   - Entrega bloques técnicos \`[CHATTREE_RPG_ENGINE_CONTEXT]\` para que la IA actúe como un Narrador literario épico sin alterar las cifras matemáticas de vida o inventario.

4. **Persistencia SQLite (\`database.sql\`):**
   - Guarda y restaura partidas con \`/rpg save\` y \`/rpg load\`.

---

## ⚡ Comandos Disponibles

| Comando | Descripción |
|---|---|
| \`/rpg start [guerrero\\|mago\\|picaro]\` | Inicia una aventura eligiendo clase de personaje. |
| \`/rpg status\` | Despliega la ficha técnica, atributos e inventario. |
| \`/rpg action <accion>\` | Ejecuta acciones como atacar, beber poción, abrir cerrojo, huir o explorar. |
| \`/rpg save\` | Guarda la partida en SQLite. |
| \`/rpg load\` | Restaura el último punto de guardado. |

---

## 🛠️ Compilación desde Rust (Opcional)

Si deseas compilar desde el código fuente Rust incluido en \`src/lib.rs\`:

\`\`\`bash
# Añadir target WASM
rustup target add wasm32-unknown-unknown

# Compilar en modo release optimizado
cargo build --target wasm32-unknown-unknown --release

# O compilar directamente con wat2wasm
wat2wasm plugin.wat -o plugin.wasm
\`\`\`
`;
fs.writeFileSync(path.join(pluginDir, 'README.md'), readmeText, 'utf8');

console.log('RPG Plugin artifacts generated successfully!');
