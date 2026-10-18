;; ==============================================================================
;; Chattree Official Device Calendar Plugin
;; Specification: Chattree WebAssembly Plugin Standard v1.0.0
;; Runtime: Isolated WASM sandbox with 4 memory pages (256 KB)
;; Host API: chattree.host_call(reqPtr, reqLen, resPtr, resMaxLen) -> i32
;;
;; Pure AI Architecture:
;;   - Empty / "list": Queries device calendar events directly.
;;   - JSON (from AI): Wraps and calls device calendar.create with structured parameters.
;;   - Zero keyword matching, zero pipes: All natural language is resolved by Chattree AI.
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

  ;; Offset 16730: Direct JSON Wrap Prefix (49 bytes)
  ;; {"api":"calendar","operation":"create","payload":
  (data (i32.const 16730) "{\"api\":\"calendar\",\"operation\":\"create\",\"payload\":")

  ;; Offset 17000: ToolResult Create Success Response (82 bytes UTF-8)
  (data (i32.const 17000) "{\"type\":\"direct\",\"displayText\":\"✅ Evento agendado con éxito en el calendario.\"}")

  ;; Offset 17100: ToolResult Permission Error Response (101 bytes UTF-8)
  (data (i32.const 17100) "{\"type\":\"error\",\"errorMessage\":\"No se pudo acceder al calendario. Verifica los permisos en Ajustes.\"}")

  ;; Offset 17230: ToolResult List Agenda Active (104 bytes UTF-8)
  (data (i32.const 17230) "{\"type\":\"direct\",\"displayText\":\"📅 Agenda sincronizada: tienes eventos programados en tu calendario.\"}")

  ;; Offset 17360: ToolResult List Agenda Empty (102 bytes UTF-8)
  (data (i32.const 17360) "{\"type\":\"direct\",\"displayText\":\"📅 Tu agenda está libre. No tienes eventos programados próximos.\"}")

  ;; Offset 17480: ToolResult Generic Error Response (97 bytes UTF-8)
  (data (i32.const 17480) "{\"type\":\"error\",\"errorMessage\":\"No se pudo consultar el calendario. Por favor intenta de nuevo.\"}")

  ;; Offset 18000: Natural Language Guidance Fallback (146 bytes UTF-8)
  (data (i32.const 18000) "{\"type\":\"direct\",\"displayText\":\"📅 Pide a la IA lo que deseas agendar con fecha y hora, o escribe /calendar para ver los eventos de tu agenda.\"}")

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

  ;; Offset 17960: "\"list\"" (6 bytes)
  (data (i32.const 17960) "\"list\"")

  ;; Offset 17980: "\"api\"" (5 bytes)
  (data (i32.const 17980) "\"api\"")

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
        (call $memcpy (i32.const 1024) (i32.const 17480) (i32.const 97))
        (return (i32.const 97))
      )
    )

    ;; Check for permission denied
    (local.set $has_denied (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17840) (i32.const 6)) (i32.const 0)))
    (local.set $has_permiso (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17860) (i32.const 7)) (i32.const 0)))
    (if (i32.or (local.get $has_denied) (local.get $has_permiso))
      (then
        (call $memcpy (i32.const 1024) (i32.const 17100) (i32.const 101))
        (return (i32.const 101))
      )
    )

    ;; Search for explicit failure indicators
    (local.set $has_success_false
      (i32.or
        (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17740) (i32.const 15)) (i32.const 0))
        (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17760) (i32.const 16)) (i32.const 0))
      )
    )

    ;; If host returned an error JSON (success: false), copy host response directly to 1024!
    ;; wasm_runtime.dart will parse it and show the exact error message from the host.
    (if (local.get $has_success_false)
      (then
        (call $memcpy (i32.const 1024) (local.get $res_ptr) (local.get $res_len))
        (return (local.get $res_len))
      )
    )

    ;; 17780: "\"eventId\"" (9)
    (local.set $has_eventid (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17780) (i32.const 9)) (i32.const 0)))

    ;; 17800: "\"events\"" (8)
    (local.set $has_events (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17800) (i32.const 8)) (i32.const 0)))

    ;; 17820: "\"title\"" (7)
    (local.set $has_title (i32.ge_s (call $str_find (local.get $res_ptr) (local.get $res_len) (i32.const 17820) (i32.const 7)) (i32.const 0)))

    ;; Empty events indicators:
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
            ;; 17230: active agenda (104 bytes)
            (call $memcpy (i32.const 1024) (i32.const 17230) (i32.const 104))
            (return (i32.const 104))
          )
        )
      )
      (else
        ;; 17000: create success (82 bytes)
        (call $memcpy (i32.const 1024) (i32.const 17000) (i32.const 82))
        (return (i32.const 82))
      )
    )
    (i32.const 0)
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
    (local $req_len i32)
    (local $is_json_list i32)

    (local.set $src (local.get $in_ptr))
    (local.set $rem (local.get $in_len))

    ;; 1. Trim leading whitespace
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
    ;; CASE A: Empty argument or "list" / "agenda" -> Query Device Events
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
            ;; "agenda" (6 bytes)
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
    ;; CASE B: Arguments provided
    ;; -------------------------------------------------------------------------

    ;; B.1: JSON input from the AI (starts with '{' = 123)
    (if (i32.and (i32.gt_u (local.get $rem) (i32.const 1)) (i32.eq (i32.load8_u (local.get $src)) (i32.const 123)))
      (then
        ;; Check if input has "list" in JSON
        (local.set $is_json_list
          (i32.or
            (i32.ge_s (call $str_find (local.get $src) (local.get $rem) (i32.const 17960) (i32.const 6)) (i32.const 0)) ;; "\"list\""
            (i32.ge_s (call $str_find (local.get $src) (local.get $rem) (i32.const 17800) (i32.const 8)) (i32.const 0)) ;; "\"events\""
          )
        )
        (if (local.get $is_json_list)
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

        ;; Operation = 1 (create)
        (i32.store (i32.const 8192) (i32.const 1))

        ;; Check if input already has "\"api\"" wrapper (5 bytes at offset 17980)
        (if (i32.ge_s (call $str_find (local.get $src) (local.get $rem) (i32.const 17980) (i32.const 5)) (i32.const 0))
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

    ;; B.2: Non-JSON input (Fallback if called without AI interpretation)
    ;; Offset 18000: Guidance message (146 bytes)
    (call $memcpy (i32.const 1024) (i32.const 18000) (i32.const 146))
    (return (i32.const 146))
  )

  ;; ============================================================================
  ;; Exported Function: resume(res_ptr: i32, res_len: i32) -> i32
  ;; ============================================================================
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (call $process_response (local.get $res_ptr) (local.get $res_len))
  )
)
