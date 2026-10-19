;; Chattree Official Calendar Plugin — WebAssembly Text format (WAT)
;;
;; Primary command: /calendar <title>
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

  ;; Pre-load usage string at offset 1024 (58 bytes)
  (data (i32.const 1024) "Usage: /calendar <event title> | /calendar list")

  ;; Pre-load create request prefix at offset 3000 (48 bytes):
  ;; {"api":"calendar","operation":"create","payload":{"title":"
  (data (i32.const 3000) "{\"api\":\"calendar\",\"operation\":\"create\",\"payload\":{\"title\":\"")

  ;; Pre-load request suffix at offset 3100 (3 bytes):
  ;; "}}
  (data (i32.const 3100) "\"}}")

  ;; Pre-load list request at offset 3200 (46 bytes):
  ;; {"api":"calendar","operation":"events","payload":{}}
  (data (i32.const 3200) "{\"api\":\"calendar\",\"operation\":\"events\",\"payload\":{}}")

  ;; Main entrypoint: (inputPtr: i32, inputLen: i32) -> outputLen: i32
  (func (export "calendar_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $req_len i32)
    (local $prefix_len i32)

    ;; 1. Check if input is empty
    (if (i32.eqz (local.get $in_len))
      (then
        ;; Return default usage string (47 bytes)
        (return (i32.const 47))
      )
    )

    ;; 2. Check if input is "list" (4 bytes: 'l'=108, 'i'=105, 's'=115, 't'=116)
    (if (i32.eq (local.get $in_len) (i32.const 4))
      (then
        (if (i32.eq (i32.load8_u (local.get $in_ptr)) (i32.const 108))
          (then
            ;; Copy list request from offset 3200 to offset 2048 (46 bytes)
            (memory.copy (i32.const 2048) (i32.const 3200) (i32.const 46))
            ;; Call host_call(reqPtr=2048, reqLen=46, resPtr=4096, resMaxLen=4096)
            (drop (call $host_call (i32.const 2048) (i32.const 46) (i32.const 4096) (i32.const 4096)))
            ;; Return 0 to indicate asynchronous operation pending
            (return (i32.const 0))
          )
        )
      )
    )

    ;; 2.5 Check if input is a direct JSON Host API request (starts with '{' = ASCII 123)
    (if (i32.eq (i32.load8_u (local.get $in_ptr)) (i32.const 123))
      (then
        ;; Copy raw JSON request into request buffer at offset 2048
        (memory.copy (i32.const 2048) (local.get $in_ptr) (local.get $in_len))
        ;; Call host_call(reqPtr=2048, reqLen=in_len, resPtr=4096, resMaxLen=4096)
        (drop (call $host_call (i32.const 2048) (local.get $in_len) (i32.const 4096) (i32.const 4096)))
        ;; Return 0 to indicate asynchronous operation pending
        (return (i32.const 0))
      )
    )

    ;; 3. Default: Create event using input text as title
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
