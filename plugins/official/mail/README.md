# Chattree Mail Plugin (v1.2.0)

The **Official Mail Plugin** provides sandboxed, on-device email integration with **Contraseña de Aplicación (App Password)** support for reading inboxes, inspecting message details, and composing/sending emails through Chattree's conversational AI.

---

## 🚀 Guía Rápida: Cómo Obtener tu Contraseña de Aplicación de Gmail (16 Letras)

1. Ve a tu cuenta de Google: [myaccount.google.com/security](https://myaccount.google.com/security).
2. Asegúrate de tener activada la **Verificación en 2 pasos**.
3. En la barra de búsqueda de la cuenta escribe **Contraseñas de aplicaciones** (o en Seguridad -> Verificación en 2 pasos -> Contraseñas de aplicaciones).
4. Escribe un nombre para la app (por ejemplo: `Chattree`) y presiona **Crear**.
5. Google te mostrará un código de **16 letras amarillas** (ejemplo: `abcd efgh ijkl mnop`).
6. En Chattree, escribe:
   ```text
   /mail config tu-correo@gmail.com abcd efgh ijkl mnop
   ```
   ¡Listo! Tu cuenta quedará conectada de forma segura sin requerir auditorías ni verificaciones de Google.

---

## ⚡ Comandos Disponibles

| Comando | Descripción |
| :--- | :--- |
| `/mail` o `/mail inbox` | Consulta la bandeja de entrada para que la IA la analice y resuma. |
| `/mail config <correo> <contraseña_16_letras>` | Vincula tu cuenta de correo de forma segura. |
| `/mail read <id>` | Abre el contenido completo de un correo específico para que la IA extraiga puntos clave o responda. |
| `/mail send <destinatario> \| <asunto> \| <mensaje>` | Redacta y despacha un correo electrónico. |
| `/mail disconnect` | Desvincula tu cuenta y elimina las credenciales locales de forma segura. |
| `/mail help` | Muestra la guía de comandos. |

---

## 🛡️ Seguridad y Privacidad

- Se activa **estrictamente con `/mail`** (sin alias ni interferencias en chats ordinarios).
- Las credenciales se almacenan exclusivamente en el espacio aislado del plugin (`storage.private`).
- Todas las respuestas se entregan como datos estructurados JSON para que la IA converse con naturalidad sin frases predefinidas.
