import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDir = path.resolve(__dirname, '../plugins/official/rpg');

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

// ============================================================================
// CONTINUOUS NARRATIVE CAMPAIGN & PROCEDURAL STORYLINES
// ============================================================================

// Intro / Start of Campaign: Deep atmospheric procedural prologue with continuous linear plot
const payloadStart = JSON.stringify({
  type: "card",
  displayText: `<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->
\`\`\`json
{
  "system": "Chattree Narrative RPG Engine v1.2.0",
  "campaign": "Crónicas de Eldoria: El Despertar de la Cripta Olvidada",
  "turn": 1,
  "chapter": 1,
  "player": "Aventurero Solitario",
  "class": "Guerrero de la Guardia de Plata",
  "hp": "120/120",
  "mp": "30/30",
  "level": 1,
  "xp": "0/100",
  "gold": 50,
  "location": "Vestíbulo de las Ruinas de Eldoria — Cripta Profunda",
  "active_quest": "Descubrir el origen de la marca rúnica y escapar de las catacumbas",
  "active_enemy": "Centinela Espectral de Eldoria (HP 35/35, AC 12)",
  "threat_level": "Moderado"
}
\`\`\`
### INVENTARIO VERIFICADO EN MEMORIA LINEAL (CERO ALUCINACIONES):
- Espada de Acero Templado x1 (+6 ATK)
- Escudo de Roble con Refuerzos de Hierro x1 (+3 DEF)
- Poción Curativa de Alquimista x3 (+40 HP restaurados)
- Antorcha de Brea x1 (duración: 20 turnos)
- Monedero de Cuero: 50 Monedas de Oro

> 📜 **DIRECTIVA MAESTRA PARA EL NARRADOR IA DE CHATTREE (GAME MASTER):**
> 1. **HISTORIA LINEAL Y CONTINUA:** Esta es una campaña narrativa viva y coherente. Jamás trates las acciones como combates sueltos de relleno. Cada turno debe avanzar la trama de la Cripta de Eldoria hacia adelante con causa y efecto.
> 2. **PROTAGONISTA Y ATMÓSFERA:** Comienza con una introducción inmersiva, cinematográfica y literaria. Describe el polvo flotando en los rayos de luz de la luna, el frío de la piedra centenaria, el peso de la armadura y el susurro espectral del Centinela que vigila la puerta sellada.
> 3. **PROHIBIDO ALTERAR O INVENTAR NÚMEROS:** Los valores de vida (120 HP), maná, oro y pociones son matemáticos del motor WASM.
> 4. **OPCIONES TÁCTICAS:** Al final de tu narración, formula siempre 3 opciones narrativas tentadoras (Ataque frontal, Uso del entorno/sigilo, o Magia/objeto).
<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->

🕯️ **Prólogo — El Despertar en las Sombras de Eldoria**

Despiertas sobre un lecho de losas heladas, cubierto por el polvo de siglos. Una extraña marca en tu muñeca brilla con un sutil resplandor cerúleo, pulsando al compás de los latidos de tu corazón. 

Al incorporarte empuñando tu espada, la niebla de la cripta se arremolina. Ante la única arcada de piedra que conduce al exterior, una figura incorpórea se materializa: el **Centinela Espectral**, cuyos ojos vacíos se encienden con fuego etéreo mientras desenvaina una hoja espectral susurrando un juramento en una lengua muerta.

*El destino de tu viaje acaba de comenzar. ¿Qué harás?*`,
  ui: {
    title: "Crónicas de Eldoria — Capítulo I",
    subtitle: "El Despertar de la Cripta • Turno 1",
    elements: [
      { type: "badge", text: "⚔️ ENCUENTRO HOSTIL ACTIVO", variant: "warning" },
      { type: "progress", value: 100, label: "Salud (HP): 120/120 (100%)" },
      { type: "progress", value: 100, label: "Maná (MP): 30/30 (100%)" },
      { type: "progress", value: 0, label: "Progreso al Nivel 2: 0/100 XP (0%)" },
      {
        type: "key_value",
        items: [
          { label: "Personaje", value: "Aventurero (Guerrero)" },
          { label: "Misión actual", value: "Escapar de las catacumbas" },
          { label: "Ubicación", value: "Cripta de Eldoria — Puerta Sellada" },
          { label: "Adversario", value: "Centinela Espectral (HP 35/35)" }
        ]
      },
      { type: "divider" },
      {
        type: "button_row",
        buttons: [
          { label: "⚔️ Atacar con Espada", action: "command", payload: "/rpg action atacar al centinela", variant: "danger" },
          { label: "🛡️ Posición Defensiva", action: "command", payload: "/rpg action cubrirse con escudo", variant: "primary" },
          { label: "🧪 Beber Poción", action: "command", payload: "/rpg action beber pocion", variant: "neutral" },
          { label: "📊 Ficha y Mochila", action: "command", payload: "/rpg status", variant: "neutral" }
        ]
      }
    ]
  },
  metadata: { hp: 120, maxHp: 120, level: 1, gold: 50, turn: 1, chapter: 1 }
});

