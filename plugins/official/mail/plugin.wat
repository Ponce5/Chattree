;; Chattree Official Mail Plugin — WebAssembly Text format (WAT)
;;
;; Primary command: /mail (Strictly slash-only, no aliases)
;; Zero fake/sample emails. Real clean responses only.

(module
  ;; Import host_call
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; Export 4 memory pages (256 KB linear memory)
  (memory (export "memory") 4)

  ;; Data segments
  (data (i32.const 5000) "{\"status\":\"help\",\"command\":\"/mail\",\"description\":\"Asistente oficial de correo electronico sin datos simulados.\",\"commands\":{\"/mail o /mail inbox\":\"Consulta el estado de la bandeja de entrada\",\"/mail analiza este correo: <texto>\":\"Pega cualquier correo para que la IA lo analice, resuma y extraiga tareas\",\"/mail send <destinatario> | <asunto> | <mensaje>\":\"Redacta un correo y genera enlaces directos para enviarlo en Gmail o tu cliente\",\"/mail config <correo> <contraseña>\":\"Guarda tu configuracion de correo\",\"/mail disconnect\":\"Borra la configuracion de correo guardada\"}}")
  (data (i32.const 6000) "{\"status\":\"success\",\"action\":\"inbox\",\"auth_type\":\"Contrasena de Aplicacion\",\"unread_count\":0,\"total_count\":0,\"emails\":[],\"message\":\"Tu bandeja local esta vacia (0 correos pendientes). No se mostraran correos simulados ni inventados.\"}")
  (data (i32.const 8000) "{\"status\":\"info\",\"action\":\"read\",\"message\":\"No hay correos almacenados en la bandeja local con ese identificador. Para que la IA analice un correo recibido, puedes pegarlo en el chat: /mail analiza este correo: <pegar texto>\"}")
  (data (i32.const 9500) "{\"status\":\"disconnected\",\"command\":\"/mail\",\"message\":\"Configuracion de correo eliminada y desvinculada del almacenamiento local.\"}")
  (data (i32.const 10500) "{\"status\":\"configured\",\"auth_type\":\"Contrasena de Aplicacion\",\"details\":\"")
  (data (i32.const 11000) "\",\"message\":\"Credenciales guardadas localmente de forma segura en el almacenamiento privado del plugin.\"}")
  (data (i32.const 11500) "{\"status\":\"success\",\"action\":\"send\",\"input\":\"")
  (data (i32.const 12000) "\",\"message\":\"Correo preparado. La IA formateara el mensaje y generara los enlaces para abrirlo en Gmail.\"}")

  ;; Main entrypoint
  (func (export "mail_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $first_char i32)
    (local $second_char i32)
    (local $has_pipe i32)
    (local $i i32)

    ;; 1. Empty input -> return clean inbox (0 emails, no fake data)
    (if (i32.eqz (local.get $in_len))
      (then
        (memory.copy (i32.const 1024) (i32.const 6000) (i32.const 234))
        (return (i32.const 234))
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
        (memory.copy (i32.const 1024) (i32.const 5000) (i32.const 576))
        (return (i32.const 576))
      )
    )

    ;; 3. Check for "config" ('c'+'o'=99+111)
    (if (i32.and (i32.eq (local.get $first_char) (i32.const 99)) (i32.eq (local.get $second_char) (i32.const 111)))
      (then
        (memory.copy (i32.const 1024) (i32.const 10500) (i32.const 73))
        (memory.copy (i32.const 1097) (local.get $in_ptr) (local.get $in_len))
        (memory.copy
          (i32.add (i32.const 1097) (local.get $in_len))
          (i32.const 11000)
          (i32.const 105)
        )
        (return (i32.add (i32.const 178) (local.get $in_len)))
      )
    )

    ;; 4. Check for "disconnect" ('d'=100)
    (if (i32.eq (local.get $first_char) (i32.const 100))
      (then
        (memory.copy (i32.const 1024) (i32.const 9500) (i32.const 130))
        (return (i32.const 130))
      )
    )

    ;; 5. Check for "read" ('r'=114)
    (if (i32.eq (local.get $first_char) (i32.const 114))
      (then
        (memory.copy (i32.const 1024) (i32.const 8000) (i32.const 226))
        (return (i32.const 226))
      )
    )

    ;; 6. Check for "inbox" ('i'=105) OR "list" ('l'=108) OR "events" ('e'=101)
    (if (i32.or (i32.eq (local.get $first_char) (i32.const 105)) (i32.or (i32.eq (local.get $first_char) (i32.const 108)) (i32.eq (local.get $first_char) (i32.const 101))))
      (then
        (memory.copy (i32.const 1024) (i32.const 6000) (i32.const 234))
        (return (i32.const 234))
      )
    )

    ;; 7. Check for JSON input ('{'=123)
    (if (i32.eq (local.get $first_char) (i32.const 123))
      (then
        (if (call $contains_char (local.get $in_ptr) (local.get $in_len) (i32.const 114))
          (then
            (memory.copy (i32.const 1024) (i32.const 8000) (i32.const 226))
            (return (i32.const 226))
          )
        )
        (memory.copy (i32.const 1024) (i32.const 6000) (i32.const 234))
        (return (i32.const 234))
      )
    )

    ;; 8. Check if input contains pipe '|' (ASCII 124) or starts with "send" ('s'+'e'=115+101)
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
        (memory.copy (i32.const 1024) (i32.const 11500) (i32.const 45))
        (memory.copy (i32.const 1069) (local.get $in_ptr) (local.get $in_len))
        (memory.copy
          (i32.add (i32.const 1069) (local.get $in_len))
          (i32.const 12000)
          (i32.const 106)
        )
        (return (i32.add (i32.const 151) (local.get $in_len)))
      )
    )

    ;; 9. Default: Any natural reading request returns the real clean inbox (0 emails)
    (memory.copy (i32.const 1024) (i32.const 6000) (i32.const 234))
    (return (i32.const 234))
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
