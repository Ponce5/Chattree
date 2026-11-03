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

// Memory Layout (64 pages = 4 MB):
// 0..65535:         Input buffer (up to 64 KB)
// 65536..131071:    Output buffer (64 KB, outputOffset = 65536)
// 140000..179999:   Static data strings
// 200000..499999:   HTTP Request buffer (300 KB)
// 500000..899999:   Raw HTTP Response buffer (400 KB)
// 900000..1299999:  Unescaped HTTP Response buffer (400 KB)
// 1300000..1302000: Storage API scratch (2 KB)
// 1302000..1303000: API Token storage (1 KB)
// 1303000..1306000: Sanitized Title / Query (3 KB)
// 1306000..1307000: Extracted Operation / Action string (1 KB)
// 1307000..1308000: Default Repo / Target Repo ("owner/repo") buffer (1 KB)
// 1308000..1309000: URL-encoded Query buffer (1 KB)
// 1310000..1312000: Raw Title buffer (2 KB)
// 1312000..1314000: Raw Query buffer (2 KB)
// 1314000..1316000: Raw Repo buffer (2 KB)
// 1400000..1460000: Raw extracted Content buffer (60 KB)
// 1600000..1660000: Readable Content buffer for Chat Preview & Escaping (60 KB)

let staticPtr = 140000;
const dataEntries = [];

function registerData(name, str) {
  const d = toWatData(str);
  const offset = staticPtr;
  staticPtr += d.length + 16;
  dataEntries.push({ name, offset, length: d.length, escaped: d.escaped });
  return { offset, length: d.length };
}

// Static user-facing messages
const s_help = `🐙 **GitHub Copilot & Workspace Integration (IA & Lenguaje Natural)**

Conecta tu cuenta de GitHub con Chattree y administra tus repositorios, issues y búsquedas en **lenguaje natural**. La IA redacta y estructura automáticamente tus reportes de bugs, historias de usuario y propuestas técnicas.

**Ejemplos de uso en lenguaje natural con \`/github\`:**
• \`/github créame un issue en Ponce5/Chattree sobre optimizar el consumo de batería en segundo plano con pasos detallados\`
• \`/github muéstrame mis repositorios más recientes\`
• \`/github revisa los issues abiertos del repositorio Ponce5/Chattree\`
• \`/github busca repositorios de motores WebAssembly en Flutter\`
• \`/github configura mi repositorio por defecto como Ponce5/Chattree\`
• \`/github configura mi token ghp_tu_personal_access_token\`
• \`/github verifica el estado de mi cuenta\`

*¿Cómo conectar tu cuenta de GitHub?*
1. Ve a **GitHub Settings** -> **Developer settings** -> **Personal access tokens** (https://github.com/settings/tokens).
2. Genera un token clásico (\`ghp_...\`) o Fine-grained (\`github_pat_...\`) con permisos \`repo\` (o \`public_repo\` y \`issues:write\`).
3. En Chattree escribe: \`/github configura mi token <tu_token>\`.`;

const s_key_saved_ok_prefix = `✅ **GitHub configurado y verificado exitosamente.**\n\n👤 **Cuenta conectada:** \`@`;
const s_key_saved_ok_suffix = `\`\n\nAhora puedes pedir en lenguaje natural:\n• \`/github muéstrame mis repositorios recientes\`\n• \`/github crea un issue en usuario/repo explicando...\`\n• \`/github busca repositorios sobre...\``;
const s_key_saved_invalid = `⚠️ **Token guardado pero no se pudo validar con GitHub.**\n\nGitHub devolvió un error de autenticación (401). Verifica que tu Personal Access Token (\`ghp_...\` o \`github_pat_...\`) sea válido y no haya expirado en https://github.com/settings/tokens`;
const s_key_missing = `⚠️ **GitHub no está configurado.**\n\nPara crear issues o ver tus repositorios privados, registra tu Personal Access Token diciendo:\n\`/github configura mi token ghp_tu_token\`\n\nPuedes generar uno en https://github.com/settings/tokens (Nota: aún sin token puedes buscar repositorios públicos o ver issues de repositorios públicos).`;
const s_disconnected = `✅ **Desconectado de GitHub.**\n\nSe ha eliminado tu Personal Access Token de este dispositivo.`;

const s_status_ok_prefix = `✅ **Conexión con GitHub activa y saludable.**\n\n• **Usuario:** \`@`;
const s_status_ok_mid = `\`\n• **Repositorio predeterminado:** \``;
const s_status_ok_suffix = `\`\n• **API:** GitHub REST API v2022-11-28\n• **Modo:** 100% Lenguaje Natural con IA de Chattree (creación de issues con redacción técnica automática, consulta de repositorios, issues y búsqueda global)\n\nPide lo que necesites con \`/github <tu solicitud en lenguaje natural>\`.`;
const s_status_none_repo = `No configurado (usa /github configura mi repo owner/repo)`;
const s_status_error = `❌ **No se pudo autenticar con GitHub.**\n\nEl token guardado no es válido o ha expirado. Configura uno nuevo diciendo:\n\`/github configura mi token <tu_token>\``;

const s_repo_saved_prefix = `✅ **Repositorio predeterminado configurado:** \``;
const s_repo_saved_suffix = `\`\n\nAhora puedes crear issues o listar issues sin necesidad de repetir el nombre del repositorio en cada mensaje.`;
const s_repo_missing = `⚠️ **Falta indicar el repositorio (\`owner/repo\`).**\n\nPor favor indica el repositorio en tu solicitud (por ejemplo: *"en el repo Ponce5/Chattree"*) o configura un repositorio predeterminado diciendo:\n\`/github configura mi repositorio por defecto como owner/repo\``;

const s_repos_header = `🐙 **Tus repositorios recientes en GitHub:**\n\n`;
const s_search_header = `🔍 **Repositorios encontrados en GitHub:**\n\n`;
const s_issues_header_prefix = `📋 **Issues abiertos en `;
const s_issues_header_suffix = `:**\n\n`;
const s_empty_results = `ℹ️ **No se encontraron resultados en GitHub para esta consulta.**`;
const s_api_error_prefix = `❌ **Error de GitHub API:** `;
const s_api_error_suffix = `\n\nVerifica que el repositorio exista y que tu token tenga permisos suficientes (\`repo\` / \`issues:write\`).`;

