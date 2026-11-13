;; Chattree Official ElevenLabs Voice Plugin (v1.1.0)
;; Supports structured intentContract JSON + direct slash commands.
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; 256 pages = 16 MB sandbox memory
  (memory (export "memory") 256)

  (global $phase (mut i32) (i32.const 0))
  (global $key_len (mut i32) (i32.const 0))
  (global $text_len (mut i32) (i32.const 0))
  (global $esc_len (mut i32) (i32.const 0))
  (global $voice_id_len (mut i32) (i32.const 0))
  (global $voice_label_len (mut i32) (i32.const 0))
  (global $model_len (mut i32) (i32.const 0))
  (global $filename_len (mut i32) (i32.const 0))
  (global $handle_len (mut i32) (i32.const 0))

  ;; Static Data Segments (null-terminated)
  (data (i32.const 132000) "**ElevenLabs Voice**\0a\0aSynthesize speech into downloadable MP3 audio using ElevenLabs.\0a\0a**Commands:**\0a- `/elevenlabs <text>` \e2\80\94 Generate audio with default voice (George)\0a- `/elevenlabs config <api_key>` \e2\80\94 Save your ElevenLabs API key\0a- `/elevenlabs status` \e2\80\94 Check API key configuration\0a- `/elevenlabs disconnect` \e2\80\94 Remove saved API key\0a- `/tts <text>` \e2\80\94 Quick alias for speech synthesis\0a\0a**Voices:** `george` (default), `sarah`, `rachel`, `adam`, `antoni`, `josh`, `elli`, `sam`, or any 20-character ElevenLabs `voice_id`.\00")
  (data (i32.const 132700) "**ElevenLabs API key saved.**\0a\0aYou can now generate audio with `/elevenlabs <text>` or by asking in natural language.\00")
  (data (i32.const 132900) "**Invalid API key.**\0a\0aPlease provide a valid ElevenLabs API key:\0a`/elevenlabs config <api_key>`\00")
  (data (i32.const 133100) "**ElevenLabs is not configured.**\0a\0aSave your API key first:\0a`/elevenlabs config <api_key>`\00")
  (data (i32.const 133300) "**ElevenLabs is configured and ready.**\0a\0aDefault voice: `George`. Run `/elevenlabs <text>` to generate MP3 audio.\00")
  (data (i32.const 133500) "**ElevenLabs API key removed.**\0a\0aRun `/elevenlabs config <api_key>` whenever you want to reconnect.\00")
  (data (i32.const 133700) "**Failed to save MP3 file**\0a\0aAudio was synthesized, but Chattree could not write the file to local storage.\00")
  (data (i32.const 133900) "**ElevenLabs request failed**\0a\0a\00")
  (data (i32.const 134000) "\0a\0aCheck your API key or quota with `/elevenlabs status` or update it with `/elevenlabs config <api_key>`.\00")
  (data (i32.const 134200) "Unexpected response from ElevenLabs API.\00")

  ;; Storage JSON templates
  (data (i32.const 134300) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22api_key\22}}\00")
  (data (i32.const 134400) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22api_key\22,\22value\22:\22\00")
  (data (i32.const 134500) "\22}}\00")
  (data (i32.const 134520) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22api_key\22,\22value\22:\22\22}}\00")

  ;; HTTP JSON templates (body is a double-escaped JSON string)
  (data (i32.const 134620) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.elevenlabs.io/v1/text-to-speech/\00")
  (data (i32.const 134760) "\22,\22method\22:\22POST\22,\22headers\22:{\22xi-api-key\22:\22\00")
  (data (i32.const 134820) "\22,\22Content-Type\22:\22application/json\22,\22Accept\22:\22audio/mpeg\22},\22body\22:\22{\5c\22text\5c\22:\5c\22\00")
  (data (i32.const 134940) "\5c\22,\5c\22model_id\5c\22:\5c\22\00")
  (data (i32.const 134980) "\5c\22}\22,\22responseType\22:\22base64\22,\22timeoutMs\22:30000}}\00")

  ;; files.write JSON templates
  (data (i32.const 135060) "{\22api\22:\22files\22,\22operation\22:\22write\22,\22payload\22:{\22name\22:\22\00")
  (data (i32.const 135140) "\22,\22encoding\22:\22base64\22,\22content\22:\22\00")
  (data (i32.const 135200) "\22}}\00")

  ;; Direct ToolResult bubble templates
  (data (i32.const 135220) "{\22type\22:\22direct\22,\22displayText\22:\22**Audio generated (\00")
  (data (i32.const 135300) ")**\5cn\5cnYour MP3 file `\00")
  (data (i32.const 135350) "` is ready to play, save, or share.\22,\22fileHandle\22:\22\00")
  (data (i32.const 135420) "\22,\22fileName\22:\22\00")
  (data (i32.const 135460) "\22}\00")

  ;; Defaults & JSON key names
  (data (i32.const 135500) "eleven_multilingual_v2\00")
  (data (i32.const 135540) "elevenlabs_audio.mp3\00")
  (data (i32.const 135580) "elevenlabs_\00")
  (data (i32.const 135600) ".mp3\00")
  (data (i32.const 135620) "action\00")
  (data (i32.const 135640) "text\00")
  (data (i32.const 135660) "voice\00")
  (data (i32.const 135680) "model\00")
  (data (i32.const 135700) "filename\00")
  (data (i32.const 135720) "api_key\00")
  (data (i32.const 135740) "value\00")
  (data (i32.const 135760) "body\00")
  (data (i32.const 135780) "handle\00")
  (data (i32.const 135800) "message\00")
  (data (i32.const 135820) "detail\00")
  (data (i32.const 135840) "statusCode\00")

  ;; Actions & command keywords
  (data (i32.const 135900) "speak\00")
  (data (i32.const 135920) "config\00")
  (data (i32.const 135940) "status\00")
  (data (i32.const 135960) "disconnect\00")
  (data (i32.const 135980) "help\00")
  (data (i32.const 136000) "clear\00")
  (data (i32.const 136020) "logout\00")
  (data (i32.const 136040) "remove\00")
  (data (i32.const 136060) "set_key\00")
  (data (i32.const 136080) "key\00")
  (data (i32.const 136100) "sk_\00")

  ;; Voices: ID (20 bytes) + Display Label
  (data (i32.const 136200) "JBFqnCBsd6RMkjVDRZzb\00")
  (data (i32.const 136230) "George\00")
  (data (i32.const 136250) "EXAVITQu4vr4xnSDxMaL\00")
  (data (i32.const 136280) "Sarah\00")
  (data (i32.const 136300) "21m00Tcm4TlvDq8ikWAM\00")
  (data (i32.const 136330) "Rachel\00")
  (data (i32.const 136350) "pNInz6obpgDQGcFmaJgB\00")
  (data (i32.const 136380) "Adam\00")
  (data (i32.const 136400) "ErXwobaYiN019PkySvjV\00")
  (data (i32.const 136430) "Antoni\00")
  (data (i32.const 136450) "TxGEqnHWrfWFTfGW9XjX\00")
  (data (i32.const 136480) "Josh\00")
  (data (i32.const 136500) "MF3mGyEYCl7XYWbV9V6O\00")
  (data (i32.const 136530) "Elli\00")
  (data (i32.const 136550) "yoZ06aMxZJJ28mfd3POQ\00")
  (data (i32.const 136580) "Sam\00")
  (data (i32.const 136600) "Custom voice\00")

  ;; Voice match names (lowercase)
  (data (i32.const 136650) "george\00")
  (data (i32.const 136670) "male\00")
  (data (i32.const 136690) "hombre\00")
  (data (i32.const 136710) "masculino\00")
  (data (i32.const 136730) "sarah\00")
  (data (i32.const 136750) "female\00")
  (data (i32.const 136770) "mujer\00")
  (data (i32.const 136790) "femenino\00")
  (data (i32.const 136810) "rachel\00")
  (data (i32.const 136830) "adam\00")
  (data (i32.const 136850) "antoni\00")
  (data (i32.const 136870) "josh\00")
  (data (i32.const 136890) "elli\00")
  (data (i32.const 136910) "sam\00")

  ;; ── Memory & String Helpers ──────────────────────────────────────────

  (func $copy_mem (param $src i32) (param $dst i32) (param $len i32) (result i32)
    (if (i32.gt_s (local.get $len) (i32.const 0))
      (then
        (memory.copy (local.get $dst) (local.get $src) (local.get $len))
        (return (i32.add (local.get $dst) (local.get $len)))
      )
    )
    (local.get $dst)
  )

  (func $zlen (param $ptr i32) (result i32)
    (local $i i32)
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.ne (i32.load8_u (i32.add (local.get $ptr) (local.get $i))) (i32.const 0))
        (then
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (local.get $i)
  )

  (func $copy_zstr (param $src i32) (param $dst i32) (result i32)
    (local $len i32)
    (local.set $len (call $zlen (local.get $src)))
    (call $copy_mem (local.get $src) (local.get $dst) (local.get $len))
  )

  (func $return_zstr (param $src i32) (result i32)
    (local $end i32)
    (local.set $end (call $copy_zstr (local.get $src) (i32.const 65536)))
    (i32.sub (local.get $end) (i32.const 65536))
  )

  (func $is_ws (param $ch i32) (result i32)
    (i32.or
      (i32.or (i32.eq (local.get $ch) (i32.const 32)) (i32.eq (local.get $ch) (i32.const 9)))
      (i32.or (i32.eq (local.get $ch) (i32.const 10)) (i32.eq (local.get $ch) (i32.const 13)))
    )
  )

  (func $to_lower (param $src i32) (param $dst i32) (param $len i32)
    (local $i i32)
    (local $ch i32)
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 65)) (i32.le_u (local.get $ch) (i32.const 90)))
            (then (local.set $ch (i32.add (local.get $ch) (i32.const 32))))
          )
          (i32.store8 (i32.add (local.get $dst) (local.get $i)) (local.get $ch))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
  )

  (func $str_eq (param $a i32) (param $a_len i32) (param $b_zstr i32) (result i32)
    (local $b_len i32)
    (local $i i32)
    (local.set $b_len (call $zlen (local.get $b_zstr)))
    (if (i32.ne (local.get $a_len) (local.get $b_len))
      (then (return (i32.const 0)))
    )
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.lt_u (local.get $i) (local.get $a_len))
        (then
          (if (i32.ne
                (i32.load8_u (i32.add (local.get $a) (local.get $i)))
                (i32.load8_u (i32.add (local.get $b_zstr) (local.get $i))))
            (then (return (i32.const 0)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (i32.const 1)
  )

  (func $starts_with (param $buf i32) (param $len i32) (param $prefix_zstr i32) (result i32)
    (local $p_len i32)
    (local $i i32)
    (local.set $p_len (call $zlen (local.get $prefix_zstr)))
    (if (i32.lt_u (local.get $len) (local.get $p_len))
      (then (return (i32.const 0)))
    )
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.lt_u (local.get $i) (local.get $p_len))
        (then
          (if (i32.ne
                (i32.load8_u (i32.add (local.get $buf) (local.get $i)))
                (i32.load8_u (i32.add (local.get $prefix_zstr) (local.get $i))))
            (then (return (i32.const 0)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (i32.const 1)
  )

  ;; Checks if $buf starts with $kw followed by end-of-string or whitespace
  (func $match_cmd (param $buf i32) (param $len i32) (param $kw_zstr i32) (result i32)
    (local $k_len i32)
    (if (i32.eqz (call $starts_with (local.get $buf) (local.get $len) (local.get $kw_zstr)))
      (then (return (i32.const 0)))
    )
    (local.set $k_len (call $zlen (local.get $kw_zstr)))
    (if (i32.eq (local.get $len) (local.get $k_len))
      (then (return (i32.const 1)))
    )
    (call $is_ws (i32.load8_u (i32.add (local.get $buf) (local.get $k_len))))
  )

  (func $find_substring (param $haystack i32) (param $h_len i32) (param $needle i32) (param $n_len i32) (result i32)
    (local $i i32)
    (local $j i32)
    (local $match i32)
    (local.set $i (i32.const 0))
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
              (then (local.set $match (i32.const 0)))
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
    (i32.const -1)
  )

  ;; Hex digit value (-1 if invalid)
  (func $hex_val (param $ch i32) (result i32)
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 48)) (i32.le_u (local.get $ch) (i32.const 57)))
      (then (return (i32.sub (local.get $ch) (i32.const 48))))
    )
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 65)) (i32.le_u (local.get $ch) (i32.const 70)))
      (then (return (i32.sub (local.get $ch) (i32.const 55))))
    )
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 97)) (i32.le_u (local.get $ch) (i32.const 102)))
      (then (return (i32.sub (local.get $ch) (i32.const 87))))
    )
    (i32.const -1)
  )

  ;; Encode BMP codepoint as UTF-8 into $dst, returning updated $dst
  (func $write_utf8 (param $cp i32) (param $dst i32) (result i32)
    (if (i32.le_u (local.get $cp) (i32.const 127))
      (then
        (i32.store8 (local.get $dst) (local.get $cp))
        (return (i32.add (local.get $dst) (i32.const 1)))
      )
    )
    (if (i32.le_u (local.get $cp) (i32.const 2047))
      (then
        (i32.store8 (local.get $dst) (i32.or (i32.const 192) (i32.shr_u (local.get $cp) (i32.const 6))))
        (i32.store8 (i32.add (local.get $dst) (i32.const 1)) (i32.or (i32.const 128) (i32.and (local.get $cp) (i32.const 63))))
        (return (i32.add (local.get $dst) (i32.const 2)))
      )
    )
    (i32.store8 (local.get $dst) (i32.or (i32.const 224) (i32.shr_u (local.get $cp) (i32.const 12))))
    (i32.store8 (i32.add (local.get $dst) (i32.const 1)) (i32.or (i32.const 128) (i32.and (i32.shr_u (local.get $cp) (i32.const 6)) (i32.const 63))))
    (i32.store8 (i32.add (local.get $dst) (i32.const 2)) (i32.or (i32.const 128) (i32.and (local.get $cp) (i32.const 63))))
    (i32.add (local.get $dst) (i32.const 3))
  )

  ;; Whitespace-tolerant JSON string extractor with escape & \uXXXX decoding.
  ;; Searches $json[0..$jlen] for "<key>" : "<val>" and writes decoded bytes to $dst (up to $max_out).
  ;; Returns decoded length, or -1 if key not found.
  (func $extract_json_str (param $json i32) (param $jlen i32) (param $key_zstr i32) (param $dst i32) (param $max_out i32) (result i32)
    (local $klen i32)
    (local $i i32)
    (local $j i32)
    (local $match i32)
    (local $pos i32)
    (local $out i32)
    (local $ch i32)
    (local $esc i32)
    (local $d0 i32)
    (local $d1 i32)
    (local $d2 i32)
    (local $d3 i32)
    (local $cp i32)

    (local.set $klen (call $zlen (local.get $key_zstr)))
    (local.set $i (i32.const 0))

    (block $done
      (loop $scan_key
        (if (i32.gt_u (i32.add (local.get $i) (i32.add (local.get $klen) (i32.const 3))) (local.get $jlen))
          (then (return (i32.const -1)))
        )
        ;; Match opening quote + key + closing quote
        (if (i32.and
              (i32.eq (i32.load8_u (i32.add (local.get $json) (local.get $i))) (i32.const 34))
              (i32.eq (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $i) (i32.add (local.get $klen) (i32.const 1))))) (i32.const 34)))
          (then
            (local.set $j (i32.const 0))
            (local.set $match (i32.const 1))
            (loop $cmp_k
              (if (i32.lt_u (local.get $j) (local.get $klen))
                (then
                  (if (i32.ne
                        (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $i) (i32.add (local.get $j) (i32.const 1)))))
                        (i32.load8_u (i32.add (local.get $key_zstr) (local.get $j))))
                    (then (local.set $match (i32.const 0)))
                    (else
                      (local.set $j (i32.add (local.get $j) (i32.const 1)))
                      (br $cmp_k)
                    )
                  )
                )
              )
            )
            (if (local.get $match)
              (then
                (local.set $pos (i32.add (local.get $i) (i32.add (local.get $klen) (i32.const 2))))
                ;; Skip whitespace before ':'
                (loop $ws1
                  (if (i32.lt_u (local.get $pos) (local.get $jlen))
                    (then
                      (if (call $is_ws (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
                        (then
                          (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
                          (br $ws1)
                        )
                      )
                    )
                  )
                )
                (if (i32.and
                      (i32.lt_u (local.get $pos) (local.get $jlen))
                      (i32.eq (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 58)))
                  (then
                    (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
                    ;; Skip whitespace after ':'
                    (loop $ws2
                      (if (i32.lt_u (local.get $pos) (local.get $jlen))
                        (then
                          (if (call $is_ws (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
                            (then
                              (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
                              (br $ws2)
                            )
                          )
                        )
                      )
                    )
                    ;; Must start with '"'
                    (if (i32.and
                          (i32.lt_u (local.get $pos) (local.get $jlen))
                          (i32.eq (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 34)))
                      (then
                        (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
                        (br $done)
                      )
                    )
                  )
                )
              )
            )
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan_key)
      )
    )

    ;; Decode JSON string from $pos
    (local.set $out (local.get $dst))
    (loop $read_val
      (if (i32.and
            (i32.lt_u (local.get $pos) (local.get $jlen))
            (i32.lt_u (i32.sub (local.get $out) (local.get $dst)) (local.get $max_out)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
          (if (i32.eq (local.get $ch) (i32.const 34))
            (then (return (i32.sub (local.get $out) (local.get $dst))))
          )
          (if (i32.eq (local.get $ch) (i32.const 92)) ;; '\'
            (then
              (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
              (if (i32.ge_u (local.get $pos) (local.get $jlen))
                (then (return (i32.sub (local.get $out) (local.get $dst))))
              )
              (local.set $esc (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
              (if (i32.eq (local.get $esc) (i32.const 110)) ;; \n
                (then
                  (i32.store8 (local.get $out) (i32.const 10))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
                  (br $read_val)
                )
              )
              (if (i32.eq (local.get $esc) (i32.const 114)) ;; \r
                (then
                  (i32.store8 (local.get $out) (i32.const 13))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
                  (br $read_val)
                )
              )
              (if (i32.eq (local.get $esc) (i32.const 116)) ;; \t
                (then
                  (i32.store8 (local.get $out) (i32.const 9))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
                  (br $read_val)
                )
              )
              (if (i32.and
                    (i32.eq (local.get $esc) (i32.const 117)) ;; \uXXXX
                    (i32.le_u (i32.add (local.get $pos) (i32.const 4)) (i32.sub (local.get $jlen) (i32.const 1))))
                (then
                  (local.set $d0 (call $hex_val (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 1))))))
                  (local.set $d1 (call $hex_val (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 2))))))
                  (local.set $d2 (call $hex_val (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 3))))))
                  (local.set $d3 (call $hex_val (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 4))))))
                  (if (i32.and
                        (i32.and (i32.ge_s (local.get $d0) (i32.const 0)) (i32.ge_s (local.get $d1) (i32.const 0)))
                        (i32.and (i32.ge_s (local.get $d2) (i32.const 0)) (i32.ge_s (local.get $d3) (i32.const 0))))
                    (then
                      (local.set $cp
                        (i32.or
                          (i32.or (i32.shl (local.get $d0) (i32.const 12)) (i32.shl (local.get $d1) (i32.const 8)))
                          (i32.or (i32.shl (local.get $d2) (i32.const 4)) (local.get $d3))))
                      ;; Skip UTF-16 surrogate halves safely
                      (if (i32.and (i32.ge_u (local.get $cp) (i32.const 55296)) (i32.le_u (local.get $cp) (i32.const 57343)))
                        (then
                          (local.set $pos (i32.add (local.get $pos) (i32.const 5)))
                          (br $read_val)
                        )
                      )
                      (local.set $out (call $write_utf8 (local.get $cp) (local.get $out)))
                      (local.set $pos (i32.add (local.get $pos) (i32.const 5)))
                      (br $read_val)
                    )
                  )
                )
              )
              ;; Default: store escaped char literally (\", \\, \/)
              (i32.store8 (local.get $out) (local.get $esc))
              (local.set $out (i32.add (local.get $out) (i32.const 1)))
              (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
              (br $read_val)
            )
          )
          (i32.store8 (local.get $out) (local.get $ch))
          (local.set $out (i32.add (local.get $out) (i32.const 1)))
          (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
          (br $read_val)
        )
      )
    )
    (i32.sub (local.get $out) (local.get $dst))
  )

  ;; Check if JSON has "statusCode" : 200
  (func $is_http_200 (param $json i32) (param $jlen i32) (result i32)
    (local $idx i32)
    (local $pos i32)
    (local $c0 i32)
    (local $c1 i32)
    (local $c2 i32)
    (local.set $idx (call $find_substring (local.get $json) (local.get $jlen) (i32.const 135840) (i32.const 10)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then (return (i32.const 0)))
    )
    (local.set $pos (i32.add (local.get $idx) (i32.const 10)))
    (loop $skip
      (if (i32.lt_u (local.get $pos) (local.get $jlen))
        (then
          (local.set $c0 (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
          (if (i32.or
                (i32.or (i32.eq (local.get $c0) (i32.const 34)) (i32.eq (local.get $c0) (i32.const 58)))
                (call $is_ws (local.get $c0)))
            (then
              (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
              (br $skip)
            )
          )
        )
      )
    )
    (if (i32.gt_u (i32.add (local.get $pos) (i32.const 3)) (local.get $jlen))
      (then (return (i32.const 0)))
    )
    (local.set $c0 (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
    (local.set $c1 (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 1)))))
    (local.set $c2 (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 2)))))
    (i32.and
      (i32.eq (local.get $c0) (i32.const 50)) ;; '2'
      (i32.and (i32.eq (local.get $c1) (i32.const 48)) (i32.eq (local.get $c2) (i32.const 48))) ;; '00'
    )
  )

  ;; Double-JSON-escape $raw_text (162000..162000+$text_len) into $escaped_text (172000)
  ;; for embedding inside outer JSON "body":"{\"text\":\"...\"}"
  (func $escape_body_text
    (local $i i32)
    (local $ch i32)
    (local $out i32)
    (local $lim i32)
    (local.set $lim (global.get $text_len))
    (if (i32.gt_u (local.get $lim) (i32.const 4500))
      (then (local.set $lim (i32.const 4500)))
    )
    (local.set $i (i32.const 0))
    (local.set $out (i32.const 172000))
    (loop $l
      (if (i32.lt_u (local.get $i) (local.get $lim))
        (then
          (local.set $ch (i32.load8_u (i32.add (i32.const 162000) (local.get $i))))
          (if (i32.eq (local.get $ch) (i32.const 34)) ;; '"' -> \\\"
            (then
              (i32.store8 (local.get $out) (i32.const 92))
              (i32.store8 (i32.add (local.get $out) (i32.const 1)) (i32.const 92))
              (i32.store8 (i32.add (local.get $out) (i32.const 2)) (i32.const 92))
              (i32.store8 (i32.add (local.get $out) (i32.const 3)) (i32.const 34))
              (local.set $out (i32.add (local.get $out) (i32.const 4)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $l)
            )
          )
          (if (i32.eq (local.get $ch) (i32.const 92)) ;; '\' -> \\\\
            (then
              (i32.store8 (local.get $out) (i32.const 92))
              (i32.store8 (i32.add (local.get $out) (i32.const 1)) (i32.const 92))
              (i32.store8 (i32.add (local.get $out) (i32.const 2)) (i32.const 92))
              (i32.store8 (i32.add (local.get $out) (i32.const 3)) (i32.const 92))
              (local.set $out (i32.add (local.get $out) (i32.const 4)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $l)
            )
          )
          (if (i32.eq (local.get $ch) (i32.const 10)) ;; '\n' -> \\n
            (then
              (i32.store8 (local.get $out) (i32.const 92))
              (i32.store8 (i32.add (local.get $out) (i32.const 1)) (i32.const 92))
              (i32.store8 (i32.add (local.get $out) (i32.const 2)) (i32.const 110))
              (local.set $out (i32.add (local.get $out) (i32.const 3)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $l)
            )
          )
          (if (i32.eq (local.get $ch) (i32.const 13)) ;; '\r' -> space
            (then
              (i32.store8 (local.get $out) (i32.const 32))
              (local.set $out (i32.add (local.get $out) (i32.const 1)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $l)
            )
          )
          (if (i32.eq (local.get $ch) (i32.const 9)) ;; '\t' -> space
            (then
              (i32.store8 (local.get $out) (i32.const 32))
              (local.set $out (i32.add (local.get $out) (i32.const 1)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $l)
            )
          )
          (if (i32.lt_u (local.get $ch) (i32.const 32))
            (then (local.set $ch (i32.const 32)))
          )
          (i32.store8 (local.get $out) (local.get $ch))
          (local.set $out (i32.add (local.get $out) (i32.const 1)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (global.set $esc_len (i32.sub (local.get $out) (i32.const 172000)))
  )

  ;; Resolve voice name/id into $voice_id (160600) and $voice_label (160700)
  (func $set_voice (param $id_zstr i32) (param $label_zstr i32)
    (local $end i32)
    (local.set $end (call $copy_zstr (local.get $id_zstr) (i32.const 160600)))
    (global.set $voice_id_len (i32.sub (local.get $end) (i32.const 160600)))
    (local.set $end (call $copy_zstr (local.get $label_zstr) (i32.const 160700)))
    (global.set $voice_label_len (i32.sub (local.get $end) (i32.const 160700)))
  )

  (func $is_alnum (param $ch i32) (result i32)
    (i32.or
      (i32.and (i32.ge_u (local.get $ch) (i32.const 48)) (i32.le_u (local.get $ch) (i32.const 57)))
      (i32.or
        (i32.and (i32.ge_u (local.get $ch) (i32.const 65)) (i32.le_u (local.get $ch) (i32.const 90)))
        (i32.and (i32.ge_u (local.get $ch) (i32.const 97)) (i32.le_u (local.get $ch) (i32.const 122)))
      )
    )
  )

  (func $resolve_voice (param $v_ptr i32) (param $v_len i32)
    (local $i i32)
    (local $ok i32)
    (local $end i32)
    ;; Default: George
    (call $set_voice (i32.const 136200) (i32.const 136230))
    (if (i32.le_s (local.get $v_len) (i32.const 0))
      (then (return))
    )

    ;; Lowercase into 190000
    (call $to_lower (local.get $v_ptr) (i32.const 190000) (local.get $v_len))

    (if (i32.or
          (i32.or (call $str_eq (i32.const 190000) (local.get $v_len) (i32.const 136650))
                  (call $str_eq (i32.const 190000) (local.get $v_len) (i32.const 136670)))
          (i32.or (call $str_eq (i32.const 190000) (local.get $v_len) (i32.const 136690))
                  (call $str_eq (i32.const 190000) (local.get $v_len) (i32.const 136710))))
      (then (call $set_voice (i32.const 136200) (i32.const 136230)) (return))
    )
    (if (i32.or
          (i32.or (call $str_eq (i32.const 190000) (local.get $v_len) (i32.const 136730))
                  (call $str_eq (i32.const 190000) (local.get $v_len) (i32.const 136750)))
          (i32.or (call $str_eq (i32.const 190000) (local.get $v_len) (i32.const 136770))
                  (call $str_eq (i32.const 190000) (local.get $v_len) (i32.const 136790))))
      (then (call $set_voice (i32.const 136250) (i32.const 136280)) (return))
    )
    (if (call $str_eq (i32.const 190000) (local.get $v_len) (i32.const 136810))
      (then (call $set_voice (i32.const 136300) (i32.const 136330)) (return))
    )
    (if (call $str_eq (i32.const 190000) (local.get $v_len) (i32.const 136830))
      (then (call $set_voice (i32.const 136350) (i32.const 136380)) (return))
    )
    (if (call $str_eq (i32.const 190000) (local.get $v_len) (i32.const 136850))
      (then (call $set_voice (i32.const 136400) (i32.const 136430)) (return))
    )
    (if (call $str_eq (i32.const 190000) (local.get $v_len) (i32.const 136870))
      (then (call $set_voice (i32.const 136450) (i32.const 136480)) (return))
    )
    (if (call $str_eq (i32.const 190000) (local.get $v_len) (i32.const 136890))
      (then (call $set_voice (i32.const 136500) (i32.const 136530)) (return))
    )
    (if (call $str_eq (i32.const 190000) (local.get $v_len) (i32.const 136910))
      (then (call $set_voice (i32.const 136550) (i32.const 136580)) (return))
    )

    ;; Pass through custom alphanumeric ElevenLabs voice_id (16..32 chars)
    (if (i32.and (i32.ge_u (local.get $v_len) (i32.const 16)) (i32.le_u (local.get $v_len) (i32.const 32)))
      (then
        (local.set $ok (i32.const 1))
        (local.set $i (i32.const 0))
        (loop $chk
          (if (i32.lt_u (local.get $i) (local.get $v_len))
            (then
              (if (i32.eqz (call $is_alnum (i32.load8_u (i32.add (local.get $v_ptr) (local.get $i)))))
                (then (local.set $ok (i32.const 0)))
                (else
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $chk)
                )
              )
            )
          )
        )
        (if (local.get $ok)
          (then
            (drop (call $copy_mem (local.get $v_ptr) (i32.const 160600) (local.get $v_len)))
            (global.set $voice_id_len (local.get $v_len))
            (local.set $end (call $copy_zstr (i32.const 136600) (i32.const 160700)))
            (global.set $voice_label_len (i32.sub (local.get $end) (i32.const 160700)))
          )
        )
      )
    )
  )

  ;; Build safe .mp3 filename in 161000
  (func $build_filename (param $req_len i32)
    (local $i i32)
    (local $ch i32)
    (local $out i32)
    (local $slug_len i32)
    (local $has_ext i32)

    ;; If user/AI supplied filename in 161000 (req_len > 0), sanitize in-place
    (if (i32.gt_s (local.get $req_len) (i32.const 0))
      (then
        (local.set $out (i32.const 161000))
        (local.set $i (i32.const 0))
        (loop $san
          (if (i32.and (i32.lt_u (local.get $i) (local.get $req_len)) (i32.lt_u (i32.sub (local.get $out) (i32.const 161000)) (i32.const 56)))
            (then
              (local.set $ch (i32.load8_u (i32.add (i32.const 161000) (local.get $i))))
              (if (i32.or (call $is_alnum (local.get $ch))
                          (i32.or (i32.eq (local.get $ch) (i32.const 46))
                                  (i32.or (i32.eq (local.get $ch) (i32.const 95)) (i32.eq (local.get $ch) (i32.const 45)))))
                (then
                  (i32.store8 (local.get $out) (local.get $ch))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                )
                (else
                  (if (i32.eq (local.get $ch) (i32.const 32))
                    (then
                      (i32.store8 (local.get $out) (i32.const 95))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                    )
                  )
                )
              )
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $san)
            )
          )
        )
        (local.set $slug_len (i32.sub (local.get $out) (i32.const 161000)))
        (if (i32.gt_u (local.get $slug_len) (i32.const 0))
          (then
            ;; Append .mp3 if not already ending with .mp3
            (local.set $has_ext (i32.const 0))
            (if (i32.ge_u (local.get $slug_len) (i32.const 4))
              (then
                (if (i32.ge_s (call $find_substring (i32.add (i32.const 161000) (i32.sub (local.get $slug_len) (i32.const 4))) (i32.const 4) (i32.const 135600) (i32.const 4)) (i32.const 0))
                  (then (local.set $has_ext (i32.const 1)))
                )
              )
            )
            (if (i32.eqz (local.get $has_ext))
              (then (local.set $out (call $copy_zstr (i32.const 135600) (local.get $out))))
            )
            (global.set $filename_len (i32.sub (local.get $out) (i32.const 161000)))
            (return)
          )
        )
      )
    )

    ;; Derive filename from first 24 chars of $raw_text: elevenlabs_<slug>.mp3
    (local.set $out (call $copy_zstr (i32.const 135580) (i32.const 161000)))
    (local.set $i (i32.const 0))
    (local.set $slug_len (i32.const 0))
    (loop $slug
      (if (i32.and (i32.lt_u (local.get $i) (global.get $text_len)) (i32.lt_u (local.get $slug_len) (i32.const 24)))
        (then
          (local.set $ch (i32.load8_u (i32.add (i32.const 162000) (local.get $i))))
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 65)) (i32.le_u (local.get $ch) (i32.const 90)))
            (then (local.set $ch (i32.add (local.get $ch) (i32.const 32))))
          )
          (if (call $is_alnum (local.get $ch))
            (then
              (i32.store8 (local.get $out) (local.get $ch))
              (local.set $out (i32.add (local.get $out) (i32.const 1)))
              (local.set $slug_len (i32.add (local.get $slug_len) (i32.const 1)))
            )
            (else
              (if (i32.and (i32.eq (local.get $ch) (i32.const 32)) (i32.gt_u (local.get $slug_len) (i32.const 0)))
                (then
                  (if (i32.ne (i32.load8_u (i32.sub (local.get $out) (i32.const 1))) (i32.const 95))
                    (then
                      (i32.store8 (local.get $out) (i32.const 95))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $slug_len (i32.add (local.get $slug_len) (i32.const 1)))
                    )
                  )
                )
              )
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $slug)
        )
      )
    )
    (if (i32.eqz (local.get $slug_len))
      (then
        (local.set $out (call $copy_zstr (i32.const 135540) (i32.const 161000)))
        (global.set $filename_len (i32.sub (local.get $out) (i32.const 161000)))
        (return)
      )
    )
    (local.set $out (call $copy_zstr (i32.const 135600) (local.get $out)))
    (global.set $filename_len (i32.sub (local.get $out) (i32.const 161000)))
  )

  ;; Storage helpers (API key at 160100)
  (func $load_api_key (result i32)
    (local $res_len i32)
    (local $vlen i32)
    (local.set $res_len (call $host_call (i32.const 134300) (call $zlen (i32.const 134300)) (i32.const 360000) (i32.const 2048)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )
    (local.set $vlen (call $extract_json_str (i32.const 360000) (local.get $res_len) (i32.const 135740) (i32.const 160100) (i32.const 200)))
    (if (i32.le_s (local.get $vlen) (i32.const 0))
      (then (return (i32.const 0)))
    )
    (global.set $key_len (local.get $vlen))
    (local.get $vlen)
  )

  (func $save_api_key (param $k_ptr i32) (param $k_len i32) (result i32)
    (local $p i32)
    (local $req_len i32)
    (if (i32.lt_u (local.get $k_len) (i32.const 8))
      (then (return (call $return_zstr (i32.const 132900))))
    )
    (local.set $p (call $copy_zstr (i32.const 134400) (i32.const 260000)))
    (local.set $p (call $copy_mem (local.get $k_ptr) (local.get $p) (local.get $k_len)))
    (local.set $p (call $copy_zstr (i32.const 134500) (local.get $p)))
    (local.set $req_len (i32.sub (local.get $p) (i32.const 260000)))
    (drop (call $host_call (i32.const 260000) (local.get $req_len) (i32.const 360000) (i32.const 1024)))
    (call $return_zstr (i32.const 132700))
  )

  ;; ── Entrypoint ───────────────────────────────────────────────────────

  (func (export "elevenlabs_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $trim_start i32)
    (local $trim_len i32)
    (local $act_len i32)
    (local $val_len i32)
    (local $tok_start i32)
    (local $tok_len i32)
    (local $p i32)
    (local $req_len i32)
    (local $has_space i32)
    (local $i i32)

    (global.set $phase (i32.const 0))
    (global.set $key_len (i32.const 0))
    (global.set $text_len (i32.const 0))
    (global.set $model_len (i32.const 0))
    (global.set $filename_len (i32.const 0))
    (global.set $handle_len (i32.const 0))

    ;; Trim leading & trailing whitespace
    (local.set $trim_start (local.get $in_ptr))
    (local.set $trim_len (local.get $in_len))
    (loop $ltrim
      (if (i32.and (i32.gt_u (local.get $trim_len) (i32.const 0)) (call $is_ws (i32.load8_u (local.get $trim_start))))
        (then
          (local.set $trim_start (i32.add (local.get $trim_start) (i32.const 1)))
          (local.set $trim_len (i32.sub (local.get $trim_len) (i32.const 1)))
          (br $ltrim)
        )
      )
    )
    (loop $rtrim
      (if (i32.and (i32.gt_u (local.get $trim_len) (i32.const 0))
                   (call $is_ws (i32.load8_u (i32.add (local.get $trim_start) (i32.sub (local.get $trim_len) (i32.const 1))))))
        (then
          (local.set $trim_len (i32.sub (local.get $trim_len) (i32.const 1)))
          (br $rtrim)
        )
      )
    )

    (if (i32.eqz (local.get $trim_len))
      (then (return (call $return_zstr (i32.const 132000))))
    )

    ;; ── Case A: JSON Tool Call from intentContract ──────────────────────
    (if (i32.eq (i32.load8_u (local.get $trim_start)) (i32.const 123)) ;; '{'
      (then
        (local.set $act_len (call $extract_json_str (local.get $trim_start) (local.get $trim_len) (i32.const 135620) (i32.const 160000) (i32.const 64)))
        (if (i32.gt_s (local.get $act_len) (i32.const 0))
          (then
            (call $to_lower (i32.const 160000) (i32.const 160000) (local.get $act_len))
            (if (call $str_eq (i32.const 160000) (local.get $act_len) (i32.const 135980)) ;; help
              (then (return (call $return_zstr (i32.const 132000))))
            )
            (if (call $str_eq (i32.const 160000) (local.get $act_len) (i32.const 135940)) ;; status
              (then
                (if (i32.gt_s (call $load_api_key) (i32.const 0))
                  (then (return (call $return_zstr (i32.const 133300))))
                )
                (return (call $return_zstr (i32.const 133100)))
              )
            )
            (if (call $str_eq (i32.const 160000) (local.get $act_len) (i32.const 135960)) ;; disconnect
              (then
                (drop (call $host_call (i32.const 134520) (call $zlen (i32.const 134520)) (i32.const 360000) (i32.const 1024)))
                (return (call $return_zstr (i32.const 133500)))
              )
            )
            (if (call $str_eq (i32.const 160000) (local.get $act_len) (i32.const 135920)) ;; config
              (then
                (local.set $val_len (call $extract_json_str (local.get $trim_start) (local.get $trim_len) (i32.const 135720) (i32.const 160100) (i32.const 200)))
                (if (i32.le_s (local.get $val_len) (i32.const 0))
                  (then (local.set $val_len (call $extract_json_str (local.get $trim_start) (local.get $trim_len) (i32.const 135640) (i32.const 160100) (i32.const 200))))
                )
                (return (call $save_api_key (i32.const 160100) (local.get $val_len)))
              )
            )
          )
        )

        ;; Default JSON action: speak
        (local.set $val_len (call $extract_json_str (local.get $trim_start) (local.get $trim_len) (i32.const 135640) (i32.const 162000) (i32.const 8000)))
        (if (i32.le_s (local.get $val_len) (i32.const 0))
          (then (return (call $return_zstr (i32.const 132000))))
        )
        (global.set $text_len (local.get $val_len))

        ;; Optional voice
        (local.set $val_len (call $extract_json_str (local.get $trim_start) (local.get $trim_len) (i32.const 135660) (i32.const 160400) (i32.const 64)))
        (call $resolve_voice (i32.const 160400) (local.get $val_len))

        ;; Optional model
        (local.set $val_len (call $extract_json_str (local.get $trim_start) (local.get $trim_len) (i32.const 135680) (i32.const 160800) (i32.const 64)))
        (if (i32.gt_s (local.get $val_len) (i32.const 0))
          (then (global.set $model_len (local.get $val_len)))
          (else
            (local.set $p (call $copy_zstr (i32.const 135500) (i32.const 160800)))
            (global.set $model_len (i32.sub (local.get $p) (i32.const 160800)))
          )
        )

        ;; Optional filename
        (local.set $val_len (call $extract_json_str (local.get $trim_start) (local.get $trim_len) (i32.const 135700) (i32.const 161000) (i32.const 80)))
        (call $build_filename (local.get $val_len))
      )
      (else
        ;; ── Case B: Direct Slash Command / Plain Text ───────────────────
        (call $to_lower (local.get $trim_start) (i32.const 190000) (local.get $trim_len))

        (if (i32.or (call $match_cmd (i32.const 190000) (local.get $trim_len) (i32.const 135980))
                    (i32.and (i32.eq (local.get $trim_len) (i32.const 1)) (i32.eq (i32.load8_u (local.get $trim_start)) (i32.const 63))))
          (then (return (call $return_zstr (i32.const 132000))))
        )

        (if (call $match_cmd (i32.const 190000) (local.get $trim_len) (i32.const 135940))
          (then
            (if (i32.gt_s (call $load_api_key) (i32.const 0))
              (then (return (call $return_zstr (i32.const 133300))))
            )
            (return (call $return_zstr (i32.const 133100)))
          )
        )

        (if (i32.or
              (i32.or (call $match_cmd (i32.const 190000) (local.get $trim_len) (i32.const 135960))
                      (call $match_cmd (i32.const 190000) (local.get $trim_len) (i32.const 136000)))
              (i32.or (call $match_cmd (i32.const 190000) (local.get $trim_len) (i32.const 136020))
                      (call $match_cmd (i32.const 190000) (local.get $trim_len) (i32.const 136040))))
          (then
            (drop (call $host_call (i32.const 134520) (call $zlen (i32.const 134520)) (i32.const 360000) (i32.const 1024)))
            (return (call $return_zstr (i32.const 133500)))
          )
        )

        ;; Check config / set_key / key command prefix
        (local.set $tok_start (i32.const -1))
        (if (call $match_cmd (i32.const 190000) (local.get $trim_len) (i32.const 135920))
          (then (local.set $tok_start (i32.add (local.get $trim_start) (i32.const 6))))
        )
        (if (i32.and (i32.lt_s (local.get $tok_start) (i32.const 0))
                     (call $match_cmd (i32.const 190000) (local.get $trim_len) (i32.const 136060)))
          (then (local.set $tok_start (i32.add (local.get $trim_start) (i32.const 7))))
        )
        (if (i32.and (i32.lt_s (local.get $tok_start) (i32.const 0))
                     (call $match_cmd (i32.const 190000) (local.get $trim_len) (i32.const 136080)))
          (then (local.set $tok_start (i32.add (local.get $trim_start) (i32.const 3))))
        )
        (if (i32.ge_s (local.get $tok_start) (i32.const 0))
          (then
            (local.set $tok_len (i32.sub (i32.add (local.get $trim_start) (local.get $trim_len)) (local.get $tok_start)))
            (loop $skip_ws_k
              (if (i32.and (i32.gt_s (local.get $tok_len) (i32.const 0)) (call $is_ws (i32.load8_u (local.get $tok_start))))
                (then
                  (local.set $tok_start (i32.add (local.get $tok_start) (i32.const 1)))
                  (local.set $tok_len (i32.sub (local.get $tok_len) (i32.const 1)))
                  (br $skip_ws_k)
                )
              )
            )
            (return (call $save_api_key (local.get $tok_start) (local.get $tok_len)))
          )
        )

        ;; Single-token sk_... API key shortcut (only if NO whitespace in trimmed input)
        (if (call $starts_with (local.get $trim_start) (local.get $trim_len) (i32.const 136100))
          (then
            (local.set $has_space (i32.const 0))
            (local.set $i (i32.const 0))
            (loop $chk_sp
              (if (i32.lt_u (local.get $i) (local.get $trim_len))
                (then
                  (if (call $is_ws (i32.load8_u (i32.add (local.get $trim_start) (local.get $i))))
                    (then (local.set $has_space (i32.const 1)))
                    (else
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $chk_sp)
                    )
                  )
                )
              )
            )
            (if (i32.eqz (local.get $has_space))
              (then (return (call $save_api_key (local.get $trim_start) (local.get $trim_len))))
            )
          )
        )

        ;; Plain speech text
        (if (i32.gt_u (local.get $trim_len) (i32.const 8000))
          (then (local.set $trim_len (i32.const 8000)))
        )
        (drop (call $copy_mem (local.get $trim_start) (i32.const 162000) (local.get $trim_len)))
        (global.set $text_len (local.get $trim_len))
        (call $resolve_voice (i32.const 0) (i32.const 0))
        (local.set $p (call $copy_zstr (i32.const 135500) (i32.const 160800)))
        (global.set $model_len (i32.sub (local.get $p) (i32.const 160800)))
        (call $build_filename (i32.const 0))
      )
    )

    ;; ── Execute Speech Synthesis ────────────────────────────────────────
    (if (i32.le_s (call $load_api_key) (i32.const 0))
      (then (return (call $return_zstr (i32.const 133100))))
    )

    (call $escape_body_text)

    ;; Build HTTP request at 260000
    (local.set $p (call $copy_zstr (i32.const 134620) (i32.const 260000)))
    (local.set $p (call $copy_mem (i32.const 160600) (local.get $p) (global.get $voice_id_len)))
    (local.set $p (call $copy_zstr (i32.const 134760) (local.get $p)))
    (local.set $p (call $copy_mem (i32.const 160100) (local.get $p) (global.get $key_len)))
    (local.set $p (call $copy_zstr (i32.const 134820) (local.get $p)))
    (local.set $p (call $copy_mem (i32.const 172000) (local.get $p) (global.get $esc_len)))
    (local.set $p (call $copy_zstr (i32.const 134940) (local.get $p)))
    (local.set $p (call $copy_mem (i32.const 160800) (local.get $p) (global.get $model_len)))
    (local.set $p (call $copy_zstr (i32.const 134980) (local.get $p)))
    (local.set $req_len (i32.sub (local.get $p) (i32.const 260000)))

    (global.set $phase (i32.const 1))
    (drop (call $host_call (i32.const 260000) (local.get $req_len) (i32.const 1000000) (i32.const 4000000)))
    (i32.const 0)
  )

  ;; ── Resume Handler ───────────────────────────────────────────────────

  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $b64_start i32)
    (local $b64_len i32)
    (local $body_idx i32)
    (local $p i32)
    (local $req_len i32)
    (local $err_len i32)
    (local $h_len i32)
    (local $i i32)

    ;; Phase 1: HTTP Response received
    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        (if (i32.eqz (call $is_http_200 (local.get $res_ptr) (local.get $res_len)))
          (then
            ;; Unescape "body" if present so inner JSON error fields are readable
            (local.set $err_len (i32.const -1))
            (local.set $body_idx (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const 135760) (i32.const 162000) (i32.const 4096)))
            (if (i32.gt_s (local.get $body_idx) (i32.const 0))
              (then
                (local.set $err_len (call $extract_json_str (i32.const 162000) (local.get $body_idx) (i32.const 135800) (i32.const 161200) (i32.const 400)))
                (if (i32.le_s (local.get $err_len) (i32.const 0))
                  (then (local.set $err_len (call $extract_json_str (i32.const 162000) (local.get $body_idx) (i32.const 135820) (i32.const 161200) (i32.const 400))))
                )
              )
            )
            (if (i32.le_s (local.get $err_len) (i32.const 0))
              (then
                (local.set $err_len (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const 135800) (i32.const 161200) (i32.const 400)))
                (if (i32.le_s (local.get $err_len) (i32.const 0))
                  (then (local.set $err_len (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const 135820) (i32.const 161200) (i32.const 400))))
                )
              )
            )
            (local.set $p (call $copy_zstr (i32.const 133900) (i32.const 65536)))
            (if (i32.gt_s (local.get $err_len) (i32.const 0))
              (then (local.set $p (call $copy_mem (i32.const 161200) (local.get $p) (local.get $err_len))))
              (else (local.set $p (call $copy_zstr (i32.const 134200) (local.get $p))))
            )
            (local.set $p (call $copy_zstr (i32.const 134000) (local.get $p)))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
        )

        ;; Find "body" value (base64 MP3) directly in $res_ptr without copying 4MB
        (local.set $body_idx (call $find_substring (local.get $res_ptr) (local.get $res_len) (i32.const 135760) (i32.const 4)))
        (if (i32.lt_s (local.get $body_idx) (i32.const 0))
          (then
            (local.set $p (call $copy_zstr (i32.const 133900) (i32.const 65536)))
            (local.set $p (call $copy_zstr (i32.const 134200) (local.get $p)))
            (local.set $p (call $copy_zstr (i32.const 134000) (local.get $p)))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
        )
        ;; Advance past "body" and whitespace/:/quote
        (local.set $i (i32.add (local.get $body_idx) (i32.const 4)))
        (loop $find_b64_start
          (if (i32.lt_u (local.get $i) (local.get $res_len))
            (then
              (if (i32.ne (i32.load8_u (i32.add (local.get $res_ptr) (local.get $i))) (i32.const 58)) ;; ':'
                (then
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $find_b64_start)
                )
              )
            )
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (loop $skip_to_q
          (if (i32.lt_u (local.get $i) (local.get $res_len))
            (then
              (if (i32.ne (i32.load8_u (i32.add (local.get $res_ptr) (local.get $i))) (i32.const 34))
                (then
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $skip_to_q)
                )
              )
            )
          )
        )
        (local.set $b64_start (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 1))))
        (local.set $b64_len (i32.const 0))
        (loop $find_b64_end
          (if (i32.lt_u (i32.add (local.get $b64_start) (local.get $b64_len)) (i32.add (local.get $res_ptr) (local.get $res_len)))
            (then
              (if (i32.ne (i32.load8_u (i32.add (local.get $b64_start) (local.get $b64_len))) (i32.const 34))
                (then
                  (local.set $b64_len (i32.add (local.get $b64_len) (i32.const 1)))
                  (br $find_b64_end)
                )
              )
            )
          )
        )

        ;; Build files.write request at 5000000
        (local.set $p (call $copy_zstr (i32.const 135060) (i32.const 5000000)))
        (local.set $p (call $copy_mem (i32.const 161000) (local.get $p) (global.get $filename_len)))
        (local.set $p (call $copy_zstr (i32.const 135140) (local.get $p)))
        (local.set $p (call $copy_mem (local.get $b64_start) (local.get $p) (local.get $b64_len)))
        (local.set $p (call $copy_zstr (i32.const 135200) (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 5000000)))

        (global.set $phase (i32.const 2))
        (drop (call $host_call (i32.const 5000000) (local.get $req_len) (i32.const 9000000) (i32.const 65536)))
        (return (i32.const 0))
      )
    )

    ;; Phase 2: files.write response received
    (if (i32.eq (global.get $phase) (i32.const 2))
      (then
        (local.set $h_len (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const 135780) (i32.const 161200) (i32.const 128)))
        (if (i32.gt_s (local.get $h_len) (i32.const 0))
          (then
            (local.set $p (call $copy_zstr (i32.const 135220) (i32.const 65536)))
            (local.set $p (call $copy_mem (i32.const 160700) (local.get $p) (global.get $voice_label_len)))
            (local.set $p (call $copy_zstr (i32.const 135300) (local.get $p)))
            (local.set $p (call $copy_mem (i32.const 161000) (local.get $p) (global.get $filename_len)))
            (local.set $p (call $copy_zstr (i32.const 135350) (local.get $p)))
            (local.set $p (call $copy_mem (i32.const 161200) (local.get $p) (local.get $h_len)))
            (local.set $p (call $copy_zstr (i32.const 135420) (local.get $p)))
            (local.set $p (call $copy_mem (i32.const 161000) (local.get $p) (global.get $filename_len)))
            (local.set $p (call $copy_zstr (i32.const 135460) (local.get $p)))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
        )
        (return (call $return_zstr (i32.const 133700)))
      )
    )

    (local.set $p (call $copy_zstr (i32.const 133900) (i32.const 65536)))
    (local.set $p (call $copy_zstr (i32.const 134200) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const 134000) (local.get $p)))
    (i32.sub (local.get $p) (i32.const 65536))
  )
)
