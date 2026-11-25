import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDir = path.resolve(__dirname, '../plugins/official/habits');

fs.mkdirSync(pluginDir, { recursive: true });

function toWatData(str) {
  const buf = Buffer.from(str + '\0', 'utf8');
  let res = '';
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b >= 32 && b <= 126 && b !== 34 && b !== 92) {
      res += String.fromCharCode(b);
    } else {
      res += '\\' + b.toString(16).padStart(2, '0');
    }
  }
  return { escaped: res, byteLen: buf.length, strLen: buf.length - 1 };
}

let staticPtr = 200000;
const dataEntries = [];

function registerData(name, str) {
  const d = toWatData(str);
  const offset = staticPtr;
  staticPtr += d.byteLen + 4;
  staticPtr = (staticPtr + 3) & ~3;
  if (staticPtr >= 248000) {
    throw new Error(`Static data overflow past 248000 at ${name}: ${staticPtr}`);
  }
  dataEntries.push({ name, offset, strLen: d.strLen, escaped: d.escaped });
  return { offset, len: d.strLen };
}

const S = {};

// Storage JSON templates
S.st_get_habits = registerData('st_get_habits', '{"api":"storage","operation":"get","payload":{"key":"habits_v1"}}');
S.st_set_habits_p = registerData('st_set_habits_p', '{"api":"storage","operation":"set","payload":{"key":"habits_v1","value":"');
S.st_get_date = registerData('st_get_date', '{"api":"storage","operation":"get","payload":{"key":"last_date"}}');
S.st_set_date_p = registerData('st_set_date_p', '{"api":"storage","operation":"set","payload":{"key":"last_date","value":"');
S.st_set_end = registerData('st_set_end', '"}}');

// JSON input keys
S.k_op = registerData('k_op', 'operation');
S.k_action = registerData('k_action', 'action');
S.k_name = registerData('k_name', 'name');
S.k_habit = registerData('k_habit', 'habit');
S.k_title = registerData('k_title', 'title');
S.k_query = registerData('k_query', 'query');
S.k_text = registerData('k_text', 'text');
S.k_content = registerData('k_content', 'content');
S.k_id = registerData('k_id', 'id');
S.k_date = registerData('k_date', 'date');
S.k_value = registerData('k_value', 'value');
S.k_exists = registerData('k_exists', 'exists');
S.k_lang_eq = registerData('k_lang_eq', 'lang=');

// Action names
S.a_list = registerData('a_list', 'list');
S.a_today = registerData('a_today', 'today');
S.a_show = registerData('a_show', 'show');
S.a_add = registerData('a_add', 'add');
S.a_create = registerData('a_create', 'create');
S.a_new = registerData('a_new', 'new');
S.a_done = registerData('a_done', 'done');
S.a_check = registerData('a_check', 'check');
S.a_complete = registerData('a_complete', 'complete');
S.a_completed = registerData('a_completed', 'completed');
S.a_finish = registerData('a_finish', 'finish');
S.a_checkin = registerData('a_checkin', 'checkin');
S.a_check_in = registerData('a_check_in', 'check_in');
S.a_update = registerData('a_update', 'update');
S.a_log = registerData('a_log', 'log');
S.a_undo = registerData('a_undo', 'undo');
S.a_uncheck = registerData('a_uncheck', 'uncheck');
S.a_stats = registerData('a_stats', 'stats');
S.a_summary = registerData('a_summary', 'summary');
S.a_delete = registerData('a_delete', 'delete');
S.a_remove = registerData('a_remove', 'remove');
S.a_reset = registerData('a_reset', 'reset');
S.a_help = registerData('a_help', 'help');
S.k_extra = registerData('k_extra', 'extra');

// UI Card JSON fragments (all green monochrome-emerald theme)
S.ui_start = registerData('ui_start', '{"type":"ui","displayText":"');
S.ui_mid1 = registerData('ui_mid1', '","ui":{"title":"');
S.ui_sub = registerData('ui_sub', '","subtitle":"');
S.ui_badge = registerData('ui_badge', '","badge":"');
S.ui_bc_green = registerData('ui_bc_green', '","badgeColor":"green","icon":"check","hideText":true,"elements":[');
S.ui_bc_blue = registerData('ui_bc_blue', '","badgeColor":"green","icon":"check","hideText":true,"elements":[');
S.ui_bc_analytics = registerData('ui_bc_analytics', '","badgeColor":"green","icon":"analytics","hideText":true,"elements":[');
S.ui_bc_orange = registerData('ui_bc_orange', '","badgeColor":"orange","icon":"warning","hideText":true,"elements":[');
S.ui_bc_red = registerData('ui_bc_red', '","badgeColor":"red","icon":"error","hideText":true,"elements":[');
S.ui_end = registerData('ui_end', ']}}');

// UI Elements
S.el_prog_p1 = registerData('el_prog_p1', '{"type":"progress","value":');
S.el_prog_p2 = registerData('el_prog_p2', ',"label":"');
S.el_prog_green = registerData('el_prog_green', '","color":"green"}');
S.el_prog_blue = registerData('el_prog_blue', '","color":"green"}');
S.el_btn_row_start = registerData('el_btn_row_start', '{"type":"button_row","buttons":[');
S.el_btn_done_p1 = registerData('el_btn_done_p1', '{"label":"Done: ');
S.el_btn_done_p2 = registerData('el_btn_done_p2', '","action":"command","value":"/habits done ');
S.el_btn_done_p3 = registerData('el_btn_done_p3', '","style":"primary"}');
S.el_btn_row_end = registerData('el_btn_row_end', ']}');
S.el_list_start = registerData('el_list_start', '{"type":"list","items":[');
S.el_list_item1 = registerData('el_list_item1', '{"title":"#');
S.el_list_item2 = registerData('el_list_item2', '","subtitle":"');
S.el_list_item_end = registerData('el_list_item_end', '"}');
S.el_list_end = registerData('el_list_end', ']}');
S.el_kv_start = registerData('el_kv_start', '{"type":"key_value","items":[');
S.el_kv_item1 = registerData('el_kv_item1', '{"key":"');
S.el_kv_item2 = registerData('el_kv_item2', '","value":"');
S.el_kv_end = registerData('el_kv_end', ']}');
S.el_text_p1 = registerData('el_text_p1', '{"type":"text","content":"');
S.el_text_end = registerData('el_text_end', '"}');
S.el_btns_view_stats = registerData('el_btns_view_stats', '{"type":"button_row","buttons":[{"label":"View Habits","action":"command","value":"/habits","style":"primary"},{"label":"Stats","action":"command","value":"/habits stats","style":"secondary"}]}');
S.el_btns_stats_help = registerData('el_btns_stats_help', '{"type":"button_row","buttons":[{"label":"Stats","action":"command","value":"/habits stats","style":"primary"},{"label":"Help","action":"command","value":"/habits help","style":"secondary"}]}');
S.el_btns_view_help = registerData('el_btns_view_help', '{"type":"button_row","buttons":[{"label":"View Habits","action":"command","value":"/habits","style":"primary"},{"label":"Help","action":"command","value":"/habits help","style":"secondary"}]}');

// UI Copy Strings
S.t_dashboard = registerData('t_dashboard', 'Daily Habits');
S.t_empty_sub = registerData('t_empty_sub', 'Start building consistent daily routines');
S.t_empty_badge = registerData('t_empty_badge', 'EMPTY');
S.t_empty_body = registerData('t_empty_body', 'No habits tracked yet. Add your first habit with:\\n/habits add Drink 2L of water\\n/habits add Read 20 minutes');
S.t_all_done = registerData('t_all_done', 'ALL DONE');
S.t_today_prog = registerData('t_today_prog', "Today's Progress (");
S.t_done_tag = registerData('t_done_tag', '[DONE] Streak: ');
S.t_todo_tag = registerData('t_todo_tag', '[TODO] Streak: ');
S.t_best_tag = registerData('t_best_tag', 'd | Best: ');
S.t_total_tag = registerData('t_total_tag', 'd | Total: ');
S.t_today_sfx = registerData('t_today_sfx', ' TODAY');

S.t_added_title = registerData('t_added_title', 'Habit Added');
S.t_added_sub = registerData('t_added_sub', 'Ready to track daily streaks');
S.t_added_badge = registerData('t_added_badge', 'ADDED');
S.t_dup_title = registerData('t_dup_title', 'Habit Already Exists');
S.t_dup_badge = registerData('t_dup_badge', 'DUPLICATE');
S.t_dup_body = registerData('t_dup_body', 'A habit with that name is already in your list. Mark it done with /habits done <name>.');
S.t_full_title = registerData('t_full_title', 'Habit Limit Reached');
S.t_full_badge = registerData('t_full_badge', 'LIMIT');
S.t_full_body = registerData('t_full_body', 'You can track up to 30 active habits. Remove an unused habit first with /habits delete <name>.');

S.t_done_title = registerData('t_done_title', 'Habit Completed');
S.t_done_sub = registerData('t_done_sub', 'Great consistency! Streak updated.');
S.t_done_badge = registerData('t_done_badge', 'CHECKED IN');
S.t_already_title = registerData('t_already_title', 'Already Completed Today');
S.t_already_sub = registerData('t_already_sub', 'You already checked in for this habit today');
S.t_already_badge = registerData('t_already_badge', 'DONE TODAY');

S.t_undo_title = registerData('t_undo_title', 'Check-in Undone');
S.t_undo_sub = registerData('t_undo_sub', 'Habit reverted to pending for today');
S.t_undo_badge = registerData('t_undo_badge', 'UNDONE');
S.t_undo_none = registerData('t_undo_none', 'This habit has not been completed today.');

S.t_del_title = registerData('t_del_title', 'Habit Removed');
S.t_del_sub = registerData('t_del_sub', 'Deleted from your local habit tracker');
S.t_del_badge = registerData('t_del_badge', 'REMOVED');

S.t_reset_title = registerData('t_reset_title', 'Habits Cleared');
S.t_reset_sub = registerData('t_reset_sub', 'All local habit data has been reset');
S.t_reset_badge = registerData('t_reset_badge', 'RESET');
S.t_reset_body = registerData('t_reset_body', 'All habits and streak records were cleared from this device.');

S.t_stats_title = registerData('t_stats_title', 'Habit Statistics');
S.t_stats_sub = registerData('t_stats_sub', 'Local streak and completion overview');
S.t_stats_badge = registerData('t_stats_badge', 'STATS');

S.t_nf_title = registerData('t_nf_title', 'Habit Not Found');
S.t_nf_sub = registerData('t_nf_sub', 'Could not match that habit name or number');
S.t_nf_badge = registerData('t_nf_badge', 'NOT FOUND');
S.t_nf_body = registerData('t_nf_body', 'Use /habits to see your numbered list, then run /habits done <name or #>.');

S.t_need_name = registerData('t_need_name', 'Habit Name Required');
S.t_need_name_sub = registerData('t_need_name_sub', 'Specify which habit to add or update');
S.t_need_name_body = registerData('t_need_name_body', 'Example: /habits add Drink 2L of water');

S.t_help_title = registerData('t_help_title', 'Habit Tracker Guide');
S.t_help_sub = registerData('t_help_sub', '100% local daily habits & streak tracker');
S.t_help_badge = registerData('t_help_badge', 'GUIDE');
S.t_help_body = registerData('t_help_body', "Commands & natural language:\\n- /habits — View today's progress & streaks\\n- /habits add <name> — Add a new daily habit\\n- /habits done <name or #> — Mark habit done today\\n- /habits undo <name or #> — Undo today's check-in\\n- /habits stats — View overall streak statistics\\n- /habits delete <name or #> — Remove a habit\\n- /habits reset — Clear all habits");

S.kv_habit = registerData('kv_habit', 'Habit');
S.kv_status = registerData('kv_status', 'Status');
S.kv_status_ready = registerData('kv_status_ready', 'Pending today');
S.kv_streak = registerData('kv_streak', 'Current Streak');
S.kv_best = registerData('kv_best', 'Best Streak');
S.kv_total = registerData('kv_total', 'Total Check-ins');
S.kv_total_habits = registerData('kv_total_habits', 'Active Habits');
S.kv_done_today = registerData('kv_done_today', 'Completed Today');
S.kv_best_active = registerData('kv_best_active', 'Top Active Streak');
S.kv_best_all = registerData('kv_best_all', 'All-Time Best Streak');
S.kv_lifetime = registerData('kv_lifetime', 'Lifetime Check-ins');
S.s_days = registerData('s_days', ' days');
S.s_day = registerData('s_day', ' day');
S.s_date_label = registerData('s_date_label', 'Date: ');
S.s_local_sub = registerData('s_local_sub', 'Private on-device streak tracker');

