;; Chattree Official GitHub Integration Plugin v1.2.4
;; Triple-layer README intent defense + NLP query buffer promotion
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  (memory (export "memory") 64)

  (global $phase    (mut i32) (i32.const 0))
  (global $key_len  (mut i32) (i32.const 0))
  (global $repo_len (mut i32) (i32.const 0))

  ;; Static Data
  (data (i32.const 10000) "profile")
  (data (i32.const 10023) "my_repos")
  (data (i32.const 10047) "repo_info")
  (data (i32.const 10072) "stats")
  (data (i32.const 10093) "issues")
  (data (i32.const 10115) "prs")
  (data (i32.const 10134) "readme")
  (data (i32.const 10156) "search")
  (data (i32.const 10178) "create_issue")
  (data (i32.const 10206) "config")
  (data (i32.const 10228) "help")
  (data (i32.const 10248) "\22operation\22")
  (data (i32.const 10275) "\22action\22")
  (data (i32.const 10299) "\22repo\22")
  (data (i32.const 10321) "\22query\22")
  (data (i32.const 10344) "\22title\22")
  (data (i32.const 10367) "\22token\22")
  (data (i32.const 10390) "\22value\22")
  (data (i32.const 10413) "\22body\22:\22")
  (data (i32.const 10437) "ghp_")
  (data (i32.const 10457) "github_pat_")
  (data (i32.const 10484) "que repo")
  (data (i32.const 10508) "mis repo")
  (data (i32.const 10532) "mis proy")
  (data (i32.const 10556) "tengo repo")
  (data (i32.const 10582) "repos")
  (data (i32.const 10603) "quien soy")
  (data (i32.const 10628) "perfil")
  (data (i32.const 10650) "cuenta")
  (data (i32.const 10672) "status")
  (data (i32.const 10694) "readme")
  (data (i32.const 10716) "leer")
  (data (i32.const 10736) "lee")
  (data (i32.const 10755) "doc")
  (data (i32.const 10774) "mostrar")
  (data (i32.const 10797) "explic")
  (data (i32.const 10819) "de que")
  (data (i32.const 10841) "para que")
  (data (i32.const 10865) "buscar")
  (data (i32.const 10887) "busca")
  (data (i32.const 10908) "search")
  (data (i32.const 10930) "donde")
  (data (i32.const 10951) "issue")
  (data (i32.const 10972) "crear")
  (data (i32.const 10993) "abrir")
  (data (i32.const 11014) "reportar")
  (data (i32.const 11038) "problema")
  (data (i32.const 11062) "error")
  (data (i32.const 11083) "bug")
  (data (i32.const 11102) "prs")
  (data (i32.const 11121) "pull")
  (data (i32.const 11141) "cambio")
  (data (i32.const 11163) "config")
  (data (i32.const 11185) "estrella")
  (data (i32.const 11209) "stars")
  (data (i32.const 11230) "fork")
  (data (i32.const 11250) "cuantas")
  (data (i32.const 11273) "cuantos")
  (data (i32.const 11296) "\22statusCode\22:200")
  (data (i32.const 11328) "\22statusCode\22:201")
  (data (i32.const 11360) "\22statusCode\22:401")
  (data (i32.const 11392) "\22statusCode\22:404")
  (data (i32.const 11424) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22api_key\22}}")
  (data (i32.const 11503) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22api_key\22,\22value\22:\22")
  (data (i32.const 11590) "\22}}")
  (data (i32.const 11609) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/user\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 11818) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/user/repos?per_page=6&sort=updated\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 12057) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/repos/")
  (data (i32.const 12164) "/issues?state=open&per_page=5\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 12313) "/pulls?state=open&per_page=5\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 12461) "\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 12581) "/readme\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github.raw\22")
  (data (i32.const 12707) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/search/code?q=")
  (data (i32.const 12822) "+repo:")
  (data (i32.const 12844) "\22,\22method\22:\22GET\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22")
  (data (i32.const 12964) "/issues\22,\22method\22:\22POST\22,\22headers\22:{\22User-Agent\22:\22Chattree-GitHub-Plugin\22,\22Accept\22:\22application/vnd.github+json\22,\22Content-Type\22:\22application/json\22")
  (data (i32.const 13126) ",\22Authorization\22:\22Bearer ")
  (data (i32.const 13167) "},\22timeoutMs\22:15000}}")
  (data (i32.const 13204) "},\22body\22:\22{\5c\22title\5c\22:\5c\22")
  (data (i32.const 13243) "\5c\22}\22,\22timeoutMs\22:15000}}")
  (data (i32.const 13283) "\f0\9f\90\99 **GitHub Integration v1.2.4 para Chattree**\0a\0aPuedes consultarme en lenguaje natural o con comandos:\0a\e2\80\a2 \22dime qu\c3\a9 repos tengo\22 o \22mis repos\22\0a\e2\80\a2 \22qui\c3\a9n soy en GitHub\22 o \22mi cuenta\22\0a\e2\80\a2 \22expl\c3\adcame el README de Ponce5/Chattree\22\0a\e2\80\a2 \22issues abiertos en Ponce5/Chattree\22\0a\e2\80\a2 \22pull requests en Ponce5/Chattree\22\0a\e2\80\a2 \22busca la funci\c3\b3n login en Ponce5/Chattree\22\0a\e2\80\a2 \22crea un issue en Ponce5/Chattree: El bot\c3\b3n no funciona\22\0a\e2\80\a2 \22configura mi token: ghp_abc123\22\0a\0a*Genera un Personal Access Token en: https://github.com/settings/tokens*")
  (data (i32.const 13834) "\e2\9c\85 **Token de GitHub guardado exitosamente.**\0a\0aYa puedes interactuar con tus repositorios en lenguaje natural.")
  (data (i32.const 13961) "\e2\9a\a0\ef\b8\8f **No hay un token de GitHub configurado.**\0a\0aPor favor config\c3\baralo diciendo:\0a\22configura mi token de GitHub: ghp_tutoken\22\0a\0aPuedes generar uno en https://github.com/settings/tokens")
  (data (i32.const 14162) "\e2\9c\85 **Conectado a GitHub exitosamente**\0a\0a\e2\80\a2 **Usuario:** @")
  (data (i32.const 14237) "\0a\e2\80\a2 **Nombre:** ")
  (data (i32.const 14270) "\0a\e2\80\a2 **Repositorios p\c3\bablicos:** ")
  (data (i32.const 14319) "\0a\e2\80\a2 **Estado:** Conexi\c3\b3n autorizada y lista.")
  (data (i32.const 14381) "\f0\9f\93\9a **Tus repositorios recientes en GitHub:**\0a\0a")
  (data (i32.const 14445) "\e2\84\b9\ef\b8\8f No se encontraron repositorios en tu cuenta de GitHub.\0a\0aPuedes crear uno en https://github.com/new")
  (data (i32.const 14566) "\0a*Tip: Preg\c3\bantame sobre cualquier repo, sus issues o su README.*")
  (data (i32.const 14647) "\e2\80\a2 **")
  (data (i32.const 14669) " (\e2\ad\90 ")
  (data (i32.const 14691) "\f0\9f\93\a6 **Repositorio: ")
  (data (i32.const 14727) "\e2\ad\90 **Estrellas:** ")
  (data (i32.const 14762) " | \f0\9f\8d\b4 **Forks:** ")
  (data (i32.const 14797) "\0a\f0\9f\94\97 **Enlace:** ")
  (data (i32.const 14831) "https://github.com/")
  (data (i32.const 14866) "\f0\9f\93\8b **Issues recientes en ")
  (data (i32.const 14909) "\f0\9f\94\80 **Pull Requests recientes en ")
  (data (i32.const 14959) ":**\0a\0a")
  (data (i32.const 14980) "\f0\9f\93\84 **README de ")
  (data (i32.const 15013) ":**\0a\0a")
  (data (i32.const 15034) "\e2\84\b9\ef\b8\8f Este repositorio no tiene un README disponible.")
  (data (i32.const 15104) "\f0\9f\94\8d **Resultados de b\c3\basqueda en ")
  (data (i32.const 15154) "\0a\e2\80\a2 ")
  (data (i32.const 15175) "\e2\84\b9\ef\b8\8f No se encontraron coincidencias para esa b\c3\basqueda.")
  (data (i32.const 15249) "\e2\9c\85 **Issue creado en ")
  (data (i32.const 15287) ":**\0a\0aPuedes verlo en: https://github.com/")
  (data (i32.const 15344) "/issues")
  (data (i32.const 15367) "\e2\9a\a0\ef\b8\8f **Se requiere un token de GitHub para crear issues.**\0a\0aConfig\c3\baralo diciendo: \22configura mi token: ghp_tutoken\22")
  (data (i32.const 15501) "\e2\9d\8c **Error de autenticaci\c3\b3n con GitHub.**\0a\0aEl token es inv\c3\a1lido o ha expirado. Configura uno nuevo diciendo:\0a\22configura mi token: ghp_nuevotoken\22")
  (data (i32.const 15665) "\f0\9f\94\92 **Repositorio privado o acceso restringido.**\0a\0aEste repositorio requiere autenticaci\c3\b3n para acceder. Configura tu token diciendo:\0a\22configura mi token: ghp_tutoken\22")
  (data (i32.const 15850) "\e2\9d\8c **Repositorio o recurso no encontrado en GitHub.**\0a\0aVerifica que el nombre `owner/repo` sea correcto y que tu token tenga los permisos necesarios.")
  (data (i32.const 16016) "\e2\9d\8c **Error al consultar la API de GitHub.**\0a\0aPor favor verifica tu conexi\c3\b3n o intenta nuevamente.")
  (data (i32.const 16131) "login")
  (data (i32.const 16152) "name")
  (data (i32.const 16172) "public_repos")
  (data (i32.const 16200) "full_name")
  (data (i32.const 16225) "description")
  (data (i32.const 16252) "stargazers_count")
  (data (i32.const 16284) "forks_count")
  (data (i32.const 16311) "\22path\22:\22")

  ;; ── copy_mem ─────────────────────────────────────────────────────────────
  (func $copy_mem (param $src i32) (param $dst i32) (param $len i32) (result i32)
    (memory.copy (local.get $dst) (local.get $src) (local.get $len))
    (i32.add (local.get $dst) (local.get $len))
  )

  ;; ── to_lower ─────────────────────────────────────────────────────────────
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

  ;; ── find_substring ────────────────────────────────────────────────────────
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

  ;; ── extract_field: robust JSON field parser (handles strings & numbers) ───
  (func $extract_field
    (param $src i32) (param $src_len i32)
    (param $ndl i32) (param $ndl_len i32)
    (param $dst i32) (param $max i32)
    (result i32)
    (local $pos i32)
    (local $p   i32)
    (local $end i32)
    (local $ch  i32)
    (local $is_str i32)
    (local $n   i32)

    (local.set $pos (call $find_substring
      (local.get $src) (local.get $src_len)
      (local.get $ndl) (local.get $ndl_len)))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $p (i32.add (i32.add (local.get $src) (local.get $pos)) (local.get $ndl_len)))
    (local.set $end (i32.add (local.get $src) (local.get $src_len)))

    ;; Skip until colon ':' (58)
    (loop $find_colon
      (if (i32.lt_u (local.get $p) (local.get $end))
        (then
          (if (i32.ne (i32.load8_u (local.get $p)) (i32.const 58))
            (then
              (local.set $p (i32.add (local.get $p) (i32.const 1)))
              (br $find_colon)
            )
          )
        )
      )
    )
    (if (i32.ge_u (local.get $p) (local.get $end)) (then (return (i32.const 0))))
    (local.set $p (i32.add (local.get $p) (i32.const 1))) ;; skip ':'

    ;; Skip leading spaces (32)
    (loop $skip_ws
      (if (i32.lt_u (local.get $p) (local.get $end))
        (then
          (if (i32.eq (i32.load8_u (local.get $p)) (i32.const 32))
            (then
              (local.set $p (i32.add (local.get $p) (i32.const 1)))
              (br $skip_ws)
            )
          )
        )
      )
    )

    ;; Check if value is string: starts with quote (34) or backslash (92)
    (local.set $is_str (i32.const 0))
    (if (i32.lt_u (local.get $p) (local.get $end))
      (then
        (local.set $ch (i32.load8_u (local.get $p)))
        (if (i32.eq (local.get $ch) (i32.const 92)) ;; backslash before quote
          (then
            (local.set $p (i32.add (local.get $p) (i32.const 1)))
            (if (i32.lt_u (local.get $p) (local.get $end))
              (then
                (if (i32.eq (i32.load8_u (local.get $p)) (i32.const 34))
                  (then
                    (local.set $is_str (i32.const 1))
                    (local.set $p (i32.add (local.get $p) (i32.const 1)))
                  )
                )
              )
            )
          )
          (else
            (if (i32.eq (local.get $ch) (i32.const 34))
              (then
                (local.set $is_str (i32.const 1))
                (local.set $p (i32.add (local.get $p) (i32.const 1)))
              )
            )
          )
        )
      )
    )

    (local.set $n (i32.const 0))
    (if (local.get $is_str)
      (then
        ;; String value: copy until closing quote
        (loop $cp_str
          (if (i32.and
                (i32.lt_u (local.get $p) (local.get $end))
                (i32.lt_u (local.get $n) (local.get $max)))
            (then
              (local.set $ch (i32.load8_u (local.get $p)))
              (if (i32.eq (local.get $ch) (i32.const 92))
                (then
                  (if (i32.lt_u (i32.add (local.get $p) (i32.const 1)) (local.get $end))
                    (then
                      (if (i32.eq (i32.load8_u (i32.add (local.get $p) (i32.const 1))) (i32.const 34))
                        (then (return (local.get $n))) ;; reached closing "
                      )
                    )
                  )
                )
              )
              (if (i32.eq (local.get $ch) (i32.const 34))
                (then (return (local.get $n))) ;; reached unescaped "
              )
              ;; Store character
              (i32.store8 (i32.add (local.get $dst) (local.get $n)) (local.get $ch))
              (local.set $n (i32.add (local.get $n) (i32.const 1)))
              (local.set $p (i32.add (local.get $p) (i32.const 1)))
              (br $cp_str)
            )
          )
        )
      )
      (else
        ;; Number / boolean: copy until comma (44), brace (125), quote (34), space (32), newline (10)
        (loop $cp_num
          (if (i32.and
                (i32.lt_u (local.get $p) (local.get $end))
                (i32.lt_u (local.get $n) (local.get $max)))
            (then
              (local.set $ch (i32.load8_u (local.get $p)))
              (if (i32.and
                    (i32.and (i32.ne (local.get $ch) (i32.const 44)) (i32.ne (local.get $ch) (i32.const 125)))
                    (i32.and
                      (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 32)))
                      (i32.and (i32.ne (local.get $ch) (i32.const 10)) (i32.ne (local.get $ch) (i32.const 13)))))
                (then
                  (i32.store8 (i32.add (local.get $dst) (local.get $n)) (local.get $ch))
                  (local.set $n (i32.add (local.get $n) (i32.const 1)))
                  (local.set $p (i32.add (local.get $p) (i32.const 1)))
                  (br $cp_num)
                )
              )
            )
          )
        )
      )
    )
    (local.get $n)
  )

  ;; ── str_eq ───────────────────────────────────────────────────────────────
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

  ;; ── load_api_key ─────────────────────────────────────────────────────────
  (func $load_api_key (result i32)
    (local $res_len i32)
    (local $extracted i32)

    (local.set $res_len (call $host_call
      (i32.const 11424) (i32.const 63)
      (i32.const 3000500) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then
        (global.set $key_len (i32.const 0))
        (return (i32.const 0))
      )
    )
    (local.set $extracted (call $extract_field
      (i32.const 3000500) (local.get $res_len)
      (i32.const 10390) (i32.const 7)
      (i32.const 3000000) (i32.const 120)))

    ;; Only consider token valid if at least 10 chars (e.g. ghp_... or github_pat_...)
    (if (i32.ge_u (local.get $extracted) (i32.const 10))
      (then
        (global.set $key_len (local.get $extracted))
        (return (local.get $extracted))
      )
    )
    (global.set $key_len (i32.const 0))
    (i32.const 0)
  )

  ;; ── append_auth ──────────────────────────────────────────────────────────
  ;; Only injects Authorization header if a valid token (>= 10 chars) is present.
  ;; Public repositories execute cleanly without Authorization header.
  (func $append_auth (param $p i32) (result i32)
    (if (i32.ge_u (global.get $key_len) (i32.const 10))
      (then
        (local.set $p (call $copy_mem
          (i32.const 13126) (local.get $p)
          (i32.const 25)))
        (local.set $p (call $copy_mem
          (i32.const 3000000) (local.get $p) (global.get $key_len)))
        (i32.store8 (local.get $p) (i32.const 34))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
      )
    )
    (call $copy_mem
      (i32.const 13167) (local.get $p)
      (i32.const 21))
  )

  ;; ══════════════════════════════════════════════════════════════════════════
  ;; MAIN ENTRYPOINT
  ;; ══════════════════════════════════════════════════════════════════════════
  (func (export "github_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $p        i32)
    (local $req_len  i32)
    (local $act_len  i32)
    (local $repo_len_local i32)
    (local $q_len    i32)
    (local $t_len    i32)
    (local $tok_len  i32)
    (local $i        i32)
    (local $ch       i32)
    (local $slash_pos i32)
    (local $repo_start i32)

    (global.set $phase    (i32.const 0))
    (global.set $key_len  (i32.const 0))
    (global.set $repo_len (i32.const 0))

    ;; Empty input → help
    (if (i32.eqz (local.get $in_len))
      (then
        (drop (call $copy_mem (i32.const 13283) (i32.const 1024) (i32.const 535)))
        (return (i32.const 535))
      )
    )

    ;; Copy lowercased input to 50000 for NLP inspection (up to 4000 bytes)
    (local.set $p (local.get $in_len))
    (if (i32.gt_u (local.get $p) (i32.const 4000))
      (then (local.set $p (i32.const 4000)))
    )
    (call $to_lower (local.get $in_ptr) (i32.const 50000) (local.get $p))

    ;; ── 1. Extract action: check "operation":" first, then "action":" ────────
    (local.set $act_len (call $extract_field
      (local.get $in_ptr) (local.get $in_len)
      (i32.const 10248) (i32.const 11)
      (i32.const 200000) (i32.const 20)))

    (if (i32.eqz (local.get $act_len))
      (then
        (local.set $act_len (call $extract_field
          (local.get $in_ptr) (local.get $in_len)
          (i32.const 10275) (i32.const 8)
          (i32.const 200000) (i32.const 20)))
      )
    )


    ;; ── 1b. Normalize "stats" → "repo_info" (stats is the LLM-facing action name in v1.2.3+) ──
    ;; The device LLM sees "stats" in validIntents, which it correctly uses only for star/fork counts.
    ;; WASM normalizes it to "repo_info" so the rest of the pipeline stays unchanged.
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const 10072) (i32.const 5))
      (then
        (drop (call $copy_mem (i32.const 10047) (i32.const 200000) (i32.const 9)))
        (local.set $act_len (i32.const 9))
      )
    )
    ;; ── 2. Extract repo from "repo":" ───────────────────────────────────────
    (local.set $repo_len_local (call $extract_field
      (local.get $in_ptr) (local.get $in_len)
      (i32.const 10299) (i32.const 6)
      (i32.const 210000) (i32.const 80)))
    (global.set $repo_len (local.get $repo_len_local))

    ;; ── 3. Extract query from "query":" ─────────────────────────────────────
    (local.set $q_len (call $extract_field
      (local.get $in_ptr) (local.get $in_len)
      (i32.const 10321) (i32.const 7)
      (i32.const 220000) (i32.const 100)))

    ;; ── 4. Extract title from "title":" ─────────────────────────────────────
    (local.set $t_len (call $extract_field
      (local.get $in_ptr) (local.get $in_len)
      (i32.const 10344) (i32.const 7)
      (i32.const 230000) (i32.const 150)))

    ;; ── 5. Extract token from "token":" or direct ghp_/github_pat_ ──────────
    (local.set $tok_len (call $extract_field
      (local.get $in_ptr) (local.get $in_len)
      (i32.const 10367) (i32.const 7)
      (i32.const 240000) (i32.const 120)))

    (if (i32.eqz (local.get $tok_len))
      (then
        (local.set $p (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 10437) (i32.const 4)))
        (if (i32.lt_s (local.get $p) (i32.const 0))
          (then
            (local.set $p (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 10457) (i32.const 11)))
          )
        )
        (if (i32.ge_s (local.get $p) (i32.const 0))
          (then
            (local.set $i (i32.const 0))
            (loop $scan_raw_tok
              (if (i32.and
                    (i32.lt_u (i32.add (local.get $p) (local.get $i)) (local.get $in_len))
                    (i32.lt_u (local.get $i) (i32.const 120)))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $in_ptr) (i32.add (local.get $p) (local.get $i)))))
                  (if (i32.and
                        (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                        (i32.and (i32.ne (local.get $ch) (i32.const 125)) (i32.and (i32.ne (local.get $ch) (i32.const 10)) (i32.ne (local.get $ch) (i32.const 13)))))
                    (then
                      (i32.store8 (i32.add (i32.const 240000) (local.get $i)) (local.get $ch))
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $scan_raw_tok)
                    )
                  )
                )
              )
            )
            (local.set $tok_len (local.get $i))
            (drop (call $copy_mem (i32.const 10206) (i32.const 200000) (i32.const 6)))
            (local.set $act_len (i32.const 6))
          )
        )
      )
    )

    ;; ── 6. Fallback owner/repo extraction from text if repo_len == 0 ────────
    (if (i32.eqz (global.get $repo_len))
      (then
        (local.set $i (i32.const 2))
        (local.set $slash_pos (i32.const -1))
        (loop $find_slash
          (if (i32.lt_u (local.get $i) (local.get $in_len))
            (then
              (if (i32.eq (i32.load8_u (i32.add (i32.const 50000) (local.get $i))) (i32.const 47))
                (then (local.set $slash_pos (local.get $i)))
                (else
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $find_slash)
                )
              )
            )
          )
        )
        (if (i32.gt_s (local.get $slash_pos) (i32.const 0))
          (then
            (local.set $repo_start (local.get $slash_pos))
            (loop $back_owner
              (if (i32.gt_u (local.get $repo_start) (i32.const 0))
                (then
                  (local.set $ch (i32.load8_u (i32.add (i32.const 50000) (i32.sub (local.get $repo_start) (i32.const 1)))))
                  (if (i32.and
                        (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                        (i32.and (i32.ne (local.get $ch) (i32.const 58)) (i32.ne (local.get $ch) (i32.const 47))))
                    (then
                      (local.set $repo_start (i32.sub (local.get $repo_start) (i32.const 1)))
                      (br $back_owner)
                    )
                  )
                )
              )
            )
            (local.set $i (i32.const 0))
            (loop $cp_repo_raw
              (if (i32.and
                    (i32.lt_u (i32.add (local.get $repo_start) (local.get $i)) (local.get $in_len))
                    (i32.lt_u (local.get $i) (i32.const 80)))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $in_ptr) (i32.add (local.get $repo_start) (local.get $i)))))
                  (if (i32.and
                        (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                        (i32.and (i32.ne (local.get $ch) (i32.const 10)) (i32.ne (local.get $ch) (i32.const 13))))
                    (then
                      (i32.store8 (i32.add (i32.const 210000) (local.get $i)) (local.get $ch))
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $cp_repo_raw)
                    )
                  )
                )
              )
            )
            (if (i32.gt_u (local.get $i) (i32.const 2))
              (then (global.set $repo_len (local.get $i)))
            )
          )
        )
      )
    )

    ;; ── 6b. Promotion: override repo_info to specific action if keywords present ──
    ;; Searches BOTH the full lowercased input (buf 50000) AND the extracted query (buf 220000).
    ;; This handles the case where the device LLM chose repo_info but the user's query field
    ;; (e.g. "cual es el readme de chattree") contains the real intent keyword.
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const 10047) (i32.const 9))
      (then
        ;; Check readme / docs — in JSON body (50000) OR in extracted query (220000)
        (if (i32.or
              ;; Search in full lowercased JSON input
              (i32.or
                (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10694) (i32.const 6)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10716) (i32.const 4)) (i32.const 0))
                  )
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10736) (i32.const 3)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10755) (i32.const 3)) (i32.const 0))
                  )
                )
                (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10797) (i32.const 6)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10819) (i32.const 6)) (i32.const 0))
                  )
                  (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10841) (i32.const 8)) (i32.const 0))
                )
              )
              ;; Also search in extracted query field (buf 220000) — covers case where LLM sent repo_info
              ;; but included the user's original text in the "query" field
              (i32.or
                (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 10694) (i32.const 6)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 10716) (i32.const 4)) (i32.const 0))
                  )
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 10736) (i32.const 3)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 10755) (i32.const 3)) (i32.const 0))
                  )
                )
                (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 10797) (i32.const 6)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 10819) (i32.const 6)) (i32.const 0))
                  )
                  (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 10841) (i32.const 8)) (i32.const 0))
                )
              )
            )
          (then
            (drop (call $copy_mem (i32.const 10134) (i32.const 200000) (i32.const 6)))
            (local.set $act_len (i32.const 6))
          )
        )
        ;; Check issues — in JSON body OR in extracted query
        (if (i32.eq (local.get $act_len) (i32.const 9))
          (then
            (if (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10951) (i32.const 5)) (i32.const 0))
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11083) (i32.const 3)) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11038) (i32.const 8)) (i32.const 0))))
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 10951) (i32.const 5)) (i32.const 0))
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 11083) (i32.const 3)) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 11038) (i32.const 8)) (i32.const 0)))))
              (then
                (drop (call $copy_mem (i32.const 10093) (i32.const 200000) (i32.const 6)))
                (local.set $act_len (i32.const 6))
              )
            )
          )
        )
        ;; Check prs — in JSON body OR in extracted query
        (if (i32.eq (local.get $act_len) (i32.const 9))
          (then
            (if (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11102) (i32.const 3)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11121) (i32.const 4)) (i32.const 0)))
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 11102) (i32.const 3)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 11121) (i32.const 4)) (i32.const 0))))
              (then
                (drop (call $copy_mem (i32.const 10115) (i32.const 200000) (i32.const 3)))
                (local.set $act_len (i32.const 3))
              )
            )
          )
        )
        ;; Check search — in JSON body OR in extracted query
        (if (i32.eq (local.get $act_len) (i32.const 9))
          (then
            (if (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10865) (i32.const 6)) (i32.const 0))
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10887) (i32.const 5)) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10908) (i32.const 6)) (i32.const 0))))
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 10865) (i32.const 6)) (i32.const 0))
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 10887) (i32.const 5)) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 10908) (i32.const 6)) (i32.const 0)))))
              (then
                (drop (call $copy_mem (i32.const 10156) (i32.const 200000) (i32.const 6)))
                (local.set $act_len (i32.const 6))
              )
            )
          )
        )
      )
    )

    ;; ── 6c. FINAL SAFETY NET: if action is still repo_info and no explicit stats keywords
    ;; (estrellas/forks/stars/cuantas/cuantos) found anywhere in input or query,
    ;; promote to readme. This covers the case where the device LLM chose repo_info
    ;; without providing a query field — e.g. user asked "explain the chattree repo".
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const 10047) (i32.const 9))
      (then
        (if (i32.eqz
              (i32.or
                ;; Check in full lowercased JSON
                (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11185) (i32.const 8)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11209) (i32.const 5)) (i32.const 0))
                  )
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11230) (i32.const 4)) (i32.const 0))
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11250) (i32.const 7)) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11273) (i32.const 7)) (i32.const 0))
                    )
                  )
                )
                ;; Also check in extracted query
                (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 11185) (i32.const 8)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 11209) (i32.const 5)) (i32.const 0))
                  )
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 11230) (i32.const 4)) (i32.const 0))
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 11250) (i32.const 7)) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const 11273) (i32.const 7)) (i32.const 0))
                    )
                  )
                )
              )
            )
          (then
            ;; No explicit stats keywords → user likely wants the README/documentation
            (drop (call $copy_mem (i32.const 10134) (i32.const 200000) (i32.const 6)))
            (local.set $act_len (i32.const 6))
          )
        )
      )
    )

    ;; ── 7. NATURAL LANGUAGE FALLBACK: detect action from raw text if act_len == 0
    (if (i32.eqz (local.get $act_len))
      (then
        ;; Check config
        (if (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11163) (i32.const 6)) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 10206) (i32.const 200000) (i32.const 6)))
            (local.set $act_len (i32.const 6))
          )
        )
        ;; Check profile / user info
        (if (i32.eqz (local.get $act_len))
          (then
            (if (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10603) (i32.const 9)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10628) (i32.const 6)) (i32.const 0)))
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10650) (i32.const 6)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10672) (i32.const 6)) (i32.const 0))))
              (then
                (drop (call $copy_mem (i32.const 10000) (i32.const 200000) (i32.const 7)))
                (local.set $act_len (i32.const 7))
              )
            )
          )
        )
        ;; Check user repos
        (if (i32.eqz (local.get $act_len))
          (then
            (if (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10484) (i32.const 8)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10508) (i32.const 8)) (i32.const 0)))
                  (i32.or
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10532) (i32.const 8)) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10556) (i32.const 10)) (i32.const 0)))
                    (i32.and
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10582) (i32.const 5)) (i32.const 0))
                      (i32.eqz (global.get $repo_len)))))
              (then
                (drop (call $copy_mem (i32.const 10023) (i32.const 200000) (i32.const 8)))
                (local.set $act_len (i32.const 8))
              )
            )
          )
        )
        ;; Check readme / explanation
        (if (i32.eqz (local.get $act_len))
          (then
            (if (i32.or
                  (i32.or
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10694) (i32.const 6)) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10716) (i32.const 4)) (i32.const 0))
                    )
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10736) (i32.const 3)) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10755) (i32.const 3)) (i32.const 0))
                    )
                  )
                  (i32.or
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10797) (i32.const 6)) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10819) (i32.const 6)) (i32.const 0))
                    )
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10841) (i32.const 8)) (i32.const 0))
                  )
                )
              (then
                (drop (call $copy_mem (i32.const 10134) (i32.const 200000) (i32.const 6)))
                (local.set $act_len (i32.const 6))
              )
            )
          )
        )
        ;; Check search
        (if (i32.eqz (local.get $act_len))
          (then
            (if (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10865) (i32.const 6)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10887) (i32.const 5)) (i32.const 0)))
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10908) (i32.const 6)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10930) (i32.const 5)) (i32.const 0))))
              (then
                (drop (call $copy_mem (i32.const 10156) (i32.const 200000) (i32.const 6)))
                (local.set $act_len (i32.const 6))
              )
            )
          )
        )
        ;; Check create issue
        (if (i32.eqz (local.get $act_len))
          (then
            (if (i32.and
                  (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10951) (i32.const 5)) (i32.const 0))
                  (i32.or
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10972) (i32.const 5)) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10993) (i32.const 5)) (i32.const 0)))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11014) (i32.const 8)) (i32.const 0))))
              (then
                (drop (call $copy_mem (i32.const 10178) (i32.const 200000) (i32.const 12)))
                (local.set $act_len (i32.const 12))
              )
            )
          )
        )
        ;; Check list issues
        (if (i32.eqz (local.get $act_len))
          (then
            (if (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 10951) (i32.const 5)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11038) (i32.const 8)) (i32.const 0)))
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11062) (i32.const 5)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11083) (i32.const 3)) (i32.const 0))))
              (then
                (drop (call $copy_mem (i32.const 10093) (i32.const 200000) (i32.const 6)))
                (local.set $act_len (i32.const 6))
              )
            )
          )
        )
        ;; Check pull requests
        (if (i32.eqz (local.get $act_len))
          (then
            (if (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11102) (i32.const 3)) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11121) (i32.const 4)) (i32.const 0)))
                  (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const 11141) (i32.const 6)) (i32.const 0)))
              (then
                (drop (call $copy_mem (i32.const 10115) (i32.const 200000) (i32.const 3)))
                (local.set $act_len (i32.const 3))
              )
            )
          )
        )
        ;; If repo specified without action, default to repo_info
        (if (i32.and (i32.eqz (local.get $act_len)) (i32.gt_u (global.get $repo_len) (i32.const 0)))
          (then
            (drop (call $copy_mem (i32.const 10047) (i32.const 200000) (i32.const 9)))
            (local.set $act_len (i32.const 9))
          )
        )
      )
    )

    ;; ── Still no action extracted → help ─────────────────────────────────────
    (if (i32.eqz (local.get $act_len))
      (then
        (drop (call $copy_mem (i32.const 13283) (i32.const 1024) (i32.const 535)))
        (return (i32.const 535))
      )
    )

    ;; ── Load stored API key ──────────────────────────────────────────────────
    (drop (call $load_api_key))

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: config
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const 10206) (i32.const 6))
      (then
        (if (i32.gt_u (local.get $tok_len) (i32.const 4))
          (then
            (local.set $p (call $copy_mem (i32.const 11503) (i32.const 100000) (i32.const 71)))
            (local.set $p (call $copy_mem (i32.const 240000) (local.get $p) (local.get $tok_len)))
            (local.set $p (call $copy_mem (i32.const 11590) (local.get $p) (i32.const 3)))
            (drop (call $host_call (i32.const 100000) (i32.sub (local.get $p) (i32.const 100000)) (i32.const 3000500) (i32.const 1024)))
            (drop (call $copy_mem (i32.const 13834) (i32.const 1024) (i32.const 111)))
            (return (i32.const 111))
          )
          (else
            (drop (call $copy_mem (i32.const 13961) (i32.const 1024) (i32.const 185)))
            (return (i32.const 185))
          )
        )
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: help
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const 10228) (i32.const 4))
      (then
        (drop (call $copy_mem (i32.const 13283) (i32.const 1024) (i32.const 535)))
        (return (i32.const 535))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: profile
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const 10000) (i32.const 7))
      (then
        (if (i32.lt_u (global.get $key_len) (i32.const 10))
          (then
            (drop (call $copy_mem (i32.const 13961) (i32.const 1024) (i32.const 185)))
            (return (i32.const 185))
          )
        )
        (local.set $p (call $copy_mem (i32.const 11609) (i32.const 100000) (i32.const 193)))
        (local.set $p (call $append_auth (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 1))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
        (return (i32.const 0))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: my_repos
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const 10023) (i32.const 8))
      (then
        (if (i32.lt_u (global.get $key_len) (i32.const 10))
          (then
            (drop (call $copy_mem (i32.const 13961) (i32.const 1024) (i32.const 185)))
            (return (i32.const 185))
          )
        )
        (local.set $p (call $copy_mem (i32.const 11818) (i32.const 100000) (i32.const 223)))
        (local.set $p (call $append_auth (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 5))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
        (return (i32.const 0))
      )
    )

    ;; ── Actions below require repo ───────────────────────────────────────────
    (if (i32.eqz (global.get $repo_len))
      (then
        (drop (call $copy_mem (i32.const 13283) (i32.const 1024) (i32.const 535)))
        (return (i32.const 535))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: issues
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const 10093) (i32.const 6))
      (then
        (local.set $p (call $copy_mem (i32.const 12057) (i32.const 100000) (i32.const 91)))
        (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const 12164) (local.get $p) (i32.const 133)))
        (local.set $p (call $append_auth (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 2))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
        (return (i32.const 0))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: prs
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const 10115) (i32.const 3))
      (then
        (local.set $p (call $copy_mem (i32.const 12057) (i32.const 100000) (i32.const 91)))
        (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const 12313) (local.get $p) (i32.const 132)))
        (local.set $p (call $append_auth (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 3))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
        (return (i32.const 0))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: readme
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const 10134) (i32.const 6))
      (then
        (local.set $p (call $copy_mem (i32.const 12057) (i32.const 100000) (i32.const 91)))
        (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const 12581) (local.get $p) (i32.const 110)))
        (local.set $p (call $append_auth (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 6))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
        (return (i32.const 0))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: search
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const 10156) (i32.const 6))
      (then
        (local.set $p (i32.const 0))
        (loop $enc_q
          (if (i32.lt_u (local.get $p) (local.get $q_len))
            (then
              (if (i32.eq (i32.load8_u (i32.add (i32.const 220000) (local.get $p))) (i32.const 32))
                (then (i32.store8 (i32.add (i32.const 220000) (local.get $p)) (i32.const 43)))
              )
              (local.set $p (i32.add (local.get $p) (i32.const 1)))
              (br $enc_q)
            )
          )
        )
        (local.set $p (call $copy_mem (i32.const 12707) (i32.const 100000) (i32.const 99)))
        (local.set $p (call $copy_mem (i32.const 220000) (local.get $p) (local.get $q_len)))
        (local.set $p (call $copy_mem (i32.const 12822) (local.get $p) (i32.const 6)))
        (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const 12844) (local.get $p) (i32.const 104)))
        (local.set $p (call $append_auth (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 7))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
        (return (i32.const 0))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: create_issue
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const 10178) (i32.const 12))
      (then
        (if (i32.lt_u (global.get $key_len) (i32.const 10))
          (then
            (drop (call $copy_mem (i32.const 15367) (i32.const 1024) (i32.const 118)))
            (return (i32.const 118))
          )
        )
        (if (i32.eqz (local.get $t_len))
          (then
            ;; "Nuevo Issue" default
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
        (local.set $p (call $copy_mem (i32.const 12057) (i32.const 100000) (i32.const 91)))
        (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const 12964) (local.get $p) (i32.const 146)))
        (local.set $p (call $copy_mem (i32.const 13126) (local.get $p) (i32.const 25)))
        (local.set $p (call $copy_mem (i32.const 3000000) (local.get $p) (global.get $key_len)))
        (i32.store8 (local.get $p) (i32.const 34))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (local.set $p (call $copy_mem (i32.const 13204) (local.get $p) (i32.const 23)))
        (local.set $p (call $copy_mem (i32.const 230000) (local.get $p) (local.get $t_len)))
        (local.set $p (call $copy_mem (i32.const 13243) (local.get $p) (i32.const 24)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 8))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
        (return (i32.const 0))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: repo_info (default)
    ;; ════════════════════════════════════════════════════════════════════════
    (local.set $p (call $copy_mem (i32.const 12057) (i32.const 100000) (i32.const 91)))
    (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
    (local.set $p (call $copy_mem (i32.const 12461) (local.get $p) (i32.const 104)))
    (local.set $p (call $append_auth (local.get $p)))
    (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
    (global.set $phase (i32.const 4))
    (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
    (i32.const 0)
  )

  ;; ══════════════════════════════════════════════════════════════════════════
  ;; RESUME
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

    ;; 401 Unauthorized
    (if (i32.ge_s (call $find_substring
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 11360) (i32.const 16))
         (i32.const 0))
      (then
        (if (i32.ge_u (global.get $key_len) (i32.const 10))
          (then
            (drop (call $copy_mem (i32.const 15501) (i32.const 1024) (i32.const 148)))
            (return (i32.const 148))
          )
          (else
            (drop (call $copy_mem (i32.const 15665) (i32.const 1024) (i32.const 169)))
            (return (i32.const 169))
          )
        )
      )
    )

    ;; 404 Not Found
    (if (i32.ge_s (call $find_substring
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 11392) (i32.const 16))
         (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 15850) (i32.const 1024) (i32.const 150)))
        (return (i32.const 150))
      )
    )

    ;; 200 or 201 check
    (if (i32.and
          (i32.lt_s (call $find_substring
            (local.get $res_ptr) (local.get $res_len)
            (i32.const 11296) (i32.const 16))
            (i32.const 0))
          (i32.lt_s (call $find_substring
            (local.get $res_ptr) (local.get $res_len)
            (i32.const 11328) (i32.const 16))
            (i32.const 0)))
      (then
        (drop (call $copy_mem (i32.const 16016) (i32.const 1024) (i32.const 99)))
        (return (i32.const 99))
      )
    )

    (local.set $body_idx (call $find_substring
      (local.get $res_ptr) (local.get $res_len)
      (i32.const 10413) (i32.const 8)))

    ;; ── Phase 1: Profile ─────────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        (local.set $out (call $copy_mem (i32.const 14162) (i32.const 1024) (i32.const 59)))
        (local.set $extracted (call $extract_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 16131) (i32.const 5)
          (local.get $out) (i32.const 40)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted)))
        (local.set $out (call $copy_mem (i32.const 14237) (local.get $out) (i32.const 17)))
        (local.set $extracted (call $extract_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 16152) (i32.const 4)
          (local.get $out) (i32.const 60)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted)))
        (local.set $out (call $copy_mem (i32.const 14270) (local.get $out) (i32.const 33)))
        (local.set $extracted (call $extract_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 16172) (i32.const 12)
          (local.get $out) (i32.const 10)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted)))
        (local.set $out (call $copy_mem (i32.const 14319) (local.get $out) (i32.const 46)))
        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    ;; ── Phase 5: User Repos ──────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 5))
      (then
        (local.set $out (call $copy_mem (i32.const 14381) (i32.const 1024) (i32.const 48)))
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
                (i32.const 16200) (i32.const 9)))
              (if (i32.ge_s (local.get $pos) (i32.const 0))
                (then
                  (local.set $p (i32.add (local.get $p) (local.get $pos)))
                  (local.set $rem_len (i32.sub (i32.add (local.get $res_ptr) (local.get $res_len)) (local.get $p)))
                  (local.set $out (call $copy_mem (i32.const 14647) (local.get $out) (i32.const 6)))
                  (local.set $extracted (call $extract_field
                    (local.get $p) (local.get $rem_len)
                    (i32.const 16200) (i32.const 9)
                    (local.get $out) (i32.const 80)))
                  (local.set $out (i32.add (local.get $out) (local.get $extracted)))
                  (i32.store8 (local.get $out) (i32.const 42))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (i32.store8 (local.get $out) (i32.const 42))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $p (i32.add (local.get $p) (i32.add (i32.const 9) (local.get $extracted))))
                  (local.set $rem_len (i32.sub (i32.add (local.get $res_ptr) (local.get $res_len)) (local.get $p)))
                  (local.set $out (call $copy_mem (i32.const 14669) (local.get $out) (i32.const 6)))
                  (local.set $extracted (call $extract_field
                    (local.get $p) (local.get $rem_len)
                    (i32.const 16252) (i32.const 16)
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
            (drop (call $copy_mem (i32.const 14445) (i32.const 1024) (i32.const 105)))
            (return (i32.const 105))
          )
          (else
            (local.set $out (call $copy_mem (i32.const 14566) (local.get $out) (i32.const 65)))
            (return (i32.sub (local.get $out) (i32.const 1024)))
          )
        )
      )
    )

    ;; ── Phase 4: Repo Info ───────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 4))
      (then
        (local.set $out (call $copy_mem (i32.const 14691) (i32.const 1024) (i32.const 20)))
        (local.set $extracted (call $extract_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 16200) (i32.const 9)
          (local.get $out) (i32.const 80)))
        (if (i32.gt_u (local.get $extracted) (i32.const 0))
          (then (local.set $out (i32.add (local.get $out) (local.get $extracted))))
          (else (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len))))
        )
        (i32.store8 (local.get $out) (i32.const 42)) ;; *
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (i32.store8 (local.get $out) (i32.const 42)) ;; *
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (i32.store8 (local.get $out) (i32.const 10)) ;; 

        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (i32.store8 (local.get $out) (i32.const 10)) ;; 

        (local.set $out (i32.add (local.get $out) (i32.const 1)))

        ;; Extract description
        (local.set $extracted (call $extract_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 16225) (i32.const 11)
          (local.get $out) (i32.const 300)))
        (if (i32.gt_u (local.get $extracted) (i32.const 0))
          (then
            (local.set $out (i32.add (local.get $out) (local.get $extracted)))
            (i32.store8 (local.get $out) (i32.const 10))
            (local.set $out (i32.add (local.get $out) (i32.const 1)))
            (i32.store8 (local.get $out) (i32.const 10))
            (local.set $out (i32.add (local.get $out) (i32.const 1)))
          )
        )

        ;; Stars
        (local.set $out (call $copy_mem (i32.const 14727) (local.get $out) (i32.const 19)))
        (local.set $extracted (call $extract_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 16252) (i32.const 16)
          (local.get $out) (i32.const 15)))
        (if (i32.gt_u (local.get $extracted) (i32.const 0))
          (then (local.set $out (i32.add (local.get $out) (local.get $extracted))))
          (else
            (i32.store8 (local.get $out) (i32.const 48))
            (local.set $out (i32.add (local.get $out) (i32.const 1)))
          )
        )

        ;; Forks
        (local.set $out (call $copy_mem (i32.const 14762) (local.get $out) (i32.const 19)))
        (local.set $extracted (call $extract_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const 16284) (i32.const 11)
          (local.get $out) (i32.const 15)))
        (if (i32.gt_u (local.get $extracted) (i32.const 0))
          (then (local.set $out (i32.add (local.get $out) (local.get $extracted))))
          (else
            (i32.store8 (local.get $out) (i32.const 48))
            (local.set $out (i32.add (local.get $out) (i32.const 1)))
          )
        )

        ;; Link: https://github.com/{repo}
        (local.set $out (call $copy_mem (i32.const 14797) (local.get $out) (i32.const 18)))
        (local.set $out (call $copy_mem (i32.const 14831) (local.get $out) (i32.const 19)))
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))

        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    ;; ── Phase 2 & 3: Issues / PRs ───────────────────────────────────────────
    (if (i32.or (i32.eq (global.get $phase) (i32.const 2)) (i32.eq (global.get $phase) (i32.const 3)))
      (then
        (if (i32.eq (global.get $phase) (i32.const 2))
          (then (local.set $out (call $copy_mem (i32.const 14866) (i32.const 1024) (i32.const 27))))
          (else (local.set $out (call $copy_mem (i32.const 14909) (i32.const 1024) (i32.const 34))))
        )
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const 14959) (local.get $out) (i32.const 5)))
        (local.set $p (local.get $res_ptr))
        (local.set $count (i32.const 0))
        (loop $find_issues
          (if (i32.and
                (i32.lt_u (local.get $p) (i32.add (local.get $res_ptr) (local.get $res_len)))
                (i32.lt_u (local.get $count) (i32.const 5)))
            (then
              (local.set $rem_len (i32.sub (i32.add (local.get $res_ptr) (local.get $res_len)) (local.get $p)))
              (local.set $pos (call $find_substring
                (local.get $p) (local.get $rem_len)
                (i32.const 10344) (i32.const 7)))
              (if (i32.ge_s (local.get $pos) (i32.const 0))
                (then
                  (local.set $p (i32.add (local.get $p) (local.get $pos)))
                  (local.set $rem_len (i32.sub (i32.add (local.get $res_ptr) (local.get $res_len)) (local.get $p)))
                  (local.set $out (call $copy_mem (i32.const 14647) (local.get $out) (i32.const 6)))
                  (local.set $extracted (call $extract_field
                    (local.get $p) (local.get $rem_len)
                    (i32.const 10344) (i32.const 7)
                    (local.get $out) (i32.const 120)))
                  (local.set $out (i32.add (local.get $out) (local.get $extracted)))
                  (i32.store8 (local.get $out) (i32.const 42))
                  (i32.store8 (i32.add (local.get $out) (i32.const 1)) (i32.const 42))
                  (i32.store8 (i32.add (local.get $out) (i32.const 2)) (i32.const 10))
                  (local.set $out (i32.add (local.get $out) (i32.const 3)))
                  (local.set $p (i32.add (local.get $p) (i32.add (i32.const 7) (local.get $extracted))))
                  (local.set $count (i32.add (local.get $count) (i32.const 1)))
                  (br $find_issues)
                )
              )
            )
          )
        )
        (if (i32.eqz (local.get $count))
          (then
            (local.set $out (call $copy_mem (i32.const 15175) (local.get $out) (i32.const 58)))
          )
        )
        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    ;; ── Phase 6: README ──────────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 6))
      (then
        (local.set $out (call $copy_mem (i32.const 14980) (i32.const 1024) (i32.const 17)))
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const 15013) (local.get $out) (i32.const 5)))
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
                          (if (i32.eq (local.get $p) (i32.const 114))
                            (then
                              (local.set $i (i32.add (local.get $i) (i32.const 2)))
                              (br $cp_readme)
                            )
                          )
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
            (drop (call $copy_mem (i32.const 15034) (i32.const 1024) (i32.const 54)))
            (return (i32.const 54))
          )
        )
      )
    )

    ;; ── Phase 7: Code Search ─────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 7))
      (then
        (local.set $out (call $copy_mem (i32.const 15104) (i32.const 1024) (i32.const 34)))
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const 14959) (local.get $out) (i32.const 5)))
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
                    (i32.const 16311) (i32.const 8)))
                  (if (i32.ge_s (local.get $pos) (i32.const 0))
                    (then
                      (local.set $p (i32.add (local.get $p) (i32.add (local.get $pos) (i32.const 8))))
                      (local.set $out (call $copy_mem (i32.const 15154) (local.get $out) (i32.const 5)))
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
                (drop (call $copy_mem (i32.const 15175) (i32.const 1024) (i32.const 58)))
                (return (i32.const 58))
              )
            )
          )
          (else
            (drop (call $copy_mem (i32.const 15175) (i32.const 1024) (i32.const 58)))
            (return (i32.const 58))
          )
        )
        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    ;; ── Phase 8: Create Issue ────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 8))
      (then
        (local.set $out (call $copy_mem (i32.const 15249) (i32.const 1024) (i32.const 22)))
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const 15287) (local.get $out) (i32.const 41)))
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const 15344) (local.get $out) (i32.const 7)))
        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    (drop (call $copy_mem (i32.const 16016) (i32.const 1024) (i32.const 99)))
    (i32.const 99)
  )
)