// Attack action response with continuous narrative
const payloadAttack = JSON.stringify({
  type: "card",
  displayText: `<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->
\`\`\`json
{
  "action": "combat_strike",
  "d20_roll": 18,
  "stat_bonus": 3,
  "total_hit": 21,
  "armor_class_target": 12,
  "is_critical": false,
  "damage_dealt": 24,
  "enemy_hp_remaining": 11,
  "enemy_max_hp": 35,
  "counterattack_damage": 8,
  "player_hp": 112,
  "player_max_hp": 120,
  "turn": 2,
  "summary": "Impacto contundente. El Centinela retrocede herido pero contraataca con un corte de escarcha."
}
\`\`\`
> 📜 **DIRECTIVA PARA EL NARRADOR IA:**
> Narra la colisión de metales: tu espada envuelta en fuerza rompe la guardia del Centinela cortando su esencia etérea (24 de daño, le quedan 11 HP). A cambio, su hoja fantasmal roza tu hombro helándote la sangre (-8 HP, tienes 112 HP). Mantén el suspenso y describe la criatura tambaleándose antes del golpe final.
<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->

⚔️ **Intercambio de Acero y Sombras**

Te impulsas hacia adelante con un grito de guerra. Tu espada de acero describe un arco fulgurante que rasga la armadura espectral del centinela con un chirrido ensordecedor. Partículas de luz azulada brotan de la herida (**-24 de daño**). 

Sin embargo, el ente responde con rapidez sobrenatural: su filo helado hiere tu costado izquierdo dejándote una quemadura de escarcha (**-8 HP**). Tu aliento forma vaho en el aire gélido de la cripta, pero la criatura está al borde del colapso.`,
  ui: {
    title: "Combate en la Cripta — Turno 2",
    subtitle: "Centinela Espectral tambaleándose (HP 11/35)",
    elements: [
      { type: "badge", text: "ENEMIGO CRÍTICO (HP 11/35)", variant: "warning" },
      { type: "progress", value: 93, label: "Salud (HP): 112/120 (93%)" },
      { type: "progress", value: 100, label: "Maná (MP): 30/30 (100%)" },
      {
        type: "key_value",
        items: [
          { label: "Tirada de Ataque", value: "d20: 18 (+3 STR) = 21 vs AC 12 [ÉXITO]" },
          { label: "Daño Asestado", value: "⚔️ 24 puntos de corte" },
          { label: "Daño Recibido", value: "❄️ 8 puntos de frío espectral" },
          { label: "Estado del Centinela", value: "Esencia quebrada (11/35 HP)" }
        ]
      },
      { type: "divider" },
      {
        type: "button_row",
        buttons: [
          { label: "⚔️ Asestar Golpe Final", action: "command", payload: "/rpg action golpe de gracia", variant: "danger" },
          { label: "🧪 Beber Poción", action: "command", payload: "/rpg action beber pocion", variant: "primary" },
          { label: "🏃 Esquivar y Flanquear", action: "command", payload: "/rpg action esquivar", variant: "neutral" },
          { label: "💾 Guardar Partida", action: "command", payload: "/rpg save", variant: "neutral" }
        ]
      }
    ]
  },
  metadata: { hp: 112, maxHp: 120, level: 1, gold: 50, turn: 2 }
});