const dataBlock = dataEntries
  .map((e) => `  (data (i32.const ${e.offset}) "${e.escaped}") ;; ${e.name} (${e.strLen})`)
  .join('\n');

const wat = `;; Chattree Official Habit Tracker Plugin v1.0.0
;; 100% local storage.private + declarative ui.components (zero API keys, zero async hops)
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; 16 pages = 1 MB linear memory
  (memory (export "memory") 16)

  (global $habit_count  (mut i32) (i32.const 0))
  (global $act_len      (mut i32) (i32.const 0))
  (global $name_len     (mut i32) (i32.const 0))
  (global $date_len     (mut i32) (i32.const 0))
  (global $today_days   (mut i32) (i32.const 0))
  (global $out_ptr      (mut i32) (i32.const 65536))

  ;; ── Static Data Segments (200000+) ───────────────────────────────────
${dataBlock}

  ;; ── Low-Level Memory & String Utilities ──────────────────────────────

  (func $zlen (param $ptr i32) (result i32)
    (local $i i32)
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.ne (i32.load8_u (i32.add (local.get $ptr) (local.get $i))) (i32.const 0))
        (then
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (local.get $i)
  )

  (func $is_ws (param $ch i32) (result i32)
    (i32.or
      (i32.or (i32.eq (local.get $ch) (i32.const 32)) (i32.eq (local.get $ch) (i32.const 9)))
      (i32.or (i32.eq (local.get $ch) (i32.const 10)) (i32.eq (local.get $ch) (i32.const 13)))
    )
  )

  (func $copy_mem (param $src i32) (param $dst i32) (param $len i32) (result i32)
    (if (i32.gt_s (local.get $len) (i32.const 0))
      (then
        (memory.copy (local.get $dst) (local.get $src) (local.get $len))
        (return (i32.add (local.get $dst) (local.get $len)))
      )
    )
    (local.get $dst)
  )

  (func $copy_zstr (param $src i32) (param $dst i32) (result i32)
    (call $copy_mem (local.get $src) (local.get $dst) (call $zlen (local.get $src)))
  )

  (func $to_lower (param $src i32) (param $dst i32) (param $len i32)
    (local $i i32) (local $ch i32)
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 65)) (i32.le_u (local.get $ch) (i32.const 90)))
            (then (local.set $ch (i32.add (local.get $ch) (i32.const 32))))
          )
          (i32.store8 (i32.add (local.get $dst) (local.get $i)) (local.get $ch))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
  )

  (func $str_eq_z (param $a i32) (param $a_len i32) (param $b_z i32) (result i32)
    (local $b_len i32) (local $i i32)
    (local.set $b_len (call $zlen (local.get $b_z)))
    (if (i32.ne (local.get $a_len) (local.get $b_len)) (then (return (i32.const 0))))
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.lt_u (local.get $i) (local.get $a_len))
        (then
          (if (i32.ne (i32.load8_u (i32.add (local.get $a) (local.get $i))) (i32.load8_u (i32.add (local.get $b_z) (local.get $i))))
            (then (return (i32.const 0)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (i32.const 1)
  )

  (func $mem_eq (param $a i32) (param $a_len i32) (param $b i32) (param $b_len i32) (result i32)
    (local $i i32)
    (if (i32.ne (local.get $a_len) (local.get $b_len)) (then (return (i32.const 0))))
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.lt_u (local.get $i) (local.get $a_len))
        (then
          (if (i32.ne (i32.load8_u (i32.add (local.get $a) (local.get $i))) (i32.load8_u (i32.add (local.get $b) (local.get $i))))
            (then (return (i32.const 0)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (i32.const 1)
  )

  (func $starts_with_z (param $buf i32) (param $len i32) (param $pz i32) (result i32)
    (local $plen i32) (local $i i32)
    (local.set $plen (call $zlen (local.get $pz)))
    (if (i32.lt_u (local.get $len) (local.get $plen)) (then (return (i32.const 0))))
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.lt_u (local.get $i) (local.get $plen))
        (then
          (if (i32.ne (i32.load8_u (i32.add (local.get $buf) (local.get $i))) (i32.load8_u (i32.add (local.get $pz) (local.get $i))))
            (then (return (i32.const 0)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (i32.const 1)
  )

  (func $match_cmd (param $buf i32) (param $len i32) (param $kw i32) (result i32)
    (local $klen i32)
    (if (i32.eqz (call $starts_with_z (local.get $buf) (local.get $len) (local.get $kw))) (then (return (i32.const 0))))
    (local.set $klen (call $zlen (local.get $kw)))
    (if (i32.eq (local.get $len) (local.get $klen)) (then (return (i32.const 1))))
    (call $is_ws (i32.load8_u (i32.add (local.get $buf) (local.get $klen))))
  )

  (func $find_sub (param $hay i32) (param $hlen i32) (param $ned i32) (param $nlen i32) (result i32)
    (local $i i32) (local $j i32) (local $m i32)
    (if (i32.or (i32.le_s (local.get $nlen) (i32.const 0)) (i32.lt_s (local.get $hlen) (local.get $nlen)))
      (then (return (i32.const -1)))
    )
    (local.set $i (i32.const 0))
    (loop $out
      (if (i32.gt_u (i32.add (local.get $i) (local.get $nlen)) (local.get $hlen))
        (then (return (i32.const -1)))
      )
      (local.set $j (i32.const 0))
      (local.set $m (i32.const 1))
      (loop $in
        (if (i32.lt_u (local.get $j) (local.get $nlen))
          (then
            (if (i32.ne (i32.load8_u (i32.add (local.get $hay) (i32.add (local.get $i) (local.get $j))))
                        (i32.load8_u (i32.add (local.get $ned) (local.get $j))))
              (then (local.set $m (i32.const 0)))
              (else
                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                (br $in)
              )
            )
          )
        )
      )
      (if (local.get $m) (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $out)
    )
    (i32.const -1)
  )

  ;; Output buffer writers
  (func $emit_reset
    (global.set $out_ptr (i32.const 65536))
  )

  (func $emit_byte (param $b i32)
    (i32.store8 (global.get $out_ptr) (local.get $b))
    (global.set $out_ptr (i32.add (global.get $out_ptr) (i32.const 1)))
  )

  (func $emit_zstr (param $z i32)
    (global.set $out_ptr (call $copy_zstr (local.get $z) (global.get $out_ptr)))
  )

  (func $emit_mem (param $ptr i32) (param $len i32)
    (global.set $out_ptr (call $copy_mem (local.get $ptr) (global.get $out_ptr) (local.get $len)))
  )

  (func $emit_json_esc (param $ptr i32) (param $len i32)
    (local $i i32) (local $ch i32)
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 34)) (i32.eq (local.get $ch) (i32.const 92)))
            (then
              (call $emit_byte (i32.const 92))
              (call $emit_byte (local.get $ch))
            )
            (else
              (if (i32.eq (local.get $ch) (i32.const 10))
                (then
                  (call $emit_byte (i32.const 92))
                  (call $emit_byte (i32.const 110))
                )
                (else
                  (if (i32.ge_u (local.get $ch) (i32.const 32))
                    (then (call $emit_byte (local.get $ch)))
                  )
                )
              )
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
  )

  (func $emit_uint (param $n i32)
    (local $len i32) (local $i i32) (local $v i32)
    (if (i32.le_s (local.get $n) (i32.const 0))
      (then
        (call $emit_byte (i32.const 48))
        (return)
      )
    )
    (local.set $v (local.get $n))
    (local.set $len (i32.const 0))
    (loop $rev
      (if (i32.gt_u (local.get $v) (i32.const 0))
        (then
          (i32.store8 (i32.add (i32.const 290800) (local.get $len)) (i32.add (i32.const 48) (i32.rem_u (local.get $v) (i32.const 10))))
          (local.set $v (i32.div_u (local.get $v) (i32.const 10)))
          (local.set $len (i32.add (local.get $len) (i32.const 1)))
          (br $rev)
        )
      )
    )
    (local.set $i (local.get $len))
    (loop $wr
      (if (i32.gt_u (local.get $i) (i32.const 0))
        (then
          (local.set $i (i32.sub (local.get $i) (i32.const 1)))
          (call $emit_byte (i32.load8_u (i32.add (i32.const 290800) (local.get $i))))
          (br $wr)
        )
      )
    )
  )

  ;; Emit ratio done/total as 0.00..1.00 JSON number
  (func $emit_progress_val (param $done i32) (param $total i32)
    (local $pct i32)
    (if (i32.le_s (local.get $total) (i32.const 0))
      (then
        (call $emit_byte (i32.const 48))
        (call $emit_byte (i32.const 46))
        (call $emit_byte (i32.const 48))
        (return)
      )
    )
    (if (i32.ge_s (local.get $done) (local.get $total))
      (then
        (call $emit_byte (i32.const 49))
        (call $emit_byte (i32.const 46))
        (call $emit_byte (i32.const 48))
        (return)
      )
    )
    (local.set $pct (i32.div_u (i32.mul (local.get $done) (i32.const 100)) (local.get $total)))
    (call $emit_byte (i32.const 48))
    (call $emit_byte (i32.const 46))
    (call $emit_byte (i32.add (i32.const 48) (i32.div_u (local.get $pct) (i32.const 10))))
    (call $emit_byte (i32.add (i32.const 48) (i32.rem_u (local.get $pct) (i32.const 10))))
  )

  (func $emit_days_label (param $n i32)
    (call $emit_uint (local.get $n))
    (if (i32.eq (local.get $n) (i32.const 1))
      (then (call $emit_zstr (i32.const ${S.s_day.offset})))
      (else (call $emit_zstr (i32.const ${S.s_days.offset})))
    )
  )

  (func $emit_len (result i32)
    (i32.sub (global.get $out_ptr) (i32.const 65536))
  )

  ;; Parse unsigned integer from $ptr[0..$len], returns -1 if empty or non-digit
  (func $parse_uint (param $ptr i32) (param $len i32) (result i32)
    (local $i i32) (local $ch i32) (local $val i32)
    (if (i32.le_s (local.get $len) (i32.const 0)) (then (return (i32.const -1))))
    (local.set $val (i32.const 0))
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))
          (if (i32.or (i32.lt_u (local.get $ch) (i32.const 48)) (i32.gt_u (local.get $ch) (i32.const 57)))
            (then (return (i32.const -1)))
          )
          (local.set $val (i32.add (i32.mul (local.get $val) (i32.const 10)) (i32.sub (local.get $ch) (i32.const 48))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (local.get $val)
  )

  ;; Parse YYYY-MM-DD (10 bytes) into monotonic civil day number (0 if invalid)
  (func $date_to_days (param $ptr i32) (param $len i32) (result i32)
    (local $y i32) (local $m i32) (local $d i32) (local $era i32) (local $yoe i32) (local $doy i32) (local $doe i32)
    (if (i32.lt_s (local.get $len) (i32.const 10)) (then (return (i32.const 0))))
    (if (i32.or (i32.ne (i32.load8_u (i32.add (local.get $ptr) (i32.const 4))) (i32.const 45))
                (i32.ne (i32.load8_u (i32.add (local.get $ptr) (i32.const 7))) (i32.const 45)))
      (then (return (i32.const 0)))
    )
    (local.set $y (call $parse_uint (local.get $ptr) (i32.const 4)))
    (local.set $m (call $parse_uint (i32.add (local.get $ptr) (i32.const 5)) (i32.const 2)))
    (local.set $d (call $parse_uint (i32.add (local.get $ptr) (i32.const 8)) (i32.const 2)))
    (if (i32.or (i32.lt_s (local.get $y) (i32.const 2000))
                (i32.or (i32.lt_s (local.get $m) (i32.const 1))
                        (i32.or (i32.gt_s (local.get $m) (i32.const 12))
                                (i32.or (i32.lt_s (local.get $d) (i32.const 1)) (i32.gt_s (local.get $d) (i32.const 31))))))
      (then (return (i32.const 0)))
    )
    ;; Howard Hinnant days_from_civil
    (if (i32.le_s (local.get $m) (i32.const 2))
      (then (local.set $y (i32.sub (local.get $y) (i32.const 1))))
    )
    (local.set $era (i32.div_s (local.get $y) (i32.const 400)))
    (local.set $yoe (i32.sub (local.get $y) (i32.mul (local.get $era) (i32.const 400))))
    (local.set $doy (i32.sub
      (i32.add
        (i32.div_s (i32.add (i32.mul (i32.const 153) (if (result i32) (i32.gt_s (local.get $m) (i32.const 2)) (then (i32.sub (local.get $m) (i32.const 3))) (else (i32.add (local.get $m) (i32.const 9))))) (i32.const 2)) (i32.const 5))
        (local.get $d))
      (i32.const 1)))
    (local.set $doe (i32.add
      (i32.sub
        (i32.add (i32.mul (local.get $yoe) (i32.const 365)) (i32.div_s (local.get $yoe) (i32.const 4)))
        (i32.div_s (local.get $yoe) (i32.const 100)))
      (local.get $doy)))
    (i32.add (i32.mul (local.get $era) (i32.const 146097)) (local.get $doe))
  )

  ;; Whitespace-tolerant JSON string extractor with escape decoding (returns len or -1)
  (func $extract_json_str (param $json i32) (param $jlen i32) (param $key_z i32) (param $dst i32) (param $max_out i32) (result i32)
    (local $klen i32) (local $i i32) (local $j i32) (local $match i32) (local $pos i32)
    (local $out i32) (local $ch i32) (local $esc i32)
    (local.set $klen (call $zlen (local.get $key_z)))
    (local.set $i (i32.const 0))
    (block $found
      (loop $scan
        (if (i32.gt_u (i32.add (local.get $i) (i32.add (local.get $klen) (i32.const 3))) (local.get $jlen))
          (then (return (i32.const -1)))
        )
        (if (i32.and
              (i32.eq (i32.load8_u (i32.add (local.get $json) (local.get $i))) (i32.const 34))
              (i32.eq (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $i) (i32.add (local.get $klen) (i32.const 1))))) (i32.const 34)))
          (then
            (local.set $j (i32.const 0))
            (local.set $match (i32.const 1))
            (loop $cmp
              (if (i32.lt_u (local.get $j) (local.get $klen))
                (then
                  (if (i32.ne (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $i) (i32.add (local.get $j) (i32.const 1)))))
                              (i32.load8_u (i32.add (local.get $key_z) (local.get $j))))
                    (then (local.set $match (i32.const 0)))
                    (else (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $cmp))
                  )
                )
              )
            )
            (if (local.get $match)
              (then
                (local.set $pos (i32.add (local.get $i) (i32.add (local.get $klen) (i32.const 2))))
                (loop $w1
                  (if (i32.and (i32.lt_u (local.get $pos) (local.get $jlen))
                               (call $is_ws (i32.load8_u (i32.add (local.get $json) (local.get $pos)))))
                    (then (local.set $pos (i32.add (local.get $pos) (i32.const 1))) (br $w1))
                  )
                )
                (if (i32.and (i32.lt_u (local.get $pos) (local.get $jlen))
                             (i32.eq (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 58)))
                  (then
                    (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
                    (loop $w2
                      (if (i32.and (i32.lt_u (local.get $pos) (local.get $jlen))
                                   (call $is_ws (i32.load8_u (i32.add (local.get $json) (local.get $pos)))))
                        (then (local.set $pos (i32.add (local.get $pos) (i32.const 1))) (br $w2))
                      )
                    )
                    (if (i32.and (i32.lt_u (local.get $pos) (local.get $jlen))
                                 (i32.eq (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 34)))
                      (then
                        (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
                        (br $found)
                      )
                    )
                  )
                )
              )
            )
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan)
      )
    )
    (local.set $out (local.get $dst))
    (loop $read
      (if (i32.and (i32.lt_u (local.get $pos) (local.get $jlen))
                   (i32.lt_u (i32.sub (local.get $out) (local.get $dst)) (local.get $max_out)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
          (if (i32.eq (local.get $ch) (i32.const 34))
            (then (return (i32.sub (local.get $out) (local.get $dst))))
          )
          (if (i32.eq (local.get $ch) (i32.const 92))
            (then
              (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
              (if (i32.ge_u (local.get $pos) (local.get $jlen))
                (then (return (i32.sub (local.get $out) (local.get $dst))))
              )
              (local.set $esc (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
              (if (i32.eq (local.get $esc) (i32.const 110))
                (then (i32.store8 (local.get $out) (i32.const 10)))
                (else (i32.store8 (local.get $out) (local.get $esc)))
              )
              (local.set $out (i32.add (local.get $out) (i32.const 1)))
              (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
              (br $read)
            )
          )
          (i32.store8 (local.get $out) (local.get $ch))
          (local.set $out (i32.add (local.get $out) (i32.const 1)))
          (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
          (br $read)
        )
      )
    )
    (i32.sub (local.get $out) (local.get $dst))
  )

  ;; Strip trailing lang=<code> (or bare lang=<code>) from trimmed plain text
  (func $strip_lang (param $ptr i32) (param $len i32) (result i32)
    (local $i i32) (local $ts i32) (local $tl i32) (local $nl i32)
    (if (i32.le_s (local.get $len) (i32.const 0)) (then (return (i32.const 0))))
    (if (call $starts_with_z (local.get $ptr) (local.get $len) (i32.const ${S.k_lang_eq.offset}))
      (then
        (local.set $i (i32.const 0))
        (loop $b
          (if (i32.lt_u (local.get $i) (local.get $len))
            (then
              (if (call $is_ws (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))
                (then (return (local.get $len)))
              )
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $b)
            )
          )
        )
        (return (i32.const 0))
      )
    )
    (local.set $i (local.get $len))
    (loop $fs
      (if (i32.gt_u (local.get $i) (i32.const 0))
        (then
          (local.set $i (i32.sub (local.get $i) (i32.const 1)))
          (if (i32.eqz (call $is_ws (i32.load8_u (i32.add (local.get $ptr) (local.get $i)))))
            (then (br $fs))
          )
        )
      )
    )
    (if (call $is_ws (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))
      (then
        (local.set $ts (i32.add (local.get $ptr) (i32.add (local.get $i) (i32.const 1))))
        (local.set $tl (i32.sub (local.get $len) (i32.add (local.get $i) (i32.const 1))))
        (if (call $starts_with_z (local.get $ts) (local.get $tl) (i32.const ${S.k_lang_eq.offset}))
          (then
            (local.set $nl (local.get $i))
            (loop $rt
              (if (i32.and (i32.gt_u (local.get $nl) (i32.const 0))
                           (call $is_ws (i32.load8_u (i32.add (local.get $ptr) (i32.sub (local.get $nl) (i32.const 1))))))
                (then (local.set $nl (i32.sub (local.get $nl) (i32.const 1))) (br $rt))
              )
            )
            (return (local.get $nl))
          )
        )
      )
    )
    (local.get $len)
  )

  ;; ── Habit Table Storage (250000 + idx * 256) ─────────────────────────

  (func $slot_ptr (param $idx i32) (result i32)
    (i32.add (i32.const 250000) (i32.mul (local.get $idx) (i32.const 256)))
  )

  ;; Helper: copy one pipe-delimited field into $dst (up to $max), returns next offset after '|' or line_end
  (func $read_field (param $buf i32) (param $pos i32) (param $end i32) (param $dst i32) (param $max i32) (param $len_out_ptr i32) (result i32)
    (local $i i32) (local $out i32) (local $ch i32)
    (local.set $i (local.get $pos))
    (local.set $out (i32.const 0))
    (block $done
      (loop $l
        (if (i32.ge_u (local.get $i) (local.get $end)) (then (br $done)))
        (local.set $ch (i32.load8_u (i32.add (local.get $buf) (local.get $i))))
        (if (i32.eq (local.get $ch) (i32.const 124)) ;; '|'
          (then
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $done)
          )
        )
        (if (i32.lt_u (local.get $out) (local.get $max))
          (then
            (i32.store8 (i32.add (local.get $dst) (local.get $out)) (local.get $ch))
            (local.set $out (i32.add (local.get $out) (i32.const 1)))
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $l)
      )
    )
    (i32.store (local.get $len_out_ptr) (local.get $out))
    (local.get $i)
  )

  ;; Load habits_v1 from storage.private into slot table
  (func $load_habits
    (local $rc i32) (local $raw_len i32) (local $pos i32) (local $le i32) (local $sp i32)
    (local $fpos i32) (local $flen i32) (local $v i32)
    (global.set $habit_count (i32.const 0))
    (local.set $rc (call $host_call (i32.const ${S.st_get_habits.offset}) (i32.const ${S.st_get_habits.len}) (i32.const 350000) (i32.const 40000)))
    (if (i32.le_s (local.get $rc) (i32.const 0)) (then (return)))
    (local.set $raw_len (call $extract_json_str (i32.const 350000) (local.get $rc) (i32.const ${S.k_value.offset}) (i32.const 400000) (i32.const 38000)))
    (if (i32.le_s (local.get $raw_len) (i32.const 0)) (then (return)))

    (local.set $pos (i32.const 0))
    (loop $lines
      (if (i32.and (i32.lt_u (local.get $pos) (local.get $raw_len)) (i32.lt_u (global.get $habit_count) (i32.const 30)))
        (then
          (local.set $le (local.get $pos))
          (loop $eol
            (if (i32.and (i32.lt_u (local.get $le) (local.get $raw_len))
                         (i32.ne (i32.load8_u (i32.add (i32.const 400000) (local.get $le))) (i32.const 10)))
              (then (local.set $le (i32.add (local.get $le) (i32.const 1))) (br $eol))
            )
          )
          (if (i32.gt_u (local.get $le) (local.get $pos))
            (then
              (local.set $sp (call $slot_ptr (global.get $habit_count)))
              ;; Field 0: name
              (local.set $fpos (call $read_field (i32.const 400000) (local.get $pos) (local.get $le) (local.get $sp) (i32.const 80) (i32.add (local.get $sp) (i32.const 96))))
              (if (i32.gt_s (i32.load (i32.add (local.get $sp) (i32.const 96))) (i32.const 0))
                (then
                  ;; Field 1: streak
                  (local.set $fpos (call $read_field (i32.const 400000) (local.get $fpos) (local.get $le) (i32.const 290800) (i32.const 16) (i32.const 290820)))
                  (local.set $v (call $parse_uint (i32.const 290800) (i32.load (i32.const 290820))))
                  (i32.store (i32.add (local.get $sp) (i32.const 100)) (if (result i32) (i32.gt_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 0))))
                  ;; Field 2: best
                  (local.set $fpos (call $read_field (i32.const 400000) (local.get $fpos) (local.get $le) (i32.const 290800) (i32.const 16) (i32.const 290820)))
                  (local.set $v (call $parse_uint (i32.const 290800) (i32.load (i32.const 290820))))
                  (i32.store (i32.add (local.get $sp) (i32.const 104)) (if (result i32) (i32.gt_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 0))))
                  ;; Field 3: total
                  (local.set $fpos (call $read_field (i32.const 400000) (local.get $fpos) (local.get $le) (i32.const 290800) (i32.const 16) (i32.const 290820)))
                  (local.set $v (call $parse_uint (i32.const 290800) (i32.load (i32.const 290820))))
                  (i32.store (i32.add (local.get $sp) (i32.const 108)) (if (result i32) (i32.gt_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 0))))
                  ;; Field 4: last_date
                  (local.set $fpos (call $read_field (i32.const 400000) (local.get $fpos) (local.get $le) (i32.add (local.get $sp) (i32.const 112)) (i32.const 12) (i32.add (local.get $sp) (i32.const 128))))
                  ;; Field 5: prev_date
                  (local.set $fpos (call $read_field (i32.const 400000) (local.get $fpos) (local.get $le) (i32.add (local.get $sp) (i32.const 132)) (i32.const 12) (i32.add (local.get $sp) (i32.const 148))))
                  (global.set $habit_count (i32.add (global.get $habit_count) (i32.const 1)))
                )
              )
            )
          )
          (local.set $pos (i32.add (local.get $le) (i32.const 1)))
          (br $lines)
        )
      )
    )
  )

  ;; Helper: write uint into arbitrary buffer $p, returns new $p
  (func $buf_uint (param $p i32) (param $n i32) (result i32)
    (local $len i32) (local $v i32) (local $i i32)
    (if (i32.le_s (local.get $n) (i32.const 0))
      (then
        (i32.store8 (local.get $p) (i32.const 48))
        (return (i32.add (local.get $p) (i32.const 1)))
      )
    )
    (local.set $v (local.get $n))
    (local.set $len (i32.const 0))
    (loop $rev
      (if (i32.gt_u (local.get $v) (i32.const 0))
        (then
          (i32.store8 (i32.add (i32.const 290800) (local.get $len)) (i32.add (i32.const 48) (i32.rem_u (local.get $v) (i32.const 10))))
          (local.set $v (i32.div_u (local.get $v) (i32.const 10)))
          (local.set $len (i32.add (local.get $len) (i32.const 1)))
          (br $rev)
        )
      )
    )
    (local.set $i (local.get $len))
    (loop $wr
      (if (i32.gt_u (local.get $i) (i32.const 0))
        (then
          (local.set $i (i32.sub (local.get $i) (i32.const 1)))
          (i32.store8 (local.get $p) (i32.load8_u (i32.add (i32.const 290800) (local.get $i))))
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (br $wr)
        )
      )
    )
    (local.get $p)
  )

  ;; Save slot table back to storage.private (key: habits_v1)
  (func $save_habits
    (local $p i32) (local $i i32) (local $sp i32) (local $req_len i32)
    (local.set $p (call $copy_zstr (i32.const ${S.st_set_habits_p.offset}) (i32.const 300000)))
    (local.set $i (i32.const 0))
    (loop $s
      (if (i32.lt_u (local.get $i) (global.get $habit_count))
        (then
          (local.set $sp (call $slot_ptr (local.get $i)))
          (local.set $p (call $copy_mem (local.get $sp) (local.get $p) (i32.load (i32.add (local.get $sp) (i32.const 96)))))
          (i32.store8 (local.get $p) (i32.const 124)) (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (local.set $p (call $buf_uint (local.get $p) (i32.load (i32.add (local.get $sp) (i32.const 100)))))
          (i32.store8 (local.get $p) (i32.const 124)) (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (local.set $p (call $buf_uint (local.get $p) (i32.load (i32.add (local.get $sp) (i32.const 104)))))
          (i32.store8 (local.get $p) (i32.const 124)) (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (local.set $p (call $buf_uint (local.get $p) (i32.load (i32.add (local.get $sp) (i32.const 108)))))
          (i32.store8 (local.get $p) (i32.const 124)) (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (local.set $p (call $copy_mem (i32.add (local.get $sp) (i32.const 112)) (local.get $p) (i32.load (i32.add (local.get $sp) (i32.const 128)))))
          (i32.store8 (local.get $p) (i32.const 124)) (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (local.set $p (call $copy_mem (i32.add (local.get $sp) (i32.const 132)) (local.get $p) (i32.load (i32.add (local.get $sp) (i32.const 148)))))
          ;; Escape newline as \\n inside JSON string
          (i32.store8 (local.get $p) (i32.const 92)) (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (i32.store8 (local.get $p) (i32.const 110)) (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $s)
        )
      )
    )
    (local.set $p (call $copy_zstr (i32.const ${S.st_set_end.offset}) (local.get $p)))
    (local.set $req_len (i32.sub (local.get $p) (i32.const 300000)))
    (drop (call $host_call (i32.const 300000) (local.get $req_len) (i32.const 350000) (i32.const 1024)))
  )

  ;; Load/save last_date in storage.private
  (func $sync_date
    (local $rc i32) (local $dlen i32) (local $p i32) (local $req_len i32)
    (if (i32.gt_s (global.get $today_days) (i32.const 0))
      (then
        ;; Persist fresh date from input
        (local.set $p (call $copy_zstr (i32.const ${S.st_set_date_p.offset}) (i32.const 300000)))
        (local.set $p (call $copy_mem (i32.const 290300) (local.get $p) (global.get $date_len)))
        (local.set $p (call $copy_zstr (i32.const ${S.st_set_end.offset}) (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 300000)))
        (drop (call $host_call (i32.const 300000) (local.get $req_len) (i32.const 350000) (i32.const 512)))
        (return)
      )
    )
    ;; Otherwise load last_date from storage
    (local.set $rc (call $host_call (i32.const ${S.st_get_date.offset}) (i32.const ${S.st_get_date.len}) (i32.const 350000) (i32.const 1024)))
    (if (i32.gt_s (local.get $rc) (i32.const 0))
      (then
        (local.set $dlen (call $extract_json_str (i32.const 350000) (local.get $rc) (i32.const ${S.k_value.offset}) (i32.const 290300) (i32.const 16)))
        (if (i32.ge_s (local.get $dlen) (i32.const 10))
          (then
            (global.set $date_len (i32.const 10))
            (global.set $today_days (call $date_to_days (i32.const 290300) (i32.const 10)))
          )
        )
      )
    )
  )

  ;; Sanitize habit name into 290100 (trim ws, remove |, ", \\, control chars; max 80 bytes)
  (func $sanitize_name (param $src i32) (param $len i32) (result i32)
    (local $s i32) (local $e i32) (local $out i32) (local $ch i32)
    (if (i32.le_s (local.get $len) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $s (local.get $src))
    (local.set $e (i32.add (local.get $src) (local.get $len)))
    (loop $lt
      (if (i32.and (i32.lt_u (local.get $s) (local.get $e)) (call $is_ws (i32.load8_u (local.get $s))))
        (then (local.set $s (i32.add (local.get $s) (i32.const 1))) (br $lt))
      )
    )
    (loop $rt
      (if (i32.and (i32.gt_u (local.get $e) (local.get $s)) (call $is_ws (i32.load8_u (i32.sub (local.get $e) (i32.const 1)))))
        (then (local.set $e (i32.sub (local.get $e) (i32.const 1))) (br $rt))
      )
    )
    (local.set $out (i32.const 0))
    (loop $cp
      (if (i32.and (i32.lt_u (local.get $s) (local.get $e)) (i32.lt_u (local.get $out) (i32.const 80)))
        (then
          (local.set $ch (i32.load8_u (local.get $s)))
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 32))
                       (i32.and (i32.ne (local.get $ch) (i32.const 124))
                                (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 92)))))
            (then
              (i32.store8 (i32.add (i32.const 290100) (local.get $out)) (local.get $ch))
              (local.set $out (i32.add (local.get $out) (i32.const 1)))
            )
          )
          (local.set $s (i32.add (local.get $s) (i32.const 1)))
          (br $cp)
        )
      )
    )
    (global.set $name_len (local.get $out))
    (local.get $out)
  )

  ;; Find habit index by 1-based number ("1" or "#1"), exact match, substring match, or word-overlap match (-1 if none)
  (func $find_habit (param $q_ptr i32) (param $q_len i32) (result i32)
    (local $num_ptr i32) (local $num_len i32) (local $num i32)
    (local $i i32) (local $sp i32) (local $nlen i32)
    (local $best_idx i32) (local $best_score i32) (local $score i32)
    (local $ws i32) (local $we i32) (local $wlen i32)
    (if (i32.le_s (local.get $q_len) (i32.const 0)) (then (return (i32.const -1))))

    ;; Check numeric index ("1" or "#1")
    (local.set $num_ptr (local.get $q_ptr))
    (local.set $num_len (local.get $q_len))
    (if (i32.eq (i32.load8_u (local.get $num_ptr)) (i32.const 35)) ;; '#'
      (then
        (local.set $num_ptr (i32.add (local.get $num_ptr) (i32.const 1)))
        (local.set $num_len (i32.sub (local.get $num_len) (i32.const 1)))
      )
    )
    (local.set $num (call $parse_uint (local.get $num_ptr) (local.get $num_len)))
    (if (i32.and (i32.ge_s (local.get $num) (i32.const 1)) (i32.le_s (local.get $num) (global.get $habit_count)))
      (then (return (i32.sub (local.get $num) (i32.const 1))))
    )

    ;; Lowercase query into 290400
    (call $to_lower (local.get $q_ptr) (i32.const 290400) (local.get $q_len))

    ;; Pass 1: exact case-insensitive match
    (local.set $i (i32.const 0))
    (loop $exact
      (if (i32.lt_u (local.get $i) (global.get $habit_count))
        (then
          (local.set $sp (call $slot_ptr (local.get $i)))
          (local.set $nlen (i32.load (i32.add (local.get $sp) (i32.const 96))))
          (call $to_lower (local.get $sp) (i32.const 290600) (local.get $nlen))
          (if (call $mem_eq (i32.const 290400) (local.get $q_len) (i32.const 290600) (local.get $nlen))
            (then (return (local.get $i)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $exact)
        )
      )
    )

    ;; Pass 2: substring match (habit contains query OR query contains habit)
    (local.set $i (i32.const 0))
    (loop $sub
      (if (i32.lt_u (local.get $i) (global.get $habit_count))
        (then
          (local.set $sp (call $slot_ptr (local.get $i)))
          (local.set $nlen (i32.load (i32.add (local.get $sp) (i32.const 96))))
          (call $to_lower (local.get $sp) (i32.const 290600) (local.get $nlen))
          (if (i32.or (i32.ge_s (call $find_sub (i32.const 290600) (local.get $nlen) (i32.const 290400) (local.get $q_len)) (i32.const 0))
                      (i32.ge_s (call $find_sub (i32.const 290400) (local.get $q_len) (i32.const 290600) (local.get $nlen)) (i32.const 0)))
            (then (return (local.get $i)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $sub)
        )
      )
    )

    ;; Pass 3: word-overlap fuzzy match (handles natural language like "leí 20 minutos" vs "Leer 20 minutos")
    (local.set $best_idx (i32.const -1))
    (local.set $best_score (i32.const 0))
    (local.set $i (i32.const 0))
    (loop $fuzzy
      (if (i32.lt_u (local.get $i) (global.get $habit_count))
        (then
          (local.set $sp (call $slot_ptr (local.get $i)))
          (local.set $nlen (i32.load (i32.add (local.get $sp) (i32.const 96))))
          (call $to_lower (local.get $sp) (i32.const 290600) (local.get $nlen))
          (local.set $score (i32.const 0))
          ;; Scan words in query (len >= 2) and check if present in habit name
          (local.set $ws (i32.const 0))
          (loop $qwords
            (if (i32.lt_u (local.get $ws) (local.get $q_len))
              (then
                (loop $skip_qws
                  (if (i32.and (i32.lt_u (local.get $ws) (local.get $q_len)) (call $is_ws (i32.load8_u (i32.add (i32.const 290400) (local.get $ws)))))
                    (then (local.set $ws (i32.add (local.get $ws) (i32.const 1))) (br $skip_qws))
                  )
                )
                (local.set $we (local.get $ws))
                (loop $scan_qw
                  (if (i32.and (i32.lt_u (local.get $we) (local.get $q_len)) (i32.eqz (call $is_ws (i32.load8_u (i32.add (i32.const 290400) (local.get $we))))))
                    (then (local.set $we (i32.add (local.get $we) (i32.const 1))) (br $scan_qw))
                  )
                )
                (local.set $wlen (i32.sub (local.get $we) (local.get $ws)))
                (if (i32.ge_u (local.get $wlen) (i32.const 3))
                  (then
                    (if (i32.ge_s (call $find_sub (i32.const 290600) (local.get $nlen) (i32.add (i32.const 290400) (local.get $ws)) (local.get $wlen)) (i32.const 0))
                      (then (local.set $score (i32.add (local.get $score) (local.get $wlen))))
                    )
                  )
                )
                (local.set $ws (local.get $we))
                (br $qwords)
              )
            )
          )
          (if (i32.gt_s (local.get $score) (local.get $best_score))
            (then
              (local.set $best_score (local.get $score))
              (local.set $best_idx (local.get $i))
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $fuzzy)
        )
      )
    )
    (local.get $best_idx)
  )

  ;; Check if habit at $idx is completed today
  (func $is_done_today (param $idx i32) (result i32)
    (local $sp i32) (local $ld_len i32)
    (local.set $sp (call $slot_ptr (local.get $idx)))
    (local.set $ld_len (i32.load (i32.add (local.get $sp) (i32.const 128))))
    (if (i32.or (i32.le_s (global.get $date_len) (i32.const 0)) (i32.le_s (local.get $ld_len) (i32.const 0)))
      (then (return (i32.const 0)))
    )
    (call $mem_eq (i32.add (local.get $sp) (i32.const 112)) (local.get $ld_len) (i32.const 290300) (global.get $date_len))
  )

  ;; Effective active streak for habit $idx
  (func $active_streak (param $idx i32) (result i32)
    (local $sp i32) (local $st i32) (local $ld_days i32) (local $diff i32)
    (local.set $sp (call $slot_ptr (local.get $idx)))
    (local.set $st (i32.load (i32.add (local.get $sp) (i32.const 100))))
    (if (i32.or (i32.le_s (local.get $st) (i32.const 0)) (i32.le_s (global.get $today_days) (i32.const 0)))
      (then (return (local.get $st)))
    )
    (local.set $ld_days (call $date_to_days (i32.add (local.get $sp) (i32.const 112)) (i32.load (i32.add (local.get $sp) (i32.const 128)))))
    (if (i32.le_s (local.get $ld_days) (i32.const 0)) (then (return (local.get $st))))
    (local.set $diff (i32.sub (global.get $today_days) (local.get $ld_days)))
    (if (i32.le_s (local.get $diff) (i32.const 1))
      (then (return (local.get $st)))
    )
    (i32.const 0)
  )

  ;; Count habits completed today
  (func $count_done_today (result i32)
    (local $i i32) (local $c i32)
    (local.set $i (i32.const 0))
    (local.set $c (i32.const 0))
    (loop $l
      (if (i32.lt_u (local.get $i) (global.get $habit_count))
        (then
          (if (call $is_done_today (local.get $i))
            (then (local.set $c (i32.add (local.get $c) (i32.const 1))))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (local.get $c)
  )

  ;; ── UI Card Renderers ────────────────────────────────────────────────

  (func $render_simple_card (param $title_z i32) (param $sub_z i32) (param $badge_z i32) (param $bc_z i32) (param $body_z i32) (param $btns_z i32) (result i32)
    (call $emit_reset)
    (call $emit_zstr (i32.const ${S.ui_start.offset}))
    (call $emit_zstr (local.get $title_z))
    (call $emit_zstr (i32.const ${S.ui_mid1.offset}))
    (call $emit_zstr (local.get $title_z))
    (call $emit_zstr (i32.const ${S.ui_sub.offset}))
    (call $emit_zstr (local.get $sub_z))
    (call $emit_zstr (i32.const ${S.ui_badge.offset}))
    (call $emit_zstr (local.get $badge_z))
    (call $emit_zstr (local.get $bc_z))
    (call $emit_zstr (i32.const ${S.el_text_p1.offset}))
    (call $emit_zstr (local.get $body_z))
    (call $emit_zstr (i32.const ${S.el_text_end.offset}))
    (call $emit_byte (i32.const 44))
    (call $emit_zstr (local.get $btns_z))
    (call $emit_zstr (i32.const ${S.ui_end.offset}))
    (call $emit_len)
  )

  (func $render_dashboard (result i32)
    (local $done i32) (local $tot i32) (local $i i32) (local $sp i32) (local $btn_cnt i32) (local $blen i32)
    (local.set $tot (global.get $habit_count))
    (if (i32.eqz (local.get $tot))
      (then
        (return (call $render_simple_card
          (i32.const ${S.t_dashboard.offset})
          (i32.const ${S.t_empty_sub.offset})
          (i32.const ${S.t_empty_badge.offset})
          (i32.const ${S.ui_bc_blue.offset})
          (i32.const ${S.t_empty_body.offset})
          (i32.const ${S.el_btns_view_help.offset})
        ))
      )
    )
    (local.set $done (call $count_done_today))
    (call $emit_reset)
    (call $emit_zstr (i32.const ${S.ui_start.offset}))
    (call $emit_zstr (i32.const ${S.t_dashboard.offset}))
    (call $emit_zstr (i32.const ${S.ui_mid1.offset}))
    (call $emit_zstr (i32.const ${S.t_dashboard.offset}))
    (call $emit_zstr (i32.const ${S.ui_sub.offset}))
    (if (i32.gt_s (global.get $date_len) (i32.const 0))
      (then
        (call $emit_zstr (i32.const ${S.s_date_label.offset}))
        (call $emit_mem (i32.const 290300) (global.get $date_len))
      )
      (else (call $emit_zstr (i32.const ${S.s_local_sub.offset})))
    )
    (call $emit_zstr (i32.const ${S.ui_badge.offset}))
    (if (i32.eq (local.get $done) (local.get $tot))
      (then
        (call $emit_zstr (i32.const ${S.t_all_done.offset}))
        (call $emit_zstr (i32.const ${S.ui_bc_green.offset}))
      )
      (else
        (call $emit_uint (local.get $done))
        (call $emit_byte (i32.const 47))
        (call $emit_uint (local.get $tot))
        (call $emit_zstr (i32.const ${S.t_today_sfx.offset}))
        (call $emit_zstr (i32.const ${S.ui_bc_blue.offset}))
      )
    )
    ;; Progress element
    (call $emit_zstr (i32.const ${S.el_prog_p1.offset}))
    (call $emit_progress_val (local.get $done) (local.get $tot))
    (call $emit_zstr (i32.const ${S.el_prog_p2.offset}))
    (call $emit_zstr (i32.const ${S.t_today_prog.offset}))
    (call $emit_uint (local.get $done))
    (call $emit_byte (i32.const 47))
    (call $emit_uint (local.get $tot))
    (call $emit_byte (i32.const 41))
    (if (i32.eq (local.get $done) (local.get $tot))
      (then (call $emit_zstr (i32.const ${S.el_prog_green.offset})))
      (else (call $emit_zstr (i32.const ${S.el_prog_blue.offset})))
    )
    ;; List element
    (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_list_start.offset}))
    (local.set $i (i32.const 0))
    (loop $hl
      (if (i32.lt_u (local.get $i) (local.get $tot))
        (then
          (if (i32.gt_u (local.get $i) (i32.const 0)) (then (call $emit_byte (i32.const 44))))
          (local.set $sp (call $slot_ptr (local.get $i)))
          (call $emit_zstr (i32.const ${S.el_list_item1.offset}))
          (call $emit_uint (i32.add (local.get $i) (i32.const 1)))
          (call $emit_byte (i32.const 32))
          (call $emit_json_esc (local.get $sp) (i32.load (i32.add (local.get $sp) (i32.const 96))))
          (call $emit_zstr (i32.const ${S.el_list_item2.offset}))
          (if (call $is_done_today (local.get $i))
            (then (call $emit_zstr (i32.const ${S.t_done_tag.offset})))
            (else (call $emit_zstr (i32.const ${S.t_todo_tag.offset})))
          )
          (call $emit_uint (call $active_streak (local.get $i)))
          (call $emit_zstr (i32.const ${S.t_best_tag.offset}))
          (call $emit_uint (i32.load (i32.add (local.get $sp) (i32.const 104))))
          (call $emit_zstr (i32.const ${S.t_total_tag.offset}))
          (call $emit_uint (i32.load (i32.add (local.get $sp) (i32.const 108))))
          (call $emit_zstr (i32.const ${S.el_list_item_end.offset}))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $hl)
        )
      )
    )
    (call $emit_zstr (i32.const ${S.el_list_end.offset}))
    ;; One-tap Done buttons for pending habits (up to 6 buttons)
    (if (i32.lt_s (local.get $done) (local.get $tot))
      (then
        (call $emit_byte (i32.const 44))
        (call $emit_zstr (i32.const ${S.el_btn_row_start.offset}))
        (local.set $btn_cnt (i32.const 0))
        (local.set $i (i32.const 0))
        (loop $pbtns
          (if (i32.and (i32.lt_u (local.get $i) (local.get $tot)) (i32.lt_u (local.get $btn_cnt) (i32.const 6)))
            (then
              (if (i32.eqz (call $is_done_today (local.get $i)))
                (then
                  (if (i32.gt_u (local.get $btn_cnt) (i32.const 0)) (then (call $emit_byte (i32.const 44))))
                  (local.set $sp (call $slot_ptr (local.get $i)))
                  (local.set $blen (i32.load (i32.add (local.get $sp) (i32.const 96))))
                  (if (i32.gt_u (local.get $blen) (i32.const 16))
                    (then
                      (local.set $blen (i32.const 16))
                      ;; Avoid slicing inside a UTF-8 continuation byte (0x80..0xBF)
                      (loop $u8b
                        (if (i32.and (i32.gt_u (local.get $blen) (i32.const 1))
                                     (i32.eq (i32.and (i32.load8_u (i32.add (local.get $sp) (local.get $blen))) (i32.const 192)) (i32.const 128)))
                          (then (local.set $blen (i32.sub (local.get $blen) (i32.const 1))) (br $u8b))
                        )
                      )
                    )
                  )
                  (call $emit_zstr (i32.const ${S.el_btn_done_p1.offset}))
                  (call $emit_json_esc (local.get $sp) (local.get $blen))
                  (call $emit_zstr (i32.const ${S.el_btn_done_p2.offset}))
                  (call $emit_uint (i32.add (local.get $i) (i32.const 1)))
                  (call $emit_zstr (i32.const ${S.el_btn_done_p3.offset}))
                  (local.set $btn_cnt (i32.add (local.get $btn_cnt) (i32.const 1)))
                )
              )
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $pbtns)
            )
          )
        )
        (call $emit_zstr (i32.const ${S.el_btn_row_end.offset}))
      )
    )
    (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_btns_stats_help.offset}))
    (call $emit_zstr (i32.const ${S.ui_end.offset}))
    (call $emit_len)
  )

  (func $render_stats (result i32)
    (local $tot i32) (local $done i32) (local $i i32) (local $sp i32)
    (local $top_act i32) (local $best_all i32) (local $life i32) (local $s i32) (local $b i32)
    (local.set $tot (global.get $habit_count))
    (if (i32.eqz (local.get $tot))
      (then (return (call $render_dashboard)))
    )
    (local.set $done (call $count_done_today))
    (local.set $top_act (i32.const 0))
    (local.set $best_all (i32.const 0))
    (local.set $life (i32.const 0))
    (local.set $i (i32.const 0))
    (loop $st
      (if (i32.lt_u (local.get $i) (local.get $tot))
        (then
          (local.set $sp (call $slot_ptr (local.get $i)))
          (local.set $s (call $active_streak (local.get $i)))
          (if (i32.gt_s (local.get $s) (local.get $top_act)) (then (local.set $top_act (local.get $s))))
          (local.set $b (i32.load (i32.add (local.get $sp) (i32.const 104))))
          (if (i32.gt_s (local.get $b) (local.get $best_all)) (then (local.set $best_all (local.get $b))))
          (local.set $life (i32.add (local.get $life) (i32.load (i32.add (local.get $sp) (i32.const 108)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $st)
        )
      )
    )
    (call $emit_reset)
    (call $emit_zstr (i32.const ${S.ui_start.offset}))
    (call $emit_zstr (i32.const ${S.t_stats_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_mid1.offset}))
    (call $emit_zstr (i32.const ${S.t_stats_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_sub.offset}))
    (call $emit_zstr (i32.const ${S.t_stats_sub.offset}))
    (call $emit_zstr (i32.const ${S.ui_badge.offset}))
    (call $emit_zstr (i32.const ${S.t_stats_badge.offset}))
    (call $emit_zstr (i32.const ${S.ui_bc_analytics.offset}))
    ;; Progress
    (call $emit_zstr (i32.const ${S.el_prog_p1.offset}))
    (call $emit_progress_val (local.get $done) (local.get $tot))
    (call $emit_zstr (i32.const ${S.el_prog_p2.offset}))
    (call $emit_zstr (i32.const ${S.t_today_prog.offset}))
    (call $emit_uint (local.get $done))
    (call $emit_byte (i32.const 47))
    (call $emit_uint (local.get $tot))
    (call $emit_byte (i32.const 41))
    (call $emit_zstr (i32.const ${S.el_prog_green.offset}))
    ;; Key-Value summary
    (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_kv_start.offset}))
    (call $emit_zstr (i32.const ${S.el_kv_item1.offset})) (call $emit_zstr (i32.const ${S.kv_total_habits.offset})) (call $emit_zstr (i32.const ${S.el_kv_item2.offset})) (call $emit_uint (local.get $tot)) (call $emit_zstr (i32.const ${S.el_list_item_end.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_kv_item1.offset})) (call $emit_zstr (i32.const ${S.kv_done_today.offset})) (call $emit_zstr (i32.const ${S.el_kv_item2.offset})) (call $emit_uint (local.get $done)) (call $emit_byte (i32.const 47)) (call $emit_uint (local.get $tot)) (call $emit_zstr (i32.const ${S.el_list_item_end.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_kv_item1.offset})) (call $emit_zstr (i32.const ${S.kv_best_active.offset})) (call $emit_zstr (i32.const ${S.el_kv_item2.offset})) (call $emit_days_label (local.get $top_act)) (call $emit_zstr (i32.const ${S.el_list_item_end.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_kv_item1.offset})) (call $emit_zstr (i32.const ${S.kv_best_all.offset})) (call $emit_zstr (i32.const ${S.el_kv_item2.offset})) (call $emit_days_label (local.get $best_all)) (call $emit_zstr (i32.const ${S.el_list_item_end.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_kv_item1.offset})) (call $emit_zstr (i32.const ${S.kv_lifetime.offset})) (call $emit_zstr (i32.const ${S.el_kv_item2.offset})) (call $emit_uint (local.get $life)) (call $emit_zstr (i32.const ${S.el_list_item_end.offset}))
    (call $emit_zstr (i32.const ${S.el_kv_end.offset}))
    (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_btns_view_help.offset}))
    (call $emit_zstr (i32.const ${S.ui_end.offset}))
    (call $emit_len)
  )

  ;; ── Action Handlers ──────────────────────────────────────────────────

  (func $do_add (result i32)
    (local $sp i32) (local $i i32) (local $nlen i32)
    (if (i32.le_s (global.get $name_len) (i32.const 0))
      (then
        (return (call $render_simple_card
          (i32.const ${S.t_need_name.offset}) (i32.const ${S.t_need_name_sub.offset})
          (i32.const ${S.t_nf_badge.offset}) (i32.const ${S.ui_bc_orange.offset})
          (i32.const ${S.t_need_name_body.offset}) (i32.const ${S.el_btns_view_help.offset})
        ))
      )
    )
    (if (i32.ge_u (global.get $habit_count) (i32.const 30))
      (then
        (return (call $render_simple_card
          (i32.const ${S.t_full_title.offset}) (i32.const ${S.t_need_name_sub.offset})
          (i32.const ${S.t_full_badge.offset}) (i32.const ${S.ui_bc_red.offset})
          (i32.const ${S.t_full_body.offset}) (i32.const ${S.el_btns_view_help.offset})
        ))
      )
    )
    ;; Prevent case-insensitive duplicates
    (call $to_lower (i32.const 290100) (i32.const 290400) (global.get $name_len))
    (local.set $i (i32.const 0))
    (loop $dup
      (if (i32.lt_u (local.get $i) (global.get $habit_count))
        (then
          (local.set $sp (call $slot_ptr (local.get $i)))
          (local.set $nlen (i32.load (i32.add (local.get $sp) (i32.const 96))))
          (call $to_lower (local.get $sp) (i32.const 290600) (local.get $nlen))
          (if (call $mem_eq (i32.const 290400) (global.get $name_len) (i32.const 290600) (local.get $nlen))
            (then
              (return (call $render_simple_card
                (i32.const ${S.t_dup_title.offset}) (i32.const ${S.t_added_sub.offset})
                (i32.const ${S.t_dup_badge.offset}) (i32.const ${S.ui_bc_orange.offset})
                (i32.const ${S.t_dup_body.offset}) (i32.const ${S.el_btns_view_help.offset})
              ))
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $dup)
        )
      )
    )
    ;; Append new slot
    (local.set $sp (call $slot_ptr (global.get $habit_count)))
    (drop (call $copy_mem (i32.const 290100) (local.get $sp) (global.get $name_len)))
    (i32.store (i32.add (local.get $sp) (i32.const 96)) (global.get $name_len))
    (i32.store (i32.add (local.get $sp) (i32.const 100)) (i32.const 0))
    (i32.store (i32.add (local.get $sp) (i32.const 104)) (i32.const 0))
    (i32.store (i32.add (local.get $sp) (i32.const 108)) (i32.const 0))
    (i32.store (i32.add (local.get $sp) (i32.const 128)) (i32.const 0))
    (i32.store (i32.add (local.get $sp) (i32.const 148)) (i32.const 0))
    (global.set $habit_count (i32.add (global.get $habit_count) (i32.const 1)))
    (call $save_habits)

    (call $emit_reset)
    (call $emit_zstr (i32.const ${S.ui_start.offset}))
    (call $emit_zstr (i32.const ${S.t_added_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_mid1.offset}))
    (call $emit_zstr (i32.const ${S.t_added_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_sub.offset}))
    (call $emit_zstr (i32.const ${S.t_added_sub.offset}))
    (call $emit_zstr (i32.const ${S.ui_badge.offset}))
    (call $emit_zstr (i32.const ${S.t_added_badge.offset}))
    (call $emit_zstr (i32.const ${S.ui_bc_green.offset}))
    (call $emit_zstr (i32.const ${S.el_kv_start.offset}))
    (call $emit_zstr (i32.const ${S.el_kv_item1.offset})) (call $emit_zstr (i32.const ${S.kv_habit.offset})) (call $emit_zstr (i32.const ${S.el_kv_item2.offset})) (call $emit_json_esc (i32.const 290100) (global.get $name_len)) (call $emit_zstr (i32.const ${S.el_list_item_end.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_kv_item1.offset})) (call $emit_zstr (i32.const ${S.kv_status.offset})) (call $emit_zstr (i32.const ${S.el_kv_item2.offset})) (call $emit_zstr (i32.const ${S.kv_status_ready.offset})) (call $emit_zstr (i32.const ${S.el_list_item_end.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_kv_item1.offset})) (call $emit_zstr (i32.const ${S.kv_total_habits.offset})) (call $emit_zstr (i32.const ${S.el_kv_item2.offset})) (call $emit_uint (global.get $habit_count)) (call $emit_zstr (i32.const ${S.el_list_item_end.offset}))
    (call $emit_zstr (i32.const ${S.el_kv_end.offset}))
    (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_btns_view_stats.offset}))
    (call $emit_zstr (i32.const ${S.ui_end.offset}))
    (call $emit_len)
  )

  (func $do_done (result i32)
    (local $idx i32) (local $sp i32) (local $already i32)
    (local $st i32) (local $best i32) (local $tot i32) (local $ld_days i32) (local $done_cnt i32)
    (local.set $idx (call $find_habit (i32.const 290100) (global.get $name_len)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (return (call $render_simple_card
          (i32.const ${S.t_nf_title.offset}) (i32.const ${S.t_nf_sub.offset})
          (i32.const ${S.t_nf_badge.offset}) (i32.const ${S.ui_bc_red.offset})
          (i32.const ${S.t_nf_body.offset}) (i32.const ${S.el_btns_view_help.offset})
        ))
      )
    )
    (local.set $sp (call $slot_ptr (local.get $idx)))
    (local.set $already (call $is_done_today (local.get $idx)))
    (if (i32.eqz (local.get $already))
      (then
        (local.set $st (i32.load (i32.add (local.get $sp) (i32.const 100))))
        (local.set $best (i32.load (i32.add (local.get $sp) (i32.const 104))))
        (local.set $tot (i32.load (i32.add (local.get $sp) (i32.const 108))))
        (local.set $ld_days (call $date_to_days (i32.add (local.get $sp) (i32.const 112)) (i32.load (i32.add (local.get $sp) (i32.const 128)))))
        (if (i32.and (i32.gt_s (global.get $today_days) (i32.const 0)) (i32.gt_s (local.get $ld_days) (i32.const 0)))
          (then
            (if (i32.eq (i32.sub (global.get $today_days) (local.get $ld_days)) (i32.const 1))
              (then (local.set $st (i32.add (local.get $st) (i32.const 1))))
              (else (local.set $st (i32.const 1)))
            )
          )
          (else (local.set $st (i32.add (local.get $st) (i32.const 1))))
        )
        (if (i32.gt_s (local.get $st) (local.get $best)) (then (local.set $best (local.get $st))))
        (local.set $tot (i32.add (local.get $tot) (i32.const 1)))
        (i32.store (i32.add (local.get $sp) (i32.const 100)) (local.get $st))
        (i32.store (i32.add (local.get $sp) (i32.const 104)) (local.get $best))
        (i32.store (i32.add (local.get $sp) (i32.const 108)) (local.get $tot))
        ;; Save prev_date = old last_date, last_date = today
        (drop (call $copy_mem (i32.add (local.get $sp) (i32.const 112)) (i32.add (local.get $sp) (i32.const 132)) (i32.load (i32.add (local.get $sp) (i32.const 128)))))
        (i32.store (i32.add (local.get $sp) (i32.const 148)) (i32.load (i32.add (local.get $sp) (i32.const 128))))
        (if (i32.gt_s (global.get $date_len) (i32.const 0))
          (then
            (drop (call $copy_mem (i32.const 290300) (i32.add (local.get $sp) (i32.const 112)) (global.get $date_len)))
            (i32.store (i32.add (local.get $sp) (i32.const 128)) (global.get $date_len))
          )
        )
        (call $save_habits)
      )
    )
    (local.set $done_cnt (call $count_done_today))
    (call $emit_reset)
    (call $emit_zstr (i32.const ${S.ui_start.offset}))
    (call $emit_zstr (if (result i32) (local.get $already) (then (i32.const ${S.t_already_title.offset})) (else (i32.const ${S.t_done_title.offset}))))
    (call $emit_zstr (i32.const ${S.ui_mid1.offset}))
    (call $emit_zstr (if (result i32) (local.get $already) (then (i32.const ${S.t_already_title.offset})) (else (i32.const ${S.t_done_title.offset}))))
    (call $emit_zstr (i32.const ${S.ui_sub.offset}))
    (call $emit_zstr (if (result i32) (local.get $already) (then (i32.const ${S.t_already_sub.offset})) (else (i32.const ${S.t_done_sub.offset}))))
    (call $emit_zstr (i32.const ${S.ui_badge.offset}))
    (call $emit_zstr (if (result i32) (local.get $already) (then (i32.const ${S.t_already_badge.offset})) (else (i32.const ${S.t_done_badge.offset}))))
    (call $emit_zstr (i32.const ${S.ui_bc_green.offset}))
    ;; Progress bar
    (call $emit_zstr (i32.const ${S.el_prog_p1.offset}))
    (call $emit_progress_val (local.get $done_cnt) (global.get $habit_count))
    (call $emit_zstr (i32.const ${S.el_prog_p2.offset}))
    (call $emit_zstr (i32.const ${S.t_today_prog.offset}))
    (call $emit_uint (local.get $done_cnt))
    (call $emit_byte (i32.const 47))
    (call $emit_uint (global.get $habit_count))
    (call $emit_byte (i32.const 41))
    (call $emit_zstr (i32.const ${S.el_prog_green.offset}))
    ;; Key-value details
    (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_kv_start.offset}))
    (call $emit_zstr (i32.const ${S.el_kv_item1.offset})) (call $emit_zstr (i32.const ${S.kv_habit.offset})) (call $emit_zstr (i32.const ${S.el_kv_item2.offset})) (call $emit_json_esc (local.get $sp) (i32.load (i32.add (local.get $sp) (i32.const 96)))) (call $emit_zstr (i32.const ${S.el_list_item_end.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_kv_item1.offset})) (call $emit_zstr (i32.const ${S.kv_streak.offset})) (call $emit_zstr (i32.const ${S.el_kv_item2.offset})) (call $emit_days_label (i32.load (i32.add (local.get $sp) (i32.const 100)))) (call $emit_zstr (i32.const ${S.el_list_item_end.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_kv_item1.offset})) (call $emit_zstr (i32.const ${S.kv_best.offset})) (call $emit_zstr (i32.const ${S.el_kv_item2.offset})) (call $emit_days_label (i32.load (i32.add (local.get $sp) (i32.const 104)))) (call $emit_zstr (i32.const ${S.el_list_item_end.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_kv_item1.offset})) (call $emit_zstr (i32.const ${S.kv_total.offset})) (call $emit_zstr (i32.const ${S.el_kv_item2.offset})) (call $emit_uint (i32.load (i32.add (local.get $sp) (i32.const 108)))) (call $emit_zstr (i32.const ${S.el_list_item_end.offset}))
    (call $emit_zstr (i32.const ${S.el_kv_end.offset}))
    (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_btns_view_stats.offset}))
    (call $emit_zstr (i32.const ${S.ui_end.offset}))
    (call $emit_len)
  )

  (func $do_undo (result i32)
    (local $idx i32) (local $sp i32) (local $st i32) (local $tot i32)
    (local.set $idx (call $find_habit (i32.const 290100) (global.get $name_len)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (return (call $render_simple_card
          (i32.const ${S.t_nf_title.offset}) (i32.const ${S.t_nf_sub.offset})
          (i32.const ${S.t_nf_badge.offset}) (i32.const ${S.ui_bc_red.offset})
          (i32.const ${S.t_nf_body.offset}) (i32.const ${S.el_btns_view_help.offset})
        ))
      )
    )
    (if (i32.eqz (call $is_done_today (local.get $idx)))
      (then
        (return (call $render_simple_card
          (i32.const ${S.t_undo_title.offset}) (i32.const ${S.t_undo_sub.offset})
          (i32.const ${S.t_undo_badge.offset}) (i32.const ${S.ui_bc_orange.offset})
          (i32.const ${S.t_undo_none.offset}) (i32.const ${S.el_btns_view_help.offset})
        ))
      )
    )
    (local.set $sp (call $slot_ptr (local.get $idx)))
    (local.set $st (i32.load (i32.add (local.get $sp) (i32.const 100))))
    (local.set $tot (i32.load (i32.add (local.get $sp) (i32.const 108))))
    (if (i32.gt_s (local.get $st) (i32.const 0)) (then (i32.store (i32.add (local.get $sp) (i32.const 100)) (i32.sub (local.get $st) (i32.const 1)))))
    (if (i32.gt_s (local.get $tot) (i32.const 0)) (then (i32.store (i32.add (local.get $sp) (i32.const 108)) (i32.sub (local.get $tot) (i32.const 1)))))
    ;; Restore last_date = prev_date
    (drop (call $copy_mem (i32.add (local.get $sp) (i32.const 132)) (i32.add (local.get $sp) (i32.const 112)) (i32.load (i32.add (local.get $sp) (i32.const 148)))))
    (i32.store (i32.add (local.get $sp) (i32.const 128)) (i32.load (i32.add (local.get $sp) (i32.const 148))))
    (i32.store (i32.add (local.get $sp) (i32.const 148)) (i32.const 0))
    (call $save_habits)

    (call $emit_reset)
    (call $emit_zstr (i32.const ${S.ui_start.offset}))
    (call $emit_zstr (i32.const ${S.t_undo_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_mid1.offset}))
    (call $emit_zstr (i32.const ${S.t_undo_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_sub.offset}))
    (call $emit_zstr (i32.const ${S.t_undo_sub.offset}))
    (call $emit_zstr (i32.const ${S.ui_badge.offset}))
    (call $emit_zstr (i32.const ${S.t_undo_badge.offset}))
    (call $emit_zstr (i32.const ${S.ui_bc_orange.offset}))
    (call $emit_zstr (i32.const ${S.el_kv_start.offset}))
    (call $emit_zstr (i32.const ${S.el_kv_item1.offset})) (call $emit_zstr (i32.const ${S.kv_habit.offset})) (call $emit_zstr (i32.const ${S.el_kv_item2.offset})) (call $emit_json_esc (local.get $sp) (i32.load (i32.add (local.get $sp) (i32.const 96)))) (call $emit_zstr (i32.const ${S.el_list_item_end.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_kv_item1.offset})) (call $emit_zstr (i32.const ${S.kv_streak.offset})) (call $emit_zstr (i32.const ${S.el_kv_item2.offset})) (call $emit_days_label (i32.load (i32.add (local.get $sp) (i32.const 100)))) (call $emit_zstr (i32.const ${S.el_list_item_end.offset}))
    (call $emit_zstr (i32.const ${S.el_kv_end.offset}))
    (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_btns_view_stats.offset}))
    (call $emit_zstr (i32.const ${S.ui_end.offset}))
    (call $emit_len)
  )

  (func $do_delete (result i32)
    (local $idx i32) (local $sp i32) (local $nlen i32) (local $i i32)
    (local.set $idx (call $find_habit (i32.const 290100) (global.get $name_len)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (return (call $render_simple_card
          (i32.const ${S.t_nf_title.offset}) (i32.const ${S.t_nf_sub.offset})
          (i32.const ${S.t_nf_badge.offset}) (i32.const ${S.ui_bc_red.offset})
          (i32.const ${S.t_nf_body.offset}) (i32.const ${S.el_btns_view_help.offset})
        ))
      )
    )
    (local.set $sp (call $slot_ptr (local.get $idx)))
    (local.set $nlen (i32.load (i32.add (local.get $sp) (i32.const 96))))
    (drop (call $copy_mem (local.get $sp) (i32.const 290100) (local.get $nlen)))
    ;; Shift remaining slots down
    (local.set $i (local.get $idx))
    (loop $sh
      (if (i32.lt_u (i32.add (local.get $i) (i32.const 1)) (global.get $habit_count))
        (then
          (memory.copy (call $slot_ptr (local.get $i)) (call $slot_ptr (i32.add (local.get $i) (i32.const 1))) (i32.const 256))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $sh)
        )
      )
    )
    (global.set $habit_count (i32.sub (global.get $habit_count) (i32.const 1)))
    (call $save_habits)

    (call $emit_reset)
    (call $emit_zstr (i32.const ${S.ui_start.offset}))
    (call $emit_zstr (i32.const ${S.t_del_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_mid1.offset}))
    (call $emit_zstr (i32.const ${S.t_del_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_sub.offset}))
    (call $emit_zstr (i32.const ${S.t_del_sub.offset}))
    (call $emit_zstr (i32.const ${S.ui_badge.offset}))
    (call $emit_zstr (i32.const ${S.t_del_badge.offset}))
    (call $emit_zstr (i32.const ${S.ui_bc_orange.offset}))
    (call $emit_zstr (i32.const ${S.el_kv_start.offset}))
    (call $emit_zstr (i32.const ${S.el_kv_item1.offset})) (call $emit_zstr (i32.const ${S.kv_habit.offset})) (call $emit_zstr (i32.const ${S.el_kv_item2.offset})) (call $emit_json_esc (i32.const 290100) (local.get $nlen)) (call $emit_zstr (i32.const ${S.el_list_item_end.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_kv_item1.offset})) (call $emit_zstr (i32.const ${S.kv_total_habits.offset})) (call $emit_zstr (i32.const ${S.el_kv_item2.offset})) (call $emit_uint (global.get $habit_count)) (call $emit_zstr (i32.const ${S.el_list_item_end.offset}))
    (call $emit_zstr (i32.const ${S.el_kv_end.offset}))
    (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_btns_view_help.offset}))
    (call $emit_zstr (i32.const ${S.ui_end.offset}))
    (call $emit_len)
  )

  ;; ── Main Entrypoint ──────────────────────────────────────────────────

  (func (export "habits_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $ts i32) (local $tl i32) (local $vlen i32) (local $arg_ptr i32) (local $arg_len i32)
    (global.set $habit_count (i32.const 0))
    (global.set $act_len (i32.const 0))
    (global.set $name_len (i32.const 0))
    (global.set $date_len (i32.const 0))
    (global.set $today_days (i32.const 0))

    ;; Trim whitespace
    (local.set $ts (local.get $in_ptr))
    (local.set $tl (local.get $in_len))
    (loop $lt
      (if (i32.and (i32.gt_u (local.get $tl) (i32.const 0)) (call $is_ws (i32.load8_u (local.get $ts))))
        (then (local.set $ts (i32.add (local.get $ts) (i32.const 1))) (local.set $tl (i32.sub (local.get $tl) (i32.const 1))) (br $lt))
      )
    )
    (loop $rt
      (if (i32.and (i32.gt_u (local.get $tl) (i32.const 0)) (call $is_ws (i32.load8_u (i32.add (local.get $ts) (i32.sub (local.get $tl) (i32.const 1))))))
        (then (local.set $tl (i32.sub (local.get $tl) (i32.const 1))) (br $rt))
      )
    )

    ;; Parse JSON or direct plain-text command
    (if (i32.and (i32.gt_u (local.get $tl) (i32.const 0)) (i32.eq (i32.load8_u (local.get $ts)) (i32.const 123)))
      (then
        ;; JSON mode: read operation first (Chattree Host envelope), then action
        (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_op.offset}) (i32.const 290000) (i32.const 60)))
        (if (i32.le_s (local.get $vlen) (i32.const 0))
          (then (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_action.offset}) (i32.const 290000) (i32.const 60))))
        )
        (if (i32.gt_s (local.get $vlen) (i32.const 0))
          (then
            (call $to_lower (i32.const 290000) (i32.const 290000) (local.get $vlen))
            (global.set $act_len (local.get $vlen))
          )
        )
        ;; Optional date YYYY-MM-DD
        (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_date.offset}) (i32.const 290300) (i32.const 16)))
        (if (i32.ge_s (local.get $vlen) (i32.const 10))
          (then
            (global.set $date_len (i32.const 10))
            (global.set $today_days (call $date_to_days (i32.const 290300) (i32.const 10)))
          )
        )
        ;; Extract habit name/target from name, habit, title, query, id, text, content
        (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_name.offset}) (i32.const 290200) (i32.const 100)))
        (if (i32.le_s (local.get $vlen) (i32.const 0))
          (then (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_habit.offset}) (i32.const 290200) (i32.const 100))))
        )
        (if (i32.le_s (local.get $vlen) (i32.const 0))
          (then (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_title.offset}) (i32.const 290200) (i32.const 100))))
        )
        (if (i32.le_s (local.get $vlen) (i32.const 0))
          (then (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_query.offset}) (i32.const 290200) (i32.const 100))))
        )
        (if (i32.le_s (local.get $vlen) (i32.const 0))
          (then (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_id.offset}) (i32.const 290200) (i32.const 100))))
        )
        (if (i32.le_s (local.get $vlen) (i32.const 0))
          (then (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_text.offset}) (i32.const 290200) (i32.const 100))))
        )
        (if (i32.le_s (local.get $vlen) (i32.const 0))
          (then (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_content.offset}) (i32.const 290200) (i32.const 100))))
        )
        (if (i32.le_s (local.get $vlen) (i32.const 0))
          (then (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_extra.offset}) (i32.const 290200) (i32.const 100))))
        )
        (if (i32.gt_s (local.get $vlen) (i32.const 0))
          (then (drop (call $sanitize_name (i32.const 290200) (local.get $vlen))))
        )
      )
      (else
        ;; Plain-text slash command mode: strip trailing lang=<code>
        (local.set $tl (call $strip_lang (local.get $ts) (local.get $tl)))
        (if (i32.gt_s (local.get $tl) (i32.const 0))
          (then
            (call $to_lower (local.get $ts) (i32.const 290400) (if (result i32) (i32.gt_u (local.get $tl) (i32.const 120)) (then (i32.const 120)) (else (local.get $tl))))
            (local.set $arg_ptr (i32.const 0))
            (local.set $arg_len (i32.const 0))
            (if (call $match_cmd (i32.const 290400) (local.get $tl) (i32.const ${S.a_help.offset}))
              (then (drop (call $copy_zstr (i32.const ${S.a_help.offset}) (i32.const 290000))) (global.set $act_len (i32.const ${S.a_help.len})))
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 290400) (local.get $tl) (i32.const ${S.a_stats.offset})))
              (then (drop (call $copy_zstr (i32.const ${S.a_stats.offset}) (i32.const 290000))) (global.set $act_len (i32.const ${S.a_stats.len})))
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 290400) (local.get $tl) (i32.const ${S.a_reset.offset})))
              (then (drop (call $copy_zstr (i32.const ${S.a_reset.offset}) (i32.const 290000))) (global.set $act_len (i32.const ${S.a_reset.len})))
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 290400) (local.get $tl) (i32.const ${S.a_add.offset})))
              (then
                (drop (call $copy_zstr (i32.const ${S.a_add.offset}) (i32.const 290000))) (global.set $act_len (i32.const ${S.a_add.len}))
                (local.set $arg_ptr (i32.add (local.get $ts) (i32.const 3))) (local.set $arg_len (i32.sub (local.get $tl) (i32.const 3)))
              )
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 290400) (local.get $tl) (i32.const ${S.a_done.offset})))
              (then
                (drop (call $copy_zstr (i32.const ${S.a_done.offset}) (i32.const 290000))) (global.set $act_len (i32.const ${S.a_done.len}))
                (local.set $arg_ptr (i32.add (local.get $ts) (i32.const 4))) (local.set $arg_len (i32.sub (local.get $tl) (i32.const 4)))
              )
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 290400) (local.get $tl) (i32.const ${S.a_check.offset})))
              (then
                (drop (call $copy_zstr (i32.const ${S.a_done.offset}) (i32.const 290000))) (global.set $act_len (i32.const ${S.a_done.len}))
                (local.set $arg_ptr (i32.add (local.get $ts) (i32.const 5))) (local.set $arg_len (i32.sub (local.get $tl) (i32.const 5)))
              )
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 290400) (local.get $tl) (i32.const ${S.a_undo.offset})))
              (then
                (drop (call $copy_zstr (i32.const ${S.a_undo.offset}) (i32.const 290000))) (global.set $act_len (i32.const ${S.a_undo.len}))
                (local.set $arg_ptr (i32.add (local.get $ts) (i32.const 4))) (local.set $arg_len (i32.sub (local.get $tl) (i32.const 4)))
              )
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 290400) (local.get $tl) (i32.const ${S.a_delete.offset})))
              (then
                (drop (call $copy_zstr (i32.const ${S.a_delete.offset}) (i32.const 290000))) (global.set $act_len (i32.const ${S.a_delete.len}))
                (local.set $arg_ptr (i32.add (local.get $ts) (i32.const 6))) (local.set $arg_len (i32.sub (local.get $tl) (i32.const 6)))
              )
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 290400) (local.get $tl) (i32.const ${S.a_remove.offset})))
              (then
                (drop (call $copy_zstr (i32.const ${S.a_delete.offset}) (i32.const 290000))) (global.set $act_len (i32.const ${S.a_delete.len}))
                (local.set $arg_ptr (i32.add (local.get $ts) (i32.const 6))) (local.set $arg_len (i32.sub (local.get $tl) (i32.const 6)))
              )
            )
            (if (i32.gt_s (local.get $arg_len) (i32.const 0))
              (then (drop (call $sanitize_name (local.get $arg_ptr) (local.get $arg_len))))
            )
          )
        )
      )
    )

    ;; Sync date & load habits from storage.private
    (call $sync_date)
    (call $load_habits)

    ;; Dispatch action
    (if (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_help.offset}))
      (then
        (return (call $render_simple_card
          (i32.const ${S.t_help_title.offset}) (i32.const ${S.t_help_sub.offset})
          (i32.const ${S.t_help_badge.offset}) (i32.const ${S.ui_bc_blue.offset})
          (i32.const ${S.t_help_body.offset}) (i32.const ${S.el_btns_view_stats.offset})
        ))
      )
    )
    (if (i32.or (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_stats.offset}))
                (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_summary.offset})))
      (then (return (call $render_stats)))
    )
    (if (i32.or (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_add.offset}))
                (i32.or (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_create.offset}))
                        (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_new.offset}))))
      (then (return (call $do_add)))
    )
    (if (i32.or
          (i32.or
            (i32.or (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_done.offset}))
                    (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_check.offset})))
            (i32.or (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_complete.offset}))
                    (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_completed.offset}))))
          (i32.or
            (i32.or (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_log.offset}))
                    (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_finish.offset})))
            (i32.or (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_checkin.offset}))
                    (i32.or (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_check_in.offset}))
                            (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_update.offset}))))))
      (then (return (call $do_done)))
    )
    (if (i32.or (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_undo.offset}))
                (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_uncheck.offset})))
      (then (return (call $do_undo)))
    )
    (if (i32.or (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_delete.offset}))
                (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_remove.offset})))
      (then (return (call $do_delete)))
    )
    (if (call $str_eq_z (i32.const 290000) (global.get $act_len) (i32.const ${S.a_reset.offset}))
      (then
        (global.set $habit_count (i32.const 0))
        (call $save_habits)
        (return (call $render_simple_card
          (i32.const ${S.t_reset_title.offset}) (i32.const ${S.t_reset_sub.offset})
          (i32.const ${S.t_reset_badge.offset}) (i32.const ${S.ui_bc_orange.offset})
          (i32.const ${S.t_reset_body.offset}) (i32.const ${S.el_btns_view_help.offset})
        ))
      )
    )

    ;; Default: list / today dashboard
    (call $render_dashboard)
  )
)
`;

