;; Chattree Official PDF Generator Plugin — WebAssembly Text format
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
;;   0     input string (AI JSON / raw text)
;;   1024  output string (ToolResult JSON returned to chat)
;;   2048  host_call request JSON
;;   4096  host_call response JSON (4096 bytes max)
;;   8192  raw PDF bytes
;;   24576 base64-encoded PDF bytes
;;   32000 WinAnsi title  (80 bytes)
;;   32100 WinAnsi page-1 (900 bytes)
;;   33000 WinAnsi page-2 (900 bytes)
;;   49408 filename buffer         (35 bytes)
;;   49664 handle buffer           (40 bytes)

(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  (memory (export "memory") 4)

  (global $fname_len  (mut i32) (i32.const 0))
  (global $handle_len (mut i32) (i32.const 0))

  ;; Base64 alphabet at 50000
  (data (i32.const 50000) "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/")

  ;; files.write request parts
  ;; {"api":"files","operation":"write","payload":{"name":"   (54 bytes)
  (data (i32.const 50100) "{\"api\":\"files\",\"operation\":\"write\",\"payload\":{\"name\":\"")
  ;; ","content":"  (13 bytes)
  (data (i32.const 50200) "\",\"content\":\"")
  ;; ","encoding":"base64"}}  (23 bytes)
  (data (i32.const 50250) "\",\"encoding\":\"base64\"}}")

  ;; Usage hint (shown when called with empty input)  ≈ 260 bytes
  (data (i32.const 50600) "Usa /pdf <tema> para generar un PDF de 2 paginas. Ejemplo: /pdf fotosintesis. El archivo aparecera en el chat listo para descargar.")

  ;; ── find_sub ─────────────────────────────────────────────────────────────
  (func $find_sub (param $hay i32) (param $hlen i32) (param $ndl i32) (param $nlen i32) (result i32)
    (local $i i32) (local $j i32) (local $ok i32) (local $lim i32)
    (if (i32.lt_s (local.get $hlen) (local.get $nlen)) (then (return (i32.const -1))))
    (local.set $lim (i32.add (i32.sub (local.get $hlen) (local.get $nlen)) (i32.const 1)))
    (local.set $i (i32.const 0))
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

  ;; ── write_str ────────────────────────────────────────────────────────────
  (func $write_str (param $dst i32) (param $src i32) (param $len i32) (result i32)
    (memory.copy (local.get $dst) (local.get $src) (local.get $len))
    (i32.add (local.get $dst) (local.get $len))
  )

  ;; ── write_int ────────────────────────────────────────────────────────────
  (func $write_int (param $dst i32) (param $val i32) (result i32)
    (local $buf i32) (local $cnt i32) (local $tmp i32) (local $dig i32)
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

  ;; ── write_padded10 ───────────────────────────────────────────────────────
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

  ;; ── base64 encoder ───────────────────────────────────────────────────────
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

  ;; Convert UTF-8 Spanish characters to Windows-1252 bytes used by Helvetica.
  ;; Unknown UTF-8 code points are replaced by '?' without leaking continuation bytes.
  (func $sanitize_ascii (param $src i32) (param $slen i32) (param $dst i32) (param $max i32) (result i32)
    (local $i i32) (local $out i32) (local $ch i32) (local $next i32) (local $mapped i32)
    (loop $lp
      (if (i32.and (i32.lt_s (local.get $i) (local.get $slen)) (i32.lt_s (local.get $out) (local.get $max)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (local.set $mapped (i32.const 0))
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
                )
              )
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
            )
          )
          (if (i32.ge_u (local.get $ch) (i32.const 192))
            (then
              (if (i32.eqz (local.get $mapped)) (then (local.set $mapped (i32.const 63))))
              (i32.store8 (i32.add (local.get $dst) (local.get $out)) (local.get $mapped))
              (local.set $out (i32.add (local.get $out) (i32.const 1)))
            )
            (else
              (if (i32.ge_u (local.get $ch) (i32.const 128))
                (then)
                (else
                  (i32.store8 (i32.add (local.get $dst) (local.get $out)) (local.get $ch))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                )
              )
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $lp)
        )
      )
    )
    (local.get $out)
  )
  ;; ── assemble_pdf ─────────────────────────────────────────────────────────
  ;; Text streams use ASCII syntax and WinAnsi text bytes.
  ;; Returns byte length of PDF written at OFF_PDF (8192).
  (func $assemble_pdf (param $tp i32) (param $tl i32)
                      (param $p1 i32) (param $l1 i32)
                      (param $p2 i32) (param $l2 i32) (result i32)
    (local $p i32)
    (local $s1s i32) (local $s1l i32)
    (local $s2s i32) (local $s2l i32)
    (local $xp i32)
    (local $o1 i32) (local $o2 i32) (local $o3 i32) (local $o4 i32)
    (local $o5 i32) (local $o6 i32) (local $o7 i32) (local $o8 i32)
    (local $i i32) (local $ch i32) (local $lc i32)

    ;; ── Stream 1 (page 1) at 35000 ──
    (local.set $s1s (i32.const 35000))
    (local.set $p   (i32.const 35000))
    ;; "BT\n/F1 16 Tf\n50 780 Td\n("
    (local.set $p (call $write_str (local.get $p) (i32.const 51000) (i32.const 23)))
    (local.set $p (call $write_str (local.get $p) (local.get $tp) (local.get $tl)))
    ;; ") Tj\nET\n<divider>\nBT\n/F2 9 Tf ... (190 bytes)
    (local.set $p (call $write_str (local.get $p) (i32.const 51100) (i32.const 190)))

    (local.set $i (i32.const 0))
    (local.set $lc (i32.const 0))
    (loop $t1
      (if (i32.lt_s (local.get $i) (local.get $l1))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $p1) (local.get $i))))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 40)) (i32.eq (local.get $ch) (i32.const 41)))
            (then (i32.store8 (local.get $p) (i32.const 92)) (local.set $p (i32.add (local.get $p) (i32.const 1))))
          )
          (if (i32.or (i32.eq (local.get $ch) (i32.const 10)) (i32.eq (local.get $ch) (i32.const 13)))
            (then
              (local.set $p (call $write_str (local.get $p) (i32.const 51300) (i32.const 5)))
              (local.set $lc (i32.const 0))
            )
            (else
              (i32.store8 (local.get $p) (local.get $ch))
              (local.set $p (i32.add (local.get $p) (i32.const 1)))
              (local.set $lc (i32.add (local.get $lc) (i32.const 1)))
              (if (i32.and (i32.ge_s (local.get $lc) (i32.const 65)) (i32.eq (local.get $ch) (i32.const 32)))
                (then (local.set $p (call $write_str (local.get $p) (i32.const 51300) (i32.const 5))) (local.set $lc (i32.const 0)))
              )
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $t1)
        )
      )
    )
    ;; footer page 1 (69 bytes)
    (local.set $p (call $write_str (local.get $p) (i32.const 51310) (i32.const 69)))
    (local.set $s1l (i32.sub (local.get $p) (local.get $s1s)))

    ;; ── Stream 2 (page 2) at 42000 ──
    (local.set $s2s (i32.const 42000))
    (local.set $p   (i32.const 42000))
    (local.set $p (call $write_str (local.get $p) (i32.const 51000) (i32.const 23)))
    (local.set $p (call $write_str (local.get $p) (local.get $tp) (local.get $tl)))
    (local.set $p (call $write_str (local.get $p) (i32.const 51200) (i32.const 190)))

    (local.set $i (i32.const 0))
    (local.set $lc (i32.const 0))
    (loop $t2
      (if (i32.lt_s (local.get $i) (local.get $l2))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $p2) (local.get $i))))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 40)) (i32.eq (local.get $ch) (i32.const 41)))
            (then (i32.store8 (local.get $p) (i32.const 92)) (local.set $p (i32.add (local.get $p) (i32.const 1))))
          )
          (if (i32.or (i32.eq (local.get $ch) (i32.const 10)) (i32.eq (local.get $ch) (i32.const 13)))
            (then
              (local.set $p (call $write_str (local.get $p) (i32.const 51300) (i32.const 5)))
              (local.set $lc (i32.const 0))
            )
            (else
              (i32.store8 (local.get $p) (local.get $ch))
              (local.set $p (i32.add (local.get $p) (i32.const 1)))
              (local.set $lc (i32.add (local.get $lc) (i32.const 1)))
              (if (i32.and (i32.ge_s (local.get $lc) (i32.const 65)) (i32.eq (local.get $ch) (i32.const 32)))
                (then (local.set $p (call $write_str (local.get $p) (i32.const 51300) (i32.const 5))) (local.set $lc (i32.const 0)))
              )
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $t2)
        )
      )
    )
    ;; footer page 2 (69 bytes)
    (local.set $p (call $write_str (local.get $p) (i32.const 51320) (i32.const 69)))
    (local.set $s2l (i32.sub (local.get $p) (local.get $s2s)))

    ;; ── PDF structure at 8192 ──
    (local.set $p (i32.const 8192))
    ;; %PDF-1.4\n%âãÏÓ\n (15 bytes)
    (local.set $p (call $write_str (local.get $p) (i32.const 51400) (i32.const 15)))
    (local.set $o1 (i32.sub (local.get $p) (i32.const 8192)))
    (local.set $p (call $write_str (local.get $p) (i32.const 51420) (i32.const 44)))
    (local.set $o2 (i32.sub (local.get $p) (i32.const 8192)))
    (local.set $p (call $write_str (local.get $p) (i32.const 51470) (i32.const 60)))
    (local.set $o3 (i32.sub (local.get $p) (i32.const 8192)))
    (local.set $p (call $write_str (local.get $p) (i32.const 51540) (i32.const 152)))
    (local.set $o4 (i32.sub (local.get $p) (i32.const 8192)))
    (local.set $p (call $write_str (local.get $p) (i32.const 51700) (i32.const 152)))
    (local.set $o5 (i32.sub (local.get $p) (i32.const 8192)))
    (local.set $p (call $write_str (local.get $p) (i32.const 51860) (i32.const 90)))
    (local.set $o6 (i32.sub (local.get $p) (i32.const 8192)))
    (local.set $p (call $write_str (local.get $p) (i32.const 51960) (i32.const 85)))
    ;; obj 7 (stream 1)
    (local.set $o7 (i32.sub (local.get $p) (i32.const 8192)))
    (local.set $p (call $write_str (local.get $p) (i32.const 52050) (i32.const 18)))
    (local.set $p (call $write_int (local.get $p) (local.get $s1l)))
    (local.set $p (call $write_str (local.get $p) (i32.const 52070) (i32.const 11)))
    (local.set $p (call $write_str (local.get $p) (local.get $s1s) (local.get $s1l)))
    (local.set $p (call $write_str (local.get $p) (i32.const 52090) (i32.const 17)))
    ;; obj 8 (stream 2)
    (local.set $o8 (i32.sub (local.get $p) (i32.const 8192)))
    (local.set $p (call $write_str (local.get $p) (i32.const 52110) (i32.const 18)))
    (local.set $p (call $write_int (local.get $p) (local.get $s2l)))
    (local.set $p (call $write_str (local.get $p) (i32.const 52070) (i32.const 11)))
    (local.set $p (call $write_str (local.get $p) (local.get $s2s) (local.get $s2l)))
    (local.set $p (call $write_str (local.get $p) (i32.const 52090) (i32.const 17)))
    ;; xref
    (local.set $xp (i32.sub (local.get $p) (i32.const 8192)))
    (local.set $p (call $write_str (local.get $p) (i32.const 52130) (i32.const 30)))
    (local.set $p (call $write_padded10 (local.get $p) (local.get $o1)))
    (local.set $p (call $write_str (local.get $p) (i32.const 52170) (i32.const 10)))
    (local.set $p (call $write_padded10 (local.get $p) (local.get $o2)))
    (local.set $p (call $write_str (local.get $p) (i32.const 52170) (i32.const 10)))
    (local.set $p (call $write_padded10 (local.get $p) (local.get $o3)))
    (local.set $p (call $write_str (local.get $p) (i32.const 52170) (i32.const 10)))
    (local.set $p (call $write_padded10 (local.get $p) (local.get $o4)))
    (local.set $p (call $write_str (local.get $p) (i32.const 52170) (i32.const 10)))
    (local.set $p (call $write_padded10 (local.get $p) (local.get $o5)))
    (local.set $p (call $write_str (local.get $p) (i32.const 52170) (i32.const 10)))
    (local.set $p (call $write_padded10 (local.get $p) (local.get $o6)))
    (local.set $p (call $write_str (local.get $p) (i32.const 52170) (i32.const 10)))
    (local.set $p (call $write_padded10 (local.get $p) (local.get $o7)))
    (local.set $p (call $write_str (local.get $p) (i32.const 52170) (i32.const 10)))
    (local.set $p (call $write_padded10 (local.get $p) (local.get $o8)))
    (local.set $p (call $write_str (local.get $p) (i32.const 52170) (i32.const 10)))
    ;; trailer
    (local.set $p (call $write_str (local.get $p) (i32.const 52190) (i32.const 44)))
    (local.set $p (call $write_int (local.get $p) (local.get $xp)))
    (local.set $p (call $write_str (local.get $p) (i32.const 52240) (i32.const 7)))

    (i32.sub (local.get $p) (i32.const 8192))
  )

  ;; ══════════════════════════════════════════════════════════════════════════
  ;; ENTRYPOINT — called by Chattree with the AI-generated JSON (or raw text)
  ;; Returns 0 to signal async pending (host_call for files.write is async)
  ;; ══════════════════════════════════════════════════════════════════════════
  (func (export "pdf_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $pdf_len i32) (local $b64_len i32)
    (local $req_p i32) (local $req_len i32)
    (local $idx i32)
    (local $t_start i32) (local $t_len i32)
    (local $c_start i32) (local $c_len i32)
    (local $p1_start i32) (local $p1_len i32)
    (local $p2_start i32) (local $p2_len i32)
    (local $delim_idx i32)
    (local $fname_len i32) (local $ch i32)
    (local $ta_len i32) (local $la i32) (local $lb i32)

    ;; 1. Empty input → usage hint (synchronous direct return)
    (if (i32.eqz (local.get $in_len))
      (then
        (memory.copy (i32.const 1024) (i32.const 50600) (i32.const 133))
        (return (i32.const 133))
      )
    )

    ;; 2. Defaults
    (local.set $t_start  (i32.const 52500))  ;; "Documento PDF"
    (local.set $t_len    (i32.const 13))
    (local.set $p1_start (i32.const 52520))  ;; default page-1 text
    (local.set $p1_len   (i32.const 84))
    (local.set $p2_start (i32.const 52620))  ;; default page-2 text
    (local.set $p2_len   (i32.const 85))

    ;; 3. Parse {"title":"...","content":"..."}
    (if (i32.eq (i32.load8_u (local.get $in_ptr)) (i32.const 123)) ;; '{'
      (then
        ;; "title":"
        (local.set $idx (call $find_sub (local.get $in_ptr) (local.get $in_len) (i32.const 52700) (i32.const 9)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (local.set $t_start (i32.add (i32.add (local.get $in_ptr) (local.get $idx)) (i32.const 9)))
            (local.set $t_len (i32.const 0))
            (loop $stl
              (if (i32.lt_s (i32.add (local.get $t_len) (i32.sub (local.get $t_start) (local.get $in_ptr))) (local.get $in_len))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $t_start) (local.get $t_len))))
                  (if (i32.ne (local.get $ch) (i32.const 34))
                    (then (local.set $t_len (i32.add (local.get $t_len) (i32.const 1))) (br $stl))
                  )
                )
              )
            )
          )
        )
        ;; "content":"
        (local.set $idx (call $find_sub (local.get $in_ptr) (local.get $in_len) (i32.const 52720) (i32.const 11)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (local.set $c_start (i32.add (i32.add (local.get $in_ptr) (local.get $idx)) (i32.const 11)))
            (local.set $c_len (i32.const 0))
            (loop $scl
              (if (i32.lt_s (i32.add (local.get $c_len) (i32.sub (local.get $c_start) (local.get $in_ptr))) (local.get $in_len))
                (then
                  (local.set $ch (i32.load8_u (i32.add (local.get $c_start) (local.get $c_len))))
                  (if (i32.ne (local.get $ch) (i32.const 34))
                    (then (local.set $c_len (i32.add (local.get $c_len) (i32.const 1))) (br $scl))
                  )
                )
              )
            )
            ;; split on [PAGE]
            (local.set $delim_idx (call $find_sub (local.get $c_start) (local.get $c_len) (i32.const 52740) (i32.const 6)))
            (if (i32.ge_s (local.get $delim_idx) (i32.const 0))
              (then
                (if (i32.eqz (local.get $delim_idx))
                  (then
                    (local.set $p1_start (i32.add (local.get $c_start) (i32.const 6)))
                    (local.set $p1_len   (i32.sub (local.get $c_len) (i32.const 6)))
                    (local.set $delim_idx (call $find_sub (local.get $p1_start) (local.get $p1_len) (i32.const 52740) (i32.const 6)))
                    (if (i32.ge_s (local.get $delim_idx) (i32.const 0))
                      (then
                        (local.set $p1_len   (local.get $delim_idx))
                        (local.set $p2_start (i32.add (i32.add (local.get $p1_start) (local.get $delim_idx)) (i32.const 6)))
                        (local.set $p2_len   (i32.sub (i32.sub (local.get $c_len) (local.get $p1_len)) (i32.const 12)))
                      )
                    )
                  )
                  (else
                    (local.set $p1_start (local.get $c_start))
                    (local.set $p1_len   (local.get $delim_idx))
                    (local.set $p2_start (i32.add (i32.add (local.get $c_start) (local.get $delim_idx)) (i32.const 6)))
                    (local.set $p2_len   (i32.sub (local.get $c_len) (i32.add (local.get $delim_idx) (i32.const 6))))
                  )
                )
              )
              (else
                (local.set $p1_start (local.get $c_start))
                (local.set $p1_len   (i32.div_u (local.get $c_len) (i32.const 2)))
                (local.set $p2_start (i32.add (local.get $c_start) (local.get $p1_len)))
                (local.set $p2_len   (i32.sub (local.get $c_len) (local.get $p1_len)))
              )
            )
          )
        )
      )
      (else
        ;; raw text
        (local.set $t_start  (local.get $in_ptr))
        (local.set $t_len    (local.get $in_len))
        (local.set $p1_start (local.get $in_ptr))
        (local.set $p1_len   (local.get $in_len))
        (local.set $p2_start (local.get $in_ptr))
        (local.set $p2_len   (local.get $in_len))
      )
    )

    ;; 4. Convert UTF-8 to WinAnsi (title at 32000, page1 at 32100, page2 at 33000)
    (local.set $ta_len (call $sanitize_ascii (local.get $t_start)  (local.get $t_len)  (i32.const 32000) (i32.const 80)))
    (local.set $la    (call $sanitize_ascii (local.get $p1_start) (local.get $p1_len) (i32.const 32100) (i32.const 900)))
    (local.set $lb    (call $sanitize_ascii (local.get $p2_start) (local.get $p2_len) (i32.const 33000) (i32.const 900)))

    ;; 5. Build filename from sanitized title (at 49408)
    (local.set $idx (i32.const 0))
    (local.set $fname_len (i32.const 0))
    (loop $fn
      (if (i32.and (i32.lt_s (local.get $idx) (local.get $ta_len)) (i32.lt_s (local.get $fname_len) (i32.const 30)))
        (then
          (local.set $ch (i32.load8_u (i32.add (i32.const 32000) (local.get $idx))))
          ;; Transliterate common Spanish WinAnsi characters for a portable filename.
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
    (local.set $pdf_len (call $assemble_pdf
      (i32.const 32000) (local.get $ta_len)
      (i32.const 32100) (local.get $la)
      (i32.const 33000) (local.get $lb)
    ))
    (local.set $b64_len (call $b64_encode (i32.const 8192) (local.get $pdf_len) (i32.const 24576)))

    ;; 7. Build files.write request at 2048
    (local.set $req_p (i32.const 2048))
    (local.set $req_p (call $write_str (local.get $req_p) (i32.const 50100) (i32.const 54)))
    (local.set $req_p (call $write_str (local.get $req_p) (i32.const 49408) (local.get $fname_len)))
    (local.set $req_p (call $write_str (local.get $req_p) (i32.const 50200) (i32.const 13)))
    (local.set $req_p (call $write_str (local.get $req_p) (i32.const 24576) (local.get $b64_len)))
    (local.set $req_p (call $write_str (local.get $req_p) (i32.const 50250) (i32.const 23)))
    (local.set $req_len (i32.sub (local.get $req_p) (i32.const 2048)))

    ;; 8. Dispatch async host_call (files.write is async in Dart)
    ;;    host_call returns 0 → sets pendingAsyncRequest → triggers async loop
    ;;    Chattree host will call resume(resPtr, resLen) when files.write completes
    (drop (call $host_call
      (i32.const 2048) (local.get $req_len)
      (i32.const 4096) (i32.const 4096)
    ))

    ;; Return 0 to signal async pending (runtime will call resume)
    (i32.const 0)
  )

  ;; ══════════════════════════════════════════════════════════════════════════
  ;; RESUME — called by Chattree host after files.write completes
  ;; $res_ptr/$res_len point to the host response JSON in WASM memory
  ;; Returns byte length of the ToolResult JSON written at offset 1024
  ;; ══════════════════════════════════════════════════════════════════════════
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $idx i32) (local $h_start i32) (local $ch i32)
    (local $out_p i32)

    ;; Parse "handle":"<value>" from the files.write response
    (local.set $idx (call $find_sub (local.get $res_ptr) (local.get $res_len) (i32.const 52830) (i32.const 10)))
    (if (i32.ge_s (local.get $idx) (i32.const 0))
      (then
        (local.set $h_start (i32.add (i32.add (local.get $res_ptr) (local.get $idx)) (i32.const 10)))
        (global.set $handle_len (i32.const 0))
        (loop $sh
          (if (i32.lt_s (global.get $handle_len) (i32.const 40))
            (then
              (local.set $ch (i32.load8_u (i32.add (local.get $h_start) (global.get $handle_len))))
              (if (i32.ne (local.get $ch) (i32.const 34)) ;; not '"'
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

    ;; Build ToolResult JSON at offset 1024
    (local.set $out_p (i32.const 1024))

    ;; No handle → error
    (if (i32.eqz (global.get $handle_len))
      (then
        (local.set $out_p (call $write_str (local.get $out_p) (i32.const 53200) (i32.const 117)))
        (return (i32.sub (local.get $out_p) (i32.const 1024)))
      )
    )

    ;; PluginFileBubble contract:
    ;; {"type":"direct","displayText":"📄 **<name>** generado\n\nListo para descargar.","fileHandle":"<h>","fileName":"<name>"}

    ;; {"type":"direct","displayText":"
    (local.set $out_p (call $write_str (local.get $out_p) (i32.const 52850) (i32.const 32)))
    ;; emoji + "**
    (local.set $out_p (call $write_str (local.get $out_p) (i32.const 52882) (i32.const 7)))
    ;; filename
    (local.set $out_p (call $write_str (local.get $out_p) (i32.const 49408) (global.get $fname_len)))
    ;; "** generado con exito\\n\\nListo para descargar desde el chat.","fileHandle":"
    (local.set $out_p (call $write_str (local.get $out_p) (i32.const 52900) (i32.const 76)))
    ;; handle
    (local.set $out_p (call $write_str (local.get $out_p) (i32.const 49664) (global.get $handle_len)))
    ;; ","fileName":"
    (local.set $out_p (call $write_str (local.get $out_p) (i32.const 52990) (i32.const 14)))
    ;; filename
    (local.set $out_p (call $write_str (local.get $out_p) (i32.const 49408) (global.get $fname_len)))
    ;; "}
    (local.set $out_p (call $write_str (local.get $out_p) (i32.const 53100) (i32.const 2)))

    (i32.sub (local.get $out_p) (i32.const 1024))
  )

  ;; ── Static data sections ─────────────────────────────────────────────────
  (data (i32.const 51000) "BT\n/F1 16 Tf\n50 780 Td\n(")
  (data (i32.const 51100) ") Tj\nET\n0.7 0.7 0.7 RG\n0.8 w\n50 765 m\n545 765 l\nS\nBT\n/F2 9 Tf\n0.4 0.4 0.4 rg\n50 750 Td\n(Documento generado por Chattree AI - Pagina 1 de 2) Tj\nET\nBT\n/F2 11 Tf\n0 0 0 rg\n16 TL\n50 715 Td\n(")
  (data (i32.const 51200) ") Tj\nET\n0.7 0.7 0.7 RG\n0.8 w\n50 765 m\n545 765 l\nS\nBT\n/F2 9 Tf\n0.4 0.4 0.4 rg\n50 750 Td\n(Documento generado por Chattree AI - Pagina 2 de 2) Tj\nET\nBT\n/F2 11 Tf\n0 0 0 rg\n16 TL\n50 715 Td\n(")
  (data (i32.const 51300) ") '\n(")
  (data (i32.const 51310) ") '\nET\nBT\n/F2 9 Tf\n0.5 0.5 0.5 rg\n260 40 Td\n(Pagina 1 de 2) Tj\nET\n")
  (data (i32.const 51320) ") '\nET\nBT\n/F2 9 Tf\n0.5 0.5 0.5 rg\n260 40 Td\n(Pagina 2 de 2) Tj\nET\n")
  (data (i32.const 51400) "%PDF-1.4\n%\e2\e3\cf\d3\n")
  (data (i32.const 51420) "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
  (data (i32.const 51470) "2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n")
  (data (i32.const 51540) "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /ProcSet [/PDF /Text] >> /Contents 7 0 R >>\nendobj\n")
  (data (i32.const 51700) "4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /ProcSet [/PDF /Text] >> /Contents 8 0 R >>\nendobj\n")
  (data (i32.const 51860) "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n")
  (data (i32.const 51960) "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n")
  (data (i32.const 52050) "7 0 obj\n<< /Length ")
  (data (i32.const 52070) " >>\nstream\n")
  (data (i32.const 52090) "\nendstream\nendobj\n")
  (data (i32.const 52110) "8 0 obj\n<< /Length ")
  (data (i32.const 52130) "xref\n0 9\n0000000000 65535 f \n")
  (data (i32.const 52170) " 00000 n \n")
  (data (i32.const 52190) "trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n")
  (data (i32.const 52240) "\n%%EOF\n")

  ;; Fallback defaults
  (data (i32.const 52500) "Documento PDF")
  (data (i32.const 52520) "1. Introduccion: Este documento fue elaborado automaticamente por Chattree AI.")
  (data (i32.const 52620) "2. Desarrollo y conclusiones: La segunda pagina contiene el detalle del documento.")

  ;; JSON keys
  (data (i32.const 52700) "\"title\":\"")
  (data (i32.const 52720) "\"content\":\"")
  (data (i32.const 52740) "[PAGE]")
  (data (i32.const 52800) "documento")
  (data (i32.const 52810) ".pdf")
  (data (i32.const 52830) "\"handle\":\"")

  ;; Output JSON parts
  ;; {"type":"direct","displayText":"  (32 bytes)
  (data (i32.const 52850) "{\"type\":\"direct\",\"displayText\":\"")
  ;; PDF emoji + "**  (7 UTF-8 bytes)
  (data (i32.const 52882) "\f0\9f\93\84 **")
  ;; ** generado con exito\n\nListo para descargar desde el chat.","fileHandle":"  (76 bytes)
  (data (i32.const 52900) "** generado con exito\\n\\nListo para descargar desde el chat.\",\"fileHandle\":\"")
  ;; ","fileName":"  (13 bytes)
  (data (i32.const 52990) "\",\"fileName\":\"")
  ;; "}  (2 bytes)
  (data (i32.const 53100) "\"}")
  ;; Error message (117 bytes)
  (data (i32.const 53200) "{\"type\":\"error\",\"errorMessage\":\"No se pudo guardar el PDF. Verifica que el plugin tiene permiso files.write.\"}")
)
