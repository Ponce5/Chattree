# Chattree ElevenLabs Voice Generator

Plugin oficial para Chattree que integra la API de síntesis de voz de ElevenLabs. Permite generar archivos de audio MP3 de alta fidelidad directamente desde el chat y descargarlos o compartirlos en el dispositivo.

## Capacidades requeridas
- `network.http`: Para realizar llamadas HTTPS a la API de ElevenLabs (`https://api.elevenlabs.io/v1/text-to-speech/...`).
- `storage.private`: Para guardar de manera segura la clave de API del usuario.
- `files.write`: Para almacenar el archivo de audio MP3 en el sandbox del dispositivo.

## Uso

1. **Configuración inicial:**
   ```
   /elevenlabs config <tu_api_key>
   ```
   *(Obtén una clave gratuita con 10,000 caracteres mensuales en https://elevenlabs.io)*

2. **Verificar estado:**
   ```
   /elevenlabs status
   ```

3. **Generar audio:**
   ```
   /elevenlabs Hola, este es un mensaje generado con inteligencia artificial en Chattree.
   ```
   O usando el alias:
   ```
   /tts Bienvenidos a nuestra presentación
   ```

El archivo generado aparecerá como una burbuja interactiva en el chat con botones nativos para **Guardar** (descargar al dispositivo) y **Compartir**.
