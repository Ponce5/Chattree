;; Chattree Official Calendar Plugin — WebAssembly Text format (WAT)
;;
;; Primary command: /calendar <title> [| <ISO start date>]
;; Subcommands:    /calendar list
;;
;; Capabilities:
;;   - calendar.create
;;   - calendar.read
;;
;; Compilation:
;;   wat2wasm plugin.wat -o plugin.wasm
;;
;; Protocol:
;;   Offset 0:    Input string written by Chattree (user text or AI tool arguments)
;;   Offset 1024: Output string returned to chat
;;   Offset 2048: JSON request payload for chattree.host_call
;;   Offset 4096: JSON response payload from ChattreeHostApi

(module
  ;; Import the Host API function from Chattree runtime
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; Export 4 memory pages (256 KB linear memory)
  (memory (export "memory") 4)

  ;; Pre-load usage string at offset 1024 (68 bytes)
  (data (i32.const 1024) "Usage: /calendar <title> [| startDate] | /calendar list")

  ;; Pre-load create request prefix at offset 3000 (56 bytes):
  ;; {"api":"calendar","operation":"create","payload":{"title":"
  (data (i32.const 3000) "{\"api\":\"calendar\",\"operation\":\"create\",\"payload\":{\"title\":\"")

  ;; Pre-load request suffix at offset 3100 (3 bytes):
  ;; "}}
  (data (i32.const 3100) "\"}}")

  ;; Pre-load list request at offset 3200 (52 bytes):
  ;; {"api":"calendar","operation":"events","payload":{}}
  (data (i32.const 3200) "{\"api\":\"calendar\",\"operation\":\"events\",\"payload\":{}}")

  ;; Pre-load raw payload prefix at offset 3300 (46 bytes):
  ;; {"api":"calendar","operation":"create","payload":
  (data (i32.const 3300) "{\"api\":\"calendar\",\"operation\":\"create\",\"payload\":")

  ;; Pre-load raw payload suffix at offset 3380 (1 byte):
  ;; }
  (data (i32.const 3380) "}")

  ;; Pre-load startDate field separator at offset 3400 (16 bytes):
  ;; ","startDate":"
  (data (i32.const 3400) "\",\"startDate\":\"")

  ;; Main entrypoint: (inputPtr: i32, inputLen: i32) -> outputLen: i32
  (func (export "calendar_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $req_len i32)
    (local $prefix_len i32)
    (local $i i32)
    (local $pipe_pos i32)
    (local $title_len i32)
    (local $date_start i32)
    (local $date_len i32)
    (local $dest_ptr i32)

    ;; 1. If input is empty, automatically list all events!
    (if (i32.eqz (local.get $in_len))
      (then
        ;; Copy list request from offset 3200 to offset 2048 (52 bytes)
        (memory.copy (i32.const 2048) (i32.const 3200) (i32.const 52))
        ;; Call host_call(reqPtr=2048, reqLen=52, resPtr=4096, resMaxLen=4096)
        (drop (call $host_call (i32.const 2048) (i32.const 52) (i32.const 4096) (i32.const 4096)))
        ;; Return 0 to indicate asynchronous operation pending
        (return (i32.const 0))
      )
    )

    ;; 2. Check if input is "list" (4 bytes: 'l'=108, 'i'=105, 's'=115, 't'=116)
    (if (i32.eq (local.get $in_len) (i32.const 4))
      (then
        (if (i32.eq (i32.load8_u (local.get $in_ptr)) (i32.const 108))
          (then
            ;; Copy list request from offset 3200 to offset 2048 (52 bytes)
            (memory.copy (i32.const 2048) (i32.const 3200) (i32.const 52))
            ;; Call host_call(reqPtr=2048, reqLen=52, resPtr=4096, resMaxLen=4096)
            (drop (call $host_call (i32.const 2048) (i32.const 52) (i32.const 4096) (i32.const 4096)))
            ;; Return 0 to indicate asynchronous operation pending
            (return (i32.const 0))
          )
        )
      )
    )

    ;; 2.5 Check if input is JSON (starts with '{' = ASCII 123)
    (if (i32.eq (i32.load8_u (local.get $in_ptr)) (i32.const 123))
      (then
        ;; Check if it already has "api" at offset 1..5: "api" (34, 97, 112, 105)
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
            ;; Already formatted Host API request: forward directly
            (memory.copy (i32.const 2048) (local.get $in_ptr) (local.get $in_len))
            (drop (call $host_call (i32.const 2048) (local.get $in_len) (i32.const 4096) (i32.const 4096)))
            (return (i32.const 0))
          )
          (else
            ;; Raw JSON payload (e.g. {"title":"...","startDate":"..."}): wrap as payload
            ;; Copy prefix (46 bytes) from offset 3300: {"api":"calendar","operation":"create","payload":
            (memory.copy (i32.const 2048) (i32.const 3300) (i32.const 46))
            ;; Copy payload JSON after prefix
            (memory.copy (i32.const 2094) (local.get $in_ptr) (local.get $in_len))
            ;; Copy closing '}' (1 byte) from offset 3380
            (memory.copy
              (i32.add (i32.const 2094) (local.get $in_len))
              (i32.const 3380)
              (i32.const 1)
            )
            ;; Total length = 46 + in_len + 1 = 47 + in_len
            (local.set $req_len (i32.add (i32.const 47) (local.get $in_len)))
            (drop (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; 3. Check for pipe delimiter '|' (ASCII 124) separating title and startDate
    (local.set $pipe_pos (i32.const -1))
    (local.set $i (i32.const 0))

    (block $break_search
      (loop $search_loop
        (if (i32.ge_s (local.get $i) (local.get $in_len))
          (then (br $break_search))
        )
        (if (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (local.get $i))) (i32.const 124))
          (then
            (local.set $pipe_pos (local.get $i))
            (br $break_search)
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $search_loop)
      )
    )

    ;; If pipe was found, split into title and startDate
    (if (i32.ge_s (local.get $pipe_pos) (i32.const 0))
      (then
        (local.set $title_len (local.get $pipe_pos))

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

        ;; Calculate date start (pipe_pos + 1) and raw date length
        (local.set $date_start (i32.add (local.get $pipe_pos) (i32.const 1)))
        (local.set $date_len (i32.sub (local.get $in_len) (local.get $date_start)))

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

        ;; Copy prefix (56 bytes from 3000)
        (memory.copy (i32.const 2048) (i32.const 3000) (i32.const 56))

        ;; Copy title (title_len bytes from in_ptr)
        (memory.copy (i32.const 2104) (local.get $in_ptr) (local.get $title_len))

        ;; Copy separator (16 bytes from 3400: '\",\"startDate\":\"')
        (local.set $dest_ptr (i32.add (i32.const 2104) (local.get $title_len)))
        (memory.copy (local.get $dest_ptr) (i32.const 3400) (i32.const 16))

        ;; Copy date (date_len bytes from in_ptr + date_start)
        (local.set $dest_ptr (i32.add (local.get $dest_ptr) (i32.const 16)))
        (memory.copy (local.get $dest_ptr) (i32.add (local.get $in_ptr) (local.get $date_start)) (local.get $date_len))

        ;; Copy suffix (3 bytes from 3100: '\"}}')
        (local.set $dest_ptr (i32.add (local.get $dest_ptr) (local.get $date_len)))
        (memory.copy (local.get $dest_ptr) (i32.const 3100) (i32.const 3))

        ;; Total request length = (dest_ptr + 3) - 2048
        (local.set $req_len (i32.sub (i32.add (local.get $dest_ptr) (i32.const 3)) (i32.const 2048)))

        (drop (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096)))
        (return (i32.const 0))
      )
    )

    ;; 4. Default: Create event using raw input text as title
    (local.set $prefix_len (i32.const 56))

    ;; Copy prefix into request buffer at offset 2048
    (memory.copy (i32.const 2048) (i32.const 3000) (local.get $prefix_len))

    ;; Copy user input title after prefix: 2048 + 56
    (memory.copy
      (i32.add (i32.const 2048) (local.get $prefix_len))
      (local.get $in_ptr)
      (local.get $in_len)
    )

    ;; Copy suffix ("}}") after title: 2048 + 56 + in_len
    (memory.copy
      (i32.add (i32.add (i32.const 2048) (local.get $prefix_len)) (local.get $in_len))
      (i32.const 3100)
      (i32.const 3)
    )

    ;; Total request length = 56 + in_len + 3 = 59 + in_len
    (local.set $req_len (i32.add (i32.const 59) (local.get $in_len)))

    ;; Call host_call(reqPtr=2048, reqLen, resPtr=4096, resMaxLen=4096)
    (drop (call $host_call
      (i32.const 2048)
      (local.get $req_len)
      (i32.const 4096)
      (i32.const 4096)
    ))

    ;; Return 0 to signal async execution pending (Chattree will invoke resume)
    (i32.const 0)
  )

  ;; Exported resume function called by Chattree when async call finishes
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    ;; Copy response JSON from res_ptr directly to output offset 1024
    (memory.copy
      (i32.const 1024)
      (local.get $res_ptr)
      (local.get $res_len)
    )

    ;; Return output length
    (local.get $res_len)
  )
)
