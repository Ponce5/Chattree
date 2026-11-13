(module
  ;; Chattree Host API import: (req_ptr, req_len, res_ptr, res_cap) -> res_len
  (import "chattree" "host_call" (func $host_call (param i32 i32 i32 i32) (result i32)))

  (memory (export "memory") 64)

  ;; ============================================================================
  ;; CONSTANTS & MEMORY MAP
  ;; ============================================================================
  ;; Input: 0..65535
  ;; Output: 65536..131071
  ;; Static Data: 131072..196607
  ;; Host Req: 200000..204095
  ;; Host Res: 205000..213191
  ;; Slot Serialize Buf: 215000..223191
  ;; Temp Buf: 225000..229095
  ;; Field Buffers: 230000..236000

  (global $OUT_BASE i32 (i32.const 65536))
  (global $HOST_REQ i32 (i32.const 200000))
  (global $HOST_RES i32 (i32.const 205000))
  (global $SLOT_BUF i32 (i32.const 215000))
  (global $TEMP_BUF i32 (i32.const 225000))

  ;; Field buffer addresses
  (global $S1_T i32 (i32.const 230000))
  (global $S1_P i32 (i32.const 230200))
  (global $S2_T i32 (i32.const 230500))
  (global $S2_P i32 (i32.const 230700))
  (global $S3_T i32 (i32.const 231000))
  (global $S3_P i32 (i32.const 231200))
  (global $CH_T i32 (i32.const 231500))
  (global $CH_P i32 (i32.const 231700))
  (global $SUMMARY i32 (i32.const 232000))
  (global $INTENT i32 (i32.const 233000))
  (global $NOTE i32 (i32.const 233500))
  (global $CMD_RAW i32 (i32.const 234000))
  (global $ACT_BUF i32 (i32.const 234500))
  (global $QRY_BUF i32 (i32.const 234700))
  (global $STAGE_BUF i32 (i32.const 235000))
  (global $CLASS_BUF i32 (i32.const 235100))
  (global $PHASE_BUF i32 (i32.const 235200))
  (global $OUTCOME_BUF i32 (i32.const 235300))
  (global $ROLL_TXT i32 (i32.const 235400))

  ;; Mutable state globals
  (global $out_pos (mut i32) (i32.const 65536))
  (global $in_len (mut i32) (i32.const 0))
  (global $active_slot (mut i32) (i32.const 1))

  ;; Campaign state globals
  (global $stage_len (mut i32) (i32.const 0))
  (global $class_len (mut i32) (i32.const 0))
  (global $phase_len (mut i32) (i32.const 0))
  (global $ch_t_len (mut i32) (i32.const 0))
  (global $ch_p_len (mut i32) (i32.const 0))
  (global $sum_len (mut i32) (i32.const 0))
  (global $s1t_len (mut i32) (i32.const 0))
  (global $s1p_len (mut i32) (i32.const 0))
  (global $s2t_len (mut i32) (i32.const 0))
  (global $s2p_len (mut i32) (i32.const 0))
  (global $s3t_len (mut i32) (i32.const 0))
  (global $s3p_len (mut i32) (i32.const 0))

  (global $hp (mut i32) (i32.const 0))
  (global $max_hp (mut i32) (i32.const 0))
  (global $atk (mut i32) (i32.const 0))
  (global $def (mut i32) (i32.const 0))
  (global $turn (mut i32) (i32.const 0))
  (global $tension (mut i32) (i32.const 0))

  ;; Input parsed globals
  (global $act_len (mut i32) (i32.const 0))
  (global $qry_len (mut i32) (i32.const 0))
  (global $int_len (mut i32) (i32.const 0))
  (global $note_len (mut i32) (i32.const 0))
  (global $cmd_len (mut i32) (i32.const 0))
  (global $outc_len (mut i32) (i32.const 0))
  (global $in_tdelta (mut i32) (i32.const 10))
  (global $in_dc (mut i32) (i32.const 12))
  (global $in_roll (mut i32) (i32.const 0))
  (global $in_rest (mut i32) (i32.const 0))

  ;; ============================================================================
  ;; STATIC STRINGS (131072..)
  ;; ============================================================================
  ;; Storage keys (131072..)
  (data (i32.const 131072) "rpg_active_slot")   ;; len 15 @ 131072
  (data (i32.const 131090) "rpg_slot_1")        ;; len 10 @ 131090
  (data (i32.const 131102) "rpg_slot_2")        ;; len 10 @ 131102
  (data (i32.const 131114) "rpg_slot_3")        ;; len 10 @ 131114

  ;; Host API JSON fragments (131130..)
  (data (i32.const 131130) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22") ;; len 53 @ 131130
  (data (i32.const 131190) "\22}}") ;; len 3 @ 131190
  (data (i32.const 131200) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22") ;; len 53 @ 131200
  (data (i32.const 131260) "\22,\22value\22:\22") ;; len 11 @ 131260

  ;; JSON input keys (131280..)
  (data (i32.const 131280) "action")         ;; len 6
  (data (i32.const 131290) "command")        ;; len 7
  (data (i32.const 131300) "query")          ;; len 5
  (data (i32.const 131310) "intent")         ;; len 6
  (data (i32.const 131320) "summary_note")   ;; len 12
  (data (i32.const 131335) "s1_title")       ;; len 8
  (data (i32.const 131345) "s1_premise")     ;; len 10
  (data (i32.const 131358) "s2_title")       ;; len 8
  (data (i32.const 131368) "s2_premise")     ;; len 10
  (data (i32.const 131380) "s3_title")       ;; len 8
  (data (i32.const 131390) "s3_premise")     ;; len 10
  (data (i32.const 131405) "tension_delta")  ;; len 13
  (data (i32.const 131420) "dc")             ;; len 2
  (data (i32.const 131425) "roll_needed")    ;; len 11
  (data (i32.const 131440) "rest")           ;; len 4
  (data (i32.const 131448) "combat_outcome") ;; len 14
  (data (i32.const 131465) "value")          ;; len 5

  ;; Action / command literals (131480..)
  (data (i32.const 131480) "start")          ;; len 5
  (data (i32.const 131488) "new")            ;; len 3
  (data (i32.const 131495) "pick_story")     ;; len 10
  (data (i32.const 131508) "select_class")   ;; len 12
  (data (i32.const 131524) "status")         ;; len 6
  (data (i32.const 131532) "games")          ;; len 5
  (data (i32.const 131540) "switch")         ;; len 6
  (data (i32.const 131548) "delete")         ;; len 6
  (data (i32.const 131556) "confirm_delete") ;; len 14
  (data (i32.const 131572) "help")           ;; len 4
  (data (i32.const 131580) "knight")         ;; len 6
  (data (i32.const 131588) "archer")         ;; len 6
  (data (i32.const 131596) "Knight")         ;; len 6
  (data (i32.const 131604) "Archer")         ;; len 6
  (data (i32.const 131612) "victory")        ;; len 7

  ;; Stages & Phases (131625..)
  (data (i32.const 131625) "empty")          ;; len 5
  (data (i32.const 131632) "pick_story")     ;; len 10
  (data (i32.const 131644) "pick_class")     ;; len 10
  (data (i32.const 131656) "playing")        ;; len 7
  (data (i32.const 131665) "OPENING")        ;; len 7
  (data (i32.const 131674) "EXPLORATION")    ;; len 11
  (data (i32.const 131687) "SKILL_CHECK")    ;; len 11
  (data (i32.const 131700) "COMBAT_AMBUSH")  ;; len 13
  (data (i32.const 131715) "COMBAT_ROUND")   ;; len 12
  (data (i32.const 131729) "COMBAT_VICTORY") ;; len 14
  (data (i32.const 131745) "CAMP_REST")      ;; len 9
  (data (i32.const 131756) "GAME_OVER")      ;; len 9

  ;; Slot serialization keys (131770..)
  (data (i32.const 131770) "stage=")   ;; 6
  (data (i32.const 131778) "title=")   ;; 6
  (data (i32.const 131786) "premise=") ;; 8
  (data (i32.const 131796) "class=")   ;; 6
  (data (i32.const 131804) "hp=")      ;; 3
  (data (i32.const 131810) "max_hp=")  ;; 7
  (data (i32.const 131820) "atk=")     ;; 4
  (data (i32.const 131826) "def=")     ;; 4
  (data (i32.const 131832) "turn=")    ;; 5
  (data (i32.const 131840) "tension=") ;; 8
  (data (i32.const 131850) "phase=")   ;; 6
  (data (i32.const 131858) "summary=") ;; 8
  (data (i32.const 131868) "s1t=")     ;; 4
  (data (i32.const 131874) "s1p=")     ;; 4
  (data (i32.const 131880) "s2t=")     ;; 4
  (data (i32.const 131886) "s2p=")     ;; 4
  (data (i32.const 131892) "s3t=")     ;; 4
  (data (i32.const 131898) "s3p=")     ;; 4

  ;; Help UI Card (132000..)
  (data (i32.const 132000) "{\22type\22:\22ui\22,\22displayText\22:\22RPG Help\22,\22ui\22:{\22title\22:\22Text RPG Simulator\22,\22subtitle\22:\22v2.0.0 \e2\80\a2 D&D Narrative Engine\22,\22badge\22:\22HELP\22,\22badgeColor\22:\22grey\22,\22hideText\22:true,\22elements\22:[{\22type\22:\22key_value\22,\22items\22:[{\22label\22:\22/rpg\22,\22value\22:\22Start or continue active campaign\22},{\22label\22:\22/rpg new\22,\22value\22:\22Generate 3 fresh stories for active slot\22},{\22label\22:\22/rpg games\22,\22value\22:\22View and switch between 3 save slots\22},{\22label\22:\22/rpg status\22,\22value\22:\22Inspect character sheet and summary\22},{\22label\22:\22/rpg delete\22,\22value\22:\22Clear the active campaign slot\22}]},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22Start / Continue\22,\22action\22:\22command\22,\22payload\22:\22/rpg\22,\22style\22:\22primary\22},{\22label\22:\22Campaign Slots\22,\22action\22:\22command\22,\22payload\22:\22/rpg games\22,\22style\22:\22secondary\22}]}]}}\00")

  ;; RPG_SYSTEM prompt for generating 3 fresh stories (133000..)
  (data (i32.const 133000) "{\22type\22:\22text\22,\22displayText\22:\22[RPG_SYSTEM]\\nNo active campaign exists in this slot. Generate 3 distinct, original, atmospheric short story premises (each 1-2 sentences, varied genres/settings such as dark fantasy, cursed wilderness, or intrigue). Then immediately call the `rpg` tool with `action=new` and parameters `s1_title`, `s1_premise`, `s2_title`, `s2_premise`, `s3_title`, `s3_premise` so the player can choose one in the UI.\\n[/RPG_SYSTEM]\22}\00")

  ;; Predefined Knight & Archer Character Selection UI fragments (133600..)
  (data (i32.const 133600) "{\22type\22:\22ui\22,\22displayText\22:\22Select Your Character\22,\22ui\22:{\22title\22:\22Select Your Character\22,\22subtitle\22:\22Story: ")
  ;; len = 104 @ 133600

  (data (i32.const 133720) "\22,\22badge\22:\22CLASS\22,\22badgeColor\22:\22grey\22,\22hideText\22:true,\22elements\22:[{\22type\22:\22text\22,\22text\22:\22KNIGHT\\n  [=+=]\\n  /|#|\\\\  HP 120 | ATK 12 | DEF 14\\n   / \\\\   Vanguard Tank & Shield\22},{\22type\22:\22divider\22},{\22type\22:\22text\22,\22text\22:\22ARCHER\\n   /|\\\\\\n  >>-+-> HP 95  | ATK 15 | DEF 11\\n   / \\\\   Precision Scout & Crit\22},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22Choose Knight\22,\22action\22:\22command\22,\22payload\22:\22/rpg select_class knight\22,\22style\22:\22primary\22},{\22label\22:\22Choose Archer\22,\22action\22:\22command\22,\22payload\22:\22/rpg select_class archer\22,\22style\22:\22secondary\22}]}]}}")
  ;; Wait: let's count exact bytes for 133720 in a helper or use clean exact lengths!
  ;; Actually let's use exact null-terminated helper `$write_cstr` so we NEVER miscount static string lengths!!
  ;; THAT IS SO MUCH SAFER AND CLEANER!

  ;; ============================================================================
  ;; LOW-LEVEL MEMORY & STRING HELPERS
  ;; ============================================================================

  ;; Write null-terminated string at $ptr to output buffer
  (func $out_cstr (param $ptr i32)
    (local $b i32)
    (block $done
      (loop $loop
        (local.set $b (i32.load8_u (local.get $ptr)))
        (br_if $done (i32.eqz (local.get $b)))
        (i32.store8 (global.get $out_pos) (local.get $b))
        (global.set $out_pos (i32.add (global.get $out_pos) (i32.const 1)))
        (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))
        (br $loop)
      )
    )
  )

  ;; Write $len bytes from $ptr to output buffer
  (func $out_bytes (param $ptr i32) (param $len i32)
    (local $i i32)
    (local.set $i (i32.const 0))
    (block $done
      (loop $loop
        (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
        (i32.store8
          (global.get $out_pos)
          (i32.load8_u (i32.add (local.get $ptr) (local.get $i)))
        )
        (global.set $out_pos (i32.add (global.get $out_pos) (i32.const 1)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
  )

  ;; Write JSON-safe bytes from $ptr ($len) to output buffer (escapes " \ \n \r)
  (func $out_json_str (param $ptr i32) (param $len i32)
    (local $i i32)
    (local $b i32)
    (local.set $i (i32.const 0))
    (block $done
      (loop $loop
        (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
        (local.set $b (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))
        (if (i32.eq (local.get $b) (i32.const 34)) ;; '"'
          (then
            (i32.store8 (global.get $out_pos) (i32.const 92))
            (i32.store8 (i32.add (global.get $out_pos) (i32.const 1)) (i32.const 34))
            (global.set $out_pos (i32.add (global.get $out_pos) (i32.const 2)))
          )
          (else
            (if (i32.eq (local.get $b) (i32.const 92)) ;; '\'
              (then
                (i32.store8 (global.get $out_pos) (i32.const 92))
                (i32.store8 (i32.add (global.get $out_pos) (i32.const 1)) (i32.const 92))
                (global.set $out_pos (i32.add (global.get $out_pos) (i32.const 2)))
              )
              (else
                (if (i32.eq (local.get $b) (i32.const 10)) ;; '\n'
                  (then
                    (i32.store8 (global.get $out_pos) (i32.const 92))
                    (i32.store8 (i32.add (global.get $out_pos) (i32.const 1)) (i32.const 110))
                    (global.set $out_pos (i32.add (global.get $out_pos) (i32.const 2)))
                  )
                  (else
                    (if (i32.ge_u (local.get $b) (i32.const 32))
                      (then
                        (i32.store8 (global.get $out_pos) (local.get $b))
                        (global.set $out_pos (i32.add (global.get $out_pos) (i32.const 1)))
                      )
                    )
                  )
                )
              )
            )
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
  )

  ;; Write signed integer to output buffer
  (func $out_int (param $n i32)
    (local $buf i32)
    (local $idx i32)
    (local $neg i32)
    (local $d i32)
    (local.set $buf (global.get $TEMP_BUF))
    (local.set $idx (i32.const 30))
    (if (i32.eqz (local.get $n))
      (then
        (i32.store8 (global.get $out_pos) (i32.const 48))
        (global.set $out_pos (i32.add (global.get $out_pos) (i32.const 1)))
        (return)
      )
    )
    (if (i32.lt_s (local.get $n) (i32.const 0))
      (then
        (local.set $neg (i32.const 1))
        (local.set $n (i32.sub (i32.const 0) (local.get $n)))
      )
    )
    (block $done
      (loop $loop
        (br_if $done (i32.eqz (local.get $n)))
        (local.set $d (i32.rem_u (local.get $n) (i32.const 10)))
        (i32.store8 (i32.add (local.get $buf) (local.get $idx)) (i32.add (i32.const 48) (local.get $d)))
        (local.set $idx (i32.sub (local.get $idx) (i32.const 1)))
        (local.set $n (i32.div_u (local.get $n) (i32.const 10)))
        (br $loop)
      )
    )
    (if (local.get $neg)
      (then
        (i32.store8 (global.get $out_pos) (i32.const 45))
        (global.set $out_pos (i32.add (global.get $out_pos) (i32.const 1)))
      )
    )
    (call $out_bytes
      (i32.add (local.get $buf) (i32.add (local.get $idx) (i32.const 1)))
      (i32.sub (i32.const 30) (local.get $idx))
    )
  )

  ;; Copy $len bytes from $src to $dst
  (func $memcpy (param $dst i32) (param $src i32) (param $len i32)
    (local $i i32)
    (local.set $i (i32.const 0))
    (block $done
      (loop $loop
        (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
        (i32.store8
          (i32.add (local.get $dst) (local.get $i))
          (i32.load8_u (i32.add (local.get $src) (local.get $i)))
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
  )

  ;; Compare two byte slices for equality (1 = equal, 0 = not)
  (func $streq (param $a i32) (param $alen i32) (param $b i32) (param $blen i32) (result i32)
    (local $i i32)
    (if (i32.ne (local.get $alen) (local.get $blen))
      (then (return (i32.const 0)))
    )
    (local.set $i (i32.const 0))
    (block $done
      (loop $loop
        (br_if $done (i32.ge_u (local.get $i) (local.get $alen)))
        (if (i32.ne
              (i32.load8_u (i32.add (local.get $a) (local.get $i)))
              (i32.load8_u (i32.add (local.get $b) (local.get $i)))
            )
          (then (return (i32.const 0)))
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
    (i32.const 1)
  )

  ;; Check if $a ($alen) starts with $prefix ($plen)
  (func $starts_with (param $a i32) (param $alen i32) (param $prefix i32) (param $plen i32) (result i32)
    (if (i32.lt_u (local.get $alen) (local.get $plen))
      (then (return (i32.const 0)))
    )
    (call $streq (local.get $a) (local.get $plen) (local.get $prefix) (local.get $plen))
  )

  ;; Parse unsigned/signed int from ASCII slice
  (func $parse_int (param $ptr i32) (param $len i32) (result i32)
    (local $i i32)
    (local $neg i32)
    (local $acc i32)
    (local $b i32)
    (if (i32.eqz (local.get $len)) (then (return (i32.const 0))))
    (local.set $i (i32.const 0))
    (if (i32.eq (i32.load8_u (local.get $ptr)) (i32.const 45))
      (then
        (local.set $neg (i32.const 1))
        (local.set $i (i32.const 1))
      )
    )
    (block $done
      (loop $loop
        (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
        (local.set $b (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))
        (br_if $done (i32.lt_u (local.get $b) (i32.const 48)))
        (br_if $done (i32.gt_u (local.get $b) (i32.const 57)))
        (local.set $acc (i32.add (i32.mul (local.get $acc) (i32.const 10)) (i32.sub (local.get $b) (i32.const 48))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
    (if (local.get $neg)
      (then (return (i32.sub (i32.const 0) (local.get $acc))))
    )
    (local.get $acc)
  )

  ;; ============================================================================
  ;; JSON EXTRACTORS (search key in buffer $hay/$hlen)
  ;; ============================================================================
  ;; Find '"key":' in [$hay, $hay + $hlen), return index right after ':' (or -1)
  (func $json_find_val (param $hay i32) (param $hlen i32) (param $key i32) (param $klen i32) (result i32)
    (local $i i32)
    (local $end i32)
    (local $p i32)
    (if (i32.lt_u (local.get $hlen) (i32.add (local.get $klen) (i32.const 3)))
      (then (return (i32.const -1)))
    )
    (local.set $i (i32.const 0))
    (local.set $end (i32.sub (local.get $hlen) (i32.add (local.get $klen) (i32.const 3))))
    (block $not_found
      (loop $loop
        (br_if $not_found (i32.gt_u (local.get $i) (local.get $end)))
        (local.set $p (i32.add (local.get $hay) (local.get $i)))
        (if (i32.and
              (i32.eq (i32.load8_u (local.get $p)) (i32.const 34))
              (i32.eq (i32.load8_u (i32.add (local.get $p) (i32.add (local.get $klen) (i32.const 1)))) (i32.const 34))
            )
          (then
            (if (call $streq (i32.add (local.get $p) (i32.const 1)) (local.get $klen) (local.get $key) (local.get $klen))
              (then
                ;; Scan for ':' skipping whitespace
                (local.set $p (i32.add (local.get $i) (i32.add (local.get $klen) (i32.const 2))))
                (block $ws_done
                  (loop $ws
                    (br_if $ws_done (i32.ge_u (local.get $p) (local.get $hlen)))
                    (if (i32.eq (i32.load8_u (i32.add (local.get $hay) (local.get $p))) (i32.const 58))
                      (then
                        ;; Skip whitespace after ':'
                        (local.set $p (i32.add (local.get $p) (i32.const 1)))
                        (block $ws2_done
                          (loop $ws2
                            (br_if $ws2_done (i32.ge_u (local.get $p) (local.get $hlen)))
                            (br_if $ws2_done (i32.gt_u (i32.load8_u (i32.add (local.get $hay) (local.get $p))) (i32.const 32)))
                            (local.set $p (i32.add (local.get $p) (i32.const 1)))
                            (br $ws2)
                          )
                        )
                        (return (local.get $p))
                      )
                    )
                    (br_if $ws_done (i32.gt_u (i32.load8_u (i32.add (local.get $hay) (local.get $p))) (i32.const 32)))
                    (local.set $p (i32.add (local.get $p) (i32.const 1)))
                    (br $ws)
                  )
                )
              )
            )
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
    (i32.const -1)
  )

  ;; Extract JSON string value for $key into $dst (max $cap). Returns length (0 if missing or null).
  (func $json_get_str (param $hay i32) (param $hlen i32) (param $key i32) (param $klen i32) (param $dst i32) (param $cap i32) (result i32)
    (local $idx i32)
    (local $out i32)
    (local $b i32)
    (local.set $idx (call $json_find_val (local.get $hay) (local.get $hlen) (local.get $key) (local.get $klen)))
    (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const 0))))
    (if (i32.ge_u (local.get $idx) (local.get $hlen)) (then (return (i32.const 0))))
    ;; Must start with '"'
    (if (i32.ne (i32.load8_u (i32.add (local.get $hay) (local.get $idx))) (i32.const 34))
      (then (return (i32.const 0)))
    )
    (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
    (local.set $out (i32.const 0))
    (block $done
      (loop $loop
        (br_if $done (i32.ge_u (local.get $idx) (local.get $hlen)))
        (local.set $b (i32.load8_u (i32.add (local.get $hay) (local.get $idx))))
        (br_if $done (i32.eq (local.get $b) (i32.const 34)))
        (if (i32.eq (local.get $b) (i32.const 92)) ;; '\' escape
          (then
            (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
            (br_if $done (i32.ge_u (local.get $idx) (local.get $hlen)))
            (local.set $b (i32.load8_u (i32.add (local.get $hay) (local.get $idx))))
            (if (i32.or (i32.eq (local.get $b) (i32.const 110)) (i32.or (i32.eq (local.get $b) (i32.const 114)) (i32.eq (local.get $b) (i32.const 116))))
              (then (local.set $b (i32.const 32))) ;; \n, \r, \t -> space
            )
          )
        )
        (if (i32.lt_u (local.get $out) (local.get $cap))
          (then
            (i32.store8 (i32.add (local.get $dst) (local.get $out)) (local.get $b))
            (local.set $out (i32.add (local.get $out) (i32.const 1)))
          )
        )
        (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
        (br $loop)
      )
    )
    (local.get $out)
  )

  ;; Extract JSON integer value (or $default if missing)
  (func $json_get_int (param $hay i32) (param $hlen i32) (param $key i32) (param $klen i32) (param $defval i32) (result i32)
    (local $idx i32)
    (local $start i32)
    (local $b i32)
    (local.set $idx (call $json_find_val (local.get $hay) (local.get $hlen) (local.get $key) (local.get $klen)))
    (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (local.get $defval))))
    (if (i32.ge_u (local.get $idx) (local.get $hlen)) (then (return (local.get $defval))))
    (local.set $start (local.get $idx))
    (local.set $b (i32.load8_u (i32.add (local.get $hay) (local.get $idx))))
    (if (i32.eq (local.get $b) (i32.const 45))
      (then (local.set $idx (i32.add (local.get $idx) (i32.const 1))))
    )
    (block $done
      (loop $loop
        (br_if $done (i32.ge_u (local.get $idx) (local.get $hlen)))
        (local.set $b (i32.load8_u (i32.add (local.get $hay) (local.get $idx))))
        (br_if $done (i32.lt_u (local.get $b) (i32.const 48)))
        (br_if $done (i32.gt_u (local.get $b) (i32.const 57)))
        (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
        (br $loop)
      )
    )
    (if (i32.eq (local.get $idx) (local.get $start)) (then (return (local.get $defval))))
    (call $parse_int (i32.add (local.get $hay) (local.get $start)) (i32.sub (local.get $idx) (local.get $start)))
  )

  ;; Extract JSON boolean value (1 if 'true', 0 otherwise)
  (func $json_get_bool (param $hay i32) (param $hlen i32) (param $key i32) (param $klen i32) (result i32)
    (local $idx i32)
    (local.set $idx (call $json_find_val (local.get $hay) (local.get $hlen) (local.get $key) (local.get $klen)))
    (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const 0))))
    (if (i32.ge_u (i32.add (local.get $idx) (i32.const 4)) (local.get $hlen)) (then (return (i32.const 0))))
    (i32.eq (i32.load8_u (i32.add (local.get $hay) (local.get $idx))) (i32.const 116)) ;; 't'
  )

  ;; ============================================================================
  ;; STORAGE.PRIVATE HOST API HELPERS
  ;; ============================================================================
  (func $get_slot_key_ptr (param $slot i32) (result i32)
    (if (i32.eq (local.get $slot) (i32.const 2)) (then (return (i32.const 131102))))
    (if (i32.eq (local.get $slot) (i32.const 3)) (then (return (i32.const 131114))))
    (i32.const 131090)
  )

  ;; storage.get(key, klen) -> reads value into $TEMP_BUF, returns value length (0 if null/missing)
  (func $storage_get (param $kptr i32) (param $klen i32) (result i32)
    (local $saved_out i32)
    (local $req_len i32)
    (local $res_len i32)
    (local.set $saved_out (global.get $out_pos))
    (global.set $out_pos (global.get $HOST_REQ))
    (call $out_bytes (i32.const 131130) (i32.const 53))
    (call $out_bytes (local.get $kptr) (local.get $klen))
    (call $out_bytes (i32.const 131190) (i32.const 3))
    (local.set $req_len (i32.sub (global.get $out_pos) (global.get $HOST_REQ)))
    (global.set $out_pos (local.get $saved_out))
    (local.set $res_len (call $host_call (global.get $HOST_REQ) (local.get $req_len) (global.get $HOST_RES) (i32.const 8192)))
    (if (i32.le_s (local.get $res_len) (i32.const 0)) (then (return (i32.const 0))))
    (call $json_get_str (global.get $HOST_RES) (local.get $res_len) (i32.const 131465) (i32.const 5) (global.get $TEMP_BUF) (i32.const 4096))
  )

  ;; storage.set(key, klen, val, vlen)
  (func $storage_set (param $kptr i32) (param $klen i32) (param $vptr i32) (param $vlen i32)
    (local $saved_out i32)
    (local $req_len i32)
    (local.set $saved_out (global.get $out_pos))
    (global.set $out_pos (global.get $HOST_REQ))
    (call $out_bytes (i32.const 131200) (i32.const 53))
    (call $out_bytes (local.get $kptr) (local.get $klen))
    (call $out_bytes (i32.const 131260) (i32.const 11))
    (call $out_json_str (local.get $vptr) (local.get $vlen))
    (call $out_bytes (i32.const 131190) (i32.const 3))
    (local.set $req_len (i32.sub (global.get $out_pos) (global.get $HOST_REQ)))
    (global.set $out_pos (local.get $saved_out))
    (drop (call $host_call (global.get $HOST_REQ) (local.get $req_len) (global.get $HOST_RES) (i32.const 1024)))
  )

  ;; ============================================================================
  ;; SLOT SERIALIZATION & DESERIALIZATION
  ;; ============================================================================
  (func $reset_slot_state
    (call $memcpy (global.get $STAGE_BUF) (i32.const 131625) (i32.const 5))
    (global.set $stage_len (i32.const 5))
    (global.set $class_len (i32.const 0))
    (global.set $phase_len (i32.const 0))
    (global.set $ch_t_len (i32.const 0))
    (global.set $ch_p_len (i32.const 0))
    (global.set $sum_len (i32.const 0))
    (global.set $s1t_len (i32.const 0))
    (global.set $s1p_len (i32.const 0))
    (global.set $s2t_len (i32.const 0))
    (global.set $s2p_len (i32.const 0))
    (global.set $s3t_len (i32.const 0))
    (global.set $s3p_len (i32.const 0))
    (global.set $hp (i32.const 0))
    (global.set $max_hp (i32.const 0))
    (global.set $atk (i32.const 0))
    (global.set $def (i32.const 0))
    (global.set $turn (i32.const 0))
    (global.set $tension (i32.const 0))
  )

  ;; Find key=val in $TEMP_BUF ($tlen), copy val into $dst (max $cap), return val len
  (func $kv_get_str (param $tlen i32) (param $kptr i32) (param $klen i32) (param $dst i32) (param $cap i32) (result i32)
    (local $i i32)
    (local $line_start i32)
    (local $line_end i32)
    (local $vstart i32)
    (local $vlen i32)
    (local.set $i (i32.const 0))
    (block $done
      (loop $loop
        (br_if $done (i32.ge_u (local.get $i) (local.get $tlen)))
        (local.set $line_start (local.get $i))
        (block $eol
          (loop $scan
            (br_if $eol (i32.ge_u (local.get $i) (local.get $tlen)))
            (br_if $eol (i32.eq (i32.load8_u (i32.add (global.get $TEMP_BUF) (local.get $i))) (i32.const 124))) ;; '|'
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $scan)
          )
        )
        (local.set $line_end (local.get $i))
        (if (call $starts_with
              (i32.add (global.get $TEMP_BUF) (local.get $line_start))
              (i32.sub (local.get $line_end) (local.get $line_start))
              (local.get $kptr)
              (local.get $klen)
            )
          (then
            (local.set $vstart (i32.add (local.get $line_start) (local.get $klen)))
            (local.set $vlen (i32.sub (local.get $line_end) (local.get $vstart)))
            (if (i32.gt_u (local.get $vlen) (local.get $cap)) (then (local.set $vlen (local.get $cap))))
            (call $memcpy (local.get $dst) (i32.add (global.get $TEMP_BUF) (local.get $vstart)) (local.get $vlen))
            (return (local.get $vlen))
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
    (i32.const 0)
  )

  (func $kv_get_int (param $tlen i32) (param $kptr i32) (param $klen i32) (result i32)
    (local $len i32)
    (local.set $len (call $kv_get_str (local.get $tlen) (local.get $kptr) (local.get $klen) (global.get $ROLL_TXT) (i32.const 24)))
    (call $parse_int (global.get $ROLL_TXT) (local.get $len))
  )

  (func $load_slot (param $slot i32)
    (local $tlen i32)
    (call $reset_slot_state)
    (local.set $tlen (call $storage_get (call $get_slot_key_ptr (local.get $slot)) (i32.const 10)))
    (if (i32.eqz (local.get $tlen)) (then (return)))
    (global.set $stage_len (call $kv_get_str (local.get $tlen) (i32.const 131770) (i32.const 6) (global.get $STAGE_BUF) (i32.const 32)))
    (if (i32.eqz (global.get $stage_len))
      (then
        (call $memcpy (global.get $STAGE_BUF) (i32.const 131625) (i32.const 5))
        (global.set $stage_len (i32.const 5))
      )
    )
    (global.set $ch_t_len (call $kv_get_str (local.get $tlen) (i32.const 131778) (i32.const 6) (global.get $CH_T) (i32.const 120)))
    (global.set $ch_p_len (call $kv_get_str (local.get $tlen) (i32.const 131786) (i32.const 8) (global.get $CH_P) (i32.const 240)))
    (global.set $class_len (call $kv_get_str (local.get $tlen) (i32.const 131796) (i32.const 6) (global.get $CLASS_BUF) (i32.const 32)))
    (global.set $hp (call $kv_get_int (local.get $tlen) (i32.const 131804) (i32.const 3)))
    (global.set $max_hp (call $kv_get_int (local.get $tlen) (i32.const 131810) (i32.const 7)))
    (global.set $atk (call $kv_get_int (local.get $tlen) (i32.const 131820) (i32.const 4)))
    (global.set $def (call $kv_get_int (local.get $tlen) (i32.const 131826) (i32.const 4)))
    (global.set $turn (call $kv_get_int (local.get $tlen) (i32.const 131832) (i32.const 5)))
    (global.set $tension (call $kv_get_int (local.get $tlen) (i32.const 131840) (i32.const 8)))
    (global.set $phase_len (call $kv_get_str (local.get $tlen) (i32.const 131850) (i32.const 6) (global.get $PHASE_BUF) (i32.const 32)))
    (global.set $sum_len (call $kv_get_str (local.get $tlen) (i32.const 131858) (i32.const 8) (global.get $SUMMARY) (i32.const 450)))
    (global.set $s1t_len (call $kv_get_str (local.get $tlen) (i32.const 131868) (i32.const 4) (global.get $S1_T) (i32.const 120)))
    (global.set $s1p_len (call $kv_get_str (local.get $tlen) (i32.const 131874) (i32.const 4) (global.get $S1_P) (i32.const 240)))
    (global.set $s2t_len (call $kv_get_str (local.get $tlen) (i32.const 131880) (i32.const 4) (global.get $S2_T) (i32.const 120)))
    (global.set $s2p_len (call $kv_get_str (local.get $tlen) (i32.const 131886) (i32.const 4) (global.get $S2_P) (i32.const 240)))
    (global.set $s3t_len (call $kv_get_str (local.get $tlen) (i32.const 131892) (i32.const 4) (global.get $S3_T) (i32.const 120)))
    (global.set $s3p_len (call $kv_get_str (local.get $tlen) (i32.const 131898) (i32.const 4) (global.get $S3_P) (i32.const 240)))
  )

  ;; Write sanitized bytes (replace '|' with '/') to output buffer
  (func $out_pipe_safe (param $ptr i32) (param $len i32)
    (local $i i32)
    (local $b i32)
    (local.set $i (i32.const 0))
    (block $done
      (loop $loop
        (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
        (local.set $b (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))
        (if (i32.eq (local.get $b) (i32.const 124)) (then (local.set $b (i32.const 47))))
        (i32.store8 (global.get $out_pos) (local.get $b))
        (global.set $out_pos (i32.add (global.get $out_pos) (i32.const 1)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
  )

  (func $out_kv_str (param $kptr i32) (param $klen i32) (param $vptr i32) (param $vlen i32)
    (call $out_bytes (local.get $kptr) (local.get $klen))
    (call $out_pipe_safe (local.get $vptr) (local.get $vlen))
    (i32.store8 (global.get $out_pos) (i32.const 124))
    (global.set $out_pos (i32.add (global.get $out_pos) (i32.const 1)))
  )

  (func $out_kv_int (param $kptr i32) (param $klen i32) (param $val i32)
    (call $out_bytes (local.get $kptr) (local.get $klen))
    (call $out_int (local.get $val))
    (i32.store8 (global.get $out_pos) (i32.const 124))
    (global.set $out_pos (i32.add (global.get $out_pos) (i32.const 1)))
  )

  (func $save_slot (param $slot i32)
    (local $saved_out i32)
    (local $slen i32)
    (local.set $saved_out (global.get $out_pos))
    (global.set $out_pos (global.get $SLOT_BUF))
    (call $out_kv_str (i32.const 131770) (i32.const 6) (global.get $STAGE_BUF) (global.get $stage_len))
    (call $out_kv_str (i32.const 131778) (i32.const 6) (global.get $CH_T) (global.get $ch_t_len))
    (call $out_kv_str (i32.const 131786) (i32.const 8) (global.get $CH_P) (global.get $ch_p_len))
    (call $out_kv_str (i32.const 131796) (i32.const 6) (global.get $CLASS_BUF) (global.get $class_len))
    (call $out_kv_int (i32.const 131804) (i32.const 3) (global.get $hp))
    (call $out_kv_int (i32.const 131810) (i32.const 7) (global.get $max_hp))
    (call $out_kv_int (i32.const 131820) (i32.const 4) (global.get $atk))
    (call $out_kv_int (i32.const 131826) (i32.const 4) (global.get $def))
    (call $out_kv_int (i32.const 131832) (i32.const 5) (global.get $turn))
    (call $out_kv_int (i32.const 131840) (i32.const 8) (global.get $tension))
    (call $out_kv_str (i32.const 131850) (i32.const 6) (global.get $PHASE_BUF) (global.get $phase_len))
    (call $out_kv_str (i32.const 131858) (i32.const 8) (global.get $SUMMARY) (global.get $sum_len))
    (call $out_kv_str (i32.const 131868) (i32.const 4) (global.get $S1_T) (global.get $s1t_len))
    (call $out_kv_str (i32.const 131874) (i32.const 4) (global.get $S1_P) (global.get $s1p_len))
    (call $out_kv_str (i32.const 131880) (i32.const 4) (global.get $S2_T) (global.get $s2t_len))
    (call $out_kv_str (i32.const 131886) (i32.const 4) (global.get $S2_P) (global.get $s2p_len))
    (call $out_kv_str (i32.const 131892) (i32.const 4) (global.get $S3_T) (global.get $s3t_len))
    (call $out_kv_str (i32.const 131898) (i32.const 4) (global.get $S3_P) (global.get $s3p_len))
    (local.set $slen (i32.sub (global.get $out_pos) (global.get $SLOT_BUF)))
    (global.set $out_pos (local.get $saved_out))
    (call $storage_set (call $get_slot_key_ptr (local.get $slot)) (i32.const 10) (global.get $SLOT_BUF) (local.get $slen))
  )

  (func $load_active_slot
    (local $len i32)
    (local $s i32)
    (local.set $len (call $storage_get (i32.const 131072) (i32.const 15)))
    (if (i32.eqz (local.get $len))
      (then (global.set $active_slot (i32.const 1)))
      (else
        (local.set $s (call $parse_int (global.get $TEMP_BUF) (local.get $len)))
        (if (i32.or (i32.lt_s (local.get $s) (i32.const 1)) (i32.gt_s (local.get $s) (i32.const 3)))
          (then (local.set $s (i32.const 1)))
        )
        (global.set $active_slot (local.get $s))
      )
    )
  )

  (func $save_active_slot (param $slot i32)
    (local $saved_out i32)
    (global.set $active_slot (local.get $slot))
    (local.set $saved_out (global.get $out_pos))
    (global.set $out_pos (global.get $TEMP_BUF))
    (call $out_int (local.get $slot))
    (global.set $out_pos (local.get $saved_out))
    (call $storage_set (i32.const 131072) (i32.const 15) (global.get $TEMP_BUF) (i32.const 1))
  )

  ;; ============================================================================
  ;; COMMAND & INPUT PARSING
  ;; ============================================================================
  (func $parse_input (param $in_ptr i32) (param $len i32)
    (local $i i32)
    (local $sub_start i32)
    (local $sub_len i32)
    (local $arg_start i32)
    (local $arg_len i32)

    (global.set $in_len (local.get $len))
    (global.set $act_len (call $json_get_str (local.get $in_ptr) (local.get $len) (i32.const 131280) (i32.const 6) (global.get $ACT_BUF) (i32.const 60)))
    (global.set $cmd_len (call $json_get_str (local.get $in_ptr) (local.get $len) (i32.const 131290) (i32.const 7) (global.get $CMD_RAW) (i32.const 250)))
    (global.set $qry_len (call $json_get_str (local.get $in_ptr) (local.get $len) (i32.const 131300) (i32.const 5) (global.get $QRY_BUF) (i32.const 250)))
    (global.set $int_len (call $json_get_str (local.get $in_ptr) (local.get $len) (i32.const 131310) (i32.const 6) (global.get $INTENT) (i32.const 250)))
    (global.set $note_len (call $json_get_str (local.get $in_ptr) (local.get $len) (i32.const 131320) (i32.const 12) (global.get $NOTE) (i32.const 250)))
    (global.set $outc_len (call $json_get_str (local.get $in_ptr) (local.get $len) (i32.const 131448) (i32.const 14) (global.get $OUTCOME_BUF) (i32.const 32)))
    (global.set $in_tdelta (call $json_get_int (local.get $in_ptr) (local.get $len) (i32.const 131405) (i32.const 13) (i32.const 10)))
    (global.set $in_dc (call $json_get_int (local.get $in_ptr) (local.get $len) (i32.const 131420) (i32.const 2) (i32.const 12)))
    (global.set $in_roll (call $json_get_bool (local.get $in_ptr) (local.get $len) (i32.const 131425) (i32.const 11)))
    (global.set $in_rest (call $json_get_bool (local.get $in_ptr) (local.get $len) (i32.const 131440) (i32.const 4)))

    ;; If action was empty and command is present, parse command string (e.g. "/rpg help")
    (if (i32.and (i32.eqz (global.get $act_len)) (i32.gt_u (global.get $cmd_len) (i32.const 0)))
      (then
        (local.set $i (i32.const 0))
        ;; If starts with '/', skip first token (/rpg)
        (if (i32.eq (i32.load8_u (global.get $CMD_RAW)) (i32.const 47))
          (then
            (block $tok_done
              (loop $tok
                (br_if $tok_done (i32.ge_u (local.get $i) (global.get $cmd_len)))
                (br_if $tok_done (i32.eq (i32.load8_u (i32.add (global.get $CMD_RAW) (local.get $i))) (i32.const 32)))
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                (br $tok)
              )
            )
          )
        )
        ;; Skip spaces
        (block $sp1_done
          (loop $sp1
            (br_if $sp1_done (i32.ge_u (local.get $i) (global.get $cmd_len)))
            (br_if $sp1_done (i32.ne (i32.load8_u (i32.add (global.get $CMD_RAW) (local.get $i))) (i32.const 32)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $sp1)
          )
        )
        (if (i32.ge_u (local.get $i) (global.get $cmd_len))
          (then
            ;; Bare /rpg: if query or intent is non-empty, treat as action; else "start"
            (if (i32.or (i32.gt_u (global.get $qry_len) (i32.const 0)) (i32.gt_u (global.get $int_len) (i32.const 0)))
              (then
                (call $memcpy (global.get $ACT_BUF) (i32.const 131280) (i32.const 6)) ;; "action"
                (global.set $act_len (i32.const 6))
                (if (i32.eqz (global.get $int_len))
                  (then
                    (call $memcpy (global.get $INTENT) (global.get $QRY_BUF) (global.get $qry_len))
                    (global.set $int_len (global.get $qry_len))
                  )
                )
              )
              (else
                (call $memcpy (global.get $ACT_BUF) (i32.const 131480) (i32.const 5)) ;; "start"
                (global.set $act_len (i32.const 5))
              )
            )
          )
          (else
            (local.set $sub_start (local.get $i))
            (block $sub_done
              (loop $sub
                (br_if $sub_done (i32.ge_u (local.get $i) (global.get $cmd_len)))
                (br_if $sub_done (i32.eq (i32.load8_u (i32.add (global.get $CMD_RAW) (local.get $i))) (i32.const 32)))
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                (br $sub)
              )
            )
            (local.set $sub_len (i32.sub (local.get $i) (local.get $sub_start)))
            (if (i32.gt_u (local.get $sub_len) (i32.const 60)) (then (local.set $sub_len (i32.const 60))))
            (call $memcpy (global.get $ACT_BUF) (i32.add (global.get $CMD_RAW) (local.get $sub_start)) (local.get $sub_len))
            (global.set $act_len (local.get $sub_len))

            ;; Skip spaces before argument
            (block $sp2_done
              (loop $sp2
                (br_if $sp2_done (i32.ge_u (local.get $i) (global.get $cmd_len)))
                (br_if $sp2_done (i32.ne (i32.load8_u (i32.add (global.get $CMD_RAW) (local.get $i))) (i32.const 32)))
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                (br $sp2)
              )
            )
            (if (i32.lt_u (local.get $i) (global.get $cmd_len))
              (then
                (local.set $arg_start (local.get $i))
                (local.set $arg_len (i32.sub (global.get $cmd_len) (local.get $arg_start)))
                (if (i32.eqz (global.get $qry_len))
                  (then
                    (call $memcpy (global.get $QRY_BUF) (i32.add (global.get $CMD_RAW) (local.get $arg_start)) (local.get $arg_len))
                    (global.set $qry_len (local.get $arg_len))
                  )
                )
                (if (i32.eqz (global.get $int_len))
                  (then
                    (call $memcpy (global.get $INTENT) (i32.add (global.get $CMD_RAW) (local.get $arg_start)) (local.get $arg_len))
                    (global.set $int_len (local.get $arg_len))
                  )
                )
              )
            )
          )
        )
      )
    )
    ;; Default if still empty -> "start"
    (if (i32.eqz (global.get $act_len))
      (then
        (call $memcpy (global.get $ACT_BUF) (i32.const 131480) (i32.const 5))
        (global.set $act_len (i32.const 5))
      )
    )
  )

  ;; ============================================================================
  ;; UI RENDERERS
  ;; ============================================================================
  (func $emit_help
    (global.set $out_pos (global.get $OUT_BASE))
    (call $out_cstr (i32.const 132000))
  )

  (func $emit_rpg_system_new
    (global.set $out_pos (global.get $OUT_BASE))
    (call $out_cstr (i32.const 133000))
  )

  (func $emit_choose_story_ui
    (global.set $out_pos (global.get $OUT_BASE))
    (call $out_cstr (i32.const 134000)) ;; header
    (call $out_json_str (global.get $S1_T) (global.get $s1t_len))
    (call $out_cstr (i32.const 134400)) ;; s1 mid
    (call $out_json_str (global.get $S1_P) (global.get $s1p_len))
    (call $out_cstr (i32.const 134450)) ;; s2 head
    (call $out_json_str (global.get $S2_T) (global.get $s2t_len))
    (call $out_cstr (i32.const 134400)) ;; s2 mid
    (call $out_json_str (global.get $S2_P) (global.get $s2p_len))
    (call $out_cstr (i32.const 134500)) ;; s3 head
    (call $out_json_str (global.get $S3_T) (global.get $s3t_len))
    (call $out_cstr (i32.const 134400)) ;; s3 mid
    (call $out_json_str (global.get $S3_P) (global.get $s3p_len))
    (call $out_cstr (i32.const 134550)) ;; buttons footer
  )

  (data (i32.const 134000) "{\22type\22:\22ui\22,\22displayText\22:\22Choose Your Story\22,\22ui\22:{\22title\22:\22Choose Your Story\22,\22subtitle\22:\22Select an opening premise\22,\22badge\22:\22STORY\22,\22badgeColor\22:\22grey\22,\22hideText\22:true,\22elements\22:[{\22type\22:\22key_value\22,\22items\22:[{\22label\22:\221. \00")
  (data (i32.const 134400) "\22,\22value\22:\22\00")
  (data (i32.const 134450) "\22},{\22label\22:\222. \00")
  (data (i32.const 134500) "\22},{\22label\22:\223. \00")
  (data (i32.const 134550) "\22}]},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22Story 1\22,\22action\22:\22command\22,\22payload\22:\22/rpg pick_story 1\22,\22style\22:\22primary\22},{\22label\22:\22Story 2\22,\22action\22:\22command\22,\22payload\22:\22/rpg pick_story 2\22,\22style\22:\22secondary\22},{\22label\22:\22Story 3\22,\22action\22:\22command\22,\22payload\22:\22/rpg pick_story 3\22,\22style\22:\22secondary\22}]}]}}\00")

  (func $emit_select_class_ui
    (global.set $out_pos (global.get $OUT_BASE))
    (call $out_cstr (i32.const 135000))
    (call $out_json_str (global.get $CH_T) (global.get $ch_t_len))
    (call $out_cstr (i32.const 135200))
  )

  (data (i32.const 135000) "{\22type\22:\22ui\22,\22displayText\22:\22Select Your Character\22,\22ui\22:{\22title\22:\22Select Your Character\22,\22subtitle\22:\22\00")
  (data (i32.const 135200) "\22,\22badge\22:\22CLASS\22,\22badgeColor\22:\22grey\22,\22hideText\22:true,\22elements\22:[{\22type\22:\22text\22,\22text\22:\22KNIGHT\\n  [=+=]\\n  /|#|\\\\  HP 120 | ATK 12 | DEF 14\\n   / \\\\   Vanguard Tank & Shield\22},{\22type\22:\22divider\22},{\22type\22:\22text\22,\22text\22:\22ARCHER\\n   /|\\\\\\n  >>-+-> HP 95  | ATK 15 | DEF 11\\n   / \\\\   Precision Scout & Crit\22},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22Choose Knight\22,\22action\22:\22command\22,\22payload\22:\22/rpg select_class knight\22,\22style\22:\22primary\22},{\22label\22:\22Choose Archer\22,\22action\22:\22command\22,\22payload\22:\22/rpg select_class archer\22,\22style\22:\22secondary\22}]}]}}\00")

  (func $emit_rpg_state (param $roll i32) (param $roll_ok i32)
    (global.set $out_pos (global.get $OUT_BASE))
    (call $out_cstr (i32.const 141000)) ;; {"type":"text","displayText":"[RPG_STATE]\nSlot:
    (call $out_int (global.get $active_slot))
    (call $out_cstr (i32.const 141060)) ;; \nStory:
    (call $out_json_str (global.get $CH_T) (global.get $ch_t_len))
    (call $out_cstr (i32.const 141080)) ;; \nPremise:
    (call $out_json_str (global.get $CH_P) (global.get $ch_p_len))
    (call $out_cstr (i32.const 141100)) ;; \nClass:
    (call $out_json_str (global.get $CLASS_BUF) (global.get $class_len))
    (call $out_cstr (i32.const 141120)) ;; \nHP:
    (call $out_int (global.get $hp))
    (call $out_cstr (i32.const 141135)) ;; /
    (call $out_int (global.get $max_hp))
    (call $out_cstr (i32.const 141145)) ;;  | ATK:
    (call $out_int (global.get $atk))
    (call $out_cstr (i32.const 141160)) ;;  | DEF:
    (call $out_int (global.get $def))
    (call $out_cstr (i32.const 141175)) ;; \nTurn:
    (call $out_int (global.get $turn))
    (call $out_cstr (i32.const 141190)) ;;  | Tension:
    (call $out_int (global.get $tension))
    (call $out_cstr (i32.const 141210)) ;; /100 | Phase:
    (call $out_json_str (global.get $PHASE_BUF) (global.get $phase_len))
    (if (i32.gt_s (local.get $roll) (i32.const 0))
      (then
        (call $out_cstr (i32.const 141230)) ;; \nRoll_d20:
        (call $out_int (local.get $roll))
        (call $out_cstr (i32.const 141250)) ;;  vs DC
        (call $out_int (global.get $in_dc))
        (if (local.get $roll_ok)
          (then (call $out_cstr (i32.const 141265))) ;;  (SUCCESS)
          (else (call $out_cstr (i32.const 141285))) ;;  (FAIL)
        )
      )
    )
    (if (i32.gt_u (global.get $int_len) (i32.const 0))
      (then
        (call $out_cstr (i32.const 141300)) ;; \nPlayer_Intent:
        (call $out_json_str (global.get $INTENT) (global.get $int_len))
      )
    )
    (call $out_cstr (i32.const 141330)) ;; \nSummary:
    (call $out_json_str (global.get $SUMMARY) (global.get $sum_len))
    (call $out_cstr (i32.const 141350)) ;; directive footer + "}
  )

  (data (i32.const 141000) "{\22type\22:\22text\22,\22displayText\22:\22[RPG_STATE]\\nSlot: \00")
  (data (i32.const 141060) "\\nStory: \00")
  (data (i32.const 141080) "\\nPremise: \00")
  (data (i32.const 141100) "\\nClass: \00")
  (data (i32.const 141120) "\\nHP: \00")
  (data (i32.const 141135) "/\00")
  (data (i32.const 141145) " | ATK: \00")
  (data (i32.const 141160) " | DEF: \00")
  (data (i32.const 141175) "\\nTurn: \00")
  (data (i32.const 141190) " | Tension: \00")
  (data (i32.const 141210) "/100 | Phase: \00")
  (data (i32.const 141230) "\\nRoll_d20: \00")
  (data (i32.const 141250) " vs DC \00")
  (data (i32.const 141265) " (SUCCESS)\00")
  (data (i32.const 141285) " (FAIL)\00")
  (data (i32.const 141300) "\\nPlayer_Intent: \00")
  (data (i32.const 141330) "\\nSummary: \00")
  (data (i32.const 141350) "\\n\\n[DM_DIRECTIVES]\\n- Narrate like a skilled D&D Dungeon Master with atmospheric sensory details and clear momentum.\\n- Do NOT end with a generic 'What do you do?'; instead weave natural hooks, NPC reactions, or immediate stakes.\\n- Respect Phase, Roll_d20, Tension, and HP strictly.\\n- When calling action='action' next turn, always pass a concise 1-sentence summary_note and tension_delta.\\n[/RPG_STATE]\22}\00")

  (func $emit_status_ui
    (local $hp_pct i32)
    (local.set $hp_pct (i32.const 0))
    (if (i32.gt_s (global.get $max_hp) (i32.const 0))
      (then (local.set $hp_pct (i32.div_s (i32.mul (global.get $hp) (i32.const 100)) (global.get $max_hp))))
    )
    (global.set $out_pos (global.get $OUT_BASE))
    (call $out_cstr (i32.const 136100))
    (call $out_json_str (global.get $CH_T) (global.get $ch_t_len))
    (call $out_cstr (i32.const 136220)) ;; subtitle mid
    (call $out_int (global.get $active_slot))
    (call $out_cstr (i32.const 136240)) ;; Turn
    (call $out_int (global.get $turn))
    (call $out_cstr (i32.const 136260)) ;; badge
    (call $out_json_str (global.get $PHASE_BUF) (global.get $phase_len))
    (call $out_cstr (i32.const 136300)) ;; hp progress
    (call $out_int (local.get $hp_pct))
    (call $out_cstr (i32.const 136420)) ;; hp label
    (call $out_int (global.get $hp))
    (call $out_cstr (i32.const 141135)) ;; /
    (call $out_int (global.get $max_hp))
    (call $out_cstr (i32.const 136460)) ;; tension progress
    (call $out_int (global.get $tension))
    (call $out_cstr (i32.const 136520)) ;; tension label
    (call $out_int (global.get $tension))
    (call $out_cstr (i32.const 136560)) ;; kv class
    (call $out_json_str (global.get $CLASS_BUF) (global.get $class_len))
    (call $out_cstr (i32.const 136650)) ;; atk/def
    (call $out_int (global.get $atk))
    (call $out_cstr (i32.const 136700))
    (call $out_int (global.get $def))
    (call $out_cstr (i32.const 136740)) ;; summary
    (call $out_json_str (global.get $SUMMARY) (global.get $sum_len))
    (call $out_cstr (i32.const 136800)) ;; buttons footer
  )

  (data (i32.const 136100) "{\22type\22:\22ui\22,\22displayText\22:\22Campaign Status\22,\22ui\22:{\22title\22:\22\00")
  (data (i32.const 136220) "\22,\22subtitle\22:\22Slot \00")
  (data (i32.const 136240) " \e2\80\a2 Turn \00")
  (data (i32.const 136260) "\22,\22badge\22:\22\00")
  (data (i32.const 136300) "\22,\22badgeColor\22:\22grey\22,\22hideText\22:true,\22elements\22:[{\22type\22:\22progress\22,\22value\22:\00")
  (data (i32.const 136420) ",\22label\22:\22HP: \00")
  (data (i32.const 136460) "\22},{\22type\22:\22progress\22,\22value\22:\00")
  (data (i32.const 136520) ",\22label\22:\22Tension: \00")
  (data (i32.const 136560) "/100\22},{\22type\22:\22key_value\22,\22items\22:[{\22label\22:\22Class\22,\22value\22:\22\00")
  (data (i32.const 136650) "\22},{\22label\22:\22Stats\22,\22value\22:\22ATK \00")
  (data (i32.const 136700) " | DEF \00")
  (data (i32.const 136740) "\22},{\22label\22:\22Summary\22,\22value\22:\22\00")
  (data (i32.const 136800) "\22}]},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22Campaign Slots\22,\22action\22:\22command\22,\22payload\22:\22/rpg games\22,\22style\22:\22secondary\22},{\22label\22:\22New Story\22,\22action\22:\22command\22,\22payload\22:\22/rpg new\22,\22style\22:\22secondary\22},{\22label\22:\22Delete Slot\22,\22action\22:\22command\22,\22payload\22:\22/rpg delete\22,\22style\22:\22danger\22}]}]}}\00")

  ;; Emit a single slot summary value inside /rpg games
  (func $out_slot_preview (param $slot i32)
    (call $load_slot (local.get $slot))
    (if (i32.eq (local.get $slot) (global.get $active_slot))
      (then (call $out_cstr (i32.const 137850))) ;; [ACTIVE] 
    )
    (if (i32.eqz (global.get $ch_t_len))
      (then (call $out_cstr (i32.const 137870))) ;; Empty slot
      (else
        (call $out_json_str (global.get $CH_T) (global.get $ch_t_len))
        (if (i32.gt_u (global.get $class_len) (i32.const 0))
          (then
            (call $out_cstr (i32.const 137890)) ;;  (
            (call $out_json_str (global.get $CLASS_BUF) (global.get $class_len))
            (call $out_cstr (i32.const 137900)) ;; , Turn 
            (call $out_int (global.get $turn))
            (call $out_cstr (i32.const 137920)) ;; )
          )
        )
      )
    )
  )

  (func $emit_games_ui
    (local $saved_active i32)
    (local.set $saved_active (global.get $active_slot))
    (global.set $out_pos (global.get $OUT_BASE))
    (call $out_cstr (i32.const 137500)) ;; header + Slot 1
    (call $out_slot_preview (i32.const 1))
    (call $out_cstr (i32.const 137780)) ;; Slot 2
    (call $out_slot_preview (i32.const 2))
    (call $out_cstr (i32.const 137815)) ;; Slot 3
    (call $out_slot_preview (i32.const 3))
    (call $out_cstr (i32.const 137940)) ;; buttons footer
    (call $load_slot (local.get $saved_active))
  )

  (data (i32.const 137500) "{\22type\22:\22ui\22,\22displayText\22:\22Saved Campaigns\22,\22ui\22:{\22title\22:\22Saved Campaigns\22,\22subtitle\22:\223 Persistent Slots\22,\22badge\22:\22SAVES\22,\22badgeColor\22:\22grey\22,\22hideText\22:true,\22elements\22:[{\22type\22:\22key_value\22,\22items\22:[{\22label\22:\22Slot 1\22,\22value\22:\22\00")
  (data (i32.const 137780) "\22},{\22label\22:\22Slot 2\22,\22value\22:\22\00")
  (data (i32.const 137815) "\22},{\22label\22:\22Slot 3\22,\22value\22:\22\00")
  (data (i32.const 137850) "[ACTIVE] \00")
  (data (i32.const 137870) "Empty slot\00")
  (data (i32.const 137890) " (\00")
  (data (i32.const 137900) ", Turn \00")
  (data (i32.const 137920) ")\00")
  (data (i32.const 137940) "\22}]},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22Slot 1\22,\22action\22:\22command\22,\22payload\22:\22/rpg switch 1\22,\22style\22:\22secondary\22},{\22label\22:\22Slot 2\22,\22action\22:\22command\22,\22payload\22:\22/rpg switch 2\22,\22style\22:\22secondary\22},{\22label\22:\22Slot 3\22,\22action\22:\22command\22,\22payload\22:\22/rpg switch 3\22,\22style\22:\22secondary\22}]},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22New Story\22,\22action\22:\22command\22,\22payload\22:\22/rpg new\22,\22style\22:\22primary\22},{\22label\22:\22Delete Active\22,\22action\22:\22command\22,\22payload\22:\22/rpg delete\22,\22style\22:\22danger\22}]}]}}\00")

  (func $emit_switch_ui
    (global.set $out_pos (global.get $OUT_BASE))
    (call $out_cstr (i32.const 138600))
    (call $out_int (global.get $active_slot))
    (call $out_cstr (i32.const 138720))
  )

  (data (i32.const 138600) "{\22type\22:\22ui\22,\22displayText\22:\22Slot Switched\22,\22ui\22:{\22title\22:\22Active Slot Switched\22,\22subtitle\22:\22Now using Slot \00")
  (data (i32.const 138720) "\22,\22badge\22:\22SAVES\22,\22badgeColor\22:\22grey\22,\22hideText\22:true,\22elements\22:[{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22Continue / Start\22,\22action\22:\22command\22,\22payload\22:\22/rpg\22,\22style\22:\22primary\22},{\22label\22:\22All Slots\22,\22action\22:\22command\22,\22payload\22:\22/rpg games\22,\22style\22:\22secondary\22}]}]}}\00")

  (func $emit_delete_confirm_ui
    (global.set $out_pos (global.get $OUT_BASE))
    (call $out_cstr (i32.const 139100))
    (call $out_int (global.get $active_slot))
    (call $out_cstr (i32.const 139220))
  )

  (data (i32.const 139100) "{\22type\22:\22ui\22,\22displayText\22:\22Confirm Delete\22,\22ui\22:{\22title\22:\22Delete Campaign Slot?\22,\22subtitle\22:\22Active Slot \00")
  (data (i32.const 139220) " will be permanently cleared\22,\22badge\22:\22WARNING\22,\22badgeColor\22:\22grey\22,\22hideText\22:true,\22elements\22:[{\22type\22:\22text\22,\22text\22:\22This action removes your character, story, and summary from the active slot.\22},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22Confirm Delete\22,\22action\22:\22command\22,\22payload\22:\22/rpg confirm_delete\22,\22style\22:\22danger\22},{\22label\22:\22Cancel\22,\22action\22:\22command\22,\22payload\22:\22/rpg status\22,\22style\22:\22secondary\22}]}]}}\00")

  (func $emit_deleted_ui
    (global.set $out_pos (global.get $OUT_BASE))
    (call $out_cstr (i32.const 139900))
    (call $out_int (global.get $active_slot))
    (call $out_cstr (i32.const 140020))
  )

  (data (i32.const 139900) "{\22type\22:\22ui\22,\22displayText\22:\22Slot Cleared\22,\22ui\22:{\22title\22:\22Campaign Slot Cleared\22,\22subtitle\22:\22Slot \00")
  (data (i32.const 140020) " is now empty\22,\22badge\22:\22RESET\22,\22badgeColor\22:\22grey\22,\22hideText\22:true,\22elements\22:[{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22New Adventure\22,\22action\22:\22command\22,\22payload\22:\22/rpg new\22,\22style\22:\22primary\22},{\22label\22:\22All Slots\22,\22action\22:\22command\22,\22payload\22:\22/rpg games\22,\22style\22:\22secondary\22}]}]}}\00")

  ;; ============================================================================
  ;; SUMMARY APPEND HELPER (keeps <= 450 chars)
  ;; ============================================================================
  (func $append_summary (param $nptr i32) (param $nlen i32)
    (local $new_len i32)
    (local $drop i32)
    (if (i32.eqz (local.get $nlen)) (then (return)))
    (if (i32.gt_u (local.get $nlen) (i32.const 220)) (then (local.set $nlen (i32.const 220))))
    (if (i32.gt_u (global.get $sum_len) (i32.const 0))
      (then
        ;; Append ' ' before new note
        (local.set $new_len (i32.add (global.get $sum_len) (i32.add (local.get $nlen) (i32.const 1))))
        (if (i32.gt_u (local.get $new_len) (i32.const 450))
          (then
            (local.set $drop (i32.sub (local.get $new_len) (i32.const 450)))
            (if (i32.ge_u (local.get $drop) (global.get $sum_len))
              (then (global.set $sum_len (i32.const 0)))
              (else
                (call $memcpy
                  (global.get $SUMMARY)
                  (i32.add (global.get $SUMMARY) (local.get $drop))
                  (i32.sub (global.get $sum_len) (local.get $drop))
                )
                (global.set $sum_len (i32.sub (global.get $sum_len) (local.get $drop)))
              )
            )
          )
        )
        (if (i32.gt_u (global.get $sum_len) (i32.const 0))
          (then
            (i32.store8 (i32.add (global.get $SUMMARY) (global.get $sum_len)) (i32.const 32))
            (global.set $sum_len (i32.add (global.get $sum_len) (i32.const 1)))
          )
        )
      )
    )
    (call $memcpy (i32.add (global.get $SUMMARY) (global.get $sum_len)) (local.get $nptr) (local.get $nlen))
    (global.set $sum_len (i32.add (global.get $sum_len) (local.get $nlen)))
  )

  ;; ============================================================================
  ;; ACTION HANDLERS
  ;; ============================================================================
  (func $handle_new (param $in_ptr i32) (param $len i32)
    (local $t1 i32)
    (local.set $t1 (call $json_get_str (local.get $in_ptr) (local.get $len) (i32.const 131335) (i32.const 8) (global.get $S1_T) (i32.const 120)))
    (if (i32.eqz (local.get $t1))
      (then
        (call $emit_rpg_system_new)
        (return)
      )
    )
    (call $reset_slot_state)
    (global.set $s1t_len (call $json_get_str (local.get $in_ptr) (local.get $len) (i32.const 131335) (i32.const 8) (global.get $S1_T) (i32.const 120)))
    (global.set $s1p_len (call $json_get_str (local.get $in_ptr) (local.get $len) (i32.const 131345) (i32.const 10) (global.get $S1_P) (i32.const 240)))
    (global.set $s2t_len (call $json_get_str (local.get $in_ptr) (local.get $len) (i32.const 131358) (i32.const 8) (global.get $S2_T) (i32.const 120)))
    (global.set $s2p_len (call $json_get_str (local.get $in_ptr) (local.get $len) (i32.const 131368) (i32.const 10) (global.get $S2_P) (i32.const 240)))
    (global.set $s3t_len (call $json_get_str (local.get $in_ptr) (local.get $len) (i32.const 131380) (i32.const 8) (global.get $S3_T) (i32.const 120)))
    (global.set $s3p_len (call $json_get_str (local.get $in_ptr) (local.get $len) (i32.const 131390) (i32.const 10) (global.get $S3_P) (i32.const 240)))
    (call $memcpy (global.get $STAGE_BUF) (i32.const 131632) (i32.const 10)) ;; pick_story
    (global.set $stage_len (i32.const 10))
    (call $save_slot (global.get $active_slot))
    (call $emit_choose_story_ui)
  )

  (func $handle_pick_story
    (local $choice i32)
    (local.set $choice (call $parse_int (global.get $QRY_BUF) (global.get $qry_len)))
    (if (i32.eq (local.get $choice) (i32.const 2))
      (then
        (call $memcpy (global.get $CH_T) (global.get $S2_T) (global.get $s2t_len))
        (global.set $ch_t_len (global.get $s2t_len))
        (call $memcpy (global.get $CH_P) (global.get $S2_P) (global.get $s2p_len))
        (global.set $ch_p_len (global.get $s2p_len))
      )
      (else
        (if (i32.eq (local.get $choice) (i32.const 3))
          (then
            (call $memcpy (global.get $CH_T) (global.get $S3_T) (global.get $s3t_len))
            (global.set $ch_t_len (global.get $s3t_len))
            (call $memcpy (global.get $CH_P) (global.get $S3_P) (global.get $s3p_len))
            (global.set $ch_p_len (global.get $s3p_len))
          )
          (else
            (call $memcpy (global.get $CH_T) (global.get $S1_T) (global.get $s1t_len))
            (global.set $ch_t_len (global.get $s1t_len))
            (call $memcpy (global.get $CH_P) (global.get $S1_P) (global.get $s1p_len))
            (global.set $ch_p_len (global.get $s1p_len))
          )
        )
      )
    )
    (call $memcpy (global.get $STAGE_BUF) (i32.const 131644) (i32.const 10)) ;; pick_class
    (global.set $stage_len (i32.const 10))
    (call $save_slot (global.get $active_slot))
    (call $emit_select_class_ui)
  )

  (data (i32.const 139000) "Started campaign as\00") ;; len 19

  (func $handle_select_class
    (if (call $streq (global.get $QRY_BUF) (global.get $qry_len) (i32.const 131588) (i32.const 6)) ;; archer
      (then
        (call $memcpy (global.get $CLASS_BUF) (i32.const 131604) (i32.const 6)) ;; Archer
        (global.set $class_len (i32.const 6))
        (global.set $hp (i32.const 95))
        (global.set $max_hp (i32.const 95))
        (global.set $atk (i32.const 15))
        (global.set $def (i32.const 11))
      )
      (else
        (call $memcpy (global.get $CLASS_BUF) (i32.const 131596) (i32.const 6)) ;; Knight
        (global.set $class_len (i32.const 6))
        (global.set $hp (i32.const 120))
        (global.set $max_hp (i32.const 120))
        (global.set $atk (i32.const 12))
        (global.set $def (i32.const 14))
      )
    )
    (call $memcpy (global.get $STAGE_BUF) (i32.const 131656) (i32.const 7)) ;; playing
    (global.set $stage_len (i32.const 7))
    (call $memcpy (global.get $PHASE_BUF) (i32.const 131665) (i32.const 7)) ;; OPENING
    (global.set $phase_len (i32.const 7))
    (global.set $turn (i32.const 1))
    (global.set $tension (i32.const 15))
    (global.set $sum_len (i32.const 0))
    (call $append_summary (i32.const 139000) (i32.const 19))
    (call $append_summary (global.get $CLASS_BUF) (global.get $class_len))
    (call $save_slot (global.get $active_slot))
    (call $emit_rpg_state (i32.const 0) (i32.const 0))
  )

  (func $handle_action
    (local $seed i32)
    (local $roll i32)
    (local $roll_ok i32)
    (local $was_combat i32)

    ;; If not playing yet, route to appropriate step
    (if (i32.eqz (call $streq (global.get $STAGE_BUF) (global.get $stage_len) (i32.const 131656) (i32.const 7)))
      (then
        (if (call $streq (global.get $STAGE_BUF) (global.get $stage_len) (i32.const 131632) (i32.const 10))
          (then (call $emit_choose_story_ui) (return))
        )
        (if (call $streq (global.get $STAGE_BUF) (global.get $stage_len) (i32.const 131644) (i32.const 10))
          (then (call $emit_select_class_ui) (return))
        )
        (call $emit_rpg_system_new)
        (return)
      )
    )

    ;; If already GAME_OVER (hp <= 0), keep GAME_OVER without advancing turns
    (if (i32.le_s (global.get $hp) (i32.const 0))
      (then
        (call $memcpy (global.get $PHASE_BUF) (i32.const 131756) (i32.const 9)) ;; GAME_OVER
        (global.set $phase_len (i32.const 9))
        (call $emit_rpg_state (i32.const 0) (i32.const 0))
        (return)
      )
    )

    (local.set $was_combat
      (i32.or
        (call $streq (global.get $PHASE_BUF) (global.get $phase_len) (i32.const 131700) (i32.const 13)) ;; COMBAT_AMBUSH
        (call $streq (global.get $PHASE_BUF) (global.get $phase_len) (i32.const 131715) (i32.const 12)) ;; COMBAT_ROUND
      )
    )

    (global.set $turn (i32.add (global.get $turn) (i32.const 1)))

    ;; Update tension clamped 0..100
    (global.set $tension (i32.add (global.get $tension) (global.get $in_tdelta)))
    (if (global.get $in_rest) (then (global.set $tension (i32.sub (global.get $tension) (i32.const 20)))))
    (if (i32.lt_s (global.get $tension) (i32.const 0)) (then (global.set $tension (i32.const 0))))
    (if (i32.gt_s (global.get $tension) (i32.const 100)) (then (global.set $tension (i32.const 100))))

    ;; Deterministic d20 roll
    (local.set $roll (i32.const 0))
    (local.set $roll_ok (i32.const 0))
    (if (i32.or (global.get $in_roll) (local.get $was_combat))
      (then
        (local.set $seed
          (i32.add
            (i32.mul (global.get $turn) (i32.const 1103515245))
            (i32.add (i32.mul (global.get $tension) (i32.const 12345)) (global.get $int_len))
          )
        )
        (local.set $roll (i32.add (i32.rem_u (i32.shr_u (local.get $seed) (i32.const 16)) (i32.const 20)) (i32.const 1)))
        (if (i32.ge_s (i32.add (local.get $roll) (i32.const 2)) (global.get $in_dc))
          (then (local.set $roll_ok (i32.const 1)))
          (else
            (if (local.get $was_combat)
              (then
                (global.set $hp (i32.sub (global.get $hp) (i32.const 12)))
                (if (i32.lt_s (global.get $hp) (i32.const 0)) (then (global.set $hp (i32.const 0))))
              )
            )
          )
        )
      )
    )

    ;; D&D Pacing State Machine
    (if (i32.le_s (global.get $hp) (i32.const 0))
      (then
        (call $memcpy (global.get $PHASE_BUF) (i32.const 131756) (i32.const 9)) ;; GAME_OVER
        (global.set $phase_len (i32.const 9))
      )
      (else
        (if (global.get $in_rest)
          (then
            (global.set $hp (i32.add (global.get $hp) (i32.const 25)))
            (if (i32.gt_s (global.get $hp) (global.get $max_hp)) (then (global.set $hp (global.get $max_hp))))
            (call $memcpy (global.get $PHASE_BUF) (i32.const 131745) (i32.const 9)) ;; CAMP_REST
            (global.set $phase_len (i32.const 9))
          )
          (else
            (if (call $streq (global.get $OUTCOME_BUF) (global.get $outc_len) (i32.const 131612) (i32.const 7)) ;; victory
              (then
                (call $memcpy (global.get $PHASE_BUF) (i32.const 131729) (i32.const 14)) ;; COMBAT_VICTORY
                (global.set $phase_len (i32.const 14))
                (global.set $tension (i32.sub (global.get $tension) (i32.const 35)))
                (if (i32.lt_s (global.get $tension) (i32.const 0)) (then (global.set $tension (i32.const 0))))
              )
              (else
                (if (local.get $was_combat)
                  (then
                    (call $memcpy (global.get $PHASE_BUF) (i32.const 131715) (i32.const 12)) ;; COMBAT_ROUND
                    (global.set $phase_len (i32.const 12))
                  )
                  (else
                    (if (i32.ge_s (global.get $tension) (i32.const 75))
                      (then
                        (call $memcpy (global.get $PHASE_BUF) (i32.const 131700) (i32.const 13)) ;; COMBAT_AMBUSH
                        (global.set $phase_len (i32.const 13))
                      )
                      (else
                        (if (global.get $in_roll)
                          (then
                            (call $memcpy (global.get $PHASE_BUF) (i32.const 131687) (i32.const 11)) ;; SKILL_CHECK
                            (global.set $phase_len (i32.const 11))
                          )
                          (else
                            (call $memcpy (global.get $PHASE_BUF) (i32.const 131674) (i32.const 11)) ;; EXPLORATION
                            (global.set $phase_len (i32.const 11))
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

    ;; Append summary_note if provided
    (if (i32.gt_u (global.get $note_len) (i32.const 0))
      (then (call $append_summary (global.get $NOTE) (global.get $note_len)))
    )

    (call $save_slot (global.get $active_slot))
    (call $emit_rpg_state (local.get $roll) (local.get $roll_ok))
  )

  ;; ============================================================================
  ;; ENTRYPOINT
  ;; ============================================================================
  (func (export "rpg_entry") (param $in_ptr i32) (param $len i32) (result i32)
    (local $target_slot i32)
    (call $parse_input (local.get $in_ptr) (local.get $len))
    (call $load_active_slot)
    (call $load_slot (global.get $active_slot))

    ;; 1. help
    (if (call $streq (global.get $ACT_BUF) (global.get $act_len) (i32.const 131572) (i32.const 4))
      (then (call $emit_help) (return (i32.sub (global.get $out_pos) (global.get $OUT_BASE))))
    )
    ;; 2. games
    (if (call $streq (global.get $ACT_BUF) (global.get $act_len) (i32.const 131532) (i32.const 5))
      (then (call $emit_games_ui) (return (i32.sub (global.get $out_pos) (global.get $OUT_BASE))))
    )
    ;; 3. switch
    (if (call $streq (global.get $ACT_BUF) (global.get $act_len) (i32.const 131540) (i32.const 6))
      (then
        (local.set $target_slot (call $parse_int (global.get $QRY_BUF) (global.get $qry_len)))
        (if (i32.or (i32.lt_s (local.get $target_slot) (i32.const 1)) (i32.gt_s (local.get $target_slot) (i32.const 3)))
          (then (local.set $target_slot (i32.const 1)))
        )
        (call $save_active_slot (local.get $target_slot))
        (call $load_slot (local.get $target_slot))
        (call $emit_switch_ui)
        (return (i32.sub (global.get $out_pos) (global.get $OUT_BASE)))
      )
    )
    ;; 4. delete
    (if (call $streq (global.get $ACT_BUF) (global.get $act_len) (i32.const 131548) (i32.const 6))
      (then (call $emit_delete_confirm_ui) (return (i32.sub (global.get $out_pos) (global.get $OUT_BASE))))
    )
    ;; 5. confirm_delete
    (if (call $streq (global.get $ACT_BUF) (global.get $act_len) (i32.const 131556) (i32.const 14))
      (then
        (call $reset_slot_state)
        (call $save_slot (global.get $active_slot))
        (call $emit_deleted_ui)
        (return (i32.sub (global.get $out_pos) (global.get $OUT_BASE)))
      )
    )
    ;; 6. status
    (if (call $streq (global.get $ACT_BUF) (global.get $act_len) (i32.const 131524) (i32.const 6))
      (then
        (if (i32.eqz (call $streq (global.get $STAGE_BUF) (global.get $stage_len) (i32.const 131656) (i32.const 7)))
          (then (call $emit_games_ui))
          (else (call $emit_status_ui))
        )
        (return (i32.sub (global.get $out_pos) (global.get $OUT_BASE)))
      )
    )
    ;; 7. new
    (if (call $streq (global.get $ACT_BUF) (global.get $act_len) (i32.const 131488) (i32.const 3))
      (then (call $handle_new (local.get $in_ptr) (local.get $len)) (return (i32.sub (global.get $out_pos) (global.get $OUT_BASE))))
    )
    ;; 8. pick_story
    (if (call $streq (global.get $ACT_BUF) (global.get $act_len) (i32.const 131495) (i32.const 10))
      (then (call $handle_pick_story) (return (i32.sub (global.get $out_pos) (global.get $OUT_BASE))))
    )
    ;; 9. select_class
    (if (call $streq (global.get $ACT_BUF) (global.get $act_len) (i32.const 131508) (i32.const 12))
      (then (call $handle_select_class) (return (i32.sub (global.get $out_pos) (global.get $OUT_BASE))))
    )
    ;; 10. start
    (if (call $streq (global.get $ACT_BUF) (global.get $act_len) (i32.const 131480) (i32.const 5))
      (then
        (if (call $streq (global.get $STAGE_BUF) (global.get $stage_len) (i32.const 131632) (i32.const 10))
          (then (call $emit_choose_story_ui))
          (else
            (if (call $streq (global.get $STAGE_BUF) (global.get $stage_len) (i32.const 131644) (i32.const 10))
              (then (call $emit_select_class_ui))
              (else
                (if (call $streq (global.get $STAGE_BUF) (global.get $stage_len) (i32.const 131656) (i32.const 7))
                  (then (call $emit_rpg_state (i32.const 0) (i32.const 0)))
                  (else (call $emit_rpg_system_new))
                )
              )
            )
          )
        )
        (return (i32.sub (global.get $out_pos) (global.get $OUT_BASE)))
      )
    )
    ;; 11. default -> action
    (call $handle_action)
    (i32.sub (global.get $out_pos) (global.get $OUT_BASE))
  )
)
