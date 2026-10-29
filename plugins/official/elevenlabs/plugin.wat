;; Chattree Official ElevenLabs Audio Generator Plugin
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
  (data (i32.const 10000) "\f0\9f\94\8a **ElevenLabs Audio Generator**\0a\0aGenera audios de alta calidad con IA mediante ElevenLabs.\0a\0a**Comandos disponibles:**\0a\e2\80\a2 `/elevenlabs config <tu_api_key>` \e2\80\94 Registra tu clave de API\0a\e2\80\a2 `/elevenlabs status` \e2\80\94 Verifica el estado de la configuraci\c3\b3n\0a\e2\80\a2 `/elevenlabs <texto>` \e2\80\94 Genera un audio en MP3\0a\e2\80\a2 `/tts <texto>` \e2\80\94 Alias r\c3\a1pido para s\c3\adntesis de voz\0a\0a*Obt\c3\a9n tu clave de API gratuita en: https://elevenlabs.io*")
  (data (i32.const 10446) "\e2\9c\85 **Clave de ElevenLabs guardada exitosamente.**\0a\0aYa puedes generar audios usando:\0a`/elevenlabs Tu texto aqu\c3\ad`")
  (data (i32.const 10575) "\e2\9a\a0\ef\b8\8f **ElevenLabs no est\c3\a1 configurado.**\0a\0aPor favor registra tu API Key ejecutando:\0a`/elevenlabs config <tu_api_key>`\0a\0aPuedes obtener una clave gratuita en https://elevenlabs.io")
  (data (i32.const 10771) "\e2\9c\85 **ElevenLabs est\c3\a1 configurado y listo.**\0a\0aPuedes sintetizar audio con `/elevenlabs <texto>`.")
  (data (i32.const 10884) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22api_key\22}}")
  (data (i32.const 10963) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22api_key\22,\22value\22:\22")
  (data (i32.const 11050) "\22}}")
  (data (i32.const 11069) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb\22,\22method\22:\22POST\22,\22headers\22:{\22xi-api-key\22:\22")
  (data (i32.const 11254) "\22,\22Content-Type\22:\22application/json\22,\22Accept\22:\22audio/mpeg\22},\22body\22:\22{\5c\22text\5c\22:\5c\22")
  (data (i32.const 11349) "\5c\22,\5c\22model_id\5c\22:\5c\22eleven_multilingual_v2\5c\22}\22,\22responseType\22:\22base64\22,\22timeoutMs\22:30000}}")
  (data (i32.const 11453) "{\22api\22:\22files\22,\22operation\22:\22write\22,\22payload\22:{\22name\22:\22audio_elevenlabs.mp3\22,\22encoding\22:\22base64\22,\22content\22:\22")
  (data (i32.const 11576) "\22}}")
  (data (i32.const 11595) "{\22type\22:\22direct\22,\22displayText\22:\22\f0\9f\94\8a **Audio generado exitosamente con ElevenLabs**\5cn\5cnTu archivo de audio MP3 est\c3\a1 listo para guardar o compartir.\22,\22fileHandle\22:\22")
  (data (i32.const 11775) "\22,\22fileName\22:\22audio_elevenlabs.mp3\22}")
  (data (i32.const 11827) "\e2\9d\8c **Error al generar audio con ElevenLabs**\0a\0aVerifica que tu API Key sea correcta o que tengas cr\c3\a9ditos disponibles en ElevenLabs.\0aPuedes actualizar tu clave con:\0a`/elevenlabs config <tu_api_key>`")
  (data (i32.const 12042) "sk_")
  (data (i32.const 12061) "config")
  (data (i32.const 12083) "status")
  (data (i32.const 12105) "\22text\22:\22")
  (data (i32.const 12129) "\22value\22:\22")
  (data (i32.const 12154) "\22statusCode\22:200")
  (data (i32.const 12186) "\22body\22:\22")
  (data (i32.const 12210) "\22handle\22:\22")

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

    (local.set $res_len (call $host_call (i32.const 10884) (i32.const 63) (i32.const 10000000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 10000000) (local.get $res_len) (i32.const 12129) (i32.const 9)))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_start (i32.add (i32.const 10000000) (i32.add (local.get $val_idx) (i32.const 9))))
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
        (drop (call $copy_mem (i32.const 10000) (i32.const 1024) (i32.const 430)))
        (return (i32.const 430))
      )
    )

    ;; 2. Detect API Key configuration (search for "sk_" anywhere in input)
    (local.set $sk_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 12042) (i32.const 3)))
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
        (local.set $p (call $copy_mem (i32.const 10963) (i32.const 100000) (i32.const 71)))
        (local.set $p (call $copy_mem (local.get $text_start) (local.get $p) (local.get $raw_len)))
        (local.set $p (call $copy_mem (i32.const 11050) (local.get $p) (i32.const 3)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 10000000) (i32.const 1024)))

        (drop (call $copy_mem (i32.const 10446) (i32.const 1024) (i32.const 113)))
        (return (i32.const 113))
      )
    )

    ;; 3. Check for "config " command if key doesn't start with sk_
    (local.set $cfg_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 12061) (i32.const 6)))
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
            (local.set $p (call $copy_mem (i32.const 10963) (i32.const 100000) (i32.const 71)))
            (local.set $p (call $copy_mem (local.get $text_start) (local.get $p) (local.get $raw_len)))
            (local.set $p (call $copy_mem (i32.const 11050) (local.get $p) (i32.const 3)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 10000000) (i32.const 1024)))

            (drop (call $copy_mem (i32.const 10446) (i32.const 1024) (i32.const 113)))
            (return (i32.const 113))
          )
        )
      )
    )

    ;; 4. Check for "status"
    (local.set $status_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 12083) (i32.const 6)))
    (if (i32.ge_s (local.get $status_pos) (i32.const 0))
      (then
        (local.set $key_count (call $load_api_key))
        (if (i32.gt_u (local.get $key_count) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 10771) (i32.const 1024) (i32.const 97)))
            (return (i32.const 97))
          )
          (else
            (drop (call $copy_mem (i32.const 10575) (i32.const 1024) (i32.const 180)))
            (return (i32.const 180))
          )
        )
      )
    )

    ;; 5. Audio Synthesis: Load API key
    (local.set $key_count (call $load_api_key))
    (if (i32.eqz (local.get $key_count))
      (then
        (drop (call $copy_mem (i32.const 10575) (i32.const 1024) (i32.const 180)))
        (return (i32.const 180))
      )
    )

    ;; Determine source text: check if input is JSON with "text":"
    (local.set $text_start (local.get $in_ptr))
    (local.set $raw_len (local.get $in_len))

    (local.set $json_text_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 12105) (i32.const 8)))
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
    (local.set $p (call $copy_mem (i32.const 11069) (i32.const 100000) (i32.const 169)))
    (local.set $p (call $copy_mem (i32.const 10001000) (local.get $p) (global.get $key_len)))
    (local.set $p (call $copy_mem (i32.const 11254) (local.get $p) (i32.const 79)))
    (local.set $p (call $copy_mem (i32.const 10002000) (local.get $p) (global.get $text_len)))
    (local.set $p (call $copy_mem (i32.const 11349) (local.get $p) (i32.const 88)))
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
        (local.set $status_idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 12154) (i32.const 16)))
        (if (i32.lt_s (local.get $status_idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 11827) (i32.const 1024) (i32.const 199)))
            (return (i32.const 199))
          )
        )

        ;; Find "body":"
        (local.set $body_idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 12186) (i32.const 8)))
        (if (i32.lt_s (local.get $body_idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 11827) (i32.const 1024) (i32.const 199)))
            (return (i32.const 199))
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

        ;; Build files.write request at 5000000 (completely isolated from 1000000)
        (local.set $p (call $copy_mem (i32.const 11453) (i32.const 5000000) (i32.const 107)))
        (local.set $p (call $copy_mem (local.get $b64_start) (local.get $p) (local.get $b64_len)))
        (local.set $p (call $copy_mem (i32.const 11576) (local.get $p) (i32.const 3)))
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
        (local.set $handle_idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 12210) (i32.const 10)))
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
            (local.set $p (call $copy_mem (i32.const 11595) (i32.const 1024) (i32.const 164)))
            (local.set $p (call $copy_mem (i32.const 10000000) (local.get $p) (global.get $handle_len)))
            (local.set $p (call $copy_mem (i32.const 11775) (local.get $p) (i32.const 36)))
            (return (i32.sub (local.get $p) (i32.const 1024)))
          )
        )
      )
    )

    (drop (call $copy_mem (i32.const 11827) (i32.const 1024) (i32.const 199)))
    (i32.const 199)
  )
)
