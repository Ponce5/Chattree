;; Chattree Plugin Starter Template — WebAssembly Text format (WAT)
;;
;; Primary command: /starter <message>
;; Returns: "Starter Plugin says: <message>"
;;
;; Compilation:
;;   wat2wasm src/plugin.wat -o plugin.wasm
;;
;; Protocol:
;;   Input: UTF-8 string written by Chattree at memory offset 0
;;   Output: UTF-8 string written by plugin starting at memory offset 1024
;;   Return: i32 byte length of the response written to offset 1024

(module
  ;; Export 2 memory pages (128 KB total linear memory)
  (memory (export "memory") 2)

  ;; Pre-load greeting prefix at offset 1024 (21 bytes)
  (data (i32.const 1024) "Starter Plugin says: ")

  ;; Exported entrypoint matching "entrypoint" in plugin.json
  (func (export "starter_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $prefix_len i32)
    (local.set $prefix_len (i32.const 21))

    ;; If input is empty, return default welcome message
    (if (i32.eqz (local.get $in_len))
      (then
        ;; Pre-loaded message at offset 2048: "Hello from Chattree Plugin Template!" (36 bytes)
        (memory.copy
          (i32.const 1024)
          (i32.const 2048)
          (i32.const 36)
        )
        (return (i32.const 36))
      )
    )

    ;; Copy input string right after the prefix at offset (1024 + 21)
    (memory.copy
      (i32.add (i32.const 1024) (local.get $prefix_len))
      (local.get $in_ptr)
      (local.get $in_len)
    )

    ;; Return total output length: prefix_len + in_len
    (i32.add (local.get $prefix_len) (local.get $in_len))
  )

  ;; Default welcome message stored at offset 2048
  (data (i32.const 2048) "Hello from Chattree Plugin Template!")
)
