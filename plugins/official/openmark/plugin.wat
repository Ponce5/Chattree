(module
  (memory (export "memory") 4)

  ;; Pre-load strings in memory segments
  ;; Help string at 8000 (283 bytes)
  (data (i32.const 8000)
    "### \f0\9f\8e\a8 OpenMark Studio v1.0.2\n*Code-First Presentation & Carousel Studio para Chattree.*\n\n**Uso:**\n`/openmark <tema o idea>`\n\n**Ejemplos:**\n\e2\80\a2 `/openmark 3 Estrategias de Crecimiento`\n\e2\80\a2 `/openmark Inteligencia Artificial en 2026`\n\e2\80\a2 `/openmark Habitos para alta productividad`\n"
  )

  ;; Header & image prefix at 9000 (129 bytes)
  (data (i32.const 9000)
    "### \f0\9f\8e\a8 OpenMark Studio \e2\80\94 Slide Canvas (1080x1080)\n\n![OpenMark Slide](https://dummyimage.com/1080x1080/0a0a0f/6c63ff.png&text="
  )

  ;; Mid prefix at 9300 (69 bytes)
  (data (i32.const 9300)
    ")\n\n---\n### \f0\9f\93\90 Especificacion Code-First (OpenMark)\n\e2\80\a2 **Titulo**: "
  )

  ;; Mid specs at 9500 (133 bytes)
  (data (i32.const 9500)
    "\n\e2\80\a2 **Canvas**: 1080x1080 px (1:1 Square Carousel)\n\e2\80\a2 **Paleta**: Primary `#6C63FF` \e2\80\a2 Surface `#16161D` \e2\80\a2 Background `#0A0A0F`\n"
  )

  ;; Description label at 9700 (26 bytes)
  (data (i32.const 9700)
    "\n**Contenido del Slide:**\n"
  )

  (func (export "openmark_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $out_ptr i32)
    (local $title_ptr i32)
    (local $title_len i32)
    (local $desc_ptr i32)
    (local $desc_len i32)
    (local $i i32)
    (local $ch i32)
    (local $limit i32)

    ;; 1. If empty, return help
    (if (i32.eqz (local.get $in_len))
      (then
        (memory.copy (i32.const 1024) (i32.const 8000) (i32.const 283))
        (return (i32.const 283))
      )
    )

    ;; Default: title is entire input, no description
    (local.set $title_ptr (local.get $in_ptr))
    (local.set $title_len (local.get $in_len))
    (local.set $desc_ptr (i32.const 0))
    (local.set $desc_len (i32.const 0))

    ;; 2. Check if input is JSON (starts with '{' = 123)
    (if (i32.eq (i32.load8_u (local.get $in_ptr)) (i32.const 123))
      (then
        ;; Scan for "title" (116, 105, 116, 108, 101)
        (local.set $i (local.get $in_ptr))
        (local.set $limit (i32.sub (i32.add (local.get $in_ptr) (local.get $in_len)) (i32.const 8)))
        (loop $title_scan
          (if (i32.lt_u (local.get $i) (local.get $limit))
            (then
              (if (i32.eq (i32.load8_u (local.get $i)) (i32.const 116))
                (then
                  (if (i32.eq (i32.load8_u (i32.add (local.get $i) (i32.const 1))) (i32.const 105))
                    (then
                      (if (i32.eq (i32.load8_u (i32.add (local.get $i) (i32.const 2))) (i32.const 116))
                        (then
                          (if (i32.eq (i32.load8_u (i32.add (local.get $i) (i32.const 3))) (i32.const 108))
                            (then
                              (if (i32.eq (i32.load8_u (i32.add (local.get $i) (i32.const 4))) (i32.const 101))
                                (then
                                  ;; Found 'title', advance to ':' (58)
                                  (local.set $i (i32.add (local.get $i) (i32.const 5)))
                                  (loop $find_colon
                                    (if (i32.and (i32.lt_u (local.get $i) (i32.add (local.get $in_ptr) (local.get $in_len))) (i32.ne (i32.load8_u (local.get $i)) (i32.const 58)))
                                      (then
                                        (local.set $i (i32.add (local.get $i) (i32.const 1)))
                                        (br $find_colon)
                                      )
                                    )
                                  )
                                  ;; Skip until opening quote '"' (34)
                                  (loop $find_quote
                                    (if (i32.and (i32.lt_u (local.get $i) (i32.add (local.get $in_ptr) (local.get $in_len))) (i32.ne (i32.load8_u (local.get $i)) (i32.const 34)))
                                      (then
                                        (local.set $i (i32.add (local.get $i) (i32.const 1)))
                                        (br $find_quote)
                                      )
                                    )
                                  )
                                  ;; $i is at opening quote, advance to first char
                                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                                  (local.set $title_ptr (local.get $i))
                                  ;; Find closing quote '"' (34)
                                  (loop $title_end
                                    (if (i32.and (i32.lt_u (local.get $i) (i32.add (local.get $in_ptr) (local.get $in_len))) (i32.ne (i32.load8_u (local.get $i)) (i32.const 34)))
                                      (then
                                        (local.set $i (i32.add (local.get $i) (i32.const 1)))
                                        (br $title_end)
                                      )
                                    )
                                  )
                                  (local.set $title_len (i32.sub (local.get $i) (local.get $title_ptr)))
                                  (local.set $limit (i32.const 0)) ;; break scan loop
                                )
                              )
                            )
                          )
                        )
                      )
                    )
                  )
                )
              )
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $title_scan)
            )
          )
        )

        ;; Scan for "desc" (100, 101, 115, 99)
        (local.set $i (local.get $in_ptr))
        (local.set $limit (i32.sub (i32.add (local.get $in_ptr) (local.get $in_len)) (i32.const 14)))
        (loop $desc_scan
          (if (i32.lt_u (local.get $i) (local.get $limit))
            (then
              (if (i32.eq (i32.load8_u (local.get $i)) (i32.const 100))
                (then
                  (if (i32.eq (i32.load8_u (i32.add (local.get $i) (i32.const 1))) (i32.const 101))
                    (then
                      (if (i32.eq (i32.load8_u (i32.add (local.get $i) (i32.const 2))) (i32.const 115))
                        (then
                          (if (i32.eq (i32.load8_u (i32.add (local.get $i) (i32.const 3))) (i32.const 99))
                            (then
                              ;; Found 'desc', advance to ':' (58)
                              (local.set $i (i32.add (local.get $i) (i32.const 4)))
                              (loop $find_desc_colon
                                (if (i32.and (i32.lt_u (local.get $i) (i32.add (local.get $in_ptr) (local.get $in_len))) (i32.ne (i32.load8_u (local.get $i)) (i32.const 58)))
                                  (then
                                    (local.set $i (i32.add (local.get $i) (i32.const 1)))
                                    (br $find_desc_colon)
                                  )
                                )
                              )
                              ;; Skip until opening quote '"' (34)
                              (loop $desc_quote
                                (if (i32.and (i32.lt_u (local.get $i) (i32.add (local.get $in_ptr) (local.get $in_len))) (i32.ne (i32.load8_u (local.get $i)) (i32.const 34)))
                                  (then
                                    (local.set $i (i32.add (local.get $i) (i32.const 1)))
                                    (br $desc_quote)
                                  )
                                )
                              )
                              (local.set $i (i32.add (local.get $i) (i32.const 1)))
                              (local.set $desc_ptr (local.get $i))
                              ;; Find closing unescaped quote '"' (34)
                              (loop $desc_end
                                (if (i32.lt_u (local.get $i) (i32.add (local.get $in_ptr) (local.get $in_len)))
                                  (then
                                    (if (i32.eq (i32.load8_u (local.get $i)) (i32.const 34))
                                      (then
                                        (if (i32.ne (i32.load8_u (i32.sub (local.get $i) (i32.const 1))) (i32.const 92))
                                          (then
                                            (local.set $desc_len (i32.sub (local.get $i) (local.get $desc_ptr)))
                                            (local.set $limit (i32.const 0))
                                          )
                                          (else
                                            (local.set $i (i32.add (local.get $i) (i32.const 1)))
                                            (br $desc_end)
                                          )
                                        )
                                      )
                                      (else
                                        (local.set $i (i32.add (local.get $i) (i32.const 1)))
                                        (br $desc_end)
                                      )
                                    )
                                  )
                                )
                              )
                            )
                          )
                        )
                      )
                    )
                  )
                )
              )
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $desc_scan)
            )
          )
        )
      )
    )

    ;; 3. Build Markdown Output at 1024
    (local.set $out_ptr (i32.const 1024))

    ;; Copy Header & Image Prefix (129 bytes)
    (memory.copy (local.get $out_ptr) (i32.const 9000) (i32.const 129))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 129)))

    ;; Copy title into URL with spaces replaced by '+'
    (local.set $i (i32.const 0))
    (loop $url_title_loop
      (if (i32.lt_u (local.get $i) (local.get $title_len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $title_ptr) (local.get $i))))
          ;; If space (32), write '+' (43)
          (if (i32.eq (local.get $ch) (i32.const 32))
            (then
              (i32.store8 (local.get $out_ptr) (i32.const 43))
              (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 1)))
            )
            (else
              ;; Filter out quotes, backslashes, braces or newlines
              (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.and (i32.ne (local.get $ch) (i32.const 92)) (i32.and (i32.ne (local.get $ch) (i32.const 123)) (i32.ne (local.get $ch) (i32.const 125)))))
                (then
                  (i32.store8 (local.get $out_ptr) (local.get $ch))
                  (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 1)))
                )
              )
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $url_title_loop)
        )
      )
    )

    ;; Copy Mid prefix (69 bytes)
    (memory.copy (local.get $out_ptr) (i32.const 9300) (i32.const 69))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 69)))

    ;; Copy title verbatim
    (memory.copy (local.get $out_ptr) (local.get $title_ptr) (local.get $title_len))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (local.get $title_len)))

    ;; Copy Mid specs (133 bytes)
    (memory.copy (local.get $out_ptr) (i32.const 9500) (i32.const 133))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 133)))

    ;; If description present, copy it converting "\n" to actual newline
    (if (i32.gt_u (local.get $desc_len) (i32.const 0))
      (then
        ;; Copy description label (26 bytes)
        (memory.copy (local.get $out_ptr) (i32.const 9700) (i32.const 26))
        (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 26)))

        (local.set $i (i32.const 0))
        (loop $desc_copy_loop
          (if (i32.lt_u (local.get $i) (local.get $desc_len))
            (then
              (local.set $ch (i32.load8_u (i32.add (local.get $desc_ptr) (local.get $i))))
              ;; If backslash followed by 'n', emit newline (10)
              (if (i32.eq (local.get $ch) (i32.const 92))
                (then
                  (if (i32.lt_u (i32.add (local.get $i) (i32.const 1)) (local.get $desc_len))
                    (then
                      (if (i32.eq (i32.load8_u (i32.add (i32.add (local.get $desc_ptr) (local.get $i)) (i32.const 1))) (i32.const 110))
                        (then
                          (i32.store8 (local.get $out_ptr) (i32.const 10))
                          (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 1)))
                          (local.set $i (i32.add (local.get $i) (i32.const 2)))
                          (br $desc_copy_loop)
                        )
                      )
                    )
                  )
                )
              )
              (i32.store8 (local.get $out_ptr) (local.get $ch))
              (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 1)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $desc_copy_loop)
            )
          )
        )
        ;; Trailing newline
        (i32.store8 (local.get $out_ptr) (i32.const 10))
        (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 1)))
      )
    )

    ;; Return output length
    (i32.sub (local.get $out_ptr) (i32.const 1024))
  )
)