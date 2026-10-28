;; Chattree Official Calendar Plugin — WebAssembly Text format (WAT)
;;
;; Primary command: /calendar <title> [| <ISO start date>] [| <ISO end date>]
;; Subcommands:    /calendar list | /calendar events
;;
;; Capabilities:
;;   - calendar.create
;;   - calendar.read
;;
;; Compilation:
;;   wat2wasm plugin.wat -o plugin.wasm
;;
;; Protocol:
;;   Offset 0:     Input string written by Chattree (user text or AI tool arguments)
;;   Offset 1024:  Output string returned to chat
;;   Offset 2048:  JSON request payload for chattree.host_call
;;   Offset 4096:  JSON response payload from ChattreeHostApi

(module
  ;; Import the Host API function from Chattree runtime
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; Export 4 memory pages (256 KB linear memory)
  (memory (export "memory") 4)

  ;; Pre-load usage string at offset 1024 (70 bytes)
  (data (i32.const 1024) "Usage: /calendar <title> [| startDate] [| endDate] | /calendar list")

  ;; Pre-load create request prefix at offset 3000 (59 bytes):
  ;; {"api":"calendar","operation":"create","payload":{"title":"
  (data (i32.const 3000) "{\"api\":\"calendar\",\"operation\":\"create\",\"payload\":{\"title\":\"")

  ;; Pre-load request suffix at offset 3100 (3 bytes):
  ;; "}}
  (data (i32.const 3100) "\"}}")

  ;; Pre-load events request at offset 3200 (52 bytes):
  ;; {"api":"calendar","operation":"events","payload":{}}
  (data (i32.const 3200) "{\"api\":\"calendar\",\"operation\":\"events\",\"payload\":{}}")

  ;; Pre-load raw payload prefix at offset 3300 (49 bytes):
  ;; {"api":"calendar","operation":"create","payload":
  (data (i32.const 3300) "{\"api\":\"calendar\",\"operation\":\"create\",\"payload\":")

  ;; Pre-load raw payload suffix at offset 3380 (1 byte):
  ;; }
  (data (i32.const 3380) "}")

  ;; Pre-load start field separator at offset 3400 (11 bytes):
  ;; ","start":"
  (data (i32.const 3400) "\",\"start\":\"")

  ;; Pre-load startDate field separator at offset 3430 (15 bytes):
  ;; ","startDate":"
  (data (i32.const 3430) "\",\"startDate\":\"")

  ;; Pre-load end field separator at offset 3470 (9 bytes):
  ;; ","end":"
  (data (i32.const 3470) "\",\"end\":\"")

  ;; Pre-load endDate field separator at offset 3500 (13 bytes):
  ;; ","endDate":"
  (data (i32.const 3500) "\",\"endDate\":\"")

  ;; Main entrypoint: (inputPtr: i32, inputLen: i32) -> outputLen: i32
  (func (export "calendar_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $req_len i32)
    (local $i i32)
    (local $pipe1_pos i32)
    (local $pipe2_pos i32)
    (local $title_len i32)
    (local $date_start i32)
    (local $date_len i32)
    (local $end_start i32)
    (local $end_len i32)
    (local $dest_ptr i32)

    ;; 1. If input is empty, automatically list all events!
    (if (i32.eqz (local.get $in_len))
      (then
        (memory.copy (i32.const 2048) (i32.const 3200) (i32.const 52))
        (drop (call $host_call (i32.const 2048) (i32.const 52) (i32.const 4096) (i32.const 4096)))
        (return (i32.const 0))
      )
    )

    ;; 2. Check if input is "list" (4 bytes: 'l'=108) or "events" (6 bytes: 'e'=101)
    (if (i32.eq (local.get $in_len) (i32.const 4))
      (then
        (if (i32.eq (i32.load8_u (local.get $in_ptr)) (i32.const 108))
          (then
            (memory.copy (i32.const 2048) (i32.const 3200) (i32.const 52))
            (drop (call $host_call (i32.const 2048) (i32.const 52) (i32.const 4096) (i32.const 4096)))
            (return (i32.const 0))
          )
        )
      )
    )
    (if (i32.eq (local.get $in_len) (i32.const 6))
      (then
        (if (i32.eq (i32.load8_u (local.get $in_ptr)) (i32.const 101))
          (then
            (memory.copy (i32.const 2048) (i32.const 3200) (i32.const 52))
            (drop (call $host_call (i32.const 2048) (i32.const 52) (i32.const 4096) (i32.const 4096)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; 3. Check if input is JSON (starts with '{' = ASCII 123)
    (if (i32.eq (i32.load8_u (local.get $in_ptr)) (i32.const 123))
      (then
        ;; Check if this request is to list/view events (e.g. contains "events" or "list")
        ;; Check if input starts with {"api":
        (if (i32.and
              (i32.ge_u (local.get $in_len) (i32.const 6))
              (i32.and
                (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (i32.const 1))) (i32.const 34))
                (i32.and
                  (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (i32.const 2))) (i32.const 97))
                  (i32.and
                    (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (i32.const 3))) (i32.const 112))
                    (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (i32.const 4))) (i32.const 105))
                  )
                )
              )
            )
          (then
            ;; Host API formatted: check if operation is "list" (byte 31 is 'l'=108, byte 32 is 'i'=105)
            (if (i32.and
                  (i32.ge_u (local.get $in_len) (i32.const 35))
                  (i32.and
                    (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (i32.const 31))) (i32.const 108))
                    (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (i32.const 32))) (i32.const 105))
                  )
                )
              (then
                ;; Replace "list" operation with valid "events" operation
                (memory.copy (i32.const 2048) (i32.const 3200) (i32.const 52))
                (drop (call $host_call (i32.const 2048) (i32.const 52) (i32.const 4096) (i32.const 4096)))
                (return (i32.const 0))
              )
            )

            ;; Forward Host API request directly
            (memory.copy (i32.const 2048) (local.get $in_ptr) (local.get $in_len))
            (drop (call $host_call (i32.const 2048) (local.get $in_len) (i32.const 4096) (i32.const 4096)))
            (return (i32.const 0))
          )
          (else
            ;; Raw JSON payload without "api".
            ;; Check if it is a list/events action: e.g. {"action":"list"} or {"action":"events"}
            (if (i32.and
                  (i32.ge_u (local.get $in_len) (i32.const 15))
                  (i32.or
                    ;; byte 11 is 'l' (list)
                    (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (i32.const 11))) (i32.const 108))
                    ;; byte 11 is 'e' (events)
                    (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (i32.const 11))) (i32.const 101))
                  )
                )
              (then
                (memory.copy (i32.const 2048) (i32.const 3200) (i32.const 52))
                (drop (call $host_call (i32.const 2048) (i32.const 52) (i32.const 4096) (i32.const 4096)))
                (return (i32.const 0))
              )
            )

            ;; Wrap raw JSON as create payload:
            ;; Copy prefix (49 bytes) from offset 3300: {"api":"calendar","operation":"create","payload":
            (memory.copy (i32.const 2048) (i32.const 3300) (i32.const 49))
            ;; Copy payload JSON after prefix at 2048 + 49 = 2097
            (memory.copy (i32.const 2097) (local.get $in_ptr) (local.get $in_len))
            ;; Copy closing '}' (1 byte) from offset 3380 to 2097 + in_len
            (memory.copy
              (i32.add (i32.const 2097) (local.get $in_len))
              (i32.const 3380)
              (i32.const 1)
            )
            ;; Total length = 49 + in_len + 1 = 50 + in_len
            (local.set $req_len (i32.add (i32.const 50) (local.get $in_len)))
            (drop (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; 4. Check for pipe delimiters '|' (ASCII 124) separating title, startDate, and endDate
    (local.set $pipe1_pos (i32.const -1))
    (local.set $pipe2_pos (i32.const -1))
    (local.set $i (i32.const 0))

    (block $break_search
      (loop $search_loop
        (if (i32.ge_s (local.get $i) (local.get $in_len))
          (then (br $break_search))
        )
        (if (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (local.get $i))) (i32.const 124))
          (then
            (if (i32.lt_s (local.get $pipe1_pos) (i32.const 0))
              (then (local.set $pipe1_pos (local.get $i)))
              (else
                (if (i32.lt_s (local.get $pipe2_pos) (i32.const 0))
                  (then (local.set $pipe2_pos (local.get $i)))
                )
              )
            )
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $search_loop)
      )
    )

    ;; If pipe was found, split into title, startDate, and optional endDate
    (if (i32.ge_s (local.get $pipe1_pos) (i32.const 0))
      (then
        (local.set $title_len (local.get $pipe1_pos))

        ;; Trim trailing spaces from title
        (block $trim_title
          (loop $trim_title_loop
            (if (i32.le_s (local.get $title_len) (i32.const 0))
              (then (br $trim_title))
            )
            (if (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (i32.sub (local.get $title_len) (i32.const 1)))) (i32.const 32))
              (then
                (local.set $title_len (i32.sub (local.get $title_len) (i32.const 1)))
                (br $trim_title_loop)
              )
            )
            (br $trim_title)
          )
        )

        ;; Calculate date start (pipe1_pos + 1)
        (local.set $date_start (i32.add (local.get $pipe1_pos) (i32.const 1)))

        ;; If pipe2 exists, date ends at pipe2; else at end of input
        (if (i32.ge_s (local.get $pipe2_pos) (i32.const 0))
          (then
            (local.set $date_len (i32.sub (local.get $pipe2_pos) (local.get $date_start)))
          )
          (else
            (local.set $date_len (i32.sub (local.get $in_len) (local.get $date_start)))
          )
        )

        ;; Trim leading spaces from date
        (block $trim_date_left
          (loop $trim_date_left_loop
            (if (i32.le_s (local.get $date_len) (i32.const 0))
              (then (br $trim_date_left))
            )
            (if (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (local.get $date_start))) (i32.const 32))
              (then
                (local.set $date_start (i32.add (local.get $date_start) (i32.const 1)))
                (local.set $date_len (i32.sub (local.get $date_len) (i32.const 1)))
                (br $trim_date_left_loop)
              )
            )
            (br $trim_date_left)
          )
        )

        ;; Trim trailing spaces from date
        (block $trim_date_right
          (loop $trim_date_right_loop
            (if (i32.le_s (local.get $date_len) (i32.const 0))
              (then (br $trim_date_right))
            )
            (if (i32.eq (i32.load8_u (i32.add (i32.add (local.get $in_ptr) (local.get $date_start)) (i32.sub (local.get $date_len) (i32.const 1)))) (i32.const 32))
              (then
                (local.set $date_len (i32.sub (local.get $date_len) (i32.const 1)))
                (br $trim_date_right_loop)
              )
            )
            (br $trim_date_right)
          )
        )

        ;; Copy prefix (59 bytes from 3000): {"api":"calendar","operation":"create","payload":{"title":"
        (memory.copy (i32.const 2048) (i32.const 3000) (i32.const 59))

        ;; Copy title (title_len bytes from in_ptr) to 2048 + 59 = 2107
        (memory.copy (i32.const 2107) (local.get $in_ptr) (local.get $title_len))
        (local.set $dest_ptr (i32.add (i32.const 2107) (local.get $title_len)))

        ;; Copy '","start":"' (11 bytes from 3400)
        (memory.copy (local.get $dest_ptr) (i32.const 3400) (i32.const 11))
        (local.set $dest_ptr (i32.add (local.get $dest_ptr) (i32.const 11)))

        ;; Copy date
        (memory.copy (local.get $dest_ptr) (i32.add (local.get $in_ptr) (local.get $date_start)) (local.get $date_len))
        (local.set $dest_ptr (i32.add (local.get $dest_ptr) (local.get $date_len)))

        ;; Copy '","startDate":"' (15 bytes from 3430)
        (memory.copy (local.get $dest_ptr) (i32.const 3430) (i32.const 15))
        (local.set $dest_ptr (i32.add (local.get $dest_ptr) (i32.const 15)))

        ;; Copy date again for startDate
        (memory.copy (local.get $dest_ptr) (i32.add (local.get $in_ptr) (local.get $date_start)) (local.get $date_len))
        (local.set $dest_ptr (i32.add (local.get $dest_ptr) (local.get $date_len)))

        ;; If pipe2 was present, append end and endDate
        (if (i32.ge_s (local.get $pipe2_pos) (i32.const 0))
          (then
            (local.set $end_start (i32.add (local.get $pipe2_pos) (i32.const 1)))
            (local.set $end_len (i32.sub (local.get $in_len) (local.get $end_start)))

            ;; Trim leading spaces from end
            (block $trim_end_left
              (loop $trim_end_left_loop
                (if (i32.le_s (local.get $end_len) (i32.const 0))
                  (then (br $trim_end_left))
                )
                (if (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (local.get $end_start))) (i32.const 32))
                  (then
                    (local.set $end_start (i32.add (local.get $end_start) (i32.const 1)))
                    (local.set $end_len (i32.sub (local.get $end_len) (i32.const 1)))
                    (br $trim_end_left_loop)
                  )
                )
                (br $trim_end_left)
              )
            )

            ;; Trim trailing spaces from end
            (block $trim_end_right
              (loop $trim_end_right_loop
                (if (i32.le_s (local.get $end_len) (i32.const 0))
                  (then (br $trim_end_right))
                )
                (if (i32.eq (i32.load8_u (i32.add (i32.add (local.get $in_ptr) (local.get $end_start)) (i32.sub (local.get $end_len) (i32.const 1)))) (i32.const 32))
                  (then
                    (local.set $end_len (i32.sub (local.get $end_len) (i32.const 1)))
                    (br $trim_end_right_loop)
                  )
                )
                (br $trim_end_right)
              )
            )

            (if (i32.gt_s (local.get $end_len) (i32.const 0))
              (then
                ;; Copy '","end":"' (9 bytes from 3470)
                (memory.copy (local.get $dest_ptr) (i32.const 3470) (i32.const 9))
                (local.set $dest_ptr (i32.add (local.get $dest_ptr) (i32.const 9)))

                ;; Copy end date
                (memory.copy (local.get $dest_ptr) (i32.add (local.get $in_ptr) (local.get $end_start)) (local.get $end_len))
                (local.set $dest_ptr (i32.add (local.get $dest_ptr) (local.get $end_len)))

                ;; Copy '","endDate":"' (13 bytes from 3500)
                (memory.copy (local.get $dest_ptr) (i32.const 3500) (i32.const 13))
                (local.set $dest_ptr (i32.add (local.get $dest_ptr) (i32.const 13)))

                ;; Copy end date again for endDate
                (memory.copy (local.get $dest_ptr) (i32.add (local.get $in_ptr) (local.get $end_start)) (local.get $end_len))
                (local.set $dest_ptr (i32.add (local.get $dest_ptr) (local.get $end_len)))
              )
            )
          )
        )

        ;; Copy suffix (3 bytes from 3100: '\"}}')
        (memory.copy (local.get $dest_ptr) (i32.const 3100) (i32.const 3))

        ;; Total request length = (dest_ptr + 3) - 2048
        (local.set $req_len (i32.sub (i32.add (local.get $dest_ptr) (i32.const 3)) (i32.const 2048)))

        (drop (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096)))
        (return (i32.const 0))
      )
    )

    ;; 5. Default: Create event using raw input text as title (59 bytes prefix + in_len + 3 bytes suffix = 62 + in_len)
    (memory.copy (i32.const 2048) (i32.const 3000) (i32.const 59))
    (memory.copy (i32.const 2107) (local.get $in_ptr) (local.get $in_len))
    (memory.copy (i32.add (i32.const 2107) (local.get $in_len)) (i32.const 3100) (i32.const 3))
    (local.set $req_len (i32.add (i32.const 62) (local.get $in_len)))

    (drop (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096)))
    (return (i32.const 0))
  )

  ;; Exported resume function called by Chattree when async call finishes
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (memory.copy
      (i32.const 1024)
      (local.get $res_ptr)
      (local.get $res_len)
    )
    (local.get $res_len)
  )
)
