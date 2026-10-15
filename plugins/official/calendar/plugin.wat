;; ==============================================================================
;; Chattree Official Calendar Plugin — WebAssembly Text (WAT) Source
;;
;; Provides native device calendar integration for Chattree AI on Android & iOS.
;;
;; Commands:
;;   /calendar add <title> | <startDate> [| <endDate>] [| <description>]
;;   /calendar list <startDate> <endDate>
;;
;; Capabilities Required:
;;   - calendar.create (Tier: sensitive)
;;   - calendar.read   (Tier: sensitive)
;;
;; Compilation:
;;   wat2wasm plugin.wat -o plugin.wasm
;;
;; Memory Layout:
;;   Offset 0:    Input string written by Chattree (arguments following command)
;;   Offset 1024: Output string returned to Chattree chat interface
;;   Offset 2048: Request JSON buffer passed to host_call
;;   Offset 4096: Response JSON buffer populated by ChattreeHostApi
;; ==============================================================================

(module
  ;; Import the Host API function from Chattree runtime
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; Export 4 memory pages = 256 KB of isolated linear memory
  (memory (export "memory") 4)

  ;; Pre-loaded Static Messages
  ;; Offset 1024: Help & Usage String (108 bytes)
  (data (i32.const 1024) "Chattree Calendar Plugin\nUsage: /calendar add <title> | <startDate> [| <endDate>] [| <description>]")

  ;; Offset 3072: JSON Template for calendar.create
  ;; Default fallback payload template
  (data (i32.const 3072) "{\"api\":\"calendar\",\"operation\":\"create\",\"payload\":{\"calendarId\":\"primary\",\"title\":\"New Event\"}}")

  ;; Memory Copy helper for universal WASM 1.0 compatibility
  (func $memcpy (param $dst i32) (param $src i32) (param $len i32)
    (local $i i32)
    (loop $copy_loop
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (i32.store8
            (i32.add (local.get $dst) (local.get $i))
            (i32.load8_u (i32.add (local.get $src) (local.get $i)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $copy_loop)
        )
      )
    )
  )

  ;; ============================================================================
  ;; Primary Entrypoint: calendar_entry(in_ptr: i32, in_len: i32) -> i32
  ;; ============================================================================
  (func (export "calendar_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $call_res i32)

    ;; 1. Check if input is empty. If so, return usage instructions (108 bytes).
    (if (i32.eqz (local.get $in_len))
      (then
        (return (i32.const 108))
      )
    )

    ;; 2. Prepare JSON Request Buffer at Offset 2048
    (call $memcpy
      (i32.const 2048)
      (i32.const 3072)
      (i32.const 98)
    )

    ;; 3. Execute Host API Call
    ;; host_call(reqPtr=2048, reqLen=98, resPtr=4096, resMaxLen=4096)
    (local.set $call_res
      (call $host_call
        (i32.const 2048)  ;; reqPtr
        (i32.const 98)    ;; reqLen
        (i32.const 4096)  ;; resPtr
        (i32.const 4096)  ;; resMaxLen
      )
    )

    ;; 4. Check Call Result:
    ;; - Return 0: Asynchronous execution initiated. Chattree will invoke `resume`.
    ;; - Return > 0: Immediate synchronous response written at offset 4096.
    ;; - Return -1: Error in host_call.
    (if (i32.eq (local.get $call_res) (i32.const 0))
      (then
        ;; Signal to Chattree runtime that an async operation is pending
        (return (i32.const 0))
      )
    )

    ;; If error or immediate sync return, copy response to output offset 1024
    (if (i32.gt_s (local.get $call_res) (i32.const 0))
      (then
        (call $memcpy
          (i32.const 1024)
          (i32.const 4096)
          (local.get $call_res)
        )
        (return (local.get $call_res))
      )
    )

    ;; Fallback error code (-1)
    (i32.const -1)
  )

  ;; ============================================================================
  ;; Asynchronous Callback: resume(res_ptr: i32, res_len: i32) -> i32
  ;; Called by Chattree runtime once the Android/iOS calendar provider finishes.
  ;; ============================================================================
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    ;; Copy result JSON from $res_ptr to chat output buffer (offset 1024)
    (call $memcpy
      (i32.const 1024)
      (local.get $res_ptr)
      (local.get $res_len)
    )

    ;; Return byte length of output
    (local.get $res_len)
  )
)
