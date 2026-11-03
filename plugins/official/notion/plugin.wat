;; Chattree Official Notion Integration Plugin v1.1.0
;; Adds full page content (children paragraph blocks) on create,
;; so AI-generated text is written as body, not just title.
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; 64 pages = 4 MB sandbox linear memory
  (memory (export "memory") 64)

  (global $phase       (mut i32) (i32.const 0))
  (global $token_len   (mut i32) (i32.const 0))
  (global $arg_len     (mut i32) (i32.const 0))  ;; title length (sanitized)
  (global $body_len    (mut i32) (i32.const 0))  ;; content/body length (sanitized)
  (global $parent_len  (mut i32) (i32.const 0))

  ;; ── Static Data Segments ─────────────────────────────────────────────────

  ;; [70000] Help text
  (data (i32.const 70000) "\f0\9f\93\9d **Notion Workspace Integration**\0a\0aConecta tu espacio de trabajo de Notion directamente con Chattree mediante la API oficial de Notion con soporte total para lenguaje natural y comandos.\0a\0a**Comandos disponibles:**\0a\e2\80\a2 `/notion config <api_token>` \e2\80\94 Registra tu Integration Secret de Notion (`secret_...` o `ntn_...`)\0a\e2\80\a2 `/notion status` \e2\80\94 Verifica el estado de la conexi\c3\b3n con tu workspace\0a\e2\80\a2 `/notion search <t\c3\a9rmino>` \e2\80\94 Busca p\c3\a1ginas y bases de datos por palabra clave\0a\e2\80\a2 `/notion list` \e2\80\94 Muestra p\c3\a1ginas editadas recientemente\0a\e2\80\a2 `/notion create <t\c3\adtulo>` \e2\80\94 Crea una nueva p\c3\a1gina en tu espacio de trabajo\0a\e2\80\a2 `/notion parent <page_id>` \e2\80\94 Configura manualmente la p\c3\a1gina padre donde guardar notas\0a\e2\80\a2 `/notion disconnect` \e2\80\94 Desconecta y borra tu token guardado\0a\0a**Ejemplos en lenguaje natural:**\0a\e2\80\a2 *\"Busca en Notion notas sobre el proyecto\"*\0a\e2\80\a2 *\"Crea una p\c3\a1gina en Notion llamada Lista de Pendientes\"*\0a\e2\80\a2 *\"Crea una nota sobre la fotosc3a1ntesis y expl\c3\adcamela\"*\0a\e2\80\a2 *\"Verifica el estado de mi conexi\c3\b3n a Notion\"*\0a\0a*\c2\bfC\c3\b3mo conectar una p\c3\a1gina?*\0a1. Abre Notion y entra a una p\c3\a1gina (ej. \"Notas\" o \"Chattree\").\0a2. Ve al men\c3\ba **'...'** (arriba a la derecha) -> **Conexiones** (Add connections) y selecciona tu integraci\c3\b3n.")

  ;; [71216] Config OK
  (data (i32.const 71216) "\e2\9c\85 **Notion configurado y verificado exitosamente.**\0a\0aTu token de integraci\c3\b3n est\c3\a1 activo y listo para usar.\0a\0aPrueba los siguientes comandos o pide en lenguaje natural:\0a\e2\80\a2 `/notion search <texto>` \e2\80\94 Buscar en tus p\c3\a1ginas\0a\e2\80\a2 `/notion list` \e2\80\94 Ver p\c3\a1ginas recientes\0a\e2\80\a2 `/notion create <t\c3\adtulo>` \e2\80\94 Crear una nueva p\c3\a1gina")

  ;; [71564] Config bad token
  (data (i32.const 71564) "\e2\9a\a0\ef\b8\8f **Token guardado pero no se pudo validar con Notion.**\0a\0aNotion devolvi\c3\b3 un error de autenticaci\c3\b3n. Verifica que tu token sea un 'Internal Integration Secret' v\c3\a1lido creado en notion.so/profile/integrations y que est\c3\a9 activo.")

  ;; [71815] Not configured
  (data (i32.const 71815) "\e2\9a\a0\ef\b8\8f **Notion no est\c3\a1 configurado.**\0a\0aPor favor registra tu API Token ejecutando:\0a`/notion config <tu_integration_secret>`\0a\0aPuedes obtener tu clave en https://notion.so/profile/integrations")

  ;; [72023] Disconnected
  (data (i32.const 72023) "\e2\9c\85 **Desconectado de Notion.**\0a\0aSe ha eliminado tu token de integraci\c3\b3n de este dispositivo.")

  ;; [72133] Status OK
  (data (i32.const 72133) "\e2\9c\85 **Conexi\c3\b3n con Notion activa y saludable.**\0a\0a\e2\80\a2 **API:** Notion API v1 (2022-06-28)\0a\e2\80\a2 **Integraci\c3\b3n:** Autenticada y lista\0a\e2\80\a2 **Funcionalidades:** B\c3\basqueda, lectura y creaci\c3\b3n de p\c3\a1ginas con contenido\0a\e2\80\a2 **Lenguaje Natural:** Habilitado con IA de Chattree\0a\0aPuedes buscar contenido con `/notion search` o crear p\c3\a1ginas con `/notion create <t\c3\adtulo>`.")

  ;; [72499] Status fail
  (data (i32.const 72499) "\e2\9d\8c **No se pudo conectar a Notion.**\0a\0aEl token guardado no es v\c3\a1lido o ha expirado. Configura uno nuevo con:\0a`/notion config <tu_token>`")

  ;; [72653] Search header
  (data (i32.const 72653) "\f0\9f\93\9d **Resultados en Notion:**\0a\0a")

  ;; [72701] No results
  (data (i32.const 72701) "\e2\84\b9\ef\b8\8f **No se encontraron resultados en Notion.**\0a\0aRecuerda que para que una p\c3\a1gina o base de datos aparezca en las b\c3\basquedas, debes compartirla con tu integraci\c3\b3n en Notion (Men\c3\ba **'...'** -> **Conexiones** / Add connections -> Tu Integraci\c3\b3n).")

  ;; [72968] Search error
  (data (i32.const 72968) "\e2\9d\8c **Error al buscar en Notion.**\0a\0aVerifica tu conexi\c3\b3n y comprueba que tu token siga siendo v\c3\a1lido con `/notion status`.")

  ;; [73108] Parent set OK
  (data (i32.const 73108) "\e2\9c\85 **P\c3\a1gina base configurada exitosamente.**\0a\0aTodas las nuevas p\c3\a1ginas creadas con `/notion create` se guardar\c3\a1n dentro de esta p\c3\a1gina.")

  ;; [73264] No parent found
  (data (i32.const 73264) "\e2\9a\a0\ef\b8\8f **No se encontr\c3\b3 ninguna p\c3\a1gina base en tu espacio de trabajo de Notion.**\0a\0aNotion requiere que las p\c3\a1ginas nuevas se creen dentro de una p\c3\a1gina existente compartida. Por favor abre Notion, ve a una p\c3\a1gina y en el men\c3\ba **'...'** -> **Conexiones** a\c3\b1ade tu integraci\c3\b3n.\0a\0a*Tip:* Tambi\c3\a9n puedes configurar manualmente el ID de la p\c3\a1gina padre con `/notion parent <id_de_pagina>`.")

  ;; [73673] Create success prefix
  (data (i32.const 73673) "\e2\9c\85 **P\c3\a1gina creada exitosamente en Notion:**\0a\0a\f0\9f\93\84 [**")

  ;; [73745] Create success link separator
  (data (i32.const 73745) "**](")

  ;; [73765] Create success suffix
  (data (i32.const 73765) ")\0a\0aTu nueva nota ya est\c3\a1 disponible en tu espacio de trabajo de Notion.")

  ;; [73853] Error prefix
  (data (i32.const 73853) "\e2\9d\8c **Error de Notion:** ")

  ;; [73894] Error suffix
  (data (i32.const 73894) "\0a\0aVerifica que la integraci\c3\b3n tenga permisos de edici\c3\b3n en la p\c3\a1gina compartida.")

  ;; ── Storage request templates ─────────────────────────────────────────────
  (data (i32.const 73993) "{\"api\":\"storage\",\"operation\":\"get\",\"payload\":{\"key\":\"api_token\"}}")
  (data (i32.const 74074) "{\"api\":\"storage\",\"operation\":\"set\",\"payload\":{\"key\":\"api_token\",\"value\":\"")
  (data (i32.const 74163) "\"}}")
  (data (i32.const 74182) "{\"api\":\"storage\",\"operation\":\"delete\",\"payload\":{\"key\":\"api_token\"}}")
  (data (i32.const 74266) "{\"api\":\"storage\",\"operation\":\"get\",\"payload\":{\"key\":\"parent_id\"}}")
  (data (i32.const 74347) "{\"api\":\"storage\",\"operation\":\"set\",\"payload\":{\"key\":\"parent_id\",\"value\":\"")
  (data (i32.const 74436) "\"}}")

  ;; ── Network request templates ─────────────────────────────────────────────
  ;; GET /v1/users/me (auth check)
  (data (i32.const 74455) "{\"api\":\"network\",\"operation\":\"http_request\",\"payload\":{\"url\":\"https://api.notion.com/v1/users/me\",\"method\":\"GET\",\"headers\":{\"Authorization\":\"Bearer ")
  (data (i32.const 74619) "\",\"Notion-Version\":\"2022-06-28\",\"Content-Type\":\"application/json\"},\"timeoutMs\":20000}}")

  ;; POST /v1/search — with query
  (data (i32.const 74721) "{\"api\":\"network\",\"operation\":\"http_request\",\"payload\":{\"url\":\"https://api.notion.com/v1/search\",\"method\":\"POST\",\"headers\":{\"Authorization\":\"Bearer ")
  (data (i32.const 74884) "\",\"Notion-Version\":\"2022-06-28\",\"Content-Type\":\"application/json\"},\"body\":\"{\\\"query\\\":\\\"")
  (data (i32.const 74988) "\\\",\\\"page_size\\\":5,\\\"sort\\\":{\\\"direction\\\":\\\"descending\\\",\\\"timestamp\\\":\\\"last_edited_time\\\"}}\",\"timeoutMs\":25000}}")

  ;; POST /v1/search — no query (list recent)
  (data (i32.const 75119) "\",\"Notion-Version\":\"2022-06-28\",\"Content-Type\":\"application/json\"},\"body\":\"{\\\"page_size\\\":5,\\\"sort\\\":{\\\"direction\\\":\\\"descending\\\",\\\"timestamp\\\":\\\"last_edited_time\\\"}}\",\"timeoutMs\":25000}}")

  ;; POST /v1/search — parent lookup (small)
  (data (i32.const 75323) "\",\"Notion-Version\":\"2022-06-28\",\"Content-Type\":\"application/json\"},\"body\":\"{\\\"page_size\\\":3,\\\"sort\\\":{\\\"direction\\\":\\\"descending\\\",\\\"timestamp\\\":\\\"last_edited_time\\\"}}\",\"timeoutMs\":20000}}")

  ;; POST /v1/pages — prefix up to Bearer token
  (data (i32.const 75527) "{\"api\":\"network\",\"operation\":\"http_request\",\"payload\":{\"url\":\"https://api.notion.com/v1/pages\",\"method\":\"POST\",\"headers\":{\"Authorization\":\"Bearer ")

  ;; After token: headers + body open (parent_id placeholder)
  (data (i32.const 75689) "\",\"Notion-Version\":\"2022-06-28\",\"Content-Type\":\"application/json\"},\"body\":\"{\\\"parent\\\":{\\\"page_id\\\":\\\"")

  ;; After parent_id: properties.title open
  (data (i32.const 75807) "\\\"},\\\"properties\\\":{\\\"title\\\":[{\\\"text\\\":{\\\"content\\\":\\\"")

  ;; After title text: close properties, open children paragraph block
  (data (i32.const 75879) "\\\"}]}],\\\"children\\\":[{\\\"object\\\":\\\"block\\\",\\\"type\\\":\\\"paragraph\\\",\\\"paragraph\\\":{\\\"rich_text\\\":[{\\\"type\\\":\\\"text\\\",\\\"text\\\":{\\\"content\\\":\\\"")

  ;; Close children + body JSON string + request close
  (data (i32.const 75980) "\\\"}}]}}]}\",\"timeoutMs\":25000}}")

  ;; ── Keyword literals ──────────────────────────────────────────────────────
  (data (i32.const 75923) "secret_")
  (data (i32.const 75946) "ntn_")
  (data (i32.const 75966) "config")
  (data (i32.const 75988) "token")
  (data (i32.const 76009) "parent")
  (data (i32.const 76031) "padre")
  (data (i32.const 76052) "status")
  (data (i32.const 76074) "estado")
  (data (i32.const 76096) "test")
  (data (i32.const 76116) "me")
  (data (i32.const 76134) "disconnect")
  (data (i32.const 76160) "desconectar")
  (data (i32.const 76187) "search")
  (data (i32.const 76209) "buscar")
  (data (i32.const 76231) "busca")
  (data (i32.const 76252) "encuentra")
  (data (i32.const 76277) "consulta")
  (data (i32.const 76301) "list")
  (data (i32.const 76321) "pages")
  (data (i32.const 76342) "paginas")
  (data (i32.const 76365) "notas")
  (data (i32.const 76386) "create")
  (data (i32.const 76408) "crear")
  (data (i32.const 76429) "crea")
  (data (i32.const 76449) "anota")
  (data (i32.const 76470) "nueva")
  (data (i32.const 76491) "nuevo")
  (data (i32.const 76512) "help")

  ;; ── JSON field markers ────────────────────────────────────────────────────
  (data (i32.const 76532) "\"value\":\"")
  (data (i32.const 76557) "\"query\":\"")
  (data (i32.const 76582) "\"title\":\"")
  (data (i32.const 76607) "\"statusCode\":200")
  (data (i32.const 76639) "\"results\":[]")
  (data (i32.const 76667) "\"results\":[")
  (data (i32.const 76694) "\"id\":\"")
  (data (i32.const 76716) "\"url\":\"https://")
  (data (i32.const 76747) "\"plain_text\":\"")
  (data (i32.const 76777) "\"message\":\"")
  (data (i32.const 76804) "\e2\80\a2 \f0\9f\93\84 [")
  (data (i32.const 76830) "](")
  (data (i32.const 76848) ")\0a")
  ;; NEW: content field marker for AI intent
  (data (i32.const 76870) "\"content\":\"")

  ;; ── Utility functions ─────────────────────────────────────────────────────

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

  ;; Unescapes JSON string in linear memory
  (func $unescape_response (param $src i32) (param $len i32) (param $dst i32) (result i32)
    (local $i i32)
    (local $out i32)
    (local $ch i32)
    (local $next i32)
    (local.set $i (i32.const 0))
    (local.set $out (local.get $dst))
    (loop $u_loop
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.and (i32.eq (local.get $ch) (i32.const 92)) (i32.lt_u (i32.add (local.get $i) (i32.const 1)) (local.get $len)))
            (then
              (local.set $next (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1)))))
              (if (i32.eq (local.get $next) (i32.const 34))
                (then
                  (i32.store8 (local.get $out) (i32.const 34))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $i (i32.add (local.get $i) (i32.const 2)))
                  (br $u_loop)
                )
              )
              (if (i32.eq (local.get $next) (i32.const 92))
                (then
                  (i32.store8 (local.get $out) (i32.const 92))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $i (i32.add (local.get $i) (i32.const 2)))
                  (br $u_loop)
                )
              )
              (if (i32.eq (local.get $next) (i32.const 110))  ;; \n
                (then
                  (i32.store8 (local.get $out) (i32.const 10))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $i (i32.add (local.get $i) (i32.const 2)))
                  (br $u_loop)
                )
              )
            )
          )
          (i32.store8 (local.get $out) (local.get $ch))
          (local.set $out (i32.add (local.get $out) (i32.const 1)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $u_loop)
        )
      )
    )
    (i32.sub (local.get $out) (local.get $dst))
  )

  ;; Loads stored API Token into 1001000
  (func $load_api_token (result i32)
    (local $res_len i32)
    (local $val_idx i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)

    (local.set $res_len (call $host_call (i32.const 73993) (i32.const 65) (i32.const 1000000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 1000000) (local.get $res_len) (i32.const 76532) (i32.const 9)))
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

  ;; Loads stored Parent Page ID into 1004000
  (func $load_parent_id (result i32)
    (local $res_len i32)
    (local $val_idx i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)

    (local.set $res_len (call $host_call (i32.const 74266) (i32.const 65) (i32.const 1000000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 1000000) (local.get $res_len) (i32.const 76532) (i32.const 9)))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_start (i32.add (i32.const 1000000) (i32.add (local.get $val_idx) (i32.const 9))))
    (local.set $i (i32.const 0))
    (loop $copy_p_id
      (if (i32.lt_u (local.get $i) (i32.const 50))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
          (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 0)))
            (then
              (i32.store8 (i32.add (i32.const 1004000) (local.get $i)) (local.get $ch))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $copy_p_id)
            )
          )
        )
      )
    )
    (global.set $parent_len (local.get $i))
    (local.get $i)
  )

  ;; Sanitizes raw text into 1002000 (title): replaces " with ', \ with /, newlines with space
  ;; Returns sanitized length; also sets $arg_len.
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

  ;; Sanitizes content/body text into 1005000
  ;; Replaces " with ', \ with /, keeps newlines as space.
  ;; Returns sanitized length; also sets $body_len.
  (func $sanitize_body (param $src i32) (param $len i32) (result i32)
    (local $i i32)
    (local $ch i32)
    (local $out_ptr i32)
    (local.set $i (i32.const 0))
    (local.set $out_ptr (i32.const 1005000))
    (loop $b_loop
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
          (br $b_loop)
        )
      )
    )
    (global.set $body_len (local.get $i))
    (local.get $i)
  )

  ;; Extracts JSON string field value into 1002000 (returns length, or -1 if not found)
  (func $extract_json_field (param $src i32) (param $src_len i32) (param $needle_ptr i32) (param $needle_len i32) (result i32)
    (local $pos i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)
    (local.set $pos (call $find_substring (local.get $src) (local.get $src_len) (local.get $needle_ptr) (local.get $needle_len)))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then (return (i32.const -1)))
    )
    (local.set $val_start (i32.add (i32.add (local.get $src) (local.get $pos)) (local.get $needle_len)))
    (local.set $i (i32.const 0))
    (loop $scan_val
      (if (i32.lt_u (i32.add (local.get $val_start) (local.get $i)) (i32.add (local.get $src) (local.get $src_len)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
          (if (i32.ne (local.get $ch) (i32.const 34))
            (then
              (if (i32.lt_u (local.get $i) (i32.const 2000))
                (then
                  (i32.store8 (i32.add (i32.const 1002000) (local.get $i)) (local.get $ch))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $scan_val)
                )
              )
            )
          )
        )
      )
    )
    (global.set $arg_len (local.get $i))
    (local.get $i)
  )

  ;; Extracts JSON string field into 1005000 (for content field)
  (func $extract_json_body_field (param $src i32) (param $src_len i32) (param $needle_ptr i32) (param $needle_len i32) (result i32)
    (local $pos i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)
    (local.set $pos (call $find_substring (local.get $src) (local.get $src_len) (local.get $needle_ptr) (local.get $needle_len)))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then (return (i32.const -1)))
    )
    (local.set $val_start (i32.add (i32.add (local.get $src) (local.get $pos)) (local.get $needle_len)))
    (local.set $i (i32.const 0))
    (loop $scan_body
      (if (i32.lt_u (i32.add (local.get $val_start) (local.get $i)) (i32.add (local.get $src) (local.get $src_len)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
          (if (i32.ne (local.get $ch) (i32.const 34))
            (then
              (if (i32.lt_u (local.get $i) (i32.const 4000))
                (then
                  (i32.store8 (i32.add (i32.const 1005000) (local.get $i)) (local.get $ch))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $scan_body)
                )
              )
            )
          )
        )
      )
    )
    (global.set $body_len (local.get $i))
    (local.get $i)
  )

  ;; ── Build and send POST /v1/pages with title + content body ───────────────
  ;; Title in 1002000 ($arg_len bytes), body text in 1005000 ($body_len bytes)
  ;; Parent ID in 1004000 ($parent_len bytes), token in 1001000 ($token_len bytes)
  (func $send_create_page (result i32)
    (local $p i32)
    (local $req_len i32)

    (local.set $p (call $copy_mem (i32.const 75527) (i32.const 100000) (i32.const 146)))
    (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
    (local.set $p (call $copy_mem (i32.const 75689) (local.get $p) (i32.const 102)))
    (local.set $p (call $copy_mem (i32.const 1004000) (local.get $p) (global.get $parent_len)))
    (local.set $p (call $copy_mem (i32.const 75807) (local.get $p) (i32.const 56)))
    ;; title text
    (local.set $p (call $copy_mem (i32.const 1002000) (local.get $p) (global.get $arg_len)))
    ;; close title, open children paragraph block
    (local.set $p (call $copy_mem (i32.const 75879) (local.get $p) (i32.const 93)))
    ;; body / content text
    (if (i32.gt_u (global.get $body_len) (i32.const 0))
      (then
        (local.set $p (call $copy_mem (i32.const 1005000) (local.get $p) (global.get $body_len)))
      )
      (else
        ;; no content provided — use title as body too
        (local.set $p (call $copy_mem (i32.const 1002000) (local.get $p) (global.get $arg_len)))
      )
    )
    ;; close children + body JSON + request
    (local.set $p (call $copy_mem (i32.const 75980) (local.get $p) (i32.const 27)))
    (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

    (global.set $phase (i32.const 5))
    (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 300000)))
    (i32.const 0)
  )

  ;; ── Main entrypoint ───────────────────────────────────────────────────────
  (func (export "notion_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $pos i32)
    (local $token_start i32)
    (local $raw_len i32)
    (local $p i32)
    (local $req_len i32)
    (local $i i32)
    (local $ch i32)
    (local $has_json_field i32)
    (local $has_saved_parent i32)
    (local $content_len i32)

    ;; 1. Empty input → Help
    (if (i32.eqz (local.get $in_len))
      (then
        (drop (call $copy_mem (i32.const 70000) (i32.const 1024) (i32.const 1200)))
        (return (i32.const 1200))
      )
    )

    ;; Lowercase input into 1003000 for keyword detection
    (call $to_lower (local.get $in_ptr) (i32.const 1003000) (local.get $in_len))

    ;; 2. "parent" / "padre" — set parent page ID manually
    (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76009) (i32.const 6)))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76031) (i32.const 5)))
      )
    )
    (if (i32.ge_s (local.get $pos) (i32.const 0))
      (then
        (local.set $token_start (i32.add (local.get $in_ptr) (i32.add (local.get $pos) (i32.const 6))))
        (loop $skip_lead_p
          (if (i32.lt_u (local.get $token_start) (i32.add (local.get $in_ptr) (local.get $in_len)))
            (then
              (local.set $ch (i32.load8_u (local.get $token_start)))
              (if (i32.or (i32.eq (local.get $ch) (i32.const 32)) (i32.eq (local.get $ch) (i32.const 58)))
                (then
                  (local.set $token_start (i32.add (local.get $token_start) (i32.const 1)))
                  (br $skip_lead_p)
                )
              )
            )
          )
        )
        (local.set $i (i32.const 0))
        (loop $scan_pid
          (if (i32.lt_u (i32.add (local.get $token_start) (local.get $i)) (i32.add (local.get $in_ptr) (local.get $in_len)))
            (then
              (if (i32.lt_u (local.get $i) (i32.const 40))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $token_start) (local.get $i))))
                  (if (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                    (then
                      (i32.store8 (i32.add (i32.const 1004000) (local.get $i)) (local.get $ch))
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $scan_pid)
                    )
                  )
                )
              )
            )
          )
        )
        (global.set $parent_len (local.get $i))
        (if (i32.gt_u (global.get $parent_len) (i32.const 10))
          (then
            (local.set $p (call $copy_mem (i32.const 74347) (i32.const 100000) (i32.const 73)))
            (local.set $p (call $copy_mem (i32.const 1004000) (local.get $p) (global.get $parent_len)))
            (local.set $p (call $copy_mem (i32.const 74436) (local.get $p) (i32.const 3)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 1024)))
            (drop (call $copy_mem (i32.const 73108) (i32.const 1024) (i32.const 140)))
            (return (i32.const 140))
          )
        )
      )
    )

    ;; 3. Structured JSON intent from AI interpreter
    ;;    Try "query", then "title" as the title field
    (local.set $has_json_field (call $extract_json_field (local.get $in_ptr) (local.get $in_len) (i32.const 76557) (i32.const 9)))
    (if (i32.lt_s (local.get $has_json_field) (i32.const 0))
      (then
        (local.set $has_json_field (call $extract_json_field (local.get $in_ptr) (local.get $in_len) (i32.const 76582) (i32.const 9)))
      )
    )

    (if (i32.ge_s (local.get $has_json_field) (i32.const 0))
      (then
        ;; Sanitize title from 1002000 (already set by extract_json_field)
        (drop (call $sanitize_text (i32.const 1002000) (global.get $arg_len)))

        ;; Try to extract "content" field into 1005000
        (local.set $content_len (call $extract_json_body_field (local.get $in_ptr) (local.get $in_len) (i32.const 76870) (i32.const 11)))
        (if (i32.ge_s (local.get $content_len) (i32.const 0))
          (then
            (drop (call $sanitize_body (i32.const 1005000) (local.get $content_len)))
          )
          (else
            (global.set $body_len (i32.const 0))
          )
        )

        (if (i32.or
              (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76386) (i32.const 6)) (i32.const 0))
              (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76408) (i32.const 5)) (i32.const 0)))
          (then
            ;; Create flow
            (local.set $raw_len (call $load_api_token))
            (if (i32.eqz (local.get $raw_len))
              (then
                (drop (call $copy_mem (i32.const 71815) (i32.const 1024) (i32.const 192)))
                (return (i32.const 192))
              )
            )

            (local.set $has_saved_parent (call $load_parent_id))
            (if (i32.gt_u (local.get $has_saved_parent) (i32.const 0))
              (then
                (return (call $send_create_page))
              )
            )

            ;; Search for parent
            (local.set $p (call $copy_mem (i32.const 74721) (i32.const 100000) (i32.const 147)))
            (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const 75323) (local.get $p) (i32.const 188)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
            (global.set $phase (i32.const 4))
            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 300000)))
            (return (i32.const 0))
          )
          (else
            ;; Search flow
            (local.set $raw_len (call $load_api_token))
            (if (i32.eqz (local.get $raw_len))
              (then
                (drop (call $copy_mem (i32.const 71815) (i32.const 1024) (i32.const 192)))
                (return (i32.const 192))
              )
            )

            (local.set $p (call $copy_mem (i32.const 74721) (i32.const 100000) (i32.const 147)))
            (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
            (if (i32.gt_u (global.get $arg_len) (i32.const 0))
              (then
                (local.set $p (call $copy_mem (i32.const 74884) (local.get $p) (i32.const 88)))
                (local.set $p (call $copy_mem (i32.const 1002000) (local.get $p) (global.get $arg_len)))
                (local.set $p (call $copy_mem (i32.const 74988) (local.get $p) (i32.const 115)))
              )
              (else
                (local.set $p (call $copy_mem (i32.const 75119) (local.get $p) (i32.const 188)))
              )
            )
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
            (global.set $phase (i32.const 3))
            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 300000)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; 4. "help" / "?"
    (if (i32.or
          (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76512) (i32.const 4)) (i32.const 0))
          (i32.eq (i32.load8_u (local.get $in_ptr)) (i32.const 63)))
      (then
        (drop (call $copy_mem (i32.const 70000) (i32.const 1024) (i32.const 1200)))
        (return (i32.const 1200))
      )
    )

    ;; 5. "disconnect" / "desconectar"
    (if (i32.or
          (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76134) (i32.const 10)) (i32.const 0))
          (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76160) (i32.const 11)) (i32.const 0)))
      (then
        (drop (call $host_call (i32.const 74182) (i32.const 68) (i32.const 1000000) (i32.const 1024)))
        (drop (call $copy_mem (i32.const 72023) (i32.const 1024) (i32.const 94)))
        (return (i32.const 94))
      )
    )

    ;; 6. Config — detect secret_/ntn_/config/token
    (local.set $token_start (i32.const -1))
    (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 75923) (i32.const 7)))
    (if (i32.ge_s (local.get $pos) (i32.const 0))
      (then (local.set $token_start (i32.add (local.get $in_ptr) (local.get $pos))))
      (else
        (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 75946) (i32.const 4)))
        (if (i32.ge_s (local.get $pos) (i32.const 0))
          (then (local.set $token_start (i32.add (local.get $in_ptr) (local.get $pos))))
          (else
            (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75966) (i32.const 6)))
            (if (i32.ge_s (local.get $pos) (i32.const 0))
              (then (local.set $token_start (i32.add (i32.add (local.get $in_ptr) (local.get $pos)) (i32.const 6))))
              (else
                (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 75988) (i32.const 5)))
                (if (i32.ge_s (local.get $pos) (i32.const 0))
                  (then (local.set $token_start (i32.add (i32.add (local.get $in_ptr) (local.get $pos)) (i32.const 5))))
                )
              )
            )
          )
        )
      )
    )

    (if (i32.ge_s (local.get $token_start) (i32.const 0))
      (then
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
            (local.set $p (call $copy_mem (i32.const 74074) (i32.const 100000) (i32.const 73)))
            (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const 74163) (local.get $p) (i32.const 3)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 1024)))

            (local.set $p (call $copy_mem (i32.const 74455) (i32.const 100000) (i32.const 148)))
            (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const 74619) (local.get $p) (i32.const 86)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

            (global.set $phase (i32.const 1))
            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 300000)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; 7. "status" / "estado" / "me" / "test"
    (if (i32.or
          (i32.or
            (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76052) (i32.const 6)) (i32.const 0))
            (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76074) (i32.const 6)) (i32.const 0)))
          (i32.or
            (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76116) (i32.const 2)) (i32.const 0))
            (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76096) (i32.const 4)) (i32.const 0))))
      (then
        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then
            (drop (call $copy_mem (i32.const 71815) (i32.const 1024) (i32.const 192)))
            (return (i32.const 192))
          )
        )
        (local.set $p (call $copy_mem (i32.const 74455) (i32.const 100000) (i32.const 148)))
        (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_mem (i32.const 74619) (local.get $p) (i32.const 86)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 2))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 300000)))
        (return (i32.const 0))
      )
    )

    ;; 8. "create" / "crear" / "crea" / "anota" / "nueva" / "nuevo"
    (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76386) (i32.const 6)))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76408) (i32.const 5))))
    )
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76429) (i32.const 4))))
    )
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76449) (i32.const 5))))
    )
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76470) (i32.const 5))))
    )

    (if (i32.ge_s (local.get $pos) (i32.const 0))
      (then
        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then
            (drop (call $copy_mem (i32.const 71815) (i32.const 1024) (i32.const 192)))
            (return (i32.const 192))
          )
        )

        ;; Extract everything after the keyword as the title
        (local.set $token_start (i32.add (local.get $in_ptr) (i32.add (local.get $pos) (i32.const 5))))
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
            (drop (call $copy_mem (i32.const 70000) (i32.const 1024) (i32.const 1200)))
            (return (i32.const 1200))
          )
        )

        ;; Sanitize as title; no separate body for plain text commands
        (drop (call $sanitize_text (local.get $token_start) (local.get $raw_len)))
        (global.set $body_len (i32.const 0))  ;; will reuse title as body in $send_create_page

        (local.set $has_saved_parent (call $load_parent_id))
        (if (i32.gt_u (local.get $has_saved_parent) (i32.const 0))
          (then
            (return (call $send_create_page))
          )
        )

        ;; Search for parent page
        (local.set $p (call $copy_mem (i32.const 74721) (i32.const 100000) (i32.const 147)))
        (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_mem (i32.const 75323) (local.get $p) (i32.const 188)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 4))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 300000)))
        (return (i32.const 0))
      )
    )

    ;; 9. Default: Search / List
    (local.set $raw_len (call $load_api_token))
    (if (i32.eqz (local.get $raw_len))
      (then
        (drop (call $copy_mem (i32.const 71815) (i32.const 1024) (i32.const 192)))
        (return (i32.const 192))
      )
    )

    (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76187) (i32.const 6)))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76209) (i32.const 6))))
    )
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76231) (i32.const 5))))
    )
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76252) (i32.const 9))))
    )
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76277) (i32.const 8))))
    )

    (if (i32.ge_s (local.get $pos) (i32.const 0))
      (then
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
        (if (i32.or
              (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76301) (i32.const 4)) (i32.const 0))
              (i32.or
                (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76321) (i32.const 5)) (i32.const 0))
                (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const 76342) (i32.const 7)) (i32.const 0))))
          (then
            (global.set $arg_len (i32.const 0))
          )
          (else
            (drop (call $sanitize_text (local.get $in_ptr) (local.get $in_len)))
          )
        )
      )
    )

    (local.set $p (call $copy_mem (i32.const 74721) (i32.const 100000) (i32.const 147)))
    (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))

    (if (i32.gt_u (global.get $arg_len) (i32.const 0))
      (then
        (local.set $p (call $copy_mem (i32.const 74884) (local.get $p) (i32.const 88)))
        (local.set $p (call $copy_mem (i32.const 1002000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_mem (i32.const 74988) (local.get $p) (i32.const 115)))
      )
      (else
        (local.set $p (call $copy_mem (i32.const 75119) (local.get $p) (i32.const 188)))
      )
    )
    (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

    (global.set $phase (i32.const 3))
    (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 300000)))
    (i32.const 0)
  )

  ;; ── Resume handler (async response) ──────────────────────────────────────
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
    (local $u_len i32)
    (local $msg_start i32)
    (local $msg_len i32)

    ;; Unescape host response into 600000
    (local.set $u_len (call $unescape_response (local.get $res_ptr) (local.get $res_len) (i32.const 600000)))

    ;; Check HTTP status 200
    (local.set $idx (call $find_substring (i32.const 600000) (local.get $u_len) (i32.const 76607) (i32.const 16)))
    (local.set $is_200 (i32.ge_s (local.get $idx) (i32.const 0)))

    ;; ─── Phase 1: Config Verification ───
    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        (if (local.get $is_200)
          (then
            (drop (call $copy_mem (i32.const 71216) (i32.const 1024) (i32.const 332)))
            (return (i32.const 332))
          )
          (else
            (drop (call $copy_mem (i32.const 71564) (i32.const 1024) (i32.const 235)))
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
            (drop (call $copy_mem (i32.const 72133) (i32.const 1024) (i32.const 350)))
            (return (i32.const 350))
          )
          (else
            (drop (call $copy_mem (i32.const 72499) (i32.const 1024) (i32.const 138)))
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
            (drop (call $copy_mem (i32.const 72968) (i32.const 1024) (i32.const 124)))
            (return (i32.const 124))
          )
        )

        (local.set $idx (call $find_substring (i32.const 600000) (local.get $u_len) (i32.const 76639) (i32.const 12)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 72701) (i32.const 1024) (i32.const 251)))
            (return (i32.const 251))
          )
        )

        (local.set $p (call $copy_mem (i32.const 72653) (i32.const 1024) (i32.const 32)))

        (local.set $scan_ptr (i32.const 600000))
        (local.set $scan_end (i32.add (i32.const 600000) (local.get $u_len)))
        (local.set $item_count (i32.const 0))

        (loop $parse_items
          (if (i32.and (i32.lt_u (local.get $item_count) (i32.const 5)) (i32.lt_u (local.get $scan_ptr) (local.get $scan_end)))
            (then
              (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const 76716) (i32.const 15)))
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

                  (local.set $title_start (local.get $url_start))
                  (local.set $title_len (i32.const 6))
                  (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const 76747) (i32.const 14)))
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

                  (local.set $p (call $copy_mem (i32.const 76804) (local.get $p) (i32.const 10)))
                  (if (i32.gt_u (local.get $title_len) (i32.const 0))
                    (then (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len))))
                    (else (local.set $p (call $copy_mem (i32.const 76321) (local.get $p) (i32.const 5))))
                  )
                  (local.set $p (call $copy_mem (i32.const 76830) (local.get $p) (i32.const 2)))
                  (local.set $p (call $copy_mem (local.get $url_start) (local.get $p) (local.get $url_len)))
                  (local.set $p (call $copy_mem (i32.const 76848) (local.get $p) (i32.const 2)))

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
            (drop (call $copy_mem (i32.const 72701) (i32.const 1024) (i32.const 251)))
            (return (i32.const 251))
          )
        )

        (return (i32.sub (local.get $p) (i32.const 1024)))
      )
    )

    ;; ─── Phase 4: Create Step 1 — Parent Search response ───
    (if (i32.eq (global.get $phase) (i32.const 4))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            (local.set $idx (call $find_substring (i32.const 600000) (local.get $u_len) (i32.const 76777) (i32.const 11)))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 600000) (local.get $idx)) (i32.const 11)))
                (local.set $i (i32.const 0))
                (loop $find_msg_end
                  (if (i32.and (i32.lt_u (local.get $i) (i32.const 120)) (i32.lt_u (i32.add (local.get $msg_start) (local.get $i)) (i32.add (i32.const 600000) (local.get $u_len))))
                    (then
                      (if (i32.ne (i32.load8_u (i32.add (local.get $msg_start) (local.get $i))) (i32.const 34))
                        (then
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $find_msg_end)
                        )
                      )
                    )
                  )
                )
                (local.set $msg_len (local.get $i))
                (local.set $p (call $copy_mem (i32.const 73853) (i32.const 1024) (i32.const 25)))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $msg_len)))
                (local.set $p (call $copy_mem (i32.const 73894) (local.get $p) (i32.const 83)))
                (return (i32.sub (local.get $p) (i32.const 1024)))
              )
            )
            (drop (call $copy_mem (i32.const 73264) (i32.const 1024) (i32.const 393)))
            (return (i32.const 393))
          )
        )

        ;; Extract first "id":"..." from results
        (local.set $idx (call $find_substring (i32.const 600000) (local.get $u_len) (i32.const 76694) (i32.const 6)))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 73264) (i32.const 1024) (i32.const 393)))
            (return (i32.const 393))
          )
        )

        (local.set $url_start (i32.add (i32.add (i32.const 600000) (local.get $idx)) (i32.const 6)))
        (local.set $i (i32.const 0))
        (loop $copy_parent_id
          (if (i32.lt_u (local.get $i) (i32.const 36))
            (then
              (local.set $ch (i32.load8_u (i32.add (local.get $url_start) (local.get $i))))
              (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 0)))
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

        ;; Persist parent ID for future calls
        (local.set $p (call $copy_mem (i32.const 74347) (i32.const 100000) (i32.const 73)))
        (local.set $p (call $copy_mem (i32.const 1004000) (local.get $p) (global.get $parent_len)))
        (local.set $p (call $copy_mem (i32.const 74436) (local.get $p) (i32.const 3)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 1024)))

        ;; Step 4B: POST /v1/pages with title + content body
        (return (call $send_create_page))
      )
    )

    ;; ─── Phase 5: Create Step 2 — Page Created response ───
    (if (i32.eq (global.get $phase) (i32.const 5))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            (local.set $idx (call $find_substring (i32.const 600000) (local.get $u_len) (i32.const 76777) (i32.const 11)))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 600000) (local.get $idx)) (i32.const 11)))
                (local.set $i (i32.const 0))
                (loop $find_c_msg_end
                  (if (i32.and (i32.lt_u (local.get $i) (i32.const 120)) (i32.lt_u (i32.add (local.get $msg_start) (local.get $i)) (i32.add (i32.const 600000) (local.get $u_len))))
                    (then
                      (if (i32.ne (i32.load8_u (i32.add (local.get $msg_start) (local.get $i))) (i32.const 34))
                        (then
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $find_c_msg_end)
                        )
                      )
                    )
                  )
                )
                (local.set $msg_len (local.get $i))
                (local.set $p (call $copy_mem (i32.const 73853) (i32.const 1024) (i32.const 25)))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $msg_len)))
                (local.set $p (call $copy_mem (i32.const 73894) (local.get $p) (i32.const 83)))
                (return (i32.sub (local.get $p) (i32.const 1024)))
              )
            )
            (local.set $p (call $copy_mem (i32.const 73853) (i32.const 1024) (i32.const 25)))
            (local.set $p (call $copy_mem (i32.const 73894) (local.get $p) (i32.const 83)))
            (return (i32.sub (local.get $p) (i32.const 1024)))
          )
        )

        (local.set $idx (call $find_substring (i32.const 600000) (local.get $u_len) (i32.const 76716) (i32.const 15)))
        (local.set $url_start (i32.const 600000))
        (local.set $url_len (i32.const 0))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (local.set $url_start (i32.add (i32.add (i32.const 600000) (local.get $idx)) (i32.const 7)))
            (local.set $i (i32.const 0))
            (loop $find_c_url_end
              (if (i32.lt_u (i32.add (local.get $url_start) (local.get $i)) (i32.add (i32.const 600000) (local.get $u_len)))
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

        (local.set $p (call $copy_mem (i32.const 73673) (i32.const 1024) (i32.const 56)))
        (local.set $p (call $copy_mem (i32.const 1002000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_mem (i32.const 73745) (local.get $p) (i32.const 4)))
        (local.set $p (call $copy_mem (local.get $url_start) (local.get $p) (local.get $url_len)))
        (local.set $p (call $copy_mem (i32.const 73765) (local.get $p) (i32.const 72)))

        (return (i32.sub (local.get $p) (i32.const 1024)))
      )
    )

    (drop (call $copy_mem (i32.const 70000) (i32.const 1024) (i32.const 1200)))
    (i32.const 1200)
  )
)
