;; Chattree Official GitHub Integration Plugin v1.0.0
;; - 100% Natural Language & AI Tool Calling via intentContract
;; - Supports creating rich technical Issues (POST /repos/:owner/:repo/issues),
;;   listing open Issues, listing user Repositories, searching public/private Repositories,
;;   configuring default repository, and managing Personal Access Tokens.
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; 64 pages = 4 MB sandbox linear memory
  (memory (export "memory") 64)

  (global $phase        (mut i32) (i32.const 0))
  (global $token_len    (mut i32) (i32.const 0))
  (global $arg_len      (mut i32) (i32.const 0))  ;; sanitized title/query length at 1303000
  (global $op_len       (mut i32) (i32.const 0))  ;; operation length at 1306000
  (global $repo_len     (mut i32) (i32.const 0))  ;; owner/repo length at 1307000
  (global $url_q_len    (mut i32) (i32.const 0))  ;; URL-encoded query at 1308000
  (global $raw_body_len (mut i32) (i32.const 0))  ;; raw JSON-extracted content at 1400000
  (global $preview_len  (mut i32) (i32.const 0))  ;; readable UTF-8 preview at 1600000

  ;; ── Static Data Segments ─────────────────────────────────────────────────
  ;; [140000] help (1218B)
  (data (i32.const 140000) "\f0\9f\90\99 **GitHub Copilot & Workspace Integration (IA & Lenguaje Natural)**\0a\0aConecta tu cuenta de GitHub con Chattree y administra tus repositorios, issues y b\c3\basquedas en **lenguaje natural**. La IA redacta y estructura autom\c3\a1ticamente tus reportes de bugs, historias de usuario y propuestas t\c3\a9cnicas.\0a\0a**Ejemplos de uso en lenguaje natural con `/github`:**\0a\e2\80\a2 `/github cr\c3\a9ame un issue en Ponce5/Chattree sobre optimizar el consumo de bater\c3\ada en segundo plano con pasos detallados`\0a\e2\80\a2 `/github mu\c3\a9strame mis repositorios m\c3\a1s recientes`\0a\e2\80\a2 `/github revisa los issues abiertos del repositorio Ponce5/Chattree`\0a\e2\80\a2 `/github busca repositorios de motores WebAssembly en Flutter`\0a\e2\80\a2 `/github configura mi repositorio por defecto como Ponce5/Chattree`\0a\e2\80\a2 `/github configura mi token ghp_tu_personal_access_token`\0a\e2\80\a2 `/github verifica el estado de mi cuenta`\0a\0a*\c2\bfC\c3\b3mo conectar tu cuenta de GitHub?*\0a1. Ve a **GitHub Settings** -> **Developer settings** -> **Personal access tokens** (https://github.com/settings/tokens).\0a2. Genera un token cl\c3\a1sico (`ghp_...`) o Fine-grained (`github_pat_...`) con permisos `repo` (o `public_repo` y `issues:write`).\0a3. En Chattree escribe: `/github configura mi token <tu_token>`.")
  ;; [141234] key_saved_ok_prefix (84B)
  (data (i32.const 141234) "\e2\9c\85 **GitHub configurado y verificado exitosamente.**\0a\0a\f0\9f\91\a4 **Cuenta conectada:** `@")
  ;; [141334] key_saved_ok_suffix (194B)
  (data (i32.const 141334) "`\0a\0aAhora puedes pedir en lenguaje natural:\0a\e2\80\a2 `/github mu\c3\a9strame mis repositorios recientes`\0a\e2\80\a2 `/github crea un issue en usuario/repo explicando...`\0a\e2\80\a2 `/github busca repositorios sobre...`")
  ;; [141544] key_saved_invalid (251B)
  (data (i32.const 141544) "\e2\9a\a0\ef\b8\8f **Token guardado pero no se pudo validar con GitHub.**\0a\0aGitHub devolvi\c3\b3 un error de autenticaci\c3\b3n (401). Verifica que tu Personal Access Token (`ghp_...` o `github_pat_...`) sea v\c3\a1lido y no haya expirado en https://github.com/settings/tokens")
  ;; [141811] key_missing (335B)
  (data (i32.const 141811) "\e2\9a\a0\ef\b8\8f **GitHub no est\c3\a1 configurado.**\0a\0aPara crear issues o ver tus repositorios privados, registra tu Personal Access Token diciendo:\0a`/github configura mi token ghp_tu_token`\0a\0aPuedes generar uno en https://github.com/settings/tokens (Nota: a\c3\ban sin token puedes buscar repositorios p\c3\bablicos o ver issues de repositorios p\c3\bablicos).")
  ;; [142162] disconnected (94B)
  (data (i32.const 142162) "\e2\9c\85 **Desconectado de GitHub.**\0a\0aSe ha eliminado tu Personal Access Token de este dispositivo.")
  ;; [142272] status_ok_prefix (69B)
  (data (i32.const 142272) "\e2\9c\85 **Conexi\c3\b3n con GitHub activa y saludable.**\0a\0a\e2\80\a2 **Usuario:** `@")
  ;; [142357] status_ok_mid (39B)
  (data (i32.const 142357) "`\0a\e2\80\a2 **Repositorio predeterminado:** `")
  ;; [142412] status_ok_suffix (281B)
  (data (i32.const 142412) "`\0a\e2\80\a2 **API:** GitHub REST API v2022-11-28\0a\e2\80\a2 **Modo:** 100% Lenguaje Natural con IA de Chattree (creaci\c3\b3n de issues con redacci\c3\b3n t\c3\a9cnica autom\c3\a1tica, consulta de repositorios, issues y b\c3\basqueda global)\0a\0aPide lo que necesites con `/github <tu solicitud en lenguaje natural>`.")
  ;; [142709] status_none_repo (57B)
  (data (i32.const 142709) "No configurado (usa /github configura mi repo owner/repo)")
  ;; [142782] status_error (159B)
  (data (i32.const 142782) "\e2\9d\8c **No se pudo autenticar con GitHub.**\0a\0aEl token guardado no es v\c3\a1lido o ha expirado. Configura uno nuevo diciendo:\0a`/github configura mi token <tu_token>`")
  ;; [142957] repo_saved_prefix (49B)
  (data (i32.const 142957) "\e2\9c\85 **Repositorio predeterminado configurado:** `")
  ;; [143022] repo_saved_suffix (112B)
  (data (i32.const 143022) "`\0a\0aAhora puedes crear issues o listar issues sin necesidad de repetir el nombre del repositorio en cada mensaje.")
  ;; [143150] repo_missing (265B)
  (data (i32.const 143150) "\e2\9a\a0\ef\b8\8f **Falta indicar el repositorio (`owner/repo`).**\0a\0aPor favor indica el repositorio en tu solicitud (por ejemplo: *\22en el repo Ponce5/Chattree\22*) o configura un repositorio predeterminado diciendo:\0a`/github configura mi repositorio por defecto como owner/repo`")
  ;; [143431] repos_header (48B)
  (data (i32.const 143431) "\f0\9f\90\99 **Tus repositorios recientes en GitHub:**\0a\0a")
  ;; [143495] search_header (46B)
  (data (i32.const 143495) "\f0\9f\94\8d **Repositorios encontrados en GitHub:**\0a\0a")
  ;; [143557] issues_header_prefix (26B)
  (data (i32.const 143557) "\f0\9f\93\8b **Issues abiertos en ")
  ;; [143599] issues_header_suffix (5B)
  (data (i32.const 143599) ":**\0a\0a")
  ;; [143620] empty_results (69B)
  (data (i32.const 143620) "\e2\84\b9\ef\b8\8f **No se encontraron resultados en GitHub para esta consulta.**")
  ;; [143705] api_error_prefix (29B)
  (data (i32.const 143705) "\e2\9d\8c **Error de GitHub API:** ")
  ;; [143750] api_error_suffix (105B)
  (data (i32.const 143750) "\0a\0aVerifica que el repositorio exista y que tu token tenga permisos suficientes (`repo` / `issues:write`).")
  ;; [143871] create_ok_prefix (54B)
  (data (i32.const 143871) "\e2\9c\85 **Issue creado exitosamente en GitHub:**\0a\0a\f0\9f\90\9b [**")
  ;; [143941] create_ok_mid (4B)
  (data (i32.const 143941) "**](")
  ;; [143961] create_ok_mid2 (8B)
  (data (i32.const 143961) ")\0a\0a---\0a\0a")
  ;; [143985] create_ok_suffix (73B)
  (data (i32.const 143985) "\0a\0a---\0a*El issue ya est\c3\a1 publicado y activo en el repositorio de GitHub.*")
  ;; [144074] storage_get_tok (65B)
  (data (i32.const 144074) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22api_token\22}}")
  ;; [144155] storage_set_tok_prefix (73B)
  (data (i32.const 144155) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22api_token\22,\22value\22:\22")
  ;; [144244] storage_set_tok_suffix (3B)
  (data (i32.const 144244) "\22}}")
  ;; [144263] storage_del_tok (68B)
  (data (i32.const 144263) "{\22api\22:\22storage\22,\22operation\22:\22delete\22,\22payload\22:{\22key\22:\22api_token\22}}")
  ;; [144347] storage_get_repo (68B)
  (data (i32.const 144347) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22default_repo\22}}")
  ;; [144431] storage_set_repo_prefix (76B)
  (data (i32.const 144431) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22default_repo\22,\22value\22:\22")
  ;; [144523] storage_set_repo_suffix (3B)
  (data (i32.const 144523) "\22}}")
  ;; [144542] http_user_prefix (141B)
  (data (i32.const 144542) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/user\22,\22method\22:\22GET\22,\22headers\22:{\22Authorization\22:\22Bearer ")
  ;; [144699] http_user_suffix (97B)
  (data (i32.const 144699) "\22,\22Accept\22:\22application/vnd.github+json\22,\22X-GitHub-Api-Version\22:\222022-11-28\22},\22timeoutMs\22:20000}}")
  ;; [144812] http_my_repos_prefix (171B)
  (data (i32.const 144812) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/user/repos?sort=updated&per_page=6\22,\22method\22:\22GET\22,\22headers\22:{\22Authorization\22:\22Bearer ")
  ;; [144999] http_my_repos_suffix (97B)
  (data (i32.const 144999) "\22,\22Accept\22:\22application/vnd.github+json\22,\22X-GitHub-Api-Version\22:\222022-11-28\22},\22timeoutMs\22:20000}}")
  ;; [145112] http_search_auth_prefix (129B)
  (data (i32.const 145112) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/search/repositories?per_page=5&sort=stars&q=")
  ;; [145257] http_search_auth_mid (52B)
  (data (i32.const 145257) "\22,\22method\22:\22GET\22,\22headers\22:{\22Authorization\22:\22Bearer ")
  ;; [145325] http_search_auth_suffix (97B)
  (data (i32.const 145325) "\22,\22Accept\22:\22application/vnd.github+json\22,\22X-GitHub-Api-Version\22:\222022-11-28\22},\22timeoutMs\22:20000}}")
  ;; [145438] http_search_noauth_suffix (123B)
  (data (i32.const 145438) "\22,\22method\22:\22GET\22,\22headers\22:{\22Accept\22:\22application/vnd.github+json\22,\22X-GitHub-Api-Version\22:\222022-11-28\22},\22timeoutMs\22:20000}}")
  ;; [145577] http_issues_prefix (91B)
  (data (i32.const 145577) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/repos/")
  ;; [145684] http_issues_mid_auth (81B)
  (data (i32.const 145684) "/issues?state=open&per_page=6\22,\22method\22:\22GET\22,\22headers\22:{\22Authorization\22:\22Bearer ")
  ;; [145781] http_issues_suffix_auth (97B)
  (data (i32.const 145781) "\22,\22Accept\22:\22application/vnd.github+json\22,\22X-GitHub-Api-Version\22:\222022-11-28\22},\22timeoutMs\22:20000}}")
  ;; [145894] http_issues_suffix_noauth (152B)
  (data (i32.const 145894) "/issues?state=open&per_page=6\22,\22method\22:\22GET\22,\22headers\22:{\22Accept\22:\22application/vnd.github+json\22,\22X-GitHub-Api-Version\22:\222022-11-28\22},\22timeoutMs\22:20000}}")
  ;; [146062] http_create_issue_prefix (91B)
  (data (i32.const 146062) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/repos/")
  ;; [146169] http_create_issue_mid1 (60B)
  (data (i32.const 146169) "/issues\22,\22method\22:\22POST\22,\22headers\22:{\22Authorization\22:\22Bearer ")
  ;; [146245] http_create_issue_mid2 (133B)
  (data (i32.const 146245) "\22,\22Accept\22:\22application/vnd.github+json\22,\22X-GitHub-Api-Version\22:\222022-11-28\22,\22Content-Type\22:\22application/json\22},\22body\22:\22{\5c\22title\5c\22:\5c\22")
  ;; [146394] http_create_issue_mid3 (14B)
  (data (i32.const 146394) "\5c\22,\5c\22body\5c\22:\5c\22")
  ;; [146424] http_create_issue_suffix (24B)
  (data (i32.const 146424) "\5c\22}\22,\22timeoutMs\22:25000}}")
  ;; [146464] needle_val_field (9B)
  (data (i32.const 146464) "\22value\22:\22")
  ;; [146489] needle_json_operation (13B)
  (data (i32.const 146489) "\22operation\22:\22")
  ;; [146518] needle_json_action (10B)
  (data (i32.const 146518) "\22action\22:\22")
  ;; [146544] needle_json_repo (8B)
  (data (i32.const 146544) "\22repo\22:\22")
  ;; [146568] needle_json_title (9B)
  (data (i32.const 146568) "\22title\22:\22")
  ;; [146593] needle_json_content (11B)
  (data (i32.const 146593) "\22content\22:\22")
  ;; [146620] needle_json_extra (9B)
  (data (i32.const 146620) "\22extra\22:\22")
  ;; [146645] needle_json_query (9B)
  (data (i32.const 146645) "\22query\22:\22")
  ;; [146670] needle_json_token (9B)
  (data (i32.const 146670) "\22token\22:\22")
  ;; [146695] needle_act_create (6B)
  (data (i32.const 146695) "create")
  ;; [146717] needle_act_issues (6B)
  (data (i32.const 146717) "issues")
  ;; [146739] needle_act_repos (5B)
  (data (i32.const 146739) "repos")
  ;; [146760] needle_act_list (4B)
  (data (i32.const 146760) "list")
  ;; [146780] needle_act_search (6B)
  (data (i32.const 146780) "search")
  ;; [146802] needle_act_repo (8B)
  (data (i32.const 146802) "set_repo")
  ;; [146826] needle_act_status (6B)
  (data (i32.const 146826) "status")
  ;; [146848] needle_act_config (6B)
  (data (i32.const 146848) "config")
  ;; [146870] needle_act_disconnect (10B)
  (data (i32.const 146870) "disconnect")
  ;; [146896] needle_act_help (4B)
  (data (i32.const 146896) "help")
  ;; [146916] needle_ghp (4B)
  (data (i32.const 146916) "ghp_")
  ;; [146936] needle_gho (4B)
  (data (i32.const 146936) "gho_")
  ;; [146956] needle_github_pat (11B)
  (data (i32.const 146956) "github_pat_")
  ;; [146983] needle_default_title (11B)
  (data (i32.const 146983) "Nuevo Issue")
  ;; [147010] needle_status_200 (16B)
  (data (i32.const 147010) "\22statusCode\22:200")
  ;; [147042] needle_status_201 (16B)
  (data (i32.const 147042) "\22statusCode\22:201")
  ;; [147074] needle_login_field (9B)
  (data (i32.const 147074) "\22login\22:\22")
  ;; [147099] needle_full_name (13B)
  (data (i32.const 147099) "\22full_name\22:\22")
  ;; [147128] needle_html_url (31B)
  (data (i32.const 147128) "\22html_url\22:\22https://github.com/")
  ;; [147175] needle_title_resp (9B)
  (data (i32.const 147175) "\22title\22:\22")
  ;; [147200] needle_desc_resp (15B)
  (data (i32.const 147200) "\22description\22:\22")
  ;; [147231] needle_msg_field (11B)
  (data (i32.const 147231) "\22message\22:\22")
  ;; [147258] needle_fallback_item (13B)
  (data (i32.const 147258) "Ver en GitHub")
  ;; [147287] bullet_repo (12B)
  (data (i32.const 147287) "\e2\80\a2 \f0\9f\93\a6 [**")
  ;; [147315] bullet_issue (12B)
  (data (i32.const 147315) "\e2\80\a2 \f0\9f\90\9b [**")
  ;; [147343] bullet_mid (23B)
  (data (i32.const 147343) "**](https://github.com/")
  ;; [147382] bullet_desc (6B)
  (data (i32.const 147382) ") \e2\80\94 ")
  ;; [147404] bullet_end (2B)
  (data (i32.const 147404) ")\0a")
  ;; [147422] newline (1B)
  (data (i32.const 147422) "\0a")

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

    (local.set $res_len (call $host_call (i32.const 144074) (i32.const 65) (i32.const 1300000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 1300000) (local.get $res_len) (i32.const 146464) (i32.const 9)))
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

  ;; Loads stored Default Repo ("owner/repo") into 1307000
  (func $load_default_repo (result i32)
    (local $res_len i32)
    (local $val_idx i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)

    (local.set $res_len (call $host_call (i32.const 144347) (i32.const 68) (i32.const 1300000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 1300000) (local.get $res_len) (i32.const 146464) (i32.const 9)))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_start (i32.add (i32.const 1300000) (i32.add (local.get $val_idx) (i32.const 9))))
    (local.set $i (i32.const 0))
    (loop $copy_r
      (if (i32.lt_u (local.get $i) (i32.const 120))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
          (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 0)))
            (then
              (i32.store8 (i32.add (i32.const 1307000) (local.get $i)) (local.get $ch))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $copy_r)
            )
          )
        )
      )
    )
    (global.set $repo_len (local.get $i))
    (local.get $i)
  )

  ;; Extracts raw JSON string value (preserving escape sequences) into $dst_ptr up to $max_len
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
            (if (i32.eq (local.get $ch) (i32.const 92)) ;; backslash
              (then
                (local.set $esc (i32.const 1))
                (i32.store8 (i32.add (local.get $dst_ptr) (local.get $out)) (local.get $ch))
                (local.set $out (i32.add (local.get $out) (i32.const 1)))
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                (br $scan)
              )
            )
            (if (i32.eq (local.get $ch) (i32.const 34)) ;; closing quote
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
          (if (i32.eq (local.get $ch) (i32.const 92)) ;; backslash
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

  ;; Converts sanitized query at 1303000 ($arg_len) into URL-safe query at 1308000 (spaces -> '+')
  (func $encode_url_query (result i32)
    (local $i i32)
    (local $out i32)
    (local $ch i32)
    (local.set $i (i32.const 0))
    (local.set $out (i32.const 0))
    (loop $q_loop
      (if (i32.lt_u (local.get $i) (global.get $arg_len))
        (then
          (local.set $ch (i32.load8_u (i32.add (i32.const 1303000) (local.get $i))))
          (if (i32.eq (local.get $ch) (i32.const 32)) ;; space -> '+' (43)
            (then
              (i32.store8 (i32.add (i32.const 1308000) (local.get $out)) (i32.const 43))
              (local.set $out (i32.add (local.get $out) (i32.const 1)))
            )
            (else
              ;; Keep alphanumeric, '-', '_', '.', '/'
              (if (i32.and (i32.gt_u (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                (then
                  (i32.store8 (i32.add (i32.const 1308000) (local.get $out)) (local.get $ch))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                )
              )
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $q_loop)
        )
      )
    )
    (global.set $url_q_len (local.get $out))
    (local.get $out)
  )

  ;; Decodes raw JSON content at 1400000 ($raw_body_len) into readable UTF-8 at 1600000 ($preview_len)
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
          (if (i32.eq (local.get $ch) (i32.const 34))
            (then (local.set $ch (i32.const 39)))
          )
          (if (i32.eq (local.get $ch) (i32.const 13))
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

  ;; Appends decoded UTF-8 text from 1600000 [0 .. $preview_len) into HTTP request buffer at $dst,
  ;; escaping newlines (10) as double-backslash n (bytes 92, 92, 110) for the inner GitHub Issue JSON body!
  (func $append_escaped_issue_body (param $dst i32) (result i32)
    (local $i i32)
    (local $ch i32)
    (local $p i32)
    (local $end i32)
    (local.set $i (i32.const 0))
    (local.set $p (local.get $dst))
    (local.set $end (global.get $preview_len))
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

  ;; ── Main Entrypoint ──────────────────────────────────────────────────────
  (func (export "github_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $pos i32)
    (local $token_start i32)
    (local $raw_len i32)
    (local $p i32)
    (local $req_len i32)
    (local $i i32)
    (local $ch i32)
    (local $title_len i32)
    (local $query_len i32)
    (local $content_len i32)
    (local $repo_json_len i32)
    (local $tok_json_len i32)

    ;; Reset globals
    (global.set $arg_len (i32.const 0))
    (global.set $op_len (i32.const 0))
    (global.set $repo_len (i32.const 0))
    (global.set $raw_body_len (i32.const 0))
    (global.set $preview_len (i32.const 0))

    ;; 1. Empty input -> Help
    (if (i32.eqz (local.get $in_len))
      (then
        (drop (call $copy_mem (i32.const 140000) (i32.const 65536) (i32.const 1218)))
        (return (i32.const 1218))
      )
    )

    ;; 2. Direct token paste convenience (ghp_..., gho_..., github_pat_...)
    (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 146916) (i32.const 4)))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 146956) (i32.const 11)))
      )
    )
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 146936) (i32.const 4)))
      )
    )
    (if (i32.ge_s (local.get $pos) (i32.const 0))
      (then
        (local.set $token_start (i32.add (local.get $in_ptr) (local.get $pos)))
        (local.set $i (i32.const 0))
        (loop $scan_direct_tok
          (if (i32.lt_u (i32.add (local.get $token_start) (local.get $i)) (i32.add (local.get $in_ptr) (local.get $in_len)))
            (then
              (if (i32.lt_u (local.get $i) (i32.const 140))
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
            (local.set $p (call $copy_mem (i32.const 144155) (i32.const 200000) (i32.const 73)))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const 144244) (local.get $p) (i32.const 3)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

            (local.set $p (call $copy_mem (i32.const 144542) (i32.const 200000) (i32.const 141)))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const 144699) (local.get $p) (i32.const 97)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (global.set $phase (i32.const 1))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; 3. Extract AI Intent Contract JSON fields
    (local.set $raw_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const 146489) (i32.const 13) (i32.const 1306000) (i32.const 64)))
    (if (i32.lt_s (local.get $raw_len) (i32.const 0))
      (then
        (local.set $raw_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const 146518) (i32.const 10) (i32.const 1306000) (i32.const 64)))
      )
    )
    (if (i32.gt_s (local.get $raw_len) (i32.const 0))
      (then
        (call $to_lower (i32.const 1306000) (i32.const 1306000) (local.get $raw_len))
        (global.set $op_len (local.get $raw_len))
      )
    )

    (local.set $title_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const 146568) (i32.const 9) (i32.const 1310000) (i32.const 1000)))
    (local.set $query_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const 146645) (i32.const 9) (i32.const 1312000) (i32.const 1000)))
    (local.set $repo_json_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const 146544) (i32.const 8) (i32.const 1314000) (i32.const 120)))

    ;; If repo was provided in JSON, copy to 1307000; otherwise load saved default_repo
    (if (i32.gt_s (local.get $repo_json_len) (i32.const 2))
      (then
        (drop (call $copy_mem (i32.const 1314000) (i32.const 1307000) (local.get $repo_json_len)))
        (global.set $repo_len (local.get $repo_json_len))
      )
      (else
        (drop (call $load_default_repo))
      )
    )

    ;; Extract "content":"..." (or "extra":"...") into 1400000
    (local.set $content_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const 146593) (i32.const 11) (i32.const 1400000) (i32.const 45000)))
    (if (i32.le_s (local.get $content_len) (i32.const 0))
      (then
        (local.set $content_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const 146620) (i32.const 9) (i32.const 1400000) (i32.const 45000)))
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
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 146896) (i32.const 4)) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 140000) (i32.const 65536) (i32.const 1218)))
        (return (i32.const 1218))
      )
    )

    ;; B. "disconnect"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 146870) (i32.const 10)) (i32.const 0))
      (then
        (drop (call $host_call (i32.const 144263) (i32.const 68) (i32.const 1300000) (i32.const 1024)))
        (drop (call $copy_mem (i32.const 142162) (i32.const 65536) (i32.const 94)))
        (return (i32.const 94))
      )
    )

    ;; C. "config"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 146848) (i32.const 6)) (i32.const 0))
      (then
        (local.set $tok_json_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const 146670) (i32.const 9) (i32.const 1302000) (i32.const 150)))
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
            (local.set $p (call $copy_mem (i32.const 144155) (i32.const 200000) (i32.const 73)))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const 144244) (local.get $p) (i32.const 3)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

            (local.set $p (call $copy_mem (i32.const 144542) (i32.const 200000) (i32.const 141)))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const 144699) (local.get $p) (i32.const 97)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (global.set $phase (i32.const 1))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
            (return (i32.const 0))
          )
        )
        (drop (call $copy_mem (i32.const 141811) (i32.const 65536) (i32.const 335)))
        (return (i32.const 335))
      )
    )

    ;; D. "set_repo" (configure default repository owner/repo)
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 146802) (i32.const 8)) (i32.const 0))
      (then
        (if (i32.le_s (local.get $repo_json_len) (i32.const 2))
          (then
            (if (i32.gt_s (local.get $query_len) (i32.const 2))
              (then
                (drop (call $copy_mem (i32.const 1312000) (i32.const 1307000) (local.get $query_len)))
                (global.set $repo_len (local.get $query_len))
              )
            )
          )
        )
        (if (i32.gt_u (global.get $repo_len) (i32.const 2))
          (then
            (local.set $p (call $copy_mem (i32.const 144431) (i32.const 200000) (i32.const 76)))
            (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
            (local.set $p (call $copy_mem (i32.const 144523) (local.get $p) (i32.const 3)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

            (local.set $p (call $copy_mem (i32.const 142957) (i32.const 65536) (i32.const 49)))
            (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
            (local.set $p (call $copy_mem (i32.const 143022) (local.get $p) (i32.const 112)))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
        )
        (drop (call $copy_mem (i32.const 143150) (i32.const 65536) (i32.const 265)))
        (return (i32.const 265))
      )
    )

    ;; E. "status"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 146826) (i32.const 6)) (i32.const 0))
      (then
        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then
            (drop (call $copy_mem (i32.const 141811) (i32.const 65536) (i32.const 335)))
            (return (i32.const 335))
          )
        )
        (local.set $p (call $copy_mem (i32.const 144542) (i32.const 200000) (i32.const 141)))
        (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_mem (i32.const 144699) (local.get $p) (i32.const 97)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
        (global.set $phase (i32.const 2))
        (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
        (return (i32.const 0))
      )
    )

    ;; F. "create" (Create Issue in GitHub repository)
    (if (i32.or
          (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 146695) (i32.const 6)) (i32.const 0))
          (i32.gt_s (local.get $content_len) (i32.const 0)))
      (then
        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then
            (drop (call $copy_mem (i32.const 141811) (i32.const 65536) (i32.const 335)))
            (return (i32.const 335))
          )
        )

        (if (i32.le_u (global.get $repo_len) (i32.const 2))
          (then
            (drop (call $copy_mem (i32.const 143150) (i32.const 65536) (i32.const 265)))
            (return (i32.const 265))
          )
        )

        ;; Save repo as default_repo for convenience on future calls
        (if (i32.gt_s (local.get $repo_json_len) (i32.const 2))
          (then
            (local.set $p (call $copy_mem (i32.const 144431) (i32.const 200000) (i32.const 76)))
            (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
            (local.set $p (call $copy_mem (i32.const 144523) (local.get $p) (i32.const 3)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))
          )
        )

        ;; Sanitize title into 1303000
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
                (drop (call $copy_mem (i32.const 146983) (i32.const 1303000) (i32.const 11)))
                (global.set $arg_len (i32.const 11))
              )
            )
          )
        )

        ;; Build POST /repos/<owner/repo>/issues
        (local.set $p (call $copy_mem (i32.const 146062) (i32.const 200000) (i32.const 91)))
        (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const 146169) (local.get $p) (i32.const 60)))
        (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_mem (i32.const 146245) (local.get $p) (i32.const 133)))
        (local.set $p (call $copy_mem (i32.const 1303000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_mem (i32.const 146394) (local.get $p) (i32.const 14)))
        (local.set $p (call $append_escaped_issue_body (local.get $p)))
        (local.set $p (call $copy_mem (i32.const 146424) (local.get $p) (i32.const 24)))

        (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
        (global.set $phase (i32.const 5))
        (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
        (return (i32.const 0))
      )
    )

    ;; G. "issues" (List open issues of a repository)
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 146717) (i32.const 6)) (i32.const 0))
      (then
        (if (i32.le_u (global.get $repo_len) (i32.const 2))
          (then
            (if (i32.gt_s (local.get $query_len) (i32.const 2))
              (then
                (drop (call $copy_mem (i32.const 1312000) (i32.const 1307000) (local.get $query_len)))
                (global.set $repo_len (local.get $query_len))
              )
            )
          )
        )
        (if (i32.le_u (global.get $repo_len) (i32.const 2))
          (then
            (drop (call $copy_mem (i32.const 143150) (i32.const 65536) (i32.const 265)))
            (return (i32.const 265))
          )
        )

        (local.set $raw_len (call $load_api_token))
        (local.set $p (call $copy_mem (i32.const 145577) (i32.const 200000) (i32.const 91)))
        (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
        (if (i32.gt_u (local.get $raw_len) (i32.const 0))
          (then
            (local.set $p (call $copy_mem (i32.const 145684) (local.get $p) (i32.const 81)))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const 145781) (local.get $p) (i32.const 97)))
          )
          (else
            (local.set $p (call $copy_mem (i32.const 145894) (local.get $p) (i32.const 152)))
          )
        )
        (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
        (global.set $phase (i32.const 4))
        (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
        (return (i32.const 0))
      )
    )

    ;; H. "search" (Search GitHub repositories by query)
    (if (i32.or
          (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 146780) (i32.const 6)) (i32.const 0))
          (i32.gt_s (local.get $query_len) (i32.const 0)))
      (then
        (if (i32.gt_s (local.get $query_len) (i32.const 0))
          (then
            (drop (call $sanitize_single_line (i32.const 1312000) (local.get $query_len)))
            (drop (call $encode_url_query))
          )
        )
        (if (i32.gt_u (global.get $url_q_len) (i32.const 0))
          (then
            (local.set $raw_len (call $load_api_token))
            (local.set $p (call $copy_mem (i32.const 145112) (i32.const 200000) (i32.const 129)))
            (local.set $p (call $copy_mem (i32.const 1308000) (local.get $p) (global.get $url_q_len)))
            (if (i32.gt_u (local.get $raw_len) (i32.const 0))
              (then
                (local.set $p (call $copy_mem (i32.const 145257) (local.get $p) (i32.const 52)))
                (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
                (local.set $p (call $copy_mem (i32.const 145325) (local.get $p) (i32.const 97)))
              )
              (else
                (local.set $p (call $copy_mem (i32.const 145438) (local.get $p) (i32.const 123)))
              )
            )
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (global.set $phase (i32.const 6))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; I. Default / "repos" / "list": List user's recent repositories
    (local.set $raw_len (call $load_api_token))
    (if (i32.eqz (local.get $raw_len))
      (then
        (drop (call $copy_mem (i32.const 141811) (i32.const 65536) (i32.const 335)))
        (return (i32.const 335))
      )
    )
    (local.set $p (call $copy_mem (i32.const 144812) (i32.const 200000) (i32.const 171)))
    (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
    (local.set $p (call $copy_mem (i32.const 144999) (local.get $p) (i32.const 97)))
    (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
    (global.set $phase (i32.const 3))
    (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
    (i32.const 0)
  )

  ;; ── Resume Handler (Async HTTP Response) ─────────────────────────────────
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $is_200 i32)
    (local $is_201 i32)
    (local $idx i32)
    (local $p i32)
    (local $scan_ptr i32)
    (local $scan_end i32)
    (local $item_count i32)
    (local $url_start i32)
    (local $url_len i32)
    (local $title_start i32)
    (local $title_len i32)
    (local $desc_start i32)
    (local $desc_len i32)
    (local $i i32)
    (local $ch i32)
    (local $u_len i32)
    (local $msg_start i32)
    (local $msg_len i32)
    (local $prev_copy_len i32)

    ;; Unescape host response into 900000
    (local.set $u_len (call $unescape_response (local.get $res_ptr) (local.get $res_len) (i32.const 900000)))

    (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 147010) (i32.const 16)))
    (local.set $is_200 (i32.ge_s (local.get $idx) (i32.const 0)))

    (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 147042) (i32.const 16)))
    (local.set $is_201 (i32.ge_s (local.get $idx) (i32.const 0)))

    ;; ─── Phase 1: Config Verification ───
    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        (if (local.get $is_200)
          (then
            ;; Extract "login":"..."
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 147074) (i32.const 9)))
            (local.set $title_start (i32.const 900000))
            (local.set $title_len (i32.const 6))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $title_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 9)))
                (local.set $i (i32.const 0))
                (loop $scan_login1
                  (if (i32.and (i32.lt_u (local.get $i) (i32.const 60)) (i32.lt_u (i32.add (local.get $title_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len))))
                    (then
                      (if (i32.ne (i32.load8_u (i32.add (local.get $title_start) (local.get $i))) (i32.const 34))
                        (then
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $scan_login1)
                        )
                      )
                    )
                  )
                )
                (local.set $title_len (local.get $i))
              )
            )
            (local.set $p (call $copy_mem (i32.const 141234) (i32.const 65536) (i32.const 84)))
            (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len)))
            (local.set $p (call $copy_mem (i32.const 141334) (local.get $p) (i32.const 194)))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
          (else
            (drop (call $copy_mem (i32.const 141544) (i32.const 65536) (i32.const 251)))
            (return (i32.const 251))
          )
        )
      )
    )

    ;; ─── Phase 2: Status Check ───
    (if (i32.eq (global.get $phase) (i32.const 2))
      (then
        (if (local.get $is_200)
          (then
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 147074) (i32.const 9)))
            (local.set $title_start (i32.const 900000))
            (local.set $title_len (i32.const 6))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $title_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 9)))
                (local.set $i (i32.const 0))
                (loop $scan_login2
                  (if (i32.and (i32.lt_u (local.get $i) (i32.const 60)) (i32.lt_u (i32.add (local.get $title_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len))))
                    (then
                      (if (i32.ne (i32.load8_u (i32.add (local.get $title_start) (local.get $i))) (i32.const 34))
                        (then
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $scan_login2)
                        )
                      )
                    )
                  )
                )
                (local.set $title_len (local.get $i))
              )
            )
            (drop (call $load_default_repo))
            (local.set $p (call $copy_mem (i32.const 142272) (i32.const 65536) (i32.const 69)))
            (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len)))
            (local.set $p (call $copy_mem (i32.const 142357) (local.get $p) (i32.const 39)))
            (if (i32.gt_u (global.get $repo_len) (i32.const 0))
              (then
                (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
              )
              (else
                (local.set $p (call $copy_mem (i32.const 142709) (local.get $p) (i32.const 57)))
              )
            )
            (local.set $p (call $copy_mem (i32.const 142412) (local.get $p) (i32.const 281)))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
          (else
            (drop (call $copy_mem (i32.const 142782) (i32.const 65536) (i32.const 159)))
            (return (i32.const 159))
          )
        )
      )
    )

    ;; ─── Phase 3 & Phase 6: List User Repos (3) or Search Repos (6) ───
    (if (i32.or (i32.eq (global.get $phase) (i32.const 3)) (i32.eq (global.get $phase) (i32.const 6)))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 147231) (i32.const 11)))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 11)))
                (local.set $i (i32.const 0))
                (loop $find_r_msg
                  (if (i32.and (i32.lt_u (local.get $i) (i32.const 160)) (i32.lt_u (i32.add (local.get $msg_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len))))
                    (then
                      (if (i32.ne (i32.load8_u (i32.add (local.get $msg_start) (local.get $i))) (i32.const 34))
                        (then
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $find_r_msg)
                        )
                      )
                    )
                  )
                )
                (local.set $p (call $copy_mem (i32.const 143705) (i32.const 65536) (i32.const 29)))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $i)))
                (local.set $p (call $copy_mem (i32.const 143750) (local.get $p) (i32.const 105)))
                (return (i32.sub (local.get $p) (i32.const 65536)))
              )
            )
            (drop (call $copy_mem (i32.const 143620) (i32.const 65536) (i32.const 69)))
            (return (i32.const 69))
          )
        )

        (if (i32.eq (global.get $phase) (i32.const 3))
          (then
            (local.set $p (call $copy_mem (i32.const 143431) (i32.const 65536) (i32.const 48)))
          )
          (else
            (local.set $p (call $copy_mem (i32.const 143495) (i32.const 65536) (i32.const 46)))
          )
        )

        (local.set $scan_ptr (i32.const 900000))
        (local.set $scan_end (i32.add (i32.const 900000) (local.get $u_len)))
        (local.set $item_count (i32.const 0))

        (loop $parse_repos
          (if (i32.and (i32.lt_u (local.get $item_count) (i32.const 6)) (i32.lt_u (local.get $scan_ptr) (local.get $scan_end)))
            (then
              (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const 147099) (i32.const 13)))
              (if (i32.ge_s (local.get $idx) (i32.const 0))
                (then
                  (local.set $title_start (i32.add (i32.add (local.get $scan_ptr) (local.get $idx)) (i32.const 13)))
                  (local.set $i (i32.const 0))
                  (loop $find_fn_end
                    (if (i32.and (i32.lt_u (local.get $i) (i32.const 90)) (i32.lt_u (i32.add (local.get $title_start) (local.get $i)) (local.get $scan_end)))
                      (then
                        (if (i32.ne (i32.load8_u (i32.add (local.get $title_start) (local.get $i))) (i32.const 34))
                          (then
                            (local.set $i (i32.add (local.get $i) (i32.const 1)))
                            (br $find_fn_end)
                          )
                        )
                      )
                    )
                  )
                  (local.set $title_len (local.get $i))

                  ;; Emit "• 📦 [**owner/repo**](https://github.com/owner/repo)"
                  (local.set $p (call $copy_mem (i32.const 147287) (local.get $p) (i32.const 12)))
                  (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len)))
                  (local.set $p (call $copy_mem (i32.const 147343) (local.get $p) (i32.const 23)))
                  (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len)))

                  ;; Check for description within next 800 bytes
                  (local.set $scan_ptr (i32.add (local.get $title_start) (local.get $title_len)))
                  (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.const 800) (i32.const 147200) (i32.const 15)))
                  (if (i32.ge_s (local.get $idx) (i32.const 0))
                    (then
                      (local.set $desc_start (i32.add (i32.add (local.get $scan_ptr) (local.get $idx)) (i32.const 15)))
                      (local.set $i (i32.const 0))
                      (loop $find_d_end
                        (if (i32.and (i32.lt_u (local.get $i) (i32.const 100)) (i32.lt_u (i32.add (local.get $desc_start) (local.get $i)) (local.get $scan_end)))
                          (then
                            (local.set $ch (i32.load8_u (i32.add (local.get $desc_start) (local.get $i))))
                            (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 10)))
                              (then
                                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                                (br $find_d_end)
                              )
                            )
                          )
                        )
                      )
                      (local.set $desc_len (local.get $i))
                      (if (i32.gt_u (local.get $desc_len) (i32.const 0))
                        (then
                          (local.set $p (call $copy_mem (i32.const 147382) (local.get $p) (i32.const 6)))
                          (local.set $p (call $copy_mem (local.get $desc_start) (local.get $p) (local.get $desc_len)))
                          (local.set $p (call $copy_mem (i32.const 147422) (local.get $p) (i32.const 1)))
                        )
                        (else
                          (local.set $p (call $copy_mem (i32.const 147404) (local.get $p) (i32.const 2)))
                        )
                      )
                    )
                    (else
                      (local.set $p (call $copy_mem (i32.const 147404) (local.get $p) (i32.const 2)))
                    )
                  )

                  (local.set $item_count (i32.add (local.get $item_count) (i32.const 1)))
                  (br $parse_repos)
                )
              )
            )
          )
        )

        (if (i32.eqz (local.get $item_count))
          (then
            (drop (call $copy_mem (i32.const 143620) (i32.const 65536) (i32.const 69)))
            (return (i32.const 69))
          )
        )
        (return (i32.sub (local.get $p) (i32.const 65536)))
      )
    )

    ;; ─── Phase 4: List Open Issues ───
    (if (i32.eq (global.get $phase) (i32.const 4))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 147231) (i32.const 11)))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 11)))
                (local.set $i (i32.const 0))
                (loop $find_i_msg
                  (if (i32.and (i32.lt_u (local.get $i) (i32.const 160)) (i32.lt_u (i32.add (local.get $msg_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len))))
                    (then
                      (if (i32.ne (i32.load8_u (i32.add (local.get $msg_start) (local.get $i))) (i32.const 34))
                        (then
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $find_i_msg)
                        )
                      )
                    )
                  )
                )
                (local.set $p (call $copy_mem (i32.const 143705) (i32.const 65536) (i32.const 29)))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $i)))
                (local.set $p (call $copy_mem (i32.const 143750) (local.get $p) (i32.const 105)))
                (return (i32.sub (local.get $p) (i32.const 65536)))
              )
            )
            (drop (call $copy_mem (i32.const 143620) (i32.const 65536) (i32.const 69)))
            (return (i32.const 69))
          )
        )

        (local.set $p (call $copy_mem (i32.const 143557) (i32.const 65536) (i32.const 26)))
        (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const 143599) (local.get $p) (i32.const 5)))

        (local.set $scan_ptr (i32.const 900000))
        (local.set $scan_end (i32.add (i32.const 900000) (local.get $u_len)))
        (local.set $item_count (i32.const 0))

        (loop $parse_issues
          (if (i32.and (i32.lt_u (local.get $item_count) (i32.const 6)) (i32.lt_u (local.get $scan_ptr) (local.get $scan_end)))
            (then
              (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const 147128) (i32.const 31)))
              (if (i32.ge_s (local.get $idx) (i32.const 0))
                (then
                  ;; url_start points right after "https://github.com/"
                  (local.set $url_start (i32.add (i32.add (local.get $scan_ptr) (local.get $idx)) (i32.const 31)))
                  (local.set $i (i32.const 0))
                  (loop $find_iu_end
                    (if (i32.lt_u (i32.add (local.get $url_start) (local.get $i)) (local.get $scan_end))
                      (then
                        (if (i32.ne (i32.load8_u (i32.add (local.get $url_start) (local.get $i))) (i32.const 34))
                          (then
                            (local.set $i (i32.add (local.get $i) (i32.const 1)))
                            (br $find_iu_end)
                          )
                        )
                      )
                    )
                  )
                  (local.set $url_len (local.get $i))

                  ;; Find "title":"..." after html_url
                  (local.set $scan_ptr (i32.add (local.get $url_start) (local.get $url_len)))
                  (local.set $title_start (i32.const 147258))
                  (local.set $title_len (i32.const 13))
                  (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const 147175) (i32.const 9)))
                  (if (i32.ge_s (local.get $idx) (i32.const 0))
                    (then
                      (local.set $title_start (i32.add (i32.add (local.get $scan_ptr) (local.get $idx)) (i32.const 9)))
                      (local.set $i (i32.const 0))
                      (loop $find_it_end
                        (if (i32.and (i32.lt_u (local.get $i) (i32.const 100)) (i32.lt_u (i32.add (local.get $title_start) (local.get $i)) (local.get $scan_end)))
                          (then
                            (if (i32.ne (i32.load8_u (i32.add (local.get $title_start) (local.get $i))) (i32.const 34))
                              (then
                                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                                (br $find_it_end)
                              )
                            )
                          )
                        )
                      )
                      (local.set $title_len (local.get $i))
                      (local.set $scan_ptr (i32.add (local.get $title_start) (local.get $title_len)))
                    )
                  )

                  (local.set $p (call $copy_mem (i32.const 147315) (local.get $p) (i32.const 12)))
                  (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len)))
                  (local.set $p (call $copy_mem (i32.const 147343) (local.get $p) (i32.const 23)))
                  (local.set $p (call $copy_mem (local.get $url_start) (local.get $p) (local.get $url_len)))
                  (local.set $p (call $copy_mem (i32.const 147404) (local.get $p) (i32.const 2)))

                  (local.set $item_count (i32.add (local.get $item_count) (i32.const 1)))
                  (br $parse_issues)
                )
              )
            )
          )
        )

        (if (i32.eqz (local.get $item_count))
          (then
            (drop (call $copy_mem (i32.const 143620) (i32.const 65536) (i32.const 69)))
            (return (i32.const 69))
          )
        )
        (return (i32.sub (local.get $p) (i32.const 65536)))
      )
    )

    ;; ─── Phase 5: Issue Created Response ───
    (if (i32.eq (global.get $phase) (i32.const 5))
      (then
        (if (i32.eqz (i32.or (local.get $is_200) (local.get $is_201)))
          (then
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 147231) (i32.const 11)))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 11)))
                (local.set $i (i32.const 0))
                (loop $find_ci_msg
                  (if (i32.and (i32.lt_u (local.get $i) (i32.const 180)) (i32.lt_u (i32.add (local.get $msg_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len))))
                    (then
                      (if (i32.ne (i32.load8_u (i32.add (local.get $msg_start) (local.get $i))) (i32.const 34))
                        (then
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $find_ci_msg)
                        )
                      )
                    )
                  )
                )
                (local.set $p (call $copy_mem (i32.const 143705) (i32.const 65536) (i32.const 29)))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $i)))
                (local.set $p (call $copy_mem (i32.const 143750) (local.get $p) (i32.const 105)))
                (return (i32.sub (local.get $p) (i32.const 65536)))
              )
            )
            (local.set $p (call $copy_mem (i32.const 143705) (i32.const 65536) (i32.const 29)))
            (local.set $p (call $copy_mem (i32.const 143750) (local.get $p) (i32.const 105)))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
        )

        ;; Extract "html_url":"https://github.com/..." (full URL starts at idx + 12)
        (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 147128) (i32.const 31)))
        (local.set $url_start (i32.const 900000))
        (local.set $url_len (i32.const 0))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (local.set $url_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 12)))
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

        ;; Build rich response: link + generated issue body preview
        (local.set $p (call $copy_mem (i32.const 143871) (i32.const 65536) (i32.const 54)))
        (local.set $p (call $copy_mem (i32.const 1303000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_mem (i32.const 143941) (local.get $p) (i32.const 4)))
        (local.set $p (call $copy_mem (local.get $url_start) (local.get $p) (local.get $url_len)))
        (local.set $p (call $copy_mem (i32.const 143961) (local.get $p) (i32.const 8)))

        (if (i32.gt_u (global.get $preview_len) (i32.const 0))
          (then
            (local.set $prev_copy_len (global.get $preview_len))
            (if (i32.gt_u (local.get $prev_copy_len) (i32.const 12000))
              (then (local.set $prev_copy_len (i32.const 12000)))
            )
            (local.set $p (call $copy_mem (i32.const 1600000) (local.get $p) (local.get $prev_copy_len)))
          )
        )

        (local.set $p (call $copy_mem (i32.const 143985) (local.get $p) (i32.const 73)))
        (return (i32.sub (local.get $p) (i32.const 65536)))
      )
    )

    (drop (call $copy_mem (i32.const 140000) (i32.const 65536) (i32.const 1218)))
    (i32.const 1218)
  )
)
