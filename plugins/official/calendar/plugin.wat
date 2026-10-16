;; ==============================================================================
;; Chattree Official Device Calendar Plugin
;; Specification: Chattree WebAssembly Plugin Standard v1.0.0
;; Runtime: Isolated WASM sandbox with 4 memory pages (256 KB)
;; Host API: chattree.host_call(reqPtr, reqLen, resPtr, resMaxLen) -> i32
;; ==============================================================================

(module
  ;; ---------------------------------------------------------------------------
  ;; Host API Import
  ;; ---------------------------------------------------------------------------
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; ---------------------------------------------------------------------------
  ;; Linear Memory: 4 pages = 256 KB exported to host
  ;; ---------------------------------------------------------------------------
  (memory (export "memory") 4)

  ;; ---------------------------------------------------------------------------
  ;; Static Constants & Templates
  ;; ---------------------------------------------------------------------------

  ;; Offset 200: JSON Payload Prefix 1 (82 bytes)
  ;; {"api":"calendar","operation":"create","payload":{"calendarId":"primary","title":"
  (data (i32.const 200) "{\"api\":\"calendar\",\"operation\":\"create\",\"payload\":{\"calendarId\":\"primary\",\"title\":\"")

  ;; Offset 290: JSON Payload Infix 2 (15 bytes)
  ;; ","startDate":"
  (data (i32.const 290) "\",\"startDate\":\"")

  ;; Offset 310: JSON Payload Infix 3 (13 bytes)
  ;; ","endDate":"
  (data (i32.const 310) "\",\"endDate\":\"")

  ;; Offset 330: JSON Payload Infix 4 (17 bytes)
  ;; ","description":"
  (data (i32.const 330) "\",\"description\":\"")

  ;; Offset 350: JSON Payload Suffix (3 bytes)
  ;; "}}
  (data (i32.const 350) "\"}}")

  ;; Offset 360: JSON Wrap Prefix for JSON input without api envelope (49 bytes)
  ;; {"api":"calendar","operation":"create","payload":
  (data (i32.const 360) "{\"api\":\"calendar\",\"operation\":\"create\",\"payload\":")

  ;; Offset 410: Default Title "Reunión" (8 bytes UTF-8)
  (data (i32.const 410) "Reuni\C3\B3n")

  ;; Offset 420: Default StartDate "2026-10-16T10:00:00Z" (20 bytes)
  (data (i32.const 420) "2026-10-16T10:00:00Z")

  ;; Offset 445: Default EndDate "2026-10-16T11:00:00Z" (20 bytes)
  (data (i32.const 445) "2026-10-16T11:00:00Z")

  ;; Offset 470: Default Description "Reunión agendada con Chattree AI" (33 bytes)
  (data (i32.const 470) "Reuni\C3\B3n agendada con Chattree AI")

  ;; Offset 510: ToolResult Direct Success Response (84 bytes UTF-8)
  ;; {"type":"direct","displayText":"✅ Reunión agendada con éxito en el calendario."}
  (data (i32.const 510) "{\"type\":\"direct\",\"displayText\":\"\E2\9C\85 Reuni\C3\B3n agendada con \C3\A9xito en el calendario.\"}")

  ;; Offset 600: ToolResult Error Response (126 bytes UTF-8)
  ;; {"type":"error","errorMessage":"No se pudo crear la reunión en el calendario. Revisa los permisos de calendario en Ajustes."}
  (data (i32.const 600) "{\"type\":\"error\",\"errorMessage\":\"No se pudo crear la reuni\C3\B3n en el calendario. Revisa los permisos de calendario en Ajustes.\"}")

  ;; ---------------------------------------------------------------------------
  ;; Helper: Byte-by-byte memory copy
  ;; ---------------------------------------------------------------------------
  (func $memcpy (param $dst i32) (param $src i32) (param $len i32)
    (local $i i32)
    (loop $loop
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (i32.store8
            (i32.add (local.get $dst) (local.get $i))
            (i32.load8_u (i32.add (local.get $src) (local.get $i)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $loop)
        )
      )
    )
  )

  ;; ---------------------------------------------------------------------------
  ;; Helper: Copy string sanitizing JSON quotes and backslashes
  ;; ---------------------------------------------------------------------------
  (func $copy_sanitized (param $dst i32) (param $src i32) (param $len i32)
    (local $i i32)
    (local $char i32)
    (loop $loop
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (local.set $char (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          ;; Replace '"' (34) or '\' (92) with space (32)
          (if (i32.eq (local.get $char) (i32.const 34))
            (then (local.set $char (i32.const 32)))
          )
          (if (i32.eq (local.get $char) (i32.const 92))
            (then (local.set $char (i32.const 32)))
          )
          (i32.store8 (i32.add (local.get $dst) (local.get $i)) (local.get $char))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $loop)
        )
      )
    )
  )

  ;; ============================================================================
  ;; Exported Function: calendar_entry(in_ptr: i32, in_len: i32) -> i32
  ;; ============================================================================
  (func (export "calendar_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $call_res i32)
    (local $src i32)
    (local $rem i32)
    (local $c i32)
    (local $i i32)
    (local $title_src i32)
    (local $title_len i32)
    (local $start_src i32)
    (local $start_len i32)
    (local $end_src i32)
    (local $end_len i32)
    (local $desc_src i32)
    (local $desc_len i32)
    (local $dest i32)
    (local $req_len i32)

    (local.set $src (local.get $in_ptr))
    (local.set $rem (local.get $in_len))

    ;; 1. Skip leading whitespace (spaces: 32, tabs: 9, newlines: 10, 13)
    (loop $trim_lead
      (if (i32.gt_u (local.get $rem) (i32.const 0))
        (then
          (local.set $c (i32.load8_u (local.get $src)))
          (if (i32.or
                (i32.or (i32.eq (local.get $c) (i32.const 32)) (i32.eq (local.get $c) (i32.const 9)))
                (i32.or (i32.eq (local.get $c) (i32.const 10)) (i32.eq (local.get $c) (i32.const 13)))
              )
            (then
              (local.set $src (i32.add (local.get $src) (i32.const 1)))
              (local.set $rem (i32.sub (local.get $rem) (i32.const 1)))
              (br $trim_lead)
            )
          )
        )
      )
    )

    ;; 2. Direct JSON Input detection: starts with '{' (123)
    (if (i32.and (i32.gt_u (local.get $rem) (i32.const 1)) (i32.eq (i32.load8_u (local.get $src)) (i32.const 123)))
      (then
        ;; Check if input already includes "api" envelope
        (local.set $i (i32.const 0))
        (loop $check_api
          (if (i32.and (i32.lt_u (local.get $i) (local.get $rem)) (i32.lt_u (local.get $i) (i32.const 20)))
            (then
              (if (i32.eq (i32.load8_u (i32.add (local.get $src) (local.get $i))) (i32.const 97)) ;; 'a'
                (then
                  (if (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1)))) (i32.const 112)) ;; 'p'
                    (then
                      (if (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 2)))) (i32.const 105)) ;; 'i'
                        (then
                          ;; Already full Host API payload, copy directly to 2048
                          (call $memcpy (i32.const 2048) (local.get $src) (local.get $rem))
                          (local.set $req_len (local.get $rem))
                          ;; Dispatch call
                          (local.set $call_res
                            (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096))
                          )
                          (if (i32.eq (local.get $call_res) (i32.const 0))
                            (then (return (i32.const 0)))
                          )
                          ;; Sync return
                          (call $memcpy (i32.const 1024) (i32.const 510) (i32.const 84))
                          (return (i32.const 84))
                        )
                      )
                    )
                  )
                )
              )
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $check_api)
            )
          )
        )

        ;; JSON payload without "api" wrapper: wrap with {"api":"calendar","operation":"create","payload":<input>}
        (call $memcpy (i32.const 2048) (i32.const 360) (i32.const 49))
        (call $memcpy (i32.add (i32.const 2048) (i32.const 49)) (local.get $src) (local.get $rem))
        (i32.store8 (i32.add (i32.add (i32.const 2048) (i32.const 49)) (local.get $rem)) (i32.const 125)) ;; '}'
        (local.set $req_len (i32.add (i32.add (local.get $rem) (i32.const 49)) (i32.const 1)))

        (local.set $call_res
          (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096))
        )
        (if (i32.eq (local.get $call_res) (i32.const 0))
          (then (return (i32.const 0)))
        )
        (call $memcpy (i32.const 1024) (i32.const 510) (i32.const 84))
        (return (i32.const 84))
      )
    )

    ;; 3. Check and strip optional "add " prefix (ASCII: 97, 100, 100, 32)
    (if (i32.ge_u (local.get $rem) (i32.const 4))
      (then
        (if (i32.and
              (i32.eq (i32.load8_u (local.get $src)) (i32.const 97))
              (i32.and
                (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 1))) (i32.const 100))
                (i32.and
                  (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 2))) (i32.const 100))
                  (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 3))) (i32.const 32))
                )
              )
            )
          (then
            (local.set $src (i32.add (local.get $src) (i32.const 4)))
            (local.set $rem (i32.sub (local.get $rem) (i32.const 4)))
          )
        )
      )
    )

    ;; 4. Check and strip "creame una reunion " prefix if present (19 chars: "creame una reunion ")
    (if (i32.gt_u (local.get $rem) (i32.const 19))
      (then
        (if (i32.and
              (i32.eq (i32.load8_u (local.get $src)) (i32.const 99)) ;; 'c'
              (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 1))) (i32.const 114)) ;; 'r'
            )
          (then
            (if (i32.and
                  (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 6))) (i32.const 32)) ;; after "creame"
                  (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 10))) (i32.const 32)) ;; after "una"
                )
              (then
                (local.set $src (i32.add (local.get $src) (i32.const 19)))
                (local.set $rem (i32.sub (local.get $rem) (i32.const 19)))
              )
            )
          )
        )
      )
    )

    ;; Re-trim spaces
    (loop $re_trim
      (if (i32.gt_u (local.get $rem) (i32.const 0))
        (then
          (if (i32.eq (i32.load8_u (local.get $src)) (i32.const 32))
            (then
              (local.set $src (i32.add (local.get $src) (i32.const 1)))
              (local.set $rem (i32.sub (local.get $rem) (i32.const 1)))
              (br $re_trim)
            )
          )
        )
      )
    )

    ;; 5. Parse pipe segments: <title> [| <startDate>] [| <endDate>] [| <description>]
    ;; Scan for Segment 1: Title (up to '|' or end)
    (local.set $title_src (local.get $src))
    (local.set $i (i32.const 0))
    (loop $scan_title
      (if (i32.lt_u (local.get $i) (local.get $rem))
        (then
          (local.set $c (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.eq (local.get $c) (i32.const 124)) ;; '|'
            (then (nop))
            (else
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $scan_title)
            )
          )
        )
      )
    )

    ;; Trim trailing spaces from title
    (local.set $title_len (local.get $i))
    (loop $trim_t_trail
      (if (i32.gt_u (local.get $title_len) (i32.const 0))
        (then
          (if (i32.eq (i32.load8_u (i32.add (local.get $title_src) (i32.sub (local.get $title_len) (i32.const 1)))) (i32.const 32))
            (then
              (local.set $title_len (i32.sub (local.get $title_len) (i32.const 1)))
              (br $trim_t_trail)
            )
          )
        )
      )
    )

    ;; Advance past '|' if present
    (if (i32.lt_u (local.get $i) (local.get $rem))
      (then
        ;; Point src past '|'
        (local.set $src (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1))))
        (local.set $rem (i32.sub (local.get $rem) (i32.add (local.get $i) (i32.const 1))))

        ;; Trim leading spaces from next segment
        (loop $trim_s2
          (if (i32.gt_u (local.get $rem) (i32.const 0))
            (then
              (if (i32.eq (i32.load8_u (local.get $src)) (i32.const 32))
                (then
                  (local.set $src (i32.add (local.get $src) (i32.const 1)))
                  (local.set $rem (i32.sub (local.get $rem) (i32.const 1)))
                  (br $trim_s2)
                )
              )
            )
          )
        )

        ;; Scan Segment 2: startDate
        (local.set $start_src (local.get $src))
        (local.set $i (i32.const 0))
        (loop $scan_start
          (if (i32.lt_u (local.get $i) (local.get $rem))
            (then
              (local.set $c (i32.load8_u (i32.add (local.get $src) (local.get $i))))
              (if (i32.eq (local.get $c) (i32.const 124)) ;; '|'
                (then (nop))
                (else
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $scan_start)
                )
              )
            )
          )
        )

        (local.set $start_len (local.get $i))
        ;; Trim trailing spaces from startDate
        (loop $trim_st_trail
          (if (i32.gt_u (local.get $start_len) (i32.const 0))
            (then
              (if (i32.eq (i32.load8_u (i32.add (local.get $start_src) (i32.sub (local.get $start_len) (i32.const 1)))) (i32.const 32))
                (then
                  (local.set $start_len (i32.sub (local.get $start_len) (i32.const 1)))
                  (br $trim_st_trail)
                )
              )
            )
          )
        )

        ;; Advance past second '|' if present
        (if (i32.lt_u (local.get $i) (local.get $rem))
          (then
            (local.set $src (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1))))
            (local.set $rem (i32.sub (local.get $rem) (i32.add (local.get $i) (i32.const 1))))

            (loop $trim_s3
              (if (i32.gt_u (local.get $rem) (i32.const 0))
                (then
                  (if (i32.eq (i32.load8_u (local.get $src)) (i32.const 32))
                    (then
                      (local.set $src (i32.add (local.get $src) (i32.const 1)))
                      (local.set $rem (i32.sub (local.get $rem) (i32.const 1)))
                      (br $trim_s3)
                    )
                  )
                )
              )
            )

            ;; Scan Segment 3: endDate
            (local.set $end_src (local.get $src))
            (local.set $i (i32.const 0))
            (loop $scan_end
              (if (i32.lt_u (local.get $i) (local.get $rem))
                (then
                  (local.set $c (i32.load8_u (i32.add (local.get $src) (local.get $i))))
                  (if (i32.eq (local.get $c) (i32.const 124)) ;; '|'
                    (then (nop))
                    (else
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $scan_end)
                    )
                  )
                )
              )
            )

            (local.set $end_len (local.get $i))
            (loop $trim_et_trail
              (if (i32.gt_u (local.get $end_len) (i32.const 0))
                (then
                  (if (i32.eq (i32.load8_u (i32.add (local.get $end_src) (i32.sub (local.get $end_len) (i32.const 1)))) (i32.const 32))
                    (then
                      (local.set $end_len (i32.sub (local.get $end_len) (i32.const 1)))
                      (br $trim_et_trail)
                    )
                  )
                )
              )
            )

            ;; Advance past third '|' if present (description)
            (if (i32.lt_u (local.get $i) (local.get $rem))
              (then
                (local.set $desc_src (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1))))
                (local.set $desc_len (i32.sub (local.get $rem) (i32.add (local.get $i) (i32.const 1))))

                (loop $trim_s4
                  (if (i32.gt_u (local.get $desc_len) (i32.const 0))
                    (then
                      (if (i32.eq (i32.load8_u (local.get $desc_src)) (i32.const 32))
                        (then
                          (local.set $desc_src (i32.add (local.get $desc_src) (i32.const 1)))
                          (local.set $desc_len (i32.sub (local.get $desc_len) (i32.const 1)))
                          (br $trim_s4)
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )

    ;; 6. Apply Defaults if segments are empty
    ;; Title default
    (if (i32.eqz (local.get $title_len))
      (then
        (local.set $title_src (i32.const 410))
        (local.set $title_len (i32.const 8)) ;; "Reunión"
      )
    )

    ;; StartDate default
    (if (i32.eqz (local.get $start_len))
      (then
        (local.set $start_src (i32.const 420))
        (local.set $start_len (i32.const 20)) ;; "2026-10-16T10:00:00Z"
      )
    )

    ;; EndDate default (if not provided, default to +1h default)
    (if (i32.eqz (local.get $end_len))
      (then
        (local.set $end_src (i32.const 445))
        (local.set $end_len (i32.const 20)) ;; "2026-10-16T11:00:00Z"
      )
    )

    ;; Description default
    (if (i32.eqz (local.get $desc_len))
      (then
        (local.set $desc_src (i32.const 470))
        (local.set $desc_len (i32.const 33)) ;; "Reunión agendada con Chattree AI"
      )
    )

    ;; 7. Construct Full Request JSON at Offset 2048
    ;; Step A: Copy Prefix 1 (82 bytes)
    (local.set $dest (i32.const 2048))
    (call $memcpy (local.get $dest) (i32.const 200) (i32.const 82))
    (local.set $dest (i32.add (local.get $dest) (i32.const 82)))

    ;; Step B: Copy Title
    (call $copy_sanitized (local.get $dest) (local.get $title_src) (local.get $title_len))
    (local.set $dest (i32.add (local.get $dest) (local.get $title_len)))

    ;; Step C: Copy Infix 2 (startDate) (15 bytes)
    (call $memcpy (local.get $dest) (i32.const 290) (i32.const 15))
    (local.set $dest (i32.add (local.get $dest) (i32.const 15)))

    ;; Step D: Copy StartDate
    (call $copy_sanitized (local.get $dest) (local.get $start_src) (local.get $start_len))
    (local.set $dest (i32.add (local.get $dest) (local.get $start_len)))

    ;; Step E: Copy Infix 3 (endDate) (13 bytes)
    (call $memcpy (local.get $dest) (i32.const 310) (i32.const 13))
    (local.set $dest (i32.add (local.get $dest) (i32.const 13)))

    ;; Step F: Copy EndDate
    (call $copy_sanitized (local.get $dest) (local.get $end_src) (local.get $end_len))
    (local.set $dest (i32.add (local.get $dest) (local.get $end_len)))

    ;; Step G: Copy Infix 4 (description) (17 bytes)
    (call $memcpy (local.get $dest) (i32.const 330) (i32.const 17))
    (local.set $dest (i32.add (local.get $dest) (i32.const 17)))

    ;; Step H: Copy Description
    (call $copy_sanitized (local.get $dest) (local.get $desc_src) (local.get $desc_len))
    (local.set $dest (i32.add (local.get $dest) (local.get $desc_len)))

    ;; Step I: Copy Suffix (3 bytes)
    (call $memcpy (local.get $dest) (i32.const 350) (i32.const 3))
    (local.set $dest (i32.add (local.get $dest) (i32.const 3)))

    (local.set $req_len (i32.sub (local.get $dest) (i32.const 2048)))

    ;; 8. Dispatch call to Chattree Host API:
    ;;    host_call(reqPtr=2048, reqLen, resPtr=4096, resMaxLen=4096)
    (local.set $call_res
      (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096))
    )

    ;; If async pending (0), runtime will invoke resume()
    (if (i32.eq (local.get $call_res) (i32.const 0))
      (then (return (i32.const 0)))
    )

    ;; Synchronous evaluation (> 0)
    (if (i32.gt_s (local.get $call_res) (i32.const 11))
      (then
        ;; Check if success:true ('t' = 116)
        (if (i32.eq (i32.load8_u (i32.const 4107)) (i32.const 116))
          (then
            (call $memcpy (i32.const 1024) (i32.const 510) (i32.const 84))
            (return (i32.const 84))
          )
        )
      )
    )

    ;; Error fallback
    (call $memcpy (i32.const 1024) (i32.const 600) (i32.const 126))
    (i32.const 126)
  )

  ;; ============================================================================
  ;; Exported Function: resume(res_ptr: i32, res_len: i32) -> i32
  ;; Invoked by Chattree runtime once native calendar operation finishes
  ;; ============================================================================
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (if (i32.gt_s (local.get $res_len) (i32.const 11))
      (then
        ;; Offset res_ptr + 11 is 't' (116) in {"success":true...}
        (if (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.const 11))) (i32.const 116))
          (then
            (call $memcpy (i32.const 1024) (i32.const 510) (i32.const 84))
            (return (i32.const 84))
          )
        )
      )
    )

    ;; Fallback error output
    (call $memcpy (i32.const 1024) (i32.const 600) (i32.const 126))
    (i32.const 126)
  )
)