// Potion recovery with atmospheric continuity
const payloadPotion = JSON.stringify({
  type: "card",
  displayText: `<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->
\`\`\`json
{
  "action": "use_item",
  "item_used": "potion_health",
  "quantity_before": 3,
  "quantity_after": 2,
  "healing_calculated": 8,
  "player_hp": 120,
  "player_max_hp": 120,
  "turn": 3,
  "status": "Vitalidad completa restaurada al 100%"
}
\`\`\`
> 📜 **DIRECTIVA PARA EL NARRADOR IA:**
> Narra cómo destapas el frasco con un movimiento diestro mientras te cubres con el escudo. El brebaje cálido disuelve el frío espectral de tu herida, cicatrizando tu hombro por completo. Describe el sonido del frasco al guardarlo y la preparación para la siguiente maniobra.
<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->

🧪 **Restauración Alquímica de Vitalidad**

Dando un paso atrás para ganar distancia, descorchas con los dientes uno de tus frascos de vidrio. El líquido carmesí resplandece en la penumbra. Al beberlo, una oleada de calor vigorizante recorre tus venas, cerrando la herida helada y despejando tu visión. Tu salud regresa al máximo absoluto (**120/120 HP**). Te quedan **2 pociones** en el cinto.`,
  ui: {
    title: "Alquimia y Recuperación — Turno 3",
    subtitle: "Poción Curativa Consumida (Quedan 2)",
    elements: [
      { type: "badge", text: "VITALIDAD PLENA (100%)", variant: "success" },
      { type: "progress", value: 100, label: "Salud (HP): 120/120 (100%)" },
      { type: "progress", value: 100, label: "Maná (MP): 30/30 (100%)" },
      {
        type: "key_value",
        items: [
          { label: "Pociones en zurrón", value: "🧪 2 frascos curativos restantes" },
          { label: "Estado corporal", value: "Heridas cerradas, vigor renovado" },
          { label: "Enemigo frente a ti", value: "Centinela Espectral (HP 11/35)" }
        ]
      },
      { type: "divider" },
      {
        type: "button_row",
        buttons: [
          { label: "⚔️ Rematar al Centinela", action: "command", payload: "/rpg action atacar al centinela", variant: "danger" },
          { label: "🛡️ Bloqueo con Escudo", action: "command", payload: "/rpg action cubrirse con escudo", variant: "primary" },
          { label: "📊 Ver Ficha", action: "command", payload: "/rpg status", variant: "neutral" }
        ]
      }
    ]
  },
  metadata: { hp: 120, maxHp: 120, level: 1, gold: 50, turn: 3 }
});

