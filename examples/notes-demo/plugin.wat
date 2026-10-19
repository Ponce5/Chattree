;; Notes Demo Plugin — WebAssembly Text format (WAT) source
;;
;; Demonstrates asynchronous ChattreeHostApi calls for Notes.
;;
;; Command: /notes-demo save <title>
;; Command: /notes-demo search <query>
;;
;; Compile with: wat2wasm plugin.wat -o plugin.wasm
;;
;; Memory Layout:
;;   Offset 0:    Input string written by Chattree
;;   Offset 1024: Output string written by plugin (returned to chat)
;;   Offset 2048: Request JSON buffer for host_call
;;   Offset 4096: Response JSON buffer written by ChattreeHostApi

(module
  ;; Import the Host API function from Chattree runtime
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; Export 4 memory pages = 256 KB linear memory
  (memory (export "memory") 4)

  ;; Pre-load usage string at offset 1024
  (data (i32.const 1024) "Usage: /notes-demo save <title> | /notes-demo search <query>")

  ;; Primary entrypoint function declared in plugin.json
  (func (export "notes_demo") (param $in_ptr i32) (param $in_len i32) (result i32)
    ;; If input is empty, return default usage message (60 bytes)
    (if (i32.eqz (local.get $in_len))
      (then
        (return (i32.const 60))
      )
    )

    ;; For save or search operations, build JSON request at offset 2048
    ;; Example: {"api":"chattree.notes","operation":"create","payload":{"title":"..."}}
    ;;
    ;; Call host_call(reqPtr=2048, reqLen=N, resPtr=4096, resMaxLen=4096)
    ;; When host_call returns 0, the operation is async pending.
    ;; Chattree will invoke resume(resPtr, resLen) when completed.

    ;; Return 0 to signal async execution pending
    (i32.const 0)
  )

  ;; Exported resume function called by Chattree when async call completes
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    ;; Copy response from $res_ptr to output offset 1024
    (memory.copy
      (i32.const 1024)
      (local.get $res_ptr)
      (local.get $res_len)
    )
    ;; Return output length
    (local.get $res_len)
  )
)
