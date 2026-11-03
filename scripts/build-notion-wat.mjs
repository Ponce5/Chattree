import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDir = path.resolve(__dirname, '../plugins/official/notion');

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
// 1303000..1306000: Extracted & escaped Title / Query (3 KB)
// 1306000..1307000: Extracted Operation / Action string (1 KB)
// 1307000..1308000: Parent Page ID buffer (1 KB)
// 1310000..1380000: Lowercased Input buffer (70 KB)
// 1400000..1460000: Raw extracted Content buffer (60 KB)
// 1500000..1560000: Escaped Content buffer for Notion HTTP JSON (60 KB)
// 1600000..1660000: Readable Content buffer for Chat Preview (60 KB)

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
const s_help = `📝 **Notion Workspace Integration (IA & Lenguaje Natural)**

Conecta tu espacio de trabajo de Notion con Chattree y gestiona todo en **lenguaje natural**. La IA redacta y estructura automáticamente el contenido completo de tus páginas.

**Ejemplos de uso en lenguaje natural con \`/notion\`:**
• \`/notion créame una página de ideas de app donde enliste las mejores ideas para este 2027\`
• \`/notion crea una nota explicando la arquitectura limpia en Flutter con ejemplos\`
• \`/notion busca mis apuntes sobre inteligencia artificial\`
• \`/notion muéstrame mis páginas recientes de Notion\`
• \`/notion configura mi token ntn_tu_integration_secret\`
• \`/notion verifica el estado de mi conexión\`
• \`/notion desconectar cuenta\`

*¿Cómo conectar tu Notion?*
1. Crea tu integración en https://www.notion.so/profile/integrations y copia tu **Internal Integration Secret** (\`ntn_...\` o \`secret_...\`).
2. En Notion, abre la página donde quieras guardar tus notas, toca el menú **'...'** (arriba a la derecha) -> **Conexiones** (Add connections) y selecciona tu integración.
3. En Chattree escribe: \`/notion configura mi token <tu_token>\`.`;

const s_key_saved_ok = `✅ **Notion configurado y verificado exitosamente.**\n\nTu token de integración está activo y listo para usarse con lenguaje natural.\n\nAhora puedes pedirle a Chattree cosas como:\n• \`/notion créame una página con las mejores ideas de negocio para 2027\`\n• \`/notion busca mis notas sobre el proyecto\`\n• \`/notion muéstrame mis páginas recientes\``;
const s_key_saved_invalid = `⚠️ **Token guardado pero no se pudo validar con Notion.**\n\nNotion devolvió un error de autenticación. Verifica que tu token sea un 'Internal Integration Secret' válido (\`ntn_...\` o \`secret_...\`) creado en https://www.notion.so/profile/integrations y que esté activo.`;
const s_key_missing = `⚠️ **Notion no está configurado.**\n\nPor favor registra tu Integration Secret diciendo en lenguaje natural:\n\`/notion configura mi token <tu_integration_secret>\`\n\nPuedes obtener tu clave en https://www.notion.so/profile/integrations`;
const s_disconnected = `✅ **Desconectado de Notion.**\n\nSe ha eliminado tu token de integración de este dispositivo.`;

const s_status_ok = `✅ **Conexión con Notion activa y saludable.**\n\n• **API:** Notion API v1 (2022-06-28)\n• **Integración:** Autenticada y lista\n• **Modo:** 100% Lenguaje Natural con IA de Chattree (creación de páginas con desarrollo completo de contenido, búsqueda semántica y listado)\n\nPide lo que necesites en lenguaje natural con \`/notion <tu solicitud>\`.`;
const s_status_error = `❌ **No se pudo conectar a Notion.**\n\nEl token guardado no es válido o ha expirado. Configura uno nuevo diciendo:\n\`/notion configura mi token <tu_token>\``;

const s_search_header = `📝 **Resultados encontrados en Notion:**\n\n`;
const s_search_empty = `ℹ️ **No se encontraron resultados en Notion.**\n\nRecuerda que para que una página o base de datos sea accesible, debes compartirla con tu integración en Notion (Menú **'...'** -> **Conexiones** / Add connections -> Tu Integración).`;
const s_search_error = `❌ **Error al consultar Notion.**\n\nVerifica tu conexión a internet y comprueba que tu token siga siendo válido con \`/notion verifica mi conexión\`.`;

