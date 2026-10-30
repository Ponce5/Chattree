# Chattree Notion Workspace Integration

Plugin oficial para Chattree que integra la API v1 de Notion. Permite conectar tu espacio de trabajo para buscar páginas y bases de datos, consultar contenidos y crear nuevas páginas o notas rápidamente desde el chat.

## Capacidades requeridas
- `network.http`: Para realizar llamadas HTTPS autenticadas a la API oficial de Notion (`https://api.notion.com/v1/...`).
- `storage.private`: Para almacenar de forma segura y privada tu Internal Integration Secret de Notion en el sandbox local del dispositivo.

## Configuración

1. **Obtén tu clave de integración:**
   - Ve a [Notion Developers / My Integrations](https://www.notion.so/profile/integrations).
   - Haz clic en **+ New integration**.
   - Asigna un nombre (por ejemplo "Chattree") y selecciona tu espacio de trabajo.
   - Copia el **Internal Integration Secret** (comienza con `secret_` o `ntn_`).

2. **Comparte páginas con la integración:**
   - En Notion, abre las páginas o bases de datos que desees conectar.
   - Haz clic en el menú **'...'** (arriba a la derecha) -> **Conexiones** (Add connections) -> Selecciona tu integración.

3. **Registra tu token en Chattree:**
   ```
   /notion config <tu_integration_secret>
   ```

## Comandos y Uso

- **Verificar estado de conexión:**
  ```
  /notion status
  ```
  Comprueba que tu clave esté activa y conectada a la API de Notion.

- **Buscar páginas y bases de datos:**
  ```
  /notion search <término>
  ```
  Ejemplo: `/notion search proyectos` o `/notion search reuniones`

- **Listar páginas recientes:**
  ```
  /notion list
  ```
  Muestra las páginas editadas recientemente en tu espacio de trabajo.

- **Crear una nueva página:**
  ```
  /notion create <título de la página>
  ```
  Ejemplo: `/notion create Ideas para nueva funcionalidad`

- **Desconectar:**
  ```
  /notion disconnect
  ```
  Elimina el token de integración almacenado en tu dispositivo.

## Lenguaje Natural
También puedes invocar a Notion directamente en tus conversaciones con la IA de Chattree:
- *"Busca mis notas de proyectos en Notion"*
- *"Crea una página en Notion con el título Plan de Marketing"*