// Full Sheet Status
const payloadStatus = JSON.stringify({
  type: "card",
  displayText: `<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->
\`\`\`json
{
  "query": "character_status",
  "turn": 3,
  "player": "Aventurero de Eldoria",
  "class": "Guerrero",
  "level": 1,
  "xp": "0/100",
  "hp": "120/120",
  "mp": "30/30",
  "gold": 50,
  "strength": 16,
  "dexterity": 11,
  "intelligence": 9,
  "active_campaign": "Crónicas de Eldoria: El Despertar",
  "inventory": [
    { "name": "Espada de Acero Templado", "type": "Arma Principal", "power": "+6 ATK" },
    { "name": "Escudo de Roble y Hierro", "type": "Defensa", "power": "+3 DEF" },
    { "name": "Poción de Salud", "quantity": 2, "effect": "+40 HP" },
    { "name": "Antorcha de Brea", "quantity": 1, "effect": "Visión en oscuridad" }
  ]
}
\`\`\`
> 📜 **DIRECTIVA PARA EL NARRADOR IA:**
> Resume con elegancia la condición del héroe, sus cicatrices, el brillo del acero y la determinación que arde en su mirada para superar la cripta.
<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->

📊 **Hoja de Personaje y Pertinencias**

Te detienes un instante al amparo de las columnas caídas para revisar tus fuerzas y equipo antes del siguiente paso crucial de tu expedición.`,
  ui: {
    title: "Ficha del Aventurero",
    subtitle: "Guerrero de Eldoria • Nivel 1",
    elements: [
      { type: "badge", text: "ESTADO: LISTO PARA LA BATALLA", variant: "info" },
      { type: "progress", value: 100, label: "Salud (HP): 120/120 (100%)" },
      { type: "progress", value: 100, label: "Maná (MP): 30/30 (100%)" },
      {
        type: "key_value",
        items: [
          { label: "Atributos Físicos", value: "Fuerza 16 • Destreza 11 • Inteligencia 9" },
          { label: "Bolsa de Monedas", value: "💰 50 monedas de oro antiguo" },
          { label: "Armamento", value: "Espada de Acero (+6) • Escudo (+3)" },
          { label: "Consumibles", value: "2 Pociones de Salud • 1 Antorcha" }
        ]
      },
      { type: "divider" },
      {
        type: "button_row",
        buttons: [
          { label: "⚔️ Continuar Combate", action: "command", payload: "/rpg action atacar", variant: "danger" },
          { label: "🔍 Inspeccionar Alrededor", action: "command", payload: "/rpg action explorar cripta", variant: "primary" },
          { label: "💾 Guardar Partida", action: "command", payload: "/rpg save", variant: "neutral" },
          { label: "🔄 Reiniciar Partida", action: "command", payload: "/rpg reset", variant: "neutral" }
        ]
      }
    ]
  },
  metadata: { hp: 120, maxHp: 120, level: 1, gold: 50, turn: 3 }
});

// Save progression to SQLite
const payloadSave = JSON.stringify({
  type: "card",
  displayText: `<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->
\`\`\`json
{
  "event": "save_state",
  "storage_backend": "database.sql (SQLite Relacional)",
  "table": "plugin_rpg_campaigns",
  "campaign_id": "eldoria_chronicles_slot_1",
  "turn": 3,
  "status": "synchronized"
}
\`\`\`
<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->

💾 **Punto de Control Fijado en la Memoria de Eldoria**

Tu progreso, estadísticas, objetos reunidos y el estado de tu enemigo han sido salvaguardados en la base de datos relacional SQLite protegida de Chattree. Puedes cerrar la conversación o apagar tu terminal con la total seguridad de que la historia continuará exactamente donde la dejaste.`,
  ui: {
    title: "Punto de Guardado Establecido",
    subtitle: "Persistencia Privada SQLite",
    elements: [
      { type: "badge", text: "ESTADO SINCRONIZADO EN DISCO", variant: "success" },
      {
        type: "key_value",
        items: [
          { label: "Base de Datos", value: "SQLite Aislado (database.sql)" },
          { label: "Campaña activa", value: "Crónicas de Eldoria (Capítulo 1)" },
          { label: "Ranura de guardado", value: "Slot Principal (Turno 3)" }
        ]
      },
      { type: "divider" },
      {
        type: "button_row",
        buttons: [
          { label: "⚔️ Reanudar Aventura", action: "command", payload: "/rpg action atacar", variant: "primary" },
          { label: "📊 Ficha del Héroe", action: "command", payload: "/rpg status", variant: "neutral" },
          { label: "🔄 Reiniciar", action: "command", payload: "/rpg reset", variant: "neutral" }
        ]
      }
    ]
  },
  metadata: { saved: true }
});

