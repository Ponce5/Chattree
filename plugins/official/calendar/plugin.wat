;; ==============================================================================
;; Chattree Official Device Calendar Plugin
;; Specification: Chattree WebAssembly Plugin Standard v1.0.0
;;
;; Architecture:
;;   - Runtime: Isolated WASM sandbox with 4 memory pages (256 KB)
;;   - Host API: chattree.host_call(reqPtr, reqLen, resPtr, resMaxLen) -> i32
;;   - Contract:
;;       * Empty arguments: Return interactive help text immediately.
;;       * /calendar add <title> [| ...]: Parse title, construct JSON payload,
;;         and invoke calendar.create without calendarId (device auto-selection).
;;       * resume(res_ptr, res_len): Inspect response JSON and return human-friendly
;;         success or error message in Spanish.
;; ==============================================================================

(module
  ;; ---------------------------------------------------------------------------
  ;; Host API Import
  ;; ---------------------------------------------------------------------------
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; ---------------------------------------------------------------------------
  ;; Memory: 4 pages = 256 KB linear memory exported to host
  ;; ---------------------------------------------------------------------------
  (memory (export "memory") 4)

  ;; ---------------------------------------------------------------------------
  ;; Static Data Segments (Constants & Templates)
  ;; ---------------------------------------------------------------------------

  ;; Offset 512: Fallback title "Evento Chattree" (15 bytes)
  (data (i32.const 512) "Evento Chattree")

  ;; Offset 540: JSON Request Prefix (59 bytes)
  ;; {"api":"calendar","operation":"create","payload":{"title":"
  (data (i32.const 540) "{\"api\":\"calendar\",\"operation\":\"create\",\"payload\":{\"title\":\"")

  ;; Offset 600: JSON Request Suffix (60 bytes)
  ;; ","durationMinutes":60,"description":"Creado por Chattree"}}
  (data (i32.const 600) "\",\"durationMinutes\":60,\"description\":\"Creado por Chattree\"}}")

  ;; Offset 700: Help & Usage String (106 bytes UTF-8)
  ;; "📅 Plugin de Calendario Chattree\nUso: /calendar add <título> [| <fecha_inicio>] [| <duración_minutos>]"
  (data (i32.const 700) "\F0\9F\93\85\20\50\6C\75\67\69\6E\20\64\65\20\43\61\6C\65\6E\64\61\72\69\6F\20\43\68\61\74\74\72\65\65\0A\55\73\6F\3A\20\2F\63\61\6C\65\6E\64\61\72\20\61\64\64\20\3C\74\C3\AD\74\75\6C\6F\3E\20\5B\7C\20\3C\66\65\63\68\61\5F\69\6E\69\63\69\6F\3E\5D\20\5B\7C\20\3C\64\75\72\61\63\69\C3\B3\6E\5F\6D\69\6E\75\74\6F\73\3E\5D")

  ;; Offset 820: Success Response String (47 bytes UTF-8)
  ;; "✅ Evento agregado con éxito a tu calendario."
  (data (i32.const 820) "\E2\9C\85\20\45\76\65\6E\74\6F\20\61\67\72\65\67\61\64\6F\20\63\6F\6E\20\C3\A9\78\69\74\6F\20\61\20\74\75\20\63\61\6C\65\6E\64\61\72\69\6F\2E")

  ;; Offset 880: Error Response String (101 bytes UTF-8)
  ;; "❌ No se pudo crear el evento en el calendario. Asegúrate de tener una cuenta de calendario activa."
  (data (i32.const 880) "\E2\9D\8C\20\4E\6F\20\73\65\20\70\75\64\6F\20\63\72\65\61\72\20\65\6C\20\65\76\65\6E\74\6F\20\65\6E\20\65\6C\20\63\61\6C\65\6E\64\61\72\69\6F\2E\20\41\73\65\67\C3\BA\72\61\74\65\20\64\65\20\74\65\6E\65\72\20\75\6E\61\20\63\75\65\6E\74\61\20\64\65\20\63\61\6C\65\6E\64\61\72\69\6F\20\61\63\74\69\76\61\2E")

  ;; ---------------------------------------------------------------------------
  ;; Helper: Byte-by-byte memory copy (WASM 1.0 standard)
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

  ;; ============================================================================
  ;; Exported Function: calendar_entry(in_ptr: i32, in_len: i32) -> i32
  ;; Entrypoint called by Chattree when invoking /calendar
  ;; ============================================================================
  (func (export "calendar_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $call_res i32)
    (local $src_ptr i32)
    (local $rem_len i32)
    (local $title_len i32)
    (local $char i32)
    (local $i i32)
    (local $req_total_len i32)

    ;; 1. If input is empty, return interactive help text immediately
    (if (i32.eqz (local.get $in_len))
      (then
        (call $memcpy (i32.const 1024) (i32.const 700) (i32.const 106))
        (return (i32.const 106))
      )
    )

    (local.set $src_ptr (local.get $in_ptr))
    (local.set $rem_len (local.get $in_len))

    ;; 2. Strip optional "add " prefix if present (ASCII: 'a'=97, 'd'=100, ' '=32)
    (if (i32.ge_u (local.get $rem_len) (i32.const 4))
      (then
        (if (i32.eq (i32.load8_u (local.get $src_ptr)) (i32.const 97))
          (then
            (if (i32.eq (i32.load8_u (i32.add (local.get $src_ptr) (i32.const 1))) (i32.const 100))
              (then
                (if (i32.eq (i32.load8_u (i32.add (local.get $src_ptr) (i32.const 2))) (i32.const 100))
                  (then
                    (if (i32.eq (i32.load8_u (i32.add (local.get $src_ptr) (i32.const 3))) (i32.const 32))
                      (then
                        (local.set $src_ptr (i32.add (local.get $src_ptr) (i32.const 4)))
                        (local.set $rem_len (i32.sub (local.get $rem_len) (i32.const 4)))
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

    ;; 3. Strip any leading whitespace
    (loop $trim_loop
      (if (i32.gt_u (local.get $rem_len) (i32.const 0))
        (then
          (if (i32.eq (i32.load8_u (local.get $src_ptr)) (i32.const 32))
            (then
              (local.set $src_ptr (i32.add (local.get $src_ptr) (i32.const 1)))
              (local.set $rem_len (i32.sub (local.get $rem_len) (i32.const 1)))
              (br $trim_loop)
            )
          )
        )
      )
    )

    ;; 4. Find title length (scan until '|', newline, or end of string, cap at 120 chars)
    (local.set $i (i32.const 0))
    (loop $scan_title
      (if (i32.lt_u (local.get $i) (local.get $rem_len))
        (then
          (if (i32.lt_u (local.get $i) (i32.const 120))
            (then
              (local.set $char (i32.load8_u (i32.add (local.get $src_ptr) (local.get $i))))
              ;; If '|' (124) or '\n' (10) or '\r' (13), terminate title
              (if (i32.eq (local.get $char) (i32.const 124))
                (then (nop))
                (else
                  (if (i32.eq (local.get $char) (i32.const 10))
                    (then (nop))
                    (else
                      (if (i32.eq (local.get $char) (i32.const 13))
                        (then (nop))
                        (else
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $scan_title)
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

    ;; Trim trailing space from title if present
    (loop $trim_trailing
      (if (i32.gt_u (local.get $i) (i32.const 0))
        (then
          (if (i32.eq (i32.load8_u (i32.add (local.get $src_ptr) (i32.sub (local.get $i) (i32.const 1)))) (i32.const 32))
            (then
              (local.set $i (i32.sub (local.get $i) (i32.const 1)))
              (br $trim_trailing)
            )
          )
        )
      )
    )

    (local.set $title_len (local.get $i))

    ;; 5. Construct JSON Request at offset 2048
    ;; Step A: Copy Prefix (59 bytes)
    (call $memcpy (i32.const 2048) (i32.const 540) (i32.const 59))

    ;; Step B: Copy Title (or fallback if empty)
    (if (i32.eqz (local.get $title_len))
      (then
        ;; Use default "Evento Chattree" (15 bytes)
        (call $memcpy (i32.const 2107) (i32.const 512) (i32.const 15))
        (local.set $title_len (i32.const 15))
      )
      (else
        ;; Copy title sanitizing any '"' (34) or '\' (92) to prevent JSON injection
        (local.set $i (i32.const 0))
        (loop $copy_title
          (if (i32.lt_u (local.get $i) (local.get $title_len))
            (then
              (local.set $char (i32.load8_u (i32.add (local.get $src_ptr) (local.get $i))))
              ;; If '"' or '\', replace with space (32)
              (if (i32.eq (local.get $char) (i32.const 34))
                (then (local.set $char (i32.const 32)))
              )
              (if (i32.eq (local.get $char) (i32.const 92))
                (then (local.set $char (i32.const 32)))
              )
              (i32.store8
                (i32.add (i32.const 2107) (local.get $i)) ;; 2048 + 59 = 2107
                (local.get $char)
              )
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $copy_title)
            )
          )
        )
      )
    )

    ;; Step C: Copy Suffix (60 bytes)
    (call $memcpy
      (i32.add (i32.const 2107) (local.get $title_len))
      (i32.const 600)
      (i32.const 60)
    )

    ;; Total request length = 59 (prefix) + title_len + 60 (suffix)
    (local.set $req_total_len
      (i32.add (i32.const 119) (local.get $title_len))
    )

    ;; 6. Dispatch call to Chattree Host API:
    ;;    host_call(reqPtr=2048, reqLen, resPtr=4096, resMaxLen=4096)
    (local.set $call_res
      (call $host_call
        (i32.const 2048)
        (local.get $req_total_len)
        (i32.const 4096)
        (i32.const 4096)
      )
    )

    ;; 7. Evaluate Call Result
    ;; Case 0: Async operation scheduled. Chattree runtime will invoke resume().
    (if (i32.eq (local.get $call_res) (i32.const 0))
      (then
        (return (i32.const 0))
      )
    )

    ;; Case > 0: Immediate synchronous response at offset 4096.
    (if (i32.gt_s (local.get $call_res) (i32.const 0))
      (then
        ;; Check if success:true ('t' = 116 at index 11)
        (if (i32.eq (i32.load8_u (i32.const 4107)) (i32.const 116))
          (then
            (call $memcpy (i32.const 1024) (i32.const 820) (i32.const 47))
            (return (i32.const 47))
          )
          (else
            (call $memcpy (i32.const 1024) (i32.const 880) (i32.const 101))
            (return (i32.const 101))
          )
        )
      )
    )

    ;; Case -1: Synchronous host error
    (call $memcpy (i32.const 1024) (i32.const 880) (i32.const 101))
    (i32.const 101)
  )

  ;; ============================================================================
  ;; Exported Function: resume(res_ptr: i32, res_len: i32) -> i32
  ;; Called by Chattree runtime once the calendar operation finishes
  ;; ============================================================================
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    ;; Check response validity
    (if (i32.gt_s (local.get $res_len) (i32.const 11))
      (then
        ;; In Chattree HostApiResponse: {"success":true,...} or {"success":false,...}
        ;; Offset res_ptr + 11 is 't' (116) if true, or 'f' (102) if false.
        (if (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.const 11))) (i32.const 116))
          (then
            ;; Success: write "✅ Evento agregado con éxito a tu calendario." (47 bytes)
            (call $memcpy (i32.const 1024) (i32.const 820) (i32.const 47))
            (return (i32.const 47))
          )
        )
      )
    )

    ;; Fallback error message (101 bytes)
    ;; "❌ No se pudo crear el evento en el calendario. Asegúrate de tener una cuenta de calendario activa."
    (call $memcpy (i32.const 1024) (i32.const 880) (i32.const 101))
    (i32.const 101)
  )
)
