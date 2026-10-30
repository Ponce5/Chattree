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
// 0..1023: Input buffer (1 KB)
// 1024..65535: Output buffer (64 KB)
// 70000..99999: Static data strings
// 100000..299999: HTTP Request buffer (200 KB)
// 300000..599999: Raw HTTP Response buffer (300 KB)
// 600000..899999: Unescaped HTTP Response buffer (300 KB)
// 1000000..1001000: Storage API scratch (1 KB)
// 1001000..1002000: API Token storage (1 KB)
// 1002000..1003000: Extracted Arg / Title / Query (1 KB)
// 1003000..1004000: Lowercased Input buffer (1 KB)
// 1004000..1005000: Parent Page ID buffer (100 B)

let staticPtr = 70000;
const dataEntries = [];

function registerData(name, str) {
  const d = toWatData(str);
  const offset = staticPtr;
  staticPtr += d.length + 16;
  dataEntries.push({ name, offset, length: d.length, escaped: d.escaped });
  return { offset, length: d.length };
}

// Static user-facing messages
const s_help = `📝 **Notion Workspace Integration**

Conecta tu espacio de trabajo de Notion directamente con Chattree mediante la API oficial de Notion con soporte total para lenguaje natural y comandos.

**Comandos disponibles:**
• \`/notion config <api_token>\` — Registra tu Integration Secret de Notion (\`secret_...\` o \`ntn_...\`)
• \`/notion status\` — Verifica el estado de la conexión con tu workspace
• \`/notion search <término>\` — Busca páginas y bases de datos por palabra clave
• \`/notion list\` — Muestra páginas editadas recientemente
• \`/notion create <título>\` — Crea una nueva página en tu espacio de trabajo
• \`/notion parent <page_id>\` — Configura manualmente la página padre donde guardar notas
• \`/notion disconnect\` — Desconecta y borra tu token guardado

**Ejemplos en lenguaje natural:**
• *"Busca en Notion notas sobre el proyecto"*
• *"Crea una página en Notion llamada Lista de Pendientes"*
• *"Verifica el estado de mi conexión a Notion"*

*¿Cómo conectar una página?*
1. Abre Notion y entra a una página (ej. "Notas" o "Chattree").
2. Ve al menú **'...'** (arriba a la derecha) -> **Conexiones** (Add connections) y selecciona tu integración.`;

const s_key_saved_ok = `✅ **Notion configurado y verificado exitosamente.**\n\nTu token de integración está activo y listo para usar.\n\nPrueba los siguientes comandos o pide en lenguaje natural:\n• \`/notion search <texto>\` — Buscar en tus páginas\n• \`/notion list\` — Ver páginas recientes\n• \`/notion create <título>\` — Crear una nueva página`;
const s_key_saved_invalid = `⚠️ **Token guardado pero no se pudo validar con Notion.**\n\nNotion devolvió un error de autenticación. Verifica que tu token sea un 'Internal Integration Secret' válido creado en notion.so/profile/integrations y que esté activo.`;
const s_key_missing = `⚠️ **Notion no está configurado.**\n\nPor favor registra tu API Token ejecutando:\n\`/notion config <tu_integration_secret>\`\n\nPuedes obtener tu clave en https://notion.so/profile/integrations`;
const s_disconnected = `✅ **Desconectado de Notion.**\n\nSe ha eliminado tu token de integración de este dispositivo.`;

const s_status_ok = `✅ **Conexión con Notion activa y saludable.**\n\n• **API:** Notion API v1 (2022-06-28)\n• **Integración:** Autenticada y lista\n• **Funcionalidades:** Búsqueda, lectura y creación de páginas\n• **Lenguaje Natural:** Habilitado con IA de Chattree\n\nPuedes buscar contenido con \`/notion search\` o crear páginas con \`/notion create <título>\`.`;
const s_status_error = `❌ **No se pudo conectar a Notion.**\n\nEl token guardado no es válido o ha expirado. Configura uno nuevo con:\n\`/notion config <tu_token>\``;

const s_search_header = `📝 **Resultados en Notion:**\n\n`;
const s_search_empty = `ℹ️ **No se encontraron resultados en Notion.**\n\nRecuerda que para que una página o base de datos aparezca en las búsquedas, debes compartirla con tu integración en Notion (Menú **'...'** -> **Conexiones** / Add connections -> Tu Integración).`;
const s_search_error = `❌ **Error al buscar en Notion.**\n\nVerifica tu conexión y comprueba que tu token siga siendo válido con \`/notion status\`.`;

