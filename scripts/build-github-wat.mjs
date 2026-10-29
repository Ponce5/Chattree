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

// Static Strings
const s_help = `🐙 **GitHub Integration para Chattree**

Gestiona y consulta información de GitHub directamente desde tu chat con IA.

**Comandos disponibles:**
• \`/github config <token>\` — Guarda tu Personal Access Token (PAT)
• \`/github status\` — Verifica el estado y cuenta vinculada
• \`/github repo <owner/repo>\` — Información y métricas del repositorio
• \`/github issues <owner/repo>\` — Lista los issues abiertos
• \`/github prs <owner/repo>\` — Lista los pull requests abiertos
• \`/gh <comando>\` — Alias corto para cualquier comando

*Genera un Personal Access Token en: https://github.com/settings/tokens*`;

const s_key_saved = `✅ **Token de GitHub guardado exitosamente.**\n\nYa puedes verificar tu conexión con \`/github status\` o consultar repositorios con \`/github repo <owner/repo>\`.`;
const s_key_missing = `⚠️ **No hay un token de GitHub configurado.**\n\nPor favor registra tu Personal Access Token ejecutando:\n\`/github config <tu_token>\`\n\nPuedes generar uno con permisos \`repo\` y \`read:user\` en https://github.com/settings/tokens`;

const s_storage_get = JSON.stringify({ api: 'storage', operation: 'get', payload: { key: 'api_key' } });
const s_storage_set_prefix = '{"api":"storage","operation":"set","payload":{"key":"api_key","value":"';
const s_storage_set_suffix = '"}}';

const s_http_user_prefix = '{"api":"network","operation":"http_request","payload":{"url":"https://api.github.com/user","method":"GET","headers":{"User-Agent":"Chattree-GitHub-Plugin","Accept":"application/vnd.github+json"';
const s_http_user_auth_prefix = ',"Authorization":"Bearer ';
const s_http_user_suffix = '},"timeoutMs":15000}}';

const s_http_repo_prefix = '{"api":"network","operation":"http_request","payload":{"url":"https://api.github.com/repos/';
const s_http_issues_suffix = '/issues?state=open&per_page=5","method":"GET","headers":{"User-Agent":"Chattree-GitHub-Plugin","Accept":"application/vnd.github+json"';
const s_http_prs_suffix = '/pulls?state=open&per_page=5","method":"GET","headers":{"User-Agent":"Chattree-GitHub-Plugin","Accept":"application/vnd.github+json"';
const s_http_info_suffix = '","method":"GET","headers":{"User-Agent":"Chattree-GitHub-Plugin","Accept":"application/vnd.github+json"';

// Formatted Response Snippets
const s_status_ok_prefix = '✅ **Conectado a GitHub exitosamente**\n\n• **Usuario:** @';
const s_status_ok_name = '\n• **Nombre:** ';
const s_status_ok_repos = '\n• **Repositorios públicos:** ';
const s_status_ok_suffix = '\n• **Estado:** Conexión autorizada y lista.';

const s_repo_header = '📦 **Repositorio: ';
const s_repo_stars = '\n\n⭐ **Estrellas:** ';
const s_repo_forks = ' | 🍴 **Forks:** ';
const s_repo_url = '\n🔗 **Enlace:** ';

const s_issues_header = '📋 **Issues recientes en ';
const s_prs_header = '🔀 **Pull Requests recientes en ';
const s_bracket_close = ':**\n\n';

const s_auth_error = '❌ **Error de autenticación con GitHub**\n\nEl token configurado es inválido o ha expirado. Por favor actualízalo con:\n`/github config <tu_token>`';
const s_not_found = '❌ **Repositorio o recurso no encontrado en GitHub.**\n\nVerifica que el nombre `owner/repo` sea correcto y que tu token tenga los permisos necesarios.';
const s_generic_error = '❌ **Error al consultar la API de GitHub.**\n\nPor favor verifica tu conexión o intenta nuevamente.';

