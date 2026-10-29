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

// Define strings
const s_help = `🔊 **ElevenLabs Audio Generator**\n\nGenera audios de alta calidad con IA mediante ElevenLabs.\n\n**Comandos disponibles:**\n• \`/elevenlabs config <tu_api_key>\` — Registra tu clave de API\n• \`/elevenlabs status\` — Verifica el estado de la configuración\n• \`/elevenlabs <texto>\` — Genera un audio en MP3\n• \`/tts <texto>\` — Alias rápido para síntesis de voz\n\n*Obtén tu clave de API gratuita en: https://elevenlabs.io*`;
const s_key_saved = `✅ **Clave de ElevenLabs guardada exitosamente.**\n\nYa puedes generar audios usando:\n\`/elevenlabs Tu texto aquí\``;
const s_key_missing = `⚠️ **ElevenLabs no está configurado.**\n\nPor favor registra tu API Key ejecutando:\n\`/elevenlabs config <tu_api_key>\`\n\nPuedes obtener una clave gratuita en https://elevenlabs.io`;
const s_status_ok = `✅ **ElevenLabs está configurado y listo.**\n\nPuedes sintetizar audio con \`/elevenlabs <texto>\`.`;
const s_storage_get = JSON.stringify({ api: 'storage', operation: 'get', payload: { key: 'api_key' } });
const s_storage_set_prefix = '{"api":"storage","operation":"set","payload":{"key":"api_key","value":"';
const s_storage_set_suffix = '"}}';
const s_http_prefix = '{"api":"network","operation":"http_request","payload":{"url":"https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM","method":"POST","headers":{"xi-api-key":"';
const s_http_mid1 = '","Content-Type":"application/json","Accept":"audio/mpeg"},"body":"{\\"text\\":\\"';
const s_http_mid2 = '\\",\\"model_id\\":\\"eleven_multilingual_v2\\"}","responseType":"base64","timeoutMs":30000}}';
const s_files_write_prefix = '{"api":"files","operation":"write","payload":{"name":"audio_elevenlabs.mp3","encoding":"base64","content":"';
const s_files_write_suffix = '"}}';
const s_direct_bubble_prefix = '{"type":"direct","displayText":"🔊 **Audio generado exitosamente con ElevenLabs**\\n\\nTu archivo de audio MP3 está listo para guardar o compartir.","fileHandle":"';
const s_direct_bubble_suffix = '","fileName":"audio_elevenlabs.mp3"}';
const s_error_gen = `❌ **Error al generar audio con ElevenLabs**\n\nVerifica que tu API Key sea correcta o que tengas créditos disponibles en ElevenLabs.\nPuedes actualizar tu clave con:\n\`/elevenlabs config <tu_api_key>\``;

const d_help = toWatData(s_help);
const d_key_saved = toWatData(s_key_saved);
const d_key_missing = toWatData(s_key_missing);
const d_status_ok = toWatData(s_status_ok);
const d_storage_get = toWatData(s_storage_get);
const d_storage_set_prefix = toWatData(s_storage_set_prefix);
const d_storage_set_suffix = toWatData(s_storage_set_suffix);
const d_http_prefix = toWatData(s_http_prefix);
const d_http_mid1 = toWatData(s_http_mid1);
const d_http_mid2 = toWatData(s_http_mid2);
const d_files_write_prefix = toWatData(s_files_write_prefix);
const d_files_write_suffix = toWatData(s_files_write_suffix);
const d_direct_bubble_prefix = toWatData(s_direct_bubble_prefix);
const d_direct_bubble_suffix = toWatData(s_direct_bubble_suffix);
const d_error_gen = toWatData(s_error_gen);

// Needles
const needle_sk = toWatData('sk_');
const needle_config = toWatData('config');
const needle_status = toWatData('status');
const needle_text_field = toWatData('"text":"');

