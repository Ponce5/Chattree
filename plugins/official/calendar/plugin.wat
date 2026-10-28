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
;;   Offset 1024:  Output string returned to chat (formatted Markdown)
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

  ;; --- Markdown Design Templates ---
  ;; Header + Title label (41 bytes): "### 📅 Evento agendado\n\n> **Título:** "
  (data (i32.const 5000) "### \f0\9f\93\85 Evento agendado\n\n> **T\c3\adtulo:** ")

  ;; Start date label (15 bytes): "\n> **Inicio:** "
  (data (i32.const 5050) "\n> **Inicio:** ")

  ;; End date label (12 bytes): "\n> **Fin:** "
  (data (i32.const 5070) "\n> **Fin:** ")

  ;; Footer note (44 bytes): "\n\n*Agendado correctamente en tu calendario.*"
  (data (i32.const 5090) "\n\n*Agendado correctamente en tu calendario.*")

  ;; Empty list response (68 bytes): "### 📅 Calendario\n\nNo tienes eventos programados en tu calendario."
  (data (i32.const 5200) "### \f0\9f\93\85 Calendario\n\nNo tienes eventos programados en tu calendario.")

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
            ;; Check if operation is "list" (byte 31 is 'l'=108, byte 32 is 'i'=105)
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
                    (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (i32.const 11))) (i32.const 108))
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
            (memory.copy (i32.const 2048) (i32.const 3300) (i32.const 49))
            (memory.copy (i32.const 2097) (local.get $in_ptr) (local.get $in_len))
            (memory.copy
              (i32.add (i32.const 2097) (local.get $in_len))
              (i32.const 3380)
              (i32.const 1)
            )
            (local.set $req_len (i32.add (i32.const 50) (local.get $in_len)))
            (drop (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; 4. Check for pipe delimiters '|' (ASCII 124)
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

        ;; Copy prefix (59 bytes from 3000)
        (memory.copy (i32.const 2048) (i32.const 3000) (i32.const 59))
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
        (local.set $req_len (i32.sub (i32.add (local.get $dest_ptr) (i32.const 3)) (i32.const 2048)))

        (drop (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096)))
        (return (i32.const 0))
      )
    )

    ;; 5. Default: Create event using raw input text as title
    (memory.copy (i32.const 2048) (i32.const 3000) (i32.const 59))
    (memory.copy (i32.const 2107) (local.get $in_ptr) (local.get $in_len))
    (memory.copy (i32.add (i32.const 2107) (local.get $in_len)) (i32.const 3100) (i32.const 3))
    (local.set $req_len (i32.add (i32.const 62) (local.get $in_len)))

    (drop (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096)))
    (return (i32.const 0))
  )

  ;; Exported resume function called by Chattree when async call finishes
  ;; Formats the response as a clean Markdown card design!
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $i i32)
    (local $is_created i32)
    (local $title_ptr i32)
    (local $title_len i32)
    (local $start_ptr i32)
    (local $start_len i32)
    (local $end_ptr i32)
    (local $end_len i32)
    (local $dest i32)
    (local $limit i32)
    (local $j i32)

    (local.set $is_created (i32.const 0))
    (local.set $title_ptr (i32.const 0))
    (local.set $title_len (i32.const 0))
    (local.set $start_ptr (i32.const 0))
    (local.set $start_len (i32.const 0))
    (local.set $end_ptr (i32.const 0))
    (local.set $end_len (i32.const 0))

    ;; Search for "created" in response JSON: 'c'=99, 'r'=114, 'e'=101, 'a'=97, 't'=116, 'e'=101, 'd'=100
    (if (i32.gt_s (local.get $res_len) (i32.const 10))
      (then
        (local.set $limit (i32.sub (local.get $res_len) (i32.const 7)))
        (local.set $i (i32.const 0))
        (block $break_created
          (loop $loop_created
            (if (i32.ge_s (local.get $i) (local.get $limit))
              (then (br $break_created))
            )
            (if (i32.and
                  (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (local.get $i))) (i32.const 99))  ;; 'c'
                  (i32.and
                    (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 1)))) (i32.const 114)) ;; 'r'
                    (i32.and
                      (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 2)))) (i32.const 101)) ;; 'e'
                      (i32.and
                        (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 3)))) (i32.const 97))  ;; 'a'
                        (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 4)))) (i32.const 116)) ;; 't'
                      )
                    )
                  )
                )
              (then
                (local.set $is_created (i32.const 1))
                (br $break_created)
              )
            )
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $loop_created)
          )
        )
      )
    )

    ;; If this was an event creation, format beautiful Markdown card!
    (if (local.get $is_created)
      (then
        ;; 1. Search for "title":" (9 bytes: 34, 116, 105, 116, 108, 101, 34, 58, 34)
        (local.set $limit (i32.sub (local.get $res_len) (i32.const 10)))
        (local.set $i (i32.const 0))
        (block $break_title
          (loop $loop_title
            (if (i32.ge_s (local.get $i) (local.get $limit))
              (then (br $break_title))
            )
            (if (i32.and
                  (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (local.get $i))) (i32.const 34))
                  (i32.and
                    (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 1)))) (i32.const 116)) ;; 't'
                    (i32.and
                      (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 2)))) (i32.const 105)) ;; 'i'
                      (i32.and
                        (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 3)))) (i32.const 116)) ;; 't'
                        (i32.and
                          (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 4)))) (i32.const 108)) ;; 'l'
                          (i32.and
                            (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 5)))) (i32.const 101)) ;; 'e'
                            (i32.and
                              (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 6)))) (i32.const 34))  ;; '"'
                              (i32.and
                                (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 7)))) (i32.const 58))  ;; ':'
                                (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 8)))) (i32.const 34))  ;; '"'
                              )
                            )
                          )
                        )
                      )
                    )
                  )
                )
              (then
                (local.set $title_ptr (i32.add (i32.add (local.get $res_ptr) (local.get $i)) (i32.const 9)))
                ;; Find closing '"'
                (local.set $j (i32.const 0))
                (block $break_title_len
                  (loop $loop_title_len
                    (if (i32.ge_s (local.get $j) (i32.const 200)) (then (br $break_title_len)))
                    (if (i32.eq (i32.load8_u (i32.add (local.get $title_ptr) (local.get $j))) (i32.const 34))
                      (then
                        (local.set $title_len (local.get $j))
                        (br $break_title_len)
                      )
                    )
                    (local.set $j (i32.add (local.get $j) (i32.const 1)))
                    (br $loop_title_len)
                  )
                )
                (br $break_title)
              )
            )
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $loop_title)
          )
        )

        ;; 2. Search for "start":" (9 bytes: 34, 115, 116, 97, 114, 116, 34, 58, 34)
        (local.set $i (i32.const 0))
        (block $break_start
          (loop $loop_start
            (if (i32.ge_s (local.get $i) (local.get $limit))
              (then (br $break_start))
            )
            (if (i32.and
                  (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (local.get $i))) (i32.const 34))
                  (i32.and
                    (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 1)))) (i32.const 115)) ;; 's'
                    (i32.and
                      (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 2)))) (i32.const 116)) ;; 't'
                      (i32.and
                        (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 3)))) (i32.const 97))  ;; 'a'
                        (i32.and
                          (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 4)))) (i32.const 114)) ;; 'r'
                          (i32.and
                            (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 5)))) (i32.const 116)) ;; 't'
                            (i32.and
                              (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 6)))) (i32.const 34))
                              (i32.and
                                (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 7)))) (i32.const 58))
                                (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 8)))) (i32.const 34))
                              )
                            )
                          )
                        )
                      )
                    )
                  )
                )
              (then
                (local.set $start_ptr (i32.add (i32.add (local.get $res_ptr) (local.get $i)) (i32.const 9)))
                ;; Find closing '"'
                (local.set $j (i32.const 0))
                (block $break_start_len
                  (loop $loop_start_len
                    (if (i32.ge_s (local.get $j) (i32.const 40)) (then (br $break_start_len)))
                    (if (i32.eq (i32.load8_u (i32.add (local.get $start_ptr) (local.get $j))) (i32.const 34))
                      (then
                        (local.set $start_len (local.get $j))
                        (br $break_start_len)
                      )
                    )
                    (local.set $j (i32.add (local.get $j) (i32.const 1)))
                    (br $loop_start_len)
                  )
                )
                (br $break_start)
              )
            )
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $loop_start)
          )
        )

        ;; 3. Search for "end":" (7 bytes: 34, 101, 110, 100, 34, 58, 34)
        (local.set $i (i32.const 0))
        (block $break_end
          (loop $loop_end
            (if (i32.ge_s (local.get $i) (local.get $limit))
              (then (br $break_end))
            )
            (if (i32.and
                  (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (local.get $i))) (i32.const 34))
                  (i32.and
                    (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 1)))) (i32.const 101)) ;; 'e'
                    (i32.and
                      (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 2)))) (i32.const 110)) ;; 'n'
                      (i32.and
                        (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 3)))) (i32.const 100)) ;; 'd'
                        (i32.and
                          (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 4)))) (i32.const 34))
                          (i32.and
                            (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 5)))) (i32.const 58))
                            (i32.eq (i32.load8_u (i32.add (local.get $res_ptr) (i32.add (local.get $i) (i32.const 6)))) (i32.const 34))
                          )
                        )
                      )
                    )
                  )
                )
              (then
                (local.set $end_ptr (i32.add (i32.add (local.get $res_ptr) (local.get $i)) (i32.const 7)))
                ;; Find closing '"'
                (local.set $j (i32.const 0))
                (block $break_end_len
                  (loop $loop_end_len
                    (if (i32.ge_s (local.get $j) (i32.const 40)) (then (br $break_end_len)))
                    (if (i32.eq (i32.load8_u (i32.add (local.get $end_ptr) (local.get $j))) (i32.const 34))
                      (then
                        (local.set $end_len (local.get $j))
                        (br $break_end_len)
                      )
                    )
                    (local.set $j (i32.add (local.get $j) (i32.const 1)))
                    (br $loop_end_len)
                  )
                )
                (br $break_end)
              )
            )
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $loop_end)
          )
        )

        ;; Clean up ISO formatting for start (replace 'T' with space, truncate to 16 or 19 chars)
        (if (i32.ge_s (local.get $start_len) (i32.const 16))
          (then
            (if (i32.eq (i32.load8_u (i32.add (local.get $start_ptr) (i32.const 10))) (i32.const 84)) ;; 'T'
              (then
                (i32.store8 (i32.add (local.get $start_ptr) (i32.const 10)) (i32.const 32)) ;; ' '
              )
            )
            ;; If length is 19 or 23, truncate to 16 ("YYYY-MM-DD HH:mm") for clean display
            (if (i32.ge_s (local.get $start_len) (i32.const 19))
              (then (local.set $start_len (i32.const 16)))
            )
          )
        )

        ;; Clean up ISO formatting for end
        (if (i32.ge_s (local.get $end_len) (i32.const 16))
          (then
            (if (i32.eq (i32.load8_u (i32.add (local.get $end_ptr) (i32.const 10))) (i32.const 84)) ;; 'T'
              (then
                (i32.store8 (i32.add (local.get $end_ptr) (i32.const 10)) (i32.const 32)) ;; ' '
              )
            )
            (if (i32.ge_s (local.get $end_len) (i32.const 19))
              (then (local.set $end_len (i32.const 16)))
            )
          )
        )

        ;; Assemble Markdown Card at offset 1024
        ;; Step 1: Copy header + title label (41 bytes from 5000)
        (local.set $dest (i32.const 1024))
        (memory.copy (local.get $dest) (i32.const 5000) (i32.const 41))
        (local.set $dest (i32.add (local.get $dest) (i32.const 41)))

        ;; Step 2: Copy title
        (if (i32.gt_s (local.get $title_len) (i32.const 0))
          (then
            (memory.copy (local.get $dest) (local.get $title_ptr) (local.get $title_len))
            (local.set $dest (i32.add (local.get $dest) (local.get $title_len)))
          )
        )

        ;; Step 3: Copy start date label (15 bytes from 5050) + start date
        (if (i32.gt_s (local.get $start_len) (i32.const 0))
          (then
            (memory.copy (local.get $dest) (i32.const 5050) (i32.const 15))
            (local.set $dest (i32.add (local.get $dest) (i32.const 15)))
            (memory.copy (local.get $dest) (local.get $start_ptr) (local.get $start_len))
            (local.set $dest (i32.add (local.get $dest) (local.get $start_len)))
          )
        )

        ;; Step 4: Copy end date label (12 bytes from 5070) + end date
        (if (i32.gt_s (local.get $end_len) (i32.const 0))
          (then
            (memory.copy (local.get $dest) (i32.const 5070) (i32.const 12))
            (local.set $dest (i32.add (local.get $dest) (i32.const 12)))
            (memory.copy (local.get $dest) (local.get $end_ptr) (local.get $end_len))
            (local.set $dest (i32.add (local.get $dest) (local.get $end_len)))
          )
        )

        ;; Step 5: Copy footer note (44 bytes from 5090)
        (memory.copy (local.get $dest) (i32.const 5090) (i32.const 44))
        (local.set $dest (i32.add (local.get $dest) (i32.const 44)))

        ;; Return total output length: dest - 1024
        (return (i32.sub (local.get $dest) (i32.const 1024)))
      )
    )

    ;; Fallback: copy response JSON directly to offset 1024
    (memory.copy
      (i32.const 1024)
      (local.get $res_ptr)
      (local.get $res_len)
    )
    (local.get $res_len)
  )
)