const s_create_ok_prefix = `✅ **Issue creado exitosamente en GitHub:**\n\n🐛 [**`;
const s_create_ok_mid = `**](`;
const s_create_ok_mid2 = `)\n\n---\n\n`;
const s_create_ok_suffix = `\n\n---\n*El issue ya está publicado y activo en el repositorio de GitHub.*`;

// Storage templates
const s_storage_get_tok = JSON.stringify({ api: 'storage', operation: 'get', payload: { key: 'api_token' } });
const s_storage_set_tok_prefix = '{"api":"storage","operation":"set","payload":{"key":"api_token","value":"';
const s_storage_set_tok_suffix = '"}}';
const s_storage_del_tok = JSON.stringify({ api: 'storage', operation: 'delete', payload: { key: 'api_token' } });

const s_storage_get_repo = JSON.stringify({ api: 'storage', operation: 'get', payload: { key: 'default_repo' } });
const s_storage_set_repo_prefix = '{"api":"storage","operation":"set","payload":{"key":"default_repo","value":"';
const s_storage_set_repo_suffix = '"}}';

// HTTP Request Templates
// 1. GET /user (Auth & status verification)
const s_http_user_prefix = '{"api":"network","operation":"http_request","payload":{"url":"https://api.github.com/user","method":"GET","headers":{"Authorization":"Bearer ';
const s_http_user_suffix = '","Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},"timeoutMs":20000}}';

// 2. GET /user/repos?sort=updated&per_page=6
const s_http_my_repos_prefix = '{"api":"network","operation":"http_request","payload":{"url":"https://api.github.com/user/repos?sort=updated&per_page=6","method":"GET","headers":{"Authorization":"Bearer ';
const s_http_my_repos_suffix = '","Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},"timeoutMs":20000}}';

// 3. GET /search/repositories?q=<query>&sort=stars&per_page=5
const s_http_search_auth_prefix = '{"api":"network","operation":"http_request","payload":{"url":"https://api.github.com/search/repositories?per_page=5&sort=stars&q=';
const s_http_search_auth_mid = '","method":"GET","headers":{"Authorization":"Bearer ';
const s_http_search_auth_suffix = '","Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},"timeoutMs":20000}}';
const s_http_search_noauth_suffix = '","method":"GET","headers":{"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},"timeoutMs":20000}}';

// 4. GET /repos/<owner/repo>/issues?state=open&per_page=6
const s_http_issues_prefix = '{"api":"network","operation":"http_request","payload":{"url":"https://api.github.com/repos/';
const s_http_issues_mid_auth = '/issues?state=open&per_page=6","method":"GET","headers":{"Authorization":"Bearer ';
const s_http_issues_suffix_auth = '","Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},"timeoutMs":20000}}';
const s_http_issues_suffix_noauth = '/issues?state=open&per_page=6","method":"GET","headers":{"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},"timeoutMs":20000}}';

// 5. POST /repos/<owner/repo>/issues
const s_http_create_issue_prefix = '{"api":"network","operation":"http_request","payload":{"url":"https://api.github.com/repos/';
const s_http_create_issue_mid1 = '/issues","method":"POST","headers":{"Authorization":"Bearer ';
const s_http_create_issue_mid2 = '","Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"},"body":"{\\"title\\":\\"';
const s_http_create_issue_mid3 = '\\",\\"body\\":\\"';
const s_http_create_issue_suffix = '\\"}","timeoutMs":25000}}';

// Register static messages
const d_help = registerData('help', s_help);
const d_key_saved_ok_prefix = registerData('key_saved_ok_prefix', s_key_saved_ok_prefix);
const d_key_saved_ok_suffix = registerData('key_saved_ok_suffix', s_key_saved_ok_suffix);
const d_key_saved_invalid = registerData('key_saved_invalid', s_key_saved_invalid);
const d_key_missing = registerData('key_missing', s_key_missing);
const d_disconnected = registerData('disconnected', s_disconnected);

const d_status_ok_prefix = registerData('status_ok_prefix', s_status_ok_prefix);
const d_status_ok_mid = registerData('status_ok_mid', s_status_ok_mid);
const d_status_ok_suffix = registerData('status_ok_suffix', s_status_ok_suffix);
const d_status_none_repo = registerData('status_none_repo', s_status_none_repo);
const d_status_error = registerData('status_error', s_status_error);

const d_repo_saved_prefix = registerData('repo_saved_prefix', s_repo_saved_prefix);
const d_repo_saved_suffix = registerData('repo_saved_suffix', s_repo_saved_suffix);
const d_repo_missing = registerData('repo_missing', s_repo_missing);

const d_repos_header = registerData('repos_header', s_repos_header);
const d_search_header = registerData('search_header', s_search_header);
const d_issues_header_prefix = registerData('issues_header_prefix', s_issues_header_prefix);
const d_issues_header_suffix = registerData('issues_header_suffix', s_issues_header_suffix);
const d_empty_results = registerData('empty_results', s_empty_results);
const d_api_error_prefix = registerData('api_error_prefix', s_api_error_prefix);
const d_api_error_suffix = registerData('api_error_suffix', s_api_error_suffix);

const d_create_ok_prefix = registerData('create_ok_prefix', s_create_ok_prefix);
const d_create_ok_mid = registerData('create_ok_mid', s_create_ok_mid);
const d_create_ok_mid2 = registerData('create_ok_mid2', s_create_ok_mid2);
const d_create_ok_suffix = registerData('create_ok_suffix', s_create_ok_suffix);

// Register storage templates
const d_storage_get_tok = registerData('storage_get_tok', s_storage_get_tok);
const d_storage_set_tok_prefix = registerData('storage_set_tok_prefix', s_storage_set_tok_prefix);
const d_storage_set_tok_suffix = registerData('storage_set_tok_suffix', s_storage_set_tok_suffix);
const d_storage_del_tok = registerData('storage_del_tok', s_storage_del_tok);

const d_storage_get_repo = registerData('storage_get_repo', s_storage_get_repo);
const d_storage_set_repo_prefix = registerData('storage_set_repo_prefix', s_storage_set_repo_prefix);
const d_storage_set_repo_suffix = registerData('storage_set_repo_suffix', s_storage_set_repo_suffix);

