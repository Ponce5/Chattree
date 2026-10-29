import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDir = path.resolve(__dirname, '../plugins/official/elevenlabs');

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

// Memory Layout:
// 0..1023: Input buffer (1 KB)
// 1024..65535: Output buffer (64 KB)
// 10000..50000: Static data strings
// 100000..999999: HTTP Request buffer (900 KB)
// 1000000..4999999: HTTP Response buffer (4 MB)
// 5000000..8999999: Files Write Request buffer (4 MB)
// 9000000..9999999: Files Write Response buffer (1 MB)
// 10000000..10001000: Storage API Response & scratch (1 KB)
// 10001000..10002000: API Key storage (1 KB)
// 10002000..10050000: Sanitized Text buffer (48 KB)

let staticPtr = 10000;
const dataEntries = [];

function registerData(name, str) {
  const d = toWatData(str);
  const offset = staticPtr;
  staticPtr += d.length + 16; // 16 bytes safe padding between segments
  dataEntries.push({ name, offset, length: d.length, escaped: d.escaped });
  return { offset, length: d.length };
}

// Static strings
const s_help = `🔊 **ElevenLabs Audio Generator**\n\nGenera audios de alta calidad con IA mediante ElevenLabs.\n\n**Comandos disponibles:**\n• \`/elevenlabs config <tu_api_key>\` — Registra tu clave de API\n• \`/elevenlabs status\` — Verifica el estado de la configuración\n• \`/elevenlabs <texto>\` — Genera un audio en MP3\n• \`/tts <texto>\` — Alias rápido para síntesis de voz\n\n*Obtén tu clave de API gratuita en: https://elevenlabs.io*`;
const s_key_saved = `✅ **Clave de ElevenLabs guardada exitosamente.**\n\nYa puedes generar audios usando:\n\`/elevenlabs Tu texto aquí\``;
const s_key_missing = `⚠️ **ElevenLabs no está configurado.**\n\nPor favor registra tu API Key ejecutando:\n\`/elevenlabs config <tu_api_key>\`\n\nPuedes obtener una clave gratuita en https://elevenlabs.io`;
const s_status_ok = `✅ **ElevenLabs está configurado y listo.**\n\nPuedes sintetizar audio con \`/elevenlabs <texto>\`.`;
const s_storage_get = JSON.stringify({ api: 'storage', operation: 'get', payload: { key: 'api_key' } });
const s_storage_set_prefix = '{"api":"storage","operation":"set","payload":{"key":"api_key","value":"';
const s_storage_set_suffix = '"}}';
// Using George (JBFqnCBsd6RMkjVDRZzb), premade voice fully available on free & creator plans
const s_http_prefix = '{"api":"network","operation":"http_request","payload":{"url":"https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb","method":"POST","headers":{"xi-api-key":"';
const s_http_mid1 = '","Content-Type":"application/json","Accept":"audio/mpeg"},"body":"{\\"text\\":\\"';
const s_http_mid2 = '\\",\\"model_id\\":\\"eleven_multilingual_v2\\"}","responseType":"base64","timeoutMs":30000}}';
const s_files_write_prefix = '{"api":"files","operation":"write","payload":{"name":"audio_elevenlabs.mp3","encoding":"base64","content":"';
const s_files_write_suffix = '"}}';
const s_direct_bubble_prefix = '{"type":"direct","displayText":"🔊 **Audio generado exitosamente con ElevenLabs**\\n\\nTu archivo de audio MP3 está listo para guardar o compartir.","fileHandle":"';
const s_direct_bubble_suffix = '","fileName":"audio_elevenlabs.mp3"}';
const s_error_gen = `❌ **Error al generar audio con ElevenLabs**\n\nVerifica que tu API Key sea correcta o que tengas créditos disponibles en ElevenLabs.\nPuedes actualizar tu clave con:\n\`/elevenlabs config <tu_api_key>\``;

const d_help = registerData('help', s_help);
const d_key_saved = registerData('key_saved', s_key_saved);
const d_key_missing = registerData('key_missing', s_key_missing);
const d_status_ok = registerData('status_ok', s_status_ok);
const d_storage_get = registerData('storage_get', s_storage_get);
const d_storage_set_prefix = registerData('storage_set_prefix', s_storage_set_prefix);
const d_storage_set_suffix = registerData('storage_set_suffix', s_storage_set_suffix);
const d_http_prefix = registerData('http_prefix', s_http_prefix);
const d_http_mid1 = registerData('http_mid1', s_http_mid1);
const d_http_mid2 = registerData('http_mid2', s_http_mid2);
const d_files_write_prefix = registerData('files_write_prefix', s_files_write_prefix);
const d_files_write_suffix = registerData('files_write_suffix', s_files_write_suffix);
const d_direct_bubble_prefix = registerData('direct_bubble_prefix', s_direct_bubble_prefix);
const d_direct_bubble_suffix = registerData('direct_bubble_suffix', s_direct_bubble_suffix);
const d_error_gen = registerData('error_gen', s_error_gen);