// Register segments
const d_help = registerData('help', s_help);
const d_key_saved = registerData('key_saved', s_key_saved);
const d_key_missing = registerData('key_missing', s_key_missing);
const d_storage_get = registerData('storage_get', s_storage_get);
const d_storage_set_prefix = registerData('storage_set_prefix', s_storage_set_prefix);
const d_storage_set_suffix = registerData('storage_set_suffix', s_storage_set_suffix);

const d_http_user_prefix = registerData('http_user_prefix', s_http_user_prefix);
const d_http_user_auth_prefix = registerData('http_user_auth_prefix', s_http_user_auth_prefix);
const d_http_user_suffix = registerData('http_user_suffix', s_http_user_suffix);

const d_http_repo_prefix = registerData('http_repo_prefix', s_http_repo_prefix);
const d_http_issues_suffix = registerData('http_issues_suffix', s_http_issues_suffix);
const d_http_prs_suffix = registerData('http_prs_suffix', s_http_prs_suffix);
const d_http_info_suffix = registerData('http_info_suffix', s_http_info_suffix);

const d_status_ok_prefix = registerData('status_ok_prefix', s_status_ok_prefix);
const d_status_ok_name = registerData('status_ok_name', s_status_ok_name);
const d_status_ok_repos = registerData('status_ok_repos', s_status_ok_repos);
const d_status_ok_suffix = registerData('status_ok_suffix', s_status_ok_suffix);

const d_repo_header = registerData('repo_header', s_repo_header);
const d_repo_stars = registerData('repo_stars', s_repo_stars);
const d_repo_forks = registerData('repo_forks', s_repo_forks);
const d_repo_url = registerData('repo_url', s_repo_url);

const d_issues_header = registerData('issues_header', s_issues_header);
const d_prs_header = registerData('prs_header', s_prs_header);
const d_bracket_close = registerData('bracket_close', s_bracket_close);

const d_auth_error = registerData('auth_error', s_auth_error);
const d_not_found = registerData('not_found', s_not_found);
const d_generic_error = registerData('generic_error', s_generic_error);

// Needles
const needle_ghp = registerData('needle_ghp', 'ghp_');
const needle_github_pat = registerData('needle_github_pat', 'github_pat_');
const needle_config = registerData('needle_config', 'config');
const needle_status = registerData('needle_status', 'status');
const needle_issues = registerData('needle_issues', 'issues');
const needle_prs = registerData('needle_prs', 'prs');
const needle_pulls = registerData('needle_pulls', 'pulls');
const needle_repo = registerData('needle_repo', 'repo');

const needle_val_field = registerData('needle_val_field', '"value":"');
const needle_status_200 = registerData('needle_status_200', '"statusCode":200');
const needle_status_401 = registerData('needle_status_401', '"statusCode":401');
const needle_status_404 = registerData('needle_status_404', '"statusCode":404');
const needle_body_field = registerData('needle_body_field', '"body":"');

// JSON fields to extract in GitHub responses
const needle_login = registerData('needle_login', 'login');
const needle_name = registerData('needle_name', 'name');
const needle_public_repos = registerData('needle_public_repos', 'public_repos');
const needle_full_name = registerData('needle_full_name', 'full_name');
const needle_desc = registerData('needle_desc', 'description');
const needle_stars = registerData('needle_stars', 'stargazers_count');
const needle_forks = registerData('needle_forks', 'forks_count');
const needle_html_url = registerData('needle_html_url', 'html_url');

console.log(`Registered ${dataEntries.length} static data segments up to offset ${staticPtr}.`);

const dataSectionWat = dataEntries
  .map(e => `  (data (i32.const ${e.offset}) "${e.escaped}")`)
  .join('\n');

