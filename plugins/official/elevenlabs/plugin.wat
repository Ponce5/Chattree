;; Chattree Official ElevenLabs Audio Generator Plugin with Natural Language Intent
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; 256 pages = 16 MB sandbox memory
  (memory (export "memory") 256)

  (global $phase (mut i32) (i32.const 0))
  (global $voice_mode (mut i32) (i32.const 0)) ;; 0: Male (George), 1: Female (Sarah)
  (global $key_len (mut i32) (i32.const 0))
  (global $text_len (mut i32) (i32.const 0))
  (global $handle_len (mut i32) (i32.const 0))

  ;; Static Data Segments
  (data (i32.const 10000) "\f0\9f\94\8a **ElevenLabs Audio Generator**\0a\0aGenera audios de alta calidad con IA mediante ElevenLabs con voces naturales (femeninas y masculinas).\0a\0a**Comandos disponibles:**\0a\e2\80\a2 `/elevenlabs config <tu_api_key>` \e2\80\94 Registra tu clave de API\0a\e2\80\a2 `/elevenlabs status` \e2\80\94 Verifica el estado de la configuraci\c3\b3n\0a\e2\80\a2 `/elevenlabs <texto>` \e2\80\94 Genera audio con voz predeterminada\0a\e2\80\a2 `/elevenlabs con voz de mujer que diga: \22texto\22` \e2\80\94 Selecci\c3\b3n inteligente de voz\0a\e2\80\a2 `/tts <texto>` \e2\80\94 Alias r\c3\a1pido para s\c3\adntesis de voz\0a\0a*Obt\c3\a9n tu clave de API gratuita en: https://elevenlabs.io*")
  (data (i32.const 10591) "\e2\9c\85 **Clave de ElevenLabs guardada exitosamente.**\0a\0aYa puedes generar audios usando:\0a`/elevenlabs Tu texto aqu\c3\ad` o pidiendo una voz femenina / masculina en lenguaje natural.")
  (data (i32.const 10781) "\e2\9a\a0\ef\b8\8f **ElevenLabs no est\c3\a1 configurado.**\0a\0aPor favor registra tu API Key ejecutando:\0a`/elevenlabs config <tu_api_key>`\0a\0aPuedes obtener una clave gratuita en https://elevenlabs.io")
  (data (i32.const 10977) "\e2\9c\85 **ElevenLabs est\c3\a1 configurado y listo.**\0a\0aPuedes sintetizar audio con `/elevenlabs <texto>` o pedir voz de mujer/hombre en lenguaje natural.")
  (data (i32.const 11138) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22api_key\22}}")
  (data (i32.const 11217) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22api_key\22,\22value\22:\22")
  (data (i32.const 11304) "\22}}")
  (data (i32.const 11323) "JBFqnCBsd6RMkjVDRZzb")
  (data (i32.const 11359) "EXAVITQu4vr4xnSDxMaL")
  (data (i32.const 11395) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.elevenlabs.io/v1/text-to-speech/")
  (data (i32.const 11517) "\22,\22method\22:\22POST\22,\22headers\22:{\22xi-api-key\22:\22")
  (data (i32.const 11576) "\22,\22Content-Type\22:\22application/json\22,\22Accept\22:\22audio/mpeg\22},\22body\22:\22{\5c\22text\5c\22:\5c\22")
  (data (i32.const 11671) "\5c\22,\5c\22model_id\5c\22:\5c\22eleven_multilingual_v2\5c\22}\22,\22responseType\22:\22base64\22,\22timeoutMs\22:30000}}")
  (data (i32.const 11775) "{\22api\22:\22files\22,\22operation\22:\22write\22,\22payload\22:{\22name\22:\22audio_elevenlabs.mp3\22,\22encoding\22:\22base64\22,\22content\22:\22")
  (data (i32.const 11898) "\22}}")
  (data (i32.const 11917) "{\22type\22:\22direct\22,\22displayText\22:\22\f0\9f\94\8a **Audio generado exitosamente (Voz Masculina: George)**\5cn\5cnTu archivo de audio MP3 est\c3\a1 listo para guardar o compartir.\22,\22fileHandle\22:\22")
  (data (i32.const 12106) "{\22type\22:\22direct\22,\22displayText\22:\22\f0\9f\94\8a **Audio generado exitosamente (Voz Femenina: Sarah)**\5cn\5cnTu archivo de audio MP3 est\c3\a1 listo para guardar o compartir.\22,\22fileHandle\22:\22")
  (data (i32.const 12293) "\22,\22fileName\22:\22audio_elevenlabs.mp3\22}")
  (data (i32.const 12345) "\e2\9d\8c **Error al generar audio con ElevenLabs**\0a\0aVerifica que tu API Key sea correcta o que tengas cr\c3\a9ditos disponibles en ElevenLabs.\0aPuedes actualizar tu clave con:\0a`/elevenlabs config <tu_api_key>`")
  (data (i32.const 12560) "sk_")
  (data (i32.const 12579) "config")
  (data (i32.const 12601) "status")
  (data (i32.const 12623) "\22text\22:\22")
  (data (i32.const 12647) "\22value\22:\22")
  (data (i32.const 12672) "\22statusCode\22:200")
  (data (i32.const 12704) "\22body\22:\22")
  (data (i32.const 12728) "\22handle\22:\22")
  (data (i32.const 12754) "mujer")
  (data (i32.const 12775) "femenin")
  (data (i32.const 12798) "chica")
  (data (i32.const 12819) "female")
  (data (i32.const 12841) "woman")
  (data (i32.const 12862) "sarah")
  (data (i32.const 12883) "alice")
  (data (i32.const 12904) "diga")
  (data (i32.const 12924) "diciendo")
  (data (i32.const 12948) "texto")
  (data (i32.const 12969) "mensaje")

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

  ;; Reads API Key from storage into 10001000
  (func $load_api_key (result i32)
    (local $res_len i32)
    (local $val_idx i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)

    (local.set $res_len (call $host_call (i32.const 11138) (i32.const 63) (i32.const 10000000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 10000000) (local.get $res_len) (i32.const 12647) (i32.const 9)))
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
    (local $q1 i32)
    (local $q2 i32)
    (local $q_char i32)
    (local $trig_pos i32)

    (global.set $phase (i32.const 0))
    (global.set $voice_mode (i32.const 0))

    ;; 1. Check for empty input
    (if (i32.eqz (local.get $in_len))
      (then
        (drop (call $copy_mem (i32.const 10000) (i32.const 1024) (i32.const 575)))
        (return (i32.const 575))
      )
    )

    ;; 2. Detect API Key configuration (search for "sk_" anywhere in input)
    (local.set $sk_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 12560) (i32.const 3)))
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
        (local.set $p (call $copy_mem (i32.const 11217) (i32.const 100000) (i32.const 71)))
        (local.set $p (call $copy_mem (local.get $text_start) (local.get $p) (local.get $raw_len)))
        (local.set $p (call $copy_mem (i32.const 11304) (local.get $p) (i32.const 3)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

        (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 10000000) (i32.const 1024)))

        (drop (call $copy_mem (i32.const 10591) (i32.const 1024) (i32.const 174)))
        (return (i32.const 174))
      )
    )

    ;; 3. Check for "config " command if key doesn't start with sk_
    (local.set $cfg_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 12579) (i32.const 6)))
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
            (local.set $p (call $copy_mem (i32.const 11217) (i32.const 100000) (i32.const 71)))
            (local.set $p (call $copy_mem (local.get $text_start) (local.get $p) (local.get $raw_len)))
            (local.set $p (call $copy_mem (i32.const 11304) (local.get $p) (i32.const 3)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 100000)))

            (drop (call $host_call (i32.const 100000) (local.get $req_len) (i32.const 10000000) (i32.const 1024)))

            (drop (call $copy_mem (i32.const 10591) (i32.const 1024) (i32.const 174)))
            (return (i32.const 174))
          )
        )
      )
    )

    ;; 4. Check for "status"
    (local.set $status_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 12601) (i32.const 6)))
    (if (i32.ge_s (local.get $status_pos) (i32.const 0))
      (then
        (local.set $key_count (call $load_api_key))
        (if (i32.gt_u (local.get $key_count) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 10977) (i32.const 1024) (i32.const 145)))
            (return (i32.const 145))
          )
          (else
            (drop (call $copy_mem (i32.const 10781) (i32.const 1024) (i32.const 180)))
            (return (i32.const 180))
          )
        )
      )
    )

    ;; 5. Audio Synthesis: Load API key
    (local.set $key_count (call $load_api_key))
    (if (i32.eqz (local.get $key_count))
      (then
        (drop (call $copy_mem (i32.const 10781) (i32.const 1024) (i32.const 180)))
        (return (i32.const 180))
      )
    )

    ;; ─── Natural Language Processing & Text Extraction ───
    ;; Copy lowercased input to 10003000 for keyword inspection
    (call $to_lower (local.get $in_ptr) (i32.const 10003000) (local.get $in_len))

    ;; 5.1 Voice Selection (Female keywords: mujer, femenin, chica, female, woman, sarah, alice)
    (if (i32.or
          (i32.or
            (i32.ge_s (call $find_substring (i32.const 10003000) (local.get $in_len) (i32.const 12754) (i32.const 5)) (i32.const 0))
            (i32.ge_s (call $find_substring (i32.const 10003000) (local.get $in_len) (i32.const 12775) (i32.const 7)) (i32.const 0)))
          (i32.or
            (i32.or
              (i32.ge_s (call $find_substring (i32.const 10003000) (local.get $in_len) (i32.const 12798) (i32.const 5)) (i32.const 0))
              (i32.ge_s (call $find_substring (i32.const 10003000) (local.get $in_len) (i32.const 12819) (i32.const 6)) (i32.const 0)))
            (i32.or
              (i32.ge_s (call $find_substring (i32.const 10003000) (local.get $in_len) (i32.const 12841) (i32.const 5)) (i32.const 0))
              (i32.or
                (i32.ge_s (call $find_substring (i32.const 10003000) (local.get $in_len) (i32.const 12862) (i32.const 5)) (i32.const 0))
                (i32.ge_s (call $find_substring (i32.const 10003000) (local.get $in_len) (i32.const 12883) (i32.const 5)) (i32.const 0))))))
      (then
        (global.set $voice_mode (i32.const 1)) ;; Female: Sarah
      )
      (else
        (global.set $voice_mode (i32.const 0)) ;; Male: George
      )
    )

    ;; 5.2 Text Extraction
    ;; Default: entire input
    (local.set $text_start (local.get $in_ptr))
    (local.set $raw_len (local.get $in_len))

    ;; Check if input is structured JSON with "text":"
    (local.set $json_text_pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 12623) (i32.const 8)))
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
      (else
        ;; Check for quoted speech: "..." or '...'
        (local.set $q1 (i32.const -1))
        (local.set $i (i32.const 0))
        (loop $find_q1
          (if (i32.lt_u (local.get $i) (local.get $in_len))
            (then
              (local.set $ch (i32.load8_u (i32.add (local.get $in_ptr) (local.get $i))))
              (if (i32.or (i32.eq (local.get $ch) (i32.const 34)) (i32.eq (local.get $ch) (i32.const 39)))
                (then
                  (local.set $q1 (local.get $i))
                  (local.set $q_char (local.get $ch))
                )
                (else
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $find_q1)
                )
              )
            )
          )
        )

        (if (i32.ge_s (local.get $q1) (i32.const 0))
          (then
            ;; Find closing quote
            (local.set $q2 (i32.const -1))
            (local.set $i (i32.add (local.get $q1) (i32.const 1)))
            (loop $find_q2
              (if (i32.lt_u (local.get $i) (local.get $in_len))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $in_ptr) (local.get $i))))
                  (if (i32.eq (local.get $ch) (local.get $q_char))
                    (then
                      (local.set $q2 (local.get $i))
                    )
                    (else
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $find_q2)
                    )
                  )
                )
              )
            )
            (if (i32.gt_s (local.get $q2) (local.get $q1))
              (then
                ;; Quoted speech extracted!
                (local.set $text_start (i32.add (local.get $in_ptr) (i32.add (local.get $q1) (i32.const 1))))
                (local.set $raw_len (i32.sub (i32.sub (local.get $q2) (local.get $q1)) (i32.const 1)))
              )
            )
          )
          (else
            ;; No quotes found: check natural speech triggers (diga, diciendo, texto, mensaje)
            (local.set $trig_pos (call $find_substring (i32.const 10003000) (local.get $in_len) (i32.const 12904) (i32.const 4)))
            (if (i32.ge_s (local.get $trig_pos) (i32.const 0))
              (then
                (local.set $text_start (i32.add (i32.add (local.get $in_ptr) (local.get $trig_pos)) (i32.const 4)))
              )
              (else
                (local.set $trig_pos (call $find_substring (i32.const 10003000) (local.get $in_len) (i32.const 12924) (i32.const 8)))
                (if (i32.ge_s (local.get $trig_pos) (i32.const 0))
                  (then
                    (local.set $text_start (i32.add (i32.add (local.get $in_ptr) (local.get $trig_pos)) (i32.const 8)))
                  )
                  (else
                    (local.set $trig_pos (call $find_substring (i32.const 10003000) (local.get $in_len) (i32.const 12948) (i32.const 5)))
                    (if (i32.ge_s (local.get $trig_pos) (i32.const 0))
                      (then
                        (local.set $text_start (i32.add (i32.add (local.get $in_ptr) (local.get $trig_pos)) (i32.const 5)))
                      )
                      (else
                        (local.set $trig_pos (call $find_substring (i32.const 10003000) (local.get $in_len) (i32.const 12969) (i32.const 7)))
                        (if (i32.ge_s (local.get $trig_pos) (i32.const 0))
                          (then
                            (local.set $text_start (i32.add (i32.add (local.get $in_ptr) (local.get $trig_pos)) (i32.const 7)))
                          )
                        )
                      )
                    )
                  )
                )
              )
            )

            ;; If a trigger matched, skip leading whitespace, colons and quotes
            (if (i32.ge_s (local.get $trig_pos) (i32.const 0))
              (then
                (loop $skip_lead
                  (if (i32.lt_u (local.get $text_start) (i32.add (local.get $in_ptr) (local.get $in_len)))
                    (then
                      (local.set $ch (i32.load8_u (local.get $text_start)))
                      (if (i32.or
                            (i32.or (i32.eq (local.get $ch) (i32.const 32)) (i32.eq (local.get $ch) (i32.const 58)))
                            (i32.or (i32.eq (local.get $ch) (i32.const 34)) (i32.eq (local.get $ch) (i32.const 39))))
                        (then
                          (local.set $text_start (i32.add (local.get $text_start) (i32.const 1)))
                          (br $skip_lead)
                        )
                      )
                    )
                  )
                )
                (local.set $raw_len (i32.sub (i32.add (local.get $in_ptr) (local.get $in_len)) (local.get $text_start)))
              )
            )
          )
        )
      )
    )

    ;; 5.3 Sanitize extracted text into 10002000
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

    ;; Fallback: if extracted text is empty, return help
    (if (i32.eqz (global.get $text_len))
      (then
        (drop (call $copy_mem (i32.const 10000) (i32.const 1024) (i32.const 575)))
        (return (i32.const 575))
      )
    )

    ;; 5.4 Build HTTP request at 100000
    (local.set $p (call $copy_mem (i32.const 11395) (i32.const 100000) (i32.const 106)))

    ;; Write selected Voice ID (20 bytes)
    (if (i32.eq (global.get $voice_mode) (i32.const 1))
      (then
        (local.set $p (call $copy_mem (i32.const 11359) (local.get $p) (i32.const 20)))
      )
      (else
        (local.set $p (call $copy_mem (i32.const 11323) (local.get $p) (i32.const 20)))
      )
    )

    (local.set $p (call $copy_mem (i32.const 11517) (local.get $p) (i32.const 43)))
    (local.set $p (call $copy_mem (i32.const 10001000) (local.get $p) (global.get $key_len)))
    (local.set $p (call $copy_mem (i32.const 11576) (local.get $p) (i32.const 79)))
    (local.set $p (call $copy_mem (i32.const 10002000) (local.get $p) (global.get $text_len)))
    (local.set $p (call $copy_mem (i32.const 11671) (local.get $p) (i32.const 88)))
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
        ;; Verify HTTP status code 200
        (local.set $status_idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 12672) (i32.const 16)))
        (if (i32.lt_s (local.get $status_idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 12345) (i32.const 1024) (i32.const 199)))
            (return (i32.const 199))
          )
        )

        ;; Find "body":"
        (local.set $body_idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 12704) (i32.const 8)))
        (if (i32.lt_s (local.get $body_idx) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 12345) (i32.const 1024) (i32.const 199)))
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

        ;; Build files.write request at 5000000
        (local.set $p (call $copy_mem (i32.const 11775) (i32.const 5000000) (i32.const 107)))
        (local.set $p (call $copy_mem (local.get $b64_start) (local.get $p) (local.get $b64_len)))
        (local.set $p (call $copy_mem (i32.const 11898) (local.get $p) (i32.const 3)))
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
        (local.set $handle_idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 12728) (i32.const 10)))
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

            ;; Build direct ToolResult bubble at 1024 with gender-specific confirmation
            (if (i32.eq (global.get $voice_mode) (i32.const 1))
              (then
                (local.set $p (call $copy_mem (i32.const 12106) (i32.const 1024) (i32.const 171)))
              )
              (else
                (local.set $p (call $copy_mem (i32.const 11917) (i32.const 1024) (i32.const 173)))
              )
            )
            (local.set $p (call $copy_mem (i32.const 10000000) (local.get $p) (global.get $handle_len)))
            (local.set $p (call $copy_mem (i32.const 12293) (local.get $p) (i32.const 36)))
            (return (i32.sub (local.get $p) (i32.const 1024)))
          )
        )
      )
    )

    (drop (call $copy_mem (i32.const 12345) (i32.const 1024) (i32.const 199)))
    (i32.const 199)
  )
)
