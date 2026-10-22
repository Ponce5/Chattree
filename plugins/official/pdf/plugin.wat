;; Chattree Official PDF Generator Plugin — WebAssembly Text format  v2.3.0
;;
;; Capabilities: files.write
;;
;; Protocol (Chattree async host_call):
;;   • pdf_entry(in_ptr, in_len) → generates PDF, calls files.write via host_call,
;;     returns 0 (async pending signal). host_call sets pendingAsyncRequest.
;;   • resume(res_ptr, res_len) → called by Dart host after files.write completes.
;;     Parses the file handle from the response and returns the ToolResult JSON
;;     (PluginFileBubble contract: {type,displayText,fileHandle,fileName}).
;;
;; Memory layout:
;;   0        input string (AI JSON / raw text)
;;   1024     output string (ToolResult JSON returned to chat)
;;   2048     host_call request JSON
;;   4096     host_call response JSON (4096 bytes max)
;;   32000    WinAnsi title  (256 bytes)
;;   32256    WinAnsi subtitle (256 bytes)
;;   32512    WinAnsi footer   (256 bytes)
;;   49408    filename buffer (35 bytes)
;;   49664    handle buffer   (40 bytes)
;;   50000    base64 alphabet (64 bytes)
;;   62000    line render buffer (2048 bytes)
;;   70000    WinAnsi body   (80000 bytes)
;;   800000   page stream length table (512 bytes, 64 × 8 bytes each)
;;   801000   xref offset table
;;   1000000  PDF binary output
;;   1700000  base64-encoded PDF
;;   3000000  NUL-terminated PDF fragment strings (data section)
;;
;; Architecture: Each page is a single BT...ET block using absolute Td positioning.
;;   We track Y position per-line and emit "X Y Td (text) Tj\n" sequences.
;;   This avoids the stacking bug caused by mixing BT/ET with relative Td.
;;
;; v2.3.0 changes:
;;   • Fixed JSON parser: now correctly skips \" escape sequences in string values,
;;     so AI content with quoted text is no longer truncated.
;;   • Added subtitle and footer fields: the AI can now send a structured JSON
;;     with title, subtitle, content, and footer; the PDF renders them in the
;;     correct positions (subtitle under title, footer at page bottom).
;;   • Plugin.json intentContract updated with new fields and improved examples.

