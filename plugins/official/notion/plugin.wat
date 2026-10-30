;; Chattree Official Notion Integration Plugin
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; 64 pages = 4 MB sandbox linear memory
  (memory (export "memory") 64)

  (global $phase (mut i32) (i32.const 0))
  (global $token_len (mut i32) (i32.const 0))
  (global $arg_len (mut i32) (i32.const 0))
  (global $parent_len (mut i32) (i32.const 0))

  ;; Static Data Segments
  (data (i32.const 70000) "\f0\9f\93\9d **Notion Workspace Integration**\0a\0aConecta tu espacio de trabajo de Notion directamente con Chattree mediante la API oficial de Notion.\0a\0a**Comandos disponibles:**\0a\e2\80\a2 `/notion config <api_token>` \e2\80\94 Registra tu Integration Secret de Notion (`secret_...` o `ntn_...`)\0a\e2\80\a2 `/notion status` \e2\80\94 Verifica el estado de la conexi\c3\b3n con tu workspace\0a\e2\80\a2 `/notion search <t\c3\a9rmino>` \e2\80\94 Busca p\c3\a1ginas y bases de datos por palabra clave\0a\e2\80\a2 `/notion list` \e2\80\94 Muestra p\c3\a1ginas editadas recientemente\0a\e2\80\a2 `/notion create <t\c3\adtulo>` \e2\80\94 Crea una nueva p\c3\a1gina en tu espacio de trabajo\0a\e2\80\a2 `/notion disconnect` \e2\80\94 Desconecta y borra tu token guardado\0a\0a*\c2\bfC\c3\b3mo obtener tu clave?*\0a1. Ve a **notion.so/profile/integrations** (My integrations).\0a2. Crea una integraci\c3\b3n interna y copia el **Internal Integration Secret**.\0a3. En Notion, ve a una p\c3\a1gina y en el men\c3\ba **'...'** -> **Conexiones** (Add connections) a\c3\b1ade tu integraci\c3\b3n.")
  (data (i32.const 70945) "\e2\9c\85 **Notion configurado y verificado exitosamente.**\0a\0aTu token de integraci\c3\b3n est\c3\a1 activo y listo para usar.\0a\0aPrueba los siguientes comandos:\0a\e2\80\a2 `/notion search <texto>` \e2\80\94 Buscar en tus p\c3\a1ginas\0a\e2\80\a2 `/notion list` \e2\80\94 Ver p\c3\a1ginas recientes\0a\e2\80\a2 `/notion create <t\c3\adtulo>` \e2\80\94 Crear una nueva p\c3\a1gina")
  (data (i32.const 71266) "\e2\9a\a0\ef\b8\8f **Token guardado pero no se pudo validar con Notion.**\0a\0aNotion devolvi\c3\b3 un error de autenticaci\c3\b3n. Verifica que tu token sea un 'Internal Integration Secret' v\c3\a1lido creado en notion.so/profile/integrations y que est\c3\a9 activo.")
  (data (i32.const 71517) "\e2\9a\a0\ef\b8\8f **Notion no est\c3\a1 configurado.**\0a\0aPor favor registra tu API Token ejecutando:\0a`/notion config <tu_integration_secret>`\0a\0aPuedes obtener tu clave en https://notion.so/profile/integrations")
  (data (i32.const 71725) "\e2\9c\85 **Desconectado de Notion.**\0a\0aSe ha eliminado tu token de integraci\c3\b3n de este dispositivo.")
  (data (i32.const 71835) "\e2\9c\85 **Conexi\c3\b3n con Notion activa y saludable.**\0a\0a\e2\80\a2 **API:** Notion API v1 (2022-06-28)\0a\e2\80\a2 **Integraci\c3\b3n:** Autenticada y lista\0a\e2\80\a2 **Funcionalidades:** B\c3\basqueda, lectura y creaci\c3\b3n de p\c3\a1ginas\0a\0aPuedes buscar contenido con `/notion search` o crear p\c3\a1ginas con `/notion create <t\c3\adtulo>`.")
  (data (i32.const 72145) "\e2\9d\8c **No se pudo conectar a Notion.**\0a\0aEl token guardado no es v\c3\a1lido o ha expirado. Configura uno nuevo con:\0a`/notion config <tu_token>`")
  (data (i32.const 72299) "\f0\9f\93\9d **Resultados en Notion:**\0a\0a")
  (data (i32.const 72347) "\e2\84\b9\ef\b8\8f **No se encontraron resultados en Notion.**\0a\0aRecuerda que para que una p\c3\a1gina o base de datos aparezca en las b\c3\basquedas, debes compartirla con tu integraci\c3\b3n en Notion (Men\c3\ba **'...'** -> **Conexiones** / Add connections -> Tu Integraci\c3\b3n).")
  (data (i32.const 72614) "\e2\9d\8c **Error al buscar en Notion.**\0a\0aVerifica tu conexi\c3\b3n y comprueba que tu token siga siendo v\c3\a1lido con `/notion status`.")
  (data (i32.const 72754) "\e2\9a\a0\ef\b8\8f **No se encontr\c3\b3 ninguna p\c3\a1gina base en tu espacio de trabajo de Notion.**\0a\0aNotion requiere que las p\c3\a1ginas nuevas se creen dentro de una p\c3\a1gina existente compartida. Por favor abre Notion, ve a una p\c3\a1gina y en el men\c3\ba **'...'** -> **Conexiones** a\c3\b1ade tu integraci\c3\b3n.")
  (data (i32.const 73053) "\e2\9c\85 **P\c3\a1gina creada exitosamente en Notion:**\0a\0a\f0\9f\93\84 [**")
  (data (i32.const 73125) "**](")
  (data (i32.const 73145) ")\0a\0aTu nueva nota ya est\c3\a1 disponible en tu espacio de trabajo de Notion.")
  (data (i32.const 73233) "\e2\9d\8c **Error al crear la p\c3\a1gina en Notion.**\0a\0aVerifica que la integraci\c3\b3n tenga permisos de edici\c3\b3n en la p\c3\a1gina compartida.")
  (data (i32.const 73376) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22api_token\22}}")
  (data (i32.const 73457) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22api_token\22,\22value\22:\22")
  (data (i32.const 73546) "\22}}")
  (data (i32.const 73565) "{\22api\22:\22storage\22,\22operation\22:\22delete\22,\22payload\22:{\22key\22:\22api_token\22}}")
  (data (i32.const 73649) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.notion.com/v1/users/me\22,\22method\22:\22GET\22,\22headers\22:{\22Authorization\22:\22Bearer ")
  (data (i32.const 73813) "\22,\22Notion-Version\22:\222022-06-28\22,\22Content-Type\22:\22application/json\22},\22timeoutMs\22:20000}}")
  (data (i32.const 73915) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.notion.com/v1/search\22,\22method\22:\22POST\22,\22headers\22:{\22Authorization\22:\22Bearer ")
  (data (i32.const 74078) "\22,\22Notion-Version\22:\222022-06-28\22,\22Content-Type\22:\22application/json\22},\22body\22:\22{\5c\22query\5c\22:\5c\22")
  (data (i32.const 74182) "\5c\22,\5c\22page_size\5c\22:5,\5c\22sort\5c\22:{\5c\22direction\5c\22:\5c\22descending\5c\22,\5c\22timestamp\5c\22:\5c\22last_edited_time\5c\22}}\22,\22timeoutMs\22:25000}}")
  (data (i32.const 74313) "\22,\22Notion-Version\22:\222022-06-28\22,\22Content-Type\22:\22application/json\22},\22body\22:\22{\5c\22page_size\5c\22:5,\5c\22sort\5c\22:{\5c\22direction\5c\22:\5c\22descending\5c\22,\5c\22timestamp\5c\22:\5c\22last_edited_time\5c\22}}\22,\22timeoutMs\22:25000}}")
  (data (i32.const 74517) "\22,\22Notion-Version\22:\222022-06-28\22,\22Content-Type\22:\22application/json\22},\22body\22:\22{\5c\22page_size\5c\22:1,\5c\22filter\5c\22:{\5c\22value\5c\22:\5c\22page\5c\22,\5c\22property\5c\22:\5c\22object\5c\22}}\22,\22timeoutMs\22:20000}}")
  (data (i32.const 74702) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.notion.com/v1/pages\22,\22method\22:\22POST\22,\22headers\22:{\22Authorization\22:\22Bearer ")
  (data (i32.const 74864) "\22,\22Notion-Version\22:\222022-06-28\22,\22Content-Type\22:\22application/json\22},\22body\22:\22{\5c\22parent\5c\22:{\5c\22page_id\5c\22:\5c\22")
  (data (i32.const 74982) "\5c\22},\5c\22properties\5c\22:{\5c\22title\5c\22:[{\5c\22text\5c\22:{\5c\22content\5c\22:\5c\22")
  (data (i32.const 75054) "\5c\22}}]}}\22,\22timeoutMs\22:25000}}")
  (data (i32.const 75098) "secret_")
  (data (i32.const 75121) "ntn_")
  (data (i32.const 75141) "config")
  (data (i32.const 75163) "token")
  (data (i32.const 75184) "status")
  (data (i32.const 75206) "test")
  (data (i32.const 75226) "me")
  (data (i32.const 75244) "disconnect")
  (data (i32.const 75270) "desconectar")
  (data (i32.const 75297) "search")
  (data (i32.const 75319) "buscar")
  (data (i32.const 75341) "list")
  (data (i32.const 75361) "pages")
  (data (i32.const 75382) "create")
  (data (i32.const 75404) "crear")
  (data (i32.const 75425) "nueva")
  (data (i32.const 75446) "help")
  (data (i32.const 75466) "\22value\22:\22")
  (data (i32.const 75491) "\22statusCode\22:200")
  (data (i32.const 75523) "\22results\22:[]")
  (data (i32.const 75551) "\22results\22:[")
  (data (i32.const 75578) "\22id\22:\22")
  (data (i32.const 75600) "\22url\22:\22https://")
  (data (i32.const 75631) "\22plain_text\22:\22")
  (data (i32.const 75661) "\22content\22:\22")
  (data (i32.const 75688) "\e2\80\a2 \f0\9f\93\84 [")
  (data (i32.const 75714) "](")
  (data (i32.const 75732) ")\0a")

  (func $copy_mem (param $src i32) (param $dst i32) (param $len i32) (result i32)
    (memory.copy (local.get $dst) (local.get $src) (local.get $len))
    (i32.add (local.get $dst) (local.get $len))
  )

  (func $to_lower (param $src i32) (param $dst i32) (param $len i32)
    (local $i i32)
    (local $ch i32)
    (local.set $i (i32.const 0))
    (loop $l_loop
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 65)) (i32.le_u (local.get $ch) (i32.const 90)))
            (then
              (local.set $ch (i32.add (local.get $ch) (i32.const 32)))
            )
          )
          (i32.store8 (i32.add (local.get $dst) (local.get $i)) (local.get $ch))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l_loop)
        )
      )
    )
  )

  (func $find_substring (param $haystack i32) (param $h_len i32) (param $needle i32) (param $n_len i32) (result i32)
    (local $i i32)
    (local $j i32)
    (local $match i32)
    (local.set $i (i32.const 0))
    (block $found
      (loop $outer
        (if (i32.gt_u (i32.add (local.get $i) (local.get $n_len)) (local.get $h_len))
          (then (return (i32.const -1)))
        )
        (local.set $j (i32.const 0))
        (local.set $match (i32.const 1))
        (loop $inner
          (if (i32.lt_u (local.get $j) (local.get $n_len))
            (then
              (if (i32.ne
                    (i32.load8_u (i32.add (local.get $haystack) (i32.add (local.get $i) (local.get $j))))
                    (i32.load8_u (i32.add (local.get $needle) (local.get $j))))
                (then
                  (local.set $match (i32.const 0))
                )
                (else
                  (local.set $j (i32.add (local.get $j) (i32.const 1)))
                  (br $inner)
                )
              )
            )
          )
        )
        (if (local.get $match)
          (then (return (local.get $i)))
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $outer)
      )
    )
    (i32.const -1)
  )

  ;; Loads stored API Token into 1001000
  (func $load_api_token (result i32)
    (local $res_len i32)
    (local $val_idx i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)

    (local.set $res_len (call $host_call (i32.const 73376) (i32.const 65) (i32.const 1000000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 1000000) (local.get $res_len) (i32.const 75466) (i32.const 9)))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_start (i32.add (i32.const 1000000) (i32.add (local.get $val_idx) (i32.const 9))))
    (local.set $i (i32.const 0))
    (loop $copy_key
      (if (i32.lt_u (local.get $i) (i32.const 200))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
          (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 0)))
            (then
              (i32.store8 (i32.add (i32.const 1001000) (local.get $i)) (local.get $ch))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $copy_key)
            )
          )
        )
      )
    )
    (global.set $token_len (local.get $i))
    (local.get $i)
  )

  ;; Sanitizes raw text into 1002000 (replaces double quotes with single quotes, backslashes with /)
  (func $sanitize_text (param $src i32) (param $len i32) (result i32)
    (local $i i32)
    (local $ch i32)
    (local $out_ptr i32)
    (local.set $i (i32.const 0))
    (local.set $out_ptr (i32.const 1002000))
    (loop $s_loop
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.eq (local.get $ch) (i32.const 34))
            (then (local.set $ch (i32.const 39)))
          )
          (if (i32.eq (local.get $ch) (i32.const 92))
            (then (local.set $ch (i32.const 47)))
          )
          (if (i32.or (i32.eq (local.get $ch) (i32.const 10)) (i32.eq (local.get $ch) (i32.const 13)))
            (then (local.set $ch (i32.const 32)))
          )
          (i32.store8 (local.get $out_ptr) (local.get $ch))
          (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 1)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $s_loop)
        )
      )
    )
    (global.set $arg_len (local.get $i))
    (local.get $i)
  )

  ;; Main entrypoint
  (func (export "notion_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $pos i32)
    (local $token_start i32)
    (local $raw_len i32)
    (local $p i32)
    (local $req_len i32)
    (local $i i32)
    (local $ch i32)

    ;; 1. Check for empty input -> return Help
    (if (i32.eqz (local.get $in_len))
      (then
        (drop (call $copy_mem (i32.const 70000) (i32.const 1024) (i32.const 929)))
        (return (i32.const 929))
      )
    )

    ;; Lowercase input into 1003000 for keyword detection
    (call $to_lower (local.get $in_ptr) (i32.const 1003000) (local.get $in_len))

    ;; 2. Check for "help"
    (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75446) (i32.const 4)))
    (if (i32.ge_s (local.get $pos) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 70000) (i32.const 1024) (i32.const 929)))
        (return (i32.const 929))
      )
    )

    ;; 3. Check for "disconnect" / "desconectar"
    (if (i32.or
          (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75244) (i32.const 10)) (i32.const 0))
          (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75270) (i32.const 11)) (i32.const 0)))
      (then
        (drop (call $host_call (i32.const 73565) (i32.const 68) (i32.const 1000000) (i32.const 1024)))
        (drop (call $copy_mem (i32.const 71725) (i32.const 1024) (i32.const 94)))
        (return (i32.const 94))
      )
    )

    ;; 4. Check for direct secret_ or ntn_ or "config" / "token"
    (local.set $token_start (i32.const -1))
    (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 75098) (i32.const 7)))
    (if (i32.ge_s (local.get $pos) (i32.const 0))
      (then (local.set $token_start (i32.add (local.get $in_ptr) (local.get $pos))))
      (else
        (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 75121) (i32.const 4)))
        (if (i32.ge_s (local.get $pos) (i32.const 0))
          (then (local.set $token_start (i32.add (local.get $in_ptr) (local.get $pos))))
          (else
            (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75141) (i32.const 6)))
            (if (i32.ge_s (local.get $pos) (i32.const 0))
              (then (local.set $token_start (i32.add (i32.add (local.get $in_ptr) (local.get $pos)) (i32.const 6))))
              (else
                (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75163) (i32.const 5)))
                (if (i32.ge_s (local.get $pos) (i32.const 0))
                  (then (local.set $token_start (i32.add (i32.add (local.get $in_ptr) (local.get $pos)) (i32.const 5))))
                )
              )
            )
          )
        )
      )
    )

    ;; If config / token was detected, extract and save token, then test via /v1/users/me
    (if (i32.ge_s (local.get $token_start) (i32.const 0))
      (then
        ;; Skip leading whitespace
        (loop $skip_lead_ws
          (if (i32.lt_u (local.get $token_start) (i32.add (local.get $in_ptr) (local.get $in_len)))
            (then
              (local.set $ch (i32.load8_u (local.get $token_start)))
              (if (i32.or (i32.eq (local.get $ch) (i32.const 32)) (i32.eq (local.get $ch) (i32.const 58)))
                (then
                  (local.set $token_start (i32.add (local.get $token_start) (i32.const 1)))
                  (br $skip_lead_ws)
                )
              )
            )
          )
        )

        ;; Read token chars
        (local.set $i (i32.const 0))
        (loop $scan_token
          (if (i32.lt_u (i32.add (local.get $token_start) (local.get $i)) (i32.add (local.get $in_ptr) (local.get $in_len)))
            (then
              (if (i32.lt_u (local.get $i) (i32.const 120))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $token_start) (local.get $i))))
                  (if (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                    (then
                      (i32.store8 (i32.add (i32.const 1001000) (local.get $i)) (local.get $ch))
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $scan_token)
                    )
                  )
                )
              )
            )
          )
        )
        (global.set $token_len (local.get $i))

        (if (i32.gt_u (global.get $token_len) (i32.const 8))
          (then
            ;; Save to storage.set
            (local.set $p (call $copy_mem (i32.const 73457) (i32.const 100000) (i32.const 73)))
            (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const 73546) (local.get $p) (i32.const 3)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 1024)))

            ;; Prepare verification GET /v1/users/me
            (local.set $p (call $copy_mem (i32.const 73649) (i32.const 100000) (i32.const 148)))
            (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const 73813) (local.get $p) (i32.const 86)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

            (global.set $phase (i32.const 1)) ;; Phase 1: Verify token on config
            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 400000)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; 5. Check for "status" / "me" / "test"
    (if (i32.or
          (i32.or
            (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75184) (i32.const 6)) (i32.const 0))
            (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75226) (i32.const 2)) (i32.const 0)))
          (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75206) (i32.const 4)) (i32.const 0)))
      (then
        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then
            (drop (call $copy_mem (i32.const 71517) (i32.const 1024) (i32.const 192)))
            (return (i32.const 192))
          )
        )

        ;; Build GET /v1/users/me
        (local.set $p (call $copy_mem (i32.const 73649) (i32.const 100000) (i32.const 148)))
        (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_mem (i32.const 73813) (local.get $p) (i32.const 86)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (global.set $phase (i32.const 2)) ;; Phase 2: Status check
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 400000)))
        (return (i32.const 0))
      )
    )

    ;; 6. Check for "create" / "crear" / "nueva"
    (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75382) (i32.const 6)))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75404) (i32.const 5)))
      )
    )
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75425) (i32.const 5)))
      )
    )

    (if (i32.ge_s (local.get $pos) (i32.const 0))
      (then
        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then
            (drop (call $copy_mem (i32.const 71517) (i32.const 1024) (i32.const 192)))
            (return (i32.const 192))
          )
        )

        ;; Extract title after trigger word
        (local.set $token_start (i32.add (local.get $in_ptr) (i32.add (local.get $pos) (i32.const 6))))
        (loop $skip_lead_create
          (if (i32.lt_u (local.get $token_start) (i32.add (local.get $in_ptr) (local.get $in_len)))
            (then
              (local.set $ch (i32.load8_u (local.get $token_start)))
              (if (i32.or (i32.eq (local.get $ch) (i32.const 32)) (i32.eq (local.get $ch) (i32.const 58)))
                (then
                  (local.set $token_start (i32.add (local.get $token_start) (i32.const 1)))
                  (br $skip_lead_create)
                )
              )
            )
          )
        )

        (local.set $raw_len (i32.sub (i32.add (local.get $in_ptr) (local.get $in_len)) (local.get $token_start)))
        (if (i32.le_s (local.get $raw_len) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 70000) (i32.const 1024) (i32.const 929)))
            (return (i32.const 929))
          )
        )

        ;; Sanitize title into 1002000
        (drop (call $sanitize_text (local.get $token_start) (local.get $raw_len)))

        ;; Step 4A: Search for parent page
        (local.set $p (call $copy_mem (i32.const 73915) (i32.const 100000) (i32.const 147)))
        (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_mem (i32.const 74517) (local.get $p) (i32.const 169)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (global.set $phase (i32.const 4)) ;; Phase 4: Find Parent Page for create
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 400000)))
        (return (i32.const 0))
      )
    )

    ;; 7. Default or Search / List action
    (local.set $raw_len (call $load_api_token))
    (if (i32.eqz (local.get $raw_len))
      (then
        (drop (call $copy_mem (i32.const 71517) (i32.const 1024) (i32.const 192)))
        (return (i32.const 192))
      )
    )

    ;; Check if search or list keyword present
    (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75297) (i32.const 6)))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75319) (i32.const 6)))
      )
    )

    (if (i32.ge_s (local.get $pos) (i32.const 0))
      (then
        ;; Extract query after "search" or "buscar"
        (local.set $token_start (i32.add (local.get $in_ptr) (i32.add (local.get $pos) (i32.const 6))))
        (loop $skip_lead_search
          (if (i32.lt_u (local.get $token_start) (i32.add (local.get $in_ptr) (local.get $in_len)))
            (then
              (local.set $ch (i32.load8_u (local.get $token_start)))
              (if (i32.or (i32.eq (local.get $ch) (i32.const 32)) (i32.eq (local.get $ch) (i32.const 58)))
                (then
                  (local.set $token_start (i32.add (local.get $token_start) (i32.const 1)))
                  (br $skip_lead_search)
                )
              )
            )
          )
        )
        (local.set $raw_len (i32.sub (i32.add (local.get $in_ptr) (local.get $in_len)) (local.get $token_start)))
        (if (i32.gt_s (local.get $raw_len) (i32.const 0))
          (then
            (drop (call $sanitize_text (local.get $token_start) (local.get $raw_len)))
          )
          (else
            (global.set $arg_len (i32.const 0))
          )
        )
      )
      (else
        ;; Check if input is list / pages
        (if (i32.or
              (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75341) (i32.const 4)) (i32.const 0))
              (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75361) (i32.const 5)) (i32.const 0)))
          (then
            (global.set $arg_len (i32.const 0))
          )
          (else
            ;; Entire input is query if not a command
            (drop (call $sanitize_text (local.get $in_ptr) (local.get $in_len)))
          )
        )
      )
    )

    ;; Build Search Request
    (local.set $p (call $copy_mem (i32.const 73915) (i32.const 100000) (i32.const 147)))
    (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))

    (if (i32.gt_u (global.get $arg_len) (i32.const 0))
      (then
        (local.set $p (call $copy_mem (i32.const 74078) (local.get $p) (i32.const 88)))
        (local.set $p (call $copy_mem (i32.const 1002000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_mem (i32.const 74182) (local.get $p) (i32.const 115)))
      )
      (else
        (local.set $p (call $copy_mem (i32.const 74313) (local.get $p) (i32.const 188)))
      )
    )
    (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

    (global.set $phase (i32.const 3)) ;; Phase 3: Search
    (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 400000)))
    (i32.const 0)
  )

  ;; Resume handler called when async host_call returns
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $is_200 i32)
    (local $idx i32)
    (local $p i32)
    (local $req_len i32)
    (local $scan_ptr i32)
    (local $scan_end i32)
    (local $item_count i32)
    (local $url_start i32)
    (local $url_len i32)
    (local $title_start i32)
    (local $title_len i32)
    (local $i i32)
    (local $ch i32)

    ;; Check if HTTP status is 200
    (local.set $idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 75491) (i32.const 16)))
    (local.set $is_200 (i32.ge_s (local.get $idx) (i32.const 0)))

    ;; ─── Phase 1: Config Verification ───
    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        (if (local.get $is_200)
          (then
            (drop (call $copy_mem (i32.const 70945) (i32.const 1024) (i32.const 305)))
            (return (i32.const 305))
          )
          (else
            (drop (call $copy_mem (i32.const 71266) (i32.const 1024) (i32.const 235)))
            (return (i32.const 235))
          )
        )
      )
    )

    ;; ─── Phase 2: Status Check ───
    (if (i32.eq (global.get $phase) (i32.const 2))
      (then
        (if (local.get $is_200)
          (then
            (drop (call $copy_mem (i32.const 71835) (i32.const 1024) (i32.const 294)))
            (return (i32.const 294))
          )
          (else
            (drop (call $copy_mem (i32.const 72145) (i32.const 1024) (i32.const 138)))
            (return (i32.const 138))
          )
        )
      )
    )

    ;; ─── Phase 3: Search / List ───
    (if (i32.eq (global.get $phase) (i32.const 3))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            (drop (call $copy_mem (i32.const 72614) (i32.const 1024) (i32.const 124)))
            (return (i32.const 124))
          )
        )

        ;; Check if empty results "results":[]
        (local.set $idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 75523) (i32.const 12)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 72347) (i32.const 1024) (i32.const 251)))
            (return (i32.const 251))
          )
        )

        ;; Start output buffer at 1024 with header
        (local.set $p (call $copy_mem (i32.const 72299) (i32.const 1024) (i32.const 32)))

        ;; Scan results list for up to 5 items
        (local.set $scan_ptr (local.get $res_ptr))
        (local.set $scan_end (i32.add (local.get $res_ptr) (local.get $res_len)))
        (local.set $item_count (i32.const 0))

        (loop $parse_items
          (if (i32.and (i32.lt_u (local.get $item_count) (i32.const 5)) (i32.lt_u (local.get $scan_ptr) (local.get $scan_end)))
            (then
              ;; Find next url
              (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const 75600) (i32.const 15)))
              (if (i32.ge_s (local.get $idx) (i32.const 0))
                (then
                  (local.set $url_start (i32.add (i32.add (local.get $scan_ptr) (local.get $idx)) (i32.const 7)))
                  (local.set $i (i32.const 0))
                  (loop $find_url_end
                    (if (i32.lt_u (i32.add (local.get $url_start) (local.get $i)) (local.get $scan_end))
                      (then
                        (if (i32.ne (i32.load8_u (i32.add (local.get $url_start) (local.get $i))) (i32.const 34))
                          (then
                            (local.set $i (i32.add (local.get $i) (i32.const 1)))
                            (br $find_url_end)
                          )
                        )
                      )
                    )
                  )
                  (local.set $url_len (local.get $i))

                  ;; Look for plain_text or content within 600 bytes before or after URL
                  (local.set $title_start (local.get $url_start))
                  (local.set $title_len (i32.const 6)) ;; default: "Página"
                  (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const 75631) (i32.const 14)))
                  (if (i32.ge_s (local.get $idx) (i32.const 0))
                    (then
                      (local.set $title_start (i32.add (i32.add (local.get $scan_ptr) (local.get $idx)) (i32.const 14)))
                      (local.set $i (i32.const 0))
                      (loop $find_title_end
                        (if (i32.and (i32.lt_u (local.get $i) (i32.const 80)) (i32.lt_u (i32.add (local.get $title_start) (local.get $i)) (local.get $scan_end)))
                          (then
                            (if (i32.ne (i32.load8_u (i32.add (local.get $title_start) (local.get $i))) (i32.const 34))
                              (then
                                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                                (br $find_title_end)
                              )
                            )
                          )
                        )
                      )
                      (local.set $title_len (local.get $i))
                    )
                  )

                  ;; Write line: • 📄 [Title](URL)

                  (local.set $p (call $copy_mem (i32.const 75688) (local.get $p) (i32.const 10)))
                  (if (i32.gt_u (local.get $title_len) (i32.const 0))
                    (then (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len))))
                    (else (local.set $p (call $copy_mem (i32.const 75361) (local.get $p) (i32.const 5))))
                  )
                  (local.set $p (call $copy_mem (i32.const 75714) (local.get $p) (i32.const 2)))
                  (local.set $p (call $copy_mem (local.get $url_start) (local.get $p) (local.get $url_len)))
                  (local.set $p (call $copy_mem (i32.const 75732) (local.get $p) (i32.const 2)))

                  (local.set $item_count (i32.add (local.get $item_count) (i32.const 1)))
                  (local.set $scan_ptr (i32.add (local.get $url_start) (local.get $url_len)))
                  (br $parse_items)
                )
              )
            )
          )
        )

        (if (i32.eqz (local.get $item_count))
          (then
            (drop (call $copy_mem (i32.const 72347) (i32.const 1024) (i32.const 251)))
            (return (i32.const 251))
          )
        )

        (return (i32.sub (local.get $p) (i32.const 1024)))
      )
    )

    ;; ─── Phase 4: Create Step 1 (Parent Search response) ───
    (if (i32.eq (global.get $phase) (i32.const 4))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            (drop (call $copy_mem (i32.const 72754) (i32.const 1024) (i32.const 283)))
            (return (i32.const 283))
          )
        )

        ;; Find first "id":" in results
        (local.set $idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 75578) (i32.const 6)))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 72754) (i32.const 1024) (i32.const 283)))
            (return (i32.const 283))
          )
        )

        ;; Extract 36-char ID into 1004000
        (local.set $url_start (i32.add (i32.add (local.get $res_ptr) (local.get $idx)) (i32.const 6)))
        (local.set $i (i32.const 0))
        (loop $copy_parent_id
          (if (i32.lt_u (local.get $i) (i32.const 36))
            (then
              (local.set $ch (i32.load8_u (i32.add (local.get $url_start) (local.get $i))))
              (if (i32.ne (local.get $ch) (i32.const 34))
                (then
                  (i32.store8 (i32.add (i32.const 1004000) (local.get $i)) (local.get $ch))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $copy_parent_id)
                )
              )
            )
          )
        )
        (global.set $parent_len (local.get $i))

        ;; Step 4B: Build POST /v1/pages
        (local.set $p (call $copy_mem (i32.const 74702) (i32.const 100000) (i32.const 146)))
        (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_mem (i32.const 74864) (local.get $p) (i32.const 102)))
        (local.set $p (call $copy_mem (i32.const 1004000) (local.get $p) (global.get $parent_len)))
        (local.set $p (call $copy_mem (i32.const 74982) (local.get $p) (i32.const 56)))
        (local.set $p (call $copy_mem (i32.const 1002000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_mem (i32.const 75054) (local.get $p) (i32.const 28)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (global.set $phase (i32.const 5)) ;; Phase 5: Create Page POST
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 400000)))
        (return (i32.const 0))
      )
    )

    ;; ─── Phase 5: Create Step 2 (Page Created response) ───
    (if (i32.eq (global.get $phase) (i32.const 5))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            (drop (call $copy_mem (i32.const 73233) (i32.const 1024) (i32.const 127)))
            (return (i32.const 127))
          )
        )

        ;; Extract "url":"https://...
        (local.set $idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 75600) (i32.const 15)))
        (local.set $url_start (local.get $res_ptr))
        (local.set $url_len (i32.const 0))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (local.set $url_start (i32.add (i32.add (local.get $res_ptr) (local.get $idx)) (i32.const 7)))
            (local.set $i (i32.const 0))
            (loop $find_c_url_end
              (if (i32.lt_u (i32.add (local.get $url_start) (local.get $i)) (i32.add (local.get $res_ptr) (local.get $res_len)))
                (then
                  (if (i32.ne (i32.load8_u (i32.add (local.get $url_start) (local.get $i))) (i32.const 34))
                    (then
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $find_c_url_end)
                    )
                  )
                )
              )
            )
            (local.set $url_len (local.get $i))
          )
        )

        (local.set $p (call $copy_mem (i32.const 73053) (i32.const 1024) (i32.const 56)))
        (local.set $p (call $copy_mem (i32.const 1002000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_mem (i32.const 73125) (local.get $p) (i32.const 4)))
        (local.set $p (call $copy_mem (local.get $url_start) (local.get $p) (local.get $url_len)))
        (local.set $p (call $copy_mem (i32.const 73145) (local.get $p) (i32.const 72)))

        (return (i32.sub (local.get $p) (i32.const 1024)))
      )
    )

    (drop (call $copy_mem (i32.const 70000) (i32.const 1024) (i32.const 929)))
    (i32.const 929)
  )
)
