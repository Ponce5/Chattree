import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDir = path.resolve(__dirname, '../plugins/official/github');

function toWatData(str) {
  const buf = Buffer.from(str, 'utf8');
  let res = '';
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b >= 32 && b <= 126 && b !== 34 && b !== 92) {
      res += String.fromCharCode(b);
    } else {
      res += '\\' + b.toString(16).padStart(2, '0');
    }
  }
  return { escaped: res, length: buf.length };
}

let staticPtr = 10000;
const dataEntries = [];

function registerData(name, str) {
  const d = toWatData(str);
  const offset = staticPtr;
  staticPtr += d.length + 16;
  dataEntries.push({ name, offset, length: d.length, escaped: d.escaped });
  return { offset, length: d.length };
}

// ─── Action identifiers ─────────────────────────────────────────────────────
const act_profile      = registerData('act_profile',      'profile');
const act_my_repos     = registerData('act_my_repos',     'my_repos');
const act_repo_info    = registerData('act_repo_info',    'repo_info');
const act_stats        = registerData('act_stats',        'stats');
const act_issues       = registerData('act_issues',       'issues');
const act_prs          = registerData('act_prs',          'prs');
const act_readme       = registerData('act_readme',       'readme');
const act_search       = registerData('act_search',       'search');
const act_create_issue = registerData('act_create_issue', 'create_issue');
const act_config       = registerData('act_config',       'config');
const act_help         = registerData('act_help',         'help');

// ─── JSON field needles ─────────────────────────────────────────────────────
const needle_operation_field = registerData('needle_operation_field', '"operation"');
const needle_action_field    = registerData('needle_action_field',    '"action"');
const needle_repo_field      = registerData('needle_repo_field',      '"repo"');
const needle_query_field     = registerData('needle_query_field',     '"query"');
const needle_title_field     = registerData('needle_title_field',     '"title"');
const needle_token_field     = registerData('needle_token_field',     '"token"');
const needle_val_field       = registerData('needle_val_field',       '"value"');
const needle_body_field      = registerData('needle_body_field',      '"body":"');
const needle_ghp             = registerData('needle_ghp',             'ghp_');
const needle_github_pat      = registerData('needle_github_pat',      'github_pat_');

// ─── Natural language needles (raw text fallback) ───────────────────────────
const nl_que_repo   = registerData('nl_que_repo',   'que repo');
const nl_mis_repo   = registerData('nl_mis_repo',   'mis repo');
const nl_mis_proy   = registerData('nl_mis_proy',   'mis proy');
const nl_tengo_repo = registerData('nl_tengo_repo', 'tengo repo');
const nl_repos      = registerData('nl_repos',      'repos');
const nl_quien_soy  = registerData('nl_quien_soy',  'quien soy');
const nl_perfil     = registerData('nl_perfil',     'perfil');
const nl_cuenta     = registerData('nl_cuenta',     'cuenta');
const nl_status     = registerData('nl_status',     'status');
const nl_readme     = registerData('nl_readme',     'readme');
const nl_leer       = registerData('nl_leer',       'leer');
const nl_lee        = registerData('nl_lee',        'lee');
const nl_doc        = registerData('nl_doc',        'doc');
const nl_mostrar    = registerData('nl_mostrar',    'mostrar');
const nl_explic     = registerData('nl_explic',     'explic');
const nl_de_que     = registerData('nl_de_que',     'de que');
const nl_para_que   = registerData('nl_para_que',   'para que');
const nl_buscar     = registerData('nl_buscar',     'buscar');
const nl_busca      = registerData('nl_busca',      'busca');
const nl_search     = registerData('nl_search',     'search');
const nl_donde      = registerData('nl_donde',      'donde');
const nl_issue      = registerData('nl_issue',      'issue');
const nl_crear      = registerData('nl_crear',      'crear');
const nl_abrir      = registerData('nl_abrir',      'abrir');
const nl_reportar   = registerData('nl_reportar',   'reportar');
const nl_problema   = registerData('nl_problema',   'problema');
const nl_error      = registerData('nl_error',      'error');
const nl_bug        = registerData('nl_bug',        'bug');
const nl_prs        = registerData('nl_prs',        'prs');
const nl_pulls      = registerData('nl_pulls',      'pull');
const nl_cambio     = registerData('nl_cambio',     'cambio');
const nl_config     = registerData('nl_config',     'config');

// ─── Stats-only keywords (when present, keep repo_info) ─────────────────────
const nl_estrellas  = registerData('nl_estrellas',  'estrella');
const nl_stars      = registerData('nl_stars',      'stars');
const nl_forks      = registerData('nl_forks',      'fork');
const nl_cuantas    = registerData('nl_cuantas',    'cuantas');
const nl_cuantos    = registerData('nl_cuantos',    'cuantos');

// ─── Status codes ───────────────────────────────────────────────────────────
const needle_status_200 = registerData('needle_status_200', '"statusCode":200');
const needle_status_201 = registerData('needle_status_201', '"statusCode":201');
const needle_status_401 = registerData('needle_status_401', '"statusCode":401');
const needle_status_404 = registerData('needle_status_404', '"statusCode":404');

// ─── Storage ────────────────────────────────────────────────────────────────
const s_storage_get        = JSON.stringify({ api: 'storage', operation: 'get', payload: { key: 'api_key' } });
const s_storage_set_prefix = '{"api":"storage","operation":"set","payload":{"key":"api_key","value":"';
const s_storage_set_suffix = '"}}';

const d_storage_get        = registerData('storage_get',        s_storage_get);
const d_storage_set_prefix = registerData('storage_set_prefix', s_storage_set_prefix);
const d_storage_set_suffix = registerData('storage_set_suffix', s_storage_set_suffix);