// Register HTTP templates
const d_http_user_prefix = registerData('http_user_prefix', s_http_user_prefix);
const d_http_user_suffix = registerData('http_user_suffix', s_http_user_suffix);

const d_http_my_repos_prefix = registerData('http_my_repos_prefix', s_http_my_repos_prefix);
const d_http_my_repos_suffix = registerData('http_my_repos_suffix', s_http_my_repos_suffix);

const d_http_search_auth_prefix = registerData('http_search_auth_prefix', s_http_search_auth_prefix);
const d_http_search_auth_mid = registerData('http_search_auth_mid', s_http_search_auth_mid);
const d_http_search_auth_suffix = registerData('http_search_auth_suffix', s_http_search_auth_suffix);
const d_http_search_noauth_suffix = registerData('http_search_noauth_suffix', s_http_search_noauth_suffix);

const d_http_issues_prefix = registerData('http_issues_prefix', s_http_issues_prefix);
const d_http_issues_mid_auth = registerData('http_issues_mid_auth', s_http_issues_mid_auth);
const d_http_issues_suffix_auth = registerData('http_issues_suffix_auth', s_http_issues_suffix_auth);
const d_http_issues_suffix_noauth = registerData('http_issues_suffix_noauth', s_http_issues_suffix_noauth);

const d_http_create_issue_prefix = registerData('http_create_issue_prefix', s_http_create_issue_prefix);
const d_http_create_issue_mid1 = registerData('http_create_issue_mid1', s_http_create_issue_mid1);
const d_http_create_issue_mid2 = registerData('http_create_issue_mid2', s_http_create_issue_mid2);
const d_http_create_issue_mid3 = registerData('http_create_issue_mid3', s_http_create_issue_mid3);
const d_http_create_issue_suffix = registerData('http_create_issue_suffix', s_http_create_issue_suffix);

// JSON field needles
const needle_val_field = registerData('needle_val_field', '"value":"');
const needle_json_operation = registerData('needle_json_operation', '"operation":"');
const needle_json_action = registerData('needle_json_action', '"action":"');
const needle_json_repo = registerData('needle_json_repo', '"repo":"');
const needle_json_title = registerData('needle_json_title', '"title":"');
const needle_json_content = registerData('needle_json_content', '"content":"');
const needle_json_extra = registerData('needle_json_extra', '"extra":"');
const needle_json_query = registerData('needle_json_query', '"query":"');
const needle_json_token = registerData('needle_json_token', '"token":"');

// Action needles (matched against extracted operation/action)
const needle_act_create = registerData('needle_act_create', 'create');
const needle_act_issues = registerData('needle_act_issues', 'issues');
const needle_act_repos = registerData('needle_act_repos', 'repos');
const needle_act_list = registerData('needle_act_list', 'list');
const needle_act_search = registerData('needle_act_search', 'search');
const needle_act_repo = registerData('needle_act_repo', 'set_repo');
const needle_act_status = registerData('needle_act_status', 'status');
const needle_act_config = registerData('needle_act_config', 'config');
const needle_act_disconnect = registerData('needle_act_disconnect', 'disconnect');
const needle_act_help = registerData('needle_act_help', 'help');

// Direct token paste prefixes
const needle_ghp = registerData('needle_ghp', 'ghp_');
const needle_gho = registerData('needle_gho', 'gho_');
const needle_github_pat = registerData('needle_github_pat', 'github_pat_');
const needle_default_title = registerData('needle_default_title', 'Nuevo Issue');

// Response parsing needles
const needle_status_200 = registerData('needle_status_200', '"statusCode":200');
const needle_status_201 = registerData('needle_status_201', '"statusCode":201');
const needle_login_field = registerData('needle_login_field', '"login":"');
const needle_full_name = registerData('needle_full_name', '"full_name":"');
const needle_html_url = registerData('needle_html_url', '"html_url":"https://github.com/');
const needle_title_resp = registerData('needle_title_resp', '"title":"');
const needle_desc_resp = registerData('needle_desc_resp', '"description":"');
const needle_msg_field = registerData('needle_msg_field', '"message":"');
const needle_fallback_item = registerData('needle_fallback_item', 'Ver en GitHub');

// Bullet formatting
const d_bullet_repo = registerData('bullet_repo', '• 📦 [**');
const d_bullet_issue = registerData('bullet_issue', '• 🐛 [**');
const d_bullet_mid = registerData('bullet_mid', '**](https://github.com/');
const d_bullet_desc = registerData('bullet_desc', ') — ');
const d_bullet_end = registerData('bullet_end', ')\n');
const d_newline = registerData('newline', '\n');

console.log(`Registered ${dataEntries.length} static data segments up to offset ${staticPtr}.`);

const dataSectionWat = dataEntries
  .map(e => `  ;; [${e.offset}] ${e.name} (${e.length}B)\n  (data (i32.const ${e.offset}) "${e.escaped}")`)
  .join('\n');