const s_parent_saved = `✅ **Página base configurada exitosamente.**\n\nTodas las nuevas páginas creadas con \`/notion create\` se guardarán dentro de esta página.`;
const s_create_no_parent = `⚠️ **No se encontró ninguna página base en tu espacio de trabajo de Notion.**\n\nNotion requiere que las páginas nuevas se creen dentro de una página existente compartida. Por favor abre Notion, ve a una página y en el menú **'...'** -> **Conexiones** añade tu integración.\n\n*Tip:* También puedes configurar manualmente el ID de la página padre con \`/notion parent <id_de_pagina>\`.`;
const s_create_ok_prefix = `✅ **Página creada exitosamente en Notion:**\n\n📄 [**`;
const s_create_ok_mid = `**](`;
const s_create_ok_suffix = `)\n\nTu nueva nota ya está disponible en tu espacio de trabajo de Notion.`;
const s_create_error_prefix = `❌ **Error de Notion:** `;
const s_create_error_suffix = `\n\nVerifica que la integración tenga permisos de edición en la página compartida.`;

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

// 3. POST /v1/search (Find parent page - without filter so both pages and databases match)
const s_http_parent_search_body = '","Notion-Version":"2022-06-28","Content-Type":"application/json"},"body":"{\\"page_size\\":3,\\"sort\\":{\\"direction\\":\\"descending\\",\\"timestamp\\":\\"last_edited_time\\"}}","timeoutMs":20000}}';

// 4. POST /v1/pages (Create page)
const s_http_create_prefix = '{"api":"network","operation":"http_request","payload":{"url":"https://api.notion.com/v1/pages","method":"POST","headers":{"Authorization":"Bearer ';
const s_http_create_mid1 = '","Notion-Version":"2022-06-28","Content-Type":"application/json"},"body":"{\\"parent\\":{\\"page_id\\":\\"';
const s_http_create_mid2 = '\\"},\\"properties\\":{\\"title\\":[{\\"text\\":{\\"content\\":\\"';
const s_http_create_suffix = '\\"}}]}}","timeoutMs":25000}}';

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
const d_http_create_suffix = registerData('http_create_suffix', s_http_create_suffix);

// Needles for parsing CLI and Natural Language triggers
const needle_secret = registerData('needle_secret', 'secret_');
const needle_ntn = registerData('needle_ntn', 'ntn_');
const needle_config = registerData('needle_config', 'config');
const needle_token = registerData('needle_token', 'token');
const needle_parent = registerData('needle_parent', 'parent');
const needle_padre = registerData('needle_padre', 'padre');
const needle_status = registerData('needle_status', 'status');
const needle_estado = registerData('needle_estado', 'estado');
const needle_test = registerData('needle_test', 'test');
const needle_me = registerData('needle_me', 'me');
const needle_disconnect = registerData('needle_disconnect', 'disconnect');
const needle_desconectar = registerData('needle_desconectar', 'desconectar');
const needle_search = registerData('needle_search', 'search');
const needle_buscar = registerData('needle_buscar', 'buscar');
const needle_busca = registerData('needle_busca', 'busca');
const needle_encuentra = registerData('needle_encuentra', 'encuentra');
const needle_consulta = registerData('needle_consulta', 'consulta');
const needle_list = registerData('needle_list', 'list');
const needle_pages = registerData('needle_pages', 'pages');
const needle_paginas = registerData('needle_paginas', 'paginas');
const needle_notas = registerData('needle_notas', 'notas');
const needle_create = registerData('needle_create', 'create');
const needle_crear = registerData('needle_crear', 'crear');
const needle_crea = registerData('needle_crea', 'crea');
const needle_anota = registerData('needle_anota', 'anota');
const needle_nueva = registerData('needle_nueva', 'nueva');
const needle_nuevo = registerData('needle_nuevo', 'nuevo');
const needle_help = registerData('needle_help', 'help');

// AI Intent JSON parsing needles
const needle_val_field = registerData('needle_val_field', '"value":"');
const needle_json_query = registerData('needle_json_query', '"query":"');
const needle_json_title = registerData('needle_json_title', '"title":"');

const needle_status_200 = registerData('needle_status_200', '"statusCode":200');
const needle_results_empty = registerData('needle_results_empty', '"results":[]');
const needle_results_open = registerData('needle_results_open', '"results":[');
const needle_id_field = registerData('needle_id_field', '"id":"');
const needle_url_field = registerData('needle_url_field', '"url":"https://');
const needle_plain_text = registerData('needle_plain_text', '"plain_text":"');
const needle_msg_field = registerData('needle_msg_field', '"message":"');