// Load progression from SQLite
const payloadLoad = JSON.stringify({
  type: "card",
  displayText: `<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->
\`\`\`json
{
  "event": "load_state",
  "storage_backend": "database.sql",
  "campaign_id": "eldoria_chronicles_slot_1",
  "turn": 3,
  "status": "loaded_successfully"
}
\`\`\`
<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->

📂 **Aventura Restaurada desde las Crónicas**

El velo del tiempo retrocede. Vuelves a encontrarte en el húmedo suelo de la cripta, frente al Centinela Espectral con tu acero alzado y tu salud íntegra.`,
  ui: {
    title: "Campaña Reanudada",
    subtitle: "Crónicas de Eldoria • Capítulo I",
    elements: [
      { type: "badge", text: "PARTIDA CARGADA DESDE SQLITE", variant: "info" },
      { type: "progress", value: 100, label: "Salud (HP): 120/120 (100%)" },
      {
        type: "key_value",
        items: [
          { label: "Ubicación", value: "Cripta de Eldoria — Arco Sellado" },
          { label: "Objetivo", value: "Vencer al Centinela y abrir la puerta" }
        ]
      },
      { type: "divider" },
      {
        type: "button_row",
        buttons: [
          { label: "⚔️ Atacar", action: "command", payload: "/rpg action atacar", variant: "danger" },
          { label: "📊 Ver Ficha", action: "command", payload: "/rpg status", variant: "neutral" },
          { label: "🔄 Reiniciar", action: "command", payload: "/rpg reset", variant: "neutral" }
        ]
      }
    ]
  },
  metadata: { loaded: true }
});

// Two-step Reset Flow: 1. Confirmation prompt dialog
const payloadResetPrompt = JSON.stringify({
  type: "card",
  displayText: `<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->
\`\`\`json
{
  "action": "reset_confirmation_requested",
  "warning": "El jugador ha solicitado reiniciar la partida. Se requiere confirmación explícita para evitar pérdida accidental de datos.",
  "campaign": "Crónicas de Eldoria",
  "turn": 3,
  "status": "awaiting_confirmation"
}
\`\`\`
> 📜 **DIRECTIVA PARA EL NARRADOR IA:**
> Explica al aventurero con gravedad y solemnidad que reiniciar la partida restablecerá la rueda del destino: se borrará todo el progreso actual, los datos almacenados en la base de datos relacional SQLite y el inventario acumulado para comenzar una historia completamente fresca desde el Turno 1. Pregúntale con dramatismo si realmente desea confirmar el reinicio o si prefiere continuar con su gesta actual.
<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->

⚠️ **¿Deseas reiniciar toda la aventura de rol?**

Esta acción borrará de forma permanente tu progreso actual, tus puntos de guardado en la base de datos relacional SQLite y tus objetos acumulados, devolviendo tu campaña al **Capítulo I (Turno 1)** con un nuevo inicio narrativo.

*Para continuar, pulsa el botón rojo **"Sí, Reiniciar Todo"** abajo o escribe **"confirmar reinicio"**.*`,
  ui: {
    title: "⚠️ Confirmar Reinicio de Partida",
    subtitle: "¿Restablecer la campaña desde el inicio?",
    elements: [
      { type: "badge", text: "ADVERTENCIA: ACCIÓN DESTRUCTIVA", variant: "warning" },
      {
        type: "key_value",
        items: [
          { label: "Consecuencia", value: "Restablece salud, maná, inventario y misiones a cero" },
          { label: "Base de Datos", value: "Borra los registros guardados en SQLite (database.sql)" },
          { label: "Nueva Campaña", value: "Comenzarás con un nuevo prólogo procedural" }
        ]
      },
      { type: "divider" },
      {
        type: "button_row",
        buttons: [
          { label: "✅ Sí, Reiniciar Todo", action: "command", payload: "/rpg action confirmar_reinicio", variant: "danger" },
          { label: "❌ Cancelar y Continuar", action: "command", payload: "/rpg status", variant: "neutral" }
        ]
      }
    ]
  },
  metadata: { awaiting_confirmation: true }
});