// ─── HTTP endpoints ─────────────────────────────────────────────────────────
const s_http_user_prefix       = '{"api":"network","operation":"http_request","payload":{"url":"https://api.github.com/user","method":"GET","headers":{"User-Agent":"Chattree-GitHub-Plugin","Accept":"application/vnd.github+json"';
const s_http_user_repos_prefix = '{"api":"network","operation":"http_request","payload":{"url":"https://api.github.com/user/repos?per_page=6&sort=updated","method":"GET","headers":{"User-Agent":"Chattree-GitHub-Plugin","Accept":"application/vnd.github+json"';
const s_http_repo_prefix       = '{"api":"network","operation":"http_request","payload":{"url":"https://api.github.com/repos/';
const s_http_issues_suffix     = '/issues?state=open&per_page=5","method":"GET","headers":{"User-Agent":"Chattree-GitHub-Plugin","Accept":"application/vnd.github+json"';
const s_http_prs_suffix        = '/pulls?state=open&per_page=5","method":"GET","headers":{"User-Agent":"Chattree-GitHub-Plugin","Accept":"application/vnd.github+json"';
const s_http_info_suffix       = '","method":"GET","headers":{"User-Agent":"Chattree-GitHub-Plugin","Accept":"application/vnd.github+json"';
const s_http_readme_suffix     = '/readme","method":"GET","headers":{"User-Agent":"Chattree-GitHub-Plugin","Accept":"application/vnd.github.raw"';
const s_http_search_prefix     = '{"api":"network","operation":"http_request","payload":{"url":"https://api.github.com/search/code?q=';
const s_http_search_repo_part  = '+repo:';
const s_http_search_method     = '","method":"GET","headers":{"User-Agent":"Chattree-GitHub-Plugin","Accept":"application/vnd.github+json"';
const s_http_issue_url_suffix  = '/issues","method":"POST","headers":{"User-Agent":"Chattree-GitHub-Plugin","Accept":"application/vnd.github+json","Content-Type":"application/json"';
const s_http_auth_prefix       = ',"Authorization":"Bearer ';
const s_http_suffix            = '},"timeoutMs":15000}}';
const s_http_issue_body_open   = '},"body":"{\\"title\\":\\"';
const s_http_issue_body_close  = '\\"}","timeoutMs":15000}}';

const d_http_user_prefix       = registerData('http_user_prefix',       s_http_user_prefix);
const d_http_user_repos_prefix = registerData('http_user_repos_prefix', s_http_user_repos_prefix);
const d_http_repo_prefix       = registerData('http_repo_prefix',       s_http_repo_prefix);
const d_http_issues_suffix     = registerData('http_issues_suffix',     s_http_issues_suffix);
const d_http_prs_suffix        = registerData('http_prs_suffix',        s_http_prs_suffix);
const d_http_info_suffix       = registerData('http_info_suffix',       s_http_info_suffix);
const d_http_readme_suffix     = registerData('http_readme_suffix',     s_http_readme_suffix);
const d_http_search_prefix     = registerData('http_search_prefix',     s_http_search_prefix);
const d_http_search_repo_part  = registerData('http_search_repo_part',  s_http_search_repo_part);
const d_http_search_method     = registerData('http_search_method',     s_http_search_method);
const d_http_issue_url_suffix  = registerData('http_issue_url_suffix',  s_http_issue_url_suffix);
const d_http_auth_prefix       = registerData('http_auth_prefix',       s_http_auth_prefix);
const d_http_suffix            = registerData('http_suffix',            s_http_suffix);
const d_http_issue_body_open   = registerData('http_issue_body_open',   s_http_issue_body_open);
const d_http_issue_body_close  = registerData('http_issue_body_close',  s_http_issue_body_close);

// ─── Response message strings ───────────────────────────────────────────────
const s_help = `🐙 **GitHub Integration v1.2.4 para Chattree**

Puedes consultarme en lenguaje natural o con comandos:
• "dime qué repos tengo" o "mis repos"
• "quién soy en GitHub" o "mi cuenta"
• "explícame el README de Ponce5/Chattree"
• "issues abiertos en Ponce5/Chattree"
• "pull requests en Ponce5/Chattree"
• "busca la función login en Ponce5/Chattree"
• "crea un issue en Ponce5/Chattree: El botón no funciona"
• "configura mi token: ghp_abc123"

*Genera un Personal Access Token en: https://github.com/settings/tokens*`;

const s_key_saved   = '✅ **Token de GitHub guardado exitosamente.**\n\nYa puedes interactuar con tus repositorios en lenguaje natural.';
const s_key_missing = '⚠️ **No hay un token de GitHub configurado.**\n\nPor favor configúralo diciendo:\n"configura mi token de GitHub: ghp_tutoken"\n\nPuedes generar uno en https://github.com/settings/tokens';

const s_status_ok_prefix = '✅ **Conectado a GitHub exitosamente**\n\n• **Usuario:** @';
const s_status_ok_name   = '\n• **Nombre:** ';
const s_status_ok_repos  = '\n• **Repositorios públicos:** ';
const s_status_ok_suffix = '\n• **Estado:** Conexión autorizada y lista.';

const s_user_repos_header = '📚 **Tus repositorios recientes en GitHub:**\n\n';
const s_user_repos_empty  = 'ℹ️ No se encontraron repositorios en tu cuenta de GitHub.\n\nPuedes crear uno en https://github.com/new';
const s_user_repos_footer = '\n*Tip: Pregúntame sobre cualquier repo, sus issues o su README.*';
const s_bullet_bold       = '• **';
const s_stars_prefix      = ' (⭐ ';

const s_repo_header = '📦 **Repositorio: ';
const s_repo_stars  = '⭐ **Estrellas:** ';
const s_repo_forks  = ' | 🍴 **Forks:** ';
const s_repo_url    = '\n🔗 **Enlace:** ';
const s_github_prefix = 'https://github.com/';

const s_issues_header = '📋 **Issues recientes en ';
const s_prs_header    = '🔀 **Pull Requests recientes en ';
const s_bracket_close = ':**\n\n';

const s_readme_header        = '📄 **README de ';
const s_readme_header_suffix = ':**\n\n';
const s_readme_empty         = 'ℹ️ Este repositorio no tiene un README disponible.';

const s_search_header      = '🔍 **Resultados de búsqueda en ';
const s_search_path_bullet = '\n• ';
const s_search_empty       = 'ℹ️ No se encontraron coincidencias para esa búsqueda.';

const s_issue_created_prefix = '✅ **Issue creado en ';
const s_issue_created_mid    = ':**\n\nPuedes verlo en: https://github.com/';
const s_issue_created_suffix = '/issues';
const s_issue_need_token     = '⚠️ **Se requiere un token de GitHub para crear issues.**\n\nConfigúralo diciendo: "configura mi token: ghp_tutoken"';

const s_auth_error    = '❌ **Error de autenticación con GitHub.**\n\nEl token es inválido o ha expirado. Configura uno nuevo diciendo:\n"configura mi token: ghp_nuevotoken"';
const s_private_repo  = '🔒 **Repositorio privado o acceso restringido.**\n\nEste repositorio requiere autenticación para acceder. Configura tu token diciendo:\n"configura mi token: ghp_tutoken"';
const s_not_found     = '❌ **Repositorio o recurso no encontrado en GitHub.**\n\nVerifica que el nombre `owner/repo` sea correcto y que tu token tenga los permisos necesarios.';
const s_generic_error = '❌ **Error al consultar la API de GitHub.**\n\nPor favor verifica tu conexión o intenta nuevamente.';