const s_parent_saved = `✅ **Página base configurada exitosamente.**\n\nTodas las nuevas páginas que pidas crear en Notion se guardarán dentro de esta página.`;
const s_create_no_parent = `⚠️ **No se encontró ninguna página compartida en tu espacio de trabajo de Notion.**\n\nNotion requiere que las páginas nuevas se creen dentro de una página existente a la que tu integración tenga acceso. Abre Notion, entra a una página y en el menú **'...'** -> **Conexiones** (Add connections) añade tu integración.`;
const s_create_ok_prefix = `✅ **Página creada exitosamente en Notion:**\n\n📄 [**`;
const s_create_ok_mid = `**](`;
const s_create_ok_mid2 = `)\n\n---\n\n`;
const s_create_ok_suffix = `\n\n---\n*Tu página ya está guardada y sincronizada en tu espacio de trabajo de Notion.*`;
const s_create_error_prefix = `❌ **Error de Notion:** `;
const s_create_error_suffix = `\n\nVerifica que tu integración tenga permisos de edición en la página compartida de Notion.`;

// Storage templates
const s_storage_get = JSON.stringify({ api: 'storage', operation: 'get', payload: { key: 'api_token' } });
const s_storage_set_prefix = '{"api":"storage","operation":"set","payload":{"key":"api_token","value":"';
const s_storage_set_suffix = '"}}';
const s_storage_delete = JSON.stringify({ api: 'storage', operation: 'delete', payload: { key: 'api_token' } });

const s_storage_get_parent = JSON.stringify({ api: 'storage', operation: 'get', payload: { key: 'parent_id' } });
const s_storage_set_parent_prefix = '{"api":"storage","operation":"set","payload":{"key":"parent_id","value":"';
const s_storage_set_parent_suffix = '"}}';

// HTTP request templates
// 1. GET /v1/users/me
const s_http_me_prefix = '{"api":"network","operation":"http_request","payload":{"url":"https://api.notion.com/v1/users/me","method":"GET","headers":{"Authorization":"Bearer ';
const s_http_me_suffix = '","Notion-Version":"2022-06-28","Content-Type":"application/json"},"timeoutMs":20000}}';

// 2. POST /v1/search
const s_http_search_prefix = '{"api":"network","operation":"http_request","payload":{"url":"https://api.notion.com/v1/search","method":"POST","headers":{"Authorization":"Bearer ';
const s_http_search_mid1 = '","Notion-Version":"2022-06-28","Content-Type":"application/json"},"body":"{\\"query\\":\\"';
const s_http_search_mid2 = '\\",\\"page_size\\":5,\\"sort\\":{\\"direction\\":\\"descending\\",\\"timestamp\\":\\"last_edited_time\\"}}","timeoutMs":25000}}';
const s_http_search_empty_body = '","Notion-Version":"2022-06-28","Content-Type":"application/json"},"body":"{\\"page_size\\":5,\\"sort\\":{\\"direction\\":\\"descending\\",\\"timestamp\\":\\"last_edited_time\\"}}","timeoutMs":25000}}';

// 3. POST /v1/search (Find parent page - filter to page object so we never try to create a page with page_id pointing to a database)
const s_http_parent_search_body = '","Notion-Version":"2022-06-28","Content-Type":"application/json"},"body":"{\\"filter\\":{\\"value\\":\\"page\\",\\"property\\":\\"object\\"},\\"page_size\\":3,\\"sort\\":{\\"direction\\":\\"descending\\",\\"timestamp\\":\\"last_edited_time\\"}}","timeoutMs":20000}}';

// 4. POST /v1/pages (Create page with title + multiple paragraph blocks)
const s_http_create_prefix = '{"api":"network","operation":"http_request","payload":{"url":"https://api.notion.com/v1/pages","method":"POST","headers":{"Authorization":"Bearer ';
const s_http_create_mid1 = '","Notion-Version":"2022-06-28","Content-Type":"application/json"},"body":"{\\"parent\\":{\\"page_id\\":\\"';
const s_http_create_mid2 = '\\"},\\"properties\\":{\\"title\\":{\\"title\\":[{\\"text\\":{\\"content\\":\\"';
const s_http_create_no_children_suffix = '\\"}}]}}","timeoutMs":25000}}';
const s_http_create_children_open = '\\"}}]}},\\"children\\":[{\\"object\\":\\"block\\",\\"type\\":\\"paragraph\\",\\"paragraph\\":{\\"rich_text\\":[{\\"type\\":\\"text\\",\\"text\\":{\\"content\\":\\"';
const s_http_create_children_sep = '\\"}}]}},{\\"object\\":\\"block\\",\\"type\\":\\"paragraph\\",\\"paragraph\\":{\\"rich_text\\":[{\\"type\\":\\"text\\",\\"text\\":{\\"content\\":\\"';
const s_http_create_children_close = '\\"}}]}}]}","timeoutMs":25000}}';

