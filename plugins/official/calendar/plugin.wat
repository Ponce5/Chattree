;; ==============================================================================
;; Chattree Official Device Calendar Plugin
;; Specification: Chattree WebAssembly Plugin Standard v1.0.0
;; Runtime: Isolated WASM sandbox with 4 memory pages (256 KB)
;; Host API: chattree.host_call(reqPtr, reqLen, resPtr, resMaxLen) -> i32
;;
;; Single Consolidated Command Architecture (/calendar):
;;   - Empty or "/calendar list": Queries device calendar and displays agenda.
;;   - Any arguments / natural request: Intelligently schedules the meeting/event.
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
  ;; Static Constants & Templates (Placed safely in linear memory at 16384+)
  ;; ---------------------------------------------------------------------------

  ;; Offset 16384: List Events Request (142 bytes)
  ;; {"api":"calendar","operation":"events","payload":{"calendarId":"primary","startDate":"2026-10-01T00:00:00Z","endDate":"2026-12-31T23:59:59Z"}}
  (data (i32.const 16384) "{\"api\":\"calendar\",\"operation\":\"events\",\"payload\":{\"calendarId\":\"primary\",\"startDate\":\"2026-10-01T00:00:00Z\",\"endDate\":\"2026-12-31T23:59:59Z\"}}")

  ;; Offset 16600: Create Request Prefix 1 (82 bytes)
  ;; {"api":"calendar","operation":"create","payload":{"calendarId":"primary","title":"
  (data (i32.const 16600) "{\"api\":\"calendar\",\"operation\":\"create\",\"payload\":{\"calendarId\":\"primary\",\"title\":\"")

  ;; Offset 16700: Create Infix 2 (15 bytes)
  ;; ","startDate":"
  (data (i32.const 16700) "\",\"startDate\":\"")

  ;; Offset 16730: Create Infix 3 (13 bytes)
  ;; ","endDate":"
  (data (i32.const 16730) "\",\"endDate\":\"")

  ;; Offset 16760: Create Infix 4 (17 bytes)
  ;; ","description":"
  (data (i32.const 16760) "\",\"description\":\"")

  ;; Offset 16790: Create Suffix (3 bytes)
  ;; "}}
  (data (i32.const 16790) "\"}}")

  ;; Offset 16810: Wrap Prefix for direct JSON payload (49 bytes)
  ;; {"api":"calendar","operation":"create","payload":
  (data (i32.const 16810) "{\"api\":\"calendar\",\"operation\":\"create\",\"payload\":")

  ;; Offset 16880: Default Title "Reunión" (8 bytes UTF-8)
  (data (i32.const 16880) "Reuni\C3\B3n")

  ;; Offset 16900: Default StartDate "2026-10-16T10:00:00Z" (20 bytes)
  (data (i32.const 16900) "2026-10-16T10:00:00Z")

  ;; Offset 16930: Default EndDate "2026-10-16T11:00:00Z" (20 bytes)
  (data (i32.const 16930) "2026-10-16T11:00:00Z")

  ;; Offset 16960: Default Description "Reunión agendada con Chattree AI" (33 bytes)
  (data (i32.const 16960) "Reuni\C3\B3n agendada con Chattree AI")

  ;; Offset 17010: ToolResult Create Success Response (84 bytes UTF-8)
  ;; {"type":"direct","displayText":"✅ Reunión agendada con éxito en el calendario."}
  (data (i32.const 17010) "{\"type\":\"direct\",\"displayText\":\"\E2\9C\85 Reuni\C3\B3n agendada con \C3\A9xito en el calendario.\"}")

  ;; Offset 17110: ToolResult Create Error Response (126 bytes UTF-8)
  ;; {"type":"error","errorMessage":"No se pudo crear la reunión en el calendario. Revisa los permisos de calendario en Ajustes."}
  (data (i32.const 17110) "{\"type\":\"error\",\"errorMessage\":\"No se pudo crear la reuni\C3\B3n en el calendario. Revisa los permisos de calendario en Ajustes.\"}")

  ;; Offset 17260: ToolResult List Agenda Active (117 bytes UTF-8)
  ;; {"type":"direct","displayText":"📅 Agenda de Eventos:\nTienes eventos programados sincronizados en tu calendario."}
  (data (i32.const 17260) "{\"type\":\"direct\",\"displayText\":\"\F0\9F\93\85 Agenda de Eventos:\\nTienes eventos programados sincronizados en tu calendario.\"}")

  ;; Offset 17400: ToolResult List Agenda Empty (102 bytes UTF-8)
  ;; {"type":"direct","displayText":"📅 Tu agenda está libre. No tienes eventos programados próximos."}
  (data (i32.const 17400) "{\"type\":\"direct\",\"displayText\":\"\F0\9F\93\85 Tu agenda est\C3\A1 libre. No tienes eventos programados pr\C3\B3ximos.\"}")

  ;; Offset 17520: ToolResult List Error Response (112 bytes UTF-8)
  ;; {"type":"error","errorMessage":"No se pudo consultar la agenda del calendario. Revisa los permisos en Ajustes."}
  (data (i32.const 17520) "{\"type\":\"error\",\"errorMessage\":\"No se pudo consultar la agenda del calendario. Revisa los permisos en Ajustes.\"}")

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

    ;; Trim trailing whitespace
    (loop $trim_trail
      (if (i32.gt_u (local.get $rem) (i32.const 0))
        (then
          (local.set $c (i32.load8_u (i32.add (local.get $src) (i32.sub (local.get $rem) (i32.const 1)))))
          (if (i32.or
                (i32.or (i32.eq (local.get $c) (i32.const 32)) (i32.eq (local.get $c) (i32.const 9)))
                (i32.or (i32.eq (local.get $c) (i32.const 10)) (i32.eq (local.get $c) (i32.const 13)))
              )
            (then
              (local.set $rem (i32.sub (local.get $rem) (i32.const 1)))
              (br $trim_trail)
            )
          )
        )
      )
    )

    ;; -------------------------------------------------------------------------
    ;; CASE A: Empty argument or explicit "list" -> List Agenda Events
    ;; -------------------------------------------------------------------------
    (if (i32.or
          (i32.eqz (local.get $rem))
          (i32.and
            (i32.eq (local.get $rem) (i32.const 4))
            (i32.and
              (i32.eq (i32.load8_u (local.get $src)) (i32.const 108)) ;; 'l'
              (i32.and
                (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 1))) (i32.const 105)) ;; 'i'
                (i32.and
                  (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 2))) (i32.const 115)) ;; 's'
                  (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 3))) (i32.const 116)) ;; 't'
                )
              )
            )
          )
        )
      (then
        ;; Store op_type = 2 (list events) at offset 0
        (i32.store (i32.const 0) (i32.const 2))

        ;; Copy eventsReq (142 bytes) from 16384 to 2048
        (call $memcpy (i32.const 2048) (i32.const 16384) (i32.const 142))

        ;; Dispatch call to Host API
        (local.set $call_res
          (call $host_call (i32.const 2048) (i32.const 142) (i32.const 4096) (i32.const 4096))
        )
        (if (i32.eq (local.get $call_res) (i32.const 0))
          (then (return (i32.const 0)))
        )

        ;; Synchronous check
        (if (i32.gt_s (local.get $call_res) (i32.const 11))
          (then
            (if (i32.eq (i32.load8_u (i32.const 4107)) (i32.const 116))
              (then
                (call $memcpy (i32.const 1024) (i32.const 17260) (i32.const 117))
                (return (i32.const 117))
              )
            )
          )
        )
        (call $memcpy (i32.const 1024) (i32.const 17520) (i32.const 112))
        (return (i32.const 112))
      )
    )

    ;; -------------------------------------------------------------------------
    ;; CASE B: Arguments provided -> Intelligently Schedule / Create Meeting
    ;; -------------------------------------------------------------------------
    ;; Store op_type = 1 (create meeting) at offset 0
    (i32.store (i32.const 0) (i32.const 1))

    ;; B.1: Direct JSON Input detection (starts with '{' = 123)
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
                          (call $memcpy (i32.const 2048) (local.get $src) (local.get $rem))
                          (local.set $req_len (local.get $rem))
                          (local.set $call_res
                            (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096))
                          )
                          (if (i32.eq (local.get $call_res) (i32.const 0))
                            (then (return (i32.const 0)))
                          )
                          (call $memcpy (i32.const 1024) (i32.const 17010) (i32.const 84))
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
        (call $memcpy (i32.const 2048) (i32.const 16810) (i32.const 49))
        (call $memcpy (i32.add (i32.const 2048) (i32.const 49)) (local.get $src) (local.get $rem))
        (i32.store8 (i32.add (i32.add (i32.const 2048) (i32.const 49)) (local.get $rem)) (i32.const 125)) ;; '}'
        (local.set $req_len (i32.add (i32.add (local.get $rem) (i32.const 49)) (i32.const 1)))

        (local.set $call_res
          (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096))
        )
        (if (i32.eq (local.get $call_res) (i32.const 0))
          (then (return (i32.const 0)))
        )
        (call $memcpy (i32.const 1024) (i32.const 17010) (i32.const 84))
        (return (i32.const 84))
      )
    )

    ;; B.2: Check and strip optional "add " prefix (ASCII: 97, 100, 100, 32)
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

    ;; B.3: Check and strip conversational "creame una reunion " prefix (19 chars)
    (if (i32.gt_u (local.get $rem) (i32.const 19))
      (then
        (if (i32.and
              (i32.eq (i32.load8_u (local.get $src)) (i32.const 99)) ;; 'c'
              (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 1))) (i32.const 114)) ;; 'r'
            )
          (then
            (if (i32.and
                  (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 6))) (i32.const 32))
                  (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 10))) (i32.const 32))
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

    ;; B.4: Parse pipe segments: <title> [| <startDate>] [| <endDate>] [| <description>]
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

    ;; B.5: Apply Defaults if segments are empty
    (if (i32.eqz (local.get $title_len))
      (then
        (local.set $title_src (i32.const 16880))
        (local.set $title_len (i32.const 8)) ;; "Reunión"
      )
    )

    (if (i32.eqz (local.get $start_len))
      (then
        (local.set $start_src (i32.const 16900))
        (local.set $start_len (i32.const 20)) ;; "2026-10-16T10:00:00Z"
      )
    )

    (if (i32.eqz (local.get $end_len))
      (then
        (local.set $end_src (i32.const 16930))
        (local.set $end_len (i32.const 20)) ;; "2026-10-16T11:00:00Z"
      )
    )

    (if (i32.eqz (local.get $desc_len))
      (then
        (local.set $desc_src (i32.const 16960))
        (local.set $desc_len (i32.const 33)) ;; "Reunión agendada con Chattree AI"
      )
    )

    ;; B.6: Construct Full Request JSON at Offset 2048
    (local.set $dest (i32.const 2048))
    (call $memcpy (local.get $dest) (i32.const 16600) (i32.const 82))
    (local.set $dest (i32.add (local.get $dest) (i32.const 82)))

    (call $copy_sanitized (local.get $dest) (local.get $title_src) (local.get $title_len))
    (local.set $dest (i32.add (local.get $dest) (local.get $title_len)))

    (call $memcpy (local.get $dest) (i32.const 16700) (i32.const 15))
    (local.set $dest (i32.add (local.get $dest) (i32.const 15)))

    (call $copy_sanitized (local.get $dest) (local.get $start_src) (local.get $start_len))
    (local.set $dest (i32.add (local.get $dest) (local.get $start_len)))

    (call $memcpy (local.get $dest) (i32.const 16730) (i32.const 13))
    (local.set $dest (i32.add (local.get $dest) (i32.const 13)))

    (call $copy_sanitized (local.get $dest) (local.get $end_src) (local.get $end_len))
    (local.set $dest (i32.add (local.get $dest) (local.get $end_len)))

    (call $memcpy (local.get $dest) (i32.const 16760) (i32.const 17))
    (local.set $dest (i32.add (local.get $dest) (i32.const 17)))

    (call $copy_sanitized (local.get $dest) (local.get $desc_src) (local.get $desc_len))
    (local.set $dest (i32.add (local.get $dest) (local.get $desc_len)))

    (call $memcpy (local.get $dest) (i32.const 16790) (i32.const 3))
    (local.set $dest (i32.add (local.get $dest) (i32.const 3)))

    (local.set $req_len (i32.sub (local.get $dest) (i32.const 2048)))

    ;; Dispatch call to Host API
    (local.set $call_res
      (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096))
    )

    (if (i32.eq (local.get $call_res) (i32.const 0))
      (then (return (i32.const 0)))
    )

    ;; Synchronous evaluation
    (if (i32.gt_s (local.get $call_res) (i32.const 11))
      (then
        (if (i32.eq (i32.load8_u (i32.const 4107)) (i32.const 116))
          (then
            (call $memcpy (i32.const 1024) (i32.const 17010) (i32.const 84))
            (return (i32.const 84))
          )
        )
      )
    )

    (call $memcpy (i32.const 1024) (i32.const 17110) (i32.const 126))
    (i32.const 126)
  )

  ;; ============================================================================
  ;; Exported Function: resume(res_ptr: i32, res_len: i32) -> i32
  ;; ============================================================================
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $op i32)
    (local $i i32)
    (local $found_title i32)

    ;; Load operation type: 1 = create meeting, 2 = list agenda
    (local.set $op (i32.load (i32.const 0)))

    ;; Check validity
    (if (i32.gt_s (local.get $res_len) (i32.const 11))
      (then
        ;; Offset res_ptr + 11 is 't' (116) in {"success":true...}
        (if (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.const 11))) (i32.const 116))
          (then
            ;; CASE 2: List Agenda Response
            (if (i32.eq (local.get $op) (i32.const 2))
              (then
                ;; Scan for "title" in response (ASCII: 116, 105, 116, 108, 101)
                (local.set $i (i32.const 0))
                (local.set $found_title (i32.const 0))
                (loop $find_title
                  (if (i32.lt_u (local.get $i) (i32.sub (local.get $res_len) (i32.const 6)))
                    (then
                      (if (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (local.get $i))) (i32.const 116)) ;; 't'
                        (then
                          (if (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 1)))) (i32.const 105)) ;; 'i'
                            (then
                              (if (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 2)))) (i32.const 116)) ;; 't'
                                (then
                                  (if (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 3)))) (i32.const 108)) ;; 'l'
                                    (then
                                      (if (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 4)))) (i32.const 101)) ;; 'e'
                                        (then
                                          (local.set $found_title (i32.const 1))
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
                      (if (i32.eqz (local.get $found_title))
                        (then
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $find_title)
                        )
                      )
                    )
                  )
                )

                (if (i32.eq (local.get $found_title) (i32.const 1))
                  (then
                    ;; Found events -> Output Agenda list
                    (call $memcpy (i32.const 1024) (i32.const 17260) (i32.const 117))
                    (return (i32.const 117))
                  )
                  (else
                    ;; Empty events list -> Output free agenda
                    (call $memcpy (i32.const 1024) (i32.const 17400) (i32.const 102))
                    (return (i32.const 102))
                  )
                )
              )
            )

            ;; CASE 1: Create Meeting Success Response
            (call $memcpy (i32.const 1024) (i32.const 17010) (i32.const 84))
            (return (i32.const 84))
          )
        )
      )
    )

    ;; Fallback Error: Check op_type
    (if (i32.eq (local.get $op) (i32.const 2))
      (then
        (call $memcpy (i32.const 1024) (i32.const 17520) (i32.const 112))
        (return (i32.const 112))
      )
    )

    (call $memcpy (i32.const 1024) (i32.const 17110) (i32.const 126))
    (i32.const 126)
  )
)
