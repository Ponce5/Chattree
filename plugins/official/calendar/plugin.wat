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
;;
;; Permission Flow (FIXED):
;;   Step 1 — calendar_entry is called by Chattree.
;;            Plugin writes a permission-request JSON to offset 2048 and calls
;;            host_call. host_call returns 0 → async. Execution suspends.
;;   Step 2 — User taps "Allow" in the native permission dialog.
;;            Chattree runtime invokes resume(resPtr, resLen) with the
;;            permission result JSON: {"granted":true} or {"granted":false}.
;;   Step 3 — resume inspects the first byte of the response:
;;            • If byte 11 == 't' (i.e. "granted":true)  → proceed to create event
;;              by issuing a second host_call for calendar.create.
;;            • Otherwise ("granted":false) → write "Permission denied" message
;;              to output buffer and return its length.
;;   Step 4 — The calendar create host_call returns 0 → async again.
;;            Chattree calls resume a second time with the event-creation result.
;;            resume copies that result to the output buffer and returns.
;;
;; State is tracked via a 1-byte flag at Offset 512:
;;   0x00 = awaiting permission grant
;;   0x01 = permission granted, awaiting calendar create result
;; ==============================================================================

(module
  ;; Import the Host API function from Chattree runtime
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; Export 4 memory pages = 256 KB of isolated linear memory
  (memory (export "memory") 4)

  ;; ---------------------------------------------------------------------------
  ;; Static data segments
  ;; ---------------------------------------------------------------------------

  ;; Offset 512: State byte (initialised to 0 = awaiting permission)
  (data (i32.const 512) "\00")

  ;; Offset 1024: Help & Usage string (108 bytes)
  (data (i32.const 1024) "Chattree Calendar Plugin\nUsage: /calendar add <title> | <startDate> [| <endDate>] [| <description>]")

  ;; Offset 1200: "Permission denied by user." (26 bytes)
  (data (i32.const 1200) "Permission denied by user.")

  ;; Offset 2048: Permission-request JSON (97 bytes)
  ;;   {"api":"permissions","operation":"request","payload":{"capability":"calendar.create"}}
  (data (i32.const 2048) "{\"api\":\"permissions\",\"operation\":\"request\",\"payload\":{\"capability\":\"calendar.create\"}}")

  ;; Offset 3072: Calendar-create JSON template (215 bytes)
  (data (i32.const 3072) "{\"api\":\"calendar\",\"operation\":\"create\",\"payload\":{\"calendarId\":\"primary\",\"title\":\"Evento Chattree\",\"startDate\":\"2026-10-15T15:00:00.000Z\",\"endDate\":\"2026-10-15T16:00:00.000Z\",\"description\":\"Creado por Chattree AI\"}}")

  ;; ---------------------------------------------------------------------------
  ;; $memcpy — byte-by-byte memory copy (WASM 1.0 compatible)
  ;; ---------------------------------------------------------------------------
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
  ;;
  ;; Called by Chattree when the user invokes /calendar (or an AI tool call).
  ;; This step ONLY issues a permission request — it does NOT touch the calendar.
  ;; ============================================================================
  (func (export "calendar_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $call_res i32)

    ;; 1. If no arguments provided, return usage instructions.
    (if (i32.eqz (local.get $in_len))
      (then
        (return (i32.const 108))
      )
    )

    ;; 2. Reset state flag to 0x00 (awaiting permission).
    (i32.store8 (i32.const 512) (i32.const 0))

    ;; 3. Issue permission-request host_call.
    ;;    JSON at offset 2048, length 86 bytes.
    ;;    host_call(reqPtr=2048, reqLen=86, resPtr=4096, resMaxLen=4096)
    (local.set $call_res
      (call $host_call
        (i32.const 2048)  ;; reqPtr  — permission request JSON
        (i32.const 86)    ;; reqLen
        (i32.const 4096)  ;; resPtr  — runtime writes result here
        (i32.const 4096)  ;; resMaxLen
      )
    )

    ;; 4. host_call returns 0 → async (expected: native OS dialog shown).
    ;;    Chattree will call resume() once the user responds.
    (if (i32.eq (local.get $call_res) (i32.const 0))
      (then
        (return (i32.const 0))
      )
    )

    ;; Unexpected synchronous error from host_call — surface to chat.
    (i32.const -1)
  )

  ;; ============================================================================
  ;; Async Callback: resume(res_ptr: i32, res_len: i32) -> i32
  ;;
  ;; Chattree calls this function once an async host_call completes.
  ;; State machine:
  ;;   state == 0 → we just got the permission response; check if granted.
  ;;   state == 1 → we just got the calendar-create response; forward to output.
  ;; ============================================================================
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $state i32)
    (local $call_res i32)

    ;; Read current state from offset 512.
    (local.set $state (i32.load8_u (i32.const 512)))

    ;; -------------------------------------------------------------------
    ;; STATE 0 — Permission response arrived.
    ;; Inspect byte at res_ptr + 11:
    ;;   In {"granted":true}  → byte 11 = 't' (0x74)
    ;;   In {"granted":false} → byte 11 = 'f' (0x66)
    ;; -------------------------------------------------------------------
    (if (i32.eq (local.get $state) (i32.const 0))
      (then
        ;; Check the 12th byte of the JSON payload (index 11).
        (if (i32.eq
              (i32.load8_u (i32.add (local.get $res_ptr) (i32.const 11)))
              (i32.const 116)  ;; 't' = 0x74 = 116 decimal
            )
          (then
            ;; Permission GRANTED — advance state to 1 and issue calendar.create
            (i32.store8 (i32.const 512) (i32.const 1))

            ;; Copy calendar-create JSON template to request buffer (offset 2048)
            (call $memcpy
              (i32.const 2048)  ;; dst
              (i32.const 3072)  ;; src — calendar JSON template
              (i32.const 215)   ;; len
            )

            ;; Issue calendar create host_call
            ;; host_call(reqPtr=2048, reqLen=215, resPtr=4096, resMaxLen=4096)
            (local.set $call_res
              (call $host_call
                (i32.const 2048)
                (i32.const 215)
                (i32.const 4096)
                (i32.const 4096)
              )
            )

            ;; Async → return 0, Chattree will call resume() again (state=1)
            (if (i32.eq (local.get $call_res) (i32.const 0))
              (then
                (return (i32.const 0))
              )
            )

            ;; Sync result available immediately — copy and return
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

            (return (i32.const -1))
          )
          (else
            ;; Permission DENIED — write "Permission denied by user." to output
            ;; The string is 26 bytes at offset 1200. Copy to output at 1024.
            (call $memcpy
              (i32.const 1024)
              (i32.const 1200)
              (i32.const 26)
            )
            (return (i32.const 26))
          )
        )

        ;; Unreachable — satisfy WASM type checker
        (i32.const -1)
      )
    )

    ;; -------------------------------------------------------------------
    ;; STATE 1 — Calendar create response arrived.
    ;; Forward result JSON from res_ptr to chat output buffer (offset 1024).
    ;; -------------------------------------------------------------------
    (if (i32.eq (local.get $state) (i32.const 1))
      (then
        (call $memcpy
          (i32.const 1024)
          (local.get $res_ptr)
          (local.get $res_len)
        )
        (return (local.get $res_len))
      )
    )

    ;; Unknown state — return error
    (i32.const -1)
  )
)
