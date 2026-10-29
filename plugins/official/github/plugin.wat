;; Chattree Official GitHub Integration Plugin v1.0.7
;; Uses intentContract: Chattree AI extracts action+fields, WASM handles structured JSON.
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  (memory (export "memory") 64)

  (global $phase   (mut i32) (i32.const 0))
  (global $key_len (mut i32) (i32.const 0))
  (global $repo_len (mut i32) (i32.const 0))

  ;; Static Data
  (data (i32.const 10000) "profile")
  (data (i32.const 10023) "my_repos")
  (data (i32.const 10047) "repo_info")
  (data (i32.const 10072) "issues")
  (data (i32.const 10094) "prs")
  (data (i32.const 10113) "readme")
  (data (i32.const 10135) "search")
  (data (i32.const 10157) "create_issue")
  (data (i32.const 10185) "config")
  (data (i32.const 10207) "help")
  (data (i32.const 10227) "\22action\22:\22")
  (data (i32.const 10253) "\22repo\22:\22")
  (data (i32.const 10277) "\22query\22:\22")
  (data (i32.const 10302) "\22title\22:\22")
  (data (i32.const 10327) "\22token\22:\22")
  (data (i32.const 10352) "\22value\22:\22")
  (data (i32.const 10377) "\22body\22:\22")
  (data (i32.const 10401) "\22statusCode\22:200")
  (data (i32.const 10433) "\22statusCode\22:201")
  (data (i32.const 10465) "\22statusCode\22:401")
  (data (i32.const 10497) "\22statusCode\22:404")
  (data (i32.const 10529) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22api_key\22}}")
  (data (i32.const 10608) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22api_key\22,\22value\22:\22")
  (data (i32.const 10695) "\22}}")
  (data (i32.const 10714) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/user\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 10923) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/user/repos?per_page=6&sort=updated\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 11162) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/repos/")
  (data (i32.const 11269) "/issues?state=open&per_page=5\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 11418) "/pulls?state=open&per_page=5\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 11566) "\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 11686) "/readme\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github.raw\22")
  (data (i32.const 11812) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/search/code?q=")
  (data (i32.const 11927) "+repo:")
  (data (i32.const 11949) "\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 12069) "/issues\22,\22method\22:\22POST\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22,\22Content-Type\22:\22application/json\22")
  (data (i32.const 12231) ",\22Authorization\22:\22Bearer ")
  (data (i32.const 12272) "},\22timeoutMs\22:15000}}")
  (data (i32.const 12309) "},\22body\22:\22{\5c\22title\5c\22:\5c\22")
  (data (i32.const 12348) "\5c\22}\22,\22timeoutMs\22:15000}}")
  (data (i32.const 12388) "\f0\9f\90\99 **GitHub Integration para Chattree**\0a\0aPuedes preguntarme cualquier cosa en lenguaje natural, por ejemplo:\0a\e2\80\a2 \22dime cu\c3\a1les son mis repositorios\22\0a\e2\80\a2 \22mu\c3\a9strame los issues de Ponce5/Chattree\22\0a\e2\80\a2 \22expl\c3\adcame el README de Ponce5/Chattree\22\0a\e2\80\a2 \22busca la funci\c3\b3n login en Ponce5/Chattree\22\0a\e2\80\a2 \22crea un issue en Ponce5/Chattree: El bot\c3\b3n no funciona\22\0a\e2\80\a2 \22qui\c3\a9n soy en GitHub\22\0a\e2\80\a2 \22configura mi token: ghp_abc123\22\0a\0a*Genera un Personal Access Token en: https://github.com/settings/tokens*")
  (data (i32.const 12896) "\e2\9c\85 **Token de GitHub guardado exitosamente.**\0a\0aYa puedes usar el plugin con tus repositorios privados.")
  (data (i32.const 13015) "\e2\9a\a0\ef\b8\8f **No hay un token de GitHub configurado.**\0a\0aDile a Chattree: \22configura mi token de GitHub: ghp_tutoken\22\0a\0aPuedes generar uno en https://github.com/settings/tokens")
  (data (i32.const 13200) "\e2\9c\85 **Conectado a GitHub exitosamente**\0a\0a\e2\80\a2 **Usuario:** @")
  (data (i32.const 13275) "\0a\e2\80\a2 **Nombre:** ")
  (data (i32.const 13308) "\0a\e2\80\a2 **Repositorios p\c3\bablicos:** ")
  (data (i32.const 13357) "\0a\e2\80\a2 **Estado:** Conexi\c3\b3n autorizada y lista.")
  (data (i32.const 13419) "\f0\9f\93\9a **Tus repositorios recientes en GitHub:**\0a\0a")
  (data (i32.const 13483) "\e2\84\b9\ef\b8\8f No se encontraron repositorios en tu cuenta de GitHub.\0a\0aPuedes crear uno en https://github.com/new")
  (data (i32.const 13604) "\0a*Tip: Puedes preguntarme sobre cualquier repo, sus issues o su README.*")
  (data (i32.const 13692) "\e2\80\a2 **")
  (data (i32.const 13714) " (\e2\ad\90 ")
  (data (i32.const 13736) "\f0\9f\93\a6 **Repositorio: ")
  (data (i32.const 13772) "\0a\0a\e2\ad\90 **Estrellas:** ")
  (data (i32.const 13809) " | \f0\9f\8d\b4 **Forks:** ")
  (data (i32.const 13844) "\0a\f0\9f\94\97 **Enlace:** ")
  (data (i32.const 13878) "\f0\9f\93\8b **Issues recientes en ")
  (data (i32.const 13921) "\f0\9f\94\80 **Pull Requests recientes en ")
  (data (i32.const 13971) ":**\0a\0a")
  (data (i32.const 13992) "\f0\9f\93\84 **README de ")
  (data (i32.const 14025) ":**\0a\0a")
  (data (i32.const 14046) "\e2\84\b9\ef\b8\8f Este repositorio no tiene un README disponible.")
  (data (i32.const 14116) "\f0\9f\94\8d **Resultados de b\c3\basqueda en ")
  (data (i32.const 14166) "\0a\e2\80\a2 ")
  (data (i32.const 14187) "\e2\84\b9\ef\b8\8f No se encontraron coincidencias para esa b\c3\basqueda.")
  (data (i32.const 14261) "\e2\9c\85 **Issue creado en ")
  (data (i32.const 14299) ":**\0a\0aPuedes verlo en: https://github.com/")
  (data (i32.const 14356) "/issues")
  (data (i32.const 14379) "\e2\9a\a0\ef\b8\8f **Se requiere un token de GitHub para crear issues.**\0a\0aDile a Chattree: \22configura mi token de GitHub: ghp_tutoken\22")
  (data (i32.const 14517) "\e2\9d\8c **Error de autenticaci\c3\b3n con GitHub.**\0a\0aEl token configurado es inv\c3\a1lido o ha expirado. Dile a Chattree: \22configura mi token de GitHub: ghp_nuevotoken\22")
  (data (i32.const 14690) "\e2\9d\8c **Repositorio o recurso no encontrado.**\0a\0aVerifica que el nombre `owner/repo` sea correcto y que tu token tenga los permisos necesarios.")
  (data (i32.const 14846) "\e2\9d\8c **Error al consultar la API de GitHub.**\0a\0aPor favor verifica tu conexi\c3\b3n o intenta nuevamente.")
  (data (i32.const 14961) "login")
  (data (i32.const 14982) "name")
  (data (i32.const 15002) "public_repos")
  (data (i32.const 15030) "full_name")
  (data (i32.const 15055) "stargazers_count")
  (data (i32.const 15087) "forks_count")
  (data (i32.const 15114) "html_url")
  (data (i32.const 15138) "\22path\22:\22")

  ;; ── copy_mem: copies len bytes from src to dst, returns dst+len ──────────
  (func $copy_mem (param $src i32) (param $dst i32) (param $len i32) (result i32)
    (memory.copy (local.get $dst) (local.get $src) (local.get $len))
    (i32.add (local.get $dst) (local.get $len))
  )

  ;; ── find_substring: returns index or -1 ──────────────────────────────────
  (func $find_substring (param $hay i32) (param $hay_len i32) (param $ndl i32) (param $ndl_len i32) (result i32)
    (local $i i32)
    (local $j i32)
    (local $ok i32)
    (if (i32.lt_u (local.get $hay_len) (local.get $ndl_len))
      (then (return (i32.const -1)))
    )
    (local.set $i (i32.const 0))
    (loop $outer
      (if (i32.le_u (local.get $i) (i32.sub (local.get $hay_len) (local.get $ndl_len)))
        (then
          (local.set $ok (i32.const 1))
          (local.set $j (i32.const 0))
          (loop $inner
            (if (i32.lt_u (local.get $j) (local.get $ndl_len))
              (then
                (if (i32.ne
                      (i32.load8_u (i32.add (local.get $hay) (i32.add (local.get $i) (local.get $j))))
                      (i32.load8_u (i32.add (local.get $ndl) (local.get $j))))
                  (then (local.set $ok (i32.const 0)))
                  (else
                    (local.set $j (i32.add (local.get $j) (i32.const 1)))
                    (br $inner)
                  )
                )
              )
            )
          )
          (if (local.get $ok) (then (return (local.get $i))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $outer)
        )
      )
    )
    (i32.const -1)
  )

  ;; ── extract_str_field: find needle in src, skip to after opening quote,
  ;;    copy value until closing quote into dst. Returns bytes copied. ────────
  (func $extract_str_field
    (param $src i32) (param $src_len i32)
    (param $ndl i32) (param $ndl_len i32)
    (param $dst i32) (param $max i32)
    (result i32)
    (local $pos i32)
    (local $p   i32)
    (local $end i32)
    (local $ch  i32)
    (local $n   i32)

    (local.set $pos (call $find_substring
      (local.get $src) (local.get $src_len)
      (local.get $ndl) (local.get $ndl_len)))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then (return (i32.const 0)))
    )
    ;; move past needle (needle already ends with opening quote)
    (local.set $p (i32.add (i32.add (local.get $src) (local.get $pos)) (local.get $ndl_len)))
    (local.set $end (i32.add (local.get $src) (local.get $src_len)))
    (local.set $n (i32.const 0))
    (loop $copy
      (if (i32.and
            (i32.lt_u (local.get $p) (local.get $end))
            (i32.lt_u (local.get $n) (local.get $max)))
        (then
          (local.set $ch (i32.load8_u (local.get $p)))
          (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 92)))
            (then
              (i32.store8 (i32.add (local.get $dst) (local.get $n)) (local.get $ch))
              (local.set $n (i32.add (local.get $n) (i32.const 1)))
              (local.set $p (i32.add (local.get $p) (i32.const 1)))
              (br $copy)
            )
          )
        )
      )
    )
    (local.get $n)
  )

  ;; ── str_eq: returns 1 if memory at $a (len $la) == memory at $b (len $lb) ─
  (func $str_eq (param $a i32) (param $la i32) (param $b i32) (param $lb i32) (result i32)
    (local $i i32)
    (if (i32.ne (local.get $la) (local.get $lb)) (then (return (i32.const 0))))
    (local.set $i (i32.const 0))
    (loop $cmp
      (if (i32.lt_u (local.get $i) (local.get $la))
        (then
          (if (i32.ne
                (i32.load8_u (i32.add (local.get $a) (local.get $i)))
                (i32.load8_u (i32.add (local.get $b) (local.get $i))))
            (then (return (i32.const 0)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $cmp)
        )
      )
    )
    (i32.const 1)
  )

  ;; ── load_api_key: reads stored key into 3000000, sets $key_len ───────────
  (func $load_api_key (result i32)
    (local $res_len i32)
    (local $val_idx i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)

    (local.set $res_len (call $host_call
      (i32.const 10529) (i32.const 63)
      (i32.const 3000500) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )
    (local.set $val_idx (call $find_substring
      (i32.const 3000500) (local.get $res_len)
      (i32.const 10352) (i32.const 9)))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )
    (local.set $val_start (i32.add (i32.const 3000500) (i32.add (local.get $val_idx) (i32.const 9))))
    (local.set $i (i32.const 0))
    (loop $copy_key
      (if (i32.lt_u (local.get $i) (i32.const 120))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
          (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 0)))
            (then
              (i32.store8 (i32.add (i32.const 3000000) (local.get $i)) (local.get $ch))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $copy_key)
            )
          )
        )
      )
    )
    (global.set $key_len (local.get $i))
    (local.get $i)
  )

  ;; ── append_auth: appends ,"Authorization":"Bearer <key>"} to $p ─────────
  (func $append_auth (param $p i32) (result i32)
    (if (i32.gt_u (global.get $key_len) (i32.const 0))
      (then
        (local.set $p (call $copy_mem
          (i32.const 12231) (local.get $p)
          (i32.const 25)))
        (local.set $p (call $copy_mem
          (i32.const 3000000) (local.get $p) (global.get $key_len)))
        (i32.store8 (local.get $p) (i32.const 34))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
      )
    )
    (call $copy_mem
      (i32.const 12272) (local.get $p)
      (i32.const 21))
  )

  ;; ══════════════════════════════════════════════════════════════════════════
  ;; MAIN ENTRYPOINT — receives JSON from intentContract
  ;; Input JSON: {"action":"...","repo":"owner/repo","query":"...","title":"...","token":"..."}
  ;; ══════════════════════════════════════════════════════════════════════════
  (func (export "github_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $p        i32)
    (local $req_len  i32)
    (local $act_len  i32)
    (local $repo_len_local i32)
    (local $q_len    i32)
    (local $t_len    i32)
    (local $tok_len  i32)

    (global.set $phase    (i32.const 0))
    (global.set $key_len  (i32.const 0))
    (global.set $repo_len (i32.const 0))

    ;; Empty input → help
    (if (i32.eqz (local.get $in_len))
      (then
        (drop (call $copy_mem (i32.const 12388) (i32.const 1024) (i32.const 492)))
        (return (i32.const 492))
      )
    )

    ;; ── 1. Extract 'action' field → 200000 ──────────────────────────────────
    (local.set $act_len (call $extract_str_field
      (local.get $in_ptr) (local.get $in_len)
      (i32.const 10227) (i32.const 10)
      (i32.const 200000) (i32.const 20)))

    ;; ── 2. Extract 'repo' field → 210000 ────────────────────────────────────
    (local.set $repo_len_local (call $extract_str_field
      (local.get $in_ptr) (local.get $in_len)
      (i32.const 10253) (i32.const 8)
      (i32.const 210000) (i32.const 80)))
    (global.set $repo_len (local.get $repo_len_local))

    ;; ── 3. Extract 'query' field → 220000 (replace spaces with +) ───────────
    (local.set $q_len (call $extract_str_field
      (local.get $in_ptr) (local.get $in_len)
      (i32.const 10277) (i32.const 9)
      (i32.const 220000) (i32.const 100)))
    ;; Replace spaces in query with '+' for URL encoding
    (block $done_q
      (local.set $p (i32.const 0))
      (loop $url_enc
        (if (i32.lt_u (local.get $p) (local.get $q_len))
          (then
            (if (i32.eq (i32.load8_u (i32.add (i32.const 220000) (local.get $p))) (i32.const 32))
              (then (i32.store8 (i32.add (i32.const 220000) (local.get $p)) (i32.const 43)))
            )
            (local.set $p (i32.add (local.get $p) (i32.const 1)))
            (br $url_enc)
          )
        )
      )
    )

    ;; ── 4. Extract 'title' field → 230000 ───────────────────────────────────
    (local.set $t_len (call $extract_str_field
      (local.get $in_ptr) (local.get $in_len)
      (i32.const 10302) (i32.const 9)
      (i32.const 230000) (i32.const 150)))

    ;; ── 5. Extract 'token' field → 240000 (for config action) ───────────────
    (local.set $tok_len (call $extract_str_field
      (local.get $in_ptr) (local.get $in_len)
      (i32.const 10327) (i32.const 9)
      (i32.const 240000) (i32.const 120)))

    ;; ── No action extracted → help ───────────────────────────────────────────
    (if (i32.eqz (local.get $act_len))
      (then
        (drop (call $copy_mem (i32.const 12388) (i32.const 1024) (i32.const 492)))
        (return (i32.const 492))
      )
    )

    ;; ── Load stored API key ──────────────────────────────────────────────────
    (drop (call $load_api_key))

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: config — save token
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq
          (i32.const 200000) (local.get $act_len)
          (i32.const 10185) (i32.const 6))
      (then
        (if (i32.gt_u (local.get $tok_len) (i32.const 4))
          (then
            (local.set $p (call $copy_mem (i32.const 10608) (i32.const 100000) (i32.const 71)))
            (local.set $p (call $copy_mem (i32.const 240000) (local.get $p) (local.get $tok_len)))
            (local.set $p (call $copy_mem (i32.const 10695) (local.get $p) (i32.const 3)))
            (drop (call $host_call (i32.const 100000) (i32.sub (local.get $p) (i32.const 100000)) (i32.const 3000500) (i32.const 1024)))
            (drop (call $copy_mem (i32.const 12896) (i32.const 1024) (i32.const 103)))
            (return (i32.const 103))
          )
          (else
            ;; token field missing — try raw input scan for ghp_/github_pat_
            ;; (fallback: show key_missing since intentContract should have extracted it)
            (drop (call $copy_mem (i32.const 13015) (i32.const 1024) (i32.const 169)))
            (return (i32.const 169))
          )
        )
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: help
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq
          (i32.const 200000) (local.get $act_len)
          (i32.const 10207) (i32.const 4))
      (then
        (drop (call $copy_mem (i32.const 12388) (i32.const 1024) (i32.const 492)))
        (return (i32.const 492))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: profile — GET /user (phase 1)
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq
          (i32.const 200000) (local.get $act_len)
          (i32.const 10000) (i32.const 7))
      (then
        (if (i32.eqz (global.get $key_len))
          (then
            (drop (call $copy_mem (i32.const 13015) (i32.const 1024) (i32.const 169)))
            (return (i32.const 169))
          )
        )
        (local.set $p (call $copy_mem (i32.const 10714) (i32.const 100000) (i32.const 193)))
        (local.set $p (call $append_auth (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 1))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
        (return (i32.const 0))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: my_repos — GET /user/repos (phase 5)
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq
          (i32.const 200000) (local.get $act_len)
          (i32.const 10023) (i32.const 8))
      (then
        (if (i32.eqz (global.get $key_len))
          (then
            (drop (call $copy_mem (i32.const 13015) (i32.const 1024) (i32.const 169)))
            (return (i32.const 169))
          )
        )
        (local.set $p (call $copy_mem (i32.const 10923) (i32.const 100000) (i32.const 223)))
        (local.set $p (call $append_auth (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 5))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
        (return (i32.const 0))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; Remaining actions require repo. If missing → help.
    ;; ════════════════════════════════════════════════════════════════════════
    (if (i32.eqz (global.get $repo_len))
      (then
        (drop (call $copy_mem (i32.const 12388) (i32.const 1024) (i32.const 492)))
        (return (i32.const 492))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: issues — GET /repos/{repo}/issues (phase 2)
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq
          (i32.const 200000) (local.get $act_len)
          (i32.const 10072) (i32.const 6))
      (then
        (local.set $p (call $copy_mem (i32.const 11162) (i32.const 100000) (i32.const 91)))
        (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const 11269) (local.get $p) (i32.const 133)))
        (local.set $p (call $append_auth (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 2))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
        (return (i32.const 0))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: prs — GET /repos/{repo}/pulls (phase 3)
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq
          (i32.const 200000) (local.get $act_len)
          (i32.const 10094) (i32.const 3))
      (then
        (local.set $p (call $copy_mem (i32.const 11162) (i32.const 100000) (i32.const 91)))
        (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const 11418) (local.get $p) (i32.const 132)))
        (local.set $p (call $append_auth (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 3))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
        (return (i32.const 0))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: readme — GET /repos/{repo}/readme (phase 6)
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq
          (i32.const 200000) (local.get $act_len)
          (i32.const 10113) (i32.const 6))
      (then
        (local.set $p (call $copy_mem (i32.const 11162) (i32.const 100000) (i32.const 91)))
        (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const 11686) (local.get $p) (i32.const 110)))
        (local.set $p (call $append_auth (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 6))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
        (return (i32.const 0))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: search — GET /search/code?q={query}+repo:{repo} (phase 7)
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq
          (i32.const 200000) (local.get $act_len)
          (i32.const 10135) (i32.const 6))
      (then
        (local.set $p (call $copy_mem (i32.const 11812) (i32.const 100000) (i32.const 99)))
        (local.set $p (call $copy_mem (i32.const 220000) (local.get $p) (local.get $q_len)))
        (local.set $p (call $copy_mem (i32.const 11927) (local.get $p) (i32.const 6)))
        (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const 11949) (local.get $p) (i32.const 104)))
        (local.set $p (call $append_auth (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 7))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
        (return (i32.const 0))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: create_issue — POST /repos/{repo}/issues (phase 8)
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq
          (i32.const 200000) (local.get $act_len)
          (i32.const 10157) (i32.const 12))
      (then
        (if (i32.eqz (global.get $key_len))
          (then
            (drop (call $copy_mem (i32.const 14379) (i32.const 1024) (i32.const 122)))
            (return (i32.const 122))
          )
        )
        ;; Default title if empty
        (if (i32.eqz (local.get $t_len))
          (then
            ;; "Nuevo Issue" (11 bytes)
            (i32.store8 (i32.const 230000) (i32.const 78))
            (i32.store8 (i32.const 230001) (i32.const 117))
            (i32.store8 (i32.const 230002) (i32.const 101))
            (i32.store8 (i32.const 230003) (i32.const 118))
            (i32.store8 (i32.const 230004) (i32.const 111))
            (i32.store8 (i32.const 230005) (i32.const 32))
            (i32.store8 (i32.const 230006) (i32.const 73))
            (i32.store8 (i32.const 230007) (i32.const 115))
            (i32.store8 (i32.const 230008) (i32.const 115))
            (i32.store8 (i32.const 230009) (i32.const 117))
            (i32.store8 (i32.const 230010) (i32.const 101))
            (local.set $t_len (i32.const 11))
          )
        )
        (local.set $p (call $copy_mem (i32.const 11162) (i32.const 100000) (i32.const 91)))
        (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const 12069) (local.get $p) (i32.const 146)))
        ;; append auth header
        (local.set $p (call $copy_mem (i32.const 12231) (local.get $p) (i32.const 25)))
        (local.set $p (call $copy_mem (i32.const 3000000) (local.get $p) (global.get $key_len)))
        (i32.store8 (local.get $p) (i32.const 34))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
        ;; body: },"body":"{\"title\":\"<title>\"}"
        (local.set $p (call $copy_mem (i32.const 12309) (local.get $p) (i32.const 23)))
        (local.set $p (call $copy_mem (i32.const 230000) (local.get $p) (local.get $t_len)))
        (local.set $p (call $copy_mem (i32.const 12348) (local.get $p) (i32.const 24)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 8))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
        (return (i32.const 0))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: repo_info (default) — GET /repos/{repo} (phase 4)
    ;; ════════════════════════════════════════════════════════════════════════
    (local.set $p (call $copy_mem (i32.const 11162) (i32.const 100000) (i32.const 91)))
    (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
    (local.set $p (call $copy_mem (i32.const 11566) (local.get $p) (i32.const 104)))
    (local.set $p (call $append_auth (local.get $p)))
    (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
    (global.set $phase (i32.const 4))
    (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
    (i32.const 0)
  )

  ;; ══════════════════════════════════════════════════════════════════════════
  ;; RESUME — handles HTTP responses
  ;; ══════════════════════════════════════════════════════════════════════════
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $out          i32)
    (local $extracted    i32)
    (local $body_idx     i32)
    (local $val_start    i32)
    (local $i            i32)
    (local $ch           i32)
    (local $p            i32)
    (local $count        i32)
    (local $rem_len      i32)
    (local $pos          i32)

    ;; ── 401 Unauthorized ────────────────────────────────────────────────────
    (if (i32.ge_s (call $find_substring
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 10465) (i32.const 16))
         (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 14517) (i32.const 1024) (i32.const 157)))
        (return (i32.const 157))
      )
    )

    ;; ── 404 Not Found ────────────────────────────────────────────────────────
    (if (i32.ge_s (call $find_substring
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 10497) (i32.const 16))
         (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 14690) (i32.const 1024) (i32.const 140)))
        (return (i32.const 140))
      )
    )

    ;; ── Must be 200 or 201 ───────────────────────────────────────────────────
    (if (i32.and
          (i32.lt_s (call $find_substring
            (local.get $res_ptr) (local.get $res_len)
            (i32.const 10401) (i32.const 16))
            (i32.const 0))
          (i32.lt_s (call $find_substring
            (local.get $res_ptr) (local.get $res_len)
            (i32.const 10433) (i32.const 16))
            (i32.const 0)))
      (then
        (drop (call $copy_mem (i32.const 14846) (i32.const 1024) (i32.const 99)))
        (return (i32.const 99))
      )
    )

    ;; Find body field for phases that need raw body content
    (local.set $body_idx (call $find_substring
      (local.get $res_ptr) (local.get $res_len)
      (i32.const 10377) (i32.const 8)))

    ;; ── Phase 1: Profile ─────────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        (local.set $out (call $copy_mem (i32.const 13200) (i32.const 1024) (i32.const 59)))
        (local.set $extracted (call $extract_str_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 14961) (i32.const 5)
          (local.get $out) (i32.const 40)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted)))
        (local.set $out (call $copy_mem (i32.const 13275) (local.get $out) (i32.const 17)))
        (local.set $extracted (call $extract_str_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 14982) (i32.const 4)
          (local.get $out) (i32.const 60)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted)))
        (local.set $out (call $copy_mem (i32.const 13308) (local.get $out) (i32.const 33)))
        (local.set $extracted (call $extract_str_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 15002) (i32.const 12)
          (local.get $out) (i32.const 10)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted)))
        (local.set $out (call $copy_mem (i32.const 13357) (local.get $out) (i32.const 46)))
        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    ;; ── Phase 5: User Repos ──────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 5))
      (then
        (local.set $out (call $copy_mem (i32.const 13419) (i32.const 1024) (i32.const 48)))
        (local.set $p (local.get $res_ptr))
        (local.set $count (i32.const 0))
        (loop $next_repo
          (if (i32.and
                (i32.lt_u (local.get $p) (i32.add (local.get $res_ptr) (local.get $res_len)))
                (i32.lt_u (local.get $count) (i32.const 6)))
            (then
              (local.set $rem_len (i32.sub (i32.add (local.get $res_ptr) (local.get $res_len)) (local.get $p)))
              (local.set $pos (call $find_substring
                (local.get $p) (local.get $rem_len)
                (i32.const 15030) (i32.const 9)))
              (if (i32.ge_s (local.get $pos) (i32.const 0))
                (then
                  (local.set $p (i32.add (local.get $p) (local.get $pos)))
                  (local.set $rem_len (i32.sub (i32.add (local.get $res_ptr) (local.get $res_len)) (local.get $p)))
                  (local.set $out (call $copy_mem (i32.const 13692) (local.get $out) (i32.const 6)))
                  (local.set $extracted (call $extract_str_field
                    (local.get $p) (local.get $rem_len)
                    (i32.const 15030) (i32.const 9)
                    (local.get $out) (i32.const 80)))
                  (local.set $out (i32.add (local.get $out) (local.get $extracted)))
                  (i32.store8 (local.get $out) (i32.const 42))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (i32.store8 (local.get $out) (i32.const 42))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $p (i32.add (local.get $p) (i32.add (i32.const 9) (local.get $extracted))))
                  (local.set $rem_len (i32.sub (i32.add (local.get $res_ptr) (local.get $res_len)) (local.get $p)))
                  (local.set $out (call $copy_mem (i32.const 13714) (local.get $out) (i32.const 6)))
                  (local.set $extracted (call $extract_str_field
                    (local.get $p) (local.get $rem_len)
                    (i32.const 15055) (i32.const 16)
                    (local.get $out) (i32.const 10)))
                  (if (i32.gt_u (local.get $extracted) (i32.const 0))
                    (then (local.set $out (i32.add (local.get $out) (local.get $extracted))))
                    (else
                      (i32.store8 (local.get $out) (i32.const 48))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                    )
                  )
                  (i32.store8 (local.get $out) (i32.const 41))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (i32.store8 (local.get $out) (i32.const 10))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $count (i32.add (local.get $count) (i32.const 1)))
                  (br $next_repo)
                )
              )
            )
          )
        )
        (if (i32.eqz (local.get $count))
          (then
            (drop (call $copy_mem (i32.const 13483) (i32.const 1024) (i32.const 105)))
            (return (i32.const 105))
          )
          (else
            (local.set $out (call $copy_mem (i32.const 13604) (local.get $out) (i32.const 72)))
            (return (i32.sub (local.get $out) (i32.const 1024)))
          )
        )
      )
    )

    ;; ── Phase 4: Repo Info ───────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 4))
      (then
        (local.set $out (call $copy_mem (i32.const 13736) (i32.const 1024) (i32.const 20)))
        (local.set $extracted (call $extract_str_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 15030) (i32.const 9)
          (local.get $out) (i32.const 80)))
        (if (i32.gt_u (local.get $extracted) (i32.const 0))
          (then (local.set $out (i32.add (local.get $out) (local.get $extracted))))
          (else (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len))))
        )
        (i32.store8 (local.get $out) (i32.const 42))
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (i32.store8 (local.get $out) (i32.const 42))
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (i32.store8 (local.get $out) (i32.const 10))
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (i32.store8 (local.get $out) (i32.const 10))
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (local.set $out (call $copy_mem (i32.const 13772) (local.get $out) (i32.const 21)))
        (local.set $extracted (call $extract_str_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 15055) (i32.const 16)
          (local.get $out) (i32.const 15)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted)))
        (local.set $out (call $copy_mem (i32.const 13809) (local.get $out) (i32.const 19)))
        (local.set $extracted (call $extract_str_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 15087) (i32.const 11)
          (local.get $out) (i32.const 15)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted)))
        (local.set $out (call $copy_mem (i32.const 13844) (local.get $out) (i32.const 18)))
        (local.set $extracted (call $extract_str_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 15114) (i32.const 8)
          (local.get $out) (i32.const 100)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted)))
        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    ;; ── Phase 2 & 3: Issues / PRs (copy raw body) ───────────────────────────
    (if (i32.or (i32.eq (global.get $phase) (i32.const 2)) (i32.eq (global.get $phase) (i32.const 3)))
      (then
        (if (i32.eq (global.get $phase) (i32.const 2))
          (then (local.set $out (call $copy_mem (i32.const 13878) (i32.const 1024) (i32.const 27))))
          (else (local.set $out (call $copy_mem (i32.const 13921) (i32.const 1024) (i32.const 34))))
        )
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const 13971) (local.get $out) (i32.const 5)))
        (if (i32.ge_s (local.get $body_idx) (i32.const 0))
          (then
            (local.set $val_start (i32.add (i32.add (local.get $res_ptr) (local.get $body_idx)) (i32.const 8)))
            (local.set $i (i32.const 0))
            (loop $cp_body
              (if (i32.and
                    (i32.lt_u (i32.add (local.get $val_start) (local.get $i)) (i32.add (local.get $res_ptr) (local.get $res_len)))
                    (i32.lt_u (local.get $i) (i32.const 25000)))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
                  (if (i32.ne (local.get $ch) (i32.const 34))
                    (then
                      (i32.store8 (local.get $out) (local.get $ch))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $cp_body)
                    )
                  )
                )
              )
            )
          )
        )
        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    ;; ── Phase 6: README ──────────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 6))
      (then
        (local.set $out (call $copy_mem (i32.const 13992) (i32.const 1024) (i32.const 17)))
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const 14025) (local.get $out) (i32.const 5)))
        (if (i32.ge_s (local.get $body_idx) (i32.const 0))
          (then
            (local.set $val_start (i32.add (i32.add (local.get $res_ptr) (local.get $body_idx)) (i32.const 8)))
            (local.set $i (i32.const 0))
            (loop $cp_readme
              (if (i32.and
                    (i32.lt_u (i32.add (local.get $val_start) (local.get $i)) (i32.add (local.get $res_ptr) (local.get $res_len)))
                    (i32.lt_u (local.get $i) (i32.const 8000)))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
                  (if (i32.ne (local.get $ch) (i32.const 34))
                    (then
                      ;; Handle backslash-n escape -> actual newline
                      (if (i32.eq (local.get $ch) (i32.const 92))
                        (then
                          (local.set $p (i32.load8_u (i32.add (local.get $val_start) (i32.add (local.get $i) (i32.const 1)))))
                          (if (i32.eq (local.get $p) (i32.const 110))
                            (then
                              (i32.store8 (local.get $out) (i32.const 10))
                              (local.set $out (i32.add (local.get $out) (i32.const 1)))
                              (local.set $i (i32.add (local.get $i) (i32.const 2)))
                              (br $cp_readme)
                            )
                          )
                          (if (i32.eq (local.get $p) (i32.const 116))
                            (then
                              (i32.store8 (local.get $out) (i32.const 9))
                              (local.set $out (i32.add (local.get $out) (i32.const 1)))
                              (local.set $i (i32.add (local.get $i) (i32.const 2)))
                              (br $cp_readme)
                            )
                          )
                          ;; skip backslash, emit next char
                          (i32.store8 (local.get $out) (local.get $p))
                          (local.set $out (i32.add (local.get $out) (i32.const 1)))
                          (local.set $i (i32.add (local.get $i) (i32.const 2)))
                          (br $cp_readme)
                        )
                        (else
                          (i32.store8 (local.get $out) (local.get $ch))
                          (local.set $out (i32.add (local.get $out) (i32.const 1)))
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $cp_readme)
                        )
                      )
                    )
                  )
                )
              )
            )
            (return (i32.sub (local.get $out) (i32.const 1024)))
          )
          (else
            (drop (call $copy_mem (i32.const 14046) (i32.const 1024) (i32.const 54)))
            (return (i32.const 54))
          )
        )
      )
    )

    ;; ── Phase 7: Code Search ─────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 7))
      (then
        (local.set $out (call $copy_mem (i32.const 14116) (i32.const 1024) (i32.const 34)))
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const 13971) (local.get $out) (i32.const 5)))
        (if (i32.ge_s (local.get $body_idx) (i32.const 0))
          (then
            (local.set $val_start (i32.add (i32.add (local.get $res_ptr) (local.get $body_idx)) (i32.const 8)))
            (local.set $rem_len (i32.sub (i32.add (local.get $res_ptr) (local.get $res_len)) (local.get $val_start)))
            (local.set $count (i32.const 0))
            (local.set $p (local.get $val_start))
            (loop $find_paths
              (if (i32.and
                    (i32.lt_u (local.get $p) (i32.add (local.get $res_ptr) (local.get $res_len)))
                    (i32.lt_u (local.get $count) (i32.const 8)))
                (then
                  (local.set $rem_len (i32.sub (i32.add (local.get $res_ptr) (local.get $res_len)) (local.get $p)))
                  (local.set $pos (call $find_substring
                    (local.get $p) (local.get $rem_len)
                    (i32.const 15138) (i32.const 8)))
                  (if (i32.ge_s (local.get $pos) (i32.const 0))
                    (then
                      (local.set $p (i32.add (local.get $p) (i32.add (local.get $pos) (i32.const 8))))
                      (local.set $out (call $copy_mem (i32.const 14166) (local.get $out) (i32.const 5)))
                      (local.set $i (i32.const 0))
                      (loop $cp_path
                        (if (i32.and
                              (i32.lt_u (i32.add (local.get $p) (local.get $i)) (i32.add (local.get $res_ptr) (local.get $res_len)))
                              (i32.lt_u (local.get $i) (i32.const 200)))
                          (then
                            (local.set $ch (i32.load8_u (i32.add (local.get $p) (local.get $i))))
                            (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 92)))
                              (then
                                (i32.store8 (local.get $out) (local.get $ch))
                                (local.set $out (i32.add (local.get $out) (i32.const 1)))
                                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                                (br $cp_path)
                              )
                            )
                          )
                        )
                      )
                      (local.set $p (i32.add (local.get $p) (local.get $i)))
                      (local.set $count (i32.add (local.get $count) (i32.const 1)))
                      (br $find_paths)
                    )
                  )
                )
              )
            )
            (if (i32.eqz (local.get $count))
              (then
                (drop (call $copy_mem (i32.const 14187) (i32.const 1024) (i32.const 58)))
                (return (i32.const 58))
              )
            )
          )
          (else
            (drop (call $copy_mem (i32.const 14187) (i32.const 1024) (i32.const 58)))
            (return (i32.const 58))
          )
        )
        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    ;; ── Phase 8: Create Issue ────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 8))
      (then
        (local.set $out (call $copy_mem (i32.const 14261) (i32.const 1024) (i32.const 22)))
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const 14299) (local.get $out) (i32.const 41)))
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const 14356) (local.get $out) (i32.const 7)))
        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    (drop (call $copy_mem (i32.const 14846) (i32.const 1024) (i32.const 99)))
    (i32.const 99)
  )
)
