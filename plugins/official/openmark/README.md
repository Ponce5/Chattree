# OpenMark Studio Plugin para Chattree

El plugin **OpenMark Studio** lleva la potencia de las presentaciones visuales y diapositivas de carrusel (1080x1080 px) impulsadas por Inteligencia Artificial directamente a tus conversaciones en **Chattree**.

---

## 🚀 Características

- **Generación Visual Instantánea**: Crea tarjetas visuales de alto impacto optimizadas para redes sociales (Instagram, LinkedIn, Twitter/X) y presentaciones ejecutivas.
- **Formato Canvas Cuadrado (1080x1080)**: Relación de aspecto 1:1 estándar para carruseles.
- **Diseño Code-First**: Inspirado en la filosofía OpenMark con estética Dark Mode, tipografía de alto contraste y gradientes de neón.
- **Integrado en el Sandbox WASM**: 100% seguro y compatible con el Marketplace de Chattree.

---

## 💻 Comandos

### 1. Crear una tarjeta / diapositiva de carrusel
```text
/openmark <tema o idea>
```
**Ejemplos:**
- `/openmark 3 Claves para el Exito Empresarial`
- `/openmark Inteligencia Artificial en 2026`
- `/openmark Habitos Diarios de Alto Rendimiento`

### 2. Aliases disponibles
Puedes utilizar cualquiera de los siguientes comandos cortos:
- `/om <tema>`
- `/slide <tema>`
- `/carousel <tema>`

---

## 📦 Especificaciones Técnicas

- **ID**: `com.chattree.official.openmark`
- **Versión**: `1.2.1`
- **Runtime**: WebAssembly (`wasm`)
- **Memoria máxima**: 4 páginas (256 KB)
- **Timeout**: 5000 ms
- **Capacidades**:
  - `canvas.render` (Renderizado visual interactivo y exportación a imagen PNG 1080×1080)
  - `network.http` (Fetch de activos y conectividad)
  - `storage.private` (Persistencia de configuraciones locales)
  - `share.text` (Compartir diapositivas generadas)

---

## 🛠️ Compilación y Empaquetado

```bash
# Compilar WAT a WASM
wat2wasm plugin.wat -o plugin.wasm

# Validar plugin
node ../../../tools/validate-plugin.mjs .

# Empaquetar para el Marketplace
node ../../../tools/package-plugin.mjs .
```