const watContent = `;; Chattree Official GitHub Integration Plugin
;; Provides repository inspection, issue listing, pull request monitoring, and token management
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
${dataSectionWat}

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

    (local.set $res_len (call $host_call (i32.const ${d_storage_get.offset}) (i32.const ${d_storage_get.length}) (i32.const 3000500) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 3000500) (local.get $res_len) (i32.const ${needle_val_field.offset}) (i32.const ${needle_val_field.length})))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_start (i32.add (i32.const 3000500) (i32.add (local.get $val_idx) (i32.const ${needle_val_field.length}))))
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

    (global.set $phase (i32.const 0))

    ;; 1. Empty input -> Help
    (if (i32.eqz (local.get $in_len))
      (then
        (drop (call $copy_mem (i32.const ${d_help.offset}) (i32.const 1024) (i32.const ${d_help.length})))
        (return (i32.const ${d_help.length}))
      )
    )

    ;; 2. Detect direct token pattern (ghp_ or github_pat_)
    (local.set $tok_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_ghp.offset}) (i32.const ${needle_ghp.length})))
    (if (i32.lt_s (local.get $tok_pos) (i32.const 0))
      (then
        (local.set $tok_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_github_pat.offset}) (i32.const ${needle_github_pat.length})))
      )
    )

    (if (i32.ge_s (local.get $tok_pos) (i32.const 0))
      (then
        (local.set $text_start (i32.add (local.get $in_ptr) (local.get $tok_pos)))
        (local.set $i (i32.const 0))
        (loop $scan_tok
          (if (i32.lt_u (i32.add (local.get $tok_pos) (local.get $i)) (local.get $in_len))
            (then
              (if (i32.lt_u (local.get $i) (i32.const 100))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $text_start) (local.get $i))))
                  (if (i32.and
                        (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                        (i32.and (i32.ne (local.get $ch) (i32.const 125)) (i32.and (i32.ne (local.get $ch) (i32.const 10)) (i32.ne (local.get $ch) (i32.const 13)))))
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

        ;; Save token to storage.set
        (local.set $p (call $copy_mem (i32.const ${d_storage_set_prefix.offset}) (i32.const 100000) (i32.const ${d_storage_set_prefix.length})))
        (local.set $p (call $copy_mem (local.get $text_start) (local.get $p) (local.get $i)))
        (local.set $p (call $copy_mem (i32.const ${d_storage_set_suffix.offset}) (local.get $p) (i32.const ${d_storage_set_suffix.length})))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 3000500) (i32.const 1024)))

        (drop (call $copy_mem (i32.const ${d_key_saved.offset}) (i32.const 1024) (i32.const ${d_key_saved.length})))
        (return (i32.const ${d_key_saved.length}))
      )
    )

    ;; 3. Check for "config " command
    (local.set $cfg_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_config.offset}) (i32.const ${needle_config.length})))
    (if (i32.ge_s (local.get $cfg_pos) (i32.const 0))
      (then
        (local.set $text_start (i32.add (i32.add (local.get $in_ptr) (local.get $cfg_pos)) (i32.const 6)))
        (loop $skip_ws
          (if (i32.lt_u (local.get $text_start) (i32.add (local.get $in_ptr) (local.get $in_len)))
            (then
              (local.set $ch (i32.load8_u (local.get $text_start)))
              (if (i32.or (i32.eq (local.get $ch) (i32.const 32)) (i32.eq (local.get $ch) (i32.const 58)))
                (then
                  (local.set $text_start (i32.add (local.get $text_start) (i32.const 1)))
                  (br $skip_ws)
                )
              )
            )
          )
        )
        (local.set $i (i32.const 0))
        (loop $scan_cfg
          (if (i32.lt_u (i32.add (local.get $text_start) (local.get $i)) (i32.add (local.get $in_ptr) (local.get $in_len)))
            (then
              (if (i32.lt_u (local.get $i) (i32.const 100))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $text_start) (local.get $i))))
                  (if (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                    (then
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $scan_cfg)
                    )
                  )
                )
              )
            )
          )
        )
        (if (i32.gt_u (local.get $i) (i32.const 4))
          (then
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_prefix.offset}) (i32.const 100000) (i32.const ${d_storage_set_prefix.length})))
            (local.set $p (call $copy_mem (local.get $text_start) (local.get $p) (local.get $i)))
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_suffix.offset}) (local.get $p) (i32.const ${d_storage_set_suffix.length})))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 3000500) (i32.const 1024)))

            (drop (call $copy_mem (i32.const ${d_key_saved.offset}) (i32.const 1024) (i32.const ${d_key_saved.length})))
            (return (i32.const ${d_key_saved.length}))
          )
        )
      )
    )

    ;; 4. Check for "status"
    (local.set $status_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_status.offset}) (i32.const ${needle_status.length})))
    (if (i32.ge_s (local.get $status_pos) (i32.const 0))
      (then
        (local.set $key_count (call $load_api_key))
        (if (i32.eqz (local.get $key_count))
          (then
            (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 1024) (i32.const ${d_key_missing.length})))
            (return (i32.const ${d_key_missing.length}))
          )
        )

        ;; Dispatch HTTP GET /user (Phase 1)
        (local.set $p (call $copy_mem (i32.const ${d_http_user_prefix.offset}) (i32.const 100000) (i32.const ${d_http_user_prefix.length})))
        (local.set $p (call $copy_mem (i32.const ${d_http_user_auth_prefix.offset}) (local.get $p) (i32.const ${d_http_user_auth_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 3000000) (local.get $p) (global.get $key_len)))
        (i32.store8 (local.get $p) (i32.const 34))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (local.set $p (call $copy_mem (i32.const ${d_http_user_suffix.offset}) (local.get $p) (i32.const ${d_http_user_suffix.length})))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (global.set $phase (i32.const 1))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 1000000)))
        (return (i32.const 0))
      )
    )

    ;; 5. Search for repo name (contains slash '/')
    (call $to_lower (local.get $in_ptr) (i32.const 50000) (local.get $in_len))

    (local.set $i (i32.const 0))
    (local.set $text_start (i32.const 0))
    (loop $find_slash
      (if (i32.lt_u (local.get $i) (local.get $in_len))
        (then
          (if (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (local.get $i))) (i32.const 47))
            (then
              (local.set $text_start (local.get $i))
              (loop $find_start
                (if (i32.gt_u (local.get $text_start) (i32.const 0))
                  (then
                    (local.set $ch (i32.load8_u (i32.add (local.get $in_ptr) (i32.sub (local.get $text_start) (i32.const 1)))))
                    (if (i32.and
                          (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                          (i32.and (i32.ne (local.get $ch) (i32.const 58)) (i32.ne (local.get $ch) (i32.const 61))))
                      (then
                        (local.set $text_start (i32.sub (local.get $text_start) (i32.const 1)))
                        (br $find_start)
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

    ;; If owner/repo found, extract it into 300000
    (if (i32.gt_u (local.get $i) (i32.const 0))
      (then
        (local.set $text_start (i32.add (local.get $in_ptr) (local.get $text_start)))
        (local.set $i (i32.const 0))
        (loop $copy_repo
          (if (i32.lt_u (i32.add (local.get $text_start) (local.get $i)) (i32.add (local.get $in_ptr) (local.get $in_len)))
            (then
              (if (i32.lt_u (local.get $i) (i32.const 80))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $text_start) (local.get $i))))
                  (if (i32.and
                        (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                        (i32.and (i32.ne (local.get $ch) (i32.const 125)) (i32.and (i32.ne (local.get $ch) (i32.const 10)) (i32.ne (local.get $ch) (i32.const 13)))))
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
        (global.set $repo_len (local.get $i))
      )
    )

    ;; Fallback: return help if no repo identified
    (if (i32.eqz (global.get $repo_len))
      (then
        (drop (call $copy_mem (i32.const ${d_help.offset}) (i32.const 1024) (i32.const ${d_help.length})))
        (return (i32.const ${d_help.length}))
      )
    )

    ;; Read token if stored
    (drop (call $load_api_key))

    ;; 5.1 Issues
    (local.set $issues_pos (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${needle_issues.offset}) (i32.const ${needle_issues.length})))
    (if (i32.ge_s (local.get $issues_pos) (i32.const 0))
      (then
        (local.set $p (call $copy_mem (i32.const ${d_http_repo_prefix.offset}) (i32.const 100000) (i32.const ${d_http_repo_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 300000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_issues_suffix.offset}) (local.get $p) (i32.const ${d_http_issues_suffix.length})))
        (if (i32.gt_u (global.get $key_len) (i32.const 0))
          (then
            (local.set $p (call $copy_mem (i32.const ${d_http_user_auth_prefix.offset}) (local.get $p) (i32.const ${d_http_user_auth_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 3000000) (local.get $p) (global.get $key_len)))
            (i32.store8 (local.get $p) (i32.const 34))
            (local.set $p (i32.add (local.get $p) (i32.const 1)))
          )
        )
        (local.set $p (call $copy_mem (i32.const ${d_http_user_suffix.offset}) (local.get $p) (i32.const ${d_http_user_suffix.length})))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (global.set $phase (i32.const 2))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 1000000)))
        (return (i32.const 0))
      )
    )

    ;; 5.2 Pull Requests
    (local.set $prs_pos (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${needle_prs.offset}) (i32.const ${needle_prs.length})))
    (if (i32.lt_s (local.get $prs_pos) (i32.const 0))
      (then
        (local.set $prs_pos (call $find_substring (i32.const 50000) (local.get $in_len) (i32.const ${needle_pulls.offset}) (i32.const ${needle_pulls.length})))
      )
    )
    (if (i32.ge_s (local.get $prs_pos) (i32.const 0))
      (then
        (local.set $p (call $copy_mem (i32.const ${d_http_repo_prefix.offset}) (i32.const 100000) (i32.const ${d_http_repo_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 300000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_prs_suffix.offset}) (local.get $p) (i32.const ${d_http_prs_suffix.length})))
        (if (i32.gt_u (global.get $key_len) (i32.const 0))
          (then
            (local.set $p (call $copy_mem (i32.const ${d_http_user_auth_prefix.offset}) (local.get $p) (i32.const ${d_http_user_auth_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 3000000) (local.get $p) (global.get $key_len)))
            (i32.store8 (local.get $p) (i32.const 34))
            (local.set $p (i32.add (local.get $p) (i32.const 1)))
          )
        )
        (local.set $p (call $copy_mem (i32.const ${d_http_user_suffix.offset}) (local.get $p) (i32.const ${d_http_user_suffix.length})))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (global.set $phase (i32.const 3))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 1000000)))
        (return (i32.const 0))
      )
    )

    ;; 5.3 Default for repo: Get repo info
    (local.set $p (call $copy_mem (i32.const ${d_http_repo_prefix.offset}) (i32.const 100000) (i32.const ${d_http_repo_prefix.length})))
    (local.set $p (call $copy_mem (i32.const 300000) (local.get $p) (global.get $repo_len)))
    (local.set $p (call $copy_mem (i32.const ${d_http_info_suffix.offset}) (local.get $p) (i32.const ${d_http_info_suffix.length})))
    (if (i32.gt_u (global.get $key_len) (i32.const 0))
      (then
        (local.set $p (call $copy_mem (i32.const ${d_http_user_auth_prefix.offset}) (local.get $p) (i32.const ${d_http_user_auth_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 3000000) (local.get $p) (global.get $key_len)))
        (i32.store8 (local.get $p) (i32.const 34))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
      )
    )
    (local.set $p (call $copy_mem (i32.const ${d_http_user_suffix.offset}) (local.get $p) (i32.const ${d_http_user_suffix.length})))
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

    ;; Check for 401 Unauthorized
    (if (i32.ge_s (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const ${needle_status_401.offset}) (i32.const ${needle_status_401.length})) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const ${d_auth_error.offset}) (i32.const 1024) (i32.const ${d_auth_error.length})))
        (return (i32.const ${d_auth_error.length}))
      )
    )

    ;; Check for 404 Not Found
    (if (i32.ge_s (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const ${needle_status_404.offset}) (i32.const ${needle_status_404.length})) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const ${d_not_found.offset}) (i32.const 1024) (i32.const ${d_not_found.length})))
        (return (i32.const ${d_not_found.length}))
      )
    )

    ;; Check for 200 OK
    (if (i32.lt_s (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const ${needle_status_200.offset}) (i32.const ${needle_status_200.length})) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const ${d_generic_error.offset}) (i32.const 1024) (i32.const ${d_generic_error.length})))
        (return (i32.const ${d_generic_error.length}))
      )
    )

    ;; Phase 1: Status response (/user)
    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        (local.set $out (call $copy_mem (i32.const ${d_status_ok_prefix.offset}) (i32.const 1024) (i32.const ${d_status_ok_prefix.length})))

        ;; Extract login
        (local.set $extracted_len (call $extract_field (local.get $res_ptr) (local.get $res_len) (i32.const ${needle_login.offset}) (i32.const ${needle_login.length}) (local.get $out) (i32.const 40)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))

        (local.set $out (call $copy_mem (i32.const ${d_status_ok_name.offset}) (local.get $out) (i32.const ${d_status_ok_name.length})))

        ;; Extract name
        (local.set $extracted_len (call $extract_field (local.get $res_ptr) (local.get $res_len) (i32.const ${needle_name.offset}) (i32.const ${needle_name.length}) (local.get $out) (i32.const 50)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))

        (local.set $out (call $copy_mem (i32.const ${d_status_ok_repos.offset}) (local.get $out) (i32.const ${d_status_ok_repos.length})))

        ;; Extract public_repos
        (local.set $extracted_len (call $extract_field (local.get $res_ptr) (local.get $res_len) (i32.const ${needle_public_repos.offset}) (i32.const ${needle_public_repos.length}) (local.get $out) (i32.const 10)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))

        (local.set $out (call $copy_mem (i32.const ${d_status_ok_suffix.offset}) (local.get $out) (i32.const ${d_status_ok_suffix.length})))
        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    ;; Phase 4: Repo Info
    (if (i32.eq (global.get $phase) (i32.const 4))
      (then
        (local.set $out (call $copy_mem (i32.const ${d_repo_header.offset}) (i32.const 1024) (i32.const ${d_repo_header.length})))

        ;; Extract full_name
        (local.set $extracted_len (call $extract_field (local.get $res_ptr) (local.get $res_len) (i32.const ${needle_full_name.offset}) (i32.const ${needle_full_name.length}) (local.get $out) (i32.const 80)))
        (if (i32.gt_u (local.get $extracted_len) (i32.const 0))
          (then
            (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))
          )
          (else
            ;; fallback to query repo name
            (local.set $out (call $copy_mem (i32.const 300000) (local.get $out) (global.get $repo_len)))
          )
        )

        ;; Close bold and newline
        (i32.store8 (local.get $out) (i32.const 42)) ;; *
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (i32.store8 (local.get $out) (i32.const 42)) ;; *
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (i32.store8 (local.get $out) (i32.const 10)) ;; \n
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (i32.store8 (local.get $out) (i32.const 10)) ;; \n
        (local.set $out (i32.add (local.get $out) (i32.const 1)))

        ;; Extract description
        (local.set $extracted_len (call $extract_field (local.get $res_ptr) (local.get $res_len) (i32.const ${needle_desc.offset}) (i32.const ${needle_desc.length}) (local.get $out) (i32.const 200)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))

        ;; Stars
        (local.set $out (call $copy_mem (i32.const ${d_repo_stars.offset}) (local.get $out) (i32.const ${d_repo_stars.length})))
        (local.set $extracted_len (call $extract_field (local.get $res_ptr) (local.get $res_len) (i32.const ${needle_stars.offset}) (i32.const ${needle_stars.length}) (local.get $out) (i32.const 15)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))

        ;; Forks
        (local.set $out (call $copy_mem (i32.const ${d_repo_forks.offset}) (local.get $out) (i32.const ${d_repo_forks.length})))
        (local.set $extracted_len (call $extract_field (local.get $res_ptr) (local.get $res_len) (i32.const ${needle_forks.offset}) (i32.const ${needle_forks.length}) (local.get $out) (i32.const 15)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))

        ;; URL
        (local.set $out (call $copy_mem (i32.const ${d_repo_url.offset}) (local.get $out) (i32.const ${d_repo_url.length})))
        (local.set $extracted_len (call $extract_field (local.get $res_ptr) (local.get $res_len) (i32.const ${needle_html_url.offset}) (i32.const ${needle_html_url.length}) (local.get $out) (i32.const 100)))
        (local.set $out (i32.add (local.get $out) (local.get $extracted_len)))

        (return (i32.sub (local.get $out) (i32.const 1024)))
      )
    )

    ;; Phase 2: Issues or Phase 3: PRs
    (if (i32.or (i32.eq (global.get $phase) (i32.const 2)) (i32.eq (global.get $phase) (i32.const 3)))
      (then
        (if (i32.eq (global.get $phase) (i32.const 2))
          (then
            (local.set $out (call $copy_mem (i32.const ${d_issues_header.offset}) (i32.const 1024) (i32.const ${d_issues_header.length})))
          )
          (else
            (local.set $out (call $copy_mem (i32.const ${d_prs_header.offset}) (i32.const 1024) (i32.const ${d_prs_header.length})))
          )
        )
        (local.set $out (call $copy_mem (i32.const 300000) (local.get $out) (global.get $repo_len)))
        (local.set $out (call $copy_mem (i32.const ${d_bracket_close.offset}) (local.get $out) (i32.const ${d_bracket_close.length})))

        ;; Extract response body contents
        (local.set $body_idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const ${needle_body_field.offset}) (i32.const ${needle_body_field.length})))
        (if (i32.ge_s (local.get $body_idx) (i32.const 0))
          (then
            (local.set $val_start (i32.add (i32.add (local.get $res_ptr) (local.get $body_idx)) (i32.const ${needle_body_field.length})))
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

    (drop (call $copy_mem (i32.const ${d_generic_error.offset}) (i32.const 1024) (i32.const ${d_generic_error.length})))
    (i32.const ${d_generic_error.length})
  )
)
`;