const watPath = path.join(pluginDir, 'plugin.wat');
const wasmPath = path.join(pluginDir, 'plugin.wasm');
const manifestPath = path.join(pluginDir, 'plugin.json');

fs.writeFileSync(watPath, wat, 'utf8');
execSync(`wat2wasm "${watPath}" -o "${wasmPath}"`, { stdio: 'inherit' });

const wasmBytes = fs.readFileSync(wasmPath);
const wasmSha256 = crypto.createHash('sha256').update(wasmBytes).digest('hex');

const manifest = {
  $schema: '../../../schemas/plugin.manifest.v1.schema.json',
  schemaVersion: 1,
  id: 'com.chattree.official.habits',
  version: '1.0.1',
  name: 'Habit Tracker',
  description: '100% local daily habit & streak tracker with green interactive Flutter UI cards, one-tap completion buttons, fuzzy natural-language matching, and automatic consecutive-day streaks.',
  author: 'Chattree Core Team',
  primaryCommand: 'habits',
  aliases: ['habit', 'habitos', 'streak'],
  type: 'imported',
  category: 'productivity',
  capabilities: ['storage.private', 'ui.components'],
  tags: ['habits', 'streaks', 'productivity', 'tracker', 'daily', 'ui', 'official'],
  iconUrl: 'https://raw.githubusercontent.com/Ponce5/Chattree/main/plugins/official/habits/icon.png?v=1.0.1',
  bannerUrl: 'https://raw.githubusercontent.com/Ponce5/Chattree/main/plugins/official/habits/banner.png?v=1.0.1',
  changelog: '1.0.1: Switched all Flutter UI badges and progress bars to emerald green, added one-tap Done buttons on the Daily Habits card for pending habits, and added word-overlap fuzzy matching + extra completion action aliases for natural language (English & Spanish).',
  runtime: 'wasm',
  entrypoint: 'habits_entry',
  wasmPath: 'plugin.wasm',
  wasmSha256,
  runtimeApiVersion: '1.0.0',
  maxMemoryPages: 16,
  timeoutMs: 15000,
  fuelLimit: 50000000,
  inputOffset: 0,
  outputOffset: 65536,
  maxPayloadSizeBytes: 65536,
  tools: [
    {
      id: 'com.chattree.official.habits.tracker',
      command: 'habits',
      displayName: 'Habit Tracker',
      description: 'Track daily habits and streaks locally. Always include "tool":"habits" and return ONE JSON object. When the user says they already did, finished, or completed a habit (e.g. "ya leí 20 minutos", "completé leer", "I drank water"), ALWAYS use action="done" with "name" set to the habit keywords. Actions: "list", "add", "done", "undo", "stats", "delete", "reset", "help". Always include "date" as YYYY-MM-DD.',
      capabilities: ['storage.private', 'ui.components'],
      intentContract: {
        intent: 'habits_action',
        validIntents: ['list', 'add', 'done', 'undo', 'stats', 'delete', 'reset', 'help'],
        description: 'Interpret the user\'s habit request (English or Spanish) and return ONE valid JSON object with "tool":"habits", "action", optional "name", and "date" (today\'s local YYYY-MM-DD). Use action="done" whenever the user reports completing a habit.',
        fields: [
          {
            name: 'action',
            key: 'action',
            type: 'string',
            description: 'Action: "list", "add" (create new habit), "done" (mark habit completed today), "undo", "stats", "delete", "reset", or "help".',
            required: true,
          },
          {
            name: 'name',
            key: 'name',
            type: 'string',
            description: 'Concise habit name or keywords (for add/done/undo/delete) or habit number like "1".',
            required: false,
          },
          {
            name: 'date',
            key: 'date',
            type: 'string',
            description: 'Today\'s local date in YYYY-MM-DD format.',
            required: false,
          },
        ],
        examples: [
          {
            input: 'add a habit to drink 2L of water',
            output: { tool: 'habits', action: 'add', name: 'Drink 2L of water', date: '2026-11-25' },
          },
          {
            input: 'ya leí 20 minutos hoy',
            output: { tool: 'habits', action: 'done', name: 'leer 20 minutos', date: '2026-11-25' },
          },
          {
            input: 'completé mi hábito de tomar agua',
            output: { tool: 'habits', action: 'done', name: 'agua', date: '2026-11-25' },
          },
          {
            input: 'show my habit stats',
            output: { tool: 'habits', action: 'stats', date: '2026-11-25' },
          },
          {
            input: 'undo water check-in',
            output: { tool: 'habits', action: 'undo', name: 'water', date: '2026-11-25' },
          },
        ],
        maxResponseTokens: 400,
      },
    },
  ],
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`[OK] Built ${wasmPath} (${wasmBytes.length} bytes, sha256=${wasmSha256})`);