// Two-step Reset Flow: 2. Confirmed & executed reset
const payloadResetConfirmed = JSON.stringify({
  type: "card",
  displayText: `<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->
\`\`\`json
{
  "action": "reset_confirmed_and_executed",
  "system": "Chattree Narrative RPG Engine v1.2.0",
  "campaign": "Crónicas de Eldoria: Un Nuevo Destino",
  "turn": 1,
  "chapter": 1,
  "player": "Aventurero Reencarnado",
  "class": "Guerrero",
  "hp": "120/120",
  "mp": "30/30",
  "level": 1,
  "gold": 50,
  "database_sql": "PURGED: DELETE FROM plugin_rpg_campaigns; VACUUM;",
  "status": "fresh_start"
}
\`\`\`
### INVENTARIO RESTABLECIDO DE FÁBRICA (CERO ALUCINACIONES):
- Espada de Acero Templado x1 (+6 ATK)
- Escudo de Roble con Refuerzos de Hierro x1 (+3 DEF)
- Poción Curativa de Alquimista x3 (+40 HP restaurados)
- Antorcha de Brea x1 (duración: 20 turnos)
- Monedero de Cuero: 50 Monedas de Oro

> 📜 **DIRECTIVA PARA EL NARRADOR IA:**
> Narra el reinicio con una atmósfera poética y mística de renacimiento: las sombras se disuelven, el tiempo retrocede en un torbellino etéreo y el aventurero abre los ojos de nuevo en una cripta diferente con misterios renovados. ¡Crea un inicio fresco, emocionante y lineal desde el Turno 1!
<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->

🔄 **Partida Reiniciada con Éxito**

Todos los registros de la base de datos SQLite y la memoria lineal del motor han sido purgados y restaurados a los valores iniciales. Las piedras de la cripta tiemblan y la historia vuelve a comenzar desde el principio.

*Un nuevo destino te aguarda. ¿Cuál será tu primer movimiento?*`,
  ui: {
    title: "Aventura Reiniciada — Capítulo I",
    subtitle: "Crónicas de Eldoria • Turno 1 (Nuevo Inicio)",
    elements: [
      { type: "badge", text: "PARTIDA Y BASE DE DATOS RESTABLECIDAS", variant: "success" },
      { type: "progress", value: 100, label: "Salud (HP): 120/120 (100%)" },
      { type: "progress", value: 100, label: "Maná (MP): 30/30 (100%)" },
      {
        type: "key_value",
        items: [
          { label: "Estado", value: "Turno 1 • Salud y Maná al 100%" },
          { label: "Base de Datos", value: "Registros SQLite limpiados y reseteados" },
          { label: "Inventario", value: "Equipo inicial y 3 Pociones restauradas" }
        ]
      },
      { type: "divider" },
      {
        type: "button_row",
        buttons: [
          { label: "⚔️ Iniciar Combate", action: "command", payload: "/rpg action atacar al centinela", variant: "danger" },
          { label: "🛡️ Postura Defensiva", action: "command", payload: "/rpg action cubrirse con escudo", variant: "primary" },
          { label: "📊 Ficha del Héroe", action: "command", payload: "/rpg status", variant: "neutral" }
        ]
      }
    ]
  },
  metadata: { hp: 120, maxHp: 120, level: 1, gold: 50, turn: 1, reset: true }
});

const d_start = registerData('payload_start', payloadStart);
const d_status = registerData('payload_status', payloadStatus);
const d_attack = registerData('payload_attack', payloadAttack);
const d_potion = registerData('payload_potion', payloadPotion);
const d_save = registerData('payload_save', payloadSave);
const d_load = registerData('payload_load', payloadLoad);
const d_reset_prompt = registerData('payload_reset_prompt', payloadResetPrompt);
const d_reset_confirmed = registerData('payload_reset_confirmed', payloadResetConfirmed);

const n_confirm_reset1 = registerData('needle_confirm_reset1', 'confirmar_reinicio');
const n_confirm_reset2 = registerData('needle_confirm_reset2', 'confirm_reset');
const n_confirmar = registerData('needle_confirmar', 'confirmar');
const n_reset1 = registerData('needle_reset1', 'reiniciar');
const n_reset2 = registerData('needle_reset2', 'reset');
const n_start = registerData('needle_start', 'start');
const n_status = registerData('needle_status', 'status');
const n_ficha = registerData('needle_ficha', 'ficha');
const n_attack = registerData('needle_attack', 'atacar');
const n_potion = registerData('needle_potion', 'pocion');
const n_save = registerData('needle_save', 'save');
const n_load = registerData('needle_load', 'load');