// Needles for searching
const needle_sk = registerData('needle_sk', 'sk_');
const needle_config = registerData('needle_config', 'config');
const needle_status = registerData('needle_status', 'status');
const needle_text_field = registerData('needle_text_field', '"text":"');
const needle_val_field = registerData('needle_val_field', '"value":"');
const needle_status_200 = registerData('needle_status_200', '"statusCode":200');
const needle_body_field = registerData('needle_body_field', '"body":"');
const needle_handle_field = registerData('needle_handle_field', '"handle":"');

console.log(`Registered ${dataEntries.length} static data segments up to offset ${staticPtr}. All collision-free.`);

const dataSectionWat = dataEntries
  .map(e => `  (data (i32.const ${e.offset}) "${e.escaped}")`)
  .join('\n');

const watContent = `;; Chattree Official ElevenLabs Audio Generator Plugin
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; 256 pages = 16 MB sandbox memory
  (memory (export "memory") 256)

  (global $phase (mut i32) (i32.const 0))
  (global $key_len (mut i32) (i32.const 0))
  (global $text_len (mut i32) (i32.const 0))
  (global $handle_len (mut i32) (i32.const 0))

  ;; Static Data Segments
${dataSectionWat}

  (func $copy_mem (param $src i32) (param $dst i32) (param $len i32) (result i32)
    (memory.copy (local.get $dst) (local.get $src) (local.get $len))
    (i32.add (local.get $dst) (local.get $len))
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

  ;; Reads API Key from storage into 10001000
  (func $load_api_key (result i32)
    (local $res_len i32)
    (local $val_idx i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)

    (local.set $res_len (call $host_call (i32.const ${d_storage_get.offset}) (i32.const ${d_storage_get.length}) (i32.const 10000000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 10000000) (local.get $res_len) (i32.const ${needle_val_field.offset}) (i32.const ${needle_val_field.length})))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_start (i32.add (i32.const 10000000) (i32.add (local.get $val_idx) (i32.const ${needle_val_field.length}))))
    (local.set $i (i32.const 0))
    (loop $copy_key
      (if (i32.lt_u (local.get $i) (i32.const 120))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
          (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 0)))
            (then
              (i32.store8 (i32.add (i32.const 10001000) (local.get $i)) (local.get $ch))
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

  (func (export "elevenlabs_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $p i32)
    (local $req_len i32)
    (local $key_count i32)
    (local $text_start i32)
    (local $raw_len i32)
    (local $i i32)
    (local $ch i32)
    (local $out_ptr i32)
    (local $sk_pos i32)
    (local $cfg_pos i32)
    (local $status_pos i32)
    (local $json_text_pos i32)

    (global.set $phase (i32.const 0))

    ;; 1. Check for empty input
    (if (i32.eqz (local.get $in_len))
      (then
        (drop (call $copy_mem (i32.const ${d_help.offset}) (i32.const 1024) (i32.const ${d_help.length})))
        (return (i32.const ${d_help.length}))
      )
    )

    ;; 2. Detect API Key configuration (search for "sk_" anywhere in input)
    (local.set $sk_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_sk.offset}) (i32.const ${needle_sk.length})))
    (if (i32.ge_s (local.get $sk_pos) (i32.const 0))
      (then
        (local.set $text_start (i32.add (local.get $in_ptr) (local.get $sk_pos)))
        (local.set $i (i32.const 0))
        (loop $scan_sk
          (if (i32.lt_u (i32.add (local.get $sk_pos) (local.get $i)) (local.get $in_len))
            (then
              (if (i32.lt_u (local.get $i) (i32.const 80))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $text_start) (local.get $i))))
                  (if (i32.and
                        (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                        (i32.and (i32.ne (local.get $ch) (i32.const 125)) (i32.and (i32.ne (local.get $ch) (i32.const 10)) (i32.ne (local.get $ch) (i32.const 13)))))
                    (then
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $scan_sk)
                    )
                  )
                )
              )
            )
          )
        )
        (local.set $raw_len (local.get $i))

        ;; Save to storage.set
        (local.set $p (call $copy_mem (i32.const ${d_storage_set_prefix.offset}) (i32.const 100000) (i32.const ${d_storage_set_prefix.length})))
        (local.set $p (call $copy_mem (local.get $text_start) (local.get $p) (local.get $raw_len)))
        (local.set $p (call $copy_mem (i32.const ${d_storage_set_suffix.offset}) (local.get $p) (i32.const ${d_storage_set_suffix.length})))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 10000000) (i32.const 1024)))

        (drop (call $copy_mem (i32.const ${d_key_saved.offset}) (i32.const 1024) (i32.const ${d_key_saved.length})))
        (return (i32.const ${d_key_saved.length}))
      )
    )

    ;; 3. Check for "config " command if key doesn't start with sk_
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
        (loop $scan_cfg_key
          (if (i32.lt_u (i32.add (local.get $text_start) (local.get $i)) (i32.add (local.get $in_ptr) (local.get $in_len)))
            (then
              (if (i32.lt_u (local.get $i) (i32.const 80))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $text_start) (local.get $i))))
                  (if (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                    (then
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $scan_cfg_key)
                    )
                  )
                )
              )
            )
          )
        )
        (local.set $raw_len (local.get $i))
        (if (i32.gt_u (local.get $raw_len) (i32.const 5))
          (then
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_prefix.offset}) (i32.const 100000) (i32.const ${d_storage_set_prefix.length})))
            (local.set $p (call $copy_mem (local.get $text_start) (local.get $p) (local.get $raw_len)))
            (local.set $p (call $copy_mem (i32.const ${d_storage_set_suffix.offset}) (local.get $p) (i32.const ${d_storage_set_suffix.length})))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 10000000) (i32.const 1024)))

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
        (if (i32.gt_u (local.get $key_count) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const ${d_status_ok.offset}) (i32.const 1024) (i32.const ${d_status_ok.length})))
            (return (i32.const ${d_status_ok.length}))
          )
          (else
            (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 1024) (i32.const ${d_key_missing.length})))
            (return (i32.const ${d_key_missing.length}))
          )
        )
      )
    )

    ;; 5. Audio Synthesis: Load API key
    (local.set $key_count (call $load_api_key))
    (if (i32.eqz (local.get $key_count))
      (then
        (drop (call $copy_mem (i32.const ${d_key_missing.offset}) (i32.const 1024) (i32.const ${d_key_missing.length})))
        (return (i32.const ${d_key_missing.length}))
      )
    )

    ;; Determine source text: check if input is JSON with "text":"
    (local.set $text_start (local.get $in_ptr))
    (local.set $raw_len (local.get $in_len))

    (local.set $json_text_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const ${needle_text_field.offset}) (i32.const ${needle_text_field.length})))
    (if (i32.ge_s (local.get $json_text_pos) (i32.const 0))
      (then
        (local.set $text_start (i32.add (i32.add (local.get $in_ptr) (local.get $json_text_pos)) (i32.const 8)))
        (local.set $i (i32.const 0))
        (loop $find_json_quote
          (if (i32.lt_u (i32.add (local.get $text_start) (local.get $i)) (i32.add (local.get $in_ptr) (local.get $in_len)))
            (then
              (if (i32.ne (i32.load8_u (i32.add (local.get $text_start) (local.get $i))) (i32.const 34))
                (then
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $find_json_quote)
                )
              )
            )
          )
        )
        (local.set $raw_len (local.get $i))
      )
    )

    ;; Sanitize input text into 10002000
    (local.set $i (i32.const 0))
    (local.set $out_ptr (i32.const 10002000))
    (loop $sanitize
      (if (i32.lt_u (local.get $i) (local.get $raw_len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $text_start) (local.get $i))))
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
          (br $sanitize)
        )
      )
    )
    (global.set $text_len (i32.sub (local.get $out_ptr) (i32.const 10002000)))

    ;; Build HTTP request at 100000
    (local.set $p (call $copy_mem (i32.const ${d_http_prefix.offset}) (i32.const 100000) (i32.const ${d_http_prefix.length})))
    (local.set $p (call $copy_mem (i32.const 10001000) (local.get $p) (global.get $key_len)))
    (local.set $p (call $copy_mem (i32.const ${d_http_mid1.offset}) (local.get $p) (i32.const ${d_http_mid1.length})))
    (local.set $p (call $copy_mem (i32.const 10002000) (local.get $p) (global.get $text_len)))
    (local.set $p (call $copy_mem (i32.const ${d_http_mid2.offset}) (local.get $p) (i32.const ${d_http_mid2.length})))
    (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

    (global.set $phase (i32.const 1))

    ;; Call network.http_request with response buffer at 1000000 (capacity 4 MB)
    (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 1000000) (i32.const 4000000)))
    (i32.const 0)
  )

  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $status_idx i32)
    (local $body_idx i32)
    (local $b64_start i32)
    (local $b64_len i32)
    (local $p i32)
    (local $req_len i32)
    (local $handle_idx i32)
    (local $h_start i32)
    (local $i i32)
    (local $ch i32)

    ;; Phase 1: HTTP Response received
    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        ;; First: verify that HTTP status was 200
        (local.set $status_idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const ${needle_status_200.offset}) (i32.const ${needle_status_200.length})))
        (if (i32.lt_s (local.get $status_idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const ${d_error_gen.offset}) (i32.const 1024) (i32.const ${d_error_gen.length})))
            (return (i32.const ${d_error_gen.length}))
          )
        )

        ;; Find "body":"
        (local.set $body_idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const ${needle_body_field.offset}) (i32.const ${needle_body_field.length})))
        (if (i32.lt_s (local.get $body_idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const ${d_error_gen.offset}) (i32.const 1024) (i32.const ${d_error_gen.length})))
            (return (i32.const ${d_error_gen.length}))
          )
        )

        (local.set $b64_start (i32.add (i32.add (local.get $res_ptr) (local.get $body_idx)) (i32.const ${needle_body_field.length})))
        (local.set $i (i32.const 0))
        (loop $find_quote
          (if (i32.lt_u (i32.add (local.get $b64_start) (local.get $i)) (i32.add (local.get $res_ptr) (local.get $res_len)))
            (then
              (if (i32.ne (i32.load8_u (i32.add (local.get $b64_start) (local.get $i))) (i32.const 34))
                (then
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $find_quote)
                )
              )
            )
          )
        )
        (local.set $b64_len (local.get $i))

        ;; Build files.write request at 5000000 (completely isolated from 1000000)
        (local.set $p (call $copy_mem (i32.const ${d_files_write_prefix.offset}) (i32.const 5000000) (i32.const ${d_files_write_prefix.length})))
        (local.set $p (call $copy_mem (local.get $b64_start) (local.get $p) (local.get $b64_len)))
        (local.set $p (call $copy_mem (i32.const ${d_files_write_suffix.offset}) (local.get $p) (i32.const ${d_files_write_suffix.length})))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 5000000)))

        (global.set $phase (i32.const 2))

        ;; Call files.write with response buffer at 9000000 (capacity 1 MB)
        (drop (call $host_call (i32.const 5000000) (local.get $req_len) (i32.const 9000000) (i32.const 65536)))
        (return (i32.const 0))
      )
    )

    ;; Phase 2: files.write response received
    (if (i32.eq (global.get $phase) (i32.const 2))
      (then
        (local.set $handle_idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const ${needle_handle_field.offset}) (i32.const ${needle_handle_field.length})))
        (if (i32.ge_s (local.get $handle_idx) (i32.const 0))
          (then
            (local.set $h_start (i32.add (i32.add (local.get $res_ptr) (local.get $handle_idx)) (i32.const ${needle_handle_field.length})))
            (local.set $i (i32.const 0))
            (loop $copy_handle
              (if (i32.lt_u (local.get $i) (i32.const 60))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $h_start) (local.get $i))))
                  (if (i32.ne (local.get $ch) (i32.const 34))
                    (then
                      (i32.store8 (i32.add (i32.const 10000000) (local.get $i)) (local.get $ch))
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $copy_handle)
                    )
                  )
                )
              )
            )
            (global.set $handle_len (local.get $i))

            ;; Build direct ToolResult bubble at 1024
            (local.set $p (call $copy_mem (i32.const ${d_direct_bubble_prefix.offset}) (i32.const 1024) (i32.const ${d_direct_bubble_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 10000000) (local.get $p) (global.get $handle_len)))
            (local.set $p (call $copy_mem (i32.const ${d_direct_bubble_suffix.offset}) (local.get $p) (i32.const ${d_direct_bubble_suffix.length})))
            (return (i32.sub (local.get $p) (i32.const 1024)))
          )
        )
      )
    )

    (drop (call $copy_mem (i32.const ${d_error_gen.offset}) (i32.const 1024) (i32.const ${d_error_gen.length})))
    (i32.const ${d_error_gen.length})
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
console.log('🔑 WASM SHA-256:', wasmSha256);