const watContent = `;; Chattree Official GitHub Integration Plugin v1.0.0
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
${dataSectionWat}

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

    (local.set $res_len (call $host_call (i32.const ${d_storage_get_tok.offset}) (i32.const ${d_storage_get_tok.length}) (i32.const 1300000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 1300000) (local.get $res_len) (i32.const ${needle_val_field.offset}) (i32.const ${needle_val_field.length})))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_start (i32.add (i32.const 1300000) (i32.add (local.get $val_idx) (i32.const ${needle_val_field.length}))))
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

    (local.set $res_len (call $host_call (i32.const ${d_storage_get_repo.offset}) (i32.const ${d_storage_get_repo.length}) (i32.const 1300000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 1300000) (local.get $res_len) (i32.const ${needle_val_field.offset}) (i32.const ${needle_val_field.length})))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_start (i32.add (i32.const 1300000) (i32.add (local.get $val_idx) (i32.const ${needle_val_field.length}))))
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
        (drop (call $copy_mem (i32.const ${d_help.offset}) (i32.const 65536) (i32.const ${d_help.length})))
        (return (i32.const ${d_help.length}))
      )
    )

    ;; 2. Direct token paste convenience (ghp_..., gho_..., github_pat_...)
    (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_ghp.offset}) (i32.const ${needle_ghp.length})))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_github_pat.offset}) (i32.const ${needle_github_pat.length})))
      )
    )
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_gho.offset}) (i32.const ${needle_gho.length})))
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
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_tok_prefix.offset}) (i32.const 200000) (i32.const ${d_storage_set_tok_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_tok_suffix.offset}) (local.get $p) (i32.const ${d_storage_set_tok_suffix.length})))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

            (local.set $p (call $copy_mem (i32.const ${d_http_user_prefix.offset}) (i32.const 200000) (i32.const ${d_http_user_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const ${d_http_user_suffix.offset}) (local.get $p) (i32.const ${d_http_user_suffix.length})))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (global.set $phase (i32.const 1))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; 3. Extract AI Intent Contract JSON fields
    (local.set $raw_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_json_operation.offset}) (i32.const ${needle_json_operation.length}) (i32.const 1306000) (i32.const 64)))
    (if (i32.lt_s (local.get $raw_len) (i32.const 0))
      (then
        (local.set $raw_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_json_action.offset}) (i32.const ${needle_json_action.length}) (i32.const 1306000) (i32.const 64)))
      )
    )
    (if (i32.gt_s (local.get $raw_len) (i32.const 0))
      (then
        (call $to_lower (i32.const 1306000) (i32.const 1306000) (local.get $raw_len))
        (global.set $op_len (local.get $raw_len))
      )
    )

    (local.set $title_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_json_title.offset}) (i32.const ${needle_json_title.length}) (i32.const 1310000) (i32.const 1000)))
    (local.set $query_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_json_query.offset}) (i32.const ${needle_json_query.length}) (i32.const 1312000) (i32.const 1000)))
    (local.set $repo_json_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_json_repo.offset}) (i32.const ${needle_json_repo.length}) (i32.const 1314000) (i32.const 120)))

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
    (local.set $content_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_json_content.offset}) (i32.const ${needle_json_content.length}) (i32.const 1400000) (i32.const 45000)))
    (if (i32.le_s (local.get $content_len) (i32.const 0))
      (then
        (local.set $content_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_json_extra.offset}) (i32.const ${needle_json_extra.length}) (i32.const 1400000) (i32.const 45000)))
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
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const ${needle_act_help.offset}) (i32.const ${needle_act_help.length})) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const ${d_help.offset}) (i32.const 65536) (i32.const ${d_help.length})))
        (return (i32.const ${d_help.length}))
      )
    )

    ;; B. "disconnect"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const ${needle_act_disconnect.offset}) (i32.const ${needle_act_disconnect.length})) (i32.const 0))
      (then
        (drop (call $host_call (i32.const ${d_storage_del_tok.offset}) (i32.const ${d_storage_del_tok.length}) (i32.const 1300000) (i32.const 1024)))
        (drop (call $copy_mem (i32.const ${d_disconnected.offset}) (i32.const 65536) (i32.const ${d_disconnected.length})))
        (return (i32.const ${d_disconnected.length}))
      )
    )

    ;; C. "config"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const ${needle_act_config.offset}) (i32.const ${needle_act_config.length})) (i32.const 0))
      (then
        (local.set $tok_json_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_json_token.offset}) (i32.const ${needle_json_token.length}) (i32.const 1302000) (i32.const 150)))
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
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_tok_prefix.offset}) (i32.const 200000) (i32.const ${d_storage_set_tok_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_tok_suffix.offset}) (local.get $p) (i32.const ${d_storage_set_tok_suffix.length})))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

            (local.set $p (call $copy_mem (i32.const ${d_http_user_prefix.offset}) (i32.const 200000) (i32.const ${d_http_user_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const ${d_http_user_suffix.offset}) (local.get $p) (i32.const ${d_http_user_suffix.length})))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (global.set $phase (i32.const 1))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
            (return (i32.const 0))
          )
        )
        (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 65536) (i32.const ${d_key_missing.length})))
        (return (i32.const ${d_key_missing.length}))
      )
    )

    ;; D. "set_repo" (configure default repository owner/repo)
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const ${needle_act_repo.offset}) (i32.const ${needle_act_repo.length})) (i32.const 0))
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
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_repo_prefix.offset}) (i32.const 200000) (i32.const ${d_storage_set_repo_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_repo_suffix.offset}) (local.get $p) (i32.const ${d_storage_set_repo_suffix.length})))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

            (local.set $p (call $copy_mem (i32.const ${d_repo_saved_prefix.offset}) (i32.const 65536) (i32.const ${d_repo_saved_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
            (local.set $p (call $copy_mem (i32.const ${d_repo_saved_suffix.offset}) (local.get $p) (i32.const ${d_repo_saved_suffix.length})))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
        )
        (drop (call $copy_mem (i32.const ${d_repo_missing.offset}) (i32.const 65536) (i32.const ${d_repo_missing.length})))
        (return (i32.const ${d_repo_missing.length}))
      )
    )

    ;; E. "status"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const ${needle_act_status.offset}) (i32.const ${needle_act_status.length})) (i32.const 0))
      (then
        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then
            (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 65536) (i32.const ${d_key_missing.length})))
            (return (i32.const ${d_key_missing.length}))
          )
        )
        (local.set $p (call $copy_mem (i32.const ${d_http_user_prefix.offset}) (i32.const 200000) (i32.const ${d_http_user_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_user_suffix.offset}) (local.get $p) (i32.const ${d_http_user_suffix.length})))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
        (global.set $phase (i32.const 2))
        (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
        (return (i32.const 0))
      )
    )

    ;; F. "create" (Create Issue in GitHub repository)
    (if (i32.or
          (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const ${needle_act_create.offset}) (i32.const ${needle_act_create.length})) (i32.const 0))
          (i32.gt_s (local.get $content_len) (i32.const 0)))
      (then
        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then
            (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 65536) (i32.const ${d_key_missing.length})))
            (return (i32.const ${d_key_missing.length}))
          )
        )

        (if (i32.le_u (global.get $repo_len) (i32.const 2))
          (then
            (drop (call $copy_mem (i32.const ${d_repo_missing.offset}) (i32.const 65536) (i32.const ${d_repo_missing.length})))
            (return (i32.const ${d_repo_missing.length}))
          )
        )

        ;; Save repo as default_repo for convenience on future calls
        (if (i32.gt_s (local.get $repo_json_len) (i32.const 2))
          (then
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_repo_prefix.offset}) (i32.const 200000) (i32.const ${d_storage_set_repo_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_repo_suffix.offset}) (local.get $p) (i32.const ${d_storage_set_repo_suffix.length})))
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
                (drop (call $copy_mem (i32.const ${needle_default_title.offset}) (i32.const 1303000) (i32.const ${needle_default_title.length})))
                (global.set $arg_len (i32.const ${needle_default_title.length}))
              )
            )
          )
        )

        ;; Build POST /repos/<owner/repo>/issues
        (local.set $p (call $copy_mem (i32.const ${d_http_create_issue_prefix.offset}) (i32.const 200000) (i32.const ${d_http_create_issue_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_create_issue_mid1.offset}) (local.get $p) (i32.const ${d_http_create_issue_mid1.length})))
        (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_create_issue_mid2.offset}) (local.get $p) (i32.const ${d_http_create_issue_mid2.length})))
        (local.set $p (call $copy_mem (i32.const 1303000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_create_issue_mid3.offset}) (local.get $p) (i32.const ${d_http_create_issue_mid3.length})))
        (local.set $p (call $append_escaped_issue_body (local.get $p)))
        (local.set $p (call $copy_mem (i32.const ${d_http_create_issue_suffix.offset}) (local.get $p) (i32.const ${d_http_create_issue_suffix.length})))

        (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
        (global.set $phase (i32.const 5))
        (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
        (return (i32.const 0))
      )
    )

    ;; G. "issues" (List open issues of a repository)
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const ${needle_act_issues.offset}) (i32.const ${needle_act_issues.length})) (i32.const 0))
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
            (drop (call $copy_mem (i32.const ${d_repo_missing.offset}) (i32.const 65536) (i32.const ${d_repo_missing.length})))
            (return (i32.const ${d_repo_missing.length}))
          )
        )

        (local.set $raw_len (call $load_api_token))
        (local.set $p (call $copy_mem (i32.const ${d_http_issues_prefix.offset}) (i32.const 200000) (i32.const ${d_http_issues_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
        (if (i32.gt_u (local.get $raw_len) (i32.const 0))
          (then
            (local.set $p (call $copy_mem (i32.const ${d_http_issues_mid_auth.offset}) (local.get $p) (i32.const ${d_http_issues_mid_auth.length})))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const ${d_http_issues_suffix_auth.offset}) (local.get $p) (i32.const ${d_http_issues_suffix_auth.length})))
          )
          (else
            (local.set $p (call $copy_mem (i32.const ${d_http_issues_suffix_noauth.offset}) (local.get $p) (i32.const ${d_http_issues_suffix_noauth.length})))
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
          (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const ${needle_act_search.offset}) (i32.const ${needle_act_search.length})) (i32.const 0))
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
            (local.set $p (call $copy_mem (i32.const ${d_http_search_auth_prefix.offset}) (i32.const 200000) (i32.const ${d_http_search_auth_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1308000) (local.get $p) (global.get $url_q_len)))
            (if (i32.gt_u (local.get $raw_len) (i32.const 0))
              (then
                (local.set $p (call $copy_mem (i32.const ${d_http_search_auth_mid.offset}) (local.get $p) (i32.const ${d_http_search_auth_mid.length})))
                (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
                (local.set $p (call $copy_mem (i32.const ${d_http_search_auth_suffix.offset}) (local.get $p) (i32.const ${d_http_search_auth_suffix.length})))
              )
              (else
                (local.set $p (call $copy_mem (i32.const ${d_http_search_noauth_suffix.offset}) (local.get $p) (i32.const ${d_http_search_noauth_suffix.length})))
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
        (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 65536) (i32.const ${d_key_missing.length})))
        (return (i32.const ${d_key_missing.length}))
      )
    )
    (local.set $p (call $copy_mem (i32.const ${d_http_my_repos_prefix.offset}) (i32.const 200000) (i32.const ${d_http_my_repos_prefix.length})))
    (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
    (local.set $p (call $copy_mem (i32.const ${d_http_my_repos_suffix.offset}) (local.get $p) (i32.const ${d_http_my_repos_suffix.length})))
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

    (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const ${needle_status_200.offset}) (i32.const ${needle_status_200.length})))
    (local.set $is_200 (i32.ge_s (local.get $idx) (i32.const 0)))

    (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const ${needle_status_201.offset}) (i32.const ${needle_status_201.length})))
    (local.set $is_201 (i32.ge_s (local.get $idx) (i32.const 0)))

    ;; ─── Phase 1: Config Verification ───
    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        (if (local.get $is_200)
          (then
            ;; Extract "login":"..."
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const ${needle_login_field.offset}) (i32.const ${needle_login_field.length})))
            (local.set $title_start (i32.const 900000))
            (local.set $title_len (i32.const 6))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $title_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const ${needle_login_field.length})))
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
            (local.set $p (call $copy_mem (i32.const ${d_key_saved_ok_prefix.offset}) (i32.const 65536) (i32.const ${d_key_saved_ok_prefix.length})))
            (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len)))
            (local.set $p (call $copy_mem (i32.const ${d_key_saved_ok_suffix.offset}) (local.get $p) (i32.const ${d_key_saved_ok_suffix.length})))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
          (else
            (drop (call $copy_mem (i32.const ${d_key_saved_invalid.offset}) (i32.const 65536) (i32.const ${d_key_saved_invalid.length})))
            (return (i32.const ${d_key_saved_invalid.length}))
          )
        )
      )
    )

    ;; ─── Phase 2: Status Check ───
    (if (i32.eq (global.get $phase) (i32.const 2))
      (then
        (if (local.get $is_200)
          (then
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const ${needle_login_field.offset}) (i32.const ${needle_login_field.length})))
            (local.set $title_start (i32.const 900000))
            (local.set $title_len (i32.const 6))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $title_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const ${needle_login_field.length})))
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
            (local.set $p (call $copy_mem (i32.const ${d_status_ok_prefix.offset}) (i32.const 65536) (i32.const ${d_status_ok_prefix.length})))
            (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len)))
            (local.set $p (call $copy_mem (i32.const ${d_status_ok_mid.offset}) (local.get $p) (i32.const ${d_status_ok_mid.length})))
            (if (i32.gt_u (global.get $repo_len) (i32.const 0))
              (then
                (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
              )
              (else
                (local.set $p (call $copy_mem (i32.const ${d_status_none_repo.offset}) (local.get $p) (i32.const ${d_status_none_repo.length})))
              )
            )
            (local.set $p (call $copy_mem (i32.const ${d_status_ok_suffix.offset}) (local.get $p) (i32.const ${d_status_ok_suffix.length})))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
          (else
            (drop (call $copy_mem (i32.const ${d_status_error.offset}) (i32.const 65536) (i32.const ${d_status_error.length})))
            (return (i32.const ${d_status_error.length}))
          )
        )
      )
    )

    ;; ─── Phase 3 & Phase 6: List User Repos (3) or Search Repos (6) ───
    (if (i32.or (i32.eq (global.get $phase) (i32.const 3)) (i32.eq (global.get $phase) (i32.const 6)))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const ${needle_msg_field.offset}) (i32.const ${needle_msg_field.length})))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const ${needle_msg_field.length})))
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
                (local.set $p (call $copy_mem (i32.const ${d_api_error_prefix.offset}) (i32.const 65536) (i32.const ${d_api_error_prefix.length})))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $i)))
                (local.set $p (call $copy_mem (i32.const ${d_api_error_suffix.offset}) (local.get $p) (i32.const ${d_api_error_suffix.length})))
                (return (i32.sub (local.get $p) (i32.const 65536)))
              )
            )
            (drop (call $copy_mem (i32.const ${d_empty_results.offset}) (i32.const 65536) (i32.const ${d_empty_results.length})))
            (return (i32.const ${d_empty_results.length}))
          )
        )

        (if (i32.eq (global.get $phase) (i32.const 3))
          (then
            (local.set $p (call $copy_mem (i32.const ${d_repos_header.offset}) (i32.const 65536) (i32.const ${d_repos_header.length})))
          )
          (else
            (local.set $p (call $copy_mem (i32.const ${d_search_header.offset}) (i32.const 65536) (i32.const ${d_search_header.length})))
          )
        )

        (local.set $scan_ptr (i32.const 900000))
        (local.set $scan_end (i32.add (i32.const 900000) (local.get $u_len)))
        (local.set $item_count (i32.const 0))

        (loop $parse_repos
          (if (i32.and (i32.lt_u (local.get $item_count) (i32.const 6)) (i32.lt_u (local.get $scan_ptr) (local.get $scan_end)))
            (then
              (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const ${needle_full_name.offset}) (i32.const ${needle_full_name.length})))
              (if (i32.ge_s (local.get $idx) (i32.const 0))
                (then
                  (local.set $title_start (i32.add (i32.add (local.get $scan_ptr) (local.get $idx)) (i32.const ${needle_full_name.length})))
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
                  (local.set $p (call $copy_mem (i32.const ${d_bullet_repo.offset}) (local.get $p) (i32.const ${d_bullet_repo.length})))
                  (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len)))
                  (local.set $p (call $copy_mem (i32.const ${d_bullet_mid.offset}) (local.get $p) (i32.const ${d_bullet_mid.length})))
                  (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len)))

                  ;; Check for description within next 800 bytes
                  (local.set $scan_ptr (i32.add (local.get $title_start) (local.get $title_len)))
                  (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.const 800) (i32.const ${needle_desc_resp.offset}) (i32.const ${needle_desc_resp.length})))
                  (if (i32.ge_s (local.get $idx) (i32.const 0))
                    (then
                      (local.set $desc_start (i32.add (i32.add (local.get $scan_ptr) (local.get $idx)) (i32.const ${needle_desc_resp.length})))
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
                          (local.set $p (call $copy_mem (i32.const ${d_bullet_desc.offset}) (local.get $p) (i32.const ${d_bullet_desc.length})))
                          (local.set $p (call $copy_mem (local.get $desc_start) (local.get $p) (local.get $desc_len)))
                          (local.set $p (call $copy_mem (i32.const ${d_newline.offset}) (local.get $p) (i32.const ${d_newline.length})))
                        )
                        (else
                          (local.set $p (call $copy_mem (i32.const ${d_bullet_end.offset}) (local.get $p) (i32.const ${d_bullet_end.length})))
                        )
                      )
                    )
                    (else
                      (local.set $p (call $copy_mem (i32.const ${d_bullet_end.offset}) (local.get $p) (i32.const ${d_bullet_end.length})))
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
            (drop (call $copy_mem (i32.const ${d_empty_results.offset}) (i32.const 65536) (i32.const ${d_empty_results.length})))
            (return (i32.const ${d_empty_results.length}))
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
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const ${needle_msg_field.offset}) (i32.const ${needle_msg_field.length})))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const ${needle_msg_field.length})))
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
                (local.set $p (call $copy_mem (i32.const ${d_api_error_prefix.offset}) (i32.const 65536) (i32.const ${d_api_error_prefix.length})))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $i)))
                (local.set $p (call $copy_mem (i32.const ${d_api_error_suffix.offset}) (local.get $p) (i32.const ${d_api_error_suffix.length})))
                (return (i32.sub (local.get $p) (i32.const 65536)))
              )
            )
            (drop (call $copy_mem (i32.const ${d_empty_results.offset}) (i32.const 65536) (i32.const ${d_empty_results.length})))
            (return (i32.const ${d_empty_results.length}))
          )
        )

        (local.set $p (call $copy_mem (i32.const ${d_issues_header_prefix.offset}) (i32.const 65536) (i32.const ${d_issues_header_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_mem (i32.const ${d_issues_header_suffix.offset}) (local.get $p) (i32.const ${d_issues_header_suffix.length})))

        (local.set $scan_ptr (i32.const 900000))
        (local.set $scan_end (i32.add (i32.const 900000) (local.get $u_len)))
        (local.set $item_count (i32.const 0))

        (loop $parse_issues
          (if (i32.and (i32.lt_u (local.get $item_count) (i32.const 6)) (i32.lt_u (local.get $scan_ptr) (local.get $scan_end)))
            (then
              (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const ${needle_html_url.offset}) (i32.const ${needle_html_url.length})))
              (if (i32.ge_s (local.get $idx) (i32.const 0))
                (then
                  ;; url_start points right after "https://github.com/"
                  (local.set $url_start (i32.add (i32.add (local.get $scan_ptr) (local.get $idx)) (i32.const ${needle_html_url.length})))
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
                  (local.set $title_start (i32.const ${needle_fallback_item.offset}))
                  (local.set $title_len (i32.const ${needle_fallback_item.length}))
                  (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const ${needle_title_resp.offset}) (i32.const ${needle_title_resp.length})))
                  (if (i32.ge_s (local.get $idx) (i32.const 0))
                    (then
                      (local.set $title_start (i32.add (i32.add (local.get $scan_ptr) (local.get $idx)) (i32.const ${needle_title_resp.length})))
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

                  (local.set $p (call $copy_mem (i32.const ${d_bullet_issue.offset}) (local.get $p) (i32.const ${d_bullet_issue.length})))
                  (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len)))
                  (local.set $p (call $copy_mem (i32.const ${d_bullet_mid.offset}) (local.get $p) (i32.const ${d_bullet_mid.length})))
                  (local.set $p (call $copy_mem (local.get $url_start) (local.get $p) (local.get $url_len)))
                  (local.set $p (call $copy_mem (i32.const ${d_bullet_end.offset}) (local.get $p) (i32.const ${d_bullet_end.length})))

                  (local.set $item_count (i32.add (local.get $item_count) (i32.const 1)))
                  (br $parse_issues)
                )
              )
            )
          )
        )

        (if (i32.eqz (local.get $item_count))
          (then
            (drop (call $copy_mem (i32.const ${d_empty_results.offset}) (i32.const 65536) (i32.const ${d_empty_results.length})))
            (return (i32.const ${d_empty_results.length}))
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
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const ${needle_msg_field.offset}) (i32.const ${needle_msg_field.length})))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const ${needle_msg_field.length})))
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
                (local.set $p (call $copy_mem (i32.const ${d_api_error_prefix.offset}) (i32.const 65536) (i32.const ${d_api_error_prefix.length})))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $i)))
                (local.set $p (call $copy_mem (i32.const ${d_api_error_suffix.offset}) (local.get $p) (i32.const ${d_api_error_suffix.length})))
                (return (i32.sub (local.get $p) (i32.const 65536)))
              )
            )
            (local.set $p (call $copy_mem (i32.const ${d_api_error_prefix.offset}) (i32.const 65536) (i32.const ${d_api_error_prefix.length})))
            (local.set $p (call $copy_mem (i32.const ${d_api_error_suffix.offset}) (local.get $p) (i32.const ${d_api_error_suffix.length})))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
        )

        ;; Extract "html_url":"https://github.com/..." (full URL starts at idx + 12)
        (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const ${needle_html_url.offset}) (i32.const ${needle_html_url.length})))
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
        (local.set $p (call $copy_mem (i32.const ${d_create_ok_prefix.offset}) (i32.const 65536) (i32.const ${d_create_ok_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 1303000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_mem (i32.const ${d_create_ok_mid.offset}) (local.get $p) (i32.const ${d_create_ok_mid.length})))
        (local.set $p (call $copy_mem (local.get $url_start) (local.get $p) (local.get $url_len)))
        (local.set $p (call $copy_mem (i32.const ${d_create_ok_mid2.offset}) (local.get $p) (i32.const ${d_create_ok_mid2.length})))

        (if (i32.gt_u (global.get $preview_len) (i32.const 0))
          (then
            (local.set $prev_copy_len (global.get $preview_len))
            (if (i32.gt_u (local.get $prev_copy_len) (i32.const 12000))
              (then (local.set $prev_copy_len (i32.const 12000)))
            )
            (local.set $p (call $copy_mem (i32.const 1600000) (local.get $p) (local.get $prev_copy_len)))
          )
        )

        (local.set $p (call $copy_mem (i32.const ${d_create_ok_suffix.offset}) (local.get $p) (i32.const ${d_create_ok_suffix.length})))
        (return (i32.sub (local.get $p) (i32.const 65536)))
      )
    )

    (drop (call $copy_mem (i32.const ${d_help.offset}) (i32.const 65536) (i32.const ${d_help.length})))
    (i32.const ${d_help.length})
  )
)
`;