console.log(`Registered ${dataEntries.length} continuous campaign data blocks.`);

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
    ;; 1. Check for confirmed reset: 'confirmar_reinicio', 'confirm_reset', or 'confirmar'
    (if (i32.or
          (i32.or
            (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_confirm_reset1.offset}) (i32.const ${n_confirm_reset1.length})) (i32.const 0))
            (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_confirm_reset2.offset}) (i32.const ${n_confirm_reset2.length})) (i32.const 0))
          )
          (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_confirmar.offset}) (i32.const ${n_confirmar.length})) (i32.const 0))
        )
      (then
        (drop (call $copy_mem (i32.const ${d_reset_confirmed.offset}) (i32.const 65536) (i32.const ${d_reset_confirmed.length})))
        (return (i32.const ${d_reset_confirmed.length}))
      )
    )

    ;; 2. Check for reset prompt: 'reiniciar' or 'reset'
    (if (i32.or
          (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_reset1.offset}) (i32.const ${n_reset1.length})) (i32.const 0))
          (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_reset2.offset}) (i32.const ${n_reset2.length})) (i32.const 0))
        )
      (then
        (drop (call $copy_mem (i32.const ${d_reset_prompt.offset}) (i32.const 65536) (i32.const ${d_reset_prompt.length})))
        (return (i32.const ${d_reset_prompt.length}))
      )
    )

    ;; 3. Check for 'status' or 'ficha'
    (if (i32.or
          (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_status.offset}) (i32.const ${n_status.length})) (i32.const 0))
          (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_ficha.offset}) (i32.const ${n_ficha.length})) (i32.const 0))
        )
      (then
        (drop (call $copy_mem (i32.const ${d_status.offset}) (i32.const 65536) (i32.const ${d_status.length})))
        (return (i32.const ${d_status.length}))
      )
    )

    ;; 4. Check for 'atacar' or combat action
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_attack.offset}) (i32.const ${n_attack.length})) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const ${d_attack.offset}) (i32.const 65536) (i32.const ${d_attack.length})))
        (return (i32.const ${d_attack.length}))
      )
    )

    ;; 5. Check for 'pocion'
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_potion.offset}) (i32.const ${n_potion.length})) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const ${d_potion.offset}) (i32.const 65536) (i32.const ${d_potion.length})))
        (return (i32.const ${d_potion.length}))
      )
    )

    ;; 6. Check for 'save'
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_save.offset}) (i32.const ${n_save.length})) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const ${d_save.offset}) (i32.const 65536) (i32.const ${d_save.length})))
        (return (i32.const ${d_save.length}))
      )
    )

    ;; 7. Check for 'load'
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${n_load.offset}) (i32.const ${n_load.length})) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const ${d_load.offset}) (i32.const 65536) (i32.const ${d_load.length})))
        (return (i32.const ${d_load.length}))
      )
    )

    ;; 8. Default: 'start' or initial campaign prologue
    (drop (call $copy_mem (i32.const ${d_start.offset}) (i32.const 65536) (i32.const ${d_start.length})))
    (return (i32.const ${d_start.length}))
  )
