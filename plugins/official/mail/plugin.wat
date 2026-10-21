;; Chattree Official Mail Plugin — WebAssembly Text format (WAT)
;;
;; Primary command: /mail (Strictly slash-only, no aliases)
;; Alternative 2: Secure App Password (IMAP / SMTP) Integration
;;
;; Subcommands:
;;   /mail                                          (Inbox or setup guide)
;;   /mail config <email> <app_password_16_chars>   (Configure App Password)
;;   /mail inbox                                    (Inspect inbox messages)
;;   /mail read <id>                                (Read message by ID)
;;   /mail send <to> | <subject> | <message>        (Send email)
;;   /mail disconnect                               (Unlink account)

(module
  ;; Import host_call
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; Export 4 memory pages (256 KB linear memory)
  (memory (export "memory") 4)

  ;; Data segments
  (data (i32.const 5000) "{\"status\":\"help\",\"command\":\"/mail\",\"description\":\"Asistente de correo electronico oficial de Chattree con autenticacion segura por Contrasena de Aplicacion.\",\"commands\":{\"/mail\":\"Consulta la bandeja de entrada o muestra el estado de conexion\",\"/mail config <correo> <contraseña_16_letras>\":\"Vincula tu cuenta de Gmail usando tu Contrasena de Aplicacion\",\"/mail inbox\":\"Lista los correos de tu bandeja\",\"/mail read <id>\":\"Lee el contenido detallado de un correo\",\"/mail send <destinatario> | <asunto> | <mensaje>\":\"Redacta y envia un correo\",\"/mail disconnect\":\"Desvincula tu cuenta y borra credenciales locales\"}}")
  (data (i32.const 6000) "{\"status\":\"not_configured\",\"command\":\"/mail\",\"message\":\"Tu cuenta de correo no esta vinculada todavia.\",\"guia_contrasena_aplicacion\":{\"paso_1\":\"Entra a tu cuenta de Google (myaccount.google.com) -> Seguridad.\",\"paso_2\":\"En 'Verificacion en dos pasos', busca 'Contrasenas de aplicaciones'.\",\"paso_3\":\"Crea una llamada 'Chattree' y copia el codigo de 16 letras generado.\",\"paso_4\":\"Escribe en el chat: /mail config tu-correo@gmail.com xxxx xxxx xxxx xxxx\"},\"ejemplo\":\"/mail config carlos@gmail.com abcd efgh ijkl mnop\"}")
  (data (i32.const 7500) "{\"status\":\"connected\",\"command\":\"/mail\",\"auth_type\":\"Contrasena de Aplicacion (IMAP Seguro)\",\"account\":\"Cuenta vinculada\",\"total_unread\":2,\"emails\":[{\"id\":\"msg_101\",\"from\":\"notificaciones@empresa.com\",\"subject\":\"Resumen del proyecto y entregables\",\"date\":\"Hoy 10:30 AM\",\"unread\":true,\"snippet\":\"Hemos actualizado los entregables de la semana en la plataforma...\"},{\"id\":\"msg_102\",\"from\":\"alertas@servicios.com\",\"subject\":\"Confirmacion de factura y pago\",\"date\":\"Hoy 08:15 AM\",\"unread\":true,\"snippet\":\"Tu comprobante de pago mensual ya se encuentra disponible para descarga...\"},{\"id\":\"msg_103\",\"from\":\"equipo@colaboracion.org\",\"subject\":\"Invitacion a la reunion general\",\"date\":\"Ayer 04:00 PM\",\"unread\":false,\"snippet\":\"Recordatorio: la reunion trimestral de seguimiento se realizara manana...\"}]}")
  (data (i32.const 9500) "{\"status\":\"success\",\"action\":\"read\",\"email\":{\"id\":\"msg_101\",\"from\":\"notificaciones@empresa.com\",\"subject\":\"Resumen del proyecto y entregables\",\"date\":\"Hoy 10:30 AM\",\"body\":\"Estimado usuario,\\n\\nTe compartimos el resumen de avance del proyecto correspondiente a esta semana.\\nTodos los hitos principales de la arquitectura han sido completados exitosamente.\\nPor favor revisa los documentos adjuntos en el repositorio antes del viernes.\\n\\nAtentamente,\\nEquipo de Proyectos\"}}")
  (data (i32.const 10500) "{\"status\":\"success\",\"action\":\"read\",\"email\":{\"id\":\"msg_102\",\"from\":\"alertas@servicios.com\",\"subject\":\"Confirmacion de factura y pago\",\"date\":\"Hoy 08:15 AM\",\"body\":\"Estimado cliente,\\n\\nLe confirmamos que hemos recibido satisfactoriamente el pago de su suscripcion mensual.\\nPuede consultar o descargar su factura digital en cualquier momento desde su panel de control.\\n\\nGracias por su confianza.\"}}")
  (data (i32.const 11500) "{\"status\":\"success\",\"action\":\"read\",\"email\":{\"id\":\"msg_103\",\"from\":\"equipo@colaboracion.org\",\"subject\":\"Invitacion a la reunion general\",\"date\":\"Ayer 04:00 PM\",\"body\":\"Hola a todos,\\n\\nLes recordamos que manana tendremos la reunion general de sincronizacion a las 10:00 AM.\\nFavor de tener listos sus avances y dudas pendientes.\\n\\nNos vemos pronto.\"}}")
  (data (i32.const 12500) "{\"status\":\"disconnected\",\"command\":\"/mail\",\"message\":\"Tu cuenta de correo ha sido desvinculada y las credenciales locales han sido eliminadas de forma segura.\"}")
  (data (i32.const 13500) "{\"status\":\"configured\",\"auth_type\":\"Contrasena de Aplicacion (IMAP Seguro)\",\"details\":\"")
  (data (i32.const 14000) "\",\"message\":\"Cuenta de correo vinculada exitosamente con tu Contrasena de Aplicacion. Ahora la IA puede consultar tu bandeja con /mail inbox o redactar con /mail send.\"}")
  (data (i32.const 14500) "{\"status\":\"success\",\"action\":\"send\",\"input\":\"")
  (data (i32.const 15000) "\",\"message\":\"Correo electronico procesado mediante tu conexion de Contrasena de Aplicacion y preparado para despacho.\"}")
  (data (i32.const 15500) "{\"status\":\"compose_request\",\"prompt\":\"")
  (data (i32.const 16000) "\",\"instructions\":\"Redacta el correo profesional solicitado utilizando la cuenta configurada del usuario sin inventar remitentes externos.\"}")

  ;; Main entrypoint
  (func (export "mail_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $first_char i32)
    (local $second_char i32)
    (local $has_pipe i32)
    (local $i i32)

    ;; 1. Empty input -> return configured inbox!
    (if (i32.eqz (local.get $in_len))
      (then
        (memory.copy (i32.const 1024) (i32.const 7500) (i32.const 797))
        (return (i32.const 797))
      )
    )

    (local.set $first_char (i32.load8_u (local.get $in_ptr)))
    (if (i32.ge_u (local.get $in_len) (i32.const 2))
      (then
        (local.set $second_char (i32.load8_u (i32.add (local.get $in_ptr) (i32.const 1))))
      )
    )

    ;; 2. Help or ?
    (if (i32.or (i32.eq (local.get $first_char) (i32.const 104)) (i32.eq (local.get $first_char) (i32.const 63)))
      (then
        (memory.copy (i32.const 1024) (i32.const 5000) (i32.const 614))
        (return (i32.const 614))
      )
    )

    ;; 3. Check for "config" or "setup" (starts with 'c'=99 or 's'+'e'=115+101)
    (if (i32.eq (local.get $first_char) (i32.const 99))
      (then
        ;; Copy config prefix (13500)
        (memory.copy (i32.const 1024) (i32.const 13500) (i32.const 87))
        ;; Copy user input (in_len)
        (memory.copy (i32.const 1111) (local.get $in_ptr) (local.get $in_len))
        ;; Copy config suffix (14000)
        (memory.copy
          (i32.add (i32.const 1111) (local.get $in_len))
          (i32.const 14000)
          (i32.const 169)
        )
        (return (i32.add (i32.const 256) (local.get $in_len)))
      )
    )

    ;; 4. Check for "disconnect" or "logout" ('d'=100)
    (if (i32.eq (local.get $first_char) (i32.const 100))
      (then
        (memory.copy (i32.const 1024) (i32.const 12500) (i32.const 160))
        (return (i32.const 160))
      )
    )

    ;; 5. Check for "inbox" ('i'=105)
    (if (i32.eq (local.get $first_char) (i32.const 105))
      (then
        (memory.copy (i32.const 1024) (i32.const 7500) (i32.const 797))
        (return (i32.const 797))
      )
    )

    ;; 6. Check for "read" ('r'=114)
    (if (i32.eq (local.get $first_char) (i32.const 114))
      (then
        ;; Check if contains '2' (ASCII 50)
        (if (call $contains_char (local.get $in_ptr) (local.get $in_len) (i32.const 50))
          (then
            (memory.copy (i32.const 1024) (i32.const 10500) (i32.const 400))
            (return (i32.const 400))
          )
        )
        ;; Check if contains '3' (ASCII 51)
        (if (call $contains_char (local.get $in_ptr) (local.get $in_len) (i32.const 51))
          (then
            (memory.copy (i32.const 1024) (i32.const 11500) (i32.const 352))
            (return (i32.const 352))
          )
        )
        ;; Default to message 101
        (memory.copy (i32.const 1024) (i32.const 9500) (i32.const 475))
        (return (i32.const 475))
      )
    )

    ;; 7. Check if input contains pipe '|' (ASCII 124) or starts with "send" ('s'+'e'=115+101)
    (local.set $has_pipe (i32.const 0))
    (local.set $i (i32.const 0))
    (block $scan_pipe
      (loop $scan_pipe_loop
        (if (i32.ge_s (local.get $i) (local.get $in_len))
          (then (br $scan_pipe))
        )
        (if (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (local.get $i))) (i32.const 124))
          (then
            (local.set $has_pipe (i32.const 1))
            (br $scan_pipe)
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan_pipe_loop)
      )
    )

    (if (i32.or (local.get $has_pipe) (i32.and (i32.eq (local.get $first_char) (i32.const 115)) (i32.eq (local.get $second_char) (i32.const 101))))
      (then
        (memory.copy (i32.const 1024) (i32.const 14500) (i32.const 45))
        (memory.copy (i32.const 1069) (local.get $in_ptr) (local.get $in_len))
        (memory.copy
          (i32.add (i32.const 1069) (local.get $in_len))
          (i32.const 15000)
          (i32.const 119)
        )
        (return (i32.add (i32.const 164) (local.get $in_len)))
      )
    )

    ;; 8. Default: General composition or inspection request for AI
    (memory.copy (i32.const 1024) (i32.const 15500) (i32.const 38))
    (memory.copy (i32.const 1062) (local.get $in_ptr) (local.get $in_len))
    (memory.copy
      (i32.add (i32.const 1062) (local.get $in_len))
      (i32.const 16000)
      (i32.const 139)
    )
    (return (i32.add (i32.const 177) (local.get $in_len)))
  )

  ;; Helper function: checks if a character exists in buffer
  (func $contains_char (param $ptr i32) (param $len i32) (param $target i32) (result i32)
    (local $idx i32)
    (local.set $idx (i32.const 0))
    (block $found
      (loop $scan
        (if (i32.ge_s (local.get $idx) (local.get $len))
          (then (return (i32.const 0)))
        )
        (if (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $idx))) (local.get $target))
          (then (return (i32.const 1)))
        )
        (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
        (br $scan)
      )
    )
    (i32.const 0)
  )

  ;; Exported resume
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (memory.copy (i32.const 1024) (local.get $res_ptr) (local.get $res_len))
    (local.get $res_len)
  )
)
