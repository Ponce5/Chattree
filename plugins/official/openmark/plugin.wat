(module
  (memory (export "memory") 4)

  ;; Pre-load string segments in memory
  ;; help at 8000 (283 bytes)
  (data (i32.const 8000) "### \f0\9f\8e\a8 OpenMark Studio v1.0.3\0a*Code-First Presentation & Carousel Studio para Chattree.*\0a\0a**Uso:**\0a`/openmark <tema o idea>`\0a\0a**Ejemplos:**\0a\e2\80\a2 `/openmark 3 Estrategias de Crecimiento`\0a\e2\80\a2 `/openmark Inteligencia Artificial en 2026`\0a\e2\80\a2 `/openmark Habitos para alta productividad`\0a")

  ;; url_prefix at 9000 (740 bytes)
  (data (i32.const 9000) "### \f0\9f\8e\a8 OpenMark Studio \e2\80\94 Slide Canvas (1080x1080)\0a\0a![OpenMark Slide](https://quickchart.io/graphviz?format=png&width=1080&graph=digraph%7Bbgcolor%3D%22%230A0A0F%22pad%3D%220.5%22node%5Bshape%3Dnone%2Cfontname%3D%22Helvetica%22%5Dcard%5Blabel%3D%3C%3CTABLE%20BGCOLOR%3D%22%2316161D%22%20COLOR%3D%22%236C63FF%22%20PENWIDTH%3D%224%22%20CELLBORDER%3D%220%22%20CELLPADDING%3D%2230%22%20CELLSPACING%3D%220%22%20STYLE%3D%22ROUNDED%22%3E%3CTR%3E%3CTD%20ALIGN%3D%22LEFT%22%3E%3CFONT%20COLOR%3D%22%236C63FF%22%20POINT-SIZE%3D%2218%22%3E%3CB%3E%20%20OPENMARK%20STUDIO%20%E2%80%A2%20SLIDE%2001%20%20%3C%2FB%3E%3C%2FFONT%3E%3C%2FTD%3E%3C%2FTR%3E%3CTR%3E%3CTD%20ALIGN%3D%22LEFT%22%3E%3CFONT%20COLOR%3D%22%23FFFFFF%22%20POINT-SIZE%3D%2236%22%3E%3CB%3E")

  ;; url_mid at 10000 (455 bytes)
  (data (i32.const 10000) "%3C%2FB%3E%3C%2FFONT%3E%3C%2FTD%3E%3C%2FTR%3E%3CTR%3E%3CTD%20ALIGN%3D%22LEFT%22%3E%3CFONT%20COLOR%3D%22%23FFD166%22%20POINT-SIZE%3D%2214%22%3E%3CB%3E%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%3C%2FB%3E%3C%2FFONT%3E%3C%2FTD%3E%3C%2FTR%3E")

  ;; row_start at 10600 (97 bytes)
  (data (i32.const 10600) "%3CTR%3E%3CTD%20ALIGN%3D%22LEFT%22%3E%3CFONT%20COLOR%3D%22%23F5F5FA%22%20POINT-SIZE%3D%2222%22%3E")

  ;; row_end at 10800 (35 bytes)
  (data (i32.const 10800) "%3C%2FFONT%3E%3C%2FTD%3E%3C%2FTR%3E")

  ;; default_row at 11000 (198 bytes)
  (data (i32.const 11000) "%3CTR%3E%3CTD%20ALIGN%3D%22LEFT%22%3E%3CFONT%20COLOR%3D%22%238585A4%22%20POINT-SIZE%3D%2222%22%3E%E2%80%A2%20Slide%20y%20canvas%20visual%20dise%C3%B1ado%20con%20IA%3C%2FFONT%3E%3C%2FTD%3E%3C%2FTR%3E")

  ;; url_suffix at 11300 (265 bytes)
  (data (i32.const 11300) "%3CTR%3E%3CTD%20ALIGN%3D%22RIGHT%22%3E%3CFONT%20COLOR%3D%22%238585A4%22%20POINT-SIZE%3D%2214%22%3EOpenMark%20Canvas%20%E2%80%A2%20Chattree%3C%2FFONT%3E%3C%2FTD%3E%3C%2FTR%3E%3C%2FTABLE%3E%3E%5D%7D)\0a\0a---\0a### \f0\9f\93\90 Especificacion Code-First (OpenMark)\0a\e2\80\a2 **Titulo**: ")

  ;; specs at 11700 (133 bytes)
  (data (i32.const 11700) "\0a\e2\80\a2 **Canvas**: 1080x1080 px (1:1 Square Carousel)\0a\e2\80\a2 **Paleta**: Primary `#6C63FF` \e2\80\a2 Surface `#16161D` \e2\80\a2 Background `#0A0A0F`\0a")

  ;; desc_label at 12000 (26 bytes)
  (data (i32.const 12000) "\0a**Contenido del Slide:**\0a")

  (func (export "openmark_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $out_ptr i32)
    (local $title_ptr i32)
    (local $title_len i32)
    (local $desc_ptr i32)
    (local $desc_len i32)
    (local $i i32)
    (local $ch i32)
    (local $limit i32)
    (local $line_count i32)
    (local $in_row i32)

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

    ;; If input starts with '/' (47), strip command word
    (if (i32.eq (i32.load8_u (local.get $in_ptr)) (i32.const 47))
      (then
        (local.set $i (local.get $in_ptr))
        (loop $skip_cmd
          (if (i32.lt_u (local.get $i) (i32.add (local.get $in_ptr) (local.get $in_len)))
            (then
              (if (i32.eq (i32.load8_u (local.get $i)) (i32.const 32))
                (then
                  (loop $skip_sp
                    (if (i32.and (i32.lt_u (local.get $i) (i32.add (local.get $in_ptr) (local.get $in_len))) (i32.eq (i32.load8_u (local.get $i)) (i32.const 32)))
                      (then
                        (local.set $i (i32.add (local.get $i) (i32.const 1)))
                        (br $skip_sp)
                      )
                    )
                  )
                  (local.set $title_ptr (local.get $i))
                  (local.set $title_len (i32.sub (i32.add (local.get $in_ptr) (local.get $in_len)) (local.get $title_ptr)))
                )
                (else
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $skip_cmd)
                )
              )
            )
          )
        )
      )
    )

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

    ;; Copy URL Prefix (740 bytes)
    (memory.copy (local.get $out_ptr) (i32.const 9000) (i32.const 740))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 740)))

    ;; Copy title into URL (escaped, max 80 chars)
    (local.set $i (i32.const 0))
    (local.set $limit (local.get $title_len))
    (if (i32.gt_u (local.get $limit) (i32.const 80))
      (then (local.set $limit (i32.const 80)))
    )
    (loop $url_title_loop
      (if (i32.lt_u (local.get $i) (local.get $limit))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $title_ptr) (local.get $i))))
          ;; Space (32) -> %20
          (if (i32.eq (local.get $ch) (i32.const 32))
            (then
              (i32.store8 (local.get $out_ptr) (i32.const 37))
              (i32.store8 (i32.add (local.get $out_ptr) (i32.const 1)) (i32.const 50))
              (i32.store8 (i32.add (local.get $out_ptr) (i32.const 2)) (i32.const 48))
              (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 3)))
            )
            (else
              ;; Safe char check: skip quotes (34), backslash (92), < (60), > (62), & (38), # (35)
              (if (i32.and (i32.ne (local.get $ch) (i32.const 34))
                   (i32.and (i32.ne (local.get $ch) (i32.const 92))
                   (i32.and (i32.ne (local.get $ch) (i32.const 60))
                   (i32.and (i32.ne (local.get $ch) (i32.const 62))
                   (i32.and (i32.ne (local.get $ch) (i32.const 38))
                            (i32.ne (local.get $ch) (i32.const 35)))))))
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

    ;; Copy URL Mid (455 bytes)
    (memory.copy (local.get $out_ptr) (i32.const 10000) (i32.const 455))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 455)))

    ;; Add Body Rows to Card (either from description or default row)
    (if (i32.gt_u (local.get $desc_len) (i32.const 0))
      (then
        ;; Start first row
        (memory.copy (local.get $out_ptr) (i32.const 10600) (i32.const 97))
        (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 97)))
        (local.set $in_row (i32.const 1))
        (local.set $line_count (i32.const 1))

        (local.set $i (i32.const 0))
        (local.set $limit (local.get $desc_len))
        ;; Cap description in card URL to 200 bytes max
        (if (i32.gt_u (local.get $limit) (i32.const 200))
          (then (local.set $limit (i32.const 200)))
        )

        (loop $desc_url_loop
          (if (i32.lt_u (local.get $i) (local.get $limit))
            (then
              (local.set $ch (i32.load8_u (i32.add (local.get $desc_ptr) (local.get $i))))
              ;; Check newline: literal 10 or '\' followed by 'n' (110)
              (if (i32.or (i32.eq (local.get $ch) (i32.const 10))
                          (i32.and (i32.eq (local.get $ch) (i32.const 92))
                                   (i32.and (i32.lt_u (i32.add (local.get $i) (i32.const 1)) (local.get $limit))
                                            (i32.eq (i32.load8_u (i32.add (i32.add (local.get $desc_ptr) (local.get $i)) (i32.const 1))) (i32.const 110)))))
                (then
                  ;; Skip extra 'n' if it was '\n'
                  (if (i32.eq (local.get $ch) (i32.const 92))
                    (then (local.set $i (i32.add (local.get $i) (i32.const 1))))
                  )
                  ;; Close previous row
                  (memory.copy (local.get $out_ptr) (i32.const 10800) (i32.const 35))
                  (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 35)))
                  (local.set $line_count (i32.add (local.get $line_count) (i32.const 1)))

                  ;; If line_count <= 3, open new row, else stop adding lines to card
                  (if (i32.le_u (local.get $line_count) (i32.const 3))
                    (then
                      (memory.copy (local.get $out_ptr) (i32.const 10600) (i32.const 97))
                      (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 97)))
                    )
                    (else
                      (local.set $in_row (i32.const 0))
                      (local.set $limit (i32.const 0)) ;; break
                    )
                  )
                )
                (else
                  ;; If space (32) -> %20
                  (if (i32.eq (local.get $ch) (i32.const 32))
                    (then
                      (i32.store8 (local.get $out_ptr) (i32.const 37))
                      (i32.store8 (i32.add (local.get $out_ptr) (i32.const 1)) (i32.const 50))
                      (i32.store8 (i32.add (local.get $out_ptr) (i32.const 2)) (i32.const 48))
                      (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 3)))
                    )
                    (else
                      ;; Safe characters: skip quotes, backslash, <, >, &, #
                      (if (i32.and (i32.ne (local.get $ch) (i32.const 34))
                           (i32.and (i32.ne (local.get $ch) (i32.const 92))
                           (i32.and (i32.ne (local.get $ch) (i32.const 60))
                           (i32.and (i32.ne (local.get $ch) (i32.const 62))
                           (i32.and (i32.ne (local.get $ch) (i32.const 38))
                                    (i32.ne (local.get $ch) (i32.const 35)))))))
                        (then
                          (i32.store8 (local.get $out_ptr) (local.get $ch))
                          (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 1)))
                        )
                      )
                    )
                  )
                )
              )
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $desc_url_loop)
            )
          )
        )
        ;; Close final row if still open
        (if (i32.eq (local.get $in_row) (i32.const 1))
          (then
            (memory.copy (local.get $out_ptr) (i32.const 10800) (i32.const 35))
            (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 35)))
          )
        )
      )
      (else
        ;; Default row if no description provided
        (memory.copy (local.get $out_ptr) (i32.const 11000) (i32.const 198))
        (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 198)))
      )
    )

    ;; Copy URL Suffix (265 bytes)
    (memory.copy (local.get $out_ptr) (i32.const 11300) (i32.const 265))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 265)))

    ;; Copy Title verbatim into markdown spec
    (memory.copy (local.get $out_ptr) (local.get $title_ptr) (local.get $title_len))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (local.get $title_len)))

    ;; Copy Specs (133 bytes)
    (memory.copy (local.get $out_ptr) (i32.const 11700) (i32.const 133))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 133)))

    ;; Copy Description verbatim into markdown if present
    (if (i32.gt_u (local.get $desc_len) (i32.const 0))
      (then
        (memory.copy (local.get $out_ptr) (i32.const 12000) (i32.const 26))
        (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 26)))

        (local.set $i (i32.const 0))
        (loop $desc_md_loop
          (if (i32.lt_u (local.get $i) (local.get $desc_len))
            (then
              (local.set $ch (i32.load8_u (i32.add (local.get $desc_ptr) (local.get $i))))
              ;; If '\' followed by 'n', emit real newline
              (if (i32.eq (local.get $ch) (i32.const 92))
                (then
                  (if (i32.lt_u (i32.add (local.get $i) (i32.const 1)) (local.get $desc_len))
                    (then
                      (if (i32.eq (i32.load8_u (i32.add (i32.add (local.get $desc_ptr) (local.get $i)) (i32.const 1))) (i32.const 110))
                        (then
                          (i32.store8 (local.get $out_ptr) (i32.const 10))
                          (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 1)))
                          (local.set $i (i32.add (local.get $i) (i32.const 2)))
                          (br $desc_md_loop)
                        )
                      )
                    )
                  )
                )
              )
              (i32.store8 (local.get $out_ptr) (local.get $ch))
              (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 1)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $desc_md_loop)
            )
          )
        )
        ;; Trailing newline
        (i32.store8 (local.get $out_ptr) (i32.const 10))
        (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const 1)))
      )
    )

    ;; Return total output length
    (i32.sub (local.get $out_ptr) (i32.const 1024))
  )
)
