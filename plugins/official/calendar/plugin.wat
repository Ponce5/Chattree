;; ==============================================================================
;; Chattree Official Device Calendar Plugin
;; Specification: Chattree WebAssembly Plugin Standard v1.0.0
;; Runtime: Isolated WASM sandbox with 4 memory pages (256 KB)
;; Host API: chattree.host_call(reqPtr, reqLen, resPtr, resMaxLen) -> i32
;;
;; Intelligent Architecture (/calendar):
;;   - Empty, "list", or "agenda": Queries real device agenda events.
;;   - Direct JSON from AI: Parses structured JSON from LLM function calls.
;;   - Natural speech from user: Creates events using current device date/time.
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

  ;; ============================================================================
  ;; Static Constants & Templates
  ;; ============================================================================

  ;; Offset 16384: List Events Request (74 bytes)
  ;; {"api":"calendar","operation":"events","payload":{"calendarId":"primary"}}
  (data (i32.const 16384) "{\"api\":\"calendar\",\"operation\":\"events\",\"payload\":{\"calendarId\":\"primary\"}}")

  ;; Offset 16500: Create Request Prefix (82 bytes)
  ;; {"api":"calendar","operation":"create","payload":{"calendarId":"primary","title":"
  (data (i32.const 16500) "{\"api\":\"calendar\",\"operation\":\"create\",\"payload\":{\"calendarId\":\"primary\",\"title\":\"")

  ;; Offset 16600: Infix StartDate (15 bytes)
  ;; ","startDate":"
  (data (i32.const 16600) "\",\"startDate\":\"")

  ;; Offset 16630: Infix EndDate (13 bytes)
  ;; ","endDate":"
  (data (i32.const 16630) "\",\"endDate\":\"")

  ;; Offset 16660: Infix Description (17 bytes)
  ;; ","description":"
  (data (i32.const 16660) "\",\"description\":\"")

  ;; Offset 16690: Suffix (3 bytes)
  ;; "}}
  (data (i32.const 16690) "\"}}")

  ;; Offset 16700: Default Description (24 bytes)
  ;; Agendado con Chattree AI
  (data (i32.const 16700) "Agendado con Chattree AI")

  ;; Offset 16730: Direct JSON Wrap Prefix (49 bytes)
  ;; {"api":"calendar","operation":"create","payload":
  (data (i32.const 16730) "{\"api\":\"calendar\",\"operation\":\"create\",\"payload\":")

  ;; Offset 16790: Default Title "Reunión" (8 bytes UTF-8)
  (data (i32.const 16790) "Reuni\C3\B3n")

  ;; Offset 17000: ToolResult Create Success Response (84 bytes UTF-8)
  ;; {"type":"direct","displayText":"✅ Reunión agendada con éxito en el calendario."}
  (data (i32.const 17000) "{\"type\":\"direct\",\"displayText\":\"\E2\9C\85 Reuni\C3\B3n agendada con \C3\A9xito en el calendario.\"}")

  ;; Offset 17100: ToolResult Permission Error Response (112 bytes UTF-8)
  ;; {"type":"error","errorMessage":"No se pudo consultar la agenda del calendario. Revisa los permisos en Ajustes."}
  (data (i32.const 17100) "{\"type\":\"error\",\"errorMessage\":\"No se pudo consultar la agenda del calendario. Revisa los permisos en Ajustes.\"}")

  ;; Offset 17230: ToolResult List Agenda Active (117 bytes UTF-8)
  ;; {"type":"direct","displayText":"📅 Agenda de Eventos:\nTienes eventos programados sincronizados en tu calendario."}
  (data (i32.const 17230) "{\"type\":\"direct\",\"displayText\":\"\F0\9F\93\85 Agenda de Eventos:\\nTienes eventos programados sincronizados en tu calendario.\"}")

  ;; Offset 17360: ToolResult List Agenda Empty (102 bytes UTF-8)
  ;; {"type":"direct","displayText":"📅 Tu agenda está libre. No tienes eventos programados próximos."}
  (data (i32.const 17360) "{\"type\":\"direct\",\"displayText\":\"\F0\9F\93\85 Tu agenda est\C3\A1 libre. No tienes eventos programados pr\C3\B3ximos.\"}")

  ;; Offset 17480: ToolResult Generic Error Response (110 bytes UTF-8)
  ;; {"type":"error","errorMessage":"No se pudo consultar los eventos del calendario. Por favor intenta de nuevo."}
  (data (i32.const 17480) "{\"type\":\"error\",\"errorMessage\":\"No se pudo consultar los eventos del calendario. Por favor intenta de nuevo.\"}")

  ;; Keywords for JSON inspection:
  ;; Offset 17700: "\"success\":true" (14 bytes)
  (data (i32.const 17700) "\"success\":true")

  ;; Offset 17720: "\"success\": true" (15 bytes)
  (data (i32.const 17720) "\"success\": true")

  ;; Offset 17740: "\"success\":false" (15 bytes)
  (data (i32.const 17740) "\"success\":false")

  ;; Offset 17760: "\"success\": false" (16 bytes)
  (data (i32.const 17760) "\"success\": false")

  ;; Offset 17780: "\"eventId\"" (9 bytes)
  (data (i32.const 17780) "\"eventId\"")

  ;; Offset 17800: "\"events\"" (8 bytes)
  (data (i32.const 17800) "\"events\"")

  ;; Offset 17820: "\"title\"" (7 bytes)
  (data (i32.const 17820) "\"title\"")

  ;; Offset 17840: "denied" (6 bytes)
  (data (i32.const 17840) "denied")

  ;; Offset 17860: "Permiso" (7 bytes)
  (data (i32.const 17860) "Permiso")

  ;; Offset 17880: "\"events\":[]" (11 bytes)
  (data (i32.const 17880) "\"events\":[]")

  ;; Offset 17900: "\"events\": []" (12 bytes)
  (data (i32.const 17900) "\"events\": []")

  ;; Offset 17920: "\"count\":0" (9 bytes)
  (data (i32.const 17920) "\"count\":0")

  ;; Offset 17940: "\"count\": 0" (10 bytes)
  (data (i32.const 17940) "\"count\": 0")

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
          ;; Replace any control character < 32 with space (32)
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
  ;; ---------------------------------------------------------------------------
  (func $process_response (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $op i32)
    (local $has_success_true i32)
    (local $has_success_false i32)
    (local $has_eventid i32)
    (local $has_events i32)
    (local $has_title i32)
    (local $has_empty_events i32)
    (local $has_permiso i32)
    (local $has_denied i32)
    (local $is_success i32)
    (local $is_list i32)

    ;; Load stored operation type from address 8192: 1 = create, 2 = list
    (local.set $op (i32.load (i32.const 8192)))

    ;; Guard against empty / invalid response length
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then
        (call $memcpy (i32.const 1024) (i32.const 17480) (i32.const 110))
        (return (i32.const 110))
      )
    )

    ;; Check for permission denied
    (local.set $has_denied (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17840) (i32.const 6)) (i32.const 0)))
    (local.set $has_permiso (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17860) (i32.const 7)) (i32.const 0)))
    (if (i32.or (local.get $has_denied) (local.get $has_permiso))
      (then
        (call $memcpy (i32.const 1024) (i32.const 17100) (i32.const 112))
        (return (i32.const 112))
      )
    )

    ;; Search for success indicators
    ;; 17700: "\"success\":true" (14)
    ;; 17720: "\"success\": true" (15)
    (local.set $has_success_true
      (i32.or
        (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17700) (i32.const 14)) (i32.const 0))
        (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17720) (i32.const 15)) (i32.const 0))
      )
    )

    ;; Search for explicit failure indicators
    ;; 17740: "\"success\":false" (15)
    ;; 17760: "\"success\": false" (16)
    (local.set $has_success_false
      (i32.or
        (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17740) (i32.const 15)) (i32.const 0))
        (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17760) (i32.const 16)) (i32.const 0))
      )
    )

    ;; 17780: "\"eventId\"" (9)
    (local.set $has_eventid (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17780) (i32.const 9)) (i32.const 0)))

    ;; 17800: "\"events\"" (8)
    (local.set $has_events (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17800) (i32.const 8)) (i32.const 0)))

    ;; 17820: "\"title\"" (7)
    (local.set $has_title (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17820) (i32.const 7)) (i32.const 0)))

    ;; Empty events indicators:
    ;; 17880: "\"events\":[]" (11)
    ;; 17900: "\"events\": []" (12)
    ;; 17920: "\"count\":0" (9)
    ;; 17940: "\"count\": 0" (10)
    (local.set $has_empty_events
      (i32.or
        (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17880) (i32.const 11)) (i32.const 0))
        (i32.or
          (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17900) (i32.const 12)) (i32.const 0))
          (i32.or
            (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17920) (i32.const 9)) (i32.const 0))
            (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17940) (i32.const 10)) (i32.const 0))
          )
        )
      )
    )

    ;; Determine if list operation: op == 2 or events field is present
    (local.set $is_list
      (i32.or (i32.eq (local.get $op) (i32.const 2)) (local.get $has_events))
    )

    ;; Success determination:
    ;; True if success_true is found OR eventId is found OR (is_list and events is found)
    ;; AND success_false is NOT present.
    (local.set $is_success
      (i32.and
        (i32.eqz (local.get $has_success_false))
        (i32.or
          (local.get $has_success_true)
          (i32.or
            (local.get $has_eventid)
            (i32.and (local.get $is_list) (local.get $has_events))
          )
        )
      )
    )

    (if (local.get $is_success)
      (then
        (if (local.get $is_list)
          (then
            ;; If events array is empty OR no title found:
            (if (i32.or (local.get $has_empty_events) (i32.eqz (local.get $has_title)))
              (then
                ;; 17360: empty agenda (102 bytes)
                (call $memcpy (i32.const 1024) (i32.const 17360) (i32.const 102))
                (return (i32.const 102))
              )
              (else
                ;; 17230: active agenda (117 bytes)
                (call $memcpy (i32.const 1024) (i32.const 17230) (i32.const 117))
                (return (i32.const 117))
              )
            )
          )
          (else
            ;; 17000: create success (84 bytes)
            (call $memcpy (i32.const 1024) (i32.const 17000) (i32.const 84))
            (return (i32.const 84))
          )
        )
      )
    )

    ;; Failure fallback
    (call $memcpy (i32.const 1024) (i32.const 17480) (i32.const 110))
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
    (local $dest i32)
    (local $req_len i32)
    (local $has_pipe i32)

    (local.set $src (local.get $in_ptr))
    (local.set $rem (local.get $in_len))

    ;; 1. Trim leading whitespace (spaces: 32, tabs: 9, newlines: 10, 13)
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

    ;; 2. Trim trailing whitespace
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
    ;; CASE A: Empty argument or "list" / "agenda" -> Query Agenda Events
    ;; -------------------------------------------------------------------------
    (if (i32.or
          (i32.eqz (local.get $rem))
          (i32.or
            ;; "list" (4 bytes)
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
            ;; "agenda" (6 bytes: 97, 103, 101, 110, 100, 97)
            (i32.and
              (i32.eq (local.get $rem) (i32.const 6))
              (i32.and
                (i32.eq (i32.load8_u (local.get $src)) (i32.const 97)) ;; 'a'
                (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 1))) (i32.const 103)) ;; 'g'
              )
            )
          )
        )
      (then
        ;; Store op_type = 2 (list events)
        (i32.store (i32.const 8192) (i32.const 2))

        ;; Copy events_req (74 bytes) from 16384 to 2048
        (call $memcpy (i32.const 2048) (i32.const 16384) (i32.const 74))

        ;; Dispatch call to Host API
        (local.set $call_res
          (call $host_call (i32.const 2048) (i32.const 74) (i32.const 4096) (i32.const 4096))
        )
        (if (i32.eq (local.get $call_res) (i32.const 0))
          (then (return (i32.const 0)))
        )
        (return (call $process_response (i32.const 4096) (local.get $call_res)))
      )
    )

    ;; -------------------------------------------------------------------------
    ;; CASE B: Arguments provided -> Intelligently Schedule Event
    ;; -------------------------------------------------------------------------
    (i32.store (i32.const 8192) (i32.const 1))

    ;; B.1: Direct JSON input (starts with '{' = 123)
    (if (i32.and (i32.gt_u (local.get $rem) (i32.const 1)) (i32.eq (i32.load8_u (local.get $src)) (i32.const 123)))
      (then
        ;; Check if input has {"action":"list"}
        (if (i32.ge_s (call $str_find (local.get $src) (local.get $rem) (i32.const 17800) (i32.const 8)) (i32.const 0))
          (then
            ;; Switch to list operation
            (i32.store (i32.const 8192) (i32.const 2))
            (call $memcpy (i32.const 2048) (i32.const 16384) (i32.const 74))
            (local.set $call_res
              (call $host_call (i32.const 2048) (i32.const 74) (i32.const 4096) (i32.const 4096))
            )
            (if (i32.eq (local.get $call_res) (i32.const 0))
              (then (return (i32.const 0)))
            )
            (return (call $process_response (i32.const 4096) (local.get $call_res)))
          )
        )

        ;; Check if input already has "api" wrapper
        (local.set $i (i32.const 0))
        (loop $check_api
          (if (i32.and (i32.lt_u (local.get $i) (local.get $rem)) (i32.lt_u (local.get $i) (i32.const 25)))
            (then
              (if (i32.and
                    (i32.eq (i32.load8_u (i32.add (local.get $src) (local.get $i))) (i32.const 97)) ;; 'a'
                    (i32.and
                      (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1)))) (i32.const 112)) ;; 'p'
                      (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 2)))) (i32.const 105)) ;; 'i'
                    )
                  )
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
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $check_api)
            )
          )
        )

        ;; Wrap input with {"api":"calendar","operation":"create","payload":<input>}
        (call $memcpy (i32.const 2048) (i32.const 16730) (i32.const 49))
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

    ;; B.2: Check if input contains a pipe '|' (ASCII 124)
    (local.set $has_pipe (i32.const 0))
    (local.set $i (i32.const 0))
    (loop $scan_pipe
      (if (i32.lt_u (local.get $i) (local.get $rem))
        (then
          (if (i32.eq (i32.load8_u (i32.add (local.get $src) (local.get $i))) (i32.const 124))
            (then
              (local.set $has_pipe (i32.const 1))
            )
            (else
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $scan_pipe)
            )
          )
        )
      )
    )

    ;; If PIPE is present: parse pipe format: title [| start] [| end] [| description]
    (if (local.get $has_pipe)
      (then
        ;; Segment 1: Title
        (local.set $title_src (local.get $src))
        (local.set $i (i32.const 0))
        (loop $p_title
          (if (i32.lt_u (local.get $i) (local.get $rem))
            (then
              (if (i32.eq (i32.load8_u (i32.add (local.get $src) (local.get $i))) (i32.const 124))
                (then (nop))
                (else
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $p_title)
                )
              )
            )
          )
        )
        (local.set $title_len (local.get $i))

        ;; Advance past first '|'
        (local.set $src (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1))))
        (local.set $rem (i32.sub (local.get $rem) (i32.add (local.get $i) (i32.const 1))))

        ;; Segment 2: Start Date
        (local.set $start_src (local.get $src))
        (local.set $i (i32.const 0))
        (loop $p_start
          (if (i32.lt_u (local.get $i) (local.get $rem))
            (then
              (if (i32.eq (i32.load8_u (i32.add (local.get $src) (local.get $i))) (i32.const 124))
                (then (nop))
                (else
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $p_start)
                )
              )
            )
          )
        )
        (local.set $start_len (local.get $i))

        ;; Build JSON with provided segments
        (local.set $dest (i32.const 2048))
        ;; Copy create prefix (82 bytes)
        (call $memcpy (local.get $dest) (i32.const 16500) (i32.const 82))
        (local.set $dest (i32.add (local.get $dest) (i32.const 82)))

        (call $copy_sanitized (local.get $dest) (local.get $title_src) (local.get $title_len))
        (local.set $dest (i32.add (local.get $dest) (local.get $title_len)))

        (if (i32.gt_u (local.get $start_len) (i32.const 0))
          (then
            ;; Infix StartDate (15 bytes)
            (call $memcpy (local.get $dest) (i32.const 16600) (i32.const 15))
            (local.set $dest (i32.add (local.get $dest) (i32.const 15)))
            (call $copy_sanitized (local.get $dest) (local.get $start_src) (local.get $start_len))
            (local.set $dest (i32.add (local.get $dest) (local.get $start_len)))
          )
        )

        ;; Suffix (3 bytes: "}}")
        (call $memcpy (local.get $dest) (i32.const 16690) (i32.const 3))
        (local.set $dest (i32.add (local.get $dest) (i32.const 3)))
        (local.set $req_len (i32.sub (local.get $dest) (i32.const 2048)))

        (local.set $call_res
          (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096))
        )
        (if (i32.eq (local.get $call_res) (i32.const 0))
          (then (return (i32.const 0)))
        )
        (return (call $process_response (i32.const 4096) (local.get $call_res)))
      )
    )

    ;; B.3: Pure Natural Language input (No pipes! The user speech IS the event title!)
    ;; Check and strip common Spanish prefixes if present (e.g. "agendame una reunion ", "agendar ", etc.)
    (if (i32.gt_u (local.get $rem) (i32.const 13))
      (then
        ;; Check "agendame una " (13 bytes: 'a','g','e','n','d','a','m','e',' ','u','n','a',' ')
        (if (i32.and
              (i32.eq (i32.load8_u (local.get $src)) (i32.const 97))
              (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 1))) (i32.const 103))
            )
          (then
            (if (i32.and
                  (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 8))) (i32.const 32))
                  (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 12))) (i32.const 32))
                )
              (then
                (local.set $src (i32.add (local.get $src) (i32.const 13)))
                (local.set $rem (i32.sub (local.get $rem) (i32.const 13)))
              )
            )
          )
        )
      )
    )

    (if (i32.gt_u (local.get $rem) (i32.const 11))
      (then
        ;; Check "creame una " (11 bytes: 'c','r','e','a','m','e',' ','u','n','a',' ')
        (if (i32.and
              (i32.eq (i32.load8_u (local.get $src)) (i32.const 99))
              (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 1))) (i32.const 114))
            )
          (then
            (if (i32.and
                  (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 6))) (i32.const 32))
                  (i32.eq (i32.load8_u (i32.add (local.get $src) (i32.const 10))) (i32.const 32))
                )
              (then
                (local.set $src (i32.add (local.get $src) (i32.const 11)))
                (local.set $rem (i32.sub (local.get $rem) (i32.const 11)))
              )
            )
          )
        )
      )
    )

    ;; Fallback title if empty after trim
    (local.set $title_src (local.get $src))
    (local.set $title_len (local.get $rem))
    (if (i32.eqz (local.get $title_len))
      (then
        (local.set $title_src (i32.const 16790))
        (local.set $title_len (i32.const 8)) ;; "Reunión"
      )
    )

    ;; Construct JSON: {"api":"calendar","operation":"create","payload":{"calendarId":"primary","title":"<title>","description":"Agendado con Chattree AI"}}
    (local.set $dest (i32.const 2048))
    ;; Copy create prefix (82 bytes)
    (call $memcpy (local.get $dest) (i32.const 16500) (i32.const 82))
    (local.set $dest (i32.add (local.get $dest) (i32.const 82)))

    (call $copy_sanitized (local.get $dest) (local.get $title_src) (local.get $title_len))
    (local.set $dest (i32.add (local.get $dest) (local.get $title_len)))

    ;; Copy Infix Description (17 bytes: '","description":"')
    (call $memcpy (local.get $dest) (i32.const 16660) (i32.const 17))
    (local.set $dest (i32.add (local.get $dest) (i32.const 17)))

    ;; Copy default description (24 bytes: 'Agendado con Chattree AI')
    (call $memcpy (local.get $dest) (i32.const 16700) (i32.const 24))
    (local.set $dest (i32.add (local.get $dest) (i32.const 24)))

    ;; Suffix (3 bytes: '"}')
    (call $memcpy (local.get $dest) (i32.const 16690) (i32.const 3))
    (local.set $dest (i32.add (local.get $dest) (i32.const 3)))
    (local.set $req_len (i32.sub (local.get $dest) (i32.const 2048)))

    ;; Dispatch call to Host API
    (local.set $call_res
      (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096))
    )
    (if (i32.eq (local.get $call_res) (i32.const 0))
      (then (return (i32.const 0)))
    )
    (return (call $process_response (i32.const 4096) (local.get $call_res)))
  )

  ;; ============================================================================
  ;; Exported Function: resume(res_ptr: i32, res_len: i32) -> i32
  ;; ============================================================================
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (call $process_response (local.get $res_ptr) (local.get $res_len))
  )
)