// Register static messages
const d_help = registerData('help', s_help);
const d_key_saved_ok = registerData('key_saved_ok', s_key_saved_ok);
const d_key_saved_invalid = registerData('key_saved_invalid', s_key_saved_invalid);
const d_key_missing = registerData('key_missing', s_key_missing);
const d_disconnected = registerData('disconnected', s_disconnected);

const d_status_ok = registerData('status_ok', s_status_ok);
const d_status_error = registerData('status_error', s_status_error);

const d_search_header = registerData('search_header', s_search_header);
const d_search_empty = registerData('search_empty', s_search_empty);
const d_search_error = registerData('search_error', s_search_error);

const d_parent_saved = registerData('parent_saved', s_parent_saved);
const d_create_no_parent = registerData('create_no_parent', s_create_no_parent);
const d_create_ok_prefix = registerData('create_ok_prefix', s_create_ok_prefix);
const d_create_ok_mid = registerData('create_ok_mid', s_create_ok_mid);
const d_create_ok_mid2 = registerData('create_ok_mid2', s_create_ok_mid2);
const d_create_ok_suffix = registerData('create_ok_suffix', s_create_ok_suffix);
const d_create_error_prefix = registerData('create_error_prefix', s_create_error_prefix);
const d_create_error_suffix = registerData('create_error_suffix', s_create_error_suffix);

// Register storage strings
const d_storage_get = registerData('storage_get', s_storage_get);
const d_storage_set_prefix = registerData('storage_set_prefix', s_storage_set_prefix);
const d_storage_set_suffix = registerData('storage_set_suffix', s_storage_set_suffix);
const d_storage_delete = registerData('storage_delete', s_storage_delete);

const d_storage_get_parent = registerData('storage_get_parent', s_storage_get_parent);
const d_storage_set_parent_prefix = registerData('storage_set_parent_prefix', s_storage_set_parent_prefix);
const d_storage_set_parent_suffix = registerData('storage_set_parent_suffix', s_storage_set_parent_suffix);

// Register HTTP strings
const d_http_me_prefix = registerData('http_me_prefix', s_http_me_prefix);
const d_http_me_suffix = registerData('http_me_suffix', s_http_me_suffix);

const d_http_search_prefix = registerData('http_search_prefix', s_http_search_prefix);
const d_http_search_mid1 = registerData('http_search_mid1', s_http_search_mid1);
const d_http_search_mid2 = registerData('http_search_mid2', s_http_search_mid2);
const d_http_search_empty_body = registerData('http_search_empty_body', s_http_search_empty_body);
const d_http_parent_search_body = registerData('http_parent_search_body', s_http_parent_search_body);

const d_http_create_prefix = registerData('http_create_prefix', s_http_create_prefix);
const d_http_create_mid1 = registerData('http_create_mid1', s_http_create_mid1);
const d_http_create_mid2 = registerData('http_create_mid2', s_http_create_mid2);
const d_http_create_no_children_suffix = registerData('http_create_no_children_suffix', s_http_create_no_children_suffix);
const d_http_create_children_open = registerData('http_create_children_open', s_http_create_children_open);
const d_http_create_children_sep = registerData('http_create_children_sep', s_http_create_children_sep);
const d_http_create_children_close = registerData('http_create_children_close', s_http_create_children_close);

// JSON field needles (strictly for AI JSON contract)
const needle_val_field = registerData('needle_val_field', '"value":"');
const needle_json_operation = registerData('needle_json_operation', '"operation":"');
const needle_json_action = registerData('needle_json_action', '"action":"');
const needle_json_query = registerData('needle_json_query', '"query":"');
const needle_json_title = registerData('needle_json_title', '"title":"');
const needle_json_content = registerData('needle_json_content', '"content":"');
const needle_json_extra = registerData('needle_json_extra', '"extra":"');
const needle_json_token = registerData('needle_json_token', '"token":"');
const needle_json_parent = registerData('needle_json_parent', '"parent_id":"');

// Action value needles (matched against extracted operation/action only)
const needle_act_create = registerData('needle_act_create', 'create');
const needle_act_search = registerData('needle_act_search', 'search');
const needle_act_list = registerData('needle_act_list', 'list');
const needle_act_status = registerData('needle_act_status', 'status');
const needle_act_config = registerData('needle_act_config', 'config');
const needle_act_parent = registerData('needle_act_parent', 'parent');
const needle_act_disconnect = registerData('needle_act_disconnect', 'disconnect');
const needle_act_help = registerData('needle_act_help', 'help');

// Token prefixes for direct token paste convenience
const needle_secret = registerData('needle_secret', 'secret_');
const needle_ntn = registerData('needle_ntn', 'ntn_');
const needle_default_title = registerData('needle_default_title', 'Nota de Notion');