const d_help                 = registerData('help',                 s_help);
const d_key_saved            = registerData('key_saved',            s_key_saved);
const d_key_missing          = registerData('key_missing',          s_key_missing);
const d_status_ok_prefix     = registerData('status_ok_prefix',     s_status_ok_prefix);
const d_status_ok_name       = registerData('status_ok_name',       s_status_ok_name);
const d_status_ok_repos      = registerData('status_ok_repos',      s_status_ok_repos);
const d_status_ok_suffix     = registerData('status_ok_suffix',     s_status_ok_suffix);
const d_user_repos_header    = registerData('user_repos_header',    s_user_repos_header);
const d_user_repos_empty     = registerData('user_repos_empty',     s_user_repos_empty);
const d_user_repos_footer    = registerData('user_repos_footer',    s_user_repos_footer);
const d_bullet_bold          = registerData('bullet_bold',          s_bullet_bold);
const d_stars_prefix         = registerData('stars_prefix',         s_stars_prefix);
const d_repo_header          = registerData('repo_header',          s_repo_header);
const d_repo_stars           = registerData('repo_stars',           s_repo_stars);
const d_repo_forks           = registerData('repo_forks',           s_repo_forks);
const d_repo_url             = registerData('repo_url',             s_repo_url);
const d_github_prefix        = registerData('github_prefix',        s_github_prefix);
const d_issues_header        = registerData('issues_header',        s_issues_header);
const d_prs_header           = registerData('prs_header',           s_prs_header);
const d_bracket_close        = registerData('bracket_close',        s_bracket_close);
const d_readme_header        = registerData('readme_header',        s_readme_header);
const d_readme_header_suffix = registerData('readme_header_suffix', s_readme_header_suffix);
const d_readme_empty         = registerData('readme_empty',         s_readme_empty);
const d_search_header        = registerData('search_header',        s_search_header);
const d_search_path_bullet   = registerData('search_path_bullet',   s_search_path_bullet);
const d_search_empty         = registerData('search_empty',         s_search_empty);
const d_issue_created_prefix = registerData('issue_created_prefix', s_issue_created_prefix);
const d_issue_created_mid    = registerData('issue_created_mid',    s_issue_created_mid);
const d_issue_created_suffix = registerData('issue_created_suffix', s_issue_created_suffix);
const d_issue_need_token     = registerData('issue_need_token',     s_issue_need_token);
const d_auth_error           = registerData('auth_error',           s_auth_error);
const d_private_repo         = registerData('private_repo',         s_private_repo);
const d_not_found            = registerData('not_found',            s_not_found);
const d_generic_error        = registerData('generic_error',        s_generic_error);

// ─── Response extraction needles ────────────────────────────────────────────
const needle_login        = registerData('needle_login',        'login');
const needle_name         = registerData('needle_name',         'name');
const needle_public_repos = registerData('needle_public_repos', 'public_repos');
const needle_full_name    = registerData('needle_full_name',    'full_name');
const needle_desc         = registerData('needle_desc',         'description');
const needle_stars        = registerData('needle_stars',        'stargazers_count');
const needle_forks        = registerData('needle_forks',        'forks_count');
const needle_items_path   = registerData('needle_items_path',   '"path":"');

console.log(`Registered ${dataEntries.length} static data segments up to offset ${staticPtr}.`);

const dataSectionWat = dataEntries
  .map(e => `  (data (i32.const ${e.offset}) "${e.escaped}")`)
  .join('\n');

