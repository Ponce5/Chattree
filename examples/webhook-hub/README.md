# Webhook Hub & Alert Bridge — Plugin para Chattree

Plugin oficial WebAssembly diseñado para aprovechar y probar exhaustivamente el **Servidor de Webhooks Entrantes (Inbound HTTP Server)** integrado en Chattree.

---

## 🎯 ¿De qué trata este plugin y para qué sirve?

Chattree incluye un servidor HTTP loopback en primer plano (`127.0.0.1:8765` por defecto, con opción LAN `0.0.0.0`) gobernado por un pipeline de seguridad de defensa en profundidad (**InboundHttpServer**, **SSRF Guard**, autenticación criptográfica, deduplicación por idempotencia en SQLite con **EventJournal** y despacho con **EventDispatcher** a módulos WASM).

**Webhook Hub & Alert Bridge** convierte a Chattree en un centro receptor de eventos externos en tiempo real:
- **Recepción Push:** Expone un endpoint HTTP seguro (`/plugins/com.developer.webhook.hub/alerts`) para recibir alertas desde GitHub Actions, Uptime Kuma, Home Assistant, Prometheus, scripts locales o microservicios.
- **Notificaciones Inmediatas:** Al recibir un webhook, dispara una notificación local nativa (`notifications.send`) en tu dispositivo (Android, iOS, macOS, Windows).
- **Persistencia en el Sandbox:** Registra cada payload recibido en el almacenamiento privado (`storage.private`) para inspección posterior.
- **Diagnóstico y Control en el Chat:** Permite ver el estado del servidor, inspeccionar el último evento recibido (`/webhook last`), simular alertas (`/webhook test`) y obtener comandos cURL / PowerShell preconfigurados (`/webhook curl`).

---

## 🏗️ Especificación Técnica y Arquitectura

| Parámetro | Detalle |
|---|---|
| **ID del Plugin** | `com.developer.webhook.hub` |
| **Versión** | `1.0.0` |
| **Schema Manifest** | `schemaVersion: 2` |
| **Runtime** | WebAssembly (`wasm`, ABI v1 con `outputOffset: 32768`) |
| **Endpoint Inbound** | `POST /plugins/com.developer.webhook.hub/alerts` |
| **Puerto por Defecto** | `8765` (configurable en *Ajustes → Inbound Webhooks*) |
| **Autenticación** | Bearer Token (`Authorization: Bearer <secret>`) |
| **Cabecera de Idempotencia** | `X-Chattree-Delivery-Id: <uuid>` |
| **Tipo de Evento** | `webhook.alert` |
| **Capacidades Declaradas** | `network.webhook_inbound`, `storage.private`, `notifications.send` |

---

## 🚀 Guía de Instalación y Activación en Chattree

1. **Importar el Plugin:**
   - Abre Chattree.
   - Ve a **Ajustes** → **Plugins**.
   - Toca el botón **Importar plugin** y selecciona el archivo `com.developer.webhook.hub-v1.0.0.chattree-plugin`.
   - Concede las capacidades solicitadas (*Webhooks Entrantes*, *Notificaciones* y *Almacenamiento Privado*).

2. **Obtener tu Secreto de Autenticación:**
   - Ve a **Ajustes** → **Plugins** → **Webhook Hub & Alert Bridge** → **Webhooks Entrantes**.
   - Aquí verás la URL completa: `http://127.0.0.1:8765/plugins/com.developer.webhook.hub/alerts`.
   - Copia el **Token Secreto** generado automáticamente por Chattree.
   - *(Opcional)* Si deseas enviar webhooks desde otra PC o dispositivo en la misma red Wi-Fi, activa el interruptor **Permitir conexiones desde red local (LAN / Wi-Fi)**.

3. **Verificar que el Servidor Inbound esté Activo:**
   - Ve a **Ajustes** → **Inbound Webhooks**.
   - Asegúrate de que el listener esté en estado **Activo** (verde) en el puerto `8765`.

---

## 🧪 Cómo Probar el Webhook

### Opción A: Probar con el Script de PowerShell (Windows)

En esta misma carpeta dispones de `test-webhook.ps1`:

```powershell
# Reemplaza con tu token copiado de Ajustes -> Plugins -> Webhooks Entrantes:
.\test-webhook.ps1 -Secret "TU_TOKEN_SECRETO_AQUI"
```

### Opción B: Probar con cURL

```bash
curl -X POST http://127.0.0.1:8765/plugins/com.developer.webhook.hub/alerts \
  -H "Authorization: Bearer <TU_TOKEN_SECRETO>" \
  -H "X-Chattree-Delivery-Id: alert-$(date +%s)" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"title":"Servidor Prod-01","level":"critical","message":"Uso de memoria > 95%","source":"Monitor Grafana"}'
```

### Opción C: Probar con PowerShell Directo

```powershell
$headers = @{
  "Authorization" = "Bearer TU_TOKEN_SECRETO"
  "X-Chattree-Delivery-Id" = [System.Guid]::NewGuid().ToString()
}
$body = @{
  title = "Alerta de Servidor"
  level = "critical"
  message = "Prueba de webhook desde PowerShell"
  source = "Monitor Local"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:8765/plugins/com.developer.webhook.hub/alerts" `
  -Method POST -Headers $headers -Body $body -ContentType "application/json; charset=utf-8"
```

---

## 💬 Comandos Disponibles en Chattree Chat

| Comando | Descripción |
|---|---|
| `/webhook` o `/webhook status` | Muestra el estado del listener, URL, autenticación y estadísticas. |
| `/webhook last` | Muestra el contenido del último webhook recibido almacenado en `storage.private`. |
| `/webhook test` | Dispara una simulación local con notificación nativa. |
| `/webhook curl` | Despliega los comandos listos para copiar y pegar. |
| `/webhook clear` | Restablece el almacenamiento y limpia los registros previos. |

---

## 🔒 Garantías de Seguridad Implementadas

1. **SSRF Guard:** El listener opera exclusivamente en `127.0.0.1` por defecto; no expone puertos ni servicios internos.
2. **Comparación en Tiempo Constante:** Los Bearer Tokens se validan usando hashes SHA-256 con protección contra ataques de temporización.
3. **Idempotencia Estricta:** La cabecera `X-Chattree-Delivery-Id` previene que peticiones duplicadas o reintentadas ejecuten acciones múltiples.
4. **Aislamiento en Sandbox WASM:** El código corre en memoria aislada de WebAssembly sin acceso al sistema de archivos ni al heap de Dart.
