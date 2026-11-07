# Chattree — Plugins y limitaciones actuales

> Documento de referencia basado en la documentación oficial y el código fuente actual del repositorio (`content/reference/` y `lib/`).
> Fecha de actualización: 6 de noviembre de 2026.
> Refleja todas las mejoras de arquitectura, auditorías de seguridad, capacidades y cuotas implementadas en el runtime.

---

## Índice

1. [Qué es un plugin y cómo funciona](#1-qué-es-un-plugin-y-cómo-funciona)
2. [Tipos de plugins útiles](#2-tipos-de-plugins-útiles)
3. [Plugins basados en el webhook entrante](#3-plugins-basados-en-el-webhook-entrante)
4. [Limitaciones de plataforma y hardware](#4-limitaciones-de-plataforma-y-hardware)
5. [Limitaciones del modelo de IA](#5-limitaciones-del-modelo-de-ia)
6. [Limitaciones de ejecución de plugins](#6-limitaciones-de-ejecución-de-plugins)
7. [Capacidades de IA, RAG e historial de chat (Ahora disponibles)](#7-capacidades-de-ia-rag-e-historial-de-chat-ahora-disponibles)
8. [Límites de datos por API](#8-límites-de-datos-por-api)
9. [Limitaciones de red y webhooks](#9-limitaciones-de-red-y-webhooks)
10. [Limitaciones de distribución y Marketplace](#10-limitaciones-de-distribución-y-marketplace)
11. [Limitaciones de interacción de la app](#11-limitaciones-de-interacción-de-la-app)
12. [Resumen: las 5 fronteras actuales del sandbox](#12-resumen-las-5-fronteras-actuales-del-sandbox)
13. [Viabilidad de plugins: qué sí y qué hay que rediseñar](#13-viabilidad-de-plugins-qué-sí-y-qué-hay-que-rediseñar)
14. [Inconsistencias resueltas y alineación de validadores](#14-inconsistencias-resueltas-y-alineación-de-validadores)

---

## 1. Qué es un plugin y cómo funciona

Un plugin de Chattree es un módulo **WebAssembly** empaquetado en un archivo `.chattree-plugin` (un ZIP con `plugin.json`, `plugin.wasm` y, opcionalmente, `icon.png`, `readme.md` y `license`/`license.txt`/`license.md`).

Registra uno o varios comandos tipo `/loquesea` en la paleta (cada herramienta en `tools[]` puede definir su propio `entrypoint` exportado o compartir el `entrypoint` principal recibiendo `"command"`, `"api"` y `"toolId"` en el payload JSON). Cuando el usuario los ejecuta:

1. Chattree carga el binario `.wasm`.
2. Llama a la función exportada declarada en `tools[].entrypoint` o `plugin.json`.
3. Intercepta las llamadas del WASM a la **Host API** (`chattree.host_call`).
4. Comprueba que el usuario haya concedido la *capability* correspondiente.
5. Devuelve el texto, Markdown o archivo generado al chat.

El plugin **no toca el sistema operativo directamente**: todo pasa por la Host API y el `PermissionGateway`. Esto define qué plugins son posibles: únicamente lo que permita una capability disponible.

---

## 2. Tipos de plugins útiles

### 2.1 `network.http` (+ `network.local`) — APIs REST externas y servicios LAN

Permite peticiones HTTP/HTTPS salientes (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS) a dominios públicos, y opcionalmente a la red local o `localhost` si el plugin declara y recibe la capability crítica `network.local`.

| Plugin | Uso real |
|---|---|
| **GitHub** | Ver issues/PRs asignados, estado de CI, releases; crear issues desde el chat |
| **Airtable / Notion / Supabase** | Consultar o crear registros, buscar páginas, CRUD genérico |
| **Slack / Discord** | Enviar mensajes a un canal, leer los últimos mensajes de un hilo |
| **Linear / Jira / Trello** | Tareas pendientes, crear ticket, mover tarjeta |
| **Clima (OpenWeather, Open-Meteo)** | Clima actual y pronóstico por ciudad |
| **Stripe / Shopify** | Ventas del día, estado de un pedido, último pago |
| **RSS / Hacker News / Reddit** | Titulares y resúmenes de novedades |
| **Traducción / diccionario** | Traducir o definir sin salir del chat |
| **Búsqueda web (Brave, Tavily, Serper)** | Dar contexto web fresco al modelo |
| **Ollama / LM Studio / Home Assistant LAN** | Conectar con servidores locales en casa usando `network.local` |

**Límites:** respuesta máxima 8 MB; cuerpo de petición máximo 4 MB; hasta **20 peticiones HTTP concurrentes** por plugin. Por defecto bloquea `localhost` e IPs privadas (SSRF), salvo que se conceda `network.local` (que habilita RFC 1918, `localhost` y `.local`/`.lan`/`.home`, manteniendo bloqueado `169.254.0.0/16`).

### 2.2 `email.*` — IMAP / SMTP

| Plugin | Uso |
|---|---|
| **Bandeja de entrada** | Resumen de correos no leídos |
| **Enviar correo** | Redactar y enviar un email desde el chat |
| **Newsletter / digest** | Recopilar y enviar un resumen periódico |

Las credenciales se guardan cifradas en el almacenamiento seguro del sistema.

### 2.3 `chattree.notes.*` + `storage.private` + `ai.embeddings` — notas y RAG local

| Plugin | Uso |
|---|---|
| **Notas rápidas** | `/nota comprar leche` con etiquetas |
| **Búsqueda semántica y RAG propio** | Generar embeddings, buscar en el índice vectorial e indexar documentos del plugin (`ai.embeddings`) |
| **Diario / journaling** | Entrada diaria con fecha automática |
| **Base de conocimiento** | Guardar snippets, comandos y recetas |
| **Memoria de proyecto** | Guardar decisiones y recuperarlas por proyecto |

`storage.private` es un key-value aislado por plugin (hasta **256 KB por valor**, **500 claves** y **2 MB en total**), útil para caché, tokens, estado y configuración.

### 2.4 `chattree.reminders.*` y `calendar.*` — recordatorios y agenda

| Plugin | Uso |
|---|---|
| **Recordatorios en lenguaje natural** | “Recuérdame llamar a Ana el viernes a las 10” |
| **Hábitos** | Recordatorios recurrentes con seguimiento |
| **Agenda** | Listar y crear eventos, ver “qué tengo hoy” |
| **Vencimientos** | Facturas, renovaciones, cumpleaños |

### 2.5 `contacts.*` — contactos

| Plugin | Uso |
|---|---|
| **Buscador de contactos** | “El teléfono de Marta” |
| **CRM ligero** | Notas y último contacto por persona |
| **Cumpleaños** | Detectar próximos cumpleaños y crear recordatorios |

### 2.6 `files.*` — archivos y documentos

| Plugin | Uso |
|---|---|
| **Leer PDF/TXT/MD** | Resumir un documento del dispositivo (hasta 8 MB) |
| **Exportar resultados** | Generar `.md`, `.csv` o `.txt` y devolverlo al chat |
| **Backup de notas** | Volcar notas a un archivo |
| **Procesar CSV** | Analizar datos de un archivo local |

Los plugins pueden generar archivos y devolverlos como adjuntos con acciones de Guardar y Compartir.

### 2.7 `camera.*` y `location.*` — hardware y sensores

| Plugin | Uso |
|---|---|
| **Escanear documento / OCR** | Foto → texto → resumen |
| **Leer QR / código de barras** | Precio, ticket, enlace |
| **Etiquetar fotos** | Descripción automática de una imagen |
| **Contexto por ubicación** | Clima local, “qué hay cerca” |

Son capacidades **critical**: requieren autorización explícita y permiso del sistema operativo.

### 2.8 `clipboard.*`, `share.*`, `open.*` — portapapeles y compartir

| Plugin | Uso |
|---|---|
| **Transformar portapapeles** | Limpiar formato, traducir, resumir lo copiado (`clipboard.read` / `clipboard.write`, hasta 100 KB) |
| **Compartir respuesta** | Enviar el resultado a otra app (`share.text` hasta 32,768 caracteres, `share.file`) |
| **Abrir enlace/mapa/app** | Abrir una URL, una dirección o una app |

### 2.9 `notifications.send` — avisos locales

| Plugin | Uso |
|---|---|
| **Avisos proactivos** | Notificar cuando algo cambia (precio, CI, correo) |
| **Resumen programado** | Notificación diaria con el digest |
| **Alertas de umbral** | “Avísame si la acción baja de X” |

Máximo **15 notificaciones por plugin por hora** (ventana deslizante de 60 minutos), con soporte para Android, iOS y macOS.

### 2.10 Plugins de razonamiento e IA (`ai.context`, `ai.embeddings`, `chat.history.read`)

| Plugin | Uso |
|---|---|
| **Resumidor de conversación** | Usa `chat.history.read` (últimos 20 mensajes) + `ai.context` para sintetizar acuerdos y tareas |
| **Investigador con RAG** | HTTP + `ai.embeddings` (`ai.index_document` / `ai.search`) + notas: busca, indexa y consulta fuentes |
| **Asistente de proyecto** | GitHub + notas + recordatorios: estado y próximos pasos |
| **Finanzas personales** | CSV + API bancaria + notificaciones |
| **Tutor / estudio** | Notas + calendario + repetición espaciada |

### 2.11 `network.websocket` — WebSockets bidireccionales en tiempo real

Permite flujos de datos bidireccionales en tiempo real con servidores externos o locales.

| Plugin | Uso |
|---|---|
| **Chats externos / mensajería** | Conexión directa a WhatsApp bridges, Telegram bot streams, Discord gateways |
| **Telemetría e IoT** | Lectura continua de sensores MQTT/WebSocket o Home Assistant |
| **Mercados financieros / cripto** | Precios de acciones y criptomonedas en tiempo real |
| **Colaboración en vivo** | Canvas interactivo, pizarras compartidas o salas colaborativas |

**Límites y garantías:** Hasta **10 sockets concurrentes** por plugin con reserva atómica previa al handshake para evitar condiciones de carrera en la cuota; tramas entrantes y salientes de hasta **16 MB** (el exceso cierra el socket limpiamente con código WebSocket 1009); buffer en memoria de **500 tramas**; y protección SSRF idéntica a HTTP (red local requiere `network.local`).

### 2.12 `ui.components` y `ui.render` — Componentes visuales interactivos

Permite emitir tarjetas declarativas interactivas enriquecidas directamente en la burbuja del chat.

| Plugin | Uso |
|---|---|
| **Métricas y monitorización** | Tablas de métricas clave-valor (hasta 40 ítems) para servidores o finanzas |
| **Barra de estado / progreso** | Seguimiento porcentual de despliegues, tareas o descargas (0–100%) |
| **Badges de estado** | Indicadores visuales de éxito, error, advertencia o información |
| **Acciones con botones** | Botones interactivos (`command`, `url`, `copy`) con hasta 8 botones por fila |

**Límites y seguridad:** Hasta **60 elementos por tarjeta**; sanitización global uniforme (`UiApiHandler.sanitizeUiCard`) para Host API y retornos WASM directos; y **modal de confirmación de seguridad** obligatorio antes de ejecutar botones con comandos sensibles o comandos que inicien con `/`.

### 2.13 `scheduler.task` y `scheduler.cron` — Tareas programadas y automatizaciones

Permite registrar ejecuciones recurrentes basadas en expresiones Cron estándar de 5 campos o intervalos periódicos.

| Plugin | Uso |
|---|---|
| **Resumen diario matutino** | Disparar un digest de tareas o noticias cada mañana (`0 8 * * *`) |
| **Sincronización periódica** | Chequeo de actualizaciones cada 15 o 30 minutos |
| **Limpieza periódica** | Purgado de registros temporales semanalmente (`0 0 * * 0`) |
| **Monitores de salud** | Verificación de disponibilidad de servicios críticos |

**Límites y garantías:** Cálculo exacto de reloj de pared (`calculateNextCronExecution`); intervalo mínimo estricto de **60 segundos** para protección contra agotamiento de batería; hasta **25 tareas activas** por plugin; payloads de hasta **128 KB**; y publicación de eventos mediante `HostEventBus` (`scheduler.trigger`).

### 2.14 `database.sql` y `storage.database` — Base de datos relacional SQLite privada

Proporciona una base de datos SQLite relacional privada y completamente aislada (`plugin_<pluginId>.db`).

| Plugin | Uso |
|---|---|
| **Gestores de inventario / CRM** | Consultas relacionales complejas con índices y claves foráneas |
| **Historial y logs estructurados** | Almacenamiento tabular de eventos, pedidos o mensajes |
| **Transacciones financieras/atómicas** | Operaciones ACID con rollback automático ante errores |
| **Caché relacional masiva** | Almacenar miles de registros estructurados con consultas rápidas (`SELECT ... WHERE`) |

**Límites y garantías:** Cuota de almacenamiento de **200 MB** (contabilizando `.db` + `-wal` + `-shm` + `-journal`); `PRAGMA busy_timeout = 5000`; despacho diferenciado para `SELECT`/`WITH`/`PRAGMA` vs mutaciones; hasta **2,000 filas por consulta**; normalización transparente de tipos (`bool` a 1/0, objetos a JSON); protección estricta contra escape del sandbox (`ATTACH`, `DETACH`, `VACUUM INTO`, `PRAGMA writable_schema` prohibidos); y eliminación total de archivos sin residuos al desinstalar.

### 2.15 `notifications.read`, `notifications.query`, `notifications.reply` y `notifications.action` — Hub de notificaciones del dispositivo

Permite a los plugins autorizados escuchar notificaciones entrantes del sistema Android (`NotificationListenerService`), consultar notificaciones activas, responder en línea mediante `RemoteInput` y descartar notificaciones:

| Plugin | Uso |
|---|---|
| **Auto-respuesta inteligente (WhatsApp / Telegram)** | Escucha notificaciones entrantes (`notifications.read`) y envía respuestas directas (`notifications.reply`) |
| **Resumen y triaje de alertas** | Consulta las notificaciones activas (`notifications.query`), las clasifica en SQLite privado y limpia las irrelevantes (`notifications.action`) |
| **Puente de mensajería a notas/recordatorios** | Convierte alertas importantes de otras apps en notas o recordatorios de Chattree |

**Límites y garantías:** Filtrado nativo estricto de códigos OTP/2FA y alertas bancarias en Kotlin antes de cruzar a Flutter; cero persistencia en la base de datos central de Chattree; caché efímera en memoria (`LruCache` de 500 entradas) para `PendingIntent`/`RemoteInput`; `logicalId` libre de colisiones (`${packageName}_${sbn.id}_${sbn.tag}`); emisión tanto de llegada (`device.notification.received`) como de descarte (`device.notification.removed`); debounce de **200 ms** por hilo; y límite de **4,000 caracteres** en respuestas para proteger el Binder IPC de Android.

---

## 3. Plugins basados en el webhook entrante

Chattree levanta un **servidor HTTP en primer plano** (`127.0.0.1` por defecto, o `0.0.0.0` en red local LAN/Wi-Fi si el usuario activa la opción en los ajustes del plugin; puerto **8765** por defecto). Cualquier herramienta del mismo dispositivo —o de la misma red local Wi-Fi si se habilita el modo LAN— puede hacer `POST /plugins/<pluginId>/<ruta>` y disparar código del plugin.

- **Autenticación:** Bearer token o HMAC-SHA256 (`X-Chattree-Signature-256` y `X-Chattree-Delivery-Id`).
- **Protección:** comparación en tiempo constante, throttling, rate limiting, deduplicación por idempotencia y journal persistente en SQLite.
- **Declaración:** el plugin necesita `network.webhook_inbound` y registra `inboundWebhooks` / `eventConsumers`.
- **Al recibir un evento:** Chattree invoca la función exportada del plugin; este puede crear una nota, programar un recordatorio, lanzar una notificación o actualizar el contexto conversacional.

### Ideas de plugins con webhook

| Plugin | Qué hace al recibir el evento |
|---|---|
| **Alertas de CI/CD** | GitHub Actions / GitLab avisa “build falló” → notificación + nota con el log resumido |
| **Monitor de casa (Home Assistant)** | Sensor de puerta o temperatura en la LAN → notificación o recordatorio |
| **Cron / tareas programadas** | Un script local o en un PC de la LAN dispara “genera el resumen diario” |
| **Ingesta de formularios** | Typeform / Google Forms / issue de GitHub → nota o tarea |
| **Notificaciones de pedidos** | Shopify / Stripe → “nuevo pedido” en el chat |
| **IoT / ESP32 / Raspberry Pi** | Botón físico o sensor en la misma Wi-Fi → nota, recordatorio o comando |
| **Puente entre apps** | Cualquier app de escritorio en la LAN o en el móvil puede hablar con Chattree |
| **Log de actividad** | Scripts que registran eventos → el plugin los acumula y resume |
| **Sincronización push local** | Un servicio del dispositivo o de la LAN empuja datos sin polling |
| **Automatización personal** | Atajo de teclado o script → inserta texto o lanza un comando |
| **Webhooks de pago** | Stripe / Gumroad → aviso de cobro o cancelación |
| **Alertas de precio** | Scraper local → webhook cuando baja el precio |

**Combinación potente:** el webhook **entra** datos (desde el dispositivo o la LAN) y `network.http` / `network.local` **sale** a consultar APIs.

---

## 4. Limitaciones de plataforma y hardware

| Limitación | Detalle |
|---|---|
| **Enfoque principal en Android** | La inferencia local GGUF (`llama_flutter_android`) está optimizada para Android (`arm64-v8a`). |
| **Android 10+ (API 29)** | Recomendado Android 13+. |
| **64 bits ARM** | `arm64-v8a` para inferencia local. |
| **RAM** | 3 GB mínimo usando IA en la nube; **6 GB mínimo para modelos locales**, 8–12 GB recomendado. |
| **Almacenamiento** | 500 MB para app y plugins; **4 GB+** si se usan modelos locales. |
| **Notificaciones** | `notifications.send` incluye configuración nativa para Android, iOS y macOS (`DarwinInitializationSettings`). |
| **Funciones dependientes del SO** | Cámara, GPS, contactos y calendario fallan si el permiso de Android/iOS está denegado, aunque el plugin tenga la capability. |

---

## 5. Limitaciones del modelo de IA

- **Los modelos locales dependen del hardware.** El catálogo muestra tamaño, cuantización y RAM estimada; la velocidad real varía por dispositivo.
- **El modelo de embeddings es una descarga aparte** y no sustituye al modelo de chat. Sin él no hay búsqueda semántica en notas ni operaciones de `ai.embeddings`.
- **Límite de tokens de respuesta: 128 a 8,192.** Configurable desde Ajustes. `/visual` fuerza un mínimo de 4096 y desactiva el razonamiento (`<think>`).
- **Intérprete de intenciones híbrido:** `AiIntentInterpreter` utiliza el modelo local si está cargado y hace fallback automático al proveedor remoto activo (`RemoteInferenceEngine`) cuando se usa IA en la nube.
- **Ventana de contexto limitada** por el modelo; si el prompt crece demasiado, el proveedor devuelve `contextTooLarge`.
- **RAG cubre notas y documentos indexados por plugins (`ai.embeddings`)**, almacenados localmente en SQLite + caché vectorial en memoria.
- **Proveedores externos: cuatro integrados** — OpenAI, Google Gemini, Anthropic Claude y OpenRouter. Requieren clave propia e internet.
- **No hay proxy de Chattree**: las peticiones van directas del móvil al proveedor, que aplica sus propias políticas de retención.
- **Sin inferencia en segundo plano**: no hay un agente que siga pensando o ejecutando tareas cuando se cierra la app.

---

## 6. Limitaciones de ejecución de plugins

El sandbox es estricto pero cuenta con cuotas amplias para flujos reales:

| Recurso | Límite |
|---|---|
| Timeout por llamada | **5 s por defecto**, configurable hasta **60 s (`60000` ms)** en `plugin.json` |
| Fuel de CPU | **50 000 000 instrucciones** |
| Memoria WASM | **32 MB por defecto**, máximo **64 MB** (`maxMemoryPages` hasta 1024 páginas) |
| Buffer ABI v1 | **1 024 bytes** por defecto (ampliable con `outputOffset`) |
| Payload ABI v2 | **12 MB por defecto**, máximo **16 MB** (`maxPayloadSizeBytes`) |
| Iteraciones asíncronas | **50** round-trips al Host API por invocación |
| Peticiones HTTP concurrentes | **20 por plugin** |
| Caché de módulos | **8 módulos** (LRU) |
| Hilos / procesos | **Prohibidos** |
| Ejecución en segundo plano | **Prohibida** |

### Lo que un plugin NO puede hacer

- Leer rutas reales del sistema de archivos, SQLite, SharedPreferences o abrir sockets TCP crudos.
- Ver datos privados de otros plugins.
- Leer el historial ilimitado de todas las conversaciones (`chat.history.read` está acotado a los últimos 20 mensajes de la conversación activa).
- Lanzar bucles recursivos de herramientas desde `ai.context` (la inferencia para plugins es estrictamente de un solo turno y máximo 2,048 tokens).
- Acceder al heap de Dart o a objetos nativos.
- Crear hilos, procesos, demonios o servicios persistentes.
- Guardar datos sin `storage.private`.
- Ejecutarse indefinidamente o consumir CPU/memoria sin límite.
- Usar `file://`, `javascript:`, `intent:`, `content://`, `data:` o `blob:`.

### Otras características y límites de ejecución

- **Soporte completo para múltiples comandos por plugin:** Cada herramienta en `tools[]` puede declarar su propio `entrypoint` WASM opcional, o compartir el `entrypoint` del manifiesto recibiendo `"command"`, `"api"` y `"toolId"` en el payload de entrada.
- **Invocación por lenguaje natural (`intentContract`):** Funciona tanto con modelos GGUF locales como con proveedores remotos activos, aunque el slash command (`/comando`) sigue siendo la vía determinista principal.
- **La salida es texto, Markdown o archivos.** No hay API para crear widgets nativos arbitrarios fuera de las tarjetas de Markdown y archivos de Chattree.
- **Los handles de archivo son efímeros** y solo válidos para el plugin que los creó, en la misma sesión.
- **Los plugins importados empiezan con cero permisos sensibles/críticos**, aunque usen prefijos `com.chattree.*`.

---

## 7. Capacidades de IA, RAG e historial de chat (Ahora disponibles)

Las tres capacidades que anteriormente estaban en preparación ahora están **100% enrutadas y operativas** en el runtime WASM:

| Capability | Operaciones Host API | Límites de seguridad |
|---|---|---|
| `chat.history.read` | `chattree.context.history` / `messages` | Hasta **20 mensajes recientes** de la conversación activa (máx. 4,000 caracteres por mensaje; vacío en modo restringido). |
| `ai.context` | `ai.complete` / `generate` / `prompt` | Inferencia de un solo turno (prompt máx. 16,000 chars, salida máx. **2,048 tokens**) usando el motor local o remoto activo. |
| `ai.embeddings` | `ai.embed`, `ai.search`, `ai.index_document`, `ai.remove_document` | Texto máx. 50,000 chars; `topK` hasta 20; documentos aislados con prefijo `plugin_<pluginId>_<id>`. |

### Capacidades de hardware/SO que no existen por diseño

No existen capabilities para: SMS directo por telefonía celular, llamadas directas sin pasar por el marcador, Bluetooth, NFC, micrófono/grabación de audio, grabación de vídeo, captura de pantalla, sensores continuos (acelerómetro, podómetro), geofencing o seguimiento continuo de ubicación en segundo plano. (La lectura e interacción con notificaciones de otras apps sí está disponible de forma segura mediante `notifications.read`, `notifications.query`, `notifications.reply` y `notifications.action` con filtrado nativo de OTP/2FA).

---

## 8. Límites de datos por API

| API | Límite |
|---|---|
| `storage.private` | Clave 256 caracteres; valor **256 KB** (`262,144` bytes); **500 claves**; **2 MB** (`2,097,152` bytes) total por plugin |
| Notas | Título 300 caracteres; contenido **50 000** caracteres; búsqueda **100 resultados**; query truncada a 300 |
| Recordatorios | Título 300 caracteres |
| Contactos | **50 contactos por llamada**; lectura, creación y actualización |
| Archivos | Lectura y escritura hasta **8 MB** con handles opacos (soportado sin truncamiento por el payload ABI v2 de **12 MB** por defecto) |
| Portapapeles (`clipboard.*`) | **100 KB** (`102,400` caracteres) por lectura (`clipboard.read`) o escritura (`clipboard.write`) |
| Compartir texto (`share.text`) | **32 768 caracteres (32 KB)** |
| Notificaciones | Título 100, cuerpo 500; **15 notificaciones por plugin por hora** (ventana deslizante) |
| Historial (`chat.history.read`) | Últimos **20 mensajes** (4,000 caracteres máx. por mensaje) |
| Inferencia (`ai.context`) | Prompt **16 000 caracteres**, sistema 4 000 caracteres, salida **2 048 tokens** |
| Embeddings (`ai.embeddings`) | Texto/documento **50 000 caracteres**, `topK` máximo **20** |
| WebSockets (`network.websocket`) | Hasta **10 sockets concurrentes** por plugin con reserva atómica; tramas de hasta **16 MB** (código 1009 al exceder); buffer de **500 tramas** |
| Componentes Visuales (`ui.components`) | Hasta **60 elementos por tarjeta**; hasta **40 pares clave-valor**; hasta **8 botones por fila**; confirmación modal en comandos `/` |
| Tareas Programadas (`scheduler.task`) | Intervalo mínimo de **60 segundos** (anti-battery drain); hasta **25 tareas activas** por plugin; payload de **128 KB** |
| Base de Datos Relacional (`database.sql`) | SQLite privado (`plugin_<pluginId>.db`); cuota de **200 MB** (`.db` + `-wal` + `-shm` + `-journal`); hasta **2,000 filas por consulta**; transacciones atómicas |
| Cámara | Una sola foto; sin vídeo ni vista previa en vivo |
| Ubicación | One-shot, timeout 15 s; no se comparte entre plugins |

---

## 9. Limitaciones de red y webhooks

### 9.1 Red saliente (`network.http`, `network.websocket` y `network.local`)

- Protocolos soportados: `http` y `https` (`network.http`), y WebSockets en tiempo real bidireccionales `ws` y `wss` (`network.websocket`). No se permiten sockets TCP crudos sin encapsular directos al sistema operativo.
- **Protección SSRF por defecto (`network.http` y `network.websocket`):** bloquea `localhost`, `127.0.0.1`, rangos privados RFC 1918 (`10.x`, `172.16–31.x`, `192.168.x`), link-local y DNS rebinding.
- **Acceso a red local con permiso crítico (`network.local`):** si el plugin declara `network.local` y el usuario lo autoriza, se permiten peticiones a rangos privados LAN (`10.x`, `172.16–31.x`, `192.168.x`), IPv6 ULA (`fc00::/7`), `localhost`/`127.0.0.1` y dominios `.local`/`.lan`/`.home`. Los endpoints de metadatos cloud (`169.254.0.0/16`) siguen siempre bloqueados.
- Cuerpo de petición **4 MB**; respuesta **8 MB**; hasta **20 peticiones concurrentes** por plugin.
- Timeout por defecto 30 s, máximo 60 s.

### 9.2 Webhooks entrantes (Servidor Local y Relay Cloud 24/7)

- **Loopback por defecto (`127.0.0.1` / `::1`) + Modo LAN opcional (`0.0.0.0`):** desde **Ajustes → Webhooks entrantes** (o en **Ajustes → Plugins → [Plugin] → Webhooks Entrantes**), el usuario puede activar **Permitir dispositivos en red local (LAN)** para aceptar conexiones desde otros equipos o dispositivos IoT en la misma red Wi-Fi/LAN (incluyendo RFC 1918 e IPv6 ULA `fc00::/7`).
- **Despacho inmediato y ruta diagnóstica local (`/plugins/system/test`):** las entregas locales `2xx` disparan inmediatamente `EventRuntime.instance.processDueDeliveries()` y soportan pruebas autenticadas en `/plugins/system/test`.
- **Relay en la nube 24/7 (`FcmInboundRelayService` + Cloudflare Worker):** permite recibir webhooks con la app cerrada vía Google FCM HTTP v1. El Worker valida que el tamaño total en bytes UTF-8 (`path` + `body` + `headers`) no supere `MAX_DATA_BYTES = 3800` antes de invocar a FCM (devolviendo `413 payload_too_large` si excede el límite). Al abrir la app, `drainPendingInbox()` procesa la cola con bloqueo de concurrencia (`_drainInFlight`), prioriza la resolución de plugins instalados sobre rutas de diagnóstico y limita los reintentos de rutas inexistentes a `kFcmMaxInboxRetries = 3`.
- **Servidor local solo en primer plano:** al minimizar la app se pausa el socket TCP local y se reanuda automáticamente al volver a abrir Chattree.
- **Un solo listener local global**, puerto configurable (por defecto 8765).
- Autenticación **Bearer o HMAC-SHA256** (codificación UTF-8 completa y comparación en tiempo constante) con secretos rotables y deduplicación por `X-Chattree-Delivery-Id` en SQLite.

---

## 10. Limitaciones de distribución, importación local y Marketplace

| Límite | Valor (Alineado en App, CLI y Web) |
|---|---|
| Importación en la app (comprimido) | **25 MB** |
| Contenido descomprimido | **50 MB** |
| Entradas del ZIP | **50** |
| Envío al Marketplace | **25 MB** |
| Archivos raíz permitidos | `plugin.json`, `plugin.wasm`, `icon.png`, `readme.md`, `license`, `license.txt`, `license.md` |
| Versiones de esquema (`schemaVersion`) | `1` y `2` en App, CLI y Web |
| Rate limit de envíos | **5 por hora por IP** |

### Reglas de importación local, actualización in-situ y publicación

- **Actualización y reinstalación in-situ (`allowUpdate: true`):** al importar un archivo `.chattree-plugin` (o manifiesto `.json`) cuyo `id` ya está instalado, Chattree actualiza o reinstala el plugin directamente sin requerir desinstalarlo primero, mostrando el cambio de versión (`v1.0.0 → v2.0.0`) y conservando su fecha `installedAt`, ajustes configurados, permisos, `storage.private` y base de datos SQLite.
- **Tolerancia a sufijos de copia y re-empaquetado local:** el importador local normaliza automáticamente sufijos agregados por navegadores o gestores de archivos (`plugin (1).chattree-plugin`, `my-plugin (2).zip`, `plugin - copia.chattree-plugin`, `plugin (1).json`, `plugin (1).wasm`), aplana archivos ZIP re-comprimidos con una única carpeta raíz (`mi-plugin/plugin.json`), ignora metadatos del sistema operativo (`__MACOSX/`, `.DS_Store`, `Thumbs.db`, `desktop.ini`) y verifica cabeceras por magic bytes (`PK\x03\x04`).
- **Validación estricta de orden SemVer en Marketplace:** el endpoint `POST /api/plugins/submit` rechaza tanto versiones duplicadas (`409 VERSION_ALREADY_EXISTS`) como versiones inferiores o iguales a la última publicada (`409 VERSION_NOT_NEWER`).
- **El SHA-256 es verificación de integridad:** garantiza que `plugin.wasm` no fue alterado respecto a `plugin.json`.
- Los plugins importados empiezan con **cero permisos sensibles/críticos**.

---

## 11. Limitaciones de interacción de la app

- **Modelo de invocación explícita**: las herramientas se ejecutan cuando el usuario invoca `/comando`, cuando el intérprete de intenciones resuelve un `intentContract` declarado, o cuando llega un webhook entrante autenticado.
- **Modo restringido/privado**: bloquea que los plugins inspeccionen el contexto o el historial reciente, aunque tengan `chattree.context.read` o `chat.history.read`.
- **Sin daemons ocultos**: ni el motor de inferencia ni los plugins corren tareas en segundo plano cuando la app está cerrada. Los recordatorios programados funcionan con la app cerrada mediante `AlarmManager`.

---

## 12. Resumen: las 5 fronteras actuales del sandbox

1. **Automatización programada y control de consumo (`scheduler.task`):** Tareas periódicas y Cron de reloj de pared con protección estricta anti-battery drain (mínimo 60 segundos por intervalo, hasta 25 tareas por plugin), además de webhooks entrantes locales y Cloud Inbound Relay 24/7 vía FCM sin mantener sockets TCP persistentes en segundo plano cuando la app está suspendida.
2. **IA e historial acotados y con permiso explícito:** Los plugins con permiso pueden leer hasta los últimos 20 mensajes (`chat.history.read`), hacer inferencia de un turno (`ai.context`) e indexar/buscar vectores (`ai.embeddings`), pero no tienen acceso ilimitado a toda la base de datos de chats ni pueden disparar bucles infinitos de agentes.
3. **Red local y streams en tiempo real protegidos:** Internet público usa `network.http` y `network.websocket`; hablar con la LAN o `localhost` requiere el permiso crítico `network.local` (y en webhooks entrantes requiere activar el switch LAN en Ajustes). Conexiones concurrentes de WebSocket acotadas a 10 con reserva atómica previa y tramas de hasta 16 MB (código 1009 por exceso).
4. **Cuotas de datos y almacenamiento robustas para producción:** Base de datos relacional SQLite privada de hasta **200 MB** (`database.sql`) con transacciones atómicas y hasta 2,000 filas por consulta; 2 MB de `storage.private` clave-valor (256 KB por clave); tarjetas visuales declarativas (`ui.components`) de hasta 60 elementos con modal de confirmación para comandos `/`; 8 MB de lectura/escritura de archivos (12 MB de payload ABI v2); 32 KB al compartir texto; 100 KB de portapapeles y 15 notificaciones por hora.
5. **Seguridad Zero-Trust y aislamiento estricto:** Todo plugin externo inicia sin permisos sensibles o críticos concedidos, independientemente de su ID. Sandbox SQLite aislado que impide `ATTACH`, `DETACH` o manipulación de esquemas del sistema.

---

## 13. Viabilidad de plugins: qué sí y qué hay que rediseñar

**Leyenda:**

| Veredicto | Significado |
|---|---|
| ✅ **Viable hoy** | Se puede construir directamente con las capabilities y cuotas actuales. |
| ⚠️ **Viable con rediseño** | La idea es posible ajustando el flujo (p. ej. ejecución en primer plano o bajo demanda). |
| ❌ **No viable hoy** | Choca con una frontera de seguridad o de sistema operativo (sin background daemons, sin sockets TCP crudos, sin hardware no expuesto). |

### 13.1 Integraciones SaaS, APIs y Real-Time

| Idea de plugin | Veredicto | Por qué | Cómo rediseñarlo |
|---|---|---|---|
| Panel de issues/PRs de GitHub | ✅ | `network.http` contra la API pública (hasta 20 peticiones concurrentes) | — |
| Crear issues o tickets (GitHub, Jira, Linear) | ✅ | POST a API pública con token en settings (`isSecret: true`) | — |
| CRUD en Airtable, Notion o Supabase | ✅ | REST + token cifrado | — |
| Enviar mensajes a Slack, Discord o Telegram | ✅ | Webhook/API saliente pública | — |
| Leer canales de Slack o Discord bajo demanda | ✅ | Peticiones REST al ejecutar el comando | — |
| Streams WebSocket en tiempo real (WhatsApp bridge, telemetría) | ✅ | `network.websocket` (hasta 10 sockets, tramas 16 MB, buffer 500) | — |
| Correo IMAP: resumen y búsqueda | ✅ | `email.read` con contraseña de aplicación | — |
| Enviar correo por SMTP | ✅ | `email.send` | — |
| Calendario del dispositivo | ✅ | `calendar.read/create/update/delete` | — |
| CRM de contactos | ✅ | `contacts.read/create/update` | — |
| Backup a Google Drive o Dropbox | ✅ | `files.pick` + API pública (hasta 8 MB por archivo) | — |

### 13.2 Automatización, LAN, webhooks y notificaciones

| Idea de plugin | Veredicto | Por qué | Cómo rediseñarlo |
|---|---|---|---|
| Tareas recurrentes con Cron (resumen diario, chequeo) | ✅ | `scheduler.task` con Cron de reloj de pared (mínimo 60s, hasta 25 tareas) | — |
| Webhook desde un script en el mismo móvil (Termux) | ✅ | Loopback `127.0.0.1` | — |
| Webhook desde un PC, Home Assistant o IoT por Wi-Fi/LAN | ✅ | Habilitando el modo LAN (`0.0.0.0`) en los ajustes de Webhooks Entrantes del plugin | — |
| Llamar a Home Assistant local, Ollama o NAS en la LAN | ✅ | Con la capability crítica `network.local` + `network.http` | — |
| Webhook directo desde la nube 24/7 sin app abierta | ✅ | `FcmInboundRelayService` + Cloudflare Worker gratuito + Firebase Cloud Messaging | — |
| Cola de eventos con reintentos | ✅ | `EventJournal` con backoff y recuperación | — |
| Webhook autenticado con HMAC | ✅ | `authType: hmacSha256Raw` | — |

### 13.3 Notas, persistencia relacional, UI e IA

| Idea de plugin | Veredicto | Por qué | Cómo rediseñarlo |
|---|---|---|---|
| Base de datos relacional SQLite completa | ✅ | `database.sql` (hasta 200 MB, transacciones atómicas, 2,000 filas/query) | — |
| Tarjetas visuales interactivas en el chat | ✅ | `ui.components` (badges, progreso, clave-valor hasta 40, botones de acción) | — |
| Captura rápida de notas | ✅ | `chattree.notes.create` | — |
| Búsqueda por palabra clave | ✅ | `chattree.notes.search` (máx. 100 resultados) | — |
| Búsqueda semántica propia y RAG sobre documentos | ✅ | `ai.embeddings` (`ai.embed`, `ai.search`, `ai.index_document`) | — |
| Resumen o extracción de tareas de la conversación actual | ✅ | `chat.history.read` (últimos 20 mensajes) + `ai.context` | — |
| Usar el LLM local o remoto activo desde el plugin | ✅ | `ai.context` (`ai.complete`, hasta 2,048 tokens) | — |
| Agente multi-paso (hasta 50 llamadas Host API) | ✅ | `defaultMaxAsyncIterations = 50` y `timeoutMs` configurable hasta 60 s | — |
| Varios comandos en un mismo plugin | ✅ | Soporte para `tools[].entrypoint` y despacho por `command` / `toolId` | — |
| Transformar el portapapeles | ✅ | `clipboard.read` y `clipboard.write` (hasta 100 KB) | — |
| Compartir textos largos o reportes | ✅ | `share.text` (hasta 32,768 caracteres) y `share.file` | — |

---

## 14. Inconsistencias resueltas y alineación de validadores

Todas las discrepancias detectadas previamente entre el runtime de Flutter, el validador CLI y el portal Web fueron resueltas y unificadas:

| Tema | Estado anterior | Estado actual unificado |
|---|---|---|
| `network.websocket` (Fase 1) | No existía en el runtime | **Implementado y auditado:** `WebSocketApiHandler`, 10 sockets max con reserva atómica pre-handshake, tramas 16 MB con cierre 1009, buffer 500 tramas, SSRF protegido con `network.local`. |
| `ui.components` / `ui.render` (Fase 2) | Salida solo Markdown/texto plano | **Implementado y auditado:** `DeclarativeUiBubble`, sanitización global `UiApiHandler.sanitizeUiCard`, hasta 60 elementos, 40 pares clave-valor, 8 botones, modal de confirmación en comandos `/`. |
| `scheduler.task` / `scheduler.cron` (Fase 3) | Sin programación periódica | **Implementado y auditado:** `PluginTaskScheduler`, expresiones Cron de reloj de pared, anti-battery drain (mínimo 60s), hasta 25 tareas, 128 KB payload, entrega por `HostEventBus`. |
| `database.sql` / `storage.database` (Fase 4) | Solo key-value en SharedPreferences | **Implementado y auditado:** `PluginDatabaseManager`, SQLite privado `plugin_<pluginId>.db`, cuota ampliada a 200 MB, `busy_timeout = 5000`, despacho `SELECT`/`WITH`/`PRAGMA`, transacciones atómicas, 2,000 filas/query, protección escape sandbox. |
| `notifications.read / query / reply / action` (Fase 5) | Sin acceso a notificaciones del sistema | **Implementado y auditado:** `NotificationCaptureService` + `DeviceNotificationService`, filtrado nativo OTP/2FA, `logicalId` sin colisiones, eventos `received` y `removed`, respuestas `RemoteInput` hasta 4,000 chars y `LruCache` efímera. |
| Importación local y actualización de plugins | Rechazaba archivos con sufijos `(1)` o carpeta raíz y exigía desinstalar para actualizar | **Resiliente y actualización in-situ:** `PluginImporter` / `PluginPackageManager` normalizan sufijos `(1)`, `- copia`, aplanan carpeta raíz única, ignoran `__MACOSX`/`.DS_Store` y actualizan in-situ (`allowUpdate: true`) preservando datos. |
| Webhooks entrantes (Local y Cloud Cloudflare/FCM) | Colisión de ruta en `webhook.hub`, sin límite UTF-8 total en Worker ni mutex en `drainPendingInbox` | **Auditado y endurecido:** prioridad a plugins instalados en `FcmInboundRelayService`, mutex `_drainInFlight` y `kFcmMaxInboxRetries = 3`, validación UTF-8 `MAX_DATA_BYTES = 3800` en Worker, `/plugins/system/test` local, soporte IPv6 y switch LAN global. |
| `clipboard.read` / `clipboard.write` | Documentado pero sin handler en el runtime | **Implementado y registrado** (`ClipboardApiHandler`, hasta 100 KB) |
| `chat.history.read`, `ai.context`, `ai.embeddings` | Marcadas como no disponibles en WASM | **Implementadas y enrutadas** (`ContextApiHandler` y `AiApiHandler`) |
| Despacho multi-comando (`tools[]`) | Sobrescribía `command` con `primaryCommand` | **Corregido:** respeta `tools[].command` y soporta `tools[].entrypoint` |
| Tamaño de paquete (`.chattree-plugin`) | 10 MB en móvil vs. 25 MB en web | **25 MB comprimido / 50 MB descomprimido** en App, CLI y Web |
| `schemaVersion` y `maxMemoryPages` | CLI solo aceptaba `schemaVersion: 1` y web limitaba a 256 páginas | **Alineado:** `schemaVersion` `1` o `2` y hasta **1024 páginas (64 MB)** en App, CLI y Web |
| Archivos de licencia en el ZIP | Web rechazaba `license.txt` y `license.md` | **Alineado:** `license`, `license.txt` y `license.md` aceptados en todos los validadores |
| Payload ABI v2 vs. archivos de 8 MB | Payload por defecto de 2 MB truncaba archivos de 8 MB en Base64 | **Elevado a 12 MB por defecto** (máximo 16 MB) |
| Lectura/escritura en `security.md` | Decía 4 MB / 2 MB mientras el código permitía 8 MB | **Documentación alineada en 8 MB** para lectura y escritura |
| Monotonía de versiones en Marketplace | Permitía subir versiones SemVer menores si no eran idénticas | **Validación SemVer estricta (`409 VERSION_NOT_NEWER`)** en `POST /api/plugins/submit` |