const watPath = path.join(pluginDir, 'plugin.wat');
const wasmPath = path.join(pluginDir, 'plugin.wasm');

fs.writeFileSync(watPath, watContent, 'utf8');
console.log('✅ Generated plugin.wat successfully:', watPath);

execSync(`wat2wasm "${watPath}" -o "${wasmPath}"`, { stdio: 'inherit' });
console.log('✅ Compiled plugin.wasm successfully:', wasmPath);

const wasmBytes = fs.readFileSync(wasmPath);
const wasmSha256 = crypto.createHash('sha256').update(wasmBytes).digest('hex');
console.log('🔑 WASM SHA-256:', wasmSha256);

const manifest = {
  $schema: "../../../schemas/plugin.manifest.v1.schema.json",
  schemaVersion: 1,
  id: "com.chattree.official.github",
  version: "1.0.0",
  name: "GitHub Integration",
  description: "Official GitHub developer integration powered by natural language and AI tool calling. Draft and open complete technical Issues, inspect repository issues, list your repositories, and search GitHub directly from chat.",
  author: "Chattree Core Team",
  primaryCommand: "github",
  aliases: [
    "gh",
    "git"
  ],
  type: "imported",
  category: "devtools",
  capabilities: [
    "network.http",
    "storage.private"
  ],
  tags: [
    "github",
    "git",
    "devtools",
    "issues",
    "repositories",
    "code",
    "official"
  ],
  iconUrl: "https://raw.githubusercontent.com/Ponce5/Chattree/main/plugins/official/github/icon.png?v=1.0.0",
  bannerUrl: "https://raw.githubusercontent.com/Ponce5/Chattree/main/plugins/official/github/banner.png?v=1.0.0",
  changelog: "1.0.0: Initial official release of GitHub Integration with 100% natural language AI workflow for Issue drafting/creation, repository inspection, issue tracking, and global repository search.",
  runtime: "wasm",
  entrypoint: "github_entry",
  wasmPath: "plugin.wasm",
  wasmSha256: wasmSha256,
  runtimeApiVersion: "1.0.0",
  maxMemoryPages: 64,
  timeoutMs: 35000,
  fuelLimit: 100000000,
  inputOffset: 0,
  outputOffset: 65536,
  maxPayloadSizeBytes: 65536,
  tools: [
    {
      id: "com.chattree.official.github.workspace",
      command: "github",
      displayName: "GitHub Workspace",
      description: "Integración oficial de GitHub que funciona 100% con lenguaje natural. Permite crear Issues técnicos completos redactados por IA (action='create'), listar los issues abiertos de un repositorio (action='issues'), ver tus repositorios recientes (action='repos'), buscar repositorios en GitHub (action='search'), configurar un repositorio predeterminado (action='set_repo') o configurar tu Personal Access Token (action='config'). Cuando el usuario pida crear o reportar un issue, bug, mejora o tarea (action='create'), tú DEBES redactar y desarrollar por completo el cuerpo técnico del issue en 'content' (contexto, descripción detallada, pasos o propuesta técnica y criterios de aceptación separados por \\n\\n) y un título claro en 'title'. No uses comillas dobles literales dentro de 'content' (usa comillas simples '). Emite únicamente la llamada JSON válida.",
      capabilities: [
        "network.http",
        "storage.private"
      ],
      intentContract: {
        intent: "github_action",
        validIntents: [
          "create",
          "issues",
          "repos",
          "search",
          "set_repo",
          "status",
          "config",
          "disconnect",
          "help"
        ],
        description: "Interpreta cualquier solicitud en lenguaje natural para GitHub y emite UNA SOLA llamada JSON válida. Si el usuario pide crear un issue, reportar un bug o proponer una funcionalidad (action='create'), genera un 'title' claro y redacta todo el desarrollo técnico estructurado en 'content' usando saltos de línea \\n\\n y sin comillas dobles literales.",
        fields: [
          {
            name: "action",
            key: "action",
            type: "string",
            description: "Acción a realizar: 'create' (crear un nuevo Issue redactando su contenido completo), 'issues' (listar issues abiertos de un repositorio), 'repos' (listar mis repositorios recientes), 'search' (buscar repositorios en GitHub por tema/tecnología), 'set_repo' (guardar repositorio predeterminado owner/repo), 'status' (verificar conexión), 'config' (guardar token ghp_ o github_pat_), 'disconnect' (desconectar cuenta) o 'help' (mostrar ayuda).",
            required: true
          },
          {
            name: "repo",
            key: "repo",
            type: "string",
            description: "Repositorio objetivo en formato 'owner/repo' (por ejemplo 'Ponce5/Chattree'). Inclúyelo cuando el usuario mencione el repositorio para crear un issue, ver issues o configurar el repositorio por defecto.",
            required: false
          },
          {
            name: "title",
            key: "title",
            type: "string",
            description: "Título claro, técnico y conciso del Issue a crear en GitHub (máximo 80 caracteres). Ejemplo: 'Optimización de consumo de batería en segundo plano'.",
            required: false
          },
          {
            name: "content",
            key: "content",
            type: "string",
            description: "Cuerpo completo y bien estructurado en Markdown del Issue a crear en GitHub (obligatorio cuando action='create'). Redacta aquí la descripción técnica detallada, contexto, pasos/propuesta de implementación y criterios de aceptación solicitados por el usuario (200 a 600 palabras). Separa las secciones con \\n\\n y no uses comillas dobles literales (usa comillas simples ').",
            required: false
          },
          {
            name: "query",
            key: "query",
            type: "string",
            description: "Término de búsqueda (cuando action='search'), o el token ghp_/github_pat_ (cuando action='config'), o el nombre 'owner/repo' (si no se puso en 'repo').",
            required: false
          }
        ],
        examples: [
          {
            input: "creame un issue en Ponce5/Chattree sobre implementar modo offline con sincronizacion automatica",
            output: {
              tool: "github",
              action: "create",
              repo: "Ponce5/Chattree",
              title: "Implementar modo offline con cola de sincronización automática",
              content: "## Contexto y Objetivo\nActualmente algunas operaciones de red requieren conexión activa inmediata. Se propone diseñar un modo offline resiliente que almacene las operaciones pendientes localmente y las sincronice automáticamente al recuperar la conectividad.\n\n## Propuesta Técnica\n1. Cola Persistente Local\n• Almacenar eventos y mutaciones pendientes en almacenamiento local cifrado con estado ('pending', 'syncing', 'failed').\n\n2. Monitor de Conectividad\n• Detectar cambios de red y disparar el vaciado de la cola con backoff exponencial.\n\n3. Resolución de Conflictos\n• Aplicar marcas de tiempo (timestamps) e idempotencia para evitar duplicados.\n\n## Criterios de Aceptación\n• El usuario puede registrar acciones sin conexión sin perder datos.\n• Al reconectar, las operaciones se sincronizan en segundo plano y actualizan el estado en la interfaz."
            }
          },
          {
            input: "muéstrame los issues abiertos del repositorio Ponce5/Chattree",
            output: {
              tool: "github",
              action: "issues",
              repo: "Ponce5/Chattree"
            }
          },
          {
            input: "muéstrame mis repositorios recientes de github",
            output: {
              tool: "github",
              action: "repos"
            }
          },
          {
            input: "busca en github repositorios de webassembly en flutter",
            output: {
              tool: "github",
              action: "search",
              query: "webassembly flutter"
            }
          },
          {
            input: "configura mi token de github ghp_1234567890abcdef",
            output: {
              tool: "github",
              action: "config",
              query: "ghp_1234567890abcdef"
            }
          }
        ],
        maxResponseTokens: 3000
      }
    }
  ]
};

const manifestPath = path.join(pluginDir, 'plugin.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('✅ Generated plugin.json v1.0.0 successfully:', manifestPath);
