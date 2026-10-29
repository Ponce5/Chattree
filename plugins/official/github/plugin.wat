;; Chattree Official GitHub Integration Plugin
;; Provides repository inspection, issue listing, pull request monitoring, user repositories, and natural language intent
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; 64 pages = 4 MB linear sandbox memory
  (memory (export "memory") 64)

  (global $phase (mut i32) (i32.const 0))
  (global $key_len (mut i32) (i32.const 0))
  (global $repo_len (mut i32) (i32.const 0))

  ;; Static Data Segments
  (data (i32.const 10000) "\f0\9f\90\99 **GitHub Integration para Chattree**\0a\0aGestiona y consulta informaci\c3\b3n de GitHub directamente en lenguaje natural o con comandos r\c3\a1pidos.\0a\0a**Ejemplos en lenguaje natural:**\0a\e2\80\a2 `/github que repos tengo` o `/github mis repos` \e2\80\94 Lista tus repositorios recientes\0a\e2\80\a2 `/github quien soy` o `/github mi perfil` \e2\80\94 Informaci\c3\b3n de tu cuenta vinculada\0a\e2\80\a2 `/github <owner/repo>` \e2\80\94 Informaci\c3\b3n y m\c3\a9tricas de un repositorio\0a\e2\80\a2 `/github issues <owner/repo>` \e2\80\94 Lista los issues abiertos\0a\e2\80\a2 `/github prs <owner/repo>` \e2\80\94 Lista los pull requests abiertos\0a\e2\80\a2 `/github config <token>` \e2\80\94 Guarda tu Personal Access Token (PAT)\0a\e2\80\a2 `/gh <consulta>` \e2\80\94 Alias r\c3\a1pido para cualquier consulta\0a\0a*Genera un Personal Access Token en: https://github.com/settings/tokens*")
  (data (i32.const 10783) "\e2\9c\85 **Token de GitHub guardado exitosamente.**\0a\0aYa puedes consultar tus repositorios con `/github que repos tengo` o verificar tu cuenta con `/github quien soy`.")
  (data (i32.const 10960) "\e2\9a\a0\ef\b8\8f **No hay un token de GitHub configurado.**\0a\0aPor favor registra tu Personal Access Token ejecutando:\0a`/github config <tu_token>`\0a\0aPuedes generar uno con permisos `repo` y `read:user` en https://github.com/settings/tokens")
  (data (i32.const 11202) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22api_key\22}}")
  (data (i32.const 11281) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22api_key\22,\22value\22:\22")
  (data (i32.const 11368) "\22}}")
  (data (i32.const 11387) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/user\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 11596) ",\22Authorization\22:\22Bearer ")
  (data (i32.const 11637) "},\22timeoutMs\22:15000}}")
  (data (i32.const 11674) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/user/repos?per_page=6&sort=updated\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 11913) "\f0\9f\93\9a **Tus repositorios recientes en GitHub:**\0a\0a")
  (data (i32.const 11977) "\e2\84\b9\ef\b8\8f No se encontraron repositorios en tu cuenta de GitHub.\0a\0aPuedes crear uno en https://github.com/new")
  (data (i32.const 12098) "\0a*Tip: Consulta m\c3\a9tricas de un repo con `/github <owner/repo>` o sus issues con `/github issues <owner/repo>`.*")
  (data (i32.const 12226) "\e2\80\a2 **")
  (data (i32.const 12248) " (\e2\ad\90 ")
  (data (i32.const 12270) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/repos/")
  (data (i32.const 12377) "/issues?state=open&per_page=5\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 12526) "/pulls?state=open&per_page=5\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 12674) "\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 12794) "\e2\9c\85 **Conectado a GitHub exitosamente**\0a\0a\e2\80\a2 **Usuario:** @")
  (data (i32.const 12869) "\0a\e2\80\a2 **Nombre:** ")
  (data (i32.const 12902) "\0a\e2\80\a2 **Repositorios p\c3\bablicos:** ")
  (data (i32.const 12951) "\0a\e2\80\a2 **Estado:** Conexi\c3\b3n autorizada y lista.")
  (data (i32.const 13013) "\f0\9f\93\a6 **Repositorio: ")
  (data (i32.const 13049) "\0a\0a\e2\ad\90 **Estrellas:** ")
  (data (i32.const 13086) " | \f0\9f\8d\b4 **Forks:** ")
  (data (i32.const 13121) "\0a\f0\9f\94\97 **Enlace:** ")
  (data (i32.const 13155) "\f0\9f\93\8b **Issues recientes en ")
  (data (i32.const 13198) "\f0\9f\94\80 **Pull Requests recientes en ")
  (data (i32.const 13248) ":**\0a\0a")
  (data (i32.const 13269) "\e2\9d\8c **Error de autenticaci\c3\b3n con GitHub**\0a\0aEl token configurado es inv\c3\a1lido o ha expirado. Por favor actual\c3\adzalo con:\0a`/github config <tu_token>`")
  (data (i32.const 13433) "\e2\9d\8c **Repositorio o recurso no encontrado en GitHub.**\0a\0aVerifica que el nombre `owner/repo` sea correcto y que tu token tenga los permisos necesarios.")
  (data (i32.const 13599) "\e2\9d\8c **Error al consultar la API de GitHub.**\0a\0aPor favor verifica tu conexi\c3\b3n o intenta nuevamente.")
  (data (i32.const 13714) "ghp_")
  (data (i32.const 13734) "github_pat_")
  (data (i32.const 13761) "config")
  (data (i32.const 13783) "status")
  (data (i32.const 13805) "issues")
  (data (i32.const 13827) "prs")
  (data (i32.const 13846) "pulls")
  (data (i32.const 13867) "repo")
  (data (i32.const 13887) "github")
  (data (i32.const 13909) "que repo")
  (data (i32.const 13933) "mis repo")
  (data (i32.const 13957) "mis proy")
  (data (i32.const 13981) "tengo")
  (data (i32.const 14002) "repos")
  (data (i32.const 14023) "repositorio")
  (data (i32.const 14050) "quien soy")
  (data (i32.const 14075) "cuenta")
  (data (i32.const 14097) "perfil")
  (data (i32.const 14119) "usuario")
  (data (i32.const 14142) "estado")
  (data (i32.const 14164) "problema")
  (data (i32.const 14188) "error")
  (data (i32.const 14209) "bug")
  (data (i32.const 14228) "cambio")
  (data (i32.const 14250) "ayuda")
  (data (i32.const 14271) "help")
  (data (i32.const 14291) "como se usa")
  (data (i32.const 14318) "como funciona")
  (data (i32.const 14347) "\22value\22:\22")
  (data (i32.const 14372) "\22statusCode\22:200")
  (data (i32.const 14404) "\22statusCode\22:401")
  (data (i32.const 14436) "\22statusCode\22:404")
  (data (i32.const 14468) "\22body\22:\22")
  (data (i32.const 14492) "\22token\22:\22")
  (data (i32.const 14517) "\22repo\22:\22")
  (data (i32.const 14541) "\22title\22:\22")
  (data (i32.const 14566) "login")
  (data (i32.const 14587) "name")
  (data (i32.const 14607) "public_repos")
  (data (i32.const 14635) "full_name")
  (data (i32.const 14660) "description")
  (data (i32.const 14687) "stargazers_count")
  (data (i32.const 14719) "forks_count")
  (data (i32.const 14746) "html_url")

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
            (then (local.set $ch (i32.add (local.get $ch) (i32.const 32))))
          )
          (i32.store8 (i32.add (local.get $dst) (local.get $i)) (local.get $ch))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l_loop)
        )
      )
    )
  )

  ;; Substring search
  (func $find_substring (param $haystack i32) (param $haystack_len i32) (param $needle i32) (param $needle_len i32) (result i32)
    (local $i i32)
    (local $j i32)
    (local $match i32)
    (if (i32.lt_u (local.get $haystack_len) (local.get $needle_len))
      (then (return (i32.const -1)))
    )
    (local.set $i (i32.const 0))
    (loop $outer
      (if (i32.le_u (local.get $i) (i32.sub (local.get $haystack_len) (local.get $needle_len)))
        (then
          (local.set $match (i32.const 1))
          (local.set $j (i32.const 0))
          (loop $inner
            (if (i32.lt_u (local.get $j) (local.get $needle_len))
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
    )
    (i32.const -1)
  )

  ;; Extracts JSON field value by searching for key, skipping separators, and copying value
  (func $extract_field (param $src i32) (param $src_len i32) (param $needle i32) (param $needle_len i32) (param $dst i32) (param $max_len i32) (result i32)
    (local $pos i32)
    (local $p i32)
    (local $end i32)
    (local $ch i32)
    (local $copied i32)

    (local.set $pos (call $find_substring (local.get $src) (local.get $src_len) (local.get $needle) (local.get $needle_len)))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $p (i32.add (i32.add (local.get $src) (local.get $pos)) (local.get $needle_len)))
    (local.set $end (i32.add (local.get $src) (local.get $src_len)))

    ;; Skip separators: quote (34), backslash (92), colon (58), space (32)
    (loop $skip_sep
      (if (i32.lt_u (local.get $p) (local.get $end))
        (then
          (local.set $ch (i32.load8_u (local.get $p)))
          (if (i32.or
                (i32.or (i32.eq (local.get $ch) (i32.const 34)) (i32.eq (local.get $ch) (i32.const 92)))
                (i32.or (i32.eq (local.get $ch) (i32.const 58)) (i32.eq (local.get $ch) (i32.const 32))))
            (then
              (local.set $p (i32.add (local.get $p) (i32.const 1)))
              (br $skip_sep)
            )
          )
        )
      )
    )

    ;; Copy until closing quote, comma, brace, or newline
    (local.set $copied (i32.const 0))
    (loop $cp_val
      (if (i32.and (i32.lt_u (local.get $p) (local.get $end)) (i32.lt_u (local.get $copied) (local.get $max_len)))
        (then
          (local.set $ch (i32.load8_u (local.get $p)))
          (if (i32.and
                (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 92)))
                (i32.and (i32.ne (local.get $ch) (i32.const 44)) (i32.and (i32.ne (local.get $ch) (i32.const 125)) (i32.and (i32.ne (local.get $ch) (i32.const 10)) (i32.ne (local.get $ch) (i32.const 13))))))
            (then
              (i32.store8 (i32.add (local.get $dst) (local.get $copied)) (local.get $ch))
              (local.set $copied (i32.add (local.get $copied) (i32.const 1)))
              (local.set $p (i32.add (local.get $p) (i32.const 1)))
              (br $cp_val)
            )
          )
        )
      )
    )
    (local.get $copied)
  )

  ;; Reads API Key from storage into 3000000
  (func $load_api_key (result i32)
    (local $res_len i32)
    (local $val_idx i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)

    (local.set $res_len (call $host_call (i32.const 11202) (i32.const 63) (i32.const 3000500) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 3000500) (local.get $res_len) (i32.const 14347) (i32.const 9)))
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

  ;; Main entrypoint
  (func (export "github_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $p i32)
    (local $req_len i32)
    (local $tok_pos i32)
    (local $cfg_pos i32)
    (local $status_pos i32)
    (local $issues_pos i32)
    (local $prs_pos i32)
    (local $text_start i32)
    (local $i i32)
    (local $ch i32)
    (local $key_count i32)
    (local $start_scan i32)
    (local $is_user_repos i32)

    (global.set $phase (i32.const 0))
    (global.set $repo_len (i32.const 0))

    ;; 1. Empty input -> Help
    (if (i32.eqz (local.get $in_len))
      (then
        (drop (call $copy_mem (i32.const 10000) (i32.const 1024) (i32.const 767)))
        (return (i32.const 767))
      )
    )

    ;; Copy input to lowercase at 50000 for NLP inspection
    (call $to_lower (local.get $in_ptr) (i32.const 50000) (local.get $in_len))

    ;; 2. DIRECT TOKEN PATTERN: Search for "ghp_" or "github_pat_" ANYWHERE in input
    (local.set $tok_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 13714) (i32.const 4)))
    (if (i32.lt_s (local.get $tok_pos) (i32.const 0))
      (then
        (local.set $tok_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 13734) (i32.const 11)))
      )
    )

    (if (i32.ge_s (local.get $tok_pos) (i32.const 0))
      (then
        (local.set $text_start (i32.add (local.get $in_ptr) (local.get $tok_pos)))
        (local.set $i (i32.const 0))
        (loop $scan_tok
          (if (i32.lt_u (i32.add (local.get $tok_pos) (local.get $i)) (local.get $in_len))
            (then
              (if (i32.lt_u (local.get $i) (i32.const 120))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $text_start) (local.get $i))))
                  (if (i32.and
                        (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                        (i32.and
                          (i32.and (i32.ne (local.get $ch) (i32.const 44)) (i32.ne (local.get $ch) (i32.const 125)))
                          (i32.and (i32.ne (local.get $ch) (i32.const 10)) (i32.and (i32.ne (local.get $ch) (i32.const 13)) (i32.ne (local.get $ch) (i32.const 92))))))
                    (then
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $scan_tok)
                    )
                  )
                )
              )
            )
          )
        )

        (if (i32.gt_u (local.get $i) (i32.const 10))
          (then
            (local.set $p (call $copy_mem (i32.const 11281) (i32.const 100000) (i32.const 71)))
            (local.set $p (call $copy_mem (local.get $text_start) (local.get $p) (local.get $i)))
            (local.set $p (call $copy_mem (i32.const 11368) (local.get $p) (i32.const 3)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 3000500) (i32.const 1024)))

            (drop (call $copy_mem (i32.const 10783) (i32.const 1024) (i32.const 161)))
            (return (i32.const 161))
          )
        )
      )
    )

    ;; 3. Check for "config" command (text or JSON)
    (local.set $cfg_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 13761) (i32.const 6)))
    (if (i32.ge_s (local.get $cfg_pos) (i32.const 0))
      (then
        (local.set $i (call $extract_field (local.get $in_ptr) (local.get $in_len) (i32.const 14492) (i32.const 9) (i32.const 200000) (i32.const 120)))
        (if (i32.eqz (local.get $i))
          (then
            (local.set $i (call $extract_field (local.get $in_ptr) (local.get $in_len) (i32.const 14517) (i32.const 8) (i32.const 200000) (i32.const 120)))
          )
        )
        (if (i32.eqz (local.get $i))
          (then
            (local.set $i (call $extract_field (local.get $in_ptr) (local.get $in_len) (i32.const 14541) (i32.const 9) (i32.const 200000) (i32.const 120)))
          )
        )

        (if (i32.eqz (local.get $i))
          (then
            (local.set $text_start (i32.add (i32.add (local.get $in_ptr) (local.get $cfg_pos)) (i32.const 6)))
            (loop $skip_cfg_sep
              (if (i32.lt_u (local.get $text_start) (i32.add (local.get $in_ptr) (local.get $in_len)))
                (then
                  (local.set $ch (i32.load8_u (local.get $text_start)))
                  (if (i32.or
                        (i32.or (i32.eq (local.get $ch) (i32.const 32)) (i32.eq (local.get $ch) (i32.const 58)))
                        (i32.or (i32.eq (local.get $ch) (i32.const 34)) (i32.eq (local.get $ch) (i32.const 61))))
                    (then
                      (local.set $text_start (i32.add (local.get $text_start) (i32.const 1)))
                      (br $skip_cfg_sep)
                    )
                  )
                )
              )
            )
            (local.set $i (i32.const 0))
            (loop $scan_cfg_raw
              (if (i32.lt_u (i32.add (local.get $text_start) (local.get $i)) (i32.add (local.get $in_ptr) (local.get $in_len)))
                (then
                  (if (i32.lt_u (local.get $i) (i32.const 120))
                    (then
                      (local.set $ch (i32.load8_u (i32.add (local.get $text_start) (local.get $i))))
                      (if (i32.and
                            (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                            (i32.and (i32.ne (local.get $ch) (i32.const 44)) (i32.and (i32.ne (local.get $ch) (i32.const 125)) (i32.and (i32.ne (local.get $ch) (i32.const 10)) (i32.ne (local.get $ch) (i32.const 13))))))
                        (then
                          (i32.store8 (i32.add (i32.const 200000) (local.get $i)) (local.get $ch))
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $scan_cfg_raw)
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )

        (if (i32.gt_u (local.get $i) (i32.const 4))
          (then
            (local.set $p (call $copy_mem (i32.const 11281) (i32.const 100000) (i32.const 71)))
            (local.set $p (call $copy_mem (i32.const 200000) (local.get $p) (local.get $i)))
            (local.set $p (call $copy_mem (i32.const 11368) (local.get $p) (i32.const 3)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 3000500) (i32.const 1024)))

            (drop (call $copy_mem (i32.const 10783) (i32.const 1024) (i32.const 161)))
            (return (i32.const 161))
          )
        )
      )
    )

    ;; 4. NATURAL LANGUAGE INTENT: User Repositories ("que repos tengo", "mis repos", "tengo repos", "repositorios", "repos")
    (local.set $is_user_repos (i32.const 0))
    (if (i32.or
          (i32.or
            (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 13909) (i32.const 8)) (i32.const 0))
            (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 13933) (i32.const 8)) (i32.const 0)))
          (i32.or
            (i32.or
              (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 13957) (i32.const 8)) (i32.const 0))
              (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 13981) (i32.const 5)) (i32.const 0)))
            (i32.or
              (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 14023) (i32.const 11)) (i32.const 0))
              (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 14002) (i32.const 5)) (i32.const 0)))))
      (then
        ;; But only if input does not specify an explicit external owner/repo (slash '/')
        (if (i32.lt_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 47) (i32.const 1)) (i32.const 0))
          (then
            (local.set $is_user_repos (i32.const 1))
          )
        )
      )
    )

    (if (local.get $is_user_repos)
      (then
        (local.set $key_count (call $load_api_key))
        (if (i32.eqz (local.get $key_count))
          (then
            (drop (call $copy_mem (i32.const 10960) (i32.const 1024) (i32.const 226)))
            (return (i32.const 226))
          )
        )

        ;; Dispatch HTTP GET /user/repos?per_page=6&sort=updated (Phase 5)
        (local.set $p (call $copy_mem (i32.const 11674) (i32.const 100000) (i32.const 223)))
        (local.set $p (call $copy_mem (i32.const 11596) (local.get $p) (i32.const 25)))
        (local.set $p (call $copy_mem (i32.const 3000000) (local.get $p) (global.get $key_len)))
        (i32.store8 (local.get $p) (i32.const 34))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (local.set $p (call $copy_mem (i32.const 11637) (local.get $p) (i32.const 21)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (global.set $phase (i32.const 5))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 1000000)))
        (return (i32.const 0))
      )
    )

    ;; 5. NATURAL LANGUAGE INTENT: User Profile / Status ("status", "quien soy", "mi perfil", "mi cuenta", "usuario", "estado")
    (if (i32.or
          (i32.or
            (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 13783) (i32.const 6)) (i32.const 0))
            (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 14050) (i32.const 9)) (i32.const 0)))
          (i32.or
            (i32.or
              (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 14075) (i32.const 6)) (i32.const 0))
              (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 14097) (i32.const 6)) (i32.const 0)))
            (i32.or
              (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 14119) (i32.const 7)) (i32.const 0))
              (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 14142) (i32.const 6)) (i32.const 0)))))
      (then
        (local.set $key_count (call $load_api_key))
        (if (i32.eqz (local.get $key_count))
          (then
            (drop (call $copy_mem (i32.const 10960) (i32.const 1024) (i32.const 226)))
            (return (i32.const 226))
          )
        )

        ;; Dispatch HTTP GET /user (Phase 1)
        (local.set $p (call $copy_mem (i32.const 11387) (i32.const 100000) (i32.const 193)))
        (local.set $p (call $copy_mem (i32.const 11596) (local.get $p) (i32.const 25)))
        (local.set $p (call $copy_mem (i32.const 3000000) (local.get $p) (global.get $key_len)))
        (i32.store8 (local.get $p) (i32.const 34))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (local.set $p (call $copy_mem (i32.const 11637) (local.get $p) (i32.const 21)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (global.set $phase (i32.const 1))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 1000000)))
        (return (i32.const 0))
      )
    )

    ;; 6. Check for Help keywords
    (if (i32.or
          (i32.or
            (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 14250) (i32.const 5)) (i32.const 0))
            (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 14271) (i32.const 4)) (i32.const 0)))
          (i32.or
            (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 14291) (i32.const 11)) (i32.const 0))
            (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 14318) (i32.const 13)) (i32.const 0))))
      (then
        (drop (call $copy_mem (i32.const 10000) (i32.const 1024) (i32.const 767)))
        (return (i32.const 767))
      )
    )

    ;; 7. Search for specific repo name (contains owner/repo)
    (local.set $start_scan (i32.const 0))
    (local.set $p (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 13887) (i32.const 6)))
    (if (i32.and (i32.ge_s (local.get $p) (i32.const 0)) (i32.lt_u (local.get $p) (i32.const 15)))
      (then
        (local.set $start_scan (i32.add (local.get $p) (i32.const 6)))
      )
    )

    (local.set $p (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 13867) (i32.const 4)))
    (if (i32.ge_s (local.get $p) (i32.const 0))
      (then
        (if (i32.gt_u (i32.add (local.get $p) (i32.const 4)) (local.get $start_scan))
          (then
            (local.set $start_scan (i32.add (local.get $p) (i32.const 4)))
          )
        )
      )
    )

    ;; Find slash '/' at or after $start_scan
    (local.set $i (local.get $start_scan))
    (local.set $text_start (i32.const -1))
    (loop $find_slash
      (if (i32.lt_u (local.get $i) (local.get $in_len))
        (then
          (if (i32.eq (i32.load8_u (i32.add (i32.const 50000) (local.get $i))) (i32.const 47))
            (then
              (if (i32.gt_u (local.get $i) (local.get $start_scan))
                (then
                  (local.set $text_start (local.get $i))
                  (loop $find_owner_start
                    (if (i32.gt_u (local.get $text_start) (local.get $start_scan))
                      (then
                        (local.set $ch (i32.load8_u (i32.add (i32.const 50000) (i32.sub (local.get $text_start) (i32.const 1)))))
                        (if (i32.and
                              (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                              (i32.and
                                (i32.and (i32.ne (local.get $ch) (i32.const 58)) (i32.ne (local.get $ch) (i32.const 61)))
                                (i32.and (i32.ne (local.get $ch) (i32.const 47)) (i32.ne (local.get $ch) (i32.const 44)))))
                          (then
                            (local.set $text_start (i32.sub (local.get $text_start) (i32.const 1)))
                            (br $find_owner_start)
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
            (else
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $find_slash)
            )
          )
        )
      )
    )

    (if (i32.ge_s (local.get $text_start) (i32.const 0))
      (then
        (local.set $i (i32.const 0))
        (loop $copy_repo
          (if (i32.lt_u (i32.add (local.get $text_start) (local.get $i)) (local.get $in_len))
            (then
              (if (i32.lt_u (local.get $i) (i32.const 80))
                (then
                  (local.set $ch (i32.load8_u (i32.add (i32.const 50000) (i32.add (local.get $text_start) (local.get $i)))))
                  (if (i32.and
                        (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                        (i32.and
                          (i32.and (i32.ne (local.get $ch) (i32.const 125)) (i32.ne (local.get $ch) (i32.const 44)))
                          (i32.and (i32.ne (local.get $ch) (i32.const 10)) (i32.ne (local.get $ch) (i32.const 13)))))
                    (then
                      (i32.store8 (i32.add (i32.const 300000) (local.get $i)) (local.get $ch))
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $copy_repo)
                    )
                  )
                )
              )
            )
          )
        )
        (if (i32.gt_u (local.get $i) (i32.const 2))
          (then
            (global.set $repo_len (local.get $i))
          )
        )
      )
    )

    ;; Fallback: return help if no repo identified
    (if (i32.eqz (global.get $repo_len))
      (then
        (drop (call $copy_mem (i32.const 10000) (i32.const 1024) (i32.const 767)))
        (return (i32.const 767))
      )
    )

    ;; Read token if stored
    (drop (call $load_api_key))

    ;; 7.1 Issues in natural language or command
    (local.set $issues_pos (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 13805) (i32.const 6)))
    (if (i32.lt_s (local.get $issues_pos) (i32.const 0))
      (then
        (local.set $issues_pos (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 14164) (i32.const 8)))
      )
    )
    (if (i32.lt_s (local.get $issues_pos) (i32.const 0))
      (then
        (local.set $issues_pos (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 14188) (i32.const 5)))
      )
    )
    (if (i32.lt_s (local.get $issues_pos) (i32.const 0))
      (then
        (local.set $issues_pos (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 14209) (i32.const 3)))
      )
    )

    (if (i32.ge_s (local.get $issues_pos) (i32.const 0))
      (then
        (local.set $p (call $copy_mem (i32.const 12270) (i32.const 100000) (i32.const 91)))
        (local.set $p (call $copy_mem (i32.const 300000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const 12377) (local.get $p) (i32.const 133)))
        (if (i32.gt_u (global.get $key_len) (i32.const 0))
          (then
            (local.set $p (call $copy_mem (i32.const 11596) (local.get $p) (i32.const 25)))
            (local.set $p (call $copy_mem (i32.const 3000000) (local.get $p) (global.get $key_len)))
            (i32.store8 (local.get $p) (i32.const 34))
            (local.set $p (i32.add (local.get $p) (i32.const 1)))
          )
        )
        (local.set $p (call $copy_mem (i32.const 11637) (local.get $p) (i32.const 21)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (global.set $phase (i32.const 2))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 1000000)))
        (return (i32.const 0))
      )
    )

    ;; 7.2 Pull Requests in natural language or command
    (local.set $prs_pos (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 13827) (i32.const 3)))
    (if (i32.lt_s (local.get $prs_pos) (i32.const 0))
      (then
        (local.set $prs_pos (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 13846) (i32.const 5)))
      )
    )
    (if (i32.lt_s (local.get $prs_pos) (i32.const 0))
      (then
        (local.set $prs_pos (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 14228) (i32.const 6)))
      )
    )

    (if (i32.ge_s (local.get $prs_pos) (i32.const 0))
      (then
        (local.set $p (call $copy_mem (i32.const 12270) (i32.const 100000) (i32.const 91)))
        (local.set $p (call $copy_mem (i32.const 300000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const 12526) (local.get $p) (i32.const 132)))
        (if (i32.gt_u (global.get $key_len) (i32.const 0))
          (then
            (local.set $p (call $copy_mem (i32.const 11596) (local.get $p) (i32.const 25)))
            (local.set $p (call $copy_mem (i32.const 3000000) (local.get $p) (global.get $key_len)))
            (i32.store8 (local.get $p) (i32.const 34))
            (local.set $p (i32.add (local.get $p) (i32.const 1)))
          )
        )
        (local.set $p (call $copy_mem (i32.const 11637) (local.get $p) (i32.const 21)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (global.set $phase (i32.const 3))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 1000000)))
        (return (i32.const 0))
      )
    )

    ;; 7.3 Default for repo: Get repo info
    (local.set $p (call $copy_mem (i32.const 12270) (i32.const 100000) (i32.const 91)))
    (local.set $p (call $copy_mem (i32.const 300000) (local.get $p) (global.get $repo_len)))
    (local.set $p (call $copy_mem (i32.const 12674) (local.get $p) (i32.const 104)))
    (if (i32.gt_u (global.get $key_len) (i32.const 0))
      (then
        (local.set $p (call $copy_mem (i32.const 11596) (local.get $p) (i32.const 25)))
        (local.set $p (call $copy_mem (i32.const 3000000) (local.get $p) (global.get $key_len)))
        (i32.store8 (local.get $p) (i32.const 34))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
      )
    )
    (local.set $p (call $copy_mem (i32.const 11637) (local.get $p) (i32.const 21)))
    (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

    (global.set $phase (i32.const 4))
    (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 1000000)))
    (i32.const 0)
  )

  ;; Resume handler for HTTP responses
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $out i32)
    (local $extracted_len i32)
    (local $body_idx i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)
    (local $p i32)
    (local $count i32)
    (local $rem_len i32)
    (local $pos i32)

    ;; Check for 401 Unauthorized
    (if (i32.ge_s (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 14404) (i32.const 16)) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 13269) (i32.const 1024) (i32.const 148)))
        (return (i32.const 148))
      )
    )

    ;; Check for 404 Not Found
    (if (i32.ge_s (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 14436) (i32.const 16)) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 13433) (i32.const 1024) (i32.const 150)))
        (return (i32.const 150))
      )
    )

    ;; Check for 200 OK
    (if (i32.lt_s (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 14372) (i32.const 16)) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 13599) (i32.const 1024) (i32.const 99)))
        (return (i32.const 99))
      )
    )

    ;; Phase 1: Status response (/user)
    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        (local.set $out (call $copy_mem (i32.const 12794) (i32.const 1024) (i32.const 59)))

        ;; Extract login
        (local.set $extracted_len (call $extract_field (local.get $res_ptr) (local.get $res_len) (i32.const 14566) (i32.const 5) (local.get $out) (i32.const 40)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))

        (local.set $out (call $copy_mem (i32.const 12869) (local.get $out) (i32.const 17)))

        ;; Extract name
        (local.set $extracted_len (call $extract_field (local.get $res_ptr) (local.get $res_len) (i32.const 14587) (i32.const 4) (local.get $out) (i32.const 50)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))

        (local.set $out (call $copy_mem (i32.const 12902) (local.get $out) (i32.const 33)))

        ;; Extract public_repos
        (local.set $extracted_len (call $extract_field (local.get $res_ptr) (local.get $res_len) (i32.const 14607) (i32.const 12) (local.get $out) (i32.const 10)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))

        (local.set $out (call $copy_mem (i32.const 12951) (local.get $out) (i32.const 46)))
        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    ;; Phase 5: User Repositories (/user/repos)
    (if (i32.eq (global.get $phase) (i32.const 5))
      (then
        (local.set $out (call $copy_mem (i32.const 11913) (i32.const 1024) (i32.const 48)))

        (local.set $p (local.get $res_ptr))
        (local.set $count (i32.const 0))

        (loop $find_next_repo
          (if (i32.and (i32.lt_u (local.get $p) (i32.add (local.get $res_ptr) (local.get $res_len))) (i32.lt_u (local.get $count) (i32.const 6)))
            (then
              (local.set $rem_len (i32.sub (i32.add (local.get $res_ptr) (local.get $res_len)) (local.get $p)))
              (local.set $pos (call $find_substring (local.get $p) (local.get $rem_len) (i32.const 14635) (i32.const 9)))
              (if (i32.ge_s (local.get $pos) (i32.const 0))
                (then
                  (local.set $p (i32.add (local.get $p) (local.get $pos)))
                  (local.set $rem_len (i32.sub (i32.add (local.get $res_ptr) (local.get $res_len)) (local.get $p)))

                  ;; Add bullet: "• **"
                  (local.set $out (call $copy_mem (i32.const 12226) (local.get $out) (i32.const 6)))

                  ;; Extract full_name value
                  (local.set $extracted_len (call $extract_field (local.get $p) (local.get $rem_len) (i32.const 14635) (i32.const 9) (local.get $out) (i32.const 60)))
                  (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))

                  ;; Close bold "**"
                  (i32.store8 (local.get $out) (i32.const 42))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (i32.store8 (local.get $out) (i32.const 42))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))

                  ;; Advance $p past this full_name
                  (local.set $p (i32.add (local.get $p) (i32.add (i32.const 9) (local.get $extracted_len))))
                  (local.set $rem_len (i32.sub (i32.add (local.get $res_ptr) (local.get $res_len)) (local.get $p)))

                  ;; Extract stars if present nearby
                  (local.set $out (call $copy_mem (i32.const 12248) (local.get $out) (i32.const 6)))
                  (local.set $extracted_len (call $extract_field (local.get $p) (local.get $rem_len) (i32.const 14687) (i32.const 16) (local.get $out) (i32.const 10)))
                  (if (i32.gt_u (local.get $extracted_len) (i32.const 0))
                    (then (local.set $out (i32.add (local.get $out) (local.get $extracted_len))))
                    (else
                      (i32.store8 (local.get $out) (i32.const 48))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                    )
                  )
                  (i32.store8 (local.get $out) (i32.const 41)) ;; ")"
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (i32.store8 (local.get $out) (i32.const 10)) ;; newline
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))

                  (local.set $count (i32.add (local.get $count) (i32.const 1)))
                  (br $find_next_repo)
                )
              )
            )
          )
        )

        (if (i32.eqz (local.get $count))
          (then
            (drop (call $copy_mem (i32.const 11977) (i32.const 1024) (i32.const 105)))
            (return (i32.const 105))
          )
          (else
            (local.set $out (call $copy_mem (i32.const 12098) (local.get $out) (i32.const 112)))
            (return (i32.sub (local.get $out) (i32.const 1024)))
          )
        )
      )
    )

    ;; Phase 4: Repo Info
    (if (i32.eq (global.get $phase) (i32.const 4))
      (then
        (local.set $out (call $copy_mem (i32.const 13013) (i32.const 1024) (i32.const 20)))

        ;; Extract full_name
        (local.set $extracted_len (call $extract_field (local.get $res_ptr) (local.get $res_len) (i32.const 14635) (i32.const 9) (local.get $out) (i32.const 80)))
        (if (i32.gt_u (local.get $extracted_len) (i32.const 0))
          (then
            (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))
          )
          (else
            (local.set $out (call $copy_mem (i32.const 300000) (local.get $out) (global.get $repo_len)))
          )
        )

        ;; Close bold and newline
        (i32.store8 (local.get $out) (i32.const 42)) ;; *
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (i32.store8 (local.get $out) (i32.const 42)) ;; *
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (i32.store8 (local.get $out) (i32.const 10)) ;; newline
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (i32.store8 (local.get $out) (i32.const 10)) ;; newline
        (local.set $out (i32.add (local.get $out) (i32.const 1)))

        ;; Extract description
        (local.set $extracted_len (call $extract_field (local.get $res_ptr) (local.get $res_len) (i32.const 14660) (i32.const 11) (local.get $out) (i32.const 200)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))

        ;; Stars
        (local.set $out (call $copy_mem (i32.const 13049) (local.get $out) (i32.const 21)))
        (local.set $extracted_len (call $extract_field (local.get $res_ptr) (local.get $res_len) (i32.const 14687) (i32.const 16) (local.get $out) (i32.const 15)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))

        ;; Forks
        (local.set $out (call $copy_mem (i32.const 13086) (local.get $out) (i32.const 19)))
        (local.set $extracted_len (call $extract_field (local.get $res_ptr) (local.get $res_len) (i32.const 14719) (i32.const 11) (local.get $out) (i32.const 15)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))

        ;; URL
        (local.set $out (call $copy_mem (i32.const 13121) (local.get $out) (i32.const 18)))
        (local.set $extracted_len (call $extract_field (local.get $res_ptr) (local.get $res_len) (i32.const 14746) (i32.const 8) (local.get $out) (i32.const 100)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))

        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    ;; Phase 2: Issues or Phase 3: PRs
    (if (i32.or (i32.eq (global.get $phase) (i32.const 2)) (i32.eq (global.get $phase) (i32.const 3)))
      (then
        (if (i32.eq (global.get $phase) (i32.const 2))
          (then
            (local.set $out (call $copy_mem (i32.const 13155) (i32.const 1024) (i32.const 27)))
          )
          (else
            (local.set $out (call $copy_mem (i32.const 13198) (i32.const 1024) (i32.const 34)))
          )
        )
        (local.set $out (call $copy_mem (i32.const 300000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const 13248) (local.get $out) (i32.const 5)))

        ;; Extract response body contents
        (local.set $body_idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 14468) (i32.const 8)))
        (if (i32.ge_s (local.get $body_idx) (i32.const 0))
          (then
            (local.set $val_start (i32.add (i32.add (local.get $res_ptr) (local.get $body_idx)) (i32.const 8)))
            (local.set $i (i32.const 0))
            (loop $cp_body_items
              (if (i32.lt_u (i32.add (local.get $val_start) (local.get $i)) (i32.add (local.get $res_ptr) (local.get $res_len)))
                (then
                  (if (i32.lt_u (local.get $i) (i32.const 25000))
                    (then
                      (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
                      (if (i32.ne (local.get $ch) (i32.const 34))
                        (then
                          (i32.store8 (local.get $out) (local.get $ch))
                          (local.set $out (i32.add (local.get $out) (i32.const 1)))
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $cp_body_items)
                        )
                      )
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

    (drop (call $copy_mem (i32.const 13599) (i32.const 1024) (i32.const 99)))
    (i32.const 99)
  )
)
