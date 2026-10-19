;; Official Chattree Echo Plugin
;;
;; Command: /echo <text>
;; Output:  Echo: <text>

(module
  (memory (export "memory") 2)

  ;; Pre-load prefix "Echo: " (6 bytes) at offset 1024
  (data (i32.const 1024) "Echo: ")

  (func (export "echo") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $prefix_len i32)
    (local.set $prefix_len (i32.const 6))

    (if (i32.eqz (local.get $in_len))
      (then
        (memory.copy
          (i32.const 1024)
          (i32.const 2048)
          (i32.const 21)
        )
        (return (i32.const 21))
      )
    )

    (memory.copy
      (i32.add (i32.const 1024) (local.get $prefix_len))
      (local.get $in_ptr)
      (local.get $in_len)
    )

    (i32.add (local.get $prefix_len) (local.get $in_len))
  )

  (data (i32.const 2048) "Usage: /echo <message>")
)