// ── Self-Test Suite ──────────────────────────────────────────────────────
function wrapEnvelope(aiObj) {
  const decoded = { ...aiObj, lang: 'es' };
  const operation = (decoded.action || 'list').toLowerCase();
  const payload = {};
  for (const [k, v] of Object.entries(decoded)) {
    const kl = k.toLowerCase();
    if (kl !== 'tool' && kl !== 'action') payload[kl] = v;
  }
  return JSON.stringify({ api: 'habits', command: 'habits', toolId: 'com.chattree.official.habits.tracker', operation, payload });
}

const storage = {};
let mem;
const mod = await WebAssembly.instantiate(wasmBytes, {
  chattree: {
    host_call: (reqPtr, reqLen, resPtr, resMaxLen) => {
      const reqStr = Buffer.from(mem.buffer, reqPtr, reqLen).toString('utf8');
      const req = JSON.parse(reqStr);
      let resp;
      if (req.operation === 'set') {
        storage[req.payload.key] = req.payload.value;
        resp = JSON.stringify({ success: true, data: { key: req.payload.key, value: req.payload.value, stored: true }, error: null });
      } else if (req.operation === 'get') {
        const val = storage[req.payload.key] ?? null;
        resp = JSON.stringify({ success: true, data: { key: req.payload.key, value: val, exists: val !== null }, error: null });
      }
      const buf = Buffer.from(resp, 'utf8');
      Buffer.from(mem.buffer).set(buf, resPtr);
      return buf.length;
    },
  },
});
mem = mod.instance.exports.memory;

