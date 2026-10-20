;; Dynamic OpenMark Code-First Plugin for Chattree v1.3.0
(module
  (memory (export "memory") 8)

  (data (i32.const 8192) "### \f0\9f\8e\a8 OpenMark Studio v1.3.0\0a*Motor de dise\c3\b1o Code-First con renderizado visual nativo a PNG en Chattree.*\0a\0a**Uso:**\0a`/openmark <tema o idea>`\0a\0a**Ejemplos:**\0a\e2\80\a2 `/openmark 3 Curiosidades Fascinantes del Espacio`\0a\e2\80\a2 `/openmark Inteligencia Artificial en 2026`\0a\e2\80\a2 `/openmark Estrategias de Crecimiento para Startups`\0a")
  (data (i32.const 10000) "### \f0\9f\8e\a8 OpenMark Studio \e2\80\94 Slide Canvas (1080\c3\971080)\0a*Marca de agua*: ")
  (data (i32.const 10104) "\0a\0a---\0a\0a#### \f0\9f\93\90 Especificaci\c3\b3n de Dise\c3\b1o (Code-First)\0a* **Formato**: 1080 \c3\97 1080 px (Relaci\c3\b3n 1:1 Cuadrado)\0a* **Paleta**: Modern Studio Dark & Violet (`Primary #8B5CF6` \e2\80\a2 `Surface #151226` \e2\80\a2 `Background #0B0914`)\0a* **Tipograf\c3\ada**: Outfit / Space Grotesk\0a* **M\c3\a9trica Destacada**: **TOP 1** (")
  (data (i32.const 10437) ")\0a\0a```tsx\0a// \e2\94\80\e2\94\80\e2\94\80 React Slide 1 Component (OpenMark Code-First) \e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\0aexport const Slide1: React.FC<SlideProps> = ({ theme, data }) => (\0a  <div style={{\0a    width: \"1080px\", height: \"1080px\",\0a    background: \"#0B0914\",\0a    fontFamily: \"Outfit\",\0a    display: \"flex\", flexDirection: \"column\",\0a    justifyContent: \"space-between\", padding: \"80px\",\0a    position: \"relative\", overflow: \"hidden\"\0a  }}>\0a    <span style={{\0a      position: \"absolute\", top: \"20px\", right: \"-10px\",\0a      fontSize: \"240px\", fontWeight: 900,\0a      color: \"#8B5CF6\", opacity: 0.05, lineHeight: 0.8\0a    }}>\0a      ")
  (data (i32.const 11088) "\0a    </span>\0a    <div style={{\0a      background: \"#8B5CF6\", color: \"#0B0914\",\0a      padding: \"10px 28px\", borderRadius: \"99px\",\0a      fontSize: \"15px\", fontWeight: 800, letterSpacing: \"2px\",\0a      alignSelf: \"flex-start\", textTransform: \"uppercase\"\0a    }}>\0a      OPENMARK STUDIO\0a    </div>\0a    <div style={{\0a      background: \"#151226\", borderLeft: \"8px solid #8B5CF6\",\0a      borderRadius: \"24px\", padding: \"48px 56px\", zIndex: 2\0a    }}>\0a      <h1 style={{ color: \"#F5F3FF\", fontSize: \"52px\", fontWeight: 900, lineHeight: 1.15, margin: \"0 0 20px\" }}>\0a        ")
  (data (i32.const 11679) "\0a      </h1>\0a      <p style={{ color: \"#8B5CF6\", fontSize: \"24px\", margin: 0, fontWeight: 600 }}>\0a        M\c3\a9trica Clave: TOP 1 \e2\80\94 ")
  (data (i32.const 11843) "\0a      </p>\0a    </div>\0a    <div style={{ display: \"flex\", justifyContent: \"space-between\", borderTop: \"1px solid rgba(255,255,255,0.1)\", paddingTop: \"24px\" }}>\0a      <span style={{ color: \"#F5F3FF\", fontSize: \"20px\", fontWeight: 700 }}>OPENMARK STUDIO</span>\0a      <span style={{ color: \"#8B5CF6\", fontSize: \"18px\" }}>SLIDE 01 / 05</span>\0a    </div>\0a  </div>\0a);\0a```\0a\0a---\0a\0a#### \f0\9f\93\b1 Copy para Redes Sociales\0a> \f0\9f\94\a5 **")
  (data (i32.const 12291) "**  \0a> Desliza para explorar todos los detalles clave y datos sorprendentes sobre este tema.\0a> \0a> #OpenMark #CodeFirst #Innovation #Design\0a")

  ;; Default watermark "CANVAS" at offset 500
  (data (i32.const 500) "CANVAS")

  (func (export "openmark_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $out_ptr i32)
    (local $title_ptr i32)
    (local $title_len i32)
    (local $wm_ptr i32)
    (local $wm_len i32)
    (local $i i32)
    (local $ch i32)
    (local $j i32)
    (local $match i32)

    ;; 1. If empty input -> return help
    (if (i32.eqz (local.get $in_len))
      (then
        (memory.copy (i32.const 1024) (i32.const 8192) (i32.const 322))
        (return (i32.const 322))
      )
    )

    ;; 2. Default: title is the entire input
    (local.set $title_ptr (local.get $in_ptr))
    (local.set $title_len (local.get $in_len))

    ;; 3. Check if input is JSON starting with '{' (123)
    (if (i32.eq (i32.load8_u (local.get $in_ptr)) (i32.const 123))
      (then
        ;; Search for '"title":' -> 34, 116, 105, 116, 108, 101, 34, 58
        (local.set $i (i32.const 0))
        (block $json_search_done
          (loop $json_loop
            (if (i32.ge_u (local.get $i) (i32.sub (local.get $in_len) (i32.const 10)))
              (then (br $json_search_done))
            )

            ;; check "title":
            (local.set $match (i32.const 1))
            ;; '"'
            (if (i32.ne (i32.load8_u (i32.add (local.get $in_ptr) (local.get $i))) (i32.const 34)) (then (local.set $match (i32.const 0))))
            ;; 't'
            (if (i32.ne (i32.load8_u (i32.add (local.get $in_ptr) (i32.add (local.get $i) (i32.const 1)))) (i32.const 116)) (then (local.set $match (i32.const 0))))
            ;; 'i'
            (if (i32.ne (i32.load8_u (i32.add (local.get $in_ptr) (i32.add (local.get $i) (i32.const 2)))) (i32.const 105)) (then (local.set $match (i32.const 0))))
            ;; 't'
            (if (i32.ne (i32.load8_u (i32.add (local.get $in_ptr) (i32.add (local.get $i) (i32.const 3)))) (i32.const 116)) (then (local.set $match (i32.const 0))))
            ;; 'l'
            (if (i32.ne (i32.load8_u (i32.add (local.get $in_ptr) (i32.add (local.get $i) (i32.const 4)))) (i32.const 108)) (then (local.set $match (i32.const 0))))
            ;; 'e'
            (if (i32.ne (i32.load8_u (i32.add (local.get $in_ptr) (i32.add (local.get $i) (i32.const 5)))) (i32.const 101)) (then (local.set $match (i32.const 0))))
            ;; '"'
            (if (i32.ne (i32.load8_u (i32.add (local.get $in_ptr) (i32.add (local.get $i) (i32.const 6)))) (i32.const 34)) (then (local.set $match (i32.const 0))))
            ;; ':'
            (if (i32.ne (i32.load8_u (i32.add (local.get $in_ptr) (i32.add (local.get $i) (i32.const 7)))) (i32.const 58)) (then (local.set $match (i32.const 0))))

            (if (local.get $match)
              (then
                ;; Skip any whitespace and the opening '"'
                (local.set $j (i32.add (local.get $i) (i32.const 8)))
                (loop $skip_ws
                  (if (i32.lt_u (local.get $j) (local.get $in_len))
                    (then
                      (if (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (local.get $j))) (i32.const 34))
                        (then
                          (local.set $j (i32.add (local.get $j) (i32.const 1)))
                        )
                        (else
                          (if (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (local.get $j))) (i32.const 32))
                            (then
                              (local.set $j (i32.add (local.get $j) (i32.const 1)))
                              (br $skip_ws)
                            )
                          )
                        )
                      )
                    )
                  )
                )

                (local.set $title_ptr (i32.add (local.get $in_ptr) (local.get $j)))
                (local.set $title_len (i32.const 0))
                ;; Count until closing '"'
                (loop $count_title
                  (if (i32.lt_u (i32.add (local.get $j) (local.get $title_len)) (local.get $in_len))
                    (then
                      (if (i32.ne (i32.load8_u (i32.add (local.get $title_ptr) (local.get $title_len))) (i32.const 34))
                        (then
                          (local.set $title_len (i32.add (local.get $title_len) (i32.const 1)))
                          (br $count_title)
                        )
                      )
                    )
                  )
                )
                (br $json_search_done)
              )
            )

            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $json_loop)
          )
        )
      )
    )

    ;; 4. Extract dynamic watermark at offset 600 (uppercase first keyword)
    (local.set $wm_ptr (i32.const 600))
    (local.set $wm_len (i32.const 0))
    (local.set $i (i32.const 0))

    ;; Skip leading spaces, numbers or common punctuation
    (loop $skip_punct
      (if (i32.lt_u (local.get $i) (local.get $title_len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $title_ptr) (local.get $i))))
          (if (i32.or
                (i32.and (i32.ge_u (local.get $ch) (i32.const 65)) (i32.le_u (local.get $ch) (i32.const 90)))
                (i32.and (i32.ge_u (local.get $ch) (i32.const 97)) (i32.le_u (local.get $ch) (i32.const 122))))
            (then
              ;; Found letter!
            )
            (else
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $skip_punct)
            )
          )
        )
      )
    )

    ;; Copy up to 8 letters to wm_ptr in uppercase
    (loop $wm_copy
      (if (i32.and (i32.lt_u (local.get $i) (local.get $title_len)) (i32.lt_u (local.get $wm_len) (i32.const 8)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $title_ptr) (local.get $i))))
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 97)) (i32.le_u (local.get $ch) (i32.const 122)))
            (then
              (local.set $ch (i32.sub (local.get $ch) (i32.const 32)))
            )
          )
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 65)) (i32.le_u (local.get $ch) (i32.const 90)))
            (then
              (i32.store8 (i32.add (local.get $wm_ptr) (local.get $wm_len)) (local.get $ch))
              (local.set $wm_len (i32.add (local.get $wm_len) (i32.const 1)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $wm_copy)
            )
          )
        )
      )
    )

    ;; If watermark is empty, fall back to "CANVAS" (offset 500, len 6)
    (if (i32.eqz (local.get $wm_len))
      (then
        (local.set $wm_ptr (i32.const 500))
        (local.set $wm_len (i32.const 6))
      )
    )

    ;; 5. Assemble dynamic markdown response at offset 1024
    (local.set $out_ptr (i32.const 1024))

    ;; Chunk 1
    (memory.copy (local.get $out_ptr) (i32.const 10000) (i32.const 72))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 72)))

    ;; Watermark
    (memory.copy (local.get $out_ptr) (local.get $wm_ptr) (local.get $wm_len))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (local.get $wm_len)))

    ;; Chunk 2
    (memory.copy (local.get $out_ptr) (i32.const 10104) (i32.const 301))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 301)))

    ;; Title
    (memory.copy (local.get $out_ptr) (local.get $title_ptr) (local.get $title_len))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (local.get $title_len)))

    ;; Chunk 3
    (memory.copy (local.get $out_ptr) (i32.const 10437) (i32.const 619))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 619)))

    ;; Watermark
    (memory.copy (local.get $out_ptr) (local.get $wm_ptr) (local.get $wm_len))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (local.get $wm_len)))

    ;; Chunk 4
    (memory.copy (local.get $out_ptr) (i32.const 11088) (i32.const 559))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 559)))

    ;; Title
    (memory.copy (local.get $out_ptr) (local.get $title_ptr) (local.get $title_len))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (local.get $title_len)))

    ;; Chunk 5
    (memory.copy (local.get $out_ptr) (i32.const 11679) (i32.const 132))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 132)))

    ;; Title
    (memory.copy (local.get $out_ptr) (local.get $title_ptr) (local.get $title_len))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (local.get $title_len)))

    ;; Chunk 6
    (memory.copy (local.get $out_ptr) (i32.const 11843) (i32.const 416))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 416)))

    ;; Title
    (memory.copy (local.get $out_ptr) (local.get $title_ptr) (local.get $title_len))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (local.get $title_len)))

    ;; Chunk 7
    (memory.copy (local.get $out_ptr) (i32.const 12291) (i32.const 139))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 139)))

    (i32.sub (local.get $out_ptr) (i32.const 1024))
  )
)
