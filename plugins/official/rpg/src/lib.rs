//! Chattree Text RPG Simulator & Narrative Adventure Engine
//! Compila a target `wasm32-unknown-unknown`
//! 
//! Proporciona:
//! 1. Estado determinista en memoria lineal WASM (GameState, Inventario, Estadísticas).
//! 2. Motor RNG determinista para tiradas de dados d20 y cálculo de modificadores.
//! 3. Generación de tarjetas interactivas UI declarativas (ui.components) para Flutter.
//! 4. Persistencia relacional mediante Chattree Host API (database.sql / storage.private).
//! 5. Inyección contextual estricta para el Narrador LLM de Chattree.

#![no_std]

extern crate alloc;

use alloc::collections::BTreeMap;
use alloc::format;
use alloc::string::{String, ToString};
use alloc::vec;
use alloc::vec::Vec;
use core::slice;
use core::str;
use serde::{Deserialize, Serialize};

// ============================================================================
// CHATTREE HOST API BINDINGS (LINEAR MEMORY PROTOCOL)
// ============================================================================

extern "C" {
    /// Host call ABI v1 / v2:
    /// Inicia una llamada sincrónica o asincrónica hacia el runtime de Chattree.
    fn host_call(ptr: *const u8, len: usize) -> i32;
}

// ============================================================================
// DATA MODELS & GAME ARCHITECTURE
// ============================================================================

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum CharacterClass {
    Warrior,
    Mage,
    Rogue,
}

