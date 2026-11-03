;; Chattree Official Notion Integration Plugin v1.2.0
;; - 100% AI Natural Language Intent Contract (no rigid keyword slicing)
;; - Preserves real line breaks (\\n) and splits long AI articles across multiple Notion paragraph blocks
;; - Returns rich Markdown confirmation with clickable Notion URL + generated content preview
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; 64 pages = 4 MB sandbox linear memory
  (memory (export "memory") 64)

  (global $phase       (mut i32) (i32.const 0))
  (global $token_len   (mut i32) (i32.const 0))
  (global $arg_len     (mut i32) (i32.const 0))  ;; escaped title/query length at 1303000
  (global $op_len      (mut i32) (i32.const 0))  ;; operation length at 1306000
  (global $parent_len  (mut i32) (i32.const 0))  ;; parent_id length at 1307000
  (global $raw_body_len (mut i32) (i32.const 0)) ;; raw JSON-extracted content at 1400000
  (global $preview_len (mut i32) (i32.const 0))  ;; readable UTF-8 preview at 1600000

  ;; ── Static Data Segments ─────────────────────────────────────────────────
  ;; [140000] help (1151B)
  (data (i32.const 140000) "\f0\9f\93\9d **Notion Workspace Integration (IA & Lenguaje Natural)**\0a\0aConecta tu espacio de trabajo de Notion con Chattree y gestiona todo en **lenguaje natural**. La IA redacta y estructura autom\c3\a1ticamente el contenido completo de tus p\c3\a1ginas.\0a\0a**Ejemplos de uso en lenguaje natural con `/notion`:**\0a\e2\80\a2 `/notion cr\c3\a9ame una p\c3\a1gina de ideas de app donde enliste las mejores ideas para este 2027`\0a\e2\80\a2 `/notion crea una nota explicando la arquitectura limpia en Flutter con ejemplos`\0a\e2\80\a2 `/notion busca mis apuntes sobre inteligencia artificial`\0a\e2\80\a2 `/notion mu\c3\a9strame mis p\c3\a1ginas recientes de Notion`\0a\e2\80\a2 `/notion configura mi token ntn_tu_integration_secret`\0a\e2\80\a2 `/notion verifica el estado de mi conexi\c3\b3n`\0a\e2\80\a2 `/notion desconectar cuenta`\0a\0a*\c2\bfC\c3\b3mo conectar tu Notion?*\0a1. Crea tu integraci\c3\b3n en https://www.notion.so/profile/integrations y copia tu **Internal Integration Secret** (`ntn_...` o `secret_...`).\0a2. En Notion, abre la p\c3\a1gina donde quieras guardar tus notas, toca el men\c3\ba **'...'** (arriba a la derecha) -> **Conexiones** (Add connections) y selecciona tu integraci\c3\b3n.\0a3. En Chattree escribe: `/notion configura mi token <tu_token>`.")
  ;; [141167] key_saved_ok (352B)
  (data (i32.const 141167) "\e2\9c\85 **Notion configurado y verificado exitosamente.**\0a\0aTu token de integraci\c3\b3n est\c3\a1 activo y listo para usarse con lenguaje natural.\0a\0aAhora puedes pedirle a Chattree cosas como:\0a\e2\80\a2 `/notion cr\c3\a9ame una p\c3\a1gina con las mejores ideas de negocio para 2027`\0a\e2\80\a2 `/notion busca mis notas sobre el proyecto`\0a\e2\80\a2 `/notion mu\c3\a9strame mis p\c3\a1ginas recientes`")
  ;; [141535] key_saved_invalid (274B)
  (data (i32.const 141535) "\e2\9a\a0\ef\b8\8f **Token guardado pero no se pudo validar con Notion.**\0a\0aNotion devolvi\c3\b3 un error de autenticaci\c3\b3n. Verifica que tu token sea un 'Internal Integration Secret' v\c3\a1lido (`ntn_...` o `secret_...`) creado en https://www.notion.so/profile/integrations y que est\c3\a9 activo.")
  ;; [141825] key_missing (235B)
  (data (i32.const 141825) "\e2\9a\a0\ef\b8\8f **Notion no est\c3\a1 configurado.**\0a\0aPor favor registra tu Integration Secret diciendo en lenguaje natural:\0a`/notion configura mi token <tu_integration_secret>`\0a\0aPuedes obtener tu clave en https://www.notion.so/profile/integrations")
  ;; [142076] disconnected (94B)
  (data (i32.const 142076) "\e2\9c\85 **Desconectado de Notion.**\0a\0aSe ha eliminado tu token de integraci\c3\b3n de este dispositivo.")
  ;; [142186] status_ok (352B)
  (data (i32.const 142186) "\e2\9c\85 **Conexi\c3\b3n con Notion activa y saludable.**\0a\0a\e2\80\a2 **API:** Notion API v1 (2022-06-28)\0a\e2\80\a2 **Integraci\c3\b3n:** Autenticada y lista\0a\e2\80\a2 **Modo:** 100% Lenguaje Natural con IA de Chattree (creaci\c3\b3n de p\c3\a1ginas con desarrollo completo de contenido, b\c3\basqueda sem\c3\a1ntica y listado)\0a\0aPide lo que necesites en lenguaje natural con `/notion <tu solicitud>`.")
  ;; [142554] status_error (155B)
  (data (i32.const 142554) "\e2\9d\8c **No se pudo conectar a Notion.**\0a\0aEl token guardado no es v\c3\a1lido o ha expirado. Configura uno nuevo diciendo:\0a`/notion configura mi token <tu_token>`")
  ;; [142725] search_header (44B)
  (data (i32.const 142725) "\f0\9f\93\9d **Resultados encontrados en Notion:**\0a\0a")
  ;; [142785] search_empty (238B)
  (data (i32.const 142785) "\e2\84\b9\ef\b8\8f **No se encontraron resultados en Notion.**\0a\0aRecuerda que para que una p\c3\a1gina o base de datos sea accesible, debes compartirla con tu integraci\c3\b3n en Notion (Men\c3\ba **'...'** -> **Conexiones** / Add connections -> Tu Integraci\c3\b3n).")
  ;; [143039] search_error (150B)
  (data (i32.const 143039) "\e2\9d\8c **Error al consultar Notion.**\0a\0aVerifica tu conexi\c3\b3n a internet y comprueba que tu token siga siendo v\c3\a1lido con `/notion verifica mi conexi\c3\b3n`.")
  ;; [143205] parent_saved (137B)
  (data (i32.const 143205) "\e2\9c\85 **P\c3\a1gina base configurada exitosamente.**\0a\0aTodas las nuevas p\c3\a1ginas que pidas crear en Notion se guardar\c3\a1n dentro de esta p\c3\a1gina.")
  ;; [143358] create_no_parent (327B)
  (data (i32.const 143358) "\e2\9a\a0\ef\b8\8f **No se encontr\c3\b3 ninguna p\c3\a1gina compartida en tu espacio de trabajo de Notion.**\0a\0aNotion requiere que las p\c3\a1ginas nuevas se creen dentro de una p\c3\a1gina existente a la que tu integraci\c3\b3n tenga acceso. Abre Notion, entra a una p\c3\a1gina y en el men\c3\ba **'...'** -> **Conexiones** (Add connections) a\c3\b1ade tu integraci\c3\b3n.")
  ;; [143701] create_ok_prefix (56B)
  (data (i32.const 143701) "\e2\9c\85 **P\c3\a1gina creada exitosamente en Notion:**\0a\0a\f0\9f\93\84 [**")
  ;; [143773] create_ok_mid (4B)
  (data (i32.const 143773) "**](")
  ;; [143793] create_ok_mid2 (8B)
  (data (i32.const 143793) ")\0a\0a---\0a\0a")
  ;; [143817] create_ok_suffix (87B)
  (data (i32.const 143817) "\0a\0a---\0a*Tu p\c3\a1gina ya est\c3\a1 guardada y sincronizada en tu espacio de trabajo de Notion.*")
  ;; [143920] create_error_prefix (25B)
  (data (i32.const 143920) "\e2\9d\8c **Error de Notion:** ")
  ;; [143961] create_error_suffix (93B)
  (data (i32.const 143961) "\0a\0aVerifica que tu integraci\c3\b3n tenga permisos de edici\c3\b3n en la p\c3\a1gina compartida de Notion.")
  ;; [144070] storage_get (65B)
  (data (i32.const 144070) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22api_token\22}}")
  ;; [144151] storage_set_prefix (73B)
  (data (i32.const 144151) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22api_token\22,\22value\22:\22")
  ;; [144240] storage_set_suffix (3B)
  (data (i32.const 144240) "\22}}")
  ;; [144259] storage_delete (68B)
  (data (i32.const 144259) "{\22api\22:\22storage\22,\22operation\22:\22delete\22,\22payload\22:{\22key\22:\22api_token\22}}")
  ;; [144343] storage_get_parent (65B)
  (data (i32.const 144343) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22parent_id\22}}")
  ;; [144424] storage_set_parent_prefix (73B)
  (data (i32.const 144424) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22parent_id\22,\22value\22:\22")
  ;; [144513] storage_set_parent_suffix (3B)
  (data (i32.const 144513) "\22}}")
  ;; [144532] http_me_prefix (148B)
  (data (i32.const 144532) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.notion.com/v1/users/me\22,\22method\22:\22GET\22,\22headers\22:{\22Authorization\22:\22Bearer ")
  ;; [144696] http_me_suffix (86B)
  (data (i32.const 144696) "\22,\22Notion-Version\22:\222022-06-28\22,\22Content-Type\22:\22application/json\22},\22timeoutMs\22:20000}}")
  ;; [144798] http_search_prefix (147B)
  (data (i32.const 144798) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.notion.com/v1/search\22,\22method\22:\22POST\22,\22headers\22:{\22Authorization\22:\22Bearer ")
  ;; [144961] http_search_mid1 (88B)
  (data (i32.const 144961) "\22,\22Notion-Version\22:\222022-06-28\22,\22Content-Type\22:\22application/json\22},\22body\22:\22{\5c\22query\5c\22:\5c\22")
  ;; [145065] http_search_mid2 (115B)
  (data (i32.const 145065) "\5c\22,\5c\22page_size\5c\22:5,\5c\22sort\5c\22:{\5c\22direction\5c\22:\5c\22descending\5c\22,\5c\22timestamp\5c\22:\5c\22last_edited_time\5c\22}}\22,\22timeoutMs\22:25000}}")
  ;; [145196] http_search_empty_body (188B)
  (data (i32.const 145196) "\22,\22Notion-Version\22:\222022-06-28\22,\22Content-Type\22:\22application/json\22},\22body\22:\22{\5c\22page_size\5c\22:5,\5c\22sort\5c\22:{\5c\22direction\5c\22:\5c\22descending\5c\22,\5c\22timestamp\5c\22:\5c\22last_edited_time\5c\22}}\22,\22timeoutMs\22:25000}}")
  ;; [145400] http_parent_search_body (244B)
  (data (i32.const 145400) "\22,\22Notion-Version\22:\222022-06-28\22,\22Content-Type\22:\22application/json\22},\22body\22:\22{\5c\22filter\5c\22:{\5c\22value\5c\22:\5c\22page\5c\22,\5c\22property\5c\22:\5c\22object\5c\22},\5c\22page_size\5c\22:3,\5c\22sort\5c\22:{\5c\22direction\5c\22:\5c\22descending\5c\22,\5c\22timestamp\5c\22:\5c\22last_edited_time\5c\22}}\22,\22timeoutMs\22:20000}}")
  ;; [145660] http_create_prefix (146B)
  (data (i32.const 145660) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.notion.com/v1/pages\22,\22method\22:\22POST\22,\22headers\22:{\22Authorization\22:\22Bearer ")
  ;; [145822] http_create_mid1 (102B)
  (data (i32.const 145822) "\22,\22Notion-Version\22:\222022-06-28\22,\22Content-Type\22:\22application/json\22},\22body\22:\22{\5c\22parent\5c\22:{\5c\22page_id\5c\22:\5c\22")
  ;; [145940] http_create_mid2 (67B)
  (data (i32.const 145940) "\5c\22},\5c\22properties\5c\22:{\5c\22title\5c\22:{\5c\22title\5c\22:[{\5c\22text\5c\22:{\5c\22content\5c\22:\5c\22")
  ;; [146023] http_create_no_children_suffix (28B)
  (data (i32.const 146023) "\5c\22}}]}}\22,\22timeoutMs\22:25000}}")
  ;; [146067] http_create_children_open (140B)
  (data (i32.const 146067) "\5c\22}}]}},\5c\22children\5c\22:[{\5c\22object\5c\22:\5c\22block\5c\22,\5c\22type\5c\22:\5c\22paragraph\5c\22,\5c\22paragraph\5c\22:{\5c\22rich_text\5c\22:[{\5c\22type\5c\22:\5c\22text\5c\22,\5c\22text\5c\22:{\5c\22content\5c\22:\5c\22")
  ;; [146223] http_create_children_sep (126B)
  (data (i32.const 146223) "\5c\22}}]}},{\5c\22object\5c\22:\5c\22block\5c\22,\5c\22type\5c\22:\5c\22paragraph\5c\22,\5c\22paragraph\5c\22:{\5c\22rich_text\5c\22:[{\5c\22type\5c\22:\5c\22text\5c\22,\5c\22text\5c\22:{\5c\22content\5c\22:\5c\22")
  ;; [146365] http_create_children_close (30B)
  (data (i32.const 146365) "\5c\22}}]}}]}\22,\22timeoutMs\22:25000}}")
  ;; [146411] needle_val_field (9B)
  (data (i32.const 146411) "\22value\22:\22")
  ;; [146436] needle_json_operation (13B)
  (data (i32.const 146436) "\22operation\22:\22")
  ;; [146465] needle_json_action (10B)
  (data (i32.const 146465) "\22action\22:\22")
  ;; [146491] needle_json_query (9B)
  (data (i32.const 146491) "\22query\22:\22")
  ;; [146516] needle_json_title (9B)
  (data (i32.const 146516) "\22title\22:\22")
  ;; [146541] needle_json_content (11B)
  (data (i32.const 146541) "\22content\22:\22")
  ;; [146568] needle_json_extra (9B)
  (data (i32.const 146568) "\22extra\22:\22")
  ;; [146593] needle_json_token (9B)
  (data (i32.const 146593) "\22token\22:\22")
  ;; [146618] needle_json_parent (13B)
  (data (i32.const 146618) "\22parent_id\22:\22")
  ;; [146647] needle_act_create (6B)
  (data (i32.const 146647) "create")
  ;; [146669] needle_act_search (6B)
  (data (i32.const 146669) "search")
  ;; [146691] needle_act_list (4B)
  (data (i32.const 146691) "list")
  ;; [146711] needle_act_status (6B)
  (data (i32.const 146711) "status")
  ;; [146733] needle_act_config (6B)
  (data (i32.const 146733) "config")
  ;; [146755] needle_act_parent (6B)
  (data (i32.const 146755) "parent")
  ;; [146777] needle_act_disconnect (10B)
  (data (i32.const 146777) "disconnect")
  ;; [146803] needle_act_help (4B)
  (data (i32.const 146803) "help")
  ;; [146823] needle_secret (7B)
  (data (i32.const 146823) "secret_")
  ;; [146846] needle_ntn (4B)
  (data (i32.const 146846) "ntn_")
  ;; [146866] needle_default_title (14B)
  (data (i32.const 146866) "Nota de Notion")
  ;; [146896] needle_status_200 (16B)
  (data (i32.const 146896) "\22statusCode\22:200")
  ;; [146928] needle_results_empty (12B)
  (data (i32.const 146928) "\22results\22:[]")
  ;; [146956] needle_id_field (6B)
  (data (i32.const 146956) "\22id\22:\22")
  ;; [146978] needle_url_field (15B)
  (data (i32.const 146978) "\22url\22:\22https://")
  ;; [147009] needle_plain_text (14B)
  (data (i32.const 147009) "\22plain_text\22:\22")
  ;; [147039] needle_msg_field (11B)
  (data (i32.const 147039) "\22message\22:\22")
  ;; [147066] needle_pages_fallback (17B)
  (data (i32.const 147066) "P\c3\a1gina de Notion")
  ;; [147099] bullet_page (10B)
  (data (i32.const 147099) "\e2\80\a2 \f0\9f\93\84 [")
  ;; [147125] bullet_mid (2B)
  (data (i32.const 147125) "](")
  ;; [147143] bullet_end (2B)
  (data (i32.const 147143) ")\0a")

  ;; ── Utility Functions ────────────────────────────────────────────────────

  (func $copy_mem (param $src i32) (param $dst i32) (param $len i32) (result i32)
    (if (i32.gt_s (local.get $len) (i32.const 0))
      (then
        (memory.copy (local.get $dst) (local.get $src) (local.get $len))
        (return (i32.add (local.get $dst) (local.get $len)))
      )
    )
    (local.get $dst)
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
    (if (i32.lt_s (local.get $h_len) (local.get $n_len))
      (then (return (i32.const -1)))
    )
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

  ;; Unescapes Host API HTTP response JSON string in linear memory
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
              (if (i32.eq (local.get $next) (i32.const 110))
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

  ;; Loads stored API Token into 1302000
  (func $load_api_token (result i32)
    (local $res_len i32)
    (local $val_idx i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)

    (local.set $res_len (call $host_call (i32.const 144070) (i32.const 65) (i32.const 1300000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 1300000) (local.get $res_len) (i32.const 146411) (i32.const 9)))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_start (i32.add (i32.const 1300000) (i32.add (local.get $val_idx) (i32.const 9))))
    (local.set $i (i32.const 0))
    (loop $copy_key
      (if (i32.lt_u (local.get $i) (i32.const 200))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
          (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 0)))
            (then
              (i32.store8 (i32.add (i32.const 1302000) (local.get $i)) (local.get $ch))
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

  ;; Loads stored Parent Page ID into 1307000
  (func $load_parent_id (result i32)
    (local $res_len i32)
    (local $val_idx i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)

    (local.set $res_len (call $host_call (i32.const 144343) (i32.const 65) (i32.const 1300000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 1300000) (local.get $res_len) (i32.const 146411) (i32.const 9)))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_start (i32.add (i32.const 1300000) (i32.add (local.get $val_idx) (i32.const 9))))
    (local.set $i (i32.const 0))
    (loop $copy_p_id
      (if (i32.lt_u (local.get $i) (i32.const 60))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
          (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 0)))
            (then
              (i32.store8 (i32.add (i32.const 1307000) (local.get $i)) (local.get $ch))
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

  ;; Extracts raw JSON string value (preserving escape sequences) into $dst_ptr up to $max_len
  ;; Returns length of extracted raw bytes, or -1 if needle not found
  (func $extract_json_raw (param $src i32) (param $src_len i32) (param $needle_ptr i32) (param $needle_len i32) (param $dst_ptr i32) (param $max_len i32) (result i32)
    (local $pos i32)
    (local $val_start i32)
    (local $i i32)
    (local $out i32)
    (local $ch i32)
    (local $esc i32)

    (local.set $pos (call $find_substring (local.get $src) (local.get $src_len) (local.get $needle_ptr) (local.get $needle_len)))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then (return (i32.const -1)))
    )

    (local.set $val_start (i32.add (i32.add (local.get $src) (local.get $pos)) (local.get $needle_len)))
    (local.set $i (i32.const 0))
    (local.set $out (i32.const 0))
    (local.set $esc (i32.const 0))

    (block $done
      (loop $scan
        (if (i32.ge_u (i32.add (local.get $val_start) (local.get $i)) (i32.add (local.get $src) (local.get $src_len)))
          (then (br $done))
        )
        (if (i32.ge_u (local.get $out) (local.get $max_len))
          (then (br $done))
        )
        (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
        (if (local.get $esc)
          (then
            (local.set $esc (i32.const 0))
            (i32.store8 (i32.add (local.get $dst_ptr) (local.get $out)) (local.get $ch))
            (local.set $out (i32.add (local.get $out) (i32.const 1)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $scan)
          )
          (else
            (if (i32.eq (local.get $ch) (i32.const 92)) ;; ''
              (then
                (local.set $esc (i32.const 1))
                (i32.store8 (i32.add (local.get $dst_ptr) (local.get $out)) (local.get $ch))
                (local.set $out (i32.add (local.get $out) (i32.const 1)))
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                (br $scan)
              )
            )
            (if (i32.eq (local.get $ch) (i32.const 34)) ;; closing '"'
              (then (br $done))
            )
            (i32.store8 (i32.add (local.get $dst_ptr) (local.get $out)) (local.get $ch))
            (local.set $out (i32.add (local.get $out) (i32.const 1)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $scan)
          )
        )
      )
    )
    (local.get $out)
  )

  ;; Sanitizes a single-line title/query from raw JSON string at $src ($len bytes) into 1303000
  ;; Converts escaped quotes to single quotes and newlines/tabs to spaces so outer+inner JSON is 100% valid
  (func $sanitize_single_line (param $src i32) (param $len i32) (result i32)
    (local $i i32)
    (local $out i32)
    (local $ch i32)
    (local $next i32)
    (local.set $i (i32.const 0))
    (local.set $out (i32.const 0))
    (loop $s_loop
      (if (i32.and (i32.lt_u (local.get $i) (local.get $len)) (i32.lt_u (local.get $out) (i32.const 500)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.eq (local.get $ch) (i32.const 92)) ;; ''
            (then
              (if (i32.lt_u (i32.add (local.get $i) (i32.const 1)) (local.get $len))
                (then
                  (local.set $next (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1)))))
                  (if (i32.eq (local.get $next) (i32.const 34)) ;; escaped quote -> '
                    (then
                      (i32.store8 (i32.add (i32.const 1303000) (local.get $out)) (i32.const 39))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                    )
                    (else
                      ;; escaped n, r, t -> space
                      (i32.store8 (i32.add (i32.const 1303000) (local.get $out)) (i32.const 32))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                    )
                  )
                  (local.set $i (i32.add (local.get $i) (i32.const 2)))
                  (br $s_loop)
                )
              )
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $s_loop)
            )
          )
          (if (i32.eq (local.get $ch) (i32.const 34))
            (then (local.set $ch (i32.const 39)))
          )
          (if (i32.lt_u (local.get $ch) (i32.const 32))
            (then (local.set $ch (i32.const 32)))
          )
          (i32.store8 (i32.add (i32.const 1303000) (local.get $out)) (local.get $ch))
          (local.set $out (i32.add (local.get $out) (i32.const 1)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $s_loop)
        )
      )
    )
    (global.set $arg_len (local.get $out))
    (local.get $out)
  )

  ;; Decodes raw JSON content at 1400000 ($raw_body_len) into readable UTF-8 at 1600000 ($preview_len)
  ;; so we can both display it in chat AND chunk/escape it cleanly into Notion paragraph blocks!
  (func $decode_body_to_preview (param $src i32) (param $len i32) (result i32)
    (local $i i32)
    (local $out i32)
    (local $ch i32)
    (local $next i32)
    (local.set $i (i32.const 0))
    (local.set $out (i32.const 0))
    (loop $d_loop
      (if (i32.and (i32.lt_u (local.get $i) (local.get $len)) (i32.lt_u (local.get $out) (i32.const 24000)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.eq (local.get $ch) (i32.const 92)) ;; backslash
            (then
              (if (i32.lt_u (i32.add (local.get $i) (i32.const 1)) (local.get $len))
                (then
                  (local.set $next (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1)))))
                  (if (i32.eq (local.get $next) (i32.const 110)) ;; escaped n -> newline (10)
                    (then
                      (i32.store8 (i32.add (i32.const 1600000) (local.get $out)) (i32.const 10))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $d_loop)
                    )
                  )
                  (if (i32.eq (local.get $next) (i32.const 114)) ;; escaped r -> skip
                    (then
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $d_loop)
                    )
                  )
                  (if (i32.eq (local.get $next) (i32.const 116)) ;; escaped t -> space
                    (then
                      (i32.store8 (i32.add (i32.const 1600000) (local.get $out)) (i32.const 32))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $d_loop)
                    )
                  )
                  (if (i32.eq (local.get $next) (i32.const 34)) ;; escaped quote -> '
                    (then
                      (i32.store8 (i32.add (i32.const 1600000) (local.get $out)) (i32.const 39))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $d_loop)
                    )
                  )
                  (if (i32.eq (local.get $next) (i32.const 92)) ;; escaped backslash -> /
                    (then
                      (i32.store8 (i32.add (i32.const 1600000) (local.get $out)) (i32.const 47))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $d_loop)
                    )
                  )
                  ;; Any other escape: emit next char
                  (i32.store8 (i32.add (i32.const 1600000) (local.get $out)) (local.get $next))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $i (i32.add (local.get $i) (i32.const 2)))
                  (br $d_loop)
                )
              )
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $d_loop)
            )
          )
          (if (i32.eq (local.get $ch) (i32.const 34)) ;; '"' -> '''
            (then (local.set $ch (i32.const 39)))
          )
          (if (i32.eq (local.get $ch) (i32.const 13)) ;; CR -> skip
            (then
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $d_loop)
            )
          )
          (i32.store8 (i32.add (i32.const 1600000) (local.get $out)) (local.get $ch))
          (local.set $out (i32.add (local.get $out) (i32.const 1)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $d_loop)
        )
      )
    )
    (global.set $preview_len (local.get $out))
    (local.get $out)
  )

  ;; Appends a slice of decoded UTF-8 text from 1600000 [$start .. $end) into HTTP request buffer at $dst,
  ;; escaping newlines (10) as double-backslash n (bytes 92, 92, 110) for the inner Notion JSON body!
  (func $append_escaped_chunk (param $dst i32) (param $start i32) (param $end i32) (result i32)
    (local $i i32)
    (local $ch i32)
    (local $p i32)
    (local.set $i (local.get $start))
    (local.set $p (local.get $dst))
    (loop $c_loop
      (if (i32.lt_u (local.get $i) (local.get $end))
        (then
          (local.set $ch (i32.load8_u (i32.add (i32.const 1600000) (local.get $i))))
          (if (i32.eq (local.get $ch) (i32.const 10)) ;; newline -> 92, 92, 110
            (then
              (i32.store8 (local.get $p) (i32.const 92))
              (i32.store8 (i32.add (local.get $p) (i32.const 1)) (i32.const 92))
              (i32.store8 (i32.add (local.get $p) (i32.const 2)) (i32.const 110))
              (local.set $p (i32.add (local.get $p) (i32.const 3)))
            )
            (else
              (if (i32.or (i32.eq (local.get $ch) (i32.const 34)) (i32.eq (local.get $ch) (i32.const 92)))
                (then (local.set $ch (i32.const 39)))
              )
              (if (i32.lt_u (local.get $ch) (i32.const 32))
                (then (local.set $ch (i32.const 32)))
              )
              (i32.store8 (local.get $p) (local.get $ch))
              (local.set $p (i32.add (local.get $p) (i32.const 1)))
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $c_loop)
        )
      )
    )
    (local.get $p)
  )

  ;; Builds and dispatches POST /v1/pages with multi-block paragraph support (each block <= 1800 UTF-8 bytes)
  (func $send_create_page (result i32)
    (local $p i32)
    (local $req_len i32)
    (local $cur i32)
    (local $total i32)
    (local $chunk_end i32)
    (local $scan i32)
    (local $first_block i32)

    (local.set $p (call $copy_mem (i32.const 145660) (i32.const 200000) (i32.const 146)))
    (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
    (local.set $p (call $copy_mem (i32.const 145822) (local.get $p) (i32.const 102)))
    (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $parent_len)))
    (local.set $p (call $copy_mem (i32.const 145940) (local.get $p) (i32.const 67)))
    (local.set $p (call $copy_mem (i32.const 1303000) (local.get $p) (global.get $arg_len)))

    (local.set $total (global.get $preview_len))
    (if (i32.gt_u (local.get $total) (i32.const 0))
      (then
        (local.set $p (call $copy_mem (i32.const 146067) (local.get $p) (i32.const 140)))
        (local.set $cur (i32.const 0))
        (local.set $first_block (i32.const 1))

        (loop $block_loop
          (if (i32.lt_u (local.get $cur) (local.get $total))
            (then
              (if (i32.eqz (local.get $first_block))
                (then
                  (local.set $p (call $copy_mem (i32.const 146223) (local.get $p) (i32.const 126)))
                )
              )
              (local.set $first_block (i32.const 0))

              ;; Determine safe chunk end (<= 1600 bytes per paragraph block, split at newline or UTF-8 boundary)
              (local.set $chunk_end (i32.add (local.get $cur) (i32.const 1600)))
              (if (i32.ge_u (local.get $chunk_end) (local.get $total))
                (then
                  (local.set $chunk_end (local.get $total))
                )
                (else
                  ;; Try to find a newline (10) or space (32) within the last 300 bytes of the chunk
                  (local.set $scan (local.get $chunk_end))
                  (block $split_found
                    (loop $find_nl
                      (if (i32.gt_u (local.get $scan) (i32.add (local.get $cur) (i32.const 1200)))
                        (then
                          (if (i32.eq (i32.load8_u (i32.add (i32.const 1600000) (local.get $scan))) (i32.const 10))
                            (then
                              (local.set $chunk_end (i32.add (local.get $scan) (i32.const 1)))
                              (br $split_found)
                            )
                          )
                          (local.set $scan (i32.sub (local.get $scan) (i32.const 1)))
                          (br $find_nl)
                        )
                      )
                    )
                    ;; Otherwise avoid splitting in the middle of a UTF-8 continuation byte (0x80..0xBF)
                    (loop $utf8_back
                      (if (i32.and
                            (i32.gt_u (local.get $chunk_end) (local.get $cur))
                            (i32.eq (i32.and (i32.load8_u (i32.add (i32.const 1600000) (local.get $chunk_end))) (i32.const 192)) (i32.const 128)))
                        (then
                          (local.set $chunk_end (i32.sub (local.get $chunk_end) (i32.const 1)))
                          (br $utf8_back)
                        )
                      )
                    )
                  )
                )
              )

              (local.set $p (call $append_escaped_chunk (local.get $p) (local.get $cur) (local.get $chunk_end)))
              (local.set $cur (local.get $chunk_end))
              (br $block_loop)
            )
          )
        )

        (local.set $p (call $copy_mem (i32.const 146365) (local.get $p) (i32.const 30)))
      )
      (else
        (local.set $p (call $copy_mem (i32.const 146023) (local.get $p) (i32.const 28)))
      )
    )

    (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
    (global.set $phase (i32.const 5))
    (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
    (i32.const 0)
  )

  ;; ── Main Entrypoint ──────────────────────────────────────────────────────
  (func (export "notion_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $pos i32)
    (local $token_start i32)
    (local $raw_len i32)
    (local $p i32)
    (local $req_len i32)
    (local $i i32)
    (local $ch i32)
    (local $has_saved_parent i32)
    (local $title_len i32)
    (local $query_len i32)
    (local $content_len i32)
    (local $tok_json_len i32)
    (local $par_json_len i32)

    ;; Reset globals
    (global.set $arg_len (i32.const 0))
    (global.set $op_len (i32.const 0))
    (global.set $raw_body_len (i32.const 0))
    (global.set $preview_len (i32.const 0))

    ;; 1. Empty input -> Help
    (if (i32.eqz (local.get $in_len))
      (then
        (drop (call $copy_mem (i32.const 140000) (i32.const 65536) (i32.const 1151)))
        (return (i32.const 1151))
      )
    )

    ;; 2. Direct token paste convenience (if user pastes secret_... or ntn_... directly)
    (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 146823) (i32.const 7)))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 146846) (i32.const 4)))
      )
    )
    (if (i32.ge_s (local.get $pos) (i32.const 0))
      (then
        (local.set $token_start (i32.add (local.get $in_ptr) (local.get $pos)))
        (local.set $i (i32.const 0))
        (loop $scan_direct_tok
          (if (i32.lt_u (i32.add (local.get $token_start) (local.get $i)) (i32.add (local.get $in_ptr) (local.get $in_len)))
            (then
              (if (i32.lt_u (local.get $i) (i32.const 120))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $token_start) (local.get $i))))
                  (if (i32.and
                        (i32.and (i32.gt_u (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                        (i32.and (i32.ne (local.get $ch) (i32.const 39)) (i32.ne (local.get $ch) (i32.const 125))))
                    (then
                      (i32.store8 (i32.add (i32.const 1302000) (local.get $i)) (local.get $ch))
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $scan_direct_tok)
                    )
                  )
                )
              )
            )
          )
        )
        (global.set $token_len (local.get $i))
        (if (i32.gt_u (global.get $token_len) (i32.const 10))
          (then
            (local.set $p (call $copy_mem (i32.const 144151) (i32.const 200000) (i32.const 73)))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const 144240) (local.get $p) (i32.const 3)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

            (local.set $p (call $copy_mem (i32.const 144532) (i32.const 200000) (i32.const 148)))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const 144696) (local.get $p) (i32.const 86)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (global.set $phase (i32.const 1))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; 3. Extract AI Intent Contract JSON fields
    ;; Extract "operation":"..." or "action":"..." into 1306000
    (local.set $raw_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const 146436) (i32.const 13) (i32.const 1306000) (i32.const 64)))
    (if (i32.lt_s (local.get $raw_len) (i32.const 0))
      (then
        (local.set $raw_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const 146465) (i32.const 10) (i32.const 1306000) (i32.const 64)))
      )
    )
    (if (i32.gt_s (local.get $raw_len) (i32.const 0))
      (then
        (call $to_lower (i32.const 1306000) (i32.const 1306000) (local.get $raw_len))
        (global.set $op_len (local.get $raw_len))
      )
    )

    ;; Extract "title":"..." and "query":"..."
    (local.set $title_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const 146516) (i32.const 9) (i32.const 1310000) (i32.const 1000)))
    (local.set $query_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const 146491) (i32.const 9) (i32.const 1312000) (i32.const 1000)))

    ;; Extract "content":"..." (or "extra":"...") into 1400000
    (local.set $content_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const 146541) (i32.const 11) (i32.const 1400000) (i32.const 45000)))
    (if (i32.le_s (local.get $content_len) (i32.const 0))
      (then
        (local.set $content_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const 146568) (i32.const 9) (i32.const 1400000) (i32.const 45000)))
      )
    )
    (if (i32.gt_s (local.get $content_len) (i32.const 0))
      (then
        (global.set $raw_body_len (local.get $content_len))
        (drop (call $decode_body_to_preview (i32.const 1400000) (local.get $content_len)))
      )
    )

    ;; ── Dispatch by AI Operation ──

    ;; A. "help"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 146803) (i32.const 4)) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 140000) (i32.const 65536) (i32.const 1151)))
        (return (i32.const 1151))
      )
    )

    ;; B. "disconnect"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 146777) (i32.const 10)) (i32.const 0))
      (then
        (drop (call $host_call (i32.const 144259) (i32.const 68) (i32.const 1300000) (i32.const 1024)))
        (drop (call $copy_mem (i32.const 142076) (i32.const 65536) (i32.const 94)))
        (return (i32.const 94))
      )
    )

    ;; C. "status"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 146711) (i32.const 6)) (i32.const 0))
      (then
        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then
            (drop (call $copy_mem (i32.const 141825) (i32.const 65536) (i32.const 235)))
            (return (i32.const 235))
          )
        )
        (local.set $p (call $copy_mem (i32.const 144532) (i32.const 200000) (i32.const 148)))
        (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_mem (i32.const 144696) (local.get $p) (i32.const 86)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
        (global.set $phase (i32.const 2))
        (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
        (return (i32.const 0))
      )
    )

    ;; D. "config"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 146733) (i32.const 6)) (i32.const 0))
      (then
        (local.set $tok_json_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const 146593) (i32.const 9) (i32.const 1302000) (i32.const 150)))
        (if (i32.le_s (local.get $tok_json_len) (i32.const 0))
          (then
            (if (i32.gt_s (local.get $query_len) (i32.const 0))
              (then
                (drop (call $copy_mem (i32.const 1312000) (i32.const 1302000) (local.get $query_len)))
                (local.set $tok_json_len (local.get $query_len))
              )
            )
          )
        )
        (if (i32.gt_s (local.get $tok_json_len) (i32.const 8))
          (then
            (global.set $token_len (local.get $tok_json_len))
            (local.set $p (call $copy_mem (i32.const 144151) (i32.const 200000) (i32.const 73)))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const 144240) (local.get $p) (i32.const 3)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

            (local.set $p (call $copy_mem (i32.const 144532) (i32.const 200000) (i32.const 148)))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const 144696) (local.get $p) (i32.const 86)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (global.set $phase (i32.const 1))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
            (return (i32.const 0))
          )
        )
        (drop (call $copy_mem (i32.const 141825) (i32.const 65536) (i32.const 235)))
        (return (i32.const 235))
      )
    )

    ;; E. "parent"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 146755) (i32.const 6)) (i32.const 0))
      (then
        (local.set $par_json_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const 146618) (i32.const 13) (i32.const 1307000) (i32.const 60)))
        (if (i32.le_s (local.get $par_json_len) (i32.const 0))
          (then
            (if (i32.gt_s (local.get $query_len) (i32.const 0))
              (then
                (drop (call $copy_mem (i32.const 1312000) (i32.const 1307000) (local.get $query_len)))
                (local.set $par_json_len (local.get $query_len))
              )
            )
          )
        )
        (if (i32.gt_s (local.get $par_json_len) (i32.const 10))
          (then
            (global.set $parent_len (local.get $par_json_len))
            (local.set $p (call $copy_mem (i32.const 144424) (i32.const 200000) (i32.const 73)))
            (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $parent_len)))
            (local.set $p (call $copy_mem (i32.const 144513) (local.get $p) (i32.const 3)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))
            (drop (call $copy_mem (i32.const 143205) (i32.const 65536) (i32.const 137)))
            (return (i32.const 137))
          )
        )
      )
    )

    ;; F. "create" (or if "content" or "title" was provided by AI)
    (if (i32.or
          (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 146647) (i32.const 6)) (i32.const 0))
          (i32.or (i32.gt_s (local.get $content_len) (i32.const 0)) (i32.gt_s (local.get $title_len) (i32.const 0))))
      (then
        ;; Ensure we have a clean title in 1303000
        (if (i32.gt_s (local.get $title_len) (i32.const 0))
          (then
            (drop (call $sanitize_single_line (i32.const 1310000) (local.get $title_len)))
          )
          (else
            (if (i32.gt_s (local.get $query_len) (i32.const 0))
              (then
                (drop (call $sanitize_single_line (i32.const 1312000) (local.get $query_len)))
              )
              (else
                (drop (call $copy_mem (i32.const 146866) (i32.const 1303000) (i32.const 14)))
                (global.set $arg_len (i32.const 14))
              )
            )
          )
        )

        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then
            (drop (call $copy_mem (i32.const 141825) (i32.const 65536) (i32.const 235)))
            (return (i32.const 235))
          )
        )

        (local.set $has_saved_parent (call $load_parent_id))
        (if (i32.gt_u (local.get $has_saved_parent) (i32.const 0))
          (then
            (return (call $send_create_page))
          )
        )

        ;; Auto-discover parent page in Notion workspace
        (local.set $p (call $copy_mem (i32.const 144798) (i32.const 200000) (i32.const 147)))
        (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_mem (i32.const 145400) (local.get $p) (i32.const 244)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
        (global.set $phase (i32.const 4))
        (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
        (return (i32.const 0))
      )
    )

    ;; G. "search" / "list" (or default when authenticated)
    (local.set $raw_len (call $load_api_token))
    (if (i32.eqz (local.get $raw_len))
      (then
        (drop (call $copy_mem (i32.const 141825) (i32.const 65536) (i32.const 235)))
        (return (i32.const 235))
      )
    )

    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 146691) (i32.const 4)) (i32.const 0))
      (then
        (global.set $arg_len (i32.const 0))
      )
      (else
        (if (i32.gt_s (local.get $query_len) (i32.const 0))
          (then
            (drop (call $sanitize_single_line (i32.const 1312000) (local.get $query_len)))
          )
          (else
            (global.set $arg_len (i32.const 0))
          )
        )
      )
    )

    (local.set $p (call $copy_mem (i32.const 144798) (i32.const 200000) (i32.const 147)))
    (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
    (if (i32.gt_u (global.get $arg_len) (i32.const 0))
      (then
        (local.set $p (call $copy_mem (i32.const 144961) (local.get $p) (i32.const 88)))
        (local.set $p (call $copy_mem (i32.const 1303000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_mem (i32.const 145065) (local.get $p) (i32.const 115)))
      )
      (else
        (local.set $p (call $copy_mem (i32.const 145196) (local.get $p) (i32.const 188)))
      )
    )
    (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
    (global.set $phase (i32.const 3))
    (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
    (i32.const 0)
  )

  ;; ── Resume Handler (Async HTTP Response) ─────────────────────────────────
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
    (local $prev_copy_len i32)

    ;; Unescape host response into 900000
    (local.set $u_len (call $unescape_response (local.get $res_ptr) (local.get $res_len) (i32.const 900000)))

    ;; Check HTTP status 200
    (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 146896) (i32.const 16)))
    (local.set $is_200 (i32.ge_s (local.get $idx) (i32.const 0)))

    ;; ─── Phase 1: Config Verification ───
    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        (if (local.get $is_200)
          (then
            (drop (call $copy_mem (i32.const 141167) (i32.const 65536) (i32.const 352)))
            (return (i32.const 352))
          )
          (else
            (drop (call $copy_mem (i32.const 141535) (i32.const 65536) (i32.const 274)))
            (return (i32.const 274))
          )
        )
      )
    )

    ;; ─── Phase 2: Status Check ───
    (if (i32.eq (global.get $phase) (i32.const 2))
      (then
        (if (local.get $is_200)
          (then
            (drop (call $copy_mem (i32.const 142186) (i32.const 65536) (i32.const 352)))
            (return (i32.const 352))
          )
          (else
            (drop (call $copy_mem (i32.const 142554) (i32.const 65536) (i32.const 155)))
            (return (i32.const 155))
          )
        )
      )
    )

    ;; ─── Phase 3: Search / List ───
    (if (i32.eq (global.get $phase) (i32.const 3))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            (drop (call $copy_mem (i32.const 143039) (i32.const 65536) (i32.const 150)))
            (return (i32.const 150))
          )
        )

        (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 146928) (i32.const 12)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 142785) (i32.const 65536) (i32.const 238)))
            (return (i32.const 238))
          )
        )

        (local.set $p (call $copy_mem (i32.const 142725) (i32.const 65536) (i32.const 44)))

        (local.set $scan_ptr (i32.const 900000))
        (local.set $scan_end (i32.add (i32.const 900000) (local.get $u_len)))
        (local.set $item_count (i32.const 0))

        (loop $parse_items
          (if (i32.and (i32.lt_u (local.get $item_count) (i32.const 5)) (i32.lt_u (local.get $scan_ptr) (local.get $scan_end)))
            (then
              (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const 146978) (i32.const 15)))
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

                  (local.set $title_start (i32.const 147066))
                  (local.set $title_len (i32.const 17))
                  (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const 147009) (i32.const 14)))
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

                  (local.set $p (call $copy_mem (i32.const 147099) (local.get $p) (i32.const 10)))
                  (if (i32.gt_u (local.get $title_len) (i32.const 0))
                    (then (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len))))
                    (else (local.set $p (call $copy_mem (i32.const 147066) (local.get $p) (i32.const 17))))
                  )
                  (local.set $p (call $copy_mem (i32.const 147125) (local.get $p) (i32.const 2)))
                  (local.set $p (call $copy_mem (local.get $url_start) (local.get $p) (local.get $url_len)))
                  (local.set $p (call $copy_mem (i32.const 147143) (local.get $p) (i32.const 2)))

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
            (drop (call $copy_mem (i32.const 142785) (i32.const 65536) (i32.const 238)))
            (return (i32.const 238))
          )
        )

        (return (i32.sub (local.get $p) (i32.const 65536)))
      )
    )

    ;; ─── Phase 4: Create Step 1 — Parent Search Response ───
    (if (i32.eq (global.get $phase) (i32.const 4))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 147039) (i32.const 11)))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 11)))
                (local.set $i (i32.const 0))
                (loop $find_msg_end
                  (if (i32.and (i32.lt_u (local.get $i) (i32.const 160)) (i32.lt_u (i32.add (local.get $msg_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len))))
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
                (local.set $p (call $copy_mem (i32.const 143920) (i32.const 65536) (i32.const 25)))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $msg_len)))
                (local.set $p (call $copy_mem (i32.const 143961) (local.get $p) (i32.const 93)))
                (return (i32.sub (local.get $p) (i32.const 65536)))
              )
            )
            (drop (call $copy_mem (i32.const 143358) (i32.const 65536) (i32.const 327)))
            (return (i32.const 327))
          )
        )

        ;; Extract first "id":"..." from results
        (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 146956) (i32.const 6)))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 143358) (i32.const 65536) (i32.const 327)))
            (return (i32.const 327))
          )
        )

        (local.set $url_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 6)))
        (local.set $i (i32.const 0))
        (loop $copy_parent_id
          (if (i32.lt_u (local.get $i) (i32.const 36))
            (then
              (local.set $ch (i32.load8_u (i32.add (local.get $url_start) (local.get $i))))
              (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 0)))
                (then
                  (i32.store8 (i32.add (i32.const 1307000) (local.get $i)) (local.get $ch))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $copy_parent_id)
                )
              )
            )
          )
        )
        (global.set $parent_len (local.get $i))

        ;; Persist parent ID for future calls
        (local.set $p (call $copy_mem (i32.const 144424) (i32.const 200000) (i32.const 73)))
        (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $parent_len)))
        (local.set $p (call $copy_mem (i32.const 144513) (local.get $p) (i32.const 3)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
        (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

        ;; Step 4B: POST /v1/pages with title + content body
        (return (call $send_create_page))
      )
    )

    ;; ─── Phase 5: Create Step 2 — Page Created Response ───
    (if (i32.eq (global.get $phase) (i32.const 5))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            ;; If parent_id was invalid/archived, clear stored parent_id so next call re-discovers a valid parent
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 147039) (i32.const 11)))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 11)))
                (local.set $i (i32.const 0))
                (loop $find_c_msg_end
                  (if (i32.and (i32.lt_u (local.get $i) (i32.const 180)) (i32.lt_u (i32.add (local.get $msg_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len))))
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
                (local.set $p (call $copy_mem (i32.const 143920) (i32.const 65536) (i32.const 25)))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $msg_len)))
                (local.set $p (call $copy_mem (i32.const 143961) (local.get $p) (i32.const 93)))
                (return (i32.sub (local.get $p) (i32.const 65536)))
              )
            )
            (local.set $p (call $copy_mem (i32.const 143920) (i32.const 65536) (i32.const 25)))
            (local.set $p (call $copy_mem (i32.const 143961) (local.get $p) (i32.const 93)))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
        )

        (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 146978) (i32.const 15)))
        (local.set $url_start (i32.const 900000))
        (local.set $url_len (i32.const 0))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (local.set $url_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 7)))
            (local.set $i (i32.const 0))
            (loop $find_c_url_end
              (if (i32.lt_u (i32.add (local.get $url_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len)))
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

        ;; Build rich response: link + generated content preview
        (local.set $p (call $copy_mem (i32.const 143701) (i32.const 65536) (i32.const 56)))
        (local.set $p (call $copy_mem (i32.const 1303000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_mem (i32.const 143773) (local.get $p) (i32.const 4)))
        (local.set $p (call $copy_mem (local.get $url_start) (local.get $p) (local.get $url_len)))
        (local.set $p (call $copy_mem (i32.const 143793) (local.get $p) (i32.const 8)))

        (if (i32.gt_u (global.get $preview_len) (i32.const 0))
          (then
            (local.set $prev_copy_len (global.get $preview_len))
            (if (i32.gt_u (local.get $prev_copy_len) (i32.const 12000))
              (then (local.set $prev_copy_len (i32.const 12000)))
            )
            (local.set $p (call $copy_mem (i32.const 1600000) (local.get $p) (local.get $prev_copy_len)))
          )
        )

        (local.set $p (call $copy_mem (i32.const 143817) (local.get $p) (i32.const 87)))
        (return (i32.sub (local.get $p) (i32.const 65536)))
      )
    )

    (drop (call $copy_mem (i32.const 140000) (i32.const 65536) (i32.const 1151)))
    (i32.const 1151)
  )
)