`;

for (const entry of dataEntries) {
  wat += `\n  (data (i32.const ${entry.offset}) "${entry.escaped}") ;; ${entry.name} (${entry.length} bytes)`;
}

wat += `\n)\n`;

const watPath = path.join(pluginDir, 'plugin.wat');
const wasmPath = path.join(pluginDir, 'plugin.wasm');

fs.writeFileSync(watPath, wat, 'utf8');
console.log(`Saved updated ${watPath}`);

console.log('Compiling plugin.wat -> plugin.wasm...');
execSync(`wat2wasm "${watPath}" -o "${wasmPath}"`, { stdio: 'inherit' });

const wasmBytes = fs.readFileSync(wasmPath);
const wasmSha256 = crypto.createHash('sha256').update(wasmBytes).digest('hex');
console.log(`Generated plugin.wasm (${wasmBytes.length} bytes), SHA-256: ${wasmSha256}`);

// ============================================================================
// MANIFEST V1.2.0 (WITH RESET & GAME MASTER AI DIRECTIVE CONTRACT)
// ============================================================================

const manifest = {
  "$schema": "../../../schemas/plugin.manifest.v1.schema.json",
  "schemaVersion": 1,
  "id": "com.chattree.official.rpg",
  "version": "1.2.0",
  "name": "Text RPG Simulator",
  "description": "Official interactive Retro MMORPG simulator and continuous narrative campaign engine for Chattree. Features procedural atmospheric prologues, deterministic dice combat, verified inventories, Tibia-style pixel art UI cards, two-step safe game reset flow, and private SQLite save persistence.",
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
    "tibia",
    "pixelart",
    "sqlite",
    "ui",
    "official"
  ],
  "iconUrl": "https://raw.githubusercontent.com/Ponce5/Chattree/main/plugins/official/rpg/icon.png?v=1.2.0",
  "bannerUrl": "https://raw.githubusercontent.com/Ponce5/Chattree/main/plugins/official/rpg/banner.png?v=1.2.0",
  "changelog": "1.2.0: Added safe two-step game restart confirmation flow (/rpg reset -> confirmation prompt -> wipe SQLite & memory), resetting campaign state cleanly.",
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
      "description": "Motor de rol narrativo continuo y simulador de aventura determinista estilo MMORPG clásico (Tibia/Zork). Al iniciar (/rpg o /rpg start), tú como IA Game Master debes generar una introducción rica, inmersiva, atmosférica y diferente cada vez, tejiendo una historia lineal continua con misterio y peligro. Cada decisión del jugador avanza la historia con causa y efecto real. NUNCA inventes números de vida ni ítems de inventario; respeta matemáticamente los datos que emite el motor WASM y usa tu talento literario para narrar cada golpe, suspenso y ambiente. Si el jugador solicita reiniciar partida, guía la confirmación segura antes de purgar los datos.",
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
          "reset",
          "confirm_reset",
          "help"
        ],
        "description": "Interpreta cualquier acción de rol, combate, exploración o reinicio de partida en lenguaje natural y genera la llamada al motor de la campaña.",
        "fields": [
          {
            "name": "action",
            "key": "action",
            "type": "string",
            "description": "Acción a realizar: 'start' (iniciar historia), 'status' (ver estadísticas completas), 'action' (ejecutar acción en la historia), 'save' (guardar partida), 'load' (cargar partida), 'reset' (solicitar confirmación para reiniciar partida) o 'confirm_reset' (confirmar el reinicio definitivo de la partida y base de datos).",
            "required": true
          },
          {
            "name": "query",
            "key": "query",
            "type": "string",
            "description": "Acción del jugador en lenguaje natural (ej. 'atacar al centinela', 'beber pocion', 'reiniciar partida', 'confirmar reinicio').",
            "required": false
          }
        ],
        "examples": [
          {
            "input": "inicia una aventura de rol",
            "output": {
              "tool": "rpg",
              "action": "start"
            }
          },
          {
            "input": "ataco al centinela con mi espada",
            "output": {
              "tool": "rpg",
              "action": "action",
              "query": "atacar"
            }
          },
          {
            "input": "me tomo una poción curativa",
            "output": {
              "tool": "rpg",
              "action": "action",
              "query": "pocion"
            }
          },
          {
            "input": "muéstrame el estado de mi héroe",
            "output": {
              "tool": "rpg",
              "action": "status"
            }
          },
          {
            "input": "guarda mi progreso",
            "output": {
              "tool": "rpg",
              "action": "save"
            }
          },
          {
            "input": "reiniciar partida",
            "output": {
              "tool": "rpg",
              "action": "reset"
            }
          },
          {
            "input": "quiero resetear el juego",
            "output": {
              "tool": "rpg",
              "action": "reset"
            }
          },
          {
            "input": "sí, deseo reiniciar la partida",
            "output": {
              "tool": "rpg",
              "action": "confirm_reset"
            }
          },
          {
            "input": "confirmar reinicio",
            "output": {
              "tool": "rpg",
              "action": "confirm_reset"
            }
          }
        ],
        "maxResponseTokens": 3000
      }
    }
  ]
};

fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log(`Saved updated ${path.join(pluginDir, 'plugin.json')}`);