function run(inp) {
  const buf = Buffer.from(inp, 'utf8');
  Buffer.from(mem.buffer).set(buf, 0);
  const outLen = mod.instance.exports.habits_entry(0, buf.length);
  const raw = Buffer.from(mem.buffer, 65536, outLen).toString('utf8');
  return JSON.parse(raw);
}

// 1. Bare /habits ("lang=es") when empty
let out = run('lang=es');
assert.equal(out.type, 'ui');
assert.equal(out.ui.badge, 'EMPTY');

// 2. Add two habits via AI envelope & direct command
out = run(wrapEnvelope({ tool: 'habits', action: 'add', name: 'Drink 2L water', date: '2026-11-24' }));
assert.equal(out.ui.badge, 'ADDED');
out = run('add Read 20 minutes lang=es');
assert.equal(out.ui.badge, 'ADDED');

// 3. Duplicate rejected
out = run(wrapEnvelope({ tool: 'habits', action: 'add', name: 'drink 2l water', date: '2026-11-24' }));
assert.equal(out.ui.badge, 'DUPLICATE');

// 4. Mark done on Day 1 (2026-11-24) -> streak 1
out = run(wrapEnvelope({ tool: 'habits', action: 'done', name: 'water', date: '2026-11-24' }));
assert.equal(out.ui.badge, 'CHECKED IN');
assert.equal(out.ui.elements[1].items[1].value, '1 day');

