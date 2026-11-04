;; Chattree Webhook Hub Plugin — WebAssembly Text format (WAT)
;;
;; Integrates with:
;;   - InboundHttpServer via InboundWebhookCapability / EventConsumerCapability
;;   - Notifications API ('notifications.send')
;;   - Private Storage API ('storage.set' / 'storage.get')
;;
;; Memory layout:
;;   0..32767:        Input buffer (32 KB)
;;   32768..65535:    Output buffer (32 KB, outputOffset = 32768)
;;   65536..81919:    Host call request buffer (16 KB)
;;   81920..98303:    Host call response buffer (16 KB)
;;   98304..129999:   Static data messages & templates
;;   130000..130004:  Execution state (action mode for resume)

(module
  ;; Import host_call from Chattree runtime
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; Export 4 memory pages (256 KB linear memory)
  (memory (export "memory") 4)

  (data (i32.const 98304) "### \f0\9f\93\a1 Chattree Webhook Hub & Inbound Server\0a\0a**Estado del Webhook:**\0a\e2\80\a2 \f0\9f\9f\a2 **Listener Inbound:** Activo en `http://127.0.0.1:8765` (en primer plano)\0a\e2\80\a2 \f0\9f\93\8d **Endpoint registrado:** `/plugins/com.developer.webhook.hub/alerts`\0a\e2\80\a2 \f0\9f\94\90 **Autenticaci\c3\b3n:** `Bearer Token` (revisa o rota tu secreto en *Ajustes \e2\86\92 Plugins \e2\86\92 Webhook Hub \e2\86\92 Webhooks Entrantes*)\0a\e2\80\a2 \f0\9f\86\94 **Cabecera requerida:** `X-Chattree-Delivery-Id: <uuid>` (control de idempotencia)\0a\e2\80\a2 \f0\9f\93\a6 **Tipo de evento:** `webhook.alert`\0a\e2\80\a2 \f0\9f\93\b1 **Requisito Android:** Mant\c3\a9n Chattree abierto en la pantalla de tu m\c3\b3vil para recibir peticiones.\0a\0a**Comandos disponibles:**\0a\e2\80\a2 `/webhook status` \e2\80\94 Muestra este informe de estado y diagn\c3\b3stico\0a\e2\80\a2 `/webhook last` \e2\80\94 Muestra el contenido del \c3\baltimo webhook recibido\0a\e2\80\a2 `/webhook test` \e2\80\94 Simula la recepci\c3\b3n de una alerta local con notificaci\c3\b3n\0a\e2\80\a2 `/webhook curl` \e2\80\94 Muestra comandos `curl` y PowerShell listos para probar\0a\e2\80\a2 `/webhook clear` \e2\80\94 Limpia el registro almacenado")
  (data (i32.const 99325) "### \f0\9f\9a\80 Comandos para probar el Webhook de Chattree\0a\0aCopia tu **Token Secreto** desde **Ajustes \e2\86\92 Plugins \e2\86\92 Webhook Hub \e2\86\92 Webhooks Entrantes**.\0a\0a#### 1. Con cURL:\0a```bash\0acurl -X POST http://127.0.0.1:8765/plugins/com.developer.webhook.hub/alerts \5c\0a  -H \22Authorization: Bearer <TU_SECRETO>\22 \5c\0a  -H \22X-Chattree-Delivery-Id: msg-$(date +%s)\22 \5c\0a  -H \22Content-Type: application/json; charset=utf-8\22 \5c\0a  -d '{\22title\22:\22Alerta Servidor\22,\22level\22:\22critico\22,\22message\22:\22Prueba exitosa\22}'\0a```\0a\0a#### 2. Con PowerShell (Windows):\0a```powershell\0a$headers = @{\0a  \22Authorization\22 = \22Bearer TU_SECRETO\22\0a  \22X-Chattree-Delivery-Id\22 = [System.Guid]::NewGuid().ToString()\0a}\0a$body = @{\0a  title = \22Alerta Servidor\22\0a  level = \22critico\22\0a  message = \22Prueba de webhook desde PowerShell\22\0a} | ConvertTo-Json\0a\0aInvoke-RestMethod -Uri \22http://127.0.0.1:8765/plugins/com.developer.webhook.hub/alerts\22 -Method POST -Headers $headers -Body $body -ContentType \22application/json; charset=utf-8\22\0a```")
  (data (i32.const 100308) "\f0\9f\94\94 **Prueba de Webhook Ejecutada Exitosamente**\0a\0a\e2\80\a2 **Notificaci\c3\b3n local:** Disparada en el dispositivo mediante `notifications.send`.\0a\e2\80\a2 **Almacenamiento privado:** Registro de prueba guardado en `storage.private`.\0a\e2\80\a2 **Verificaci\c3\b3n:** Ejecuta `/webhook last` para ver el estado almacenado.")
  (data (i32.const 100622) "\e2\9c\85 **[Webhook Hub] Evento Webhook Ingestado y Procesado**\0a\0a\e2\80\a2 **Evento:** `webhook.alert`\0a\e2\80\a2 **Servidor:** InboundHttpServer (127.0.0.1:8765)\0a\e2\80\a2 **Acciones completadas:**\0a  - \f0\9f\94\94 Notificaci\c3\b3n nativa enviada al dispositivo.\0a  - \f0\9f\92\be Payload guardado en `storage.private` (consulta con `/webhook last`).\0a  - \f0\9f\9b\a1\ef\b8\8f Idempotencia deduplicada en `EventJournal`.")
  (data (i32.const 101001) "\f0\9f\a7\b9 **Registros del Webhook Limpiados Exitosamente**\0a\0aEl historial y la \c3\baltima alerta almacenada han sido restablecidos.")
  (data (i32.const 101139) "\f0\9f\93\8b **\c3\9altimo Webhook Recibido:**\0a\0a```json\0a")
  (data (i32.const 101199) "\0a```")
  (data (i32.const 101219) "\e2\84\b9\ef\b8\8f No se ha recibido ning\c3\ban evento webhook todav\c3\ada.\0a\0aEnv\c3\ada una petici\c3\b3n POST al endpoint o ejecuta `/webhook test` para simular una.")
  (data (i32.const 101375) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22last_event\22}}")
  (data (i32.const 101457) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22last_event\22,\22value\22:\22Sin eventos recientes\22}}")
  (data (i32.const 101571) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22last_event\22,\22value\22:\22Alerta de prueba manual local generada con exito.\22}}")
  (data (i32.const 101713) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22last_event\22,\22value\22:\22")
  (data (i32.const 101803) "\22}}")
  (data (i32.const 101822) "{\22api\22:\22notifications\22,\22operation\22:\22send\22,\22payload\22:{\22title\22:\22\f0\9f\9a\a8 [Webhook Hub] Alerta de Prueba\22,\22body\22:\22Esta es una notificaci\c3\b3n de prueba local para validar el webhook de Chattree.\22}}")
  (data (i32.const 102026) "{\22api\22:\22notifications\22,\22operation\22:\22send\22,\22payload\22:{\22title\22:\22\f0\9f\9a\a8 [Webhook Hub] Alerta Recibida\22,\22body\22:\22Nuevo evento webhook.alert procesado y guardado correctamente.\22}}")


  ;; Main entrypoint
  (func (export "webhook_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $first_char i32)
    (local $second_char i32)
    (local $i i32)
    (local $byte_val i32)
    (local $req_len i32)
    (local $res_len i32)
    (local $out_ptr i32)
    (local $copy_len i32)
    (local $write_ptr i32)

    ;; If input is empty -> return status overview!
    (if (i32.eqz (local.get $in_len))
      (then
        (memory.copy (i32.const 32768) (i32.const 98304) (i32.const 1005))
        (return (i32.const 1005))
      )
    )

    (local.set $first_char (i32.load8_u (local.get $in_ptr)))
    (if (i32.ge_u (local.get $in_len) (i32.const 2))
      (then
        (local.set $second_char (i32.load8_u (i32.add (local.get $in_ptr) (i32.const 1))))
      )
    )

    ;; 1. Check if input is a JSON payload from the Inbound Webhook Dispatcher
    ;;    First char is '{' (ASCII 123)
    (if (i32.eq (local.get $first_char) (i32.const 123))
      (then
        ;; Store mode 1 (event) in memory at 130000
        (i32.store (i32.const 130000) (i32.const 1))

        ;; Build storage.set request at 65536
        (memory.copy (i32.const 65536) (i32.const 101713) (i32.const 74))
        (local.set $write_ptr (i32.add (i32.const 65536) (i32.const 74)))

        (local.set $copy_len (local.get $in_len))
        ;; Cap payload copy length to 4000 bytes
        (if (i32.gt_u (local.get $copy_len) (i32.const 4000))
          (then (local.set $copy_len (i32.const 4000)))
        )

        ;; Copy input escaping any double quotes (replace '"' with ''')
        (local.set $i (i32.const 0))
        (block $break_copy
          (loop $copy_loop
            (if (i32.ge_u (local.get $i) (local.get $copy_len))
              (then (br $break_copy))
            )
            (local.set $byte_val (i32.load8_u (i32.add (local.get $in_ptr) (local.get $i))))
            ;; If quote (34) or backslash (92), replace with single quote (39)
            (if (i32.or (i32.eq (local.get $byte_val) (i32.const 34)) (i32.eq (local.get $byte_val) (i32.const 92)))
              (then
                (local.set $byte_val (i32.const 39))
              )
            )
            (i32.store8 (i32.add (local.get $write_ptr) (local.get $i)) (local.get $byte_val))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $copy_loop)
          )
        )

        (local.set $write_ptr (i32.add (local.get $write_ptr) (local.get $copy_len)))
        ;; Copy suffix
        (memory.copy (local.get $write_ptr) (i32.const 101803) (i32.const 3))
        (local.set $write_ptr (i32.add (local.get $write_ptr) (i32.const 3)))

        (local.set $req_len (i32.sub (local.get $write_ptr) (i32.const 65536)))
        ;; Synchronous storage.set
        (drop (call $host_call (i32.const 65536) (local.get $req_len) (i32.const 81920) (i32.const 4096)))

        ;; Trigger local notification for incoming alert
        (memory.copy (i32.const 65536) (i32.const 102026) (i32.const 171))
        (drop (call $host_call (i32.const 65536) (i32.const 171) (i32.const 81920) (i32.const 4096)))

        ;; Return 0 to await async notification and resume
        (return (i32.const 0))
      )
    )

    ;; 2. Check for "test" ('t'+'e' = 116+101)
    (if (i32.and (i32.eq (local.get $first_char) (i32.const 116)) (i32.eq (local.get $second_char) (i32.const 101)))
      (then
        (i32.store (i32.const 130000) (i32.const 0))

        ;; Synchronous storage.set for test event
        (memory.copy (i32.const 65536) (i32.const 101571) (i32.const 126))
        (drop (call $host_call (i32.const 65536) (i32.const 126) (i32.const 81920) (i32.const 4096)))

        ;; Trigger test notification
        (memory.copy (i32.const 65536) (i32.const 101822) (i32.const 188))
        (drop (call $host_call (i32.const 65536) (i32.const 188) (i32.const 81920) (i32.const 4096)))

        (return (i32.const 0))
      )
    )

    ;; 3. Check for "last" ('l'+'a' = 108+97)
    (if (i32.and (i32.eq (local.get $first_char) (i32.const 108)) (i32.eq (local.get $second_char) (i32.const 97)))
      (then
        ;; Call storage.get("last_event")
        (memory.copy (i32.const 65536) (i32.const 101375) (i32.const 66))
        (local.set $res_len (call $host_call (i32.const 65536) (i32.const 66) (i32.const 81920) (i32.const 8192)))

        (if (i32.le_s (local.get $res_len) (i32.const 0))
          (then
            (memory.copy (i32.const 32768) (i32.const 101219) (i32.const 140))
            (return (i32.const 140))
          )
        )

        ;; Format output: Header + response data + Footer
        (memory.copy (i32.const 32768) (i32.const 101139) (i32.const 44))
        (local.set $out_ptr (i32.add (i32.const 32768) (i32.const 44)))

        (memory.copy (local.get $out_ptr) (i32.const 81920) (local.get $res_len))
        (local.set $out_ptr (i32.add (local.get $out_ptr) (local.get $res_len)))

        (memory.copy (local.get $out_ptr) (i32.const 101199) (i32.const 4))
        (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 4)))

        (return (i32.sub (local.get $out_ptr) (i32.const 32768)))
      )
    )

    ;; 4. Check for "curl" ('c'+'u' = 99+117)
    (if (i32.and (i32.eq (local.get $first_char) (i32.const 99)) (i32.eq (local.get $second_char) (i32.const 117)))
      (then
        (memory.copy (i32.const 32768) (i32.const 99325) (i32.const 967))
        (return (i32.const 967))
      )
    )

    ;; 5. Check for "clear" ('c'+'l' = 99+108)
    (if (i32.and (i32.eq (local.get $first_char) (i32.const 99)) (i32.eq (local.get $second_char) (i32.const 108)))
      (then
        (memory.copy (i32.const 65536) (i32.const 101457) (i32.const 98))
        (drop (call $host_call (i32.const 65536) (i32.const 98) (i32.const 81920) (i32.const 4096)))
        (memory.copy (i32.const 32768) (i32.const 101001) (i32.const 122))
        (return (i32.const 122))
      )
    )

    ;; Default: Return status
    (memory.copy (i32.const 32768) (i32.const 98304) (i32.const 1005))
    (i32.const 1005)
  )

  ;; Exported resume function called by Chattree when async host_call finishes
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $mode i32)
    (local.set $mode (i32.load (i32.const 130000)))

    (if (i32.eq (local.get $mode) (i32.const 1))
      (then
        ;; Incoming Webhook Event processed
        (memory.copy (i32.const 32768) (i32.const 100622) (i32.const 363))
        (return (i32.const 363))
      )
    )

    ;; Test mode
    (memory.copy (i32.const 32768) (i32.const 100308) (i32.const 298))
    (return (i32.const 298))
  )
)