const watPath = path.join(pluginDir, 'plugin.wat');
const wasmPath = path.join(pluginDir, 'plugin.wasm');

fs.writeFileSync(watPath, watContent, 'utf8');
console.log('✅ Generated plugin.wat successfully.');

execSync(`wat2wasm "${watPath}" -o "${wasmPath}"`, { stdio: 'inherit' });
console.log('✅ Compiled plugin.wasm successfully.');

const wasmBytes = fs.readFileSync(wasmPath);
const wasmSha256 = crypto.createHash('sha256').update(wasmBytes).digest('hex');
console.log('WASM SHA-256:', wasmSha256);

// Update plugin.json with new wasmSha256
const manifestPath = path.join(pluginDir, 'plugin.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.wasmSha256 = wasmSha256;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('✅ Updated plugin.json with new wasmSha256.');
}

// Package plugin
const packScript = path.resolve(__dirname, '../tools/package-plugin.mjs');
execSync(`node "${packScript}" "${pluginDir}"`, { stdio: 'inherit' });
console.log('✅ Packaged plugin archive.');

// Copy to slug name for publish_plugin.js
const origPkg = path.join(pluginDir, 'com.chattree.official.github-v1.0.0.chattree-plugin');
const slugPkg = path.join(pluginDir, 'github-v1.0.0.chattree-plugin');
if (fs.existsSync(origPkg)) {
  fs.copyFileSync(origPkg, slugPkg);
  console.log('✅ Created github-v1.0.0.chattree-plugin.');
}
