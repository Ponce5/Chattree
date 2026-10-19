;; Chattree Official OpenMark Plugin — WebAssembly Text format (WAT)
;;
;; Command: /openmark <topic>
;; Aliases: /om, /slide, /carousel
;;
;; Architecture:
;;   Input at offset 0 (UTF-8 string)
;;   Output written to offset 1024
;;   Pre-loaded templates in higher memory offsets
;;
;; Compilation:
;;   wat2wasm plugin.wat -o plugin.wasm

(module
  ;; Memory export: 4 pages (256 KB)
  (memory (export "memory") 4)

  ;; Pre-load Help String at offset 8000 (length 275 bytes)
  (data (i32.const 8000)
    "### \f0\9f\8e\a8 OpenMark Studio v1.0.0\n*Code-First Presentation & Carousel Studio para Chattree.*\n\n**Uso:**\n`/openmark <tema o idea>`\n\n**Ejemplos:**\n\e2\80\a2 `/openmark 3 Estrategias de Crecimiento`\n\e2\80\a2 `/openmark Inteligencia Artificial en 2026`\n\e2\80\a2 `/openmark Habitos para alta productividad`\n"
  )

  ;; Pre-load Header & Image URL prefix at offset 9000 (182 bytes)
  (data (i32.const 9000)
    "### \f0\9f\8e\a8 OpenMark Studio \e2\80\94 Slide Canvas (1080x1080)\n\n![OpenMark Slide](https://image.pollinations.ai/prompt/Minimalist%20infographic%20presentation%20slide%20dark%20mode%20topic%20"
  )

  ;; Pre-load Image URL query suffix & Middle text at offset 9500 (86 bytes)
  (data (i32.const 9500)
    "?width=1080&height=1080&nologo=true)\n\n---\n**Estructura del Slide:**\n\e2\80\a2 **Concepto**: "
  )

  ;; Pre-load Footer text at offset 9800 (184 bytes)
  (data (i32.const 9800)
    "\n\e2\80\a2 **Formato**: 1080x1080 px (Square Carousel)\n\e2\80\a2 **Paleta**: Dark Mode & Neon Gradient (OpenMark Engine)\n\e2\80\a2 **Accion**: Comparte tu tarjeta en redes o guardala en tu dispositivo.\n"
  )

  ;; Main entrypoint: (inputPtr: i32, inputLen: i32) -> outputLen: i32
  (func (export "openmark_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $out_ptr i32)
    (local $i i32)
    (local $ch i32)

    ;; 1. If input is empty (in_len == 0), return the help guide
    (if (i32.eqz (local.get $in_len))
      (then
        (memory.copy (i32.const 1024) (i32.const 8000) (i32.const 283))
        (return (i32.const 283))
      )
    )

    ;; 2. Start building output at offset 1024
    (local.set $out_ptr (i32.const 1024))

    ;; Copy Header + Image Prefix (182 bytes) from 9000 to out_ptr
    (memory.copy (local.get $out_ptr) (i32.const 9000) (i32.const 182))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 182)))

    ;; Copy topic into Image URL with spaces replaced by %20
    (local.set $i (i32.const 0))
    (loop $url_loop
      (if (i32.lt_u (local.get $i) (local.get $in_len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $in_ptr) (local.get $i))))
          ;; If space (ASCII 32), write "%20" (3 bytes)
          (if (i32.eq (local.get $ch) (i32.const 32))
            (then
              (i32.store8 (local.get $out_ptr) (i32.const 37)) ;; '%'
              (i32.store8 (i32.add (local.get $out_ptr) (i32.const 1)) (i32.const 50)) ;; '2'
              (i32.store8 (i32.add (local.get $out_ptr) (i32.const 2)) (i32.const 48)) ;; '0'
              (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 3)))
            )
            (else
              (i32.store8 (local.get $out_ptr) (local.get $ch))
              (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 1)))
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $url_loop)
        )
      )
    )

    ;; Copy URL suffix and Middle text (86 bytes) from 9500 to out_ptr
    (memory.copy (local.get $out_ptr) (i32.const 9500) (i32.const 86))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 86)))

    ;; Copy original topic verbatim into the markdown list
    (memory.copy (local.get $out_ptr) (local.get $in_ptr) (local.get $in_len))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (local.get $in_len)))

    ;; Copy Footer text (184 bytes) from 9800 to out_ptr
    (memory.copy (local.get $out_ptr) (i32.const 9800) (i32.const 184))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 184)))

    ;; Return total output length: out_ptr - 1024
    (i32.sub (local.get $out_ptr) (i32.const 1024))
  )
)
