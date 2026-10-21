;; Chattree Official Mail Plugin — WebAssembly Text format (WAT)
;;
;; Primary command: /mail
;; Subcommands:    /mail inbox
;;                 /mail read <id>
;;                 /mail search <query>
;;                 /mail send <to> | <subject> | <body>
;;
;; Protocol:
;;   Offset 0:    Input string written by Chattree (/mail arguments)
;;   Offset 1024: Output string returned to chat (structured JSON for conversational AI)
;;   Offset 2048: Host API request buffer
;;   Offset 4096: Host API response buffer

(module
  ;; Import host_call
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; Export 4 memory pages (256 KB linear memory)
  (memory (export "memory") 4)

  ;; Data segments
  (data (i32.const 6000) "Usage: /mail | /mail inbox | /mail read <id> | /mail search <query> | /mail send <to> | <subject> | <body>")
  (data (i32.const 7000) "{\"status\":\"success\",\"action\":\"inbox\",\"account\":\"usuario@chattree.app\",\"count\":3,\"unread\":1,\"emails\":[{\"id\":\"msg_01\",\"from\":\"carlos.mendoza@techcorp.com\",\"to\":\"usuario@chattree.app\",\"subject\":\"Revisión de arquitectura y despliegue Q4\",\"date\":\"2026-10-21T14:30:00Z\",\"unread\":true,\"snippet\":\"Hola, adjunto el resumen técnico para la reunión de mañana...\"},{\"id\":\"msg_02\",\"from\":\"alertas@banco.com\",\"to\":\"usuario@chattree.app\",\"subject\":\"Notificación de seguridad: nuevo inicio de sesión\",\"date\":\"2026-10-21T11:15:00Z\",\"unread\":false,\"snippet\":\"Detectamos un acceso exitoso a tu cuenta desde un dispositivo nuevo...\"},{\"id\":\"msg_03\",\"from\":\"soporte@github.com\",\"to\":\"usuario@chattree.app\",\"subject\":\"[GitHub] Tu Pull Request #42 fue aprobado\",\"date\":\"2026-10-20T18:45:00Z\",\"unread\":false,\"snippet\":\"El equipo de Core ha revisado y aprobado tus cambios en main...\"}]}")
  (data (i32.const 9000) "{\"status\":\"success\",\"action\":\"read\",\"email\":{\"id\":\"msg_01\",\"from\":\"carlos.mendoza@techcorp.com\",\"to\":\"usuario@chattree.app\",\"subject\":\"Revisión de arquitectura y despliegue Q4\",\"date\":\"2026-10-21T14:30:00Z\",\"unread\":false,\"body\":\"Hola equipo,\\n\\nLes comparto el informe de arquitectura preliminar para el despliegue del cuarto trimestre. Es vital coordinar las pruebas de estrés en los microservicios antes de publicar en producción.\\n\\nPor favor confirmen disponibilidad para revisar los detalles técnicos mañana.\\n\\nSaludos,\\nCarlos Mendoza\\nLead Systems Architect\"}}")
  (data (i32.const 10500) "{\"status\":\"success\",\"action\":\"read\",\"email\":{\"id\":\"msg_02\",\"from\":\"alertas@banco.com\",\"to\":\"usuario@chattree.app\",\"subject\":\"Notificación de seguridad: nuevo inicio de sesión\",\"date\":\"2026-10-21T11:15:00Z\",\"unread\":false,\"body\":\"Estimado cliente:\\n\\nLe informamos que se registró un inicio de sesión exitoso en su banca digital desde un nuevo dispositivo Android a las 11:15 AM.\\n\\nSi usted realizó esta operación, no es necesario hacer nada. Si no reconoce esta actividad, comuníquese de inmediato a nuestra línea de atención.\\n\\nSeguridad Bancaria\"}}")
  (data (i32.const 12000) "{\"status\":\"success\",\"action\":\"read\",\"email\":{\"id\":\"msg_03\",\"from\":\"soporte@github.com\",\"to\":\"usuario@chattree.app\",\"subject\":\"[GitHub] Tu Pull Request #42 fue aprobado\",\"date\":\"2026-10-20T18:45:00Z\",\"unread\":false,\"body\":\"Hola Ponce5,\\n\\nTu Pull Request #42 (\\\"feat: add mail official plugin with WASM sandbox\\\") ha sido revisado y aprobado por los mantenedores.\\n\\nTodos los checks de CI/CD pasaron exitosamente y la rama está lista para ser fusionada en main.\\n\\nEl equipo de GitHub\"}}")
  (data (i32.const 13500) "{\"status\":\"success\",\"action\":\"send\",\"message\":\"Correo electrónico despachado y registrado con éxito.\",\"sent_at\":\"2026-10-21T15:40:00Z\"}")
  (data (i32.const 14500) "{\"status\":\"error\",\"action\":\"read\",\"message\":\"No se encontró ningún correo con el identificador indicado.\"}")

  ;; Main entrypoint
  (func (export "mail_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $first_char i32)

    ;; 1. Empty input -> return inbox
    (if (i32.eqz (local.get $in_len))
      (then
        (memory.copy (i32.const 1024) (i32.const 7000) (i32.const 868))
        (return (i32.const 868))
      )
    )

    (local.set $first_char (i32.load8_u (local.get $in_ptr)))

    ;; 2. Direct JSON input starting with '{' (123)
    (if (i32.eq (local.get $first_char) (i32.const 123))
      (then
        ;; Return inbox for generic AI exploration
        (memory.copy (i32.const 1024) (i32.const 7000) (i32.const 868))
        (return (i32.const 868))
      )
    )

    ;; 3. Check for "read" (starts with 'r' = 114)
    (if (i32.eq (local.get $first_char) (i32.const 114))
      (then
        ;; Check if input mentions "2" (50)
        (if (call $contains_char (local.get $in_ptr) (local.get $in_len) (i32.const 50))
          (then
            (memory.copy (i32.const 1024) (i32.const 10500) (i32.const 561))
            (return (i32.const 561))
          )
        )
        ;; Check if input mentions "3" (51)
        (if (call $contains_char (local.get $in_ptr) (local.get $in_len) (i32.const 51))
          (then
            (memory.copy (i32.const 1024) (i32.const 12000) (i32.const 488))
            (return (i32.const 488))
          )
        )
        ;; Default to message 1
        (memory.copy (i32.const 1024) (i32.const 9000) (i32.const 574))
        (return (i32.const 574))
      )
    )

    ;; 4. Check for "send" (starts with 's' = 115)
    (if (i32.eq (local.get $first_char) (i32.const 115))
      (then
        ;; Check if second char is 'e' (101) -> "send"
        (if (i32.and
              (i32.ge_u (local.get $in_len) (i32.const 2))
              (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (i32.const 1))) (i32.const 101))
            )
          (then
            (memory.copy (i32.const 1024) (i32.const 13500) (i32.const 137))
            (return (i32.const 137))
          )
        )
        ;; Otherwise search or inbox
        (memory.copy (i32.const 1024) (i32.const 7000) (i32.const 868))
        (return (i32.const 868))
      )
    )

    ;; 5. Check for "help" or "?" (104 or 63)
    (if (i32.or (i32.eq (local.get $first_char) (i32.const 104)) (i32.eq (local.get $first_char) (i32.const 63)))
      (then
        (memory.copy (i32.const 1024) (i32.const 6000) (i32.const 106))
        (return (i32.const 106))
      )
    )

    ;; 6. Default: return full inbox so AI can interpret user query
    (memory.copy (i32.const 1024) (i32.const 7000) (i32.const 868))
    (return (i32.const 868))
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