// Bullet points formatting
const s_bullet_page = '• 📄 [';
const s_bullet_mid = '](';
const s_bullet_end = ')\n';
const d_bullet_page = registerData('bullet_page', s_bullet_page);
const d_bullet_mid = registerData('bullet_mid', s_bullet_mid);
const d_bullet_end = registerData('bullet_end', s_bullet_end);

console.log(`Registered ${dataEntries.length} static data segments up to offset ${staticPtr}.`);

const dataSectionWat = dataEntries
  .map(e => `  (data (i32.const ${e.offset}) "${e.escaped}")`)
  .join('\n');

const watContent = `;; Chattree Official Notion Integration Plugin with AI Intent & Natural Language
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; 64 pages = 4 MB sandbox linear memory
  (memory (export "memory") 64)

  (global $phase (mut i32) (i32.const 0))
  (global $token_len (mut i32) (i32.const 0))
  (global $arg_len (mut i32) (i32.const 0))
  (global $parent_len (mut i32) (i32.const 0))

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

    (local.set $res_len (call $host_call (i32.const ${d_storage_get.offset}) (i32.const ${d_storage_get.length}) (i32.const 1000000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 1000000) (local.get $res_len) (i32.const ${needle_val_field.offset}) (i32.const ${needle_val_field.length})))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_start (i32.add (i32.const 1000000) (i32.add (local.get $val_idx) (i32.const ${needle_val_field.length}))))
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

    (local.set $res_len (call $host_call (i32.const ${d_storage_get_parent.offset}) (i32.const ${d_storage_get_parent.length}) (i32.const 1000000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 1000000) (local.get $res_len) (i32.const ${needle_val_field.offset}) (i32.const ${needle_val_field.length})))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_start (i32.add (i32.const 1000000) (i32.add (local.get $val_idx) (i32.const ${needle_val_field.length}))))
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

  ;; Sanitizes raw text into 1002000 (replaces double quotes with single quotes, backslashes with /)
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

  ;; Extracts JSON field value into 1002000 (returns length, or -1 if field not found)
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
              (if (i32.lt_u (local.get $i) (i32.const 500))
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

  ;; Main entrypoint
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

    ;; 1. Check for empty input -> return Help
    (if (i32.eqz (local.get $in_len))
      (then
        (drop (call $copy_mem (i32.const ${d_help.offset}) (i32.const 1024) (i32.const ${d_help.length})))
        (return (i32.const ${d_help.length}))
      )
    )

    ;; Lowercase input into 1003000 for keyword detection
    (call $to_lower (local.get $in_ptr) (i32.const 1003000) (local.get $in_len))

    ;; 2. Check for "parent" / "padre" command to explicitly set parent page ID
    (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_parent.offset}) (i32.const ${needle_parent.length})))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_padre.offset}) (i32.const ${needle_padre.length})))
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
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_parent_prefix.offset}) (i32.const 100000) (i32.const ${d_storage_set_parent_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1004000) (local.get $p) (global.get $parent_len)))
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_parent_suffix.offset}) (local.get $p) (i32.const ${d_storage_set_parent_suffix.length})))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 1024)))

            (drop (call $copy_mem (i32.const ${d_parent_saved.offset}) (i32.const 1024) (i32.const ${d_parent_saved.length})))
            (return (i32.const ${d_parent_saved.length}))
          )
        )
      )
    )

    ;; 3. Check for structured JSON intent from AI interpreter
    (local.set $has_json_field (call $extract_json_field (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_json_query.offset}) (i32.const ${needle_json_query.length})))
    (if (i32.lt_s (local.get $has_json_field) (i32.const 0))
      (then
        (local.set $has_json_field (call $extract_json_field (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_json_title.offset}) (i32.const ${needle_json_title.length})))
      )
    )

    ;; If JSON field was found, check if action is create
    (if (i32.ge_s (local.get $has_json_field) (i32.const 0))
      (then
        (if (i32.or
              (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_create.offset}) (i32.const ${needle_create.length})) (i32.const 0))
              (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_crear.offset}) (i32.const ${needle_crear.length})) (i32.const 0)))
          (then
            ;; Direct AI Create flow!
            (local.set $raw_len (call $load_api_token))
            (if (i32.eqz (local.get $raw_len))
              (then
                (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 1024) (i32.const ${d_key_missing.length})))
                (return (i32.const ${d_key_missing.length}))
              )
            )

            ;; Check if parent_id was previously saved
            (local.set $has_saved_parent (call $load_parent_id))
            (if (i32.gt_u (local.get $has_saved_parent) (i32.const 0))
              (then
                ;; Direct POST /v1/pages
                (local.set $p (call $copy_mem (i32.const ${d_http_create_prefix.offset}) (i32.const 100000) (i32.const ${d_http_create_prefix.length})))
                (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
                (local.set $p (call $copy_mem (i32.const ${d_http_create_mid1.offset}) (local.get $p) (i32.const ${d_http_create_mid1.length})))
                (local.set $p (call $copy_mem (i32.const 1004000) (local.get $p) (global.get $parent_len)))
                (local.set $p (call $copy_mem (i32.const ${d_http_create_mid2.offset}) (local.get $p) (i32.const ${d_http_create_mid2.length})))
                (local.set $p (call $copy_mem (i32.const 1002000) (local.get $p) (global.get $arg_len)))
                (local.set $p (call $copy_mem (i32.const ${d_http_create_suffix.offset}) (local.get $p) (i32.const ${d_http_create_suffix.length})))
                (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

                (global.set $phase (i32.const 5))
                (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 300000)))
                (return (i32.const 0))
              )
            )

            ;; Search for parent page
            (local.set $p (call $copy_mem (i32.const ${d_http_search_prefix.offset}) (i32.const 100000) (i32.const ${d_http_search_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const ${d_http_parent_search_body.offset}) (local.get $p) (i32.const ${d_http_parent_search_body.length})))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

            (global.set $phase (i32.const 4))
            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 300000)))
            (return (i32.const 0))
          )
          (else
            ;; Direct AI Search flow!
            (local.set $raw_len (call $load_api_token))
            (if (i32.eqz (local.get $raw_len))
              (then
                (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 1024) (i32.const ${d_key_missing.length})))
                (return (i32.const ${d_key_missing.length}))
              )
            )

            (local.set $p (call $copy_mem (i32.const ${d_http_search_prefix.offset}) (i32.const 100000) (i32.const ${d_http_search_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
            (if (i32.gt_u (global.get $arg_len) (i32.const 0))
              (then
                (local.set $p (call $copy_mem (i32.const ${d_http_search_mid1.offset}) (local.get $p) (i32.const ${d_http_search_mid1.length})))
                (local.set $p (call $copy_mem (i32.const 1002000) (local.get $p) (global.get $arg_len)))
                (local.set $p (call $copy_mem (i32.const ${d_http_search_mid2.offset}) (local.get $p) (i32.const ${d_http_search_mid2.length})))
              )
              (else
                (local.set $p (call $copy_mem (i32.const ${d_http_search_empty_body.offset}) (local.get $p) (i32.const ${d_http_search_empty_body.length})))
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

    ;; 4. Check for "help" / "ayuda"
    (if (i32.or
          (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_help.offset}) (i32.const ${needle_help.length})) (i32.const 0))
          (i32.eq (i32.load8_u (local.get $in_ptr)) (i32.const 63)))
      (then
        (drop (call $copy_mem (i32.const ${d_help.offset}) (i32.const 1024) (i32.const ${d_help.length})))
        (return (i32.const ${d_help.length}))
      )
    )

    ;; 5. Check for "disconnect" / "desconectar"
    (if (i32.or
          (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_disconnect.offset}) (i32.const ${needle_disconnect.length})) (i32.const 0))
          (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_desconectar.offset}) (i32.const ${needle_desconectar.length})) (i32.const 0)))
      (then
        (drop (call $host_call (i32.const ${d_storage_delete.offset}) (i32.const ${d_storage_delete.length}) (i32.const 1000000) (i32.const 1024)))
        (drop (call $copy_mem (i32.const ${d_disconnected.offset}) (i32.const 1024) (i32.const ${d_disconnected.length})))
        (return (i32.const ${d_disconnected.length}))
      )
    )

    ;; 6. Check for direct secret_ or ntn_ or "config" / "token"
    (local.set $token_start (i32.const -1))
    (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_secret.offset}) (i32.const ${needle_secret.length})))
    (if (i32.ge_s (local.get $pos) (i32.const 0))
      (then (local.set $token_start (i32.add (local.get $in_ptr) (local.get $pos))))
      (else
        (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_ntn.offset}) (i32.const ${needle_ntn.length})))
        (if (i32.ge_s (local.get $pos) (i32.const 0))
          (then (local.set $token_start (i32.add (local.get $in_ptr) (local.get $pos))))
          (else
            (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_config.offset}) (i32.const ${needle_config.length})))
            (if (i32.ge_s (local.get $pos) (i32.const 0))
              (then (local.set $token_start (i32.add (i32.add (local.get $in_ptr) (local.get $pos)) (i32.const 6))))
              (else
                (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_token.offset}) (i32.const ${needle_token.length})))
                (if (i32.ge_s (local.get $pos) (i32.const 0))
                  (then (local.set $token_start (i32.add (i32.add (local.get $in_ptr) (local.get $pos)) (i32.const 5))))
                )
              )
            )
          )
        )
      )
    )

    ;; If config / token was detected, extract and save token, then test via /v1/users/me
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
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_prefix.offset}) (i32.const 100000) (i32.const ${d_storage_set_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_suffix.offset}) (local.get $p) (i32.const ${d_storage_set_suffix.length})))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 1024)))

            (local.set $p (call $copy_mem (i32.const ${d_http_me_prefix.offset}) (i32.const 100000) (i32.const ${d_http_me_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const ${d_http_me_suffix.offset}) (local.get $p) (i32.const ${d_http_me_suffix.length})))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

            (global.set $phase (i32.const 1))
            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 300000)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; 7. Check for "status" / "estado" / "me" / "test"
    (if (i32.or
          (i32.or
            (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_status.offset}) (i32.const ${needle_status.length})) (i32.const 0))
            (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_estado.offset}) (i32.const ${needle_estado.length})) (i32.const 0)))
          (i32.or
            (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_me.offset}) (i32.const ${needle_me.length})) (i32.const 0))
            (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_test.offset}) (i32.const ${needle_test.length})) (i32.const 0))))
      (then
        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then
            (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 1024) (i32.const ${d_key_missing.length})))
            (return (i32.const ${d_key_missing.length}))
          )
        )

        (local.set $p (call $copy_mem (i32.const ${d_http_me_prefix.offset}) (i32.const 100000) (i32.const ${d_http_me_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_me_suffix.offset}) (local.get $p) (i32.const ${d_http_me_suffix.length})))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (global.set $phase (i32.const 2))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 300000)))
        (return (i32.const 0))
      )
    )

    ;; 8. Check for "create" / "crear" / "crea" / "anota" / "nueva" / "nuevo"
    (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_create.offset}) (i32.const ${needle_create.length})))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_crear.offset}) (i32.const ${needle_crear.length})))
      )
    )
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_crea.offset}) (i32.const ${needle_crea.length})))
      )
    )
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_anota.offset}) (i32.const ${needle_anota.length})))
      )
    )
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_nueva.offset}) (i32.const ${needle_nueva.length})))
      )
    )

    (if (i32.ge_s (local.get $pos) (i32.const 0))
      (then
        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then
            (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 1024) (i32.const ${d_key_missing.length})))
            (return (i32.const ${d_key_missing.length}))
          )
        )

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
            (drop (call $copy_mem (i32.const ${d_help.offset}) (i32.const 1024) (i32.const ${d_help.length})))
            (return (i32.const ${d_help.length}))
          )
        )

        (drop (call $sanitize_text (local.get $token_start) (local.get $raw_len)))

        ;; Check if parent_id was previously saved
        (local.set $has_saved_parent (call $load_parent_id))
        (if (i32.gt_u (local.get $has_saved_parent) (i32.const 0))
          (then
            ;; Direct POST /v1/pages
            (local.set $p (call $copy_mem (i32.const ${d_http_create_prefix.offset}) (i32.const 100000) (i32.const ${d_http_create_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_mem (i32.const ${d_http_create_mid1.offset}) (local.get $p) (i32.const ${d_http_create_mid1.length})))
            (local.set $p (call $copy_mem (i32.const 1004000) (local.get $p) (global.get $parent_len)))
            (local.set $p (call $copy_mem (i32.const ${d_http_create_mid2.offset}) (local.get $p) (i32.const ${d_http_create_mid2.length})))
            (local.set $p (call $copy_mem (i32.const 1002000) (local.get $p) (global.get $arg_len)))
            (local.set $p (call $copy_mem (i32.const ${d_http_create_suffix.offset}) (local.get $p) (i32.const ${d_http_create_suffix.length})))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

            (global.set $phase (i32.const 5))
            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 300000)))
            (return (i32.const 0))
          )
        )

        ;; Search for parent page
        (local.set $p (call $copy_mem (i32.const ${d_http_search_prefix.offset}) (i32.const 100000) (i32.const ${d_http_search_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_parent_search_body.offset}) (local.get $p) (i32.const ${d_http_parent_search_body.length})))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (global.set $phase (i32.const 4))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 300000)))
        (return (i32.const 0))
      )
    )

    ;; 9. Default or Search / List action
    (local.set $raw_len (call $load_api_token))
    (if (i32.eqz (local.get $raw_len))
      (then
        (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 1024) (i32.const ${d_key_missing.length})))
        (return (i32.const ${d_key_missing.length}))
      )
    )

    (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_search.offset}) (i32.const ${needle_search.length})))
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_buscar.offset}) (i32.const ${needle_buscar.length})))
      )
    )
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_busca.offset}) (i32.const ${needle_busca.length})))
      )
    )
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_encuentra.offset}) (i32.const ${needle_encuentra.length})))
      )
    )
    (if (i32.lt_s (local.get $pos) (i32.const 0))
      (then
        (local.set $pos (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_consulta.offset}) (i32.const ${needle_consulta.length})))
      )
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
              (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_list.offset}) (i32.const ${needle_list.length})) (i32.const 0))
              (i32.or
                (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_pages.offset}) (i32.const ${needle_pages.length})) (i32.const 0))
                (i32.ge_s (call $find_substring (i32.const 1003000) (local.get $in_len) (i32.const ${needle_paginas.offset}) (i32.const ${needle_paginas.length})) (i32.const 0))))
          (then
            (global.set $arg_len (i32.const 0))
          )
          (else
            (drop (call $sanitize_text (local.get $in_ptr) (local.get $in_len)))
          )
        )
      )
    )

    (local.set $p (call $copy_mem (i32.const ${d_http_search_prefix.offset}) (i32.const 100000) (i32.const ${d_http_search_prefix.length})))
    (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))

    (if (i32.gt_u (global.get $arg_len) (i32.const 0))
      (then
        (local.set $p (call $copy_mem (i32.const ${d_http_search_mid1.offset}) (local.get $p) (i32.const ${d_http_search_mid1.length})))
        (local.set $p (call $copy_mem (i32.const 1002000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_search_mid2.offset}) (local.get $p) (i32.const ${d_http_search_mid2.length})))
      )
      (else
        (local.set $p (call $copy_mem (i32.const ${d_http_search_empty_body.offset}) (local.get $p) (i32.const ${d_http_search_empty_body.length})))
      )
    )
    (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

    (global.set $phase (i32.const 3))
    (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 300000)))
    (i32.const 0)
  )

  ;; Resume handler called when async host_call returns
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

    ;; 1. Unescape host response into 600000
    (local.set $u_len (call $unescape_response (local.get $res_ptr) (local.get $res_len) (i32.const 600000)))

    ;; Check if HTTP status is 200
    (local.set $idx (call $find_substring (i32.const 600000) (local.get $u_len) (i32.const ${needle_status_200.offset}) (i32.const ${needle_status_200.length})))
    (local.set $is_200 (i32.ge_s (local.get $idx) (i32.const 0)))

    ;; ─── Phase 1: Config Verification ───
    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        (if (local.get $is_200)
          (then
            (drop (call $copy_mem (i32.const ${d_key_saved_ok.offset}) (i32.const 1024) (i32.const ${d_key_saved_ok.length})))
            (return (i32.const ${d_key_saved_ok.length}))
          )
          (else
            (drop (call $copy_mem (i32.const ${d_key_saved_invalid.offset}) (i32.const 1024) (i32.const ${d_key_saved_invalid.length})))
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
            (drop (call $copy_mem (i32.const ${d_status_ok.offset}) (i32.const 1024) (i32.const ${d_status_ok.length})))
            (return (i32.const ${d_status_ok.length}))
          )
          (else
            (drop (call $copy_mem (i32.const ${d_status_error.offset}) (i32.const 1024) (i32.const ${d_status_error.length})))
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
            (drop (call $copy_mem (i32.const ${d_search_error.offset}) (i32.const 1024) (i32.const ${d_search_error.length})))
            (return (i32.const ${d_search_error.length}))
          )
        )

        ;; Check if empty results "results":[]
        (local.set $idx (call $find_substring (i32.const 600000) (local.get $u_len) (i32.const ${needle_results_empty.offset}) (i32.const ${needle_results_empty.length})))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const ${d_search_empty.offset}) (i32.const 1024) (i32.const ${d_search_empty.length})))
            (return (i32.const ${d_search_empty.length}))
          )
        )

        (local.set $p (call $copy_mem (i32.const ${d_search_header.offset}) (i32.const 1024) (i32.const ${d_search_header.length})))

        (local.set $scan_ptr (i32.const 600000))
        (local.set $scan_end (i32.add (i32.const 600000) (local.get $u_len)))
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

                  (local.set $title_start (local.get $url_start))
                  (local.set $title_len (i32.const 6))
                  (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const ${needle_plain_text.offset}) (i32.const ${needle_plain_text.length})))
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

                  (local.set $p (call $copy_mem (i32.const ${d_bullet_page.offset}) (local.get $p) (i32.const ${d_bullet_page.length})))
                  (if (i32.gt_u (local.get $title_len) (i32.const 0))
                    (then (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len))))
                    (else (local.set $p (call $copy_mem (i32.const ${needle_pages.offset}) (local.get $p) (i32.const 5))))
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
            (drop (call $copy_mem (i32.const ${d_search_empty.offset}) (i32.const 1024) (i32.const ${d_search_empty.length})))
            (return (i32.const ${d_search_empty.length}))
          )
        )

        (return (i32.sub (local.get $p) (i32.const 1024)))
      )
    )

    ;; ─── Phase 4: Create Step 1 (Parent Search response) ───
    (if (i32.eq (global.get $phase) (i32.const 4))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            ;; Look for Notion error message in unescaped body
            (local.set $idx (call $find_substring (i32.const 600000) (local.get $u_len) (i32.const ${needle_msg_field.offset}) (i32.const ${needle_msg_field.length})))
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
                (local.set $p (call $copy_mem (i32.const ${d_create_error_prefix.offset}) (i32.const 1024) (i32.const ${d_create_error_prefix.length})))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $msg_len)))
                (local.set $p (call $copy_mem (i32.const ${d_create_error_suffix.offset}) (local.get $p) (i32.const ${d_create_error_suffix.length})))
                (return (i32.sub (local.get $p) (i32.const 1024)))
              )
            )
            (drop (call $copy_mem (i32.const ${d_create_no_parent.offset}) (i32.const 1024) (i32.const ${d_create_no_parent.length})))
            (return (i32.const ${d_create_no_parent.length}))
          )
        )

        ;; Find first "id":" in unescaped results
        (local.set $idx (call $find_substring (i32.const 600000) (local.get $u_len) (i32.const ${needle_id_field.offset}) (i32.const ${needle_id_field.length})))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const ${d_create_no_parent.offset}) (i32.const 1024) (i32.const ${d_create_no_parent.length})))
            (return (i32.const ${d_create_no_parent.length}))
          )
        )

        ;; Extract 36-char ID into 1004000
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

        ;; Save discovered parent page ID into storage so next calls are instantaneous!
        (local.set $p (call $copy_mem (i32.const ${d_storage_set_parent_prefix.offset}) (i32.const 100000) (i32.const ${d_storage_set_parent_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 1004000) (local.get $p) (global.get $parent_len)))
        (local.set $p (call $copy_mem (i32.const ${d_storage_set_parent_suffix.offset}) (local.get $p) (i32.const ${d_storage_set_parent_suffix.length})))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 1024)))

        ;; Step 4B: Build POST /v1/pages
        (local.set $p (call $copy_mem (i32.const ${d_http_create_prefix.offset}) (i32.const 100000) (i32.const ${d_http_create_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 1001000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_create_mid1.offset}) (local.get $p) (i32.const ${d_http_create_mid1.length})))
        (local.set $p (call $copy_mem (i32.const 1004000) (local.get $p) (global.get $parent_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_create_mid2.offset}) (local.get $p) (i32.const ${d_http_create_mid2.length})))
        (local.set $p (call $copy_mem (i32.const 1002000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_mem (i32.const ${d_http_create_suffix.offset}) (local.get $p) (i32.const ${d_http_create_suffix.length})))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (global.set $phase (i32.const 5))
        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 300000) (i32.const 300000)))
        (return (i32.const 0))
      )
    )

    ;; ─── Phase 5: Create Step 2 (Page Created response) ───
    (if (i32.eq (global.get $phase) (i32.const 5))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            (local.set $idx (call $find_substring (i32.const 600000) (local.get $u_len) (i32.const ${needle_msg_field.offset}) (i32.const ${needle_msg_field.length})))
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
                (local.set $p (call $copy_mem (i32.const ${d_create_error_prefix.offset}) (i32.const 1024) (i32.const ${d_create_error_prefix.length})))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $msg_len)))
                (local.set $p (call $copy_mem (i32.const ${d_create_error_suffix.offset}) (local.get $p) (i32.const ${d_create_error_suffix.length})))
                (return (i32.sub (local.get $p) (i32.const 1024)))
              )
            )
            (local.set $p (call $copy_mem (i32.const ${d_create_error_prefix.offset}) (i32.const 1024) (i32.const ${d_create_error_prefix.length})))
            (local.set $p (call $copy_mem (i32.const ${d_create_error_suffix.offset}) (local.get $p) (i32.const ${d_create_error_suffix.length})))
            (return (i32.sub (local.get $p) (i32.const 1024)))
          )
        )

        (local.set $idx (call $find_substring (i32.const 600000) (local.get $u_len) (i32.const ${needle_url_field.offset}) (i32.const ${needle_url_field.length})))
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

        (local.set $p (call $copy_mem (i32.const ${d_create_ok_prefix.offset}) (i32.const 1024) (i32.const ${d_create_ok_prefix.length})))
        (local.set $p (call $copy_mem (i32.const 1002000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_mem (i32.const ${d_create_ok_mid.offset}) (local.get $p) (i32.const ${d_create_ok_mid.length})))
        (local.set $p (call $copy_mem (local.get $url_start) (local.get $p) (local.get $url_len)))
        (local.set $p (call $copy_mem (i32.const ${d_create_ok_suffix.offset}) (local.get $p) (i32.const ${d_create_ok_suffix.length})))

        (return (i32.sub (local.get $p) (i32.const 1024)))
      )
    )

    (drop (call $copy_mem (i32.const ${d_help.offset}) (i32.const 1024) (i32.const ${d_help.length})))
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

// Write schema-compliant plugin.json
const manifest = {
  $schema: "../../../schemas/plugin.manifest.v1.schema.json",
  schemaVersion: 1,
  id: "com.chattree.official.notion",
  version: "1.0.2",
  name: "Notion Integration",
  description: "Official Notion workspace integration with natural language and AI tool calling support. Connect your workspace to search notes, create pages, and inspect recent updates.",
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
  iconUrl: "https://raw.githubusercontent.com/Ponce5/Chattree/main/plugins/official/notion/icon.png?v=1.0.2",
  bannerUrl: "https://raw.githubusercontent.com/Ponce5/Chattree/main/plugins/official/notion/banner.png?v=1.0.2",
  changelog: "1.0.2: Fixed JSON response unescaping so parent page discovery, page creation, and search results parse Notion responses accurately.",
  runtime: "wasm",
  entrypoint: "notion_entry",
  wasmPath: "plugin.wasm",
  wasmSha256: wasmSha256,
  runtimeApiVersion: "1.0.0",
  maxMemoryPages: 64,
  timeoutMs: 35000,
  fuelLimit: 100000000,
  tools: [
    {
      "id": "com.chattree.official.notion.workspace",
      "command": "notion",
      "displayName": "Notion Workspace",
      "description": "Herramienta oficial de Notion con soporte total para lenguaje natural. Busca páginas y bases de datos, consulta notas o crea nuevas páginas en tu espacio de trabajo. Comandos: /notion, /notion config <api_token>, /notion status, /notion search <término>, /notion create <título>, /notion parent <page_id>. En lenguaje natural: 'busca mis notas en Notion sobre...', 'crea una página en Notion que se llame...'.",
      "capabilities": [
        "network.http",
        "storage.private"
      ],
      "intentContract": {
        "intent": "notion_action",
        "validIntents": [
          "search",
          "create",
          "status",
          "config",
          "list",
          "parent",
          "disconnect",
          "help"
        ],
        "description": "Interactúa con el espacio de trabajo de Notion para buscar páginas, crear notas, comprobar la conexión o configurar el token de integración.",
        "fields": [
          {
            "name": "action",
            "type": "string",
            "description": "Acción a realizar: 'search' para buscar, 'create' para crear página, 'list' para ver páginas recientes, 'status' para verificar conexión, 'config' para guardar token, o 'parent' para configurar página padre",
            "required": true
          },
          {
            "name": "query",
            "type": "string",
            "description": "Término de búsqueda, texto o título de la página",
            "required": false
          },
          {
            "name": "title",
            "type": "string",
            "description": "Título de la nueva página a crear en Notion",
            "required": false
          }
        ]
      }
    }
  ]
};

const manifestPath = path.join(pluginDir, 'plugin.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('✅ Generated plugin.json successfully:', manifestPath);