const watContent = `;; Chattree Official ElevenLabs Audio Generator Plugin
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  (memory (export "memory") 64)

  (global $phase (mut i32) (i32.const 0))
  (global $key_len (mut i32) (i32.const 0))
  (global $text_len (mut i32) (i32.const 0))
  (global $handle_len (mut i32) (i32.const 0))

  ;; Static Data Offsets: 10000..
  (data (i32.const 10000) "${d_help.escaped}")
  (data (i32.const 10500) "${d_key_saved.escaped}")
  (data (i32.const 10650) "${d_key_missing.escaped}")
  (data (i32.const 10850) "${d_status_ok.escaped}")
  (data (i32.const 11000) "${d_storage_get.escaped}")
  (data (i32.const 11100) "${d_storage_set_prefix.escaped}")
  (data (i32.const 11200) "${d_storage_set_suffix.escaped}")
  (data (i32.const 11300) "${d_http_prefix.escaped}")
  (data (i32.const 11500) "${d_http_mid1.escaped}")
  (data (i32.const 11600) "${d_http_mid2.escaped}")
  (data (i32.const 11750) "${d_files_write_prefix.escaped}")
  (data (i32.const 11850) "${d_files_write_suffix.escaped}")
  (data (i32.const 11900) "${d_direct_bubble_prefix.escaped}")
  (data (i32.const 12150) "${d_direct_bubble_suffix.escaped}")
  (data (i32.const 12200) "${d_error_gen.escaped}")

  ;; Search needles at 12400..
  (data (i32.const 12400) "${needle_sk.escaped}")
  (data (i32.const 12410) "${needle_config.escaped}")
  (data (i32.const 12420) "${needle_status.escaped}")
  (data (i32.const 12430) "${needle_text_field.escaped}")

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

  (func $load_api_key (result i32)
    (local $res_len i32)
    (local $val_idx i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)

    (local.set $res_len (call $host_call (i32.const 11000) (i32.const ${d_storage_get.length}) (i32.const 150000) (i32.const 8192)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (i32.store8 (i32.const 12500) (i32.const 34))
    (i32.store8 (i32.const 12501) (i32.const 118))
    (i32.store8 (i32.const 12502) (i32.const 97))
    (i32.store8 (i32.const 12503) (i32.const 108))
    (i32.store8 (i32.const 12504) (i32.const 117))
    (i32.store8 (i32.const 12505) (i32.const 101))
    (i32.store8 (i32.const 12506) (i32.const 34))
    (i32.store8 (i32.const 12507) (i32.const 58))
    (i32.store8 (i32.const 12508) (i32.const 34))

    (local.set $val_idx (call $find_substring (i32.const 150000) (local.get $res_len) (i32.const 12500) (i32.const 9)))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_start (i32.add (i32.const 150009) (local.get $val_idx)))
    (local.set $i (i32.const 0))
    (loop $copy_key
      (if (i32.lt_u (local.get $i) (i32.const 120))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
          (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 0)))
            (then
              (i32.store8 (i32.add (i32.const 1200000) (local.get $i)) (local.get $ch))
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
        (drop (call $copy_mem (i32.const 10000) (i32.const 1024) (i32.const ${d_help.length})))
        (return (i32.const ${d_help.length}))
      )
    )

    ;; 2. Detect API Key configuration (search for "sk_" anywhere in input)
    (local.set $sk_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 12400) (i32.const ${needle_sk.length})))
    (if (i32.ge_s (local.get $sk_pos) (i32.const 0))
      (then
        ;; Start key extraction at sk_pos
        (local.set $text_start (i32.add (local.get $in_ptr) (local.get $sk_pos)))
        ;; Read until delimiter (' ', '"', '}', '\\r', '\\n', null) up to 80 chars
        (local.set $i (i32.const 0))
        (loop $scan_sk
          (if (i32.lt_u (i32.add (local.get $sk_pos) (local.get $i)) (local.get $in_len))
            (then
              (if (i32.lt_u (local.get $i) (i32.const 80))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $text_start) (local.get $i))))
                  ;; Stop delimiters: space (32), quote (34), rbrace (125), CR (13), LF (10), null (0)
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
        (local.set $p (call $copy_mem (i32.const 11100) (i32.const 20000) (i32.const ${d_storage_set_prefix.length})))
        (local.set $p (call $copy_mem (local.get $text_start) (local.get $p) (local.get $raw_len)))
        (local.set $p (call $copy_mem (i32.const 11200) (local.get $p) (i32.const ${d_storage_set_suffix.length})))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 20000)))

        (drop (call $host_call (i32.const 20000) (local.get $req_len) (i32.const 150000) (i32.const 4096)))

        (drop (call $copy_mem (i32.const 10500) (i32.const 1024) (i32.const ${d_key_saved.length})))
        (return (i32.const ${d_key_saved.length}))
      )
    )

    ;; 3. Check for "config " command if key doesn't start with sk_
    (local.set $cfg_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 12410) (i32.const ${needle_config.length})))
    (if (i32.ge_s (local.get $cfg_pos) (i32.const 0))
      (then
        ;; Advance past "config"
        (local.set $text_start (i32.add (i32.add (local.get $in_ptr) (local.get $cfg_pos)) (i32.const 6)))
        ;; Skip spaces or colons
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
        ;; Read key until space, quote or end
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
            (local.set $p (call $copy_mem (i32.const 11100) (i32.const 20000) (i32.const ${d_storage_set_prefix.length})))
            (local.set $p (call $copy_mem (local.get $text_start) (local.get $p) (local.get $raw_len)))
            (local.set $p (call $copy_mem (i32.const 11200) (local.get $p) (i32.const ${d_storage_set_suffix.length})))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 20000)))

            (drop (call $host_call (i32.const 20000) (local.get $req_len) (i32.const 150000) (i32.const 4096)))

            (drop (call $copy_mem (i32.const 10500) (i32.const 1024) (i32.const ${d_key_saved.length})))
            (return (i32.const ${d_key_saved.length}))
          )
        )
      )
    )

    ;; 4. Check for "status"
    (local.set $status_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 12420) (i32.const ${needle_status.length})))
    (if (i32.ge_s (local.get $status_pos) (i32.const 0))
      (then
        (local.set $key_count (call $load_api_key))
        (if (i32.gt_u (local.get $key_count) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 10850) (i32.const 1024) (i32.const ${d_status_ok.length})))
            (return (i32.const ${d_status_ok.length}))
          )
          (else
            (drop (call $copy_mem (i32.const 10650) (i32.const 1024) (i32.const ${d_key_missing.length})))
            (return (i32.const ${d_key_missing.length}))
          )
        )
      )
    )

    ;; 5. Audio Synthesis: Load API key
    (local.set $key_count (call $load_api_key))
    (if (i32.eqz (local.get $key_count))
      (then
        (drop (call $copy_mem (i32.const 10650) (i32.const 1024) (i32.const ${d_key_missing.length})))
        (return (i32.const ${d_key_missing.length}))
      )
    )

    ;; Determine source text: check if input is JSON with "text":"
    (local.set $text_start (local.get $in_ptr))
    (local.set $raw_len (local.get $in_len))

    (local.set $json_text_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 12430) (i32.const ${needle_text_field.length})))
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

    ;; Sanitize input text into 1200200
    (local.set $i (i32.const 0))
    (local.set $out_ptr (i32.const 1200200))
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
    (global.set $text_len (i32.sub (local.get $out_ptr) (i32.const 1200200)))

    ;; Build HTTP request
    (local.set $p (call $copy_mem (i32.const 11300) (i32.const 20000) (i32.const ${d_http_prefix.length})))
    (local.set $p (call $copy_mem (i32.const 1200000) (local.get $p) (global.get $key_len)))
    (local.set $p (call $copy_mem (i32.const 11500) (local.get $p) (i32.const ${d_http_mid1.length})))
    (local.set $p (call $copy_mem (i32.const 1200200) (local.get $p) (global.get $text_len)))
    (local.set $p (call $copy_mem (i32.const 11600) (local.get $p) (i32.const ${d_http_mid2.length})))
    (local.set $req_len (i32.sub (local.get $p) (i32.const 20000)))

    (global.set $phase (i32.const 1))

    (drop (call $host_call (i32.const 20000) (local.get $req_len) (i32.const 150000) (i32.const 950000)))
    (i32.const 0)
  )

  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $body_idx i32)
    (local $b64_start i32)
    (local $b64_len i32)
    (local $p i32)
    (local $req_len i32)
    (local $handle_idx i32)
    (local $h_start i32)
    (local $i i32)
    (local $ch i32)

    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        (i32.store8 (i32.const 12600) (i32.const 34))
        (i32.store8 (i32.const 12601) (i32.const 98))
        (i32.store8 (i32.const 12602) (i32.const 111))
        (i32.store8 (i32.const 12603) (i32.const 100))
        (i32.store8 (i32.const 12604) (i32.const 121))
        (i32.store8 (i32.const 12605) (i32.const 34))
        (i32.store8 (i32.const 12606) (i32.const 58))
        (i32.store8 (i32.const 12607) (i32.const 34))

        (local.set $body_idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 12600) (i32.const 8)))
        (if (i32.lt_s (local.get $body_idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 12200) (i32.const 1024) (i32.const ${d_error_gen.length})))
            (return (i32.const ${d_error_gen.length}))
          )
        )

        (local.set $b64_start (i32.add (i32.add (local.get $res_ptr) (local.get $body_idx)) (i32.const 8)))
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

        (local.set $p (call $copy_mem (i32.const 11750) (i32.const 20000) (i32.const ${d_files_write_prefix.length})))
        (local.set $p (call $copy_mem (local.get $b64_start) (local.get $p) (local.get $b64_len)))
        (local.set $p (call $copy_mem (i32.const 11850) (local.get $p) (i32.const ${d_files_write_suffix.length})))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 20000)))

        (global.set $phase (i32.const 2))

        (drop (call $host_call (i32.const 20000) (local.get $req_len) (i32.const 150000) (i32.const 8192)))
        (return (i32.const 0))
      )
    )

    (if (i32.eq (global.get $phase) (i32.const 2))
      (then
        (i32.store8 (i32.const 12700) (i32.const 34))
        (i32.store8 (i32.const 12701) (i32.const 104))
        (i32.store8 (i32.const 12702) (i32.const 97))
        (i32.store8 (i32.const 12703) (i32.const 110))
        (i32.store8 (i32.const 12704) (i32.const 100))
        (i32.store8 (i32.const 12705) (i32.const 108))
        (i32.store8 (i32.const 12706) (i32.const 101))
        (i32.store8 (i32.const 12707) (i32.const 34))
        (i32.store8 (i32.const 12708) (i32.const 58))
        (i32.store8 (i32.const 12709) (i32.const 34))

        (local.set $handle_idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 12700) (i32.const 10)))
        (if (i32.ge_s (local.get $handle_idx) (i32.const 0))
          (then
            (local.set $h_start (i32.add (i32.add (local.get $res_ptr) (local.get $handle_idx)) (i32.const 10)))
            (local.set $i (i32.const 0))
            (loop $copy_handle
              (if (i32.lt_u (local.get $i) (i32.const 60))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $h_start) (local.get $i))))
                  (if (i32.ne (local.get $ch) (i32.const 34))
                    (then
                      (i32.store8 (i32.add (i32.const 1300000) (local.get $i)) (local.get $ch))
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $copy_handle)
                    )
                  )
                )
              )
            )
            (global.set $handle_len (local.get $i))

            (local.set $p (call $copy_mem (i32.const 11900) (i32.const 1024) (i32.const ${d_direct_bubble_prefix.length})))
            (local.set $p (call $copy_mem (i32.const 1300000) (local.get $p) (global.get $handle_len)))
            (local.set $p (call $copy_mem (i32.const 12150) (local.get $p) (i32.const ${d_direct_bubble_suffix.length})))
            (return (i32.sub (local.get $p) (i32.const 1024)))
          )
        )
      )
    )

    (drop (call $copy_mem (i32.const 12200) (i32.const 1024) (i32.const ${d_error_gen.length})))
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