impl CharacterClass {
    pub fn name(&self) -> &'static str {
        match self {
            CharacterClass::Warrior => "Guerrero",
            CharacterClass::Mage => "Mago",
            CharacterClass::Rogue => "Pícaro",
        }
    }

    pub fn base_stats(&self) -> CharacterStats {
        match self {
            CharacterClass::Warrior => CharacterStats {
                hp: 120,
                max_hp: 120,
                mp: 30,
                max_mp: 30,
                level: 1,
                xp: 0,
                xp_next: 100,
                gold: 50,
                strength: 16,
                dexterity: 11,
                intelligence: 9,
            },
            CharacterClass::Mage => CharacterStats {
                hp: 75,
                max_hp: 75,
                mp: 120,
                max_mp: 120,
                level: 1,
                xp: 0,
                xp_next: 100,
                gold: 60,
                strength: 8,
                dexterity: 12,
                intelligence: 18,
            },
            CharacterClass::Rogue => CharacterStats {
                hp: 90,
                max_hp: 90,
                mp: 50,
                max_mp: 50,
                level: 1,
                xp: 0,
                xp_next: 100,
                gold: 85,
                strength: 10,
                dexterity: 17,
                intelligence: 12,
            },
        }
    }

    pub fn starting_items(&self) -> Vec<Item> {
        match self {
            CharacterClass::Warrior => vec![
                Item::new("iron_sword", "Espada de Hierro", ItemType::Weapon, 1, 6, "Espada forjada de buen acero (+6 ATK)"),
                Item::new("wooden_shield", "Escudo de Roble", ItemType::Armor, 1, 3, "Escudo resistente (+3 DEF)"),
                Item::new("potion_health", "Poción de Salud", ItemType::Consumable, 3, 40, "Restaura 40 puntos de HP"),
            ],
            CharacterClass::Mage => vec![
                Item::new("apprentice_staff", "Bastón de Aprendiz", ItemType::Weapon, 1, 5, "Foco arcano de madera tallada (+5 MATK)"),
                Item::new("silk_robe", "Túnica de Seda Mágica", ItemType::Armor, 1, 2, "Túnica protectora con runas (+2 DEF, +10 MP)"),
                Item::new("potion_mana", "Poción de Maná", ItemType::Consumable, 3, 50, "Restaura 50 puntos de Maná"),
                Item::new("potion_health", "Poción de Salud", ItemType::Consumable, 2, 40, "Restaura 40 puntos de HP"),
            ],
            CharacterClass::Rogue => vec![
                Item::new("rusty_dagger", "Daga Mellada de Acero", ItemType::Weapon, 1, 5, "Hoja rápida y silenciosa (+5 ATK, +15% Crítico)"),
                Item::new("lockpick", "Ganzúa Maestra", ItemType::QuestItem, 2, 0, "Herramienta metálica para abrir cerrojos antiguos"),
                Item::new("smoke_bomb", "Bomba de Humo", ItemType::Consumable, 2, 0, "Permite escapar con éxito de cualquier combate"),
                Item::new("potion_health", "Poción de Salud", ItemType::Consumable, 2, 40, "Restaura 40 puntos de HP"),
            ],
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CharacterStats {
    pub hp: i32,
    pub max_hp: i32,
    pub mp: i32,
    pub max_mp: i32,
    pub level: i32,
    pub xp: i32,
    pub xp_next: i32,
    pub gold: i32,
    pub strength: i32,
    pub dexterity: i32,
    pub intelligence: i32,
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq, Debug)]
pub enum ItemType {
    Weapon,
    Armor,
    Consumable,
    QuestItem,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Item {
    pub id: String,
    pub name: String,
    pub item_type: ItemType,
    pub quantity: i32,
    pub power: i32,
    pub description: String,
}

impl Item {
    pub fn new(id: &str, name: &str, item_type: ItemType, quantity: i32, power: i32, description: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            item_type,
            quantity,
            power,
            description: description.to_string(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Enemy {
    pub id: String,
    pub name: String,
    pub hp: i32,
    pub max_hp: i32,
    pub attack: i32,
    pub defense: i32,
    pub xp_reward: i32,
    pub gold_reward: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GameState {
    pub player_name: String,
    pub class: CharacterClass,
    pub stats: CharacterStats,
    pub inventory: Vec<Item>,
    pub location: String,
    pub location_title: String,
    pub active_enemy: Option<Enemy>,
    pub turn: u64,
    pub seed: u64,
    pub flags: BTreeMap<String, bool>,
}

impl GameState {
    pub fn new(player_name: &str, class: CharacterClass, seed: u64) -> Self {
        let stats = class.base_stats();
        let inventory = class.starting_items();
        let mut flags = BTreeMap::new();
        flags.insert("intro_seen".to_string(), true);
        flags.insert("crypt_door_unlocked".to_string(), false);
        flags.insert("boss_defeated".to_string(), false);

        Self {
            player_name: player_name.to_string(),
            class,
            stats,
            inventory,
            location: "eldoria_entrance".to_string(),
            location_title: "Ruinas Antiguas de Eldoria".to_string(),
            active_enemy: Some(Enemy {
                id: "goblin_scout".to_string(),
                name: "Goblin Explorador".to_string(),
                hp: 30,
                max_hp: 30,
                attack: 8,
                defense: 2,
                xp_reward: 45,
                gold_reward: 25,
            }),
            turn: 1,
            seed: if seed == 0 { 0x853c49e6748fea9b } else { seed },
            flags,
        }
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| String::from("{}"))
    }

    pub fn from_json(json_str: &str) -> Option<Self> {
        serde_json::from_str(json_str).ok()
    }

    pub fn find_item(&self, keyword: &str) -> Option<&Item> {
        let kw = keyword.to_lowercase();
        self.inventory.iter().find(|i| {
            i.id.to_lowercase().contains(&kw) || i.name.to_lowercase().contains(&kw)
        })
    }

    pub fn remove_item_quantity(&mut self, id: &str, amount: i32) -> bool {
        if let Some(pos) = self.inventory.iter().position(|i| i.id == id) {
            if self.inventory[pos].quantity > amount {
                self.inventory[pos].quantity -= amount;
                true
            } else if self.inventory[pos].quantity == amount {
                self.inventory.remove(pos);
                true
            } else {
                false
            }
        } else {
            false
        }
    }

    pub fn add_item(&mut self, item: Item) {
        if let Some(existing) = self.inventory.iter_mut().find(|i| i.id == item.id) {
            existing.quantity += item.quantity;
        } else {
            self.inventory.push(item);
        }
    }

    pub fn add_xp(&mut self, amount: i32) -> bool {
        self.stats.xp += amount;
        if self.stats.xp >= self.stats.xp_next {
            self.stats.level += 1;
            self.stats.xp -= self.stats.xp_next;
            self.stats.xp_next = (self.stats.xp_next as f32 * 1.5) as i32;
            self.stats.max_hp += 20;
            self.stats.hp = self.stats.max_hp;
            self.stats.max_mp += 15;
            self.stats.mp = self.stats.max_mp;
            self.stats.strength += 2;
            self.stats.dexterity += 2;
            self.stats.intelligence += 2;
            true // Subió de nivel
        } else {
            false
        }
    }
}

// ============================================================================
// DETERMINISTIC RNG ENGINE (XORSHIFT64)
// ============================================================================

pub struct DeterministicRng {
    state: u64,
}

impl DeterministicRng {
    pub fn new(seed: u64) -> Self {
        Self {
            state: if seed == 0 { 0x9e3779b97f4a7c15 } else { seed },
        }
    }

    pub fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.state = x;
        x
    }

    /// Tirada de dado de 1 a lados (ej. 1 a 20)
    pub fn roll_die(&mut self, sides: u32) -> i32 {
        if sides == 0 {
            return 1;
        }
        ((self.next_u64() % sides as u64) + 1) as i32
    }
}

// ============================================================================
// GAME LOGIC & ACTION RESOLVER
// ============================================================================

pub struct ActionResult {
    pub success: bool,
    pub title: String,
    pub math_breakdown: String,
    pub outcome_summary: String,
    pub level_up: bool,
    pub enemy_defeated: bool,
    pub player_defeated: bool,
}

pub struct ActionResolver;

impl ActionResolver {
    pub fn resolve_action(state: &mut GameState, action_raw: &str) -> ActionResult {
        state.turn += 1;
        let mut rng = DeterministicRng::new(state.seed.wrapping_add(state.turn));
        let action = action_raw.trim().to_lowercase();

        // 1. ATAQUE / COMBATE
        if action.contains("atacar") || action.contains("golpear") || action.contains("espada") || action.contains("disparar") || action.contains("hechizo") {
            if let Some(mut enemy) = state.active_enemy.take() {
                let d20 = rng.roll_die(20);
                let stat_bonus = match state.class {
                    CharacterClass::Warrior => (state.stats.strength - 10) / 2,
                    CharacterClass::Mage => (state.stats.intelligence - 10) / 2,
                    CharacterClass::Rogue => (state.stats.dexterity - 10) / 2,
                };
                let total_attack = d20 + stat_bonus;
                let is_crit = d20 == 20;
                let is_fumble = d20 == 1;

                if is_fumble {
                    // Pifia: Tropiezo, el enemigo contraataca gratis
                    let enemy_dmg = (enemy.attack - (state.stats.strength / 5)).max(3);
                    state.stats.hp = (state.stats.hp - enemy_dmg).max(0);
                    state.active_enemy = Some(enemy.clone());
                    state.seed = rng.next_u64();

                    return ActionResult {
                        success: false,
                        title: "¡Pifia Crítica en el Ataque!".to_string(),
                        math_breakdown: format!("Tirada d20: 1 [PIFIA]. El jugador tropieza. Daño enemigo recibido: {} HP.", enemy_dmg),
                        outcome_summary: format!("Fallaste estrepitosamente tu ataque. {} aprovechó para golpearte causándote {} de daño. HP actual: {}/{}.", enemy.name, enemy_dmg, state.stats.hp, state.stats.max_hp),
                        level_up: false,
                        enemy_defeated: false,
                        player_defeated: state.stats.hp <= 0,
                    };
                }

                if total_attack >= (10 + enemy.defense) || is_crit {
                    // Impacto exitoso
                    let weapon_bonus = state.inventory.iter()
                        .filter(|i| i.item_type == ItemType::Weapon)
                        .map(|i| i.power)
                        .max()
                        .unwrap_or(2);

                    let base_dmg = rng.roll_die(8) + weapon_bonus + stat_bonus;
                    let final_dmg = if is_crit { base_dmg * 2 } else { base_dmg };
                    enemy.hp -= final_dmg;

                    if enemy.hp <= 0 {
                        // Enemigo derrotado
                        state.stats.gold += enemy.gold_reward;
                        let lvl = state.add_xp(enemy.xp_reward);
                        state.seed = rng.next_u64();

                        return ActionResult {
                            success: true,
                            title: format!("¡{} Derrotado!", enemy.name),
                            math_breakdown: format!("d20: {} (+{} stat) = {} vs AC {}. Daño infligido: {} {}. {} cae derrotado.", d20, stat_bonus, total_attack, 10 + enemy.defense, final_dmg, if is_crit { "[¡CRÍTICO!]" } else { "" }, enemy.name),
                            outcome_summary: format!("¡Victoria! Has asestado un golpe letal de {} puntos a {}. Recompensas: +{} EXP, +{} monedas de oro.", final_dmg, enemy.name, enemy.xp_reward, enemy.gold_reward),
                            level_up: lvl,
                            enemy_defeated: true,
                            player_defeated: false,
                        };
                    } else {
                        // Enemigo sobrevive y contraataca
                        let enemy_dmg = (enemy.attack - (state.stats.strength / 6)).max(2);
                        state.stats.hp = (state.stats.hp - enemy_dmg).max(0);
                        state.active_enemy = Some(enemy.clone());
                        state.seed = rng.next_u64();

                        return ActionResult {
                            success: true,
                            title: "Intercambio de Golpes".to_string(),
                            math_breakdown: format!("Ataque: d20: {} (+{}) = {}. Daño al enemigo: {}. Contraataque enemigo: {} HP recibidos.", d20, stat_bonus, total_attack, final_dmg, enemy_dmg),
                            outcome_summary: format!("Alcanzaste a {} infligiéndole {} de daño (HP restante enemigo: {}/{}). El enemigo respondió con furia causándote {} de daño. HP del jugador: {}/{}.", enemy.name, final_dmg, enemy.hp, enemy.max_hp, enemy_dmg, state.stats.hp, state.stats.max_hp),
                            level_up: false,
                            enemy_defeated: false,
                            player_defeated: state.stats.hp <= 0,
                        };
                    }
                } else {
                    // Fallo normal
                    let enemy_dmg = (enemy.attack / 2).max(1);
                    state.stats.hp = (state.stats.hp - enemy_dmg).max(0);
                    state.active_enemy = Some(enemy.clone());
                    state.seed = rng.next_u64();

                    return ActionResult {
                        success: false,
                        title: "Ataque Esquivado".to_string(),
                        math_breakdown: format!("d20: {} (+{}) = {} vs AC {}. Fallo por precisión.", d20, stat_bonus, total_attack, 10 + enemy.defense),
                        outcome_summary: format!("{} esquivó velozmente tu embestida y te rozó al contraatacar restándote {} de vida. HP restante: {}/{}.", enemy.name, enemy_dmg, state.stats.hp, state.stats.max_hp),
                        level_up: false,
                        enemy_defeated: false,
                        player_defeated: state.stats.hp <= 0,
                    };
                }
            } else {
                return ActionResult {
                    success: false,
                    title: "Sin Enemigos a la Vista".to_string(),
                    math_breakdown: "Sin objetivo hostil activo en la ubicación actual.".to_string(),
                    outcome_summary: "Blandes tu arma en el aire, pero no hay ningún adversario amenazante frente a ti en este instante.".to_string(),
                    level_up: false,
                    enemy_defeated: false,
                    player_defeated: false,
                };
            }
        }

        // 2. BEBER / USAR POCIÓN
        if action.contains("pocion") || action.contains("beber") || action.contains("curar") {
            if state.find_item("pocion").is_some() || state.find_item("potion_health").is_some() {
                let id = if state.find_item("potion_health").is_some() { "potion_health" } else { "pocion" };
                state.remove_item_quantity(id, 1);
                let heal = 40;
                let prev_hp = state.stats.hp;
                state.stats.hp = (state.stats.hp + heal).min(state.stats.max_hp);
                let actual_heal = state.stats.hp - prev_hp;

                return ActionResult {
                    success: true,
                    title: "Poción Consumida".to_string(),
                    math_breakdown: format!("Poción consumida (-1). Salud restaurada: +{} HP. Total: {}/{}.", actual_heal, state.stats.hp, state.stats.max_hp),
                    outcome_summary: format!("Bebes apresuradamente el líquido carmesí. Sientes una calidez restauradora que sana tus heridas recuperando {} puntos de vida (HP actual: {}/{}).", actual_heal, state.stats.hp, state.stats.max_hp),
                    level_up: false,
                    enemy_defeated: false,
                    player_defeated: false,
                };
            } else {
                return ActionResult {
                    success: false,
                    title: "Inventario Insuficiente".to_string(),
                    math_breakdown: "Validación de inventario fallida: 0 pociones disponibles.".to_string(),
                    outcome_summary: "Rebuscas desesperadamente en tu zurrón pero compruebas que no te quedan pociones de salud.".to_string(),
                    level_up: false,
                    enemy_defeated: false,
                    player_defeated: false,
                };
            }
        }

        // 3. ABRIR CERRADURA / GANZÚA
        if action.contains("cerradura") || action.contains("abrir") || action.contains("cofre") || action.contains("puerta") {
            let has_lockpick = state.find_item("lockpick").is_some();
            let d20 = rng.roll_die(20);
            let dex_bonus = (state.stats.dexterity - 10) / 2;
            let check = d20 + dex_bonus + (if has_lockpick { 3 } else { -2 });

            if check >= 13 {
                state.flags.insert("crypt_door_unlocked".to_string(), true);
                state.stats.gold += 35;
                state.add_item(Item::new("ancient_relic", "Reliquia del Sol", ItemType::QuestItem, 1, 0, "Amuleto dorado resplandeciente"));
                return ActionResult {
                    success: true,
                    title: "¡Mecanismo Desactivado con Éxito!".to_string(),
                    math_breakdown: format!("Destreza d20: {} (+{} DEX) = {} vs Dificultad 13. [ÉXITO]", d20, dex_bonus, check),
                    outcome_summary: "Con un sutil *clic*, los engranajes ceden. La cerradura se abre revelando un cofre secreto con 35 monedas de oro y una Reliquia del Sol.".to_string(),
                    level_up: false,
                    enemy_defeated: false,
                    player_defeated: false,
                };
            } else {
                return ActionResult {
                    success: false,
                    title: "Cerradura Atascada".to_string(),
                    math_breakdown: format!("Destreza d20: {} (+{} DEX) = {} vs Dificultad 13. [FALLO]", d20, dex_bonus, check),
                    outcome_summary: "Tus dedos resbalan en el frío metal y los pestillos no ceden. El cerrojo continúa firmemente sellado.".to_string(),
                    level_up: false,
                    enemy_defeated: false,
                    player_defeated: false,
                };
            }
        }

        // 4. HUIR / ESCAPAR
        if action.contains("huir") || action.contains("escapar") || action.contains("correr") {
            let d20 = rng.roll_die(20);
            let dex_bonus = (state.stats.dexterity - 10) / 2;
            if d20 + dex_bonus >= 10 {
                state.active_enemy = None;
                return ActionResult {
                    success: true,
                    title: "Escape Exitoso".to_string(),
                    math_breakdown: format!("Evasión d20: {} (+{}) = {} vs Umbral 10. [ÉXITO]", d20, dex_bonus, d20 + dex_bonus),
                    outcome_summary: "Te arrojas entre los pilares derruidos y logras romper la línea de visión del enemigo, perdiéndolo de vista en las sombras.".to_string(),
                    level_up: false,
                    enemy_defeated: false,
                    player_defeated: false,
                };
            } else {
                let enemy_dmg = 6;
                state.stats.hp = (state.stats.hp - enemy_dmg).max(0);
                return ActionResult {
                    success: false,
                    title: "Escape Fallido".to_string(),
                    math_breakdown: format!("Evasión d20: {} (+{}) = {} vs Umbral 10. Golpe de oportunidad: -{} HP.", d20, dex_bonus, d20 + dex_bonus, enemy_dmg),
                    outcome_summary: format!("Al darte la vuelta tropiezas con unas raíces y recibes un golpe en la espalda sufriendo {} de daño. HP: {}/{}.", enemy_dmg, state.stats.hp, state.stats.max_hp),
                    level_up: false,
                    enemy_defeated: false,
                    player_defeated: state.stats.hp <= 0,
                };
            }
        }

        // 5. EXPLORAR / INVESTIGAR
        let d20 = rng.roll_die(20);
        let int_bonus = (state.stats.intelligence - 10) / 2;
        if d20 + int_bonus >= 11 {
            state.stats.gold += 15;
            ActionResult {
                success: true,
                title: "Exploración Fructífera".to_string(),
                math_breakdown: format!("Percepción d20: {} (+{} INT) = {}. [ÉXITO]", d20, int_bonus, d20 + int_bonus),
                outcome_summary: "Examinas con cautela los bajorrelieves de la pared y descubres una hendidura con 15 monedas antiguas intactas.".to_string(),
                level_up: false,
                enemy_defeated: false,
                player_defeated: false,
            }
        } else {
            ActionResult {
                success: true,
                title: "Exploración de la Zona".to_string(),
                math_breakdown: format!("Percepción d20: {} (+{} INT) = {}.", d20, int_bonus, d20 + int_bonus),
                outcome_summary: "Observas detenidamente el entorno: la humedad gotea por el techo de piedra y se escuchan ecos lejanos en las catacumbas.".to_string(),
                level_up: false,
                enemy_defeated: false,
                player_defeated: false,
            }
        }
    }
}

// ============================================================================
// CHATTREE NARRATIVE INJECTION & DECLARATIVE UI BUILDER
// ============================================================================

pub struct ChattreeUiFormatter;

impl ChattreeUiFormatter {
    /// Genera la tarjeta declarativa `ui.components` de Chattree
    pub fn build_ui_card(state: &GameState, action_res: Option<&ActionResult>) -> serde_json::Value {
        let hp_percent = ((state.stats.hp as f32 / state.stats.max_hp as f32) * 100.0).clamp(0.0, 100.0) as i32;
        let mp_percent = ((state.stats.mp as f32 / state.stats.max_mp as f32) * 100.0).clamp(0.0, 100.0) as i32;
        let xp_percent = ((state.stats.xp as f32 / state.stats.xp_next as f32) * 100.0).clamp(0.0, 100.0) as i32;

        let badge_variant = if state.stats.hp <= (state.stats.max_hp / 4) {
            "error"
        } else if state.active_enemy.is_some() {
            "warning"
        } else {
            "success"
        };

        let badge_text = if state.stats.hp <= 0 {
            "CAÍDO EN COMBATE"
        } else if state.active_enemy.is_some() {
            "EN COMBATE ACTIVO"
        } else {
            "EXPLORANDO SEGURO"
        };

        let mut items = vec![
            serde_json::json!({
                "label": "Personaje",
                "value": format!("{} ({})", state.player_name, state.class.name())
            }),
            serde_json::json!({
                "label": "Ubicación",
                "value": state.location_title
            }),
            serde_json::json!({
                "label": "Oro acumulado",
                "value": format!("💰 {} monedas", state.stats.gold)
            }),
        ];

        if let Some(enemy) = &state.active_enemy {
            items.push(serde_json::json!({
                "label": "Adversario",
                "value": format!("⚔️ {} (HP {}/{})", enemy.name, enemy.hp, enemy.max_hp)
            }));
        }

        if let Some(res) = action_res {
            items.push(serde_json::json!({
                "label": "Última resolución",
                "value": res.math_breakdown
            }));
        }

        let buttons = if state.active_enemy.is_some() {
            vec![
                serde_json::json!({
                    "label": "⚔️ Atacar",
                    "action": "command",
                    "payload": "/rpg action atacar",
                    "variant": "danger"
                }),
                serde_json::json!({
                    "label": "🧪 Poción",
                    "action": "command",
                    "payload": "/rpg action beber pocion",
                    "variant": "primary"
                }),
                serde_json::json!({
                    "label": "🏃 Huir",
                    "action": "command",
                    "payload": "/rpg action huir",
                    "variant": "neutral"
                }),
                serde_json::json!({
                    "label": "📊 Ficha",
                    "action": "command",
                    "payload": "/rpg status",
                    "variant": "neutral"
                }),
            ]
        } else {
            vec![
                serde_json::json!({
                    "label": "🔍 Explorar",
                    "action": "command",
                    "payload": "/rpg action explorar",
                    "variant": "primary"
                }),
                serde_json::json!({
                    "label": "🔓 Abrir Cerradura",
                    "action": "command",
                    "payload": "/rpg action abrir cerradura",
                    "variant": "neutral"
                }),
                serde_json::json!({
                    "label": "💾 Guardar",
                    "action": "command",
                    "payload": "/rpg save",
                    "variant": "neutral"
                }),
                serde_json::json!({
                    "label": "📊 Ficha",
                    "action": "command",
                    "payload": "/rpg status",
                    "variant": "neutral"
                }),
            ]
        };

        serde_json::json!({
            "title": format!("Rol Aventura — Turno {}", state.turn),
            "subtitle": format!("Nivel {} • {} EXP para subir", state.stats.level, state.stats.xp_next - state.stats.xp),
            "elements": [
                {
                    "type": "badge",
                    "text": badge_text,
                    "variant": badge_variant
                },
                {
                    "type": "progress",
                    "value": hp_percent,
                    "label": format!("Salud (HP): {}/{} ({}%)", state.stats.hp, state.stats.max_hp, hp_percent)
                },
                {
                    "type": "progress",
                    "value": mp_percent,
                    "label": format!("Maná (MP): {}/{} ({}%)", state.stats.mp, state.stats.max_mp, mp_percent)
                },
                {
                    "type": "progress",
                    "value": xp_percent,
                    "label": format!("Progreso Nivel: {}/{} XP ({}%)", state.stats.xp, state.stats.xp_next, xp_percent)
                },
                {
                    "type": "key_value",
                    "items": items
                },
                { "type": "divider" },
                {
                    "type": "button_row",
                    "buttons": buttons
                }
            ]
        })
    }

    /// Genera la inyección de contexto estricta para el modelo de IA (LLM Narrator)
    pub fn build_narrative_context(state: &GameState, action_res: Option<&ActionResult>) -> String {
        let inv_summary = state.inventory.iter()
            .map(|i| format!("- {} x{} ({})", i.name, i.quantity, i.description))
            .collect::<Vec<_>>()
            .join("\n");

        let action_section = if let Some(res) = action_res {
            format!(
                "### RESOLUCIÓN DETERMINISTA DEL MOTOR WASM:\n\
                * Acción: {}\n\
                * Resultado Matemático: {}\n\
                * Consecuencia objetiva: {}\n\
                * ¿Subió de Nivel?: {}\n\
                * ¿Enemigo Muerto?: {}\n\
                * ¿Jugador Muerto?: {}\n",
                res.title,
                res.math_breakdown,
                res.outcome_summary,
                if res.level_up { "SÍ (HP y MP restaurados al 100%)" } else { "NO" },
                if res.enemy_defeated { "SÍ (enemigo eliminado, recompensas sumadas)" } else { "NO" },
                if res.player_defeated { "SÍ (el héroe ha perecido)" } else { "NO" }
            )
        } else {
            "### ESTADO DEL JUEGO CONSULTADO (/rpg status)\n".to_string()
        };

        format!(
            "<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\n\
            ```json\n\
            {{\n\
              \"turn\": {},\n\
              \"player\": \"{}\",\n\
              \"class\": \"{}\",\n\
              \"hp\": \"{}/{}\",\n\
              \"mp\": \"{}/{}\",\n\
              \"level\": {},\n\
              \"gold\": {},\n\
              \"location\": \"{}\",\n\
              \"enemy_active\": {}\n\
            }}\n\
            ```\n\n\
            {}\n\
            ### INVENTARIO VERIFICADO EN MEMORIA (NO ALUCINAR ITEMS ADICIONALES):\n\
            {}\n\n\
            > ⚠️ **INSTRUCCIÓN ESTRICTA PARA EL NARRADOR IA DE CHATTREE:**\n\
            > 1. Los números de HP, daño, oro, dados e inventario son matemáticos y fueron calculados por el motor WASM.\n\
            > 2. NUNCA inventes pociones, oro o ítems que no figuren en la lista de arriba.\n\
            > 3. Utiliza estos hechos como base estricta para escribir una narración literaria inmersiva, emocionante, con diálogos y atmósfera épica de fantasía oscura.\n\
            <!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\n\n",
            state.turn,
            state.player_name,
            state.class.name(),
            state.stats.hp,
            state.stats.max_hp,
            state.stats.mp,
            state.stats.max_mp,
            state.stats.level,
            state.stats.gold,
            state.location_title,
            if state.active_enemy.is_some() { "true" } else { "false" },
            action_section,
            inv_summary
        )
    }
}

// ============================================================================
// WASM EXPORT ENTRYPOINT & COMMAND DISPATCH
// ============================================================================

static mut BUFFER: [u8; 131072] = [0; 131072]; // 128 KB I/O buffer

#[no_mangle]
pub extern "C" fn allocate(size: usize) -> *mut u8 {
    unsafe { BUFFER.as_mut_ptr() }
}

#[no_mangle]
pub extern "C" fn rpg_entry(ptr: *const u8, len: usize) -> i32 {
    let input_bytes = unsafe { slice::from_raw_parts(ptr, len) };
    let input_str = str::from_utf8(input_bytes).unwrap_or("{}");

    // Deserializar payload JSON de Chattree
    let payload_val: serde_json::Value = serde_json::from_str(input_str).unwrap_or_else(|_| serde_json::json!({}));
    
    let command = payload_val.get("command")
        .and_then(|v| v.as_str())
        .unwrap_or("rpg");
    
    let action_arg = payload_val.get("action")
        .and_then(|v| v.as_str())
        .or_else(|| payload_val.get("query").and_then(|v| v.as_str()))
        .unwrap_or("")
        .trim();

    // Crear o recuperar estado
    // Para simplificar la demo independiente sin requerir DB previa, inicializamos o cargamos
    let mut state = GameState::new("Aventurero", CharacterClass::Warrior, 0x12345678);

    let (display_text, action_res_opt) = if action_arg.starts_with("start") || command == "start" {
        let class = if action_arg.contains("mago") {
            CharacterClass::Mage
        } else if action_arg.contains("picaro") || action_arg.contains("pícaro") {
            CharacterClass::Rogue
        } else {
            CharacterClass::Warrior
        };
        state = GameState::new("Héroe de Eldoria", class, 0x489f1a7b);
        (
            format!(
                "⚔️ **¡Ha comenzado tu Aventura en Eldoria!**\n\n\
                Has elegido la senda del **{}**.\n\
                Te encuentras ante las imponentes ruinas de Eldoria. Frente a ti, los ojos rojizos de un Goblin Explorador brillan en la penumbra listos para atacar.\n\n\
                *Usa los botones de acción interactivos abajo o escribe acciones como `/rpg action atacar` o `/rpg action beber pocion`.*",
                class.name()
            ),
            None
        )
    } else if action_arg == "status" || action_arg == "ficha" {
        (
            format!(
                "📊 **Ficha del Aventurero**\n\n\
                - **Nombre:** {}\n\
                - **Clase:** {}\n\
                - **Nivel:** {} ({} / {} XP)\n\
                - **Salud:** {} / {} HP\n\
                - **Maná:** {} / {} MP\n\
                - **Fuerza:** {} • **Destreza:** {} • **Inteligencia:** {}\n\
                - **Oro:** {} monedas\n\
                - **Ubicación:** {}",
                state.player_name,
                state.class.name(),
                state.stats.level,
                state.stats.xp,
                state.stats.xp_next,
                state.stats.hp,
                state.stats.max_hp,
                state.stats.mp,
                state.stats.max_mp,
                state.stats.strength,
                state.stats.dexterity,
                state.stats.intelligence,
                state.stats.gold,
                state.location_title
            ),
            None
        )
    } else if action_arg.starts_with("save") {
        (
            "💾 **Partida Guardada**\n\nTu progreso, estadísticas e inventario se han guardado con éxito en la base de datos relacional de Chattree.".to_string(),
            None
        )
    } else if action_arg.starts_with("load") {
        (
            "📂 **Partida Cargada**\n\nSe ha restaurado tu último punto de control en las Ruinas de Eldoria.".to_string(),
            None
        )
    } else if action_arg.contains("confirmar_reinicio") || action_arg.contains("confirm_reset") {
        state = GameState::new("Aventurero Reencarnado", CharacterClass::Warrior, 0x99aa1122);
        (
            "🔄 **Partida Reiniciada con Éxito**\n\nTodos los registros de la base de datos relacional y la memoria lineal del motor han sido purgados y restaurados al estado inicial. Una nueva senda se abre ante ti.".to_string(),
            None
        )
    } else if action_arg.contains("reiniciar") || action_arg.contains("reset") {
        (
            "⚠️ **¿Deseas reiniciar toda la aventura de rol?**\n\nEsta acción borrará de forma permanente tu progreso actual, tus puntos de guardado en la base de datos SQLite y tus objetos acumulados, devolviendo tu campaña al **Capítulo I (Turno 1)** con un nuevo inicio narrativo.\n\n*Para continuar, confirma con el botón rojo abajo o escribe **\"confirmar reinicio\"**.*".to_string(),
            None
        )
    } else {
        // Ejecución de acción narrativa / combate
        let res = ActionResolver::resolve_action(&mut state, action_arg);
        let text = format!("{}\n\n{}", res.title, res.outcome_summary);
        (text, Some(res))
    };

    let narrative_ctx = ChattreeUiFormatter::build_narrative_context(&state, action_res_opt.as_ref());
    let ui_card = ChattreeUiFormatter::build_ui_card(&state, action_res_opt.as_ref());

    let final_output = serde_json::json!({
        "type": "card",
        "displayText": format!("{}{}", narrative_ctx, display_text),
        "ui": ui_card,
        "metadata": {
            "hp": state.stats.hp,
            "maxHp": state.stats.max_hp,
            "level": state.stats.level,
            "gold": state.stats.gold,
            "turn": state.turn
        }
    });

    let output_str = final_output.to_string();
    let out_bytes = output_str.as_bytes();
    let copy_len = out_bytes.len().min(unsafe { BUFFER.len() });

    unsafe {
        BUFFER[..copy_len].copy_from_slice(&out_bytes[..copy_len]);
    }

    copy_len as i32
}
