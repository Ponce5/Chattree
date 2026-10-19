;; Hello Plugin — WebAssembly Text format (WAT) source
;;
;; Command: /hello <name>
;; Output:  Hello, <name>!
;;
;; Compile with:  wat2wasm plugin.wat -o plugin.wasm
;;
;; Memory layout:
;;   Offset 0:    Input written by Chattree (the user's text after /hello)
;;   Offset 1024: Output written by this plugin
;;
;; Protocol:
;;   Chattree calls: hello(inputPtr=0, inputLen=N) → outputLen
;;   Plugin reads input from [inputPtr..inputPtr+inputLen]
;;   Plugin writes output to [1024..1024+outputLen]
;;   Plugin returns outputLen

(module
  ;; Export 2 memory pages = 128 KB linear memory
  (memory (export "memory") 2)

  ;; Pre-load "Hello, " (7 bytes) at offset 1024
  (data (i32.const 1024) "Hello, ")

  ;; Exported function: (inputPtr: i32, inputLen: i32) -> outputLen: i32
  (func (export "hello") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $prefix_len i32)

    ;; "Hello, " has 7 bytes
    (local.set $prefix_len (i32.const 7))

    ;; Guard: if inputLen == 0, show usage message
    (if (i32.eqz (local.get $in_len))
      (then
        ;; Write "Hello! Usage: /hello <name>" at offset 1024
        (memory.copy
          (i32.const 1024)
          (i32.const 2048)
          (i32.const 27)
        )
        (return (i32.const 27))
      )
    )

    ;; Copy input after "Hello, " → offset 1024+7 = 1031
    (memory.copy
      (i32.add (i32.const 1024) (local.get $prefix_len))
      (local.get $in_ptr)
      (local.get $in_len)
    )

    ;; Write "!" after the input
    (i32.store8
      (i32.add
        (i32.add (i32.const 1024) (local.get $prefix_len))
        (local.get $in_len)
      )
      (i32.const 33)
    )

    ;; Return total output length: 7 (prefix) + inputLen + 1 (exclamation)
    (i32.add
      (i32.add (local.get $prefix_len) (local.get $in_len))
      (i32.const 1)
    )
  )

  ;; Fallback message stored at offset 2048
  (data (i32.const 2048) "Hello! Usage: /hello <name>")
)
