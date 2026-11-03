# Chattree Notion Workspace Integration

Plugin oficial para Chattree que integra la API v1 de Notion con **soporte 100% basado en Lenguaje Natural e Inteligencia Artificial**. Permite conectar tu espacio de trabajo para que la IA redacte y cree páginas completas con contenido estructurado, busque información en tus notas y consulte actualizaciones recientes directamente desde el chat.

## Capacidades requeridas
- `network.http`: Para realizar llamadas HTTPS autenticadas a la API oficial de Notion (`https://api.notion.com/v1/...`).
- `storage.private`: Para almacenar de forma segura y privada tu Internal Integration Secret de Notion en el sandbox local del dispositivo.

## Configuración rápida

1. **Obtén tu clave de integración:**
   - Ve a [Notion Developers / My Integrations](https://www.notion.so/profile/integrations).
   - Haz clic en **+ New integration**, asigna un nombre (ej. `"Chattree"`) y selecciona tu espacio de trabajo.
   - Copia el **Internal Integration Secret** (`ntn_...` o `secret_...`).

2. **Comparte una página con tu integración en Notion:**
   - En Notion, abre la página donde quieras guardar tus notas o buscar información.
   - Haz clic en el menú **'...'** (arriba a la derecha) -> **Conexiones** (*Add connections*) -> Selecciona tu integración.

3. **Vincula tu token en Chattree usando lenguaje natural:**
   ```
   /notion configura mi token ntn_tu_integration_secret
   ```
   *(También puedes pegar directamente el token `ntn_...` o `secret_...` después de `/notion`).*

## Uso con Lenguaje Natural

Con **Notion Integration v1.2.0**, no necesitas recordar comandos rígidos ni palabras clave:

- **Crear páginas con contenido redactado por la IA:**
  - `/notion créame una página de ideas de app donde enliste las mejores ideas para este 2027`
  - `/notion crea una nota en Notion que explique qué es la fotosíntesis y sus etapas`
  - `/notion redacta un plan de estudio semanal de Flutter y guárdalo en Notion`
  *(La IA genera un título claro, desarrolla todo el artículo/lista con saltos de línea y bloques de párrafo reales en Notion, y te muestra la vista previa junto al enlace directo).*

- **Buscar páginas y notas:**
  - `/notion busca mis apuntes sobre arquitectura de software`
  - `/notion encuentra mis notas de la reunión de producto`

- **Ver páginas recientes:**
  - `/notion muéstrame mis páginas recientes de Notion`

- **Estado y administración de la cuenta:**
  - `/notion verifica el estado de mi conexión`
  - `/notion desconectar mi cuenta de Notion`