const watContent = `;; Chattree Official GitHub Integration Plugin v1.2.4
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
${dataSectionWat}

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
                        (then (return (local.get $n))) ;; reached closing \"
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
      (i32.const ${d_storage_get.offset}) (i32.const ${d_storage_get.length})
      (i32.const 3000500) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then
        (global.set $key_len (i32.const 0))
        (return (i32.const 0))
      )
    )
    (local.set $extracted (call $extract_field
      (i32.const 3000500) (local.get $res_len)
      (i32.const ${needle_val_field.offset}) (i32.const ${needle_val_field.length})
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
          (i32.const ${d_http_auth_prefix.offset}) (local.get $p)
          (i32.const ${d_http_auth_prefix.length})))
        (local.set $p (call $copy_mem
          (i32.const 3000000) (local.get $p) (global.get $key_len)))
        (i32.store8 (local.get $p) (i32.const 34))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
      )
    )
    (call $copy_mem
      (i32.const ${d_http_suffix.offset}) (local.get $p)
      (i32.const ${d_http_suffix.length}))
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
        (drop (call $copy_mem (i32.const ${d_help.offset}) (i32.const 1024) (i32.const ${d_help.length})))
        (return (i32.const ${d_help.length}))
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
      (i32.const ${needle_operation_field.offset}) (i32.const ${needle_operation_field.length})
      (i32.const 200000) (i32.const 20)))

    (if (i32.eqz (local.get $act_len))
      (then
        (local.set $act_len (call $extract_field
          (local.get $in_ptr) (local.get $in_len)
          (i32.const ${needle_action_field.offset}) (i32.const ${needle_action_field.length})
          (i32.const 200000) (i32.const 20)))
      )
    )


    ;; ── 1b. Normalize "stats" → "repo_info" (stats is the LLM-facing action name in v1.2.3+) ──
    ;; The device LLM sees "stats" in validIntents, which it correctly uses only for star/fork counts.
    ;; WASM normalizes it to "repo_info" so the rest of the pipeline stays unchanged.
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const ${act_stats.offset}) (i32.const ${act_stats.length}))
      (then
        (drop (call $copy_mem (i32.const ${act_repo_info.offset}) (i32.const 200000) (i32.const ${act_repo_info.length})))
        (local.set $act_len (i32.const ${act_repo_info.length}))
      )
    )
    ;; ── 2. Extract repo from "repo":" ───────────────────────────────────────
    (local.set $repo_len_local (call $extract_field
      (local.get $in_ptr) (local.get $in_len)
      (i32.const ${needle_repo_field.offset}) (i32.const ${needle_repo_field.length})
      (i32.const 210000) (i32.const 80)))
    (global.set $repo_len (local.get $repo_len_local))

    ;; ── 3. Extract query from "query":" ─────────────────────────────────────
    (local.set $q_len (call $extract_field
      (local.get $in_ptr) (local.get $in_len)
      (i32.const ${needle_query_field.offset}) (i32.const ${needle_query_field.length})
      (i32.const 220000) (i32.const 100)))

    ;; ── 4. Extract title from "title":" ─────────────────────────────────────
    (local.set $t_len (call $extract_field
      (local.get $in_ptr) (local.get $in_len)
      (i32.const ${needle_title_field.offset}) (i32.const ${needle_title_field.length})
      (i32.const 230000) (i32.const 150)))

    ;; ── 5. Extract token from "token":" or direct ghp_/github_pat_ ──────────
    (local.set $tok_len (call $extract_field
      (local.get $in_ptr) (local.get $in_len)
      (i32.const ${needle_token_field.offset}) (i32.const ${needle_token_field.length})
      (i32.const 240000) (i32.const 120)))

    (if (i32.eqz (local.get $tok_len))
      (then
        (local.set $p (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_ghp.offset}) (i32.const ${needle_ghp.length})))
        (if (i32.lt_s (local.get $p) (i32.const 0))
          (then
            (local.set $p (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_github_pat.offset}) (i32.const ${needle_github_pat.length})))
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
            (drop (call $copy_mem (i32.const ${act_config.offset}) (i32.const 200000) (i32.const ${act_config.length})))
            (local.set $act_len (i32.const ${act_config.length}))
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
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const ${act_repo_info.offset}) (i32.const ${act_repo_info.length}))
      (then
        ;; Check readme / docs — in JSON body (50000) OR in extracted query (220000)
        (if (i32.or
              ;; Search in full lowercased JSON input
              (i32.or
                (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_readme.offset}) (i32.const ${nl_readme.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_leer.offset}) (i32.const ${nl_leer.length})) (i32.const 0))
                  )
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_lee.offset}) (i32.const ${nl_lee.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_doc.offset}) (i32.const ${nl_doc.length})) (i32.const 0))
                  )
                )
                (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_explic.offset}) (i32.const ${nl_explic.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_de_que.offset}) (i32.const ${nl_de_que.length})) (i32.const 0))
                  )
                  (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_para_que.offset}) (i32.const ${nl_para_que.length})) (i32.const 0))
                )
              )
              ;; Also search in extracted query field (buf 220000) — covers case where LLM sent repo_info
              ;; but included the user's original text in the "query" field
              (i32.or
                (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_readme.offset}) (i32.const ${nl_readme.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_leer.offset}) (i32.const ${nl_leer.length})) (i32.const 0))
                  )
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_lee.offset}) (i32.const ${nl_lee.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_doc.offset}) (i32.const ${nl_doc.length})) (i32.const 0))
                  )
                )
                (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_explic.offset}) (i32.const ${nl_explic.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_de_que.offset}) (i32.const ${nl_de_que.length})) (i32.const 0))
                  )
                  (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_para_que.offset}) (i32.const ${nl_para_que.length})) (i32.const 0))
                )
              )
            )
          (then
            (drop (call $copy_mem (i32.const ${act_readme.offset}) (i32.const 200000) (i32.const ${act_readme.length})))
            (local.set $act_len (i32.const ${act_readme.length}))
          )
        )
        ;; Check issues — in JSON body OR in extracted query
        (if (i32.eq (local.get $act_len) (i32.const ${act_repo_info.length}))
          (then
            (if (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_issue.offset}) (i32.const ${nl_issue.length})) (i32.const 0))
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_bug.offset}) (i32.const ${nl_bug.length})) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_problema.offset}) (i32.const ${nl_problema.length})) (i32.const 0))))
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_issue.offset}) (i32.const ${nl_issue.length})) (i32.const 0))
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_bug.offset}) (i32.const ${nl_bug.length})) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_problema.offset}) (i32.const ${nl_problema.length})) (i32.const 0)))))
              (then
                (drop (call $copy_mem (i32.const ${act_issues.offset}) (i32.const 200000) (i32.const ${act_issues.length})))
                (local.set $act_len (i32.const ${act_issues.length}))
              )
            )
          )
        )
        ;; Check prs — in JSON body OR in extracted query
        (if (i32.eq (local.get $act_len) (i32.const ${act_repo_info.length}))
          (then
            (if (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_prs.offset}) (i32.const ${nl_prs.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_pulls.offset}) (i32.const ${nl_pulls.length})) (i32.const 0)))
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_prs.offset}) (i32.const ${nl_prs.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_pulls.offset}) (i32.const ${nl_pulls.length})) (i32.const 0))))
              (then
                (drop (call $copy_mem (i32.const ${act_prs.offset}) (i32.const 200000) (i32.const ${act_prs.length})))
                (local.set $act_len (i32.const ${act_prs.length}))
              )
            )
          )
        )
        ;; Check search — in JSON body OR in extracted query
        (if (i32.eq (local.get $act_len) (i32.const ${act_repo_info.length}))
          (then
            (if (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_buscar.offset}) (i32.const ${nl_buscar.length})) (i32.const 0))
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_busca.offset}) (i32.const ${nl_busca.length})) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_search.offset}) (i32.const ${nl_search.length})) (i32.const 0))))
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_buscar.offset}) (i32.const ${nl_buscar.length})) (i32.const 0))
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_busca.offset}) (i32.const ${nl_busca.length})) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_search.offset}) (i32.const ${nl_search.length})) (i32.const 0)))))
              (then
                (drop (call $copy_mem (i32.const ${act_search.offset}) (i32.const 200000) (i32.const ${act_search.length})))
                (local.set $act_len (i32.const ${act_search.length}))
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
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const ${act_repo_info.offset}) (i32.const ${act_repo_info.length}))
      (then
        (if (i32.eqz
              (i32.or
                ;; Check in full lowercased JSON
                (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_estrellas.offset}) (i32.const ${nl_estrellas.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_stars.offset}) (i32.const ${nl_stars.length})) (i32.const 0))
                  )
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_forks.offset}) (i32.const ${nl_forks.length})) (i32.const 0))
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_cuantas.offset}) (i32.const ${nl_cuantas.length})) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_cuantos.offset}) (i32.const ${nl_cuantos.length})) (i32.const 0))
                    )
                  )
                )
                ;; Also check in extracted query
                (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_estrellas.offset}) (i32.const ${nl_estrellas.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_stars.offset}) (i32.const ${nl_stars.length})) (i32.const 0))
                  )
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_forks.offset}) (i32.const ${nl_forks.length})) (i32.const 0))
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_cuantas.offset}) (i32.const ${nl_cuantas.length})) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 220000) (local.get $q_len) (i32.const ${nl_cuantos.offset}) (i32.const ${nl_cuantos.length})) (i32.const 0))
                    )
                  )
                )
              )
            )
          (then
            ;; No explicit stats keywords → user likely wants the README/documentation
            (drop (call $copy_mem (i32.const ${act_readme.offset}) (i32.const 200000) (i32.const ${act_readme.length})))
            (local.set $act_len (i32.const ${act_readme.length}))
          )
        )
      )
    )

    ;; ── 7. NATURAL LANGUAGE FALLBACK: detect action from raw text if act_len == 0
    (if (i32.eqz (local.get $act_len))
      (then
        ;; Check config
        (if (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_config.offset}) (i32.const ${nl_config.length})) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const ${act_config.offset}) (i32.const 200000) (i32.const ${act_config.length})))
            (local.set $act_len (i32.const ${act_config.length}))
          )
        )
        ;; Check profile / user info
        (if (i32.eqz (local.get $act_len))
          (then
            (if (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_quien_soy.offset}) (i32.const ${nl_quien_soy.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_perfil.offset}) (i32.const ${nl_perfil.length})) (i32.const 0)))
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_cuenta.offset}) (i32.const ${nl_cuenta.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_status.offset}) (i32.const ${nl_status.length})) (i32.const 0))))
              (then
                (drop (call $copy_mem (i32.const ${act_profile.offset}) (i32.const 200000) (i32.const ${act_profile.length})))
                (local.set $act_len (i32.const ${act_profile.length}))
              )
            )
          )
        )
        ;; Check user repos
        (if (i32.eqz (local.get $act_len))
          (then
            (if (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_que_repo.offset}) (i32.const ${nl_que_repo.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_mis_repo.offset}) (i32.const ${nl_mis_repo.length})) (i32.const 0)))
                  (i32.or
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_mis_proy.offset}) (i32.const ${nl_mis_proy.length})) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_tengo_repo.offset}) (i32.const ${nl_tengo_repo.length})) (i32.const 0)))
                    (i32.and
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_repos.offset}) (i32.const ${nl_repos.length})) (i32.const 0))
                      (i32.eqz (global.get $repo_len)))))
              (then
                (drop (call $copy_mem (i32.const ${act_my_repos.offset}) (i32.const 200000) (i32.const ${act_my_repos.length})))
                (local.set $act_len (i32.const ${act_my_repos.length}))
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
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_readme.offset}) (i32.const ${nl_readme.length})) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_leer.offset}) (i32.const ${nl_leer.length})) (i32.const 0))
                    )
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_lee.offset}) (i32.const ${nl_lee.length})) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_doc.offset}) (i32.const ${nl_doc.length})) (i32.const 0))
                    )
                  )
                  (i32.or
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_explic.offset}) (i32.const ${nl_explic.length})) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_de_que.offset}) (i32.const ${nl_de_que.length})) (i32.const 0))
                    )
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_para_que.offset}) (i32.const ${nl_para_que.length})) (i32.const 0))
                  )
                )
              (then
                (drop (call $copy_mem (i32.const ${act_readme.offset}) (i32.const 200000) (i32.const ${act_readme.length})))
                (local.set $act_len (i32.const ${act_readme.length}))
              )
            )
          )
        )
        ;; Check search
        (if (i32.eqz (local.get $act_len))
          (then
            (if (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_buscar.offset}) (i32.const ${nl_buscar.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_busca.offset}) (i32.const ${nl_busca.length})) (i32.const 0)))
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_search.offset}) (i32.const ${nl_search.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_donde.offset}) (i32.const ${nl_donde.length})) (i32.const 0))))
              (then
                (drop (call $copy_mem (i32.const ${act_search.offset}) (i32.const 200000) (i32.const ${act_search.length})))
                (local.set $act_len (i32.const ${act_search.length}))
              )
            )
          )
        )
        ;; Check create issue
        (if (i32.eqz (local.get $act_len))
          (then
            (if (i32.and
                  (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_issue.offset}) (i32.const ${nl_issue.length})) (i32.const 0))
                  (i32.or
                    (i32.or
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_crear.offset}) (i32.const ${nl_crear.length})) (i32.const 0))
                      (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_abrir.offset}) (i32.const ${nl_abrir.length})) (i32.const 0)))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_reportar.offset}) (i32.const ${nl_reportar.length})) (i32.const 0))))
              (then
                (drop (call $copy_mem (i32.const ${act_create_issue.offset}) (i32.const 200000) (i32.const ${act_create_issue.length})))
                (local.set $act_len (i32.const ${act_create_issue.length}))
              )
            )
          )
        )
        ;; Check list issues
        (if (i32.eqz (local.get $act_len))
          (then
            (if (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_issue.offset}) (i32.const ${nl_issue.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_problema.offset}) (i32.const ${nl_problema.length})) (i32.const 0)))
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_error.offset}) (i32.const ${nl_error.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_bug.offset}) (i32.const ${nl_bug.length})) (i32.const 0))))
              (then
                (drop (call $copy_mem (i32.const ${act_issues.offset}) (i32.const 200000) (i32.const ${act_issues.length})))
                (local.set $act_len (i32.const ${act_issues.length}))
              )
            )
          )
        )
        ;; Check pull requests
        (if (i32.eqz (local.get $act_len))
          (then
            (if (i32.or
                  (i32.or
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_prs.offset}) (i32.const ${nl_prs.length})) (i32.const 0))
                    (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_pulls.offset}) (i32.const ${nl_pulls.length})) (i32.const 0)))
                  (i32.ge_s (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${nl_cambio.offset}) (i32.const ${nl_cambio.length})) (i32.const 0)))
              (then
                (drop (call $copy_mem (i32.const ${act_prs.offset}) (i32.const 200000) (i32.const ${act_prs.length})))
                (local.set $act_len (i32.const ${act_prs.length}))
              )
            )
          )
        )
        ;; If repo specified without action, default to repo_info
        (if (i32.and (i32.eqz (local.get $act_len)) (i32.gt_u (global.get $repo_len) (i32.const 0)))
          (then
            (drop (call $copy_mem (i32.const ${act_repo_info.offset}) (i32.const 200000) (i32.const ${act_repo_info.length})))
            (local.set $act_len (i32.const ${act_repo_info.length}))
          )
        )
      )
    )

    ;; ── Still no action extracted → help ─────────────────────────────────────
    (if (i32.eqz (local.get $act_len))
      (then
        (drop (call $copy_mem (i32.const ${d_help.offset}) (i32.const 1024) (i32.const ${d_help.length})))
        (return (i32.const ${d_help.length}))
      )
    )

    ;; ── Load stored API key ──────────────────────────────────────────────────
    (drop (call $load_api_key))

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: config
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const ${act_config.offset}) (i32.const ${act_config.length}))
      (then
        (if (i32.gt_u (local.get $tok_len) (i32.const 4))
          (then
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_prefix.offset}) (i32.const 100000) (i32.const ${d_storage_set_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 240000) (local.get $p) (local.get $tok_len)))
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_suffix.offset}) (local.get $p) (i32.const ${d_storage_set_suffix.length})))
            (drop (call $host_call (i32.const 100000) (i32.sub (local.get $p) (i32.const 100000)) (i32.const 3000500) (i32.const 1024)))
            (drop (call $copy_mem (i32.const ${d_key_saved.offset}) (i32.const 1024) (i32.const ${d_key_saved.length})))
            (return (i32.const ${d_key_saved.length}))
          )
          (else
            (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 1024) (i32.const ${d_key_missing.length})))
            (return (i32.const ${d_key_missing.length}))
          )
        )
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: help
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const ${act_help.offset}) (i32.const ${act_help.length}))
      (then
        (drop (call $copy_mem (i32.const ${d_help.offset}) (i32.const 1024) (i32.const ${d_help.length})))
        (return (i32.const ${d_help.length}))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: profile
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const ${act_profile.offset}) (i32.const ${act_profile.length}))
      (then
        (if (i32.lt_u (global.get $key_len) (i32.const 10))
          (then
            (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 1024) (i32.const ${d_key_missing.length})))
            (return (i32.const ${d_key_missing.length}))
          )
        )
        (local.set $p (call $copy_mem (i32.const ${d_http_user_prefix.offset}) (i32.const 100000) (i32.const ${d_http_user_prefix.length})))
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
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const ${act_my_repos.offset}) (i32.const ${act_my_repos.length}))
      (then
        (if (i32.lt_u (global.get $key_len) (i32.const 10))
          (then
            (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 1024) (i32.const ${d_key_missing.length})))
            (return (i32.const ${d_key_missing.length}))
          )
        )
        (local.set $p (call $copy_mem (i32.const ${d_http_user_repos_prefix.offset}) (i32.const 100000) (i32.const ${d_http_user_repos_prefix.length})))
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
        (drop (call $copy_mem (i32.const ${d_help.offset}) (i32.const 1024) (i32.const ${d_help.length})))
        (return (i32.const ${d_help.length}))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: issues
    ;; ════════════════════════════════════════════════════════════════════════
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const ${act_issues.offset}) (i32.const ${act_issues.length}))
      (then
        (local.set $p (call $copy_mem (i32.const ${d_http_repo_prefix.offset}) (i32.const 100000) (i32.const ${d_http_repo_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_issues_suffix.offset}) (local.get $p) (i32.const ${d_http_issues_suffix.length})))
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
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const ${act_prs.offset}) (i32.const ${act_prs.length}))
      (then
        (local.set $p (call $copy_mem (i32.const ${d_http_repo_prefix.offset}) (i32.const 100000) (i32.const ${d_http_repo_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_prs_suffix.offset}) (local.get $p) (i32.const ${d_http_prs_suffix.length})))
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
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const ${act_readme.offset}) (i32.const ${act_readme.length}))
      (then
        (local.set $p (call $copy_mem (i32.const ${d_http_repo_prefix.offset}) (i32.const 100000) (i32.const ${d_http_repo_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_readme_suffix.offset}) (local.get $p) (i32.const ${d_http_readme_suffix.length})))
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
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const ${act_search.offset}) (i32.const ${act_search.length}))
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
        (local.set $p (call $copy_mem (i32.const ${d_http_search_prefix.offset}) (i32.const 100000) (i32.const ${d_http_search_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 220000) (local.get $p) (local.get $q_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_search_repo_part.offset}) (local.get $p) (i32.const ${d_http_search_repo_part.length})))
        (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_search_method.offset}) (local.get $p) (i32.const ${d_http_search_method.length})))
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
    (if (call $str_eq (i32.const 200000) (local.get $act_len) (i32.const ${act_create_issue.offset}) (i32.const ${act_create_issue.length}))
      (then
        (if (i32.lt_u (global.get $key_len) (i32.const 10))
          (then
            (drop (call $copy_mem (i32.const ${d_issue_need_token.offset}) (i32.const 1024) (i32.const ${d_issue_need_token.length})))
            (return (i32.const ${d_issue_need_token.length}))
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
        (local.set $p (call $copy_mem (i32.const ${d_http_repo_prefix.offset}) (i32.const 100000) (i32.const ${d_http_repo_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_issue_url_suffix.offset}) (local.get $p) (i32.const ${d_http_issue_url_suffix.length})))
        (local.set $p (call $copy_mem (i32.const ${d_http_auth_prefix.offset}) (local.get $p) (i32.const ${d_http_auth_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 3000000) (local.get $p) (global.get $key_len)))
        (i32.store8 (local.get $p) (i32.const 34))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (local.set $p (call $copy_mem (i32.const ${d_http_issue_body_open.offset}) (local.get $p) (i32.const ${d_http_issue_body_open.length})))
        (local.set $p (call $copy_mem (i32.const 230000) (local.get $p) (local.get $t_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_issue_body_close.offset}) (local.get $p) (i32.const ${d_http_issue_body_close.length})))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (global.set $phase (i32.const 8))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 3000000)))
        (return (i32.const 0))
      )
    )

    ;; ════════════════════════════════════════════════════════════════════════
    ;; ACTION: repo_info (default)
    ;; ════════════════════════════════════════════════════════════════════════
    (local.set $p (call $copy_mem (i32.const ${d_http_repo_prefix.offset}) (i32.const 100000) (i32.const ${d_http_repo_prefix.length})))
    (local.set $p (call $copy_mem (i32.const 210000) (local.get $p) (global.get $repo_len)))
    (local.set $p (call $copy_mem (i32.const ${d_http_info_suffix.offset}) (local.get $p) (i32.const ${d_http_info_suffix.length})))
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
          (i32.const ${needle_status_401.offset}) (i32.const ${needle_status_401.length}))
         (i32.const 0))
      (then
        (if (i32.ge_u (global.get $key_len) (i32.const 10))
          (then
            (drop (call $copy_mem (i32.const ${d_auth_error.offset}) (i32.const 1024) (i32.const ${d_auth_error.length})))
            (return (i32.const ${d_auth_error.length}))
          )
          (else
            (drop (call $copy_mem (i32.const ${d_private_repo.offset}) (i32.const 1024) (i32.const ${d_private_repo.length})))
            (return (i32.const ${d_private_repo.length}))
          )
        )
      )
    )

    ;; 404 Not Found
    (if (i32.ge_s (call $find_substring
          (local.get $res_ptr) (local.get $res_len)
          (i32.const ${needle_status_404.offset}) (i32.const ${needle_status_404.length}))
         (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const ${d_not_found.offset}) (i32.const 1024) (i32.const ${d_not_found.length})))
        (return (i32.const ${d_not_found.length}))
      )
    )

    ;; 200 or 201 check
    (if (i32.and
          (i32.lt_s (call $find_substring
            (local.get $res_ptr) (local.get $res_len)
            (i32.const ${needle_status_200.offset}) (i32.const ${needle_status_200.length}))
            (i32.const 0))
          (i32.lt_s (call $find_substring
            (local.get $res_ptr) (local.get $res_len)
            (i32.const ${needle_status_201.offset}) (i32.const ${needle_status_201.length}))
            (i32.const 0)))
      (then
        (drop (call $copy_mem (i32.const ${d_generic_error.offset}) (i32.const 1024) (i32.const ${d_generic_error.length})))
        (return (i32.const ${d_generic_error.length}))
      )
    )

    (local.set $body_idx (call $find_substring
      (local.get $res_ptr) (local.get $res_len)
      (i32.const ${needle_body_field.offset}) (i32.const ${needle_body_field.length})))

    ;; ── Phase 1: Profile ─────────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        (local.set $out (call $copy_mem (i32.const ${d_status_ok_prefix.offset}) (i32.const 1024) (i32.const ${d_status_ok_prefix.length})))
        (local.set $extracted (call $extract_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const ${needle_login.offset}) (i32.const ${needle_login.length})
          (local.get $out) (i32.const 40)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted)))
        (local.set $out (call $copy_mem (i32.const ${d_status_ok_name.offset}) (local.get $out) (i32.const ${d_status_ok_name.length})))
        (local.set $extracted (call $extract_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const ${needle_name.offset}) (i32.const ${needle_name.length})
          (local.get $out) (i32.const 60)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted)))
        (local.set $out (call $copy_mem (i32.const ${d_status_ok_repos.offset}) (local.get $out) (i32.const ${d_status_ok_repos.length})))
        (local.set $extracted (call $extract_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const ${needle_public_repos.offset}) (i32.const ${needle_public_repos.length})
          (local.get $out) (i32.const 10)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted)))
        (local.set $out (call $copy_mem (i32.const ${d_status_ok_suffix.offset}) (local.get $out) (i32.const ${d_status_ok_suffix.length})))
        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    ;; ── Phase 5: User Repos ──────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 5))
      (then
        (local.set $out (call $copy_mem (i32.const ${d_user_repos_header.offset}) (i32.const 1024) (i32.const ${d_user_repos_header.length})))
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
                (i32.const ${needle_full_name.offset}) (i32.const ${needle_full_name.length})))
              (if (i32.ge_s (local.get $pos) (i32.const 0))
                (then
                  (local.set $p (i32.add (local.get $p) (local.get $pos)))
                  (local.set $rem_len (i32.sub (i32.add (local.get $res_ptr) (local.get $res_len)) (local.get $p)))
                  (local.set $out (call $copy_mem (i32.const ${d_bullet_bold.offset}) (local.get $out) (i32.const ${d_bullet_bold.length})))
                  (local.set $extracted (call $extract_field
                    (local.get $p) (local.get $rem_len)
                    (i32.const ${needle_full_name.offset}) (i32.const ${needle_full_name.length})
                    (local.get $out) (i32.const 80)))
                  (local.set $out (i32.add (local.get $out) (local.get $extracted)))
                  (i32.store8 (local.get $out) (i32.const 42))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (i32.store8 (local.get $out) (i32.const 42))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $p (i32.add (local.get $p) (i32.add (i32.const ${needle_full_name.length}) (local.get $extracted))))
                  (local.set $rem_len (i32.sub (i32.add (local.get $res_ptr) (local.get $res_len)) (local.get $p)))
                  (local.set $out (call $copy_mem (i32.const ${d_stars_prefix.offset}) (local.get $out) (i32.const ${d_stars_prefix.length})))
                  (local.set $extracted (call $extract_field
                    (local.get $p) (local.get $rem_len)
                    (i32.const ${needle_stars.offset}) (i32.const ${needle_stars.length})
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
            (drop (call $copy_mem (i32.const ${d_user_repos_empty.offset}) (i32.const 1024) (i32.const ${d_user_repos_empty.length})))
            (return (i32.const ${d_user_repos_empty.length}))
          )
          (else
            (local.set $out (call $copy_mem (i32.const ${d_user_repos_footer.offset}) (local.get $out) (i32.const ${d_user_repos_footer.length})))
            (return (i32.sub (local.get $out) (i32.const 1024)))
          )
        )
      )
    )

    ;; ── Phase 4: Repo Info ───────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 4))
      (then
        (local.set $out (call $copy_mem (i32.const ${d_repo_header.offset}) (i32.const 1024) (i32.const ${d_repo_header.length})))
        (local.set $extracted (call $extract_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const ${needle_full_name.offset}) (i32.const ${needle_full_name.length})
          (local.get $out) (i32.const 80)))
        (if (i32.gt_u (local.get $extracted) (i32.const 0))
          (then (local.set $out (i32.add (local.get $out) (local.get $extracted))))
          (else (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len))))
        )
        (i32.store8 (local.get $out) (i32.const 42)) ;; *
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (i32.store8 (local.get $out) (i32.const 42)) ;; *
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (i32.store8 (local.get $out) (i32.const 10)) ;; \n
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (i32.store8 (local.get $out) (i32.const 10)) ;; \n
        (local.set $out (i32.add (local.get $out) (i32.const 1)))

        ;; Extract description
        (local.set $extracted (call $extract_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const ${needle_desc.offset}) (i32.const ${needle_desc.length})
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
        (local.set $out (call $copy_mem (i32.const ${d_repo_stars.offset}) (local.get $out) (i32.const ${d_repo_stars.length})))
        (local.set $extracted (call $extract_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const ${needle_stars.offset}) (i32.const ${needle_stars.length})
          (local.get $out) (i32.const 15)))
        (if (i32.gt_u (local.get $extracted) (i32.const 0))
          (then (local.set $out (i32.add (local.get $out) (local.get $extracted))))
          (else
            (i32.store8 (local.get $out) (i32.const 48))
            (local.set $out (i32.add (local.get $out) (i32.const 1)))
          )
        )

        ;; Forks
        (local.set $out (call $copy_mem (i32.const ${d_repo_forks.offset}) (local.get $out) (i32.const ${d_repo_forks.length})))
        (local.set $extracted (call $extract_field
          (local.get $res_ptr) (local.get $res_len)
          (i32.const ${needle_forks.offset}) (i32.const ${needle_forks.length})
          (local.get $out) (i32.const 15)))
        (if (i32.gt_u (local.get $extracted) (i32.const 0))
          (then (local.set $out (i32.add (local.get $out) (local.get $extracted))))
          (else
            (i32.store8 (local.get $out) (i32.const 48))
            (local.set $out (i32.add (local.get $out) (i32.const 1)))
          )
        )

        ;; Link: https://github.com/{repo}
        (local.set $out (call $copy_mem (i32.const ${d_repo_url.offset}) (local.get $out) (i32.const ${d_repo_url.length})))
        (local.set $out (call $copy_mem (i32.const ${d_github_prefix.offset}) (local.get $out) (i32.const ${d_github_prefix.length})))
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))

        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    ;; ── Phase 2 & 3: Issues / PRs ───────────────────────────────────────────
    (if (i32.or (i32.eq (global.get $phase) (i32.const 2)) (i32.eq (global.get $phase) (i32.const 3)))
      (then
        (if (i32.eq (global.get $phase) (i32.const 2))
          (then (local.set $out (call $copy_mem (i32.const ${d_issues_header.offset}) (i32.const 1024) (i32.const ${d_issues_header.length}))))
          (else (local.set $out (call $copy_mem (i32.const ${d_prs_header.offset}) (i32.const 1024) (i32.const ${d_prs_header.length}))))
        )
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const ${d_bracket_close.offset}) (local.get $out) (i32.const ${d_bracket_close.length})))
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
                (i32.const ${needle_title_field.offset}) (i32.const ${needle_title_field.length})))
              (if (i32.ge_s (local.get $pos) (i32.const 0))
                (then
                  (local.set $p (i32.add (local.get $p) (local.get $pos)))
                  (local.set $rem_len (i32.sub (i32.add (local.get $res_ptr) (local.get $res_len)) (local.get $p)))
                  (local.set $out (call $copy_mem (i32.const ${d_bullet_bold.offset}) (local.get $out) (i32.const ${d_bullet_bold.length})))
                  (local.set $extracted (call $extract_field
                    (local.get $p) (local.get $rem_len)
                    (i32.const ${needle_title_field.offset}) (i32.const ${needle_title_field.length})
                    (local.get $out) (i32.const 120)))
                  (local.set $out (i32.add (local.get $out) (local.get $extracted)))
                  (i32.store8 (local.get $out) (i32.const 42))
                  (i32.store8 (i32.add (local.get $out) (i32.const 1)) (i32.const 42))
                  (i32.store8 (i32.add (local.get $out) (i32.const 2)) (i32.const 10))
                  (local.set $out (i32.add (local.get $out) (i32.const 3)))
                  (local.set $p (i32.add (local.get $p) (i32.add (i32.const ${needle_title_field.length}) (local.get $extracted))))
                  (local.set $count (i32.add (local.get $count) (i32.const 1)))
                  (br $find_issues)
                )
              )
            )
          )
        )
        (if (i32.eqz (local.get $count))
          (then
            (local.set $out (call $copy_mem (i32.const ${d_search_empty.offset}) (local.get $out) (i32.const ${d_search_empty.length})))
          )
        )
        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    ;; ── Phase 6: README ──────────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 6))
      (then
        (local.set $out (call $copy_mem (i32.const ${d_readme_header.offset}) (i32.const 1024) (i32.const ${d_readme_header.length})))
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const ${d_readme_header_suffix.offset}) (local.get $out) (i32.const ${d_readme_header_suffix.length})))
        (if (i32.ge_s (local.get $body_idx) (i32.const 0))
          (then
            (local.set $val_start (i32.add (i32.add (local.get $res_ptr) (local.get $body_idx)) (i32.const ${needle_body_field.length})))
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
            (drop (call $copy_mem (i32.const ${d_readme_empty.offset}) (i32.const 1024) (i32.const ${d_readme_empty.length})))
            (return (i32.const ${d_readme_empty.length}))
          )
        )
      )
    )

    ;; ── Phase 7: Code Search ─────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 7))
      (then
        (local.set $out (call $copy_mem (i32.const ${d_search_header.offset}) (i32.const 1024) (i32.const ${d_search_header.length})))
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const ${d_bracket_close.offset}) (local.get $out) (i32.const ${d_bracket_close.length})))
        (if (i32.ge_s (local.get $body_idx) (i32.const 0))
          (then
            (local.set $val_start (i32.add (i32.add (local.get $res_ptr) (local.get $body_idx)) (i32.const ${needle_body_field.length})))
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
                    (i32.const ${needle_items_path.offset}) (i32.const ${needle_items_path.length})))
                  (if (i32.ge_s (local.get $pos) (i32.const 0))
                    (then
                      (local.set $p (i32.add (local.get $p) (i32.add (local.get $pos) (i32.const ${needle_items_path.length}))))
                      (local.set $out (call $copy_mem (i32.const ${d_search_path_bullet.offset}) (local.get $out) (i32.const ${d_search_path_bullet.length})))
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
                (drop (call $copy_mem (i32.const ${d_search_empty.offset}) (i32.const 1024) (i32.const ${d_search_empty.length})))
                (return (i32.const ${d_search_empty.length}))
              )
            )
          )
          (else
            (drop (call $copy_mem (i32.const ${d_search_empty.offset}) (i32.const 1024) (i32.const ${d_search_empty.length})))
            (return (i32.const ${d_search_empty.length}))
          )
        )
        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    ;; ── Phase 8: Create Issue ────────────────────────────────────────────────
    (if (i32.eq (global.get $phase) (i32.const 8))
      (then
        (local.set $out (call $copy_mem (i32.const ${d_issue_created_prefix.offset}) (i32.const 1024) (i32.const ${d_issue_created_prefix.length})))
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const ${d_issue_created_mid.offset}) (local.get $out) (i32.const ${d_issue_created_mid.length})))
        (local.set $out (call $copy_mem (i32.const 210000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const ${d_issue_created_suffix.offset}) (local.get $out) (i32.const ${d_issue_created_suffix.length})))
        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    (drop (call $copy_mem (i32.const ${d_generic_error.offset}) (i32.const 1024) (i32.const ${d_generic_error.length})))
    (i32.const ${d_generic_error.length})
  )
)
`;

