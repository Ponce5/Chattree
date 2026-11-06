# Chattree Text RPG Simulator (`com.chattree.official.rpg`)

Official **Text RPG Simulator and Deterministic Adventure Engine** for **Chattree**, compiled to native WebAssembly (`WASM`) with **Declarative Interactive UI Cards (`ui.components`)** and **SQLite Private Persistence (`database.sql`)**.

---

## 🎮 Características Principales

1. **Memoria Lineal WASM Determinista (`GameState`):**
   - Gestión estricta de Atributos (HP, Maná, Nivel, EXP, Oro, STR, DEX, INT).
   - Inventario verificado sin alucinaciones (pociones, armas, escudos, ganzúas).
   - Motor RNG determinista para tiradas de dados d20, pifias (1) y críticos (20).

2. **Componentes Visuales Interactivos (`ui.components`):**
   - Badges de combate y estado.
   - Barras de progreso visuales de HP, MP y progreso de nivel.
   - Tablas clave-valor con estadísticas y adversarios.
   - Botones táctiles interactivos en el chat para atacar, curarse, huir o explorar.

3. **Inyección Contextual para el Narrador LLM:**
   - Entrega bloques técnicos `[CHATTREE_RPG_ENGINE_CONTEXT]` para que la IA actúe como un Narrador literario épico sin alterar las cifras matemáticas de vida o inventario.

4. **Persistencia SQLite (`database.sql`):**
   - Guarda y restaura partidas con `/rpg save` y `/rpg load`.

---

## ⚡ Comandos Disponibles

| Comando | Descripción |
|---|---|
| `/rpg start [guerrero\|mago\|picaro]` | Inicia una aventura eligiendo clase de personaje. |
| `/rpg status` | Despliega la ficha técnica, atributos e inventario. |
| `/rpg action <accion>` | Ejecuta acciones como atacar, beber poción, abrir cerrojo, huir o explorar. |
| `/rpg save` | Guarda la partida en SQLite. |
| `/rpg load` | Restaura el último punto de guardado. |

---

## 🛠️ Compilación desde Rust (Opcional)

Si deseas compilar desde el código fuente Rust incluido en `src/lib.rs`:

```bash
# Añadir target WASM
rustup target add wasm32-unknown-unknown

# Compilar en modo release optimizado
cargo build --target wasm32-unknown-unknown --release

# O compilar directamente con wat2wasm
wat2wasm plugin.wat -o plugin.wasm
```
