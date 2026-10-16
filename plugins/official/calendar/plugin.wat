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

  ;; Offset 17110: ToolResult Create Permission Error Response (126 bytes UTF-8)
  ;; {"type":"error","errorMessage":"No se pudo crear la reunión en el calendario. Revisa los permisos de calendario en Ajustes."}
  (data (i32.const 17110) "{\"type\":\"error\",\"errorMessage\":\"No se pudo crear la reuni\C3\B3n en el calendario. Revisa los permisos de calendario en Ajustes.\"}")

  ;; Offset 17260: ToolResult List Agenda Active (117 bytes UTF-8)
  ;; {"type":"direct","displayText":"📅 Agenda de Eventos:\nTienes eventos programados sincronizados en tu calendario."}
  (data (i32.const 17260) "{\"type\":\"direct\",\"displayText\":\"\F0\9F\93\85 Agenda de Eventos:\\nTienes eventos programados sincronizados en tu calendario.\"}")

  ;; Offset 17400: ToolResult List Agenda Empty (102 bytes UTF-8)
  ;; {"type":"direct","displayText":"📅 Tu agenda está libre. No tienes eventos programados próximos."}
  (data (i32.const 17400) "{\"type\":\"direct\",\"displayText\":\"\F0\9F\93\85 Tu agenda est\C3\A1 libre. No tienes eventos programados pr\C3\B3ximos.\"}")

  ;; Offset 17520: ToolResult List Permission Error Response (112 bytes UTF-8)
  ;; {"type":"error","errorMessage":"No se pudo consultar la agenda del calendario. Revisa los permisos en Ajustes."}
  (data (i32.const 17520) "{\"type\":\"error\",\"errorMessage\":\"No se pudo consultar la agenda del calendario. Revisa los permisos en Ajustes.\"}")

  ;; Keyword Needles for robust JSON token search
  ;; Offset 17700: "true" (4 bytes)
  (data (i32.const 17700) "true")

  ;; Offset 17710: "false" (5 bytes)
  (data (i32.const 17710) "false")

  ;; Offset 17720: "eventId" (7 bytes)
  (data (i32.const 17720) "eventId")

  ;; Offset 17730: "events" (6 bytes)
  (data (i32.const 17730) "events")

  ;; Offset 17740: "title" (5 bytes)
  (data (i32.const 17740) "title")

  ;; Offset 17760: "denied" (6 bytes)
  (data (i32.const 17760) "denied")

  ;; Offset 17770: "Permiso" (7 bytes)
  (data (i32.const 17770) "Permiso")

  ;; Offset 17780: "created" (7 bytes)
  (data (i32.const 17780) "created")

  ;; Offset 17820: ToolResult Generic Create Error Response (110 bytes UTF-8)
  ;; {"type":"error","errorMessage":"No se pudo agendar la reunión en el calendario. Por favor intenta de nuevo."}
  (data (i32.const 17820) "{\"type\":\"error\",\"errorMessage\":\"No se pudo agendar la reuni\C3\B3n en el calendario. Por favor intenta de nuevo.\"}")

  ;; Offset 17950: ToolResult Generic List Error Response (110 bytes UTF-8)
  ;; {"type":"error","errorMessage":"No se pudo consultar los eventos del calendario. Por favor intenta de nuevo."}
  (data (i32.const 17950) "{\"type\":\"error\",\"errorMessage\":\"No se pudo consultar los eventos del calendario. Por favor intenta de nuevo.\"}")

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
  ;; Helper: Copy string sanitizing JSON quotes, backslashes, and control chars (< 32)
  ;; ---------------------------------------------------------------------------
  (func $copy_sanitized (param $dst i32) (param $src i32) (param $len i32)
    (local $i i32)
    (local $char i32)
    (loop $loop
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (local.set $char (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          ;; Replace '"' (34) or '\' (92) with space (32)
          (if (i32.or (i32.eq (local.get $char) (i32.const 34)) (i32.eq (local.get $char) (i32.const 92)))
            (then (local.set $char (i32.const 32)))
          )
          ;; Replace any control character < 32 (like newline, CR, tab, null) with space (32)
          (if (i32.lt_u (local.get $char) (i32.const 32))
            (then (local.set $char (i32.const 32)))
          )
          (i32.store8 (i32.add (local.get $dst) (local.get $i)) (local.get $char))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $loop)
        )
      )
    )
  )

  ;; ---------------------------------------------------------------------------
  ;; Helper: Substring search (returns byte offset in haystack or -1 if not found)
  ;; ---------------------------------------------------------------------------
  (func $str_find (param $h_ptr i32) (param $h_len i32) (param $n_ptr i32) (param $n_len i32) (result i32)
    (local $i i32)
    (local $j i32)
    (local $match i32)

    (if (i32.gt_u (local.get $n_len) (local.get $h_len))
      (then (return (i32.const -1)))
    )

    (local.set $i (i32.const 0))
    (loop $outer
      (if (i32.le_u (local.get $i) (i32.sub (local.get $h_len) (local.get $n_len)))
        (then
          (local.set $match (i32.const 1))
          (local.set $j (i32.const 0))
          (loop $inner
            (if (i32.lt_u (local.get $j) (local.get $n_len))
              (then
                (if (i32.ne
                      (i32.load8_u (i32.add (local.get $h_ptr) (i32.add (local.get $i) (local.get $j))))
                      (i32.load8_u (i32.add (local.get $n_ptr) (local.get $j)))
                    )
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
          (if (i32.eq (local.get $match) (i32.const 1))
            (then (return (local.get $i)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $outer)
        )
      )
    )
    (i32.const -1)
  )

  ;; ---------------------------------------------------------------------------
  ;; Unified Response Processor
  ;; Handles Host API responses independently of spaces or key order.
  ;; ---------------------------------------------------------------------------
  (func $process_response (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $op i32)
    (local $has_true i32)
    (local $has_false i32)
    (local $has_eventid i32)
    (local $has_created i32)
    (local $has_events i32)
    (local $has_title i32)
    (local $has_permiso i32)
    (local $has_denied i32)
    (local $is_success i32)
    (local $is_list i32)

    ;; Load stored operation type from address 8192: 1 = create, 2 = list
    (local.set $op (i32.load (i32.const 8192)))

    ;; Guard against empty / invalid response length
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then
        (if (i32.eq (local.get $op) (i32.const 2))
          (then
            (call $memcpy (i32.const 1024) (i32.const 17950) (i32.const 110))
            (return (i32.const 110))
          )
        )
        (call $memcpy (i32.const 1024) (i32.const 17820) (i32.const 110))
        (return (i32.const 110))
      )
    )

    ;; Search keywords in the response
    ;; 17700: "true" (4 bytes)
    (local.set $has_true (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17700) (i32.const 4)) (i32.const 0)))
    ;; 17710: "false" (5 bytes)
    (local.set $has_false (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17710) (i32.const 5)) (i32.const 0)))
    ;; 17720: "eventId" (7 bytes)
    (local.set $has_eventid (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17720) (i32.const 7)) (i32.const 0)))
    ;; 17730: "events" (6 bytes)
    (local.set $has_events (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17730) (i32.const 6)) (i32.const 0)))
    ;; 17740: "title" (5 bytes)
    (local.set $has_title (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17740) (i32.const 5)) (i32.const 0)))
    ;; 17760: "denied" (6 bytes)
    (local.set $has_denied (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17760) (i32.const 6)) (i32.const 0)))
    ;; 17770: "Permiso" (7 bytes)
    (local.set $has_permiso (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17770) (i32.const 7)) (i32.const 0)))
    ;; 17780: "created" (7 bytes)
    (local.set $has_created (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17780) (i32.const 7)) (i32.const 0)))

    ;; Determine if LIST operation: either op == 2 or response contains "events"
    (local.set $is_list
      (i32.or (i32.eq (local.get $op) (i32.const 2)) (local.get $has_events))
    )

    ;; Determine success:
    ;; Success if:
    ;;   1) "true" is present AND "false" is NOT present
    ;;   OR
    ;;   2) "eventId" is present
    ;;   OR
    ;;   3) "created" is present AND "false" is NOT present
    ;;   OR
    ;;   4) For list: "events" is present AND "false" is NOT present
    (local.set $is_success
      (i32.or
        (i32.and (local.get $has_true) (i32.eqz (local.get $has_false)))
        (i32.or
          (local.get $has_eventid)
          (i32.or
            (i32.and (local.get $has_created) (i32.eqz (local.get $has_false)))
            (i32.and (local.get $is_list) (i32.and (local.get $has_events) (i32.eqz (local.get $has_false))))
          )
        )
      )
    )

    ;; -------------------------------------------------------------------------
    ;; CASE 1: SUCCESSFUL RESPONSE
    ;; -------------------------------------------------------------------------
    (if (local.get $is_success)
      (then
        (if (local.get $is_list)
          (then
            ;; If events array contains at least one event with "title"
            (if (local.get $has_title)
              (then
                (call $memcpy (i32.const 1024) (i32.const 17260) (i32.const 117))
                (return (i32.const 117))
              )
              (else
                (call $memcpy (i32.const 1024) (i32.const 17400) (i32.const 102))
                (return (i32.const 102))
              )
            )
          )
          (else
            ;; Create Meeting Success
            (call $memcpy (i32.const 1024) (i32.const 17010) (i32.const 84))
            (return (i32.const 84))
          )
        )
      )
    )

    ;; -------------------------------------------------------------------------
    ;; CASE 2: PERMISSION DENIED EXPLICIT ERROR
    ;; -------------------------------------------------------------------------
    (if (i32.or (local.get $has_denied) (local.get $has_permiso))
      (then
        (if (local.get $is_list)
          (then
            (call $memcpy (i32.const 1024) (i32.const 17520) (i32.const 112))
            (return (i32.const 112))
          )
          (else
            (call $memcpy (i32.const 1024) (i32.const 17110) (i32.const 126))
            (return (i32.const 126))
          )
        )
      )
    )

    ;; -------------------------------------------------------------------------
    ;; CASE 3: GENERAL ERROR FALLBACK
    ;; -------------------------------------------------------------------------
    (if (local.get $is_list)
      (then
        (call $memcpy (i32.const 1024) (i32.const 17950) (i32.const 110))
        (return (i32.const 110))
      )
    )
    (call $memcpy (i32.const 1024) (i32.const 17820) (i32.const 110))
    (i32.const 110)
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
        ;; Store op_type = 2 (list events) at safe memory address 8192
        (i32.store (i32.const 8192) (i32.const 2))

        ;; Copy eventsReq (142 bytes) from 16384 to 2048
        (call $memcpy (i32.const 2048) (i32.const 16384) (i32.const 142))

        ;; Dispatch call to Host API
        (local.set $call_res
          (call $host_call (i32.const 2048) (i32.const 142) (i32.const 4096) (i32.const 4096))
        )
        (if (i32.eq (local.get $call_res) (i32.const 0))
          (then (return (i32.const 0)))
        )

        ;; Synchronous evaluation
        (return (call $process_response (i32.const 4096) (local.get $call_res)))
      )
    )

    ;; -------------------------------------------------------------------------
    ;; CASE B: Arguments provided -> Intelligently Schedule / Create Meeting
    ;; -------------------------------------------------------------------------
    ;; Store op_type = 1 (create meeting) at safe memory address 8192
    (i32.store (i32.const 8192) (i32.const 1))

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
                          (return (call $process_response (i32.const 4096) (local.get $call_res)))
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
        (return (call $process_response (i32.const 4096) (local.get $call_res)))
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

    ;; B.3: Conversational Spanish prefix stripping:
    ;; Check "agendame una reunion " (21 chars)
    (if (i32.gt_u (local.get $rem) (i32.const 21))
      (then
        (if (i32.and
              (i32.eq (i32.load8_u (local.get $src)) (i32.const 97)) ;; 'a'
              (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 1))) (i32.const 103)) ;; 'g'
            )
          (then
            (if (i32.and
                  (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 8))) (i32.const 32)) ;; ' ' after agendame
                  (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 12))) (i32.const 32)) ;; ' ' after una
                )
              (then
                ;; Strip "agendame una " (13 chars) to preserve "reunion hoy"
                (local.set $src (i32.add (local.get $src) (i32.const 13)))
                (local.set $rem (i32.sub (local.get $rem) (i32.const 13)))
              )
            )
          )
        )
      )
    )

    ;; Check "creame una reunion " (19 chars)
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
                ;; Strip "creame una " (11 chars) to preserve "reunion..."
                (local.set $src (i32.add (local.get $src) (i32.const 11)))
                (local.set $rem (i32.sub (local.get $rem) (i32.const 11)))
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
            (loop $trim_end_trail
              (if (i32.gt_u (local.get $end_len) (i32.const 0))
                (then
                  (if (i32.eq (i32.load8_u (i32.add (local.get $end_src) (i32.sub (local.get $end_len) (i32.const 1)))) (i32.const 32))
                    (then
                      (local.set $end_len (i32.sub (local.get $end_len) (i32.const 1)))
                      (br $trim_end_trail)
                    )
                  )
                )
              )
            )

            ;; Advance past third '|' if present
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
    (return (call $process_response (i32.const 4096) (local.get $call_res)))
  )

  ;; ============================================================================
  ;; Exported Function: resume(res_ptr: i32, res_len: i32) -> i32
  ;; ============================================================================
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (call $process_response (local.get $res_ptr) (local.get $res_len))
  )
)