const watPath  = path.join(pluginDir, 'plugin.wat');
const wasmPath = path.join(pluginDir, 'plugin.wasm');

fs.writeFileSync(watPath, watContent, 'utf8');
console.log('✅ Generated plugin.wat successfully.');

execSync(`wat2wasm "${watPath}" -o "${wasmPath}"`, { stdio: 'inherit' });
console.log('✅ Compiled plugin.wasm successfully.');

const wasmBytes  = fs.readFileSync(wasmPath);
const wasmSha256 = crypto.createHash('sha256').update(wasmBytes).digest('hex');
console.log('WASM SHA-256:', wasmSha256);

const manifestPath = path.join(pluginDir, 'plugin.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.wasmSha256 = wasmSha256;
  const version = manifest.version || '1.0.9';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('✅ Updated plugin.json with new wasmSha256.');

  const packScript = path.resolve(__dirname, '../tools/package-plugin.mjs');
  execSync(`node "${packScript}" "${pluginDir}"`, { stdio: 'inherit' });
  console.log('✅ Packaged plugin archive.');

  const origPkg = path.join(pluginDir, `com.chattree.official.github-v${version}.chattree-plugin`);
  const slugPkg = path.join(pluginDir, `github-v${version}.chattree-plugin`);
  if (fs.existsSync(origPkg)) {
    fs.copyFileSync(origPkg, slugPkg);
    console.log(`✅ Created github-v${version}.chattree-plugin.`);
  }
}