// 5. Same day again -> ALREADY DONE
out = run(wrapEnvelope({ tool: 'habits', action: 'done', name: '1', date: '2026-11-24' }));
assert.equal(out.ui.badge, 'DONE TODAY');

// 6. Next consecutive day (2026-11-25) -> streak 2!
out = run(wrapEnvelope({ tool: 'habits', action: 'done', name: 'water', date: '2026-11-25' }));
assert.equal(out.ui.badge, 'CHECKED IN');
assert.equal(out.ui.elements[1].items[1].value, '2 days');

// 7. Complete second habit via direct command -> ALL DONE
out = run('done 2 lang=es');
assert.equal(out.ui.badge, 'CHECKED IN');
out = run('lang=es');
assert.equal(out.ui.badge, 'ALL DONE');

// 8. Undo second habit
out = run('undo 2 lang=es');
assert.equal(out.ui.badge, 'UNDONE');
out = run('lang=es');
assert.equal(out.ui.badge, '1/2 TODAY');

// 9. Stats
out = run('stats lang=es');
assert.equal(out.ui.badge, 'STATS');
assert.equal(out.ui.elements[1].items[2].value, '2 days');

// 10. Natural-language fuzzy match ("leí 20 minutos" matches "Leer 20 minutos") + green UI + 1-tap Done buttons
out = run('add Leer 20 minutos lang=es');
assert.equal(out.ui.badge, 'ADDED');
out = run('lang=es');
assert.equal(out.ui.badgeColor, 'green');
assert.equal(out.ui.elements[0].color, 'green');
assert.equal(out.ui.elements[2].type, 'button_row');
assert.ok(out.ui.elements[2].buttons.some((b) => b.value === '/habits done 3'));
out = run(wrapEnvelope({ tool: 'habits', action: 'update', name: 'leí 20 minutos hoy', date: '2026-11-25' }));
assert.equal(out.ui.badge, 'CHECKED IN');
assert.equal(out.ui.elements[1].items[0].value, 'Leer 20 minutos');

// 11. Delete & Help (green UI)
out = run('delete read lang=es');
assert.equal(out.ui.badge, 'REMOVED');
out = run('help lang=es');
assert.equal(out.ui.badge, 'GUIDE');
assert.equal(out.ui.badgeColor, 'green');

console.log('[OK] All 11 Habit Tracker WASM self-tests passed!');