(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  (memory (export "memory") 64)

  (global $fname_len  (mut i32) (i32.const 0))
  (global $handle_len (mut i32) (i32.const 0))
  (global $page_count (mut i32) (i32.const 0))

  ;; ── helpers ───────────────────────────────────────────────────────────────

  (func $zlen (param $src i32) (result i32)
    (local $n i32)
    (block $done
      (loop $scan
        (if (i32.eqz (i32.load8_u (i32.add (local.get $src) (local.get $n))))
          (then (br $done)))
        (local.set $n (i32.add (local.get $n) (i32.const 1)))
        (br $scan)
      )
    )
    (local.get $n)
  )

  (func $zwrite (param $dst i32) (param $src i32) (result i32)
    (call $write_str (local.get $dst) (local.get $src) (call $zlen (local.get $src)))
  )

  (func $write_str (param $dst i32) (param $src i32) (param $len i32) (result i32)
    (memory.copy (local.get $dst) (local.get $src) (local.get $len))
    (i32.add (local.get $dst) (local.get $len))
  )

  (func $write_int (param $dst i32) (param $val i32) (result i32)
    (local $buf i32) (local $cnt i32) (local $tmp i32)
    (if (i32.eqz (local.get $val))
      (then (i32.store8 (local.get $dst) (i32.const 48)) (return (i32.add (local.get $dst) (i32.const 1))))
    )
    (local.set $buf (i32.const 49950))
    (local.set $tmp (local.get $val))
    (loop $nl
      (if (i32.gt_u (local.get $tmp) (i32.const 0))
        (then
          (i32.store8 (i32.add (local.get $buf) (local.get $cnt))
            (i32.add (i32.const 48) (i32.rem_u (local.get $tmp) (i32.const 10))))
          (local.set $tmp (i32.div_u (local.get $tmp) (i32.const 10)))
          (local.set $cnt (i32.add (local.get $cnt) (i32.const 1)))
          (br $nl)
        )
      )
    )
    (local.set $tmp (i32.const 0))
    (loop $rl
      (if (i32.lt_u (local.get $tmp) (local.get $cnt))
        (then
          (i32.store8 (i32.add (local.get $dst) (local.get $tmp))
            (i32.load8_u (i32.add (local.get $buf) (i32.sub (i32.sub (local.get $cnt) (i32.const 1)) (local.get $tmp)))))
          (local.set $tmp (i32.add (local.get $tmp) (i32.const 1)))
          (br $rl)
        )
      )
    )
    (i32.add (local.get $dst) (local.get $cnt))
  )

  (func $write_padded10 (param $dst i32) (param $val i32) (result i32)
    (local $p i32) (local $tmp i32) (local $i i32)
    (local.set $p (i32.add (local.get $dst) (i32.const 9)))
    (local.set $tmp (local.get $val))
    (loop $pl
      (if (i32.lt_s (local.get $i) (i32.const 10))
        (then
          (i32.store8 (local.get $p) (i32.add (i32.const 48) (i32.rem_u (local.get $tmp) (i32.const 10))))
          (local.set $tmp (i32.div_u (local.get $tmp) (i32.const 10)))
          (local.set $p (i32.sub (local.get $p) (i32.const 1)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $pl)
        )
      )
    )
    (i32.add (local.get $dst) (i32.const 10))
  )

  ;; find_sub: returns index of needle in haystack or -1
  (func $find_sub (param $hay i32) (param $hlen i32) (param $ndl i32) (param $nlen i32) (result i32)
    (local $i i32) (local $j i32) (local $ok i32) (local $lim i32)
    (if (i32.lt_s (local.get $hlen) (local.get $nlen)) (then (return (i32.const -1))))
    (local.set $lim (i32.add (i32.sub (local.get $hlen) (local.get $nlen)) (i32.const 1)))
    (block $found
      (loop $scan
        (if (i32.ge_s (local.get $i) (local.get $lim)) (then (return (i32.const -1))))
        (local.set $ok (i32.const 1))
        (local.set $j (i32.const 0))
        (loop $cmp
          (if (i32.lt_s (local.get $j) (local.get $nlen))
            (then
              (if (i32.ne
                    (i32.load8_u (i32.add (local.get $hay) (i32.add (local.get $i) (local.get $j))))
                    (i32.load8_u (i32.add (local.get $ndl) (local.get $j))))
                (then (local.set $ok (i32.const 0)))
                (else (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $cmp))
              )
            )
          )
        )
        (if (i32.eq (local.get $ok) (i32.const 1)) (then (br $found)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan)
      )
    )
    (local.get $i)
  )

  ;; ── base64 encoder ────────────────────────────────────────────────────────
  (data (i32.const 50000) "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/")

  (func $b64_encode (param $src i32) (param $len i32) (param $dst i32) (result i32)
    (local $i i32) (local $out i32) (local $b0 i32) (local $b1 i32) (local $b2 i32)
    (local $tri i32) (local $rem i32)
    (local.set $out (local.get $dst))
    (loop $lp
      (local.set $rem (i32.sub (local.get $len) (local.get $i)))
      (if (i32.le_s (local.get $rem) (i32.const 0)) (then (return (i32.sub (local.get $out) (local.get $dst)))))
      (if (i32.ge_s (local.get $rem) (i32.const 3))
        (then
          (local.set $b0 (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (local.set $b1 (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1)))))
          (local.set $b2 (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 2)))))
          (local.set $i (i32.add (local.get $i) (i32.const 3)))
          (local.set $tri (i32.or (i32.shl (local.get $b0) (i32.const 16)) (i32.or (i32.shl (local.get $b1) (i32.const 8)) (local.get $b2))))
          (i32.store8 (local.get $out) (i32.load8_u (i32.add (i32.const 50000) (i32.and (i32.shr_u (local.get $tri) (i32.const 18)) (i32.const 63)))))
          (i32.store8 (i32.add (local.get $out) (i32.const 1)) (i32.load8_u (i32.add (i32.const 50000) (i32.and (i32.shr_u (local.get $tri) (i32.const 12)) (i32.const 63)))))
          (i32.store8 (i32.add (local.get $out) (i32.const 2)) (i32.load8_u (i32.add (i32.const 50000) (i32.and (i32.shr_u (local.get $tri) (i32.const 6)) (i32.const 63)))))
          (i32.store8 (i32.add (local.get $out) (i32.const 3)) (i32.load8_u (i32.add (i32.const 50000) (i32.and (local.get $tri) (i32.const 63)))))
          (local.set $out (i32.add (local.get $out) (i32.const 4)))
          (br $lp)
        )
      )
      (if (i32.eq (local.get $rem) (i32.const 2))
        (then
          (local.set $b0 (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (local.set $b1 (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1)))))
          (local.set $tri (i32.or (i32.shl (local.get $b0) (i32.const 16)) (i32.shl (local.get $b1) (i32.const 8))))
          (i32.store8 (local.get $out) (i32.load8_u (i32.add (i32.const 50000) (i32.and (i32.shr_u (local.get $tri) (i32.const 18)) (i32.const 63)))))
          (i32.store8 (i32.add (local.get $out) (i32.const 1)) (i32.load8_u (i32.add (i32.const 50000) (i32.and (i32.shr_u (local.get $tri) (i32.const 12)) (i32.const 63)))))
          (i32.store8 (i32.add (local.get $out) (i32.const 2)) (i32.load8_u (i32.add (i32.const 50000) (i32.and (i32.shr_u (local.get $tri) (i32.const 6)) (i32.const 63)))))
          (i32.store8 (i32.add (local.get $out) (i32.const 3)) (i32.const 61))
          (local.set $out (i32.add (local.get $out) (i32.const 4)))
          (return (i32.sub (local.get $out) (local.get $dst)))
        )
      )
      (if (i32.eq (local.get $rem) (i32.const 1))
        (then
          (local.set $b0 (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (local.set $tri (i32.shl (local.get $b0) (i32.const 16)))
          (i32.store8 (local.get $out) (i32.load8_u (i32.add (i32.const 50000) (i32.and (i32.shr_u (local.get $tri) (i32.const 18)) (i32.const 63)))))
          (i32.store8 (i32.add (local.get $out) (i32.const 1)) (i32.load8_u (i32.add (i32.const 50000) (i32.and (i32.shr_u (local.get $tri) (i32.const 12)) (i32.const 63)))))
          (i32.store8 (i32.add (local.get $out) (i32.const 2)) (i32.const 61))
          (i32.store8 (i32.add (local.get $out) (i32.const 3)) (i32.const 61))
          (local.set $out (i32.add (local.get $out) (i32.const 4)))
          (return (i32.sub (local.get $out) (local.get $dst)))
        )
      )
    )
    (i32.sub (local.get $out) (local.get $dst))
  )

  ;; ── UTF-8 → WinAnsi sanitizer ─────────────────────────────────────────────
  ;; Maps Spanish chars to WinAnsi. Decodes JSON \n \r \t escapes.
  ;; Does NOT strip Markdown here — stripping is done in the renderer so
  ;; heading markers (##) can be used to pick font style.
  (func $sanitize_ascii (param $src i32) (param $slen i32) (param $dst i32) (param $max i32) (result i32)
    (local $i i32) (local $out i32) (local $ch i32) (local $next i32) (local $third i32) (local $mapped i32)
    (loop $lp
      (if (i32.and (i32.lt_s (local.get $i) (local.get $slen)) (i32.lt_s (local.get $out) (local.get $max)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (local.set $mapped (i32.const 0))

          ;; Handle JSON escape sequences: \n \r \t \\ \"
          (if (i32.eq (local.get $ch) (i32.const 92)) ;; backslash
            (then
              (if (i32.lt_s (i32.add (local.get $i) (i32.const 1)) (local.get $slen))
                (then
                  (local.set $next (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1)))))
                  ;; \n or \r → newline (10)
                  (if (i32.or (i32.eq (local.get $next) (i32.const 110)) (i32.eq (local.get $next) (i32.const 114)))
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out)) (i32.const 10))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $lp)
                    )
                  )
                  ;; \t → space
                  (if (i32.eq (local.get $next) (i32.const 116))
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out)) (i32.const 32))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $lp)
                    )
                  )
                  ;; \\ → single backslash
                  (if (i32.eq (local.get $next) (i32.const 92))
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out)) (i32.const 92))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $lp)
                    )
                  )
                  ;; \" → emit a real double-quote character (34) — keep in text
                  (if (i32.eq (local.get $next) (i32.const 34))
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out)) (i32.const 34))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $lp)
                    )
                  )
                  ;; \u → skip 6 chars total (\uXXXX)
                  (if (i32.eq (local.get $next) (i32.const 117))
                    (then
                      (local.set $i (i32.add (local.get $i) (i32.const 6)))
                      (br $lp)
                    )
                  )
                  ;; Unknown escape: skip both chars
                  (local.set $i (i32.add (local.get $i) (i32.const 2)))
                  (br $lp)
                )
              )
            )
          )

          ;; Handle multi-byte UTF-8 sequences
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 192)) (i32.lt_s (i32.add (local.get $i) (i32.const 1)) (local.get $slen)))
            (then
              (local.set $next (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1)))))
              (if (i32.eq (local.get $ch) (i32.const 195))
                (then
                  (if (i32.eq (local.get $next) (i32.const 129)) (then (local.set $mapped (i32.const 193)))) ;; Á
                  (if (i32.eq (local.get $next) (i32.const 137)) (then (local.set $mapped (i32.const 201)))) ;; É
                  (if (i32.eq (local.get $next) (i32.const 141)) (then (local.set $mapped (i32.const 205)))) ;; Í
                  (if (i32.eq (local.get $next) (i32.const 145)) (then (local.set $mapped (i32.const 209)))) ;; Ñ
                  (if (i32.eq (local.get $next) (i32.const 147)) (then (local.set $mapped (i32.const 211)))) ;; Ó
                  (if (i32.eq (local.get $next) (i32.const 154)) (then (local.set $mapped (i32.const 218)))) ;; Ú
                  (if (i32.eq (local.get $next) (i32.const 161)) (then (local.set $mapped (i32.const 225)))) ;; á
                  (if (i32.eq (local.get $next) (i32.const 169)) (then (local.set $mapped (i32.const 233)))) ;; é
                  (if (i32.eq (local.get $next) (i32.const 173)) (then (local.set $mapped (i32.const 237)))) ;; í
                  (if (i32.eq (local.get $next) (i32.const 177)) (then (local.set $mapped (i32.const 241)))) ;; ñ
                  (if (i32.eq (local.get $next) (i32.const 179)) (then (local.set $mapped (i32.const 243)))) ;; ó
                  (if (i32.eq (local.get $next) (i32.const 186)) (then (local.set $mapped (i32.const 250)))) ;; ú
                  (if (i32.eq (local.get $next) (i32.const 188)) (then (local.set $mapped (i32.const 252)))) ;; ü
                  (if (i32.eq (local.get $next) (i32.const 156)) (then (local.set $mapped (i32.const 220)))) ;; Ü
                )
              )
              (if (i32.eq (local.get $ch) (i32.const 194))
                (then
                  (if (i32.eq (local.get $next) (i32.const 161)) (then (local.set $mapped (i32.const 161)))) ;; ¡
                  (if (i32.eq (local.get $next) (i32.const 191)) (then (local.set $mapped (i32.const 191)))) ;; ¿
                  (if (i32.eq (local.get $next) (i32.const 176)) (then (local.set $mapped (i32.const 176)))) ;; °
                  (if (i32.eq (local.get $next) (i32.const 170)) (then (local.set $mapped (i32.const 170)))) ;; ª
                  (if (i32.eq (local.get $next) (i32.const 186)) (then (local.set $mapped (i32.const 186)))) ;; º
                )
              )
              (if (i32.and (i32.eq (local.get $ch) (i32.const 226))
                           (i32.lt_s (i32.add (local.get $i) (i32.const 2)) (local.get $slen)))
                (then
                  (local.set $third (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 2)))))
                  (if (i32.eq (local.get $next) (i32.const 128))
                    (then
                      (if (i32.eq (local.get $third) (i32.const 147)) (then (local.set $mapped (i32.const 150)))) ;; –
                      (if (i32.eq (local.get $third) (i32.const 148)) (then (local.set $mapped (i32.const 151)))) ;; —
                      (if (i32.eq (local.get $third) (i32.const 152)) (then (local.set $mapped (i32.const 145)))) ;; '
                      (if (i32.eq (local.get $third) (i32.const 153)) (then (local.set $mapped (i32.const 146)))) ;; '
                      (if (i32.eq (local.get $third) (i32.const 156)) (then (local.set $mapped (i32.const 147)))) ;; "
                      (if (i32.eq (local.get $third) (i32.const 157)) (then (local.set $mapped (i32.const 148)))) ;; "
                      (if (i32.eq (local.get $third) (i32.const 162)) (then (local.set $mapped (i32.const 149)))) ;; •
                      (if (i32.eq (local.get $third) (i32.const 166)) (then (local.set $mapped (i32.const 133)))) ;; …
                    )
                  )
                  (if (i32.and (i32.eq (local.get $next) (i32.const 130)) (i32.eq (local.get $third) (i32.const 172)))
                    (then (local.set $mapped (i32.const 128)))
                  )
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                )
              )
              (local.set $i (i32.add (local.get $i) (i32.const 1)))

              (if (i32.eqz (local.get $mapped)) (then (local.set $mapped (i32.const 63)))) ;; unknown → ?
              (i32.store8 (i32.add (local.get $dst) (local.get $out)) (local.get $mapped))
              (local.set $out (i32.add (local.get $out) (i32.const 1)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $lp)
            )
          )

          ;; continuation bytes (0x80–0xBF): skip silently
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 128)) (i32.lt_u (local.get $ch) (i32.const 192)))
            (then
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $lp)
            )
          )

          ;; ASCII: emit as-is
          (i32.store8 (i32.add (local.get $dst) (local.get $out)) (local.get $ch))
          (local.set $out (i32.add (local.get $out) (i32.const 1)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $lp)
        )
      )
    )
    (local.get $out)
  )

  ;; ── emit_pdf_literal: write src bytes with ( ) \ escaping ────────────────
  (func $emit_pdf_literal (param $dst i32) (param $src i32) (param $len i32) (result i32)
    (local $i i32) (local $p i32) (local $ch i32)
    (local.set $p (local.get $dst))
    (loop $literal
      (if (i32.lt_s (local.get $i) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 40))
                      (i32.or (i32.eq (local.get $ch) (i32.const 41)) (i32.eq (local.get $ch) (i32.const 92))))
            (then (i32.store8 (local.get $p) (i32.const 92)) (local.set $p (i32.add (local.get $p) (i32.const 1))))
          )
          (i32.store8 (local.get $p) (local.get $ch))
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $literal)
        )
      )
    )
    (local.get $p)
  )

  ;; ── parse_json_string: parse a JSON string value after the opening quote ──
  ;; Scans from $src for up to $max_len bytes, writing decoded bytes to $dst.
  ;; Correctly handles \" (keeps the quote), \n/\r (newline), \t (space),
  ;; \\ (backslash). Stops at an unescaped closing quote.
  ;; Returns the number of bytes written.
  (func $parse_json_string
    (param $src i32)     ;; pointer to first byte AFTER the opening "
    (param $slen i32)    ;; remaining input bytes available
    (param $dst i32)     ;; output buffer
    (param $max i32)     ;; max output bytes
    (result i32)         ;; number of bytes written
    (local $i i32) (local $out i32) (local $ch i32) (local $next i32)
    (loop $lp
      (if (i32.and
            (i32.lt_s (local.get $i) (local.get $slen))
            (i32.lt_s (local.get $out) (local.get $max)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))

          ;; Unescaped closing quote → end of string
          (if (i32.eq (local.get $ch) (i32.const 34))
            (then (return (local.get $out)))
          )

          ;; Backslash escape sequence
          (if (i32.eq (local.get $ch) (i32.const 92))
            (then
              (if (i32.lt_s (i32.add (local.get $i) (i32.const 1)) (local.get $slen))
                (then
                  (local.set $next (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1)))))
                  ;; \" → keep the double-quote in output
                  (if (i32.eq (local.get $next) (i32.const 34))
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out)) (i32.const 34))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $lp)
                    )
                  )
                  ;; \n or \r → newline
                  (if (i32.or (i32.eq (local.get $next) (i32.const 110)) (i32.eq (local.get $next) (i32.const 114)))
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out)) (i32.const 10))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $lp)
                    )
                  )
                  ;; \t → space
                  (if (i32.eq (local.get $next) (i32.const 116))
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out)) (i32.const 32))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $lp)
                    )
                  )
                  ;; \\ → backslash
                  (if (i32.eq (local.get $next) (i32.const 92))
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out)) (i32.const 92))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $lp)
                    )
                  )
                  ;; \u → skip 6 chars (\uXXXX)
                  (if (i32.eq (local.get $next) (i32.const 117))
                    (then
                      (local.set $i (i32.add (local.get $i) (i32.const 6)))
                      (br $lp)
                    )
                  )
                  ;; other escape: skip both
                  (local.set $i (i32.add (local.get $i) (i32.const 2)))
                  (br $lp)
                )
              )
            )
          )

          ;; Regular byte: emit as-is
          (i32.store8 (i32.add (local.get $dst) (local.get $out)) (local.get $ch))
          (local.set $out (i32.add (local.get $out) (i32.const 1)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $lp)
        )
      )
    )
    (local.get $out)
  )

  ;; ── assemble_dynamic_pdf ─────────────────────────────────────────────────
  ;;
  ;; ARCHITECTURE (v2.3.0 — Absolute-Td + subtitle + footer):
  ;;   Each page is rendered as a single BT...ET block.
  ;;   Lines are positioned with absolute "X Y Td (text) Tj\n" sequences.
  ;;   We track the current Y coordinate explicitly and decrement it per line.
  ;;   This is correct, reliable PDF text placement with no stacking bugs.
  ;;
  ;; NEW: subtitle rendered below the title in Helvetica italic 12pt.
  ;; NEW: footer text rendered at the bottom of every page (above page number).
  ;;
  ;; Page stream slots: 120000 + page*15000 (up to 64 pages, 15 KB each)
  ;; PDF output: 1000000; xref offsets: 801000.
  ;;
  ;; Page layout (A4 = 595 × 842 pt):
  ;;   Title Y:       800 pt (F1/Helvetica-Bold 16pt)
  ;;   Subtitle Y:    776 pt (F2/Helvetica 12pt italic-ish, rendered if present)
  ;;   Separator Y:   762 pt (horizontal rule as dashes)
  ;;   Body start Y:  745 pt (page 1), 800 pt (continuation pages)
  ;;   Bottom stop:    60 pt (leaves room for footer + page number)
  ;;   Footer Y:       42 pt (custom footer text)
  ;;   Page num Y:     24 pt
  ;;   Left margin:    50 pt
  (func $assemble_dynamic_pdf
    (param $tp i32) (param $tl i32)         ;; title ptr, len
    (param $stp i32) (param $stl i32)       ;; subtitle ptr, len
    (param $body i32) (param $body_len i32) ;; body ptr, len
    (param $ftp i32) (param $ftl i32)       ;; footer ptr, len
    (result i32)
    (local $p i32) (local $sp i32) (local $ss i32) (local $sl i32)
    (local $i i32) (local $ch i32)
    (local $page i32) (local $obj i32) (local $sid i32)
    (local $xref i32) (local $size i32) (local $off i32)
    ;; text layout state
    (local $cur_y i32)
    (local $line_h_body i32)
    (local $line_h_head i32)
    ;; line builder state
    (local $lb i32)
    (local $llen i32)
    (local $at_bol i32)
    (local $is_heading i32)
    (local $word_start i32)
    (local $wrap_at i32)

    (global.set $page_count (i32.const 0))
    (local.set $page (i32.const 0))
    (local.set $line_h_body (i32.const 16))
    (local.set $line_h_head (i32.const 22))
    (local.set $lb (i32.const 62000))
    (local.set $wrap_at (i32.const 80))

    ;; ─ Start page 1 ─
    (local.set $sp (i32.add (i32.const 120000) (i32.mul (local.get $page) (i32.const 15000))))
    (local.set $ss (local.get $sp))
    (local.set $p (local.get $sp))

    ;; ── Emit title: BT /F1 16 Tf 50 800 Td (title) Tj ET
    (local.set $p (call $zwrite (local.get $p) (i32.const 3000000)))
    (local.set $p (call $emit_pdf_literal (local.get $p) (local.get $tp) (local.get $tl)))
    (local.set $p (call $zwrite (local.get $p) (i32.const 3000128)))

    ;; ── Emit subtitle (if present): BT /F2 12 Tf 50 776 Td (subtitle) Tj ET
    (if (i32.gt_s (local.get $stl) (i32.const 0))
      (then
        (local.set $p (call $zwrite (local.get $p) (i32.const 3005000)))
        (local.set $p (call $emit_pdf_literal (local.get $p) (local.get $stp) (local.get $stl)))
        (local.set $p (call $zwrite (local.get $p) (i32.const 3000128)))
        ;; Separator line (dashes): BT /F2 10 Tf 50 762 Td
        (local.set $p (call $zwrite (local.get $p) (i32.const 3005128)))
        ;; body starts at Y=745 when subtitle present
        (local.set $cur_y (i32.const 745))
      )
      (else
        ;; No subtitle: body starts at Y=755
        (local.set $cur_y (i32.const 755))
      )
    )

    ;; Open the BT block for this page's body text: BT /F2 11 Tf
    (local.set $p (call $zwrite (local.get $p) (i32.const 3000256)))

    (local.set $at_bol (i32.const 1))
    (local.set $llen (i32.const 0))
    (local.set $i (i32.const 0))

    (loop $chars
      (if (i32.lt_s (local.get $i) (local.get $body_len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $body) (local.get $i))))

          ;; ── Newline: flush current line buffer ──
          (if (i32.or (i32.eq (local.get $ch) (i32.const 10)) (i32.eq (local.get $ch) (i32.const 13)))
            (then
              (if (i32.gt_s (local.get $llen) (i32.const 0))
                (then
                  ;; flush line at current Y position
                  (local.set $p (call $emit_abs_line
                    (local.get $p)
                    (i32.const 62000) (local.get $llen)
                    (local.get $is_heading)
                    (local.get $cur_y)))
                  ;; advance Y downward
                  (if (local.get $is_heading)
                    (then (local.set $cur_y (i32.sub (local.get $cur_y) (local.get $line_h_head))))
                    (else (local.set $cur_y (i32.sub (local.get $cur_y) (local.get $line_h_body))))
                  )
                )
                (else
                  ;; blank line: paragraph gap
                  (local.set $cur_y (i32.sub (local.get $cur_y) (i32.const 8)))
                )
              )

              ;; reset line state
              (local.set $llen (i32.const 0))
              (local.set $at_bol (i32.const 1))
              (local.set $is_heading (i32.const 0))
              (local.set $word_start (i32.const 0))

              ;; ── page break check ──
              (if (i32.le_s (local.get $cur_y) (i32.const 60))
                (then
                  ;; close current page BT block and save stream length
                  (local.set $p (call $zwrite (local.get $p) (i32.const 3000384))) ;; "ET\n"
                  (local.set $sl (i32.sub (local.get $p) (local.get $ss)))
                  (i32.store (i32.add (i32.const 800000) (i32.mul (local.get $page) (i32.const 8))) (local.get $sl))
                  (local.set $page (i32.add (local.get $page) (i32.const 1)))
                  (if (i32.ge_s (local.get $page) (i32.const 64)) (then (return (i32.const 0))))
                  ;; start new page
                  (local.set $sp (i32.add (i32.const 120000) (i32.mul (local.get $page) (i32.const 15000))))
                  (local.set $ss (local.get $sp))
                  (local.set $p (local.get $sp))
                  ;; continuation header: small grey title watermark
                  (local.set $p (call $zwrite (local.get $p) (i32.const 3000448)))
                  (local.set $p (call $emit_pdf_literal (local.get $p) (local.get $tp) (local.get $tl)))
                  (local.set $p (call $zwrite (local.get $p) (i32.const 3000512)))
                  ;; reset color to black and open body BT
                  (local.set $p (call $zwrite (local.get $p) (i32.const 3000256)))
                  ;; body starts at Y=800 on continuation pages
                  (local.set $cur_y (i32.const 800))
                )
              )

              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $chars)
            )
          )

          ;; ── Beginning-of-line Markdown detection ──
          (if (local.get $at_bol)
            (then
              ;; Skip leading spaces/tabs at BOL
              (if (i32.or (i32.eq (local.get $ch) (i32.const 32)) (i32.eq (local.get $ch) (i32.const 9)))
                (then
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $chars)
                )
              )
              ;; # heading marker
              (if (i32.eq (local.get $ch) (i32.const 35)) ;; '#'
                (then
                  (local.set $is_heading (i32.const 1))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  ;; skip all consecutive '#' chars
                  (block $skip_hashes
                    (loop $sh
                      (if (i32.lt_s (local.get $i) (local.get $body_len))
                        (then
                          (local.set $ch (i32.load8_u (i32.add (local.get $body) (local.get $i))))
                          (if (i32.eq (local.get $ch) (i32.const 35))
                            (then
                              (local.set $i (i32.add (local.get $i) (i32.const 1)))
                              (br $sh)
                            )
                          )
                        )
                      )
                    )
                  )
                  ;; skip the space after #
                  (if (i32.lt_s (local.get $i) (local.get $body_len))
                    (then
                      (local.set $ch (i32.load8_u (i32.add (local.get $body) (local.get $i))))
                      (if (i32.eq (local.get $ch) (i32.const 32))
                        (then (local.set $i (i32.add (local.get $i) (i32.const 1))))
                      )
                    )
                  )
                  (local.set $at_bol (i32.const 0))
                  (br $chars)
                )
              )
              ;; list bullets: - or * at BOL
              (if (i32.or (i32.eq (local.get $ch) (i32.const 45))
                          (i32.or (i32.eq (local.get $ch) (i32.const 42))
                                  (i32.eq (local.get $ch) (i32.const 183)))) ;; - * ·
                (then
                  (i32.store8 (i32.add (local.get $lb) (local.get $llen)) (i32.const 45))
                  (local.set $llen (i32.add (local.get $llen) (i32.const 1)))
                  (local.set $at_bol (i32.const 0))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $chars)
                )
              )
              (local.set $at_bol (i32.const 0))
            )
          )

          ;; ── Markdown inline stripping ──
          ;; Strip **, *, __, _ (bold/italic markers), ` (code backtick)
          (if (i32.or (i32.eq (local.get $ch) (i32.const 42))   ;; '*'
                      (i32.or (i32.eq (local.get $ch) (i32.const 95))   ;; '_'
                              (i32.eq (local.get $ch) (i32.const 96)))) ;; '`'
            (then
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              ;; also skip second * or _ if present (** or __)
              (if (i32.lt_s (local.get $i) (local.get $body_len))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $body) (local.get $i))))
                  (if (i32.or (i32.eq (local.get $ch) (i32.const 42))
                              (i32.or (i32.eq (local.get $ch) (i32.const 95))
                                      (i32.eq (local.get $ch) (i32.const 96))))
                    (then (local.set $i (i32.add (local.get $i) (i32.const 1))))
                  )
                )
              )
              (br $chars)
            )
          )

          ;; ── Append char to line buffer ──
          (if (i32.lt_s (local.get $llen) (i32.const 2040))
            (then
              (i32.store8 (i32.add (local.get $lb) (local.get $llen)) (local.get $ch))
              (local.set $llen (i32.add (local.get $llen) (i32.const 1)))
              ;; track last space for soft word-wrap
              (if (i32.eq (local.get $ch) (i32.const 32))
                (then (local.set $word_start (local.get $llen)))
              )
            )
          )

          ;; ── Word-wrap check ──
          (if (i32.ge_s (local.get $llen) (local.get $wrap_at))
            (then
              (if (i32.gt_s (local.get $word_start) (i32.const 0))
                (then
                  ;; soft wrap at last space
                  (local.set $p (call $emit_abs_line
                    (local.get $p)
                    (i32.const 62000) (local.get $word_start)
                    (local.get $is_heading)
                    (local.get $cur_y)))
                  (local.set $cur_y (i32.sub (local.get $cur_y) (local.get $line_h_body)))
                  ;; shift remaining chars to front of buffer
                  (memory.copy (i32.const 62000)
                               (i32.add (local.get $lb) (local.get $word_start))
                               (i32.sub (local.get $llen) (local.get $word_start)))
                  (local.set $llen (i32.sub (local.get $llen) (local.get $word_start)))
                  (local.set $word_start (i32.const 0))
                  (local.set $is_heading (i32.const 0))
                )
                (else
                  ;; hard wrap at limit
                  (local.set $p (call $emit_abs_line
                    (local.get $p)
                    (i32.const 62000) (local.get $llen)
                    (local.get $is_heading)
                    (local.get $cur_y)))
                  (local.set $cur_y (i32.sub (local.get $cur_y) (local.get $line_h_body)))
                  (local.set $llen (i32.const 0))
                  (local.set $is_heading (i32.const 0))
                )
              )

              ;; page break check after wrap
              (if (i32.le_s (local.get $cur_y) (i32.const 60))
                (then
                  (local.set $p (call $zwrite (local.get $p) (i32.const 3000384))) ;; "ET\n"
                  (local.set $sl (i32.sub (local.get $p) (local.get $ss)))
                  (i32.store (i32.add (i32.const 800000) (i32.mul (local.get $page) (i32.const 8))) (local.get $sl))
                  (local.set $page (i32.add (local.get $page) (i32.const 1)))
                  (if (i32.ge_s (local.get $page) (i32.const 64)) (then (return (i32.const 0))))
                  (local.set $sp (i32.add (i32.const 120000) (i32.mul (local.get $page) (i32.const 15000))))
                  (local.set $ss (local.get $sp))
                  (local.set $p (local.get $sp))
                  (local.set $p (call $zwrite (local.get $p) (i32.const 3000448)))
                  (local.set $p (call $emit_pdf_literal (local.get $p) (local.get $tp) (local.get $tl)))
                  (local.set $p (call $zwrite (local.get $p) (i32.const 3000512)))
                  (local.set $p (call $zwrite (local.get $p) (i32.const 3000256)))
                  (local.set $cur_y (i32.const 800))
                )
              )
            )
          )

          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $chars)
        )
      )
    )

    ;; flush last line if any
    (if (i32.gt_s (local.get $llen) (i32.const 0))
      (then
        (local.set $p (call $emit_abs_line
          (local.get $p)
          (i32.const 62000) (local.get $llen)
          (local.get $is_heading)
          (local.get $cur_y)))
      )
    )

    ;; close final page BT block
    (local.set $p (call $zwrite (local.get $p) (i32.const 3000384))) ;; "ET\n"
    (local.set $sl (i32.sub (local.get $p) (local.get $ss)))
    (i32.store (i32.add (i32.const 800000) (i32.mul (local.get $page) (i32.const 8))) (local.get $sl))
    (global.set $page_count (i32.add (local.get $page) (i32.const 1)))

    ;; ── Page footers: custom footer text + page number ───────────────────
    (local.set $i (i32.const 0))
    (loop $footers
      (if (i32.lt_s (local.get $i) (global.get $page_count))
        (then
          (local.set $sp (i32.add (i32.const 120000) (i32.mul (local.get $i) (i32.const 15000))))
          (local.set $sl (i32.load (i32.add (i32.const 800000) (i32.mul (local.get $i) (i32.const 8)))))
          (local.set $p (i32.add (local.get $sp) (local.get $sl)))

          ;; Custom footer text (if present): BT /F2 9 Tf 0.4 0.4 0.4 rg 50 42 Td (footer) Tj ET
          (if (i32.gt_s (local.get $ftl) (i32.const 0))
            (then
              (local.set $p (call $zwrite (local.get $p) (i32.const 3005256)))
              (local.set $p (call $emit_pdf_literal (local.get $p) (local.get $ftp) (local.get $ftl)))
              (local.set $p (call $zwrite (local.get $p) (i32.const 3003840)))
            )
          )

          ;; Page number: BT /F2 9 Tf 0.5 0.5 0.5 rg 260 24 Td (Pagina X de Y) Tj ET
          (local.set $p (call $zwrite (local.get $p) (i32.const 3003584)))
          (local.set $p (call $write_int (local.get $p) (i32.add (local.get $i) (i32.const 1))))
          (local.set $p (call $zwrite (local.get $p) (i32.const 3003712)))
          (local.set $p (call $write_int (local.get $p) (global.get $page_count)))
          (local.set $p (call $zwrite (local.get $p) (i32.const 3003840)))

          (local.set $sl (i32.sub (local.get $p) (local.get $sp)))
          (i32.store (i32.add (i32.const 800000) (i32.mul (local.get $i) (i32.const 8))) (local.get $sl))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $footers)
        )
      )
    )

    ;; ── PDF object tree ───────────────────────────────────────────────────
    (local.set $p (i32.const 1000000))
    (local.set $p (call $zwrite (local.get $p) (i32.const 3000896)))
    (i32.store (i32.const 801004) (i32.sub (local.get $p) (i32.const 1000000)))
    (local.set $p (call $zwrite (local.get $p) (i32.const 3001024)))
    (i32.store (i32.const 801008) (i32.sub (local.get $p) (i32.const 1000000)))
    (local.set $p (call $zwrite (local.get $p) (i32.const 3001152)))
    (local.set $i (i32.const 0))
    (loop $kids
      (if (i32.lt_s (local.get $i) (global.get $page_count))
        (then
          (local.set $obj (i32.add (i32.const 5) (i32.mul (local.get $i) (i32.const 2))))
          (local.set $p (call $write_int (local.get $p) (local.get $obj)))
          (local.set $p (call $zwrite (local.get $p) (i32.const 3001280)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $kids)
        )
      )
    )
    (local.set $p (call $zwrite (local.get $p) (i32.const 3001408)))
    (local.set $p (call $write_int (local.get $p) (global.get $page_count)))
    (local.set $p (call $zwrite (local.get $p) (i32.const 3003200)))
    (i32.store (i32.const 801012) (i32.sub (local.get $p) (i32.const 1000000)))
    (local.set $p (call $zwrite (local.get $p) (i32.const 3001536)))
    (i32.store (i32.const 801016) (i32.sub (local.get $p) (i32.const 1000000)))
    (local.set $p (call $zwrite (local.get $p) (i32.const 3001664)))
    (local.set $i (i32.const 0))
    (loop $objects
      (if (i32.lt_s (local.get $i) (global.get $page_count))
        (then
          (local.set $obj (i32.add (i32.const 5) (i32.mul (local.get $i) (i32.const 2))))
          (local.set $sid (i32.add (local.get $obj) (i32.const 1)))
          (i32.store (i32.add (i32.const 801000) (i32.mul (local.get $obj) (i32.const 4)))
            (i32.sub (local.get $p) (i32.const 1000000)))
          (local.set $p (call $write_int (local.get $p) (local.get $obj)))
          (local.set $p (call $zwrite (local.get $p) (i32.const 3001792)))
          (local.set $p (call $write_int (local.get $p) (local.get $sid)))
          (local.set $p (call $zwrite (local.get $p) (i32.const 3001920)))
          (i32.store (i32.add (i32.const 801000) (i32.mul (local.get $sid) (i32.const 4)))
            (i32.sub (local.get $p) (i32.const 1000000)))
          (local.set $p (call $write_int (local.get $p) (local.get $sid)))
          (local.set $p (call $zwrite (local.get $p) (i32.const 3002048)))
          (local.set $sp (i32.add (i32.const 120000) (i32.mul (local.get $i) (i32.const 15000))))
          (local.set $sl (i32.load (i32.add (i32.const 800000) (i32.mul (local.get $i) (i32.const 8)))))
          (local.set $p (call $write_int (local.get $p) (local.get $sl)))
          (local.set $p (call $zwrite (local.get $p) (i32.const 3002176)))
          (local.set $p (call $write_str (local.get $p) (local.get $sp) (local.get $sl)))
          (local.set $p (call $zwrite (local.get $p) (i32.const 3002304)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $objects)
        )
      )
    )
    (local.set $xref (i32.sub (local.get $p) (i32.const 1000000)))
    (local.set $size (i32.add (i32.const 5) (i32.mul (global.get $page_count) (i32.const 2))))
    (local.set $p (call $zwrite (local.get $p) (i32.const 3002432)))
    (local.set $p (call $write_int (local.get $p) (local.get $size)))
    (local.set $p (call $zwrite (local.get $p) (i32.const 3002560)))
    (local.set $i (i32.const 1))
    (loop $xref_entries
      (if (i32.lt_s (local.get $i) (local.get $size))
        (then
          (local.set $off (i32.load (i32.add (i32.const 801000) (i32.mul (local.get $i) (i32.const 4)))))
          (local.set $p (call $write_padded10 (local.get $p) (local.get $off)))
          (local.set $p (call $zwrite (local.get $p) (i32.const 3002688)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $xref_entries)
        )
      )
    )
    (local.set $p (call $zwrite (local.get $p) (i32.const 3002816)))
    (local.set $p (call $write_int (local.get $p) (local.get $size)))
    (local.set $p (call $zwrite (local.get $p) (i32.const 3002944)))
    (local.set $p (call $write_int (local.get $p) (local.get $xref)))
    (local.set $p (call $zwrite (local.get $p) (i32.const 3003072)))
    (i32.sub (local.get $p) (i32.const 1000000))
  )

  ;; ── emit_abs_line ─────────────────────────────────────────────────────────
  ;; Emits a single text line at absolute position (X=50, Y=cur_y).
  ;; Uses "50 Y Td (text) Tj\n" within an already-open BT block.
  ;; For headings: switches font to F1 14pt, emits, then switches back to F2 11pt.
  ;; For body: uses current font (F2 11pt assumed open).
  (func $emit_abs_line
        (param $p i32)
        (param $src i32)
        (param $len i32)
        (param $is_heading i32)
        (param $cur_y i32)
        (result i32)
    (local $j i32) (local $ch i32)

    (if (i32.eqz (local.get $len)) (then (return (local.get $p))))

    ;; Emit position: "50 Y Td\n"
    (i32.store8 (local.get $p) (i32.const 53))  ;; '5'
    (i32.store8 (i32.add (local.get $p) (i32.const 1)) (i32.const 48))  ;; '0'
    (i32.store8 (i32.add (local.get $p) (i32.const 2)) (i32.const 32))  ;; ' '
    (local.set $p (i32.add (local.get $p) (i32.const 3)))
    ;; Write Y value
    (local.set $p (call $write_int (local.get $p) (local.get $cur_y)))
    ;; Write " Td\n"
    (local.set $p (call $zwrite (local.get $p) (i32.const 3004000)))

    ;; For headings: switch to F1 Bold temporarily
    (if (local.get $is_heading)
      (then
        ;; "/F1 14 Tf\n"
        (local.set $p (call $zwrite (local.get $p) (i32.const 3004064)))
      )
    )

    ;; Emit "(text) Tj\n"
    (i32.store8 (local.get $p) (i32.const 40))  ;; '('
    (local.set $p (i32.add (local.get $p) (i32.const 1)))
    (local.set $j (i32.const 0))
    (loop $emit_ch
      (if (i32.lt_s (local.get $j) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $j))))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 40))
                      (i32.or (i32.eq (local.get $ch) (i32.const 41)) (i32.eq (local.get $ch) (i32.const 92))))
            (then (i32.store8 (local.get $p) (i32.const 92)) (local.set $p (i32.add (local.get $p) (i32.const 1))))
          )
          (i32.store8 (local.get $p) (local.get $ch))
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          (br $emit_ch)
        )
      )
    )
    ;; ") Tj\n"
    (local.set $p (call $zwrite (local.get $p) (i32.const 3004128)))

    ;; For headings: switch back to body font "/F2 11 Tf\n"
    (if (local.get $is_heading)
      (then
        (local.set $p (call $zwrite (local.get $p) (i32.const 3004192)))
      )
    )

    (local.get $p)
  )

  ;; ══════════════════════════════════════════════════════════════════════════
  ;; ENTRYPOINT
  ;; ══════════════════════════════════════════════════════════════════════════
  (func (export "pdf_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $pdf_len i32) (local $b64_len i32)
    (local $req_p i32) (local $req_len i32)
    (local $idx i32)
    (local $t_start i32) (local $t_len i32)
    (local $st_start i32) (local $st_len i32)   ;; subtitle
    (local $c_start i32) (local $c_len i32)
    (local $ft_start i32) (local $ft_len i32)   ;; footer
    (local $fname_len i32) (local $ch i32)
    (local $ta_len i32) (local $sta_len i32) (local $la i32) (local $fta_len i32)

    ;; 1. Empty input → usage hint
    (if (i32.eqz (local.get $in_len))
      (then
        (local.set $req_len (call $zlen (i32.const 50600)))
        (memory.copy (i32.const 1024) (i32.const 50600) (local.get $req_len))
        (return (local.get $req_len))
      )
    )

    ;; 2. Defaults — title and content have fallback strings; subtitle/footer empty
    (local.set $t_start  (i32.const 52500))
    (local.set $t_len    (i32.const 13))
    (local.set $st_start (i32.const 0))
    (local.set $st_len   (i32.const 0))
    (local.set $c_start  (i32.const 52520))
    (local.set $c_len    (i32.const 84))
    (local.set $ft_start (i32.const 0))
    (local.set $ft_len   (i32.const 0))

    ;; 3. Parse JSON {"title":"...","subtitle":"...","content":"...","footer":"..."}
    (if (i32.eq (i32.load8_u (local.get $in_ptr)) (i32.const 123)) ;; '{'
      (then
        ;; ── title ──
        (local.set $idx (call $find_sub (local.get $in_ptr) (local.get $in_len) (i32.const 52700) (i32.const 9)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            ;; pointer to first byte AFTER the opening quote
            (local.set $t_start (i32.add (i32.add (local.get $in_ptr) (local.get $idx)) (i32.const 9)))
            (local.set $t_len
              (call $parse_json_string
                (local.get $t_start)
                (i32.sub (local.get $in_len) (i32.add (local.get $idx) (i32.const 9)))
                (i32.const 33000)   ;; temp decode buffer (unused later, overwritten by sanitize)
                (i32.const 255)))
            ;; For title we use the raw escaped bytes (sanitize_ascii handles \n etc.)
            ;; but we need the raw pointer in the input buffer; $t_start already set correctly.
            ;; Recompute t_len using old simple scan (title rarely has quotes inside)
            (local.set $t_len (i32.const 0))
            (loop $stl2
              (if (i32.lt_s (i32.add (local.get $t_start) (local.get $t_len)) (i32.add (local.get $in_ptr) (local.get $in_len)))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $t_start) (local.get $t_len))))
                  (if (i32.and (i32.ne (local.get $ch) (i32.const 34))
                               (i32.ne (local.get $ch) (i32.const 0)))
                    (then (local.set $t_len (i32.add (local.get $t_len) (i32.const 1))) (br $stl2))
                  )
                )
              )
            )
          )
        )

        ;; ── subtitle ──
        (local.set $idx (call $find_sub (local.get $in_ptr) (local.get $in_len) (i32.const 52740) (i32.const 12)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (local.set $st_start (i32.add (i32.add (local.get $in_ptr) (local.get $idx)) (i32.const 12)))
            (local.set $st_len (i32.const 0))
            (loop $sstl
              (if (i32.lt_s (i32.add (local.get $st_start) (local.get $st_len)) (i32.add (local.get $in_ptr) (local.get $in_len)))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $st_start) (local.get $st_len))))
                  (if (i32.and (i32.ne (local.get $ch) (i32.const 34))
                               (i32.ne (local.get $ch) (i32.const 0)))
                    (then (local.set $st_len (i32.add (local.get $st_len) (i32.const 1))) (br $sstl))
                  )
                )
              )
            )
          )
        )

        ;; ── content (uses improved parser that handles \" inside) ──
        (local.set $idx (call $find_sub (local.get $in_ptr) (local.get $in_len) (i32.const 52720) (i32.const 11)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (local.set $c_start (i32.add (i32.add (local.get $in_ptr) (local.get $idx)) (i32.const 11)))
            ;; Use parse_json_string to correctly handle \" inside content
            ;; We write the decoded content directly to 70000 and set c_len
            (local.set $c_len
              (call $parse_json_string
                (local.get $c_start)
                (i32.sub (local.get $in_len) (i32.add (local.get $idx) (i32.const 11)))
                (i32.const 70000)
                (i32.const 80000)))
            ;; c_start now points to 70000 (already decoded), skip sanitize for body
            (local.set $c_start (i32.const 70000))
          )
        )

        ;; ── footer ──
        (local.set $idx (call $find_sub (local.get $in_ptr) (local.get $in_len) (i32.const 52760) (i32.const 10)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (local.set $ft_start (i32.add (i32.add (local.get $in_ptr) (local.get $idx)) (i32.const 10)))
            (local.set $ft_len (i32.const 0))
            (loop $sftl
              (if (i32.lt_s (i32.add (local.get $ft_start) (local.get $ft_len)) (i32.add (local.get $in_ptr) (local.get $in_len)))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $ft_start) (local.get $ft_len))))
                  (if (i32.and (i32.ne (local.get $ch) (i32.const 34))
                               (i32.ne (local.get $ch) (i32.const 0)))
                    (then (local.set $ft_len (i32.add (local.get $ft_len) (i32.const 1))) (br $sftl))
                  )
                )
              )
            )
          )
        )
      )
      (else
        ;; Raw text mode
        (local.set $t_start  (local.get $in_ptr))
        (local.set $t_len    (local.get $in_len))
        (local.set $c_start  (local.get $in_ptr))
        (local.set $c_len    (local.get $in_len))
      )
    )

    ;; 4. Sanitize title → 32000, subtitle → 32256, footer → 32512
    ;;    Body is already decoded at 70000 when JSON mode; sanitize it in-place via temp area
    (local.set $ta_len  (call $sanitize_ascii (local.get $t_start)  (local.get $t_len)  (i32.const 32000) (i32.const 256)))
    (local.set $sta_len (call $sanitize_ascii (local.get $st_start) (local.get $st_len) (i32.const 32256) (i32.const 256)))
    (local.set $fta_len (call $sanitize_ascii (local.get $ft_start) (local.get $ft_len) (i32.const 32512) (i32.const 256)))

    ;; Body: if already decoded at 70000 ($c_start == 70000), skip re-sanitize
    ;; If raw text mode, sanitize normally
    (if (i32.eq (local.get $c_start) (i32.const 70000))
      (then
        ;; Already decoded UTF-8 escapes; sanitize multi-byte UTF-8 in place
        ;; Copy to temp 33000 area, sanitize back to 70000
        (memory.copy (i32.const 33000) (i32.const 70000) (local.get $c_len))
        (local.set $la (call $sanitize_ascii (i32.const 33000) (local.get $c_len) (i32.const 70000) (i32.const 80000)))
      )
      (else
        (local.set $la (call $sanitize_ascii (local.get $c_start) (local.get $c_len) (i32.const 70000) (i32.const 80000)))
      )
    )

    ;; 5. Build filename from sanitized title (at 49408)
    (local.set $idx (i32.const 0))
    (local.set $fname_len (i32.const 0))
    (loop $fn
      (if (i32.and (i32.lt_s (local.get $idx) (local.get $ta_len)) (i32.lt_s (local.get $fname_len) (i32.const 30)))
        (then
          (local.set $ch (i32.load8_u (i32.add (i32.const 32000) (local.get $idx))))
          ;; Transliterate Spanish chars for portable filenames
          (if (i32.or (i32.eq (local.get $ch) (i32.const 193)) (i32.eq (local.get $ch) (i32.const 225))) (then (local.set $ch (i32.const 97))))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 201)) (i32.eq (local.get $ch) (i32.const 233))) (then (local.set $ch (i32.const 101))))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 205)) (i32.eq (local.get $ch) (i32.const 237))) (then (local.set $ch (i32.const 105))))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 211)) (i32.eq (local.get $ch) (i32.const 243))) (then (local.set $ch (i32.const 111))))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 218)) (i32.eq (local.get $ch) (i32.const 250))) (then (local.set $ch (i32.const 117))))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 209)) (i32.eq (local.get $ch) (i32.const 241))) (then (local.set $ch (i32.const 110))))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 220)) (i32.eq (local.get $ch) (i32.const 252))) (then (local.set $ch (i32.const 117))))
          (if (i32.and (i32.ge_s (local.get $ch) (i32.const 65)) (i32.le_s (local.get $ch) (i32.const 90)))
            (then (local.set $ch (i32.add (local.get $ch) (i32.const 32))))
          )
          (if (i32.or
                (i32.and (i32.ge_s (local.get $ch) (i32.const 97)) (i32.le_s (local.get $ch) (i32.const 122)))
                (i32.and (i32.ge_s (local.get $ch) (i32.const 48)) (i32.le_s (local.get $ch) (i32.const 57))))
            (then
              (i32.store8 (i32.add (i32.const 49408) (local.get $fname_len)) (local.get $ch))
              (local.set $fname_len (i32.add (local.get $fname_len) (i32.const 1)))
            )
            (else
              (if (i32.eq (local.get $ch) (i32.const 32))
                (then
                  (i32.store8 (i32.add (i32.const 49408) (local.get $fname_len)) (i32.const 95))
                  (local.set $fname_len (i32.add (local.get $fname_len) (i32.const 1)))
                )
              )
            )
          )
          (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
          (br $fn)
        )
      )
    )
    (if (i32.eqz (local.get $fname_len))
      (then
        (memory.copy (i32.const 49408) (i32.const 52800) (i32.const 9))
        (local.set $fname_len (i32.const 9))
      )
    )
    (memory.copy (i32.add (i32.const 49408) (local.get $fname_len)) (i32.const 52810) (i32.const 4))
    (local.set $fname_len (i32.add (local.get $fname_len) (i32.const 4)))
    (global.set $fname_len (local.get $fname_len))

    ;; 6. Assemble PDF and base64-encode
    (local.set $pdf_len (call $assemble_dynamic_pdf
      (i32.const 32000) (local.get $ta_len)
      (i32.const 32256) (local.get $sta_len)
      (i32.const 70000) (local.get $la)
      (i32.const 32512) (local.get $fta_len)
    ))
    (if (i32.eqz (local.get $pdf_len)) (then (return (i32.const 0))))
    (local.set $b64_len (call $b64_encode (i32.const 1000000) (local.get $pdf_len) (i32.const 1700000)))

    ;; 7. Build files.write request at 2048
    (local.set $req_p (i32.const 2048))
    (local.set $req_p (call $write_str (local.get $req_p) (i32.const 50100) (i32.const 54)))
    (local.set $req_p (call $write_str (local.get $req_p) (i32.const 49408) (local.get $fname_len)))
    (local.set $req_p (call $write_str (local.get $req_p) (i32.const 50200) (i32.const 13)))
    (local.set $req_p (call $write_str (local.get $req_p) (i32.const 1700000) (local.get $b64_len)))
    (local.set $req_p (call $write_str (local.get $req_p) (i32.const 50250) (i32.const 23)))
    (local.set $req_len (i32.sub (local.get $req_p) (i32.const 2048)))

    ;; 8. Dispatch async host_call
    (drop (call $host_call
      (i32.const 2048) (local.get $req_len)
      (i32.const 4096) (i32.const 4096)
    ))
    (i32.const 0)
  )

  ;; ══════════════════════════════════════════════════════════════════════════
  ;; RESUME
  ;; ══════════════════════════════════════════════════════════════════════════
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $idx i32) (local $h_start i32) (local $ch i32)
    (local $out_p i32)

    (local.set $idx (call $find_sub (local.get $res_ptr) (local.get $res_len) (i32.const 52830) (i32.const 10)))
    (if (i32.ge_s (local.get $idx) (i32.const 0))
      (then
        (local.set $h_start (i32.add (i32.add (local.get $res_ptr) (local.get $idx)) (i32.const 10)))
        (global.set $handle_len (i32.const 0))
        (loop $sh
          (if (i32.lt_s (global.get $handle_len) (i32.const 40))
            (then
              (local.set $ch (i32.load8_u (i32.add (local.get $h_start) (global.get $handle_len))))
              (if (i32.ne (local.get $ch) (i32.const 34))
                (then
                  (i32.store8 (i32.add (i32.const 49664) (global.get $handle_len)) (local.get $ch))
                  (global.set $handle_len (i32.add (global.get $handle_len) (i32.const 1)))
                  (br $sh)
                )
              )
            )
          )
        )
      )
    )

    (local.set $out_p (i32.const 1024))
    (if (i32.eqz (global.get $handle_len))
      (then
        (local.set $out_p (call $write_str (local.get $out_p) (i32.const 53200) (i32.const 117)))
        (return (i32.sub (local.get $out_p) (i32.const 1024)))
      )
    )

    (local.set $out_p (call $write_str (local.get $out_p) (i32.const 52850) (i32.const 32)))
    (local.set $out_p (call $write_str (local.get $out_p) (i32.const 52882) (i32.const 7)))
    (local.set $out_p (call $write_str (local.get $out_p) (i32.const 49408) (global.get $fname_len)))
    (local.set $out_p (call $write_str (local.get $out_p) (i32.const 52900) (i32.const 76)))
    (local.set $out_p (call $write_str (local.get $out_p) (i32.const 49664) (global.get $handle_len)))
    (local.set $out_p (call $write_str (local.get $out_p) (i32.const 52990) (i32.const 14)))
    (local.set $out_p (call $write_str (local.get $out_p) (i32.const 49408) (global.get $fname_len)))
    (local.set $out_p (call $write_str (local.get $out_p) (i32.const 53100) (i32.const 2)))
    (i32.sub (local.get $out_p) (i32.const 1024))
  )

  ;; ── Static data sections ──────────────────────────────────────────────────

  ;; Fallback defaults
  (data (i32.const 52500) "Documento PDF")
  (data (i32.const 52520) "1. Introduccion: Este documento fue elaborado automaticamente por Chattree AI.")

  ;; JSON keys
  (data (i32.const 52700) "\"title\":\"")
  (data (i32.const 52720) "\"content\":\"")
  (data (i32.const 52740) "\"subtitle\":\"")
  (data (i32.const 52760) "\"footer\":\"")
  (data (i32.const 52800) "documento")
  (data (i32.const 52810) ".pdf")
  (data (i32.const 52830) "\"handle\":\"")

  ;; files.write request parts
  (data (i32.const 50100) "{\"api\":\"files\",\"operation\":\"write\",\"payload\":{\"name\":\"")
  (data (i32.const 50200) "\",\"content\":\"")
  (data (i32.const 50250) "\",\"encoding\":\"base64\"}}")

  ;; Usage hint
  (data (i32.const 50600) "Usa /pdf <tema> para crear un documento PDF. La IA redacta el contenido y el plugin ajusta las paginas al texto.\00")

  ;; Output JSON parts
  (data (i32.const 52850) "{\"type\":\"direct\",\"displayText\":\"")
  (data (i32.const 52882) "\f0\9f\93\84 **")
  (data (i32.const 52900) "** generado con exito\\n\\nListo para descargar desde el chat.\",\"fileHandle\":\"")
  (data (i32.const 52990) "\",\"fileName\":\"")
  (data (i32.const 53100) "\"}")
  (data (i32.const 53200) "{\"type\":\"error\",\"errorMessage\":\"No se pudo guardar el PDF. Verifica que el plugin tiene permiso files.write.\"}")

  ;; ── PDF page stream fragments (NUL-terminated) ────────────────────────────

  ;; Page 1: title block — BT, F1 Bold 16pt, position at top
  (data (i32.const 3000000) "BT\n/F1 16 Tf\n50 800 Td\n(\00")
  ;; Close title/subtitle Tj block
  (data (i32.const 3000128) ") Tj\nET\n\00")
  ;; Close title block (legacy pad)
  (data (i32.const 3000192) "ET\n\00")
  ;; Open body BT with font (used at start of each page body)
  (data (i32.const 3000256) "BT\n/F2 11 Tf\n\00")
  ;; Close body BT at end of page
  (data (i32.const 3000384) "ET\n\00")
  ;; Continuation page watermark header: small grey title
  (data (i32.const 3000448) "BT\n/F2 8 Tf\n0.6 0.6 0.6 rg\n50 825 Td\n(\00")
  ;; Close watermark BT
  (data (i32.const 3000512) ") Tj\nET\n0 g\n\00")

  ;; PDF object fragments
  (data (i32.const 3000896) "%PDF-1.4\n%\e2\e3\cf\d3\n\00")
  (data (i32.const 3001024) "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n\00")
  (data (i32.const 3001152) "2 0 obj\n<< /Type /Pages /Kids [\00")
  (data (i32.const 3001280) " 0 R \00")
  (data (i32.const 3001408) "] /Count \00")
  (data (i32.const 3001536) "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n\00")
  (data (i32.const 3001664) "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n\00")
  (data (i32.const 3001792) " 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents \00")
  (data (i32.const 3001920) " 0 R >>\nendobj\n\00")
  (data (i32.const 3002048) " 0 obj\n<< /Length \00")
  (data (i32.const 3002176) " >>\nstream\n\00")
  (data (i32.const 3002304) "\nendstream\nendobj\n\00")
  (data (i32.const 3002432) "xref\n0 \00")
  (data (i32.const 3002560) "\n0000000000 65535 f \n\00")
  (data (i32.const 3002688) " 00000 n \n\00")
  (data (i32.const 3002816) "trailer\n<< /Size \00")
  (data (i32.const 3002944) " /Root 1 0 R >>\nstartxref\n\00")
  (data (i32.const 3003072) "\n%%EOF\n\00")
  (data (i32.const 3003200) " >>\nendobj\n\00")

  ;; Page number footer (appended at end of each page stream)
  (data (i32.const 3003584) "BT\n/F2 9 Tf\n0.5 0.5 0.5 rg\n260 24 Td\n(Pagina \00")
  (data (i32.const 3003712) " de \00")
  (data (i32.const 3003840) ") Tj\nET\n\00")

  ;; emit_abs_line helpers
  (data (i32.const 3004000) " Td\n\00")
  (data (i32.const 3004064) "/F1 14 Tf\n\00")
  (data (i32.const 3004128) ") Tj\n\00")
  (data (i32.const 3004192) "/F2 11 Tf\n\00")

  ;; ── Subtitle block: BT /F2 12 Tf 50 776 Td (
  (data (i32.const 3005000) "BT\n/F2 12 Tf\n50 776 Td\n(\00")
  ;; Separator after subtitle: BT /F2 10 Tf 50 762 Td (----...) Tj ET\n
  (data (i32.const 3005128) "BT\n/F2 10 Tf\n0.6 0.6 0.6 rg\n50 762 Td\n(------------------------------------------------------------------------) Tj\nET\n0 g\n\00")

  ;; Custom footer text block: BT /F2 9 Tf 0.4 0.4 0.4 rg 50 42 Td (
  (data (i32.const 3005256) "BT\n/F2 9 Tf\n0.4 0.4 0.4 rg\n50 42 Td\n(\00")
)