// Response parsing needles
const needle_status_200 = registerData('needle_status_200', '"statusCode":200');
const needle_results_empty = registerData('needle_results_empty', '"results":[]');
const needle_id_field = registerData('needle_id_field', '"id":"');
const needle_url_field = registerData('needle_url_field', '"url":"https://');
const needle_plain_text = registerData('needle_plain_text', '"plain_text":"');
const needle_msg_field = registerData('needle_msg_field', '"message":"');
const needle_pages_fallback = registerData('needle_pages_fallback', 'Página de Notion');

// Bullet points formatting
const d_bullet_page = registerData('bullet_page', '• 📄 [');
const d_bullet_mid = registerData('bullet_mid', '](');
const d_bullet_end = registerData('bullet_end', ')\n');

console.log(`Registered ${dataEntries.length} static data segments up to offset ${staticPtr}.`);

const dataSectionWat = dataEntries
  .map(e => `  ;; [${e.offset}] ${e.name} (${e.length}B)\n  (data (i32.const ${e.offset}) "${e.escaped}")`)
  .join('\n');

const watContent = `;; Chattree Official Notion Integration Plugin v1.2.0
;; - 100% AI Natural Language Intent Contract (no rigid keyword slicing)
;; - Preserves real line breaks (\\\\n) and splits long AI articles across multiple Notion paragraph blocks
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

    (local.set $res_len (call $host_call (i32.const ${d_storage_get.offset}) (i32.const ${d_storage_get.length}) (i32.const 1300000) (i32.const 1024)))
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

  ;; Loads stored Parent Page ID into 1307000
  (func $load_parent_id (result i32)
    (local $res_len i32)
    (local $val_idx i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)

    (local.set $res_len (call $host_call (i32.const ${d_storage_get_parent.offset}) (i32.const ${d_storage_get_parent.length}) (i32.const 1300000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 1300000) (local.get $res_len) (i32.const ${needle_val_field.offset}) (i32.const ${needle_val_field.length})))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_start (i32.add (i32.const 1300000) (i32.add (local.get $val_idx) (i32.const ${needle_val_field.length}))))
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
            (if (i32.eq (local.get $ch) (i32.const 92)) ;; '\'
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
          (if (i32.eq (local.get $ch) (i32.const 92)) ;; '\'
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
          (if (i32.eq (local.get $ch) (i32.const 34)) ;; '"' -> '\''
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

    (local.set $p (call $copy_mem (i32.const ${d_http_create_prefix.offset}) (i32.const 200000) (i32.const ${d_http_create_prefix.length})))
    (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
    (local.set $p (call $copy_mem (i32.const ${d_http_create_mid1.offset}) (local.get $p) (i32.const ${d_http_create_mid1.length})))
    (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $parent_len)))
    (local.set $p (call $copy_mem (i32.const ${d_http_create_mid2.offset}) (local.get $p) (i32.const ${d_http_create_mid2.length})))
    (local.set $p (call $copy_mem (i32.const 1303000) (local.get $p) (global.get $arg_len)))

    (local.set $total (global.get $preview_len))
    (if (i32.gt_u (local.get $total) (i32.const 0))
      (then
        (local.set $p (call $copy_mem (i32.const ${d_http_create_children_open.offset}) (local.get $p) (i32.const ${d_http_create_children_open.length})))
        (local.set $cur (i32.const 0))
        (local.set $first_block (i32.const 1))

        (loop $block_loop
          (if (i32.lt_u (local.get $cur) (local.get $total))
            (then
              (if (i32.eqz (local.get $first_block))
                (then
                  (local.set $p (call $copy_mem (i32.const ${d_http_create_children_sep.offset}) (local.get $p) (i32.const ${d_http_create_children_sep.length})))
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

        (local.set $p (call $copy_mem (i32.const ${d_http_create_children_close.offset}) (local.get $p) (i32.const ${d_http_create_children_close.length})))
      )
      (else
        (local.set $p (call $copy_mem (i32.const ${d_http_create_no_children_suffix.offset}) (local.get $p) (i32.const ${d_http_create_no_children_suffix.length})))
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
        (drop (call $copy_mem (i32.const ${d_help.offset}) (i32.const 65536) (i32.const ${d_help.length})))
        (return (i32.const ${d_help.length}))
      )
    )

    ;; 2. Direct token paste convenience (if user pastes secret_... or ntn_... directly)
    (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_secret.offset}) (i32.const ${needle_secret.length})))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_ntn.offset}) (i32.const ${needle_ntn.length})))
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
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_prefix.offset}) (i32.const 200000) (i32.const ${d_storage_set_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_suffix.offset}) (local.get $p) (i32.const ${d_storage_set_suffix.length})))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

            (local.set $p (call $copy_mem (i32.const ${d_http_me_prefix.offset}) (i32.const 200000) (i32.const ${d_http_me_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const ${d_http_me_suffix.offset}) (local.get $p) (i32.const ${d_http_me_suffix.length})))
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

    ;; Extract "title":"..." and "query":"..."
    (local.set $title_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_json_title.offset}) (i32.const ${needle_json_title.length}) (i32.const 1310000) (i32.const 1000)))
    (local.set $query_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_json_query.offset}) (i32.const ${needle_json_query.length}) (i32.const 1312000) (i32.const 1000)))

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
        (drop (call $host_call (i32.const ${d_storage_delete.offset}) (i32.const ${d_storage_delete.length}) (i32.const 1300000) (i32.const 1024)))
        (drop (call $copy_mem (i32.const ${d_disconnected.offset}) (i32.const 65536) (i32.const ${d_disconnected.length})))
        (return (i32.const ${d_disconnected.length}))
      )
    )

    ;; C. "status"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const ${needle_act_status.offset}) (i32.const ${needle_act_status.length})) (i32.const 0))
      (then
        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then
            (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 65536) (i32.const ${d_key_missing.length})))
            (return (i32.const ${d_key_missing.length}))
          )
        )
        (local.set $p (call $copy_mem (i32.const ${d_http_me_prefix.offset}) (i32.const 200000) (i32.const ${d_http_me_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_me_suffix.offset}) (local.get $p) (i32.const ${d_http_me_suffix.length})))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
        (global.set $phase (i32.const 2))
        (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
        (return (i32.const 0))
      )
    )

    ;; D. "config"
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
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_prefix.offset}) (i32.const 200000) (i32.const ${d_storage_set_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_suffix.offset}) (local.get $p) (i32.const ${d_storage_set_suffix.length})))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

            (local.set $p (call $copy_mem (i32.const ${d_http_me_prefix.offset}) (i32.const 200000) (i32.const ${d_http_me_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const ${d_http_me_suffix.offset}) (local.get $p) (i32.const ${d_http_me_suffix.length})))
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

    ;; E. "parent"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const ${needle_act_parent.offset}) (i32.const ${needle_act_parent.length})) (i32.const 0))
      (then
        (local.set $par_json_len (call $extract_json_raw (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_json_parent.offset}) (i32.const ${needle_json_parent.length}) (i32.const 1307000) (i32.const 60)))
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
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_parent_prefix.offset}) (i32.const 200000) (i32.const ${d_storage_set_parent_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $parent_len)))
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_parent_suffix.offset}) (local.get $p) (i32.const ${d_storage_set_parent_suffix.length})))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))
            (drop (call $copy_mem (i32.const ${d_parent_saved.offset}) (i32.const 65536) (i32.const ${d_parent_saved.length})))
            (return (i32.const ${d_parent_saved.length}))
          )
        )
      )
    )

    ;; F. "create" (or if "content" or "title" was provided by AI)
    (if (i32.or
          (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const ${needle_act_create.offset}) (i32.const ${needle_act_create.length})) (i32.const 0))
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
                (drop (call $copy_mem (i32.const ${needle_default_title.offset}) (i32.const 1303000) (i32.const ${needle_default_title.length})))
                (global.set $arg_len (i32.const ${needle_default_title.length}))
              )
            )
          )
        )

        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then
            (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 65536) (i32.const ${d_key_missing.length})))
            (return (i32.const ${d_key_missing.length}))
          )
        )

        (local.set $has_saved_parent (call $load_parent_id))
        (if (i32.gt_u (local.get $has_saved_parent) (i32.const 0))
          (then
            (return (call $send_create_page))
          )
        )

        ;; Auto-discover parent page in Notion workspace
        (local.set $p (call $copy_mem (i32.const ${d_http_search_prefix.offset}) (i32.const 200000) (i32.const ${d_http_search_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_parent_search_body.offset}) (local.get $p) (i32.const ${d_http_parent_search_body.length})))
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
        (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 65536) (i32.const ${d_key_missing.length})))
        (return (i32.const ${d_key_missing.length}))
      )
    )

    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const ${needle_act_list.offset}) (i32.const ${needle_act_list.length})) (i32.const 0))
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

    (local.set $p (call $copy_mem (i32.const ${d_http_search_prefix.offset}) (i32.const 200000) (i32.const ${d_http_search_prefix.length})))
    (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
    (if (i32.gt_u (global.get $arg_len) (i32.const 0))
      (then
        (local.set $p (call $copy_mem (i32.const ${d_http_search_mid1.offset}) (local.get $p) (i32.const ${d_http_search_mid1.length})))
        (local.set $p (call $copy_mem (i32.const 1303000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_search_mid2.offset}) (local.get $p) (i32.const ${d_http_search_mid2.length})))
      )
      (else
        (local.set $p (call $copy_mem (i32.const ${d_http_search_empty_body.offset}) (local.get $p) (i32.const ${d_http_search_empty_body.length})))
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
    (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const ${needle_status_200.offset}) (i32.const ${needle_status_200.length})))
    (local.set $is_200 (i32.ge_s (local.get $idx) (i32.const 0)))

    ;; ─── Phase 1: Config Verification ───
    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        (if (local.get $is_200)
          (then
            (drop (call $copy_mem (i32.const ${d_key_saved_ok.offset}) (i32.const 65536) (i32.const ${d_key_saved_ok.length})))
            (return (i32.const ${d_key_saved_ok.length}))
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
            (drop (call $copy_mem (i32.const ${d_status_ok.offset}) (i32.const 65536) (i32.const ${d_status_ok.length})))
            (return (i32.const ${d_status_ok.length}))
          )
          (else
            (drop (call $copy_mem (i32.const ${d_status_error.offset}) (i32.const 65536) (i32.const ${d_status_error.length})))
            (return (i32.const ${d_status_error.length}))
          )
        )
      )
    )

    ;; ─── Phase 3: Search / List ───
    (if (i32.eq (global.get $phase) (i32.const 3))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            (drop (call $copy_mem (i32.const ${d_search_error.offset}) (i32.const 65536) (i32.const ${d_search_error.length})))
            (return (i32.const ${d_search_error.length}))
          )
        )

        (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const ${needle_results_empty.offset}) (i32.const ${needle_results_empty.length})))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const ${d_search_empty.offset}) (i32.const 65536) (i32.const ${d_search_empty.length})))
            (return (i32.const ${d_search_empty.length}))
          )
        )

        (local.set $p (call $copy_mem (i32.const ${d_search_header.offset}) (i32.const 65536) (i32.const ${d_search_header.length})))

        (local.set $scan_ptr (i32.const 900000))
        (local.set $scan_end (i32.add (i32.const 900000) (local.get $u_len)))
        (local.set $item_count (i32.const 0))

        (loop $parse_items
          (if (i32.and (i32.lt_u (local.get $item_count) (i32.const 5)) (i32.lt_u (local.get $scan_ptr) (local.get $scan_end)))
            (then
              (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const ${needle_url_field.offset}) (i32.const ${needle_url_field.length})))
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

                  (local.set $title_start (i32.const ${needle_pages_fallback.offset}))
                  (local.set $title_len (i32.const ${needle_pages_fallback.length}))
                  (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const ${needle_plain_text.offset}) (i32.const ${needle_plain_text.length})))
                  (if (i32.ge_s (local.get $idx) (i32.const 0))
                    (then
                      (local.set $title_start (i32.add (i32.add (local.get $scan_ptr) (local.get $idx)) (i32.const ${needle_plain_text.length})))
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

                  (local.set $p (call $copy_mem (i32.const ${d_bullet_page.offset}) (local.get $p) (i32.const ${d_bullet_page.length})))
                  (if (i32.gt_u (local.get $title_len) (i32.const 0))
                    (then (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len))))
                    (else (local.set $p (call $copy_mem (i32.const ${needle_pages_fallback.offset}) (local.get $p) (i32.const ${needle_pages_fallback.length}))))
                  )
                  (local.set $p (call $copy_mem (i32.const ${d_bullet_mid.offset}) (local.get $p) (i32.const ${d_bullet_mid.length})))
                  (local.set $p (call $copy_mem (local.get $url_start) (local.get $p) (local.get $url_len)))
                  (local.set $p (call $copy_mem (i32.const ${d_bullet_end.offset}) (local.get $p) (i32.const ${d_bullet_end.length})))

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
            (drop (call $copy_mem (i32.const ${d_search_empty.offset}) (i32.const 65536) (i32.const ${d_search_empty.length})))
            (return (i32.const ${d_search_empty.length}))
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
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const ${needle_msg_field.offset}) (i32.const ${needle_msg_field.length})))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const ${needle_msg_field.length})))
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
                (local.set $p (call $copy_mem (i32.const ${d_create_error_prefix.offset}) (i32.const 65536) (i32.const ${d_create_error_prefix.length})))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $msg_len)))
                (local.set $p (call $copy_mem (i32.const ${d_create_error_suffix.offset}) (local.get $p) (i32.const ${d_create_error_suffix.length})))
                (return (i32.sub (local.get $p) (i32.const 65536)))
              )
            )
            (drop (call $copy_mem (i32.const ${d_create_no_parent.offset}) (i32.const 65536) (i32.const ${d_create_no_parent.length})))
            (return (i32.const ${d_create_no_parent.length}))
          )
        )

        ;; Extract first "id":"..." from results
        (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const ${needle_id_field.offset}) (i32.const ${needle_id_field.length})))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const ${d_create_no_parent.offset}) (i32.const 65536) (i32.const ${d_create_no_parent.length})))
            (return (i32.const ${d_create_no_parent.length}))
          )
        )

        (local.set $url_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const ${needle_id_field.length})))
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
        (local.set $p (call $copy_mem (i32.const ${d_storage_set_parent_prefix.offset}) (i32.const 200000) (i32.const ${d_storage_set_parent_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $parent_len)))
        (local.set $p (call $copy_mem (i32.const ${d_storage_set_parent_suffix.offset}) (local.get $p) (i32.const ${d_storage_set_parent_suffix.length})))
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
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const ${needle_msg_field.offset}) (i32.const ${needle_msg_field.length})))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const ${needle_msg_field.length})))
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
                (local.set $p (call $copy_mem (i32.const ${d_create_error_prefix.offset}) (i32.const 65536) (i32.const ${d_create_error_prefix.length})))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $msg_len)))
                (local.set $p (call $copy_mem (i32.const ${d_create_error_suffix.offset}) (local.get $p) (i32.const ${d_create_error_suffix.length})))
                (return (i32.sub (local.get $p) (i32.const 65536)))
              )
            )
            (local.set $p (call $copy_mem (i32.const ${d_create_error_prefix.offset}) (i32.const 65536) (i32.const ${d_create_error_prefix.length})))
            (local.set $p (call $copy_mem (i32.const ${d_create_error_suffix.offset}) (local.get $p) (i32.const ${d_create_error_suffix.length})))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
        )

        (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const ${needle_url_field.offset}) (i32.const ${needle_url_field.length})))
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

// Write schema-compliant plugin.json v1.2.0
const manifest = {
  $schema: "../../../schemas/plugin.manifest.v1.schema.json",
  schemaVersion: 1,
  id: "com.chattree.official.notion",
  version: "1.2.0",
  name: "Notion Integration",
  description: "Official Notion workspace integration powered 100% by natural language and AI tool calling. Ask in natural language to generate and save complete, structured pages, search notes, or inspect recent workspace updates.",
  author: "Chattree Core Team",
  primaryCommand: "notion",
  aliases: [
    "notes-notion",
    "workspace"
  ],
  type: "imported",
  category: "productivity",
  capabilities: [
    "network.http",
    "storage.private"
  ],
  tags: [
    "notion",
    "notes",
    "workspace",
    "productivity",
    "database",
    "official"
  ],
  iconUrl: "https://raw.githubusercontent.com/Ponce5/Chattree/main/plugins/official/notion/icon.png?v=1.2.0",
  bannerUrl: "https://raw.githubusercontent.com/Ponce5/Chattree/main/plugins/official/notion/banner.png?v=1.2.0",
  changelog: "1.2.0: 100% natural-language AI workflow. Fixed intentContract field keys, removed rigid keyword slicing, added multi-block paragraph content generation with real line breaks, and rich chat preview.",
  runtime: "wasm",
  entrypoint: "notion_entry",
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
      id: "com.chattree.official.notion.workspace",
      command: "notion",
      displayName: "Notion Workspace",
      description: "Integración oficial de Notion que funciona 100% con lenguaje natural. Cuando el usuario pida crear una página, nota, lista de ideas, resumen, guía o documento en Notion (con action='create'), tú DEBES redactar y desarrollar por completo todo el contenido solicitado en el campo 'content' (entre 300 y 700 palabras bien estructuradas con puntos, listas numeradas y secciones separadas por saltos de línea \\n\\n) y poner un título atractivo y breve en 'title'. NUNCA dejes 'content' vacío ni copies simplemente la instrucción del usuario como título. No uses comillas dobles literales dentro de 'content' (usa comillas simples '). Emite únicamente la llamada JSON válida sin texto adicional fuera del JSON.",
      capabilities: [
        "network.http",
        "storage.private"
      ],
      intentContract: {
        intent: "notion_action",
        validIntents: [
          "create",
          "search",
          "list",
          "status",
          "config",
          "parent",
          "disconnect",
          "help"
        ],
        description: "Interpreta cualquier petición en lenguaje natural para Notion y devuelve UNA SOLA llamada JSON válida. Si el usuario pide crear o redactar una página (action='create'), genera un 'title' claro y redacta todo el desarrollo completo, ideas, puntos o explicación detallada en 'content' usando saltos de línea \\n\\n y sin comillas dobles literales dentro del texto.",
        fields: [
          {
            name: "action",
            key: "action",
            type: "string",
            description: "Acción a ejecutar: 'create' (crear una página nueva desarrollando todo el tema solicitado), 'search' (buscar páginas en Notion), 'list' (listar páginas recientes), 'status' (verificar estado de conexión), 'config' (guardar API token secret_ o ntn_), 'parent' (configurar ID de página padre), 'disconnect' (desconectar cuenta) o 'help' (mostrar ayuda).",
            required: true
          },
          {
            name: "title",
            key: "title",
            type: "string",
            description: "Título claro, atractivo y conciso de la página a crear en Notion (máximo 80 caracteres). Ejemplo: 'Mejores Ideas de Apps para 2027'. NUNCA copies la oración literal del usuario como título.",
            required: false
          },
          {
            name: "content",
            key: "content",
            type: "string",
            description: "Cuerpo completo, extenso y bien estructurado de la página de Notion (obligatorio cuando action='create'). Redacta aquí todas las ideas, listas numeradas, viñetas (•), explicaciones y secciones solicitadas por el usuario (300 a 700 palabras). Separa los párrafos y puntos con \\n\\n. No uses comillas dobles literales dentro de content; usa comillas simples (').",
            required: false
          },
          {
            name: "query",
            key: "query",
            type: "string",
            description: "Término clave de búsqueda (cuando action='search'), o el token de integración secret_/ntn_ (cuando action='config'), o el ID de la página padre (cuando action='parent').",
            required: false
          }
        ],
        examples: [
          {
            input: "creame una pagina de ideas de app donde enliste las mejores ideas para este 2027 de app",
            output: {
              tool: "notion",
              action: "create",
              title: "Mejores Ideas de Apps para 2027",
              content: "Aquí tienes una selección de las mejores ideas de aplicaciones móviles y web con mayor potencial para 2027:\n\n1. Copiloto Financiero Personal con IA Local\n• Análisis automático de gastos e inversiones directamente en el dispositivo sin subir datos bancarios a la nube.\n• Alertas predictivas de suscripciones y optimización de ahorro mensual.\n\n2. Tutor Educativo Adaptativo Multimodal\n• Aprende el estilo de estudio de cada alumno y genera resúmenes, cuestionarios interactivos y explicaciones por voz en tiempo real.\n• Ideal para preparación universitaria, idiomas y certificaciones técnicas.\n\n3. Plataforma de Salud Preventiva y Longevidad\n• Integración con wearables para analizar sueño, variabilidad cardíaca y hábitos diarios.\n• Recomendaciones personalizadas de nutrición, descanso y entrenamiento.\n\n4. Asistente de Productividad y Automatización por Voz\n• Conecta calendario, notas, correo y tareas mediante comandos en lenguaje natural.\n• Ejecuta flujos de trabajo complejos sin necesidad de configurar reglas manuales.\n\n5. Marketplace Local de Economía Circular con Verificación IA\n• Permite vender, intercambiar o alquilar artículos cercanos con tasación automática de estado y precio mediante cámara."
            }
          },
          {
            input: "crea una nota en notion que explique qué es la fotosíntesis y sus etapas",
            output: {
              tool: "notion",
              action: "create",
              title: "La Fotosíntesis: Proceso y Etapas",
              content: "La fotosíntesis es el proceso metabólico mediante el cual las plantas, algas y cianobacterias transforman la energía luminosa del sol en energía química almacenada en moléculas orgánicas como la glucosa.\n\n1. Importancia Biológica\n• Produce el oxígeno molecular indispensable para la respiración de la mayoría de los seres vivos.\n• Es la base de las cadenas tróficas y captura dióxido de carbono atmosférico.\n\n2. Fase Luminosa (Reacciones dependientes de la luz)\n• Ocurre en las membranas de los tilacoides dentro de los cloroplastos.\n• La clorofila absorbe fotones, provocando la fotólisis del agua (liberando oxígeno) y generando ATP y NADPH.\n\n3. Fase Oscura o Ciclo de Calvin\n• Se lleva a cabo en el estroma del cloroplasto.\n• Utiliza el ATP y NADPH producidos en la fase luminosa para fijar el CO2 y sintetizar glucosa.\n\n4. Ecuación General\n6 CO2 + 6 H2O + Energía Lumínica -> C6H12O6 (Glucosa) + 6 O2"
            }
          },
          {
            input: "busca mis notas sobre arquitectura de software",
            output: {
              tool: "notion",
              action: "search",
              query: "arquitectura de software"
            }
          },
          {
            input: "muéstrame mis páginas recientes de notion",
            output: {
              tool: "notion",
              action: "list"
            }
          },
          {
            input: "configura mi token de notion ntn_1234567890abcdef",
            output: {
              tool: "notion",
              action: "config",
              query: "ntn_1234567890abcdef"
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
console.log('✅ Generated plugin.json v1.2.0 successfully:', manifestPath);
