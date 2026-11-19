import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDir = path.resolve(__dirname, '../plugins/official/calendar');

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
  staticPtr += d.byteLen + 8;
  staticPtr = (staticPtr + 3) & ~3;
  if (staticPtr >= 270000) {
    throw new Error(`Static data overflow past 270000 at ${name}: ${staticPtr}`);
  }
  dataEntries.push({ name, offset, strLen: d.strLen, escaped: d.escaped });
  return { offset, len: d.strLen };
}

// ── Static Data Segments ──────────────────────────────────────────────────
const S = {};

// Keys for input JSON parsing
S.k_lang = registerData('k_lang', 'lang');
S.k_lang_eq = registerData('k_lang_eq', 'lang=');
S.k_op = registerData('k_op', 'operation');
S.k_action = registerData('k_action', 'action');
S.k_intent = registerData('k_intent', 'INTENT');
S.k_title = registerData('k_title', 'title');
S.k_summary = registerData('k_summary', 'summary');
S.k_event = registerData('k_event', 'event');
S.k_start = registerData('k_start', 'start');
S.k_startDate = registerData('k_startDate', 'startDate');
S.k_startdate_lc = registerData('k_startdate_lc', 'startdate');
S.k_end = registerData('k_end', 'end');
S.k_endDate = registerData('k_endDate', 'endDate');
S.k_enddate_lc = registerData('k_enddate_lc', 'enddate');
S.k_dur = registerData('k_dur', 'duration');
S.k_durMin = registerData('k_durMin', 'durationMinutes');
S.k_durmin_lc = registerData('k_durmin_lc', 'durationminutes');
S.k_desc = registerData('k_desc', 'description');
S.k_content = registerData('k_content', 'content');
S.k_details = registerData('k_details', 'details');
S.k_notes = registerData('k_notes', 'notes');
S.k_calId = registerData('k_calId', 'calendarId');
S.k_calid_lc = registerData('k_calid_lc', 'calendarid');
S.k_evId = registerData('k_evId', 'eventId');
S.k_evid_lc = registerData('k_evid_lc', 'eventid');
S.k_id = registerData('k_id', 'id');

// Actions
S.a_create = registerData('a_create', 'create');
S.a_add = registerData('a_add', 'add');
S.a_new = registerData('a_new', 'new');
S.a_schedule = registerData('a_schedule', 'schedule');
S.a_events = registerData('a_events', 'events');
S.a_list = registerData('a_list', 'list');
S.a_inbox = registerData('a_inbox', 'inbox');
S.a_get = registerData('a_get', 'get');
S.a_update = registerData('a_update', 'update');
S.a_delete = registerData('a_delete', 'delete');
S.a_help = registerData('a_help', 'help');
S.a_unknown = registerData('a_unknown', 'unknown');

// Host API response keys
S.k_success = registerData('k_success', 'success');
S.k_created = registerData('k_created', 'created');
S.k_updated = registerData('k_updated', 'updated');
S.k_deleted = registerData('k_deleted', 'deleted');
S.k_error = registerData('k_error', 'error');
S.k_calendars = registerData('k_calendars', 'calendars');
S.k_isReadOnly = registerData('k_isReadOnly', 'isReadOnly');
S.k_isDefault = registerData('k_isDefault', 'isDefault');
S.k_allDay = registerData('k_allDay', 'allDay');
S.k_text = registerData('k_text', 'text');
S.k_count = registerData('k_count', 'count');

// Substrings for permission error detection
S.sub_denied1 = registerData('sub_denied1', 'denegado');
S.sub_denied2 = registerData('sub_denied2', 'denied');

// English UI & predefined strings
S.def_en = registerData('def_en', 'en');
S.def_cal = registerData('def_cal', 'Calendar');
S.def_sep_dash = registerData('def_sep_dash', ' - ');
S.def_sep_dot = registerData('def_sep_dot', ' \u2022 ');
S.def_true = registerData('def_true', 'true');
S.def_false = registerData('def_false', 'false');

S.en_sched_disp = registerData('en_sched_disp', 'Event scheduled.');
S.en_sched_title = registerData('en_sched_title', 'Event Scheduled');
S.en_cal_err = registerData('en_cal_err', 'Calendar Error');
S.en_events_disp = registerData('en_events_disp', 'Upcoming calendar events.');
S.en_events_title = registerData('en_events_title', 'Upcoming Events');
S.en_device_cal = registerData('en_device_cal', 'Device Calendar');
S.en_created_badge = registerData('en_created_badge', 'CREATED');
S.en_error_badge = registerData('en_error_badge', 'ERROR');
S.en_empty_badge = registerData('en_empty_badge', 'EMPTY');
S.en_events_badge = registerData('en_events_badge', 'EVENTS');
S.en_lbl_title = registerData('en_lbl_title', 'Title');
S.en_lbl_date = registerData('en_lbl_date', 'Date');
S.en_lbl_time = registerData('en_lbl_time', 'Time');
S.en_lbl_desc = registerData('en_lbl_desc', 'Description');
S.en_all_day = registerData('en_all_day', 'All day');
S.en_empty_msg = registerData('en_empty_msg', 'No upcoming events scheduled.');
S.en_err_fallback = registerData('en_err_fallback', 'Unable to complete calendar operation. Check calendar permissions and try again.');
S.en_help_fallback = registerData('en_help_fallback', 'Use /calendar to view upcoming events, or ask naturally to schedule, update, or delete events (or /calendar Title | YYYY-MM-DDTHH:mm:ss | YYYY-MM-DDTHH:mm:ss).');
S.en_btn_view = registerData('en_btn_view', 'View Events');
S.en_btn_refresh = registerData('en_btn_refresh', 'Refresh');
S.en_btn_retry = registerData('en_btn_retry', 'Retry');

// Reasons for help / missing args
S.r_help = registerData('r_help', 'help');
S.r_miss_title = registerData('r_miss_title', 'missing_title');
S.r_miss_evid = registerData('r_miss_evid', 'missing_event_id');

// Calendar Host API templates
S.req_calendars = registerData('req_calendars', '{"api":"calendar","operation":"calendars","payload":{}}');
S.req_events_p = registerData('req_events_p', '{"api":"calendar","operation":"events","payload":{');
S.req_create_p = registerData('req_create_p', '{"api":"calendar","operation":"create","payload":{"title":"');
S.req_update_p = registerData('req_update_p', '{"api":"calendar","operation":"update","payload":{"eventId":"');
S.req_delete_p = registerData('req_delete_p', '{"api":"calendar","operation":"delete","payload":{"eventId":"');
S.req_end = registerData('req_end', '}}');
S.jf_calid = registerData('jf_calid', '"calendarId":"');
S.jf_start = registerData('jf_start', '"start":"');
S.jf_startDate = registerData('jf_startDate', '"startDate":"');
S.jf_end = registerData('jf_end', '"end":"');
S.jf_endDate = registerData('jf_endDate', '"endDate":"');
S.jf_title = registerData('jf_title', '"title":"');
S.jf_desc = registerData('jf_desc', '"description":"');
S.jf_durMin = registerData('jf_durMin', '"durationMinutes":');
S.jf_q = registerData('jf_q', '"');
S.jf_comma = registerData('jf_comma', ',');

// Compact AI template (used ONLY for direct /calendar help)
S.ai_help_p1 = registerData(
  'ai_help_p1',
  '{"api":"ai","operation":"complete","payload":{"systemPrompt":"Reply concisely in language \\"'
);
S.ai_help_p2 = registerData(
  'ai_help_p2',
  '\\". Plain text only.","prompt":"Explain briefly how to use Chattree Calendar (/calendar to list events, natural language to schedule/update/delete, or /calendar Title | YYYY-MM-DDTHH:mm:ss | YYYY-MM-DDTHH:mm:ss). Reason: '
);
S.ai_help_p3 = registerData('ai_help_p3', '","maxTokens":180,"temperature":0.2,"timeoutMs":15000}}');

// UI Card JSON Output Templates (hideText:true keeps cards crisp without duplicate text)
S.ui_p1 = registerData('ui_p1', '{"type":"ui","displayText":"');
S.ui_p2 = registerData('ui_p2', '","ui":{"title":"');
S.ui_sub = registerData('ui_sub', '","subtitle":"');
S.ui_badge = registerData('ui_badge', '","badge":"');
S.ui_bc_green = registerData('ui_bc_green', '","badgeColor":"green","icon":"check","hideText":true,"elements":[');
S.ui_bc_alarm = registerData('ui_bc_alarm', '","badgeColor":"green","icon":"alarm","hideText":true,"elements":[');
S.ui_bc_blue = registerData('ui_bc_blue', '","badgeColor":"blue","icon":"info","hideText":true,"elements":[');
S.ui_bc_red = registerData('ui_bc_red', '","badgeColor":"red","icon":"error","hideText":true,"elements":[');
S.ui_kv_start = registerData('ui_kv_start', '{"type":"key_value","items":[');
S.ui_kv_item1 = registerData('ui_kv_item1', '{"key":"');
S.ui_kv_item2 = registerData('ui_kv_item2', '","value":"');
S.ui_kv_item3 = registerData('ui_kv_item3', '"}');
S.ui_list_start = registerData('ui_list_start', '{"type":"list","items":[');
S.ui_list_item1 = registerData('ui_list_item1', '{"title":"');
S.ui_list_item2 = registerData('ui_list_item2', '","subtitle":"');
S.ui_list_item3 = registerData('ui_list_item3', '"}');
S.ui_text_start = registerData('ui_text_start', '{"type":"text","content":"');
S.ui_text_end = registerData('ui_text_end', '"}');
S.ui_arr_end = registerData('ui_arr_end', ']}');
S.ui_div = registerData('ui_div', ',{"type":"divider"},');
S.ui_btn_p1 = registerData('ui_btn_p1', '{"type":"button_row","buttons":[{"label":"');
S.ui_btn_p2 = registerData('ui_btn_p2', '","action":"command","value":"/calendar","style":"primary"}]}');
S.ui_close = registerData('ui_close', ']}}');
S.direct_p1 = registerData('direct_p1', '{"type":"direct","displayText":"');
S.direct_p2 = registerData('direct_p2', '"}');

// Grounded Direct-Text Templates (verbatim device calendar data — 0% hallucination, 0 extra LLM tokens)
S.t_sod = registerData('t_sod', 'T00:00:00');
S.t_eod = registerData('t_eod', 'T23:59:59');
S.en_ev_hdr1 = registerData('en_ev_hdr1', 'Upcoming calendar events (');
S.en_ev_hdr2 = registerData('en_ev_hdr2', '):');
S.en_ev_for = registerData('en_ev_for', 'Calendar events for ');
S.en_ev_none = registerData('en_ev_none', 'No upcoming events found in your calendar.');
S.en_ev_none_for = registerData('en_ev_none_for', 'No events found for ');
S.en_ev_to = registerData('en_ev_to', ' to ');
S.en_dot_end = registerData('en_dot_end', '.');
S.en_ev_bullet = registerData('en_ev_bullet', '\n- ');
S.en_ev_lp = registerData('en_ev_lp', ' (');
S.en_ev_comma = registerData('en_ev_comma', ', ');
S.en_ev_rp = registerData('en_ev_rp', ')');
S.en_ev_desc = registerData('en_ev_desc', ' - ');
S.en_err_pref = registerData('en_err_pref', 'Calendar error: ');
S.en_upd_ok = registerData('en_upd_ok', 'Event updated (ID: ');
S.en_del_ok = registerData('en_del_ok', 'Event deleted (ID: ');
S.en_id_end = registerData('en_id_end', ').');
S.en_miss_title = registerData('en_miss_title', 'Please provide an event title to schedule it.');
S.en_miss_evid = registerData('en_miss_evid', 'Please provide both eventId and calendarId to update or delete an event.');

const dataLines = dataEntries
  .map((e) => `  (data (i32.const ${e.offset}) "${e.escaped}") ;; ${e.name} (len=${e.strLen})`)
  .join('\n');

const wat = `;; Chattree Official Calendar Plugin (v1.9.2)
;; Single-Source-of-Truth Device Calendar Queries + Zero-Token English Flutter UI Cards
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; 32 pages = 2 MB bounded linear memory (matches maxMemoryPages: 32)
  (memory (export "memory") 32 32)

  ;; ── Static Data Segments ─────────────────────────────────────────────
${dataLines}

  ;; ── Mutable State Globals ────────────────────────────────────────────
  (global $g_state (mut i32) (i32.const 0))
  (global $g_retry (mut i32) (i32.const 0))
  (global $g_op_ok (mut i32) (i32.const 0))
  (global $g_ev_count (mut i32) (i32.const 0))
  (global $g_user_calid (mut i32) (i32.const 0))
  (global $g_is_json (mut i32) (i32.const 0))

  (global $lang_len (mut i32) (i32.const 0))
  (global $act_len (mut i32) (i32.const 0))
  (global $title_len (mut i32) (i32.const 0))
  (global $start_len (mut i32) (i32.const 0))
  (global $end_len (mut i32) (i32.const 0))
  (global $dur_val (mut i32) (i32.const 0))
  (global $desc_len (mut i32) (i32.const 0))
  (global $calid_len (mut i32) (i32.const 0))
  (global $evid_len (mut i32) (i32.const 0))

  (global $ct_len (mut i32) (i32.const 0))
  (global $cs_len (mut i32) (i32.const 0))
  (global $ce_len (mut i32) (i32.const 0))
  (global $cid_len (mut i32) (i32.const 0))
  (global $err_len (mut i32) (i32.const 0))
  (global $fd_len (mut i32) (i32.const 0))
  (global $ft_len (mut i32) (i32.const 0))
  (global $saved_res_len (mut i32) (i32.const 0))
  (global $ai_text_len (mut i32) (i32.const 0))

  ;; Array walker globals
  (global $arr_cursor (mut i32) (i32.const 0))
  (global $arr_obj_start (mut i32) (i32.const 0))
  (global $arr_obj_len (mut i32) (i32.const 0))

  ;; Output cursor
  (global $out_pos (mut i32) (i32.const 65536))

  ;; ── Low-Level Memory & String Helpers ────────────────────────────────

  (func $copy_mem (param $src i32) (param $dst i32) (param $len i32) (result i32)
    (if (i32.gt_s (local.get $len) (i32.const 0))
      (then
        (memory.copy (local.get $dst) (local.get $src) (local.get $len))
        (return (i32.add (local.get $dst) (local.get $len)))
      )
    )
    (local.get $dst)
  )

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

  (func $copy_zstr (param $src i32) (param $dst i32) (result i32)
    (call $copy_mem (local.get $src) (local.get $dst) (call $zlen (local.get $src)))
  )

  (func $is_ws (param $ch i32) (result i32)
    (i32.or
      (i32.or (i32.eq (local.get $ch) (i32.const 32)) (i32.eq (local.get $ch) (i32.const 9)))
      (i32.or (i32.eq (local.get $ch) (i32.const 10)) (i32.eq (local.get $ch) (i32.const 13)))
    )
  )

  (func $to_lower (param $src i32) (param $dst i32) (param $len i32)
    (local $i i32)
    (local $ch i32)
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

  (func $str_eq (param $a i32) (param $a_len i32) (param $b_zstr i32) (result i32)
    (local $b_len i32)
    (local $i i32)
    (if (i32.lt_s (local.get $a_len) (i32.const 0))
      (then (return (i32.const 0)))
    )
    (local.set $b_len (call $zlen (local.get $b_zstr)))
    (if (i32.ne (local.get $a_len) (local.get $b_len))
      (then (return (i32.const 0)))
    )
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.lt_u (local.get $i) (local.get $a_len))
        (then
          (if (i32.ne
                (i32.load8_u (i32.add (local.get $a) (local.get $i)))
                (i32.load8_u (i32.add (local.get $b_zstr) (local.get $i))))
            (then (return (i32.const 0)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (i32.const 1)
  )

  (func $bytes_eq (param $a i32) (param $b i32) (param $len i32) (result i32)
    (local $i i32)
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.lt_s (local.get $i) (local.get $len))
        (then
          (if (i32.ne
                (i32.load8_u (i32.add (local.get $a) (local.get $i)))
                (i32.load8_u (i32.add (local.get $b) (local.get $i))))
            (then (return (i32.const 0)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (i32.const 1)
  )

  (func $find_sub_z (param $hay i32) (param $hlen i32) (param $needle_z i32) (result i32)
    (local $nlen i32)
    (local $i i32)
    (local $j i32)
    (local $m i32)
    (local.set $nlen (call $zlen (local.get $needle_z)))
    (if (i32.le_s (local.get $nlen) (i32.const 0)) (then (return (i32.const -1))))
    (local.set $i (i32.const 0))
    (loop $outer
      (if (i32.gt_s (i32.add (local.get $i) (local.get $nlen)) (local.get $hlen))
        (then (return (i32.const -1)))
      )
      (local.set $j (i32.const 0))
      (local.set $m (i32.const 1))
      (loop $inner
        (if (i32.lt_s (local.get $j) (local.get $nlen))
          (then
            (if (i32.ne
                  (i32.load8_u (i32.add (local.get $hay) (i32.add (local.get $i) (local.get $j))))
                  (i32.load8_u (i32.add (local.get $needle_z) (local.get $j))))
              (then (local.set $m (i32.const 0)))
              (else
                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                (br $inner)
              )
            )
          )
        )
      )
      (if (local.get $m) (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $outer)
    )
    (i32.const -1)
  )

  (func $utf8_clamp (param $ptr i32) (param $len i32) (param $max_bytes i32) (result i32)
    (local $n i32)
    (if (i32.le_s (local.get $len) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $n (local.get $len))
    (if (i32.gt_s (local.get $n) (local.get $max_bytes))
      (then
        (local.set $n (local.get $max_bytes))
        ;; Do not slice inside UTF-8 continuation bytes (10xxxxxx = 0x80..0xBF)
        (loop $back
          (if (i32.and
                (i32.gt_s (local.get $n) (i32.const 0))
                (i32.eq (i32.and (i32.load8_u (i32.add (local.get $ptr) (local.get $n))) (i32.const 192)) (i32.const 128)))
            (then
              (local.set $n (i32.sub (local.get $n) (i32.const 1)))
              (br $back)
            )
          )
        )
      )
    )
    (local.get $n)
  )

  ;; Output helpers writing directly to $out_pos (bounded < 195500)
  (func $out_bytes (param $ptr i32) (param $len i32)
    (local $avail i32)
    (local $n i32)
    (if (i32.le_s (local.get $len) (i32.const 0)) (then (return)))
    (local.set $avail (i32.sub (i32.const 195500) (global.get $out_pos)))
    (if (i32.le_s (local.get $avail) (i32.const 0)) (then (return)))
    (local.set $n (local.get $len))
    (if (i32.gt_s (local.get $n) (local.get $avail))
      (then (local.set $n (local.get $avail)))
    )
    (memory.copy (global.get $out_pos) (local.get $ptr) (local.get $n))
    (global.set $out_pos (i32.add (global.get $out_pos) (local.get $n)))
  )

  (func $out_z (param $ptr i32)
    (call $out_bytes (local.get $ptr) (call $zlen (local.get $ptr)))
  )

  (func $copy_json_esc (param $src i32) (param $len i32) (param $dst i32) (result i32)
    (local $i i32)
    (local $ch i32)
    (local $out i32)
    (local.set $i (i32.const 0))
    (local.set $out (local.get $dst))
    (loop $l
      (if (i32.lt_s (local.get $i) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.eq (local.get $ch) (i32.const 34))
            (then
              (i32.store8 (local.get $out) (i32.const 92))
              (i32.store8 (i32.add (local.get $out) (i32.const 1)) (i32.const 34))
              (local.set $out (i32.add (local.get $out) (i32.const 2)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $l)
            )
          )
          (if (i32.eq (local.get $ch) (i32.const 92))
            (then
              (i32.store8 (local.get $out) (i32.const 92))
              (i32.store8 (i32.add (local.get $out) (i32.const 1)) (i32.const 92))
              (local.set $out (i32.add (local.get $out) (i32.const 2)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $l)
            )
          )
          (if (i32.eq (local.get $ch) (i32.const 10))
            (then
              (i32.store8 (local.get $out) (i32.const 92))
              (i32.store8 (i32.add (local.get $out) (i32.const 1)) (i32.const 110))
              (local.set $out (i32.add (local.get $out) (i32.const 2)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $l)
            )
          )
          (if (i32.eq (local.get $ch) (i32.const 13))
            (then
              (i32.store8 (local.get $out) (i32.const 92))
              (i32.store8 (i32.add (local.get $out) (i32.const 1)) (i32.const 114))
              (local.set $out (i32.add (local.get $out) (i32.const 2)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $l)
            )
          )
          (if (i32.eq (local.get $ch) (i32.const 9))
            (then
              (i32.store8 (local.get $out) (i32.const 92))
              (i32.store8 (i32.add (local.get $out) (i32.const 1)) (i32.const 116))
              (local.set $out (i32.add (local.get $out) (i32.const 2)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $l)
            )
          )
          (if (i32.lt_u (local.get $ch) (i32.const 32))
            (then (local.set $ch (i32.const 32)))
          )
          (i32.store8 (local.get $out) (local.get $ch))
          (local.set $out (i32.add (local.get $out) (i32.const 1)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (local.get $out)
  )

  (func $out_json_esc (param $src i32) (param $len i32) (param $max_raw i32)
    (local $n i32)
    (local $end i32)
    (local.set $n (call $utf8_clamp (local.get $src) (local.get $len) (local.get $max_raw)))
    (if (i32.le_s (local.get $n) (i32.const 0)) (then (return)))
    (if (i32.ge_s (i32.add (global.get $out_pos) (i32.mul (local.get $n) (i32.const 2))) (i32.const 195500))
      (then (return))
    )
    (local.set $end (call $copy_json_esc (local.get $src) (local.get $n) (global.get $out_pos)))
    (global.set $out_pos (local.get $end))
  )

  (func $copy_int_str (param $v i32) (param $dst i32) (result i32)
    (local $n i32)
    (local $p i32)
    (local $rev i32)
    (local $i i32)
    (if (i32.le_s (local.get $v) (i32.const 0))
      (then
        (i32.store8 (local.get $dst) (i32.const 48))
        (return (i32.add (local.get $dst) (i32.const 1)))
      )
    )
    (local.set $n (local.get $v))
    (local.set $rev (i32.const 274900))
    (local.set $i (i32.const 0))
    (loop $d
      (if (i32.gt_s (local.get $n) (i32.const 0))
        (then
          (i32.store8 (i32.add (local.get $rev) (local.get $i)) (i32.add (i32.const 48) (i32.rem_u (local.get $n) (i32.const 10))))
          (local.set $n (i32.div_u (local.get $n) (i32.const 10)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $d)
        )
      )
    )
    (local.set $p (local.get $dst))
    (loop $w
      (if (i32.gt_s (local.get $i) (i32.const 0))
        (then
          (local.set $i (i32.sub (local.get $i) (i32.const 1)))
          (i32.store8 (local.get $p) (i32.load8_u (i32.add (local.get $rev) (local.get $i))))
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (br $w)
        )
      )
    )
    (local.get $p)
  )

  ;; ── JSON Parsers & Unicode Helpers ───────────────────────────────────

  (func $hex_val (param $ch i32) (result i32)
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 48)) (i32.le_u (local.get $ch) (i32.const 57)))
      (then (return (i32.sub (local.get $ch) (i32.const 48))))
    )
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 65)) (i32.le_u (local.get $ch) (i32.const 70)))
      (then (return (i32.sub (local.get $ch) (i32.const 55))))
    )
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 97)) (i32.le_u (local.get $ch) (i32.const 102)))
      (then (return (i32.sub (local.get $ch) (i32.const 87))))
    )
    (i32.const -1)
  )

  (func $write_utf8 (param $cp i32) (param $dst i32) (result i32)
    (if (i32.le_u (local.get $cp) (i32.const 127))
      (then
        (i32.store8 (local.get $dst) (local.get $cp))
        (return (i32.add (local.get $dst) (i32.const 1)))
      )
    )
    (if (i32.le_u (local.get $cp) (i32.const 2047))
      (then
        (i32.store8 (local.get $dst) (i32.or (i32.const 192) (i32.shr_u (local.get $cp) (i32.const 6))))
        (i32.store8 (i32.add (local.get $dst) (i32.const 1)) (i32.or (i32.const 128) (i32.and (local.get $cp) (i32.const 63))))
        (return (i32.add (local.get $dst) (i32.const 2)))
      )
    )
    (if (i32.le_u (local.get $cp) (i32.const 65535))
      (then
        (i32.store8 (local.get $dst) (i32.or (i32.const 224) (i32.shr_u (local.get $cp) (i32.const 12))))
        (i32.store8 (i32.add (local.get $dst) (i32.const 1)) (i32.or (i32.const 128) (i32.and (i32.shr_u (local.get $cp) (i32.const 6)) (i32.const 63))))
        (i32.store8 (i32.add (local.get $dst) (i32.const 2)) (i32.or (i32.const 128) (i32.and (local.get $cp) (i32.const 63))))
        (return (i32.add (local.get $dst) (i32.const 3)))
      )
    )
    ;; 4-byte supplementary plane UTF-8
    (i32.store8 (local.get $dst) (i32.or (i32.const 240) (i32.shr_u (local.get $cp) (i32.const 18))))
    (i32.store8 (i32.add (local.get $dst) (i32.const 1)) (i32.or (i32.const 128) (i32.and (i32.shr_u (local.get $cp) (i32.const 12)) (i32.const 63))))
    (i32.store8 (i32.add (local.get $dst) (i32.const 2)) (i32.or (i32.const 128) (i32.and (i32.shr_u (local.get $cp) (i32.const 6)) (i32.const 63))))
    (i32.store8 (i32.add (local.get $dst) (i32.const 3)) (i32.or (i32.const 128) (i32.and (local.get $cp) (i32.const 63))))
    (i32.add (local.get $dst) (i32.const 4))
  )

  (func $is_unescaped_quote (param $buf i32) (param $idx i32) (result i32)
    (local $bs i32)
    (local $k i32)
    (local.set $bs (i32.const 0))
    (local.set $k (local.get $idx))
    (loop $l
      (if (i32.gt_s (local.get $k) (i32.const 0))
        (then
          (local.set $k (i32.sub (local.get $k) (i32.const 1)))
          (if (i32.eq (i32.load8_u (i32.add (local.get $buf) (local.get $k))) (i32.const 92))
            (then
              (local.set $bs (i32.add (local.get $bs) (i32.const 1)))
              (br $l)
            )
          )
        )
      )
    )
    (i32.eqz (i32.and (local.get $bs) (i32.const 1)))
  )

  ;; Returns index of value start (after '"key" : ') or -1 if not found
  (func $find_json_val_pos (param $json i32) (param $jlen i32) (param $key_zstr i32) (result i32)
    (local $klen i32)
    (local $i i32)
    (local $j i32)
    (local $match i32)
    (local $pos i32)
    (local.set $klen (call $zlen (local.get $key_zstr)))
    (local.set $i (i32.const 0))
    (loop $scan
      (if (i32.gt_s (i32.add (local.get $i) (i32.add (local.get $klen) (i32.const 3))) (local.get $jlen))
        (then (return (i32.const -1)))
      )
      (if (i32.and
            (i32.eq (i32.load8_u (i32.add (local.get $json) (local.get $i))) (i32.const 34))
            (i32.eq (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $i) (i32.add (local.get $klen) (i32.const 1))))) (i32.const 34)))
        (then
          (if (call $is_unescaped_quote (local.get $json) (local.get $i))
            (then
              (local.set $j (i32.const 0))
              (local.set $match (i32.const 1))
              (loop $cmp
                (if (i32.lt_s (local.get $j) (local.get $klen))
                  (then
                    (if (i32.ne
                          (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $i) (i32.add (local.get $j) (i32.const 1)))))
                          (i32.load8_u (i32.add (local.get $key_zstr) (local.get $j))))
                      (then (local.set $match (i32.const 0)))
                      (else
                        (local.set $j (i32.add (local.get $j) (i32.const 1)))
                        (br $cmp)
                      )
                    )
                  )
                )
              )
              (if (local.get $match)
                (then
                  (local.set $pos (i32.add (local.get $i) (i32.add (local.get $klen) (i32.const 2))))
                  (loop $ws1
                    (if (i32.and (i32.lt_s (local.get $pos) (local.get $jlen))
                                 (call $is_ws (i32.load8_u (i32.add (local.get $json) (local.get $pos)))))
                      (then (local.set $pos (i32.add (local.get $pos) (i32.const 1))) (br $ws1))
                    )
                  )
                  (if (i32.and (i32.lt_s (local.get $pos) (local.get $jlen))
                               (i32.eq (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 58)))
                    (then
                      (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
                      (loop $ws2
                        (if (i32.and (i32.lt_s (local.get $pos) (local.get $jlen))
                                     (call $is_ws (i32.load8_u (i32.add (local.get $json) (local.get $pos)))))
                          (then (local.set $pos (i32.add (local.get $pos) (i32.const 1))) (br $ws2))
                        )
                      )
                      (if (i32.lt_s (local.get $pos) (local.get $jlen))
                        (then (return (local.get $pos)))
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
      (br $scan)
    )
    (i32.const -1)
  )

  ;; Extract string JSON field; returns byte length >= 0 or -1 if missing/non-string
  (func $extract_json_str (param $json i32) (param $jlen i32) (param $key_zstr i32) (param $dst i32) (param $max_out i32) (result i32)
    (local $pos i32)
    (local $out i32)
    (local $ch i32)
    (local $esc i32)
    (local $d0 i32) (local $d1 i32) (local $d2 i32) (local $d3 i32)
    (local $cp i32)
    (local $lo i32)
    (local.set $pos (call $find_json_val_pos (local.get $json) (local.get $jlen) (local.get $key_zstr)))
    (if (i32.lt_s (local.get $pos) (i32.const 0)) (then (return (i32.const -1))))
    (if (i32.ne (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 34))
      (then (return (i32.const -1)))
    )
    (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
    (local.set $out (local.get $dst))
    (loop $read
      (if (i32.and (i32.lt_s (local.get $pos) (local.get $jlen))
                   (i32.lt_s (i32.sub (local.get $out) (local.get $dst)) (local.get $max_out)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
          (if (i32.eq (local.get $ch) (i32.const 34))
            (then (return (i32.sub (local.get $out) (local.get $dst))))
          )
          (if (i32.eq (local.get $ch) (i32.const 92))
            (then
              (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
              (if (i32.ge_s (local.get $pos) (local.get $jlen))
                (then (return (i32.sub (local.get $out) (local.get $dst))))
              )
              (local.set $esc (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
              (if (i32.eq (local.get $esc) (i32.const 110))
                (then
                  (i32.store8 (local.get $out) (i32.const 10))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
                  (br $read)
                )
              )
              (if (i32.eq (local.get $esc) (i32.const 114))
                (then
                  (i32.store8 (local.get $out) (i32.const 13))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
                  (br $read)
                )
              )
              (if (i32.eq (local.get $esc) (i32.const 116))
                (then
                  (i32.store8 (local.get $out) (i32.const 9))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
                  (br $read)
                )
              )
              (if (i32.and (i32.eq (local.get $esc) (i32.const 117))
                           (i32.le_s (i32.add (local.get $pos) (i32.const 4)) (i32.sub (local.get $jlen) (i32.const 1))))
                (then
                  (local.set $d0 (call $hex_val (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 1))))))
                  (local.set $d1 (call $hex_val (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 2))))))
                  (local.set $d2 (call $hex_val (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 3))))))
                  (local.set $d3 (call $hex_val (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 4))))))
                  (if (i32.and
                        (i32.and (i32.ge_s (local.get $d0) (i32.const 0)) (i32.ge_s (local.get $d1) (i32.const 0)))
                        (i32.and (i32.ge_s (local.get $d2) (i32.const 0)) (i32.ge_s (local.get $d3) (i32.const 0))))
                    (then
                      (local.set $cp
                        (i32.or
                          (i32.or (i32.shl (local.get $d0) (i32.const 12)) (i32.shl (local.get $d1) (i32.const 8)))
                          (i32.or (i32.shl (local.get $d2) (i32.const 4)) (local.get $d3))))
                      ;; Check surrogate pair: high (0xD800..0xDBFF) + \\uXXXX low (0xDC00..0xDFFF)
                      (if (i32.and (i32.ge_u (local.get $cp) (i32.const 55296)) (i32.le_u (local.get $cp) (i32.const 56319)))
                        (then
                          (if (i32.and
                                (i32.le_s (i32.add (local.get $pos) (i32.const 10)) (i32.sub (local.get $jlen) (i32.const 1)))
                                (i32.and
                                  (i32.eq (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 5)))) (i32.const 92))
                                  (i32.eq (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 6)))) (i32.const 117))))
                            (then
                              (local.set $d0 (call $hex_val (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 7))))))
                              (local.set $d1 (call $hex_val (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 8))))))
                              (local.set $d2 (call $hex_val (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 9))))))
                              (local.set $d3 (call $hex_val (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 10))))))
                              (if (i32.and
                                    (i32.and (i32.ge_s (local.get $d0) (i32.const 0)) (i32.ge_s (local.get $d1) (i32.const 0)))
                                    (i32.and (i32.ge_s (local.get $d2) (i32.const 0)) (i32.ge_s (local.get $d3) (i32.const 0))))
                                (then
                                  (local.set $lo
                                    (i32.or
                                      (i32.or (i32.shl (local.get $d0) (i32.const 12)) (i32.shl (local.get $d1) (i32.const 8)))
                                      (i32.or (i32.shl (local.get $d2) (i32.const 4)) (local.get $d3))))
                                  (if (i32.and (i32.ge_u (local.get $lo) (i32.const 56320)) (i32.le_u (local.get $lo) (i32.const 57343)))
                                    (then
                                      (local.set $cp (i32.add (i32.const 65536)
                                        (i32.add
                                          (i32.shl (i32.sub (local.get $cp) (i32.const 55296)) (i32.const 10))
                                          (i32.sub (local.get $lo) (i32.const 56320)))))
                                      (local.set $out (call $write_utf8 (local.get $cp) (local.get $out)))
                                      (local.set $pos (i32.add (local.get $pos) (i32.const 11)))
                                      (br $read)
                                    )
                                  )
                                )
                              )
                            )
                          )
                          (local.set $pos (i32.add (local.get $pos) (i32.const 5)))
                          (br $read)
                        )
                      )
                      (if (i32.and (i32.ge_u (local.get $cp) (i32.const 56320)) (i32.le_u (local.get $cp) (i32.const 57343)))
                        (then
                          (local.set $pos (i32.add (local.get $pos) (i32.const 5)))
                          (br $read)
                        )
                      )
                      (local.set $out (call $write_utf8 (local.get $cp) (local.get $out)))
                      (local.set $pos (i32.add (local.get $pos) (i32.const 5)))
                      (br $read)
                    )
                  )
                )
              )
              (i32.store8 (local.get $out) (local.get $esc))
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

  ;; Returns 1 if "key":true, 0 if "key":false, -1 otherwise
  (func $extract_json_bool (param $json i32) (param $jlen i32) (param $key_zstr i32) (result i32)
    (local $pos i32)
    (local.set $pos (call $find_json_val_pos (local.get $json) (local.get $jlen) (local.get $key_zstr)))
    (if (i32.lt_s (local.get $pos) (i32.const 0)) (then (return (i32.const -1))))
    (if (i32.le_s (i32.add (local.get $pos) (i32.const 4)) (local.get $jlen))
      (then
        (if (i32.and
              (i32.and (i32.eq (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 116))
                       (i32.eq (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 1)))) (i32.const 114)))
              (i32.and (i32.eq (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 2)))) (i32.const 117))
                       (i32.eq (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 3)))) (i32.const 101))))
          (then (return (i32.const 1)))
        )
      )
    )
    (if (i32.le_s (i32.add (local.get $pos) (i32.const 5)) (local.get $jlen))
      (then
        (if (i32.and
              (i32.and (i32.eq (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 102))
                       (i32.eq (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 1)))) (i32.const 97)))
              (i32.and
                (i32.eq (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 2)))) (i32.const 108))
                (i32.and (i32.eq (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 3)))) (i32.const 115))
                         (i32.eq (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 4)))) (i32.const 101)))))
          (then (return (i32.const 0)))
        )
      )
    )
    (i32.const -1)
  )

  ;; Extract positive integer JSON value (literal or quoted string); -1 if absent
  (func $extract_json_int (param $json i32) (param $jlen i32) (param $key_zstr i32) (result i32)
    (local $pos i32)
    (local $ch i32)
    (local $val i32)
    (local $digits i32)
    (local.set $pos (call $find_json_val_pos (local.get $json) (local.get $jlen) (local.get $key_zstr)))
    (if (i32.lt_s (local.get $pos) (i32.const 0)) (then (return (i32.const -1))))
    (if (i32.eq (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 34))
      (then (local.set $pos (i32.add (local.get $pos) (i32.const 1))))
    )
    (local.set $val (i32.const 0))
    (local.set $digits (i32.const 0))
    (loop $d
      (if (i32.lt_s (local.get $pos) (local.get $jlen))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 48)) (i32.le_u (local.get $ch) (i32.const 57)))
            (then
              (local.set $val (i32.add (i32.mul (local.get $val) (i32.const 10)) (i32.sub (local.get $ch) (i32.const 48))))
              (local.set $digits (i32.add (local.get $digits) (i32.const 1)))
              (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
              (br $d)
            )
          )
        )
      )
    )
    (if (i32.eqz (local.get $digits)) (then (return (i32.const -1))))
    (local.get $val)
  )

  ;; JSON Object Array Walker
  ;; Sets $arr_cursor past '[' and returns 1 if array found, 0 otherwise
  (func $find_array_start (param $json i32) (param $jlen i32) (param $key_zstr i32) (result i32)
    (local $pos i32)
    (local.set $pos (call $find_json_val_pos (local.get $json) (local.get $jlen) (local.get $key_zstr)))
    (if (i32.lt_s (local.get $pos) (i32.const 0)) (then (return (i32.const 0))))
    (if (i32.ne (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 91)) ;; '['
      (then (return (i32.const 0)))
    )
    (global.set $arr_cursor (i32.add (local.get $pos) (i32.const 1)))
    (i32.const 1)
  )

  ;; Advances $arr_cursor across the next {...} object inside array in $json
  ;; Sets $arr_obj_start (absolute address) and $arr_obj_len; returns 1 or 0
  (func $next_array_obj (param $json i32) (param $jlen i32) (result i32)
    (local $pos i32)
    (local $ch i32)
    (local $depth i32)
    (local $in_str i32)
    (local $esc i32)
    (local $start i32)
    (local.set $pos (global.get $arr_cursor))
    (loop $skip
      (if (i32.ge_s (local.get $pos) (local.get $jlen)) (then (return (i32.const 0))))
      (local.set $ch (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
      (if (i32.or (call $is_ws (local.get $ch)) (i32.eq (local.get $ch) (i32.const 44)))
        (then
          (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
          (br $skip)
        )
      )
    )
    (if (i32.ne (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 123)) ;; '{'
      (then (return (i32.const 0)))
    )
    (local.set $start (local.get $pos))
    (local.set $depth (i32.const 0))
    (local.set $in_str (i32.const 0))
    (local.set $esc (i32.const 0))
    (loop $walk
      (if (i32.ge_s (local.get $pos) (local.get $jlen)) (then (return (i32.const 0))))
      (local.set $ch (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
      (if (local.get $in_str)
        (then
          (if (local.get $esc)
            (then (local.set $esc (i32.const 0)))
            (else
              (if (i32.eq (local.get $ch) (i32.const 92))
                (then (local.set $esc (i32.const 1)))
                (else
                  (if (i32.eq (local.get $ch) (i32.const 34))
                    (then (local.set $in_str (i32.const 0)))
                  )
                )
              )
            )
          )
        )
        (else
          (if (i32.eq (local.get $ch) (i32.const 34))
            (then (local.set $in_str (i32.const 1)))
            (else
              (if (i32.eq (local.get $ch) (i32.const 123))
                (then (local.set $depth (i32.add (local.get $depth) (i32.const 1))))
                (else
                  (if (i32.eq (local.get $ch) (i32.const 125))
                    (then
                      (local.set $depth (i32.sub (local.get $depth) (i32.const 1)))
                      (if (i32.eqz (local.get $depth))
                        (then
                          (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
                          (global.set $arr_obj_start (i32.add (local.get $json) (local.get $start)))
                          (global.set $arr_obj_len (i32.sub (local.get $pos) (local.get $start)))
                          (global.set $arr_cursor (local.get $pos))
                          (return (i32.const 1))
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
      (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
      (br $walk)
    )
    (i32.const 0)
  )

  ;; ── Date / Time Formatter ────────────────────────────────────────────
  ;; Populates $FMT_DATE (281500, $fd_len) and $FMT_TIME (281550, $ft_len)
  (func $format_dt (param $s_ptr i32) (param $s_len i32) (param $e_ptr i32) (param $e_len i32) (param $allday i32) (param $ad_ptr i32) (param $ad_len i32)
    (local $p i32)
    (global.set $fd_len (i32.const 0))
    (global.set $ft_len (i32.const 0))
    (if (i32.le_s (local.get $s_len) (i32.const 0)) (then (return)))
    (if (i32.ge_s (local.get $s_len) (i32.const 10))
      (then
        (memory.copy (i32.const 281500) (local.get $s_ptr) (i32.const 10))
        (global.set $fd_len (i32.const 10))
        (if (i32.eq (local.get $allday) (i32.const 1))
          (then
            (if (i32.gt_s (local.get $ad_len) (i32.const 0))
              (then
                (memory.copy (i32.const 281550) (local.get $ad_ptr) (local.get $ad_len))
                (global.set $ft_len (local.get $ad_len))
              )
              (else
                (memory.copy (i32.const 281550) (i32.const ${S.en_all_day.offset}) (i32.const ${S.en_all_day.len}))
                (global.set $ft_len (i32.const ${S.en_all_day.len}))
              )
            )
            (return)
          )
        )
        (if (i32.ge_s (local.get $s_len) (i32.const 16))
          (then
            (local.set $p (i32.const 281550))
            (memory.copy (local.get $p) (i32.add (local.get $s_ptr) (i32.const 11)) (i32.const 5))
            (local.set $p (i32.add (local.get $p) (i32.const 5)))
            (if (i32.ge_s (local.get $e_len) (i32.const 16))
              (then
                (memory.copy (local.get $p) (i32.const ${S.def_sep_dash.offset}) (i32.const ${S.def_sep_dash.len}))
                (local.set $p (i32.add (local.get $p) (i32.const ${S.def_sep_dash.len})))
                (if (i32.eqz (call $bytes_eq (local.get $s_ptr) (local.get $e_ptr) (i32.const 10)))
                  (then
                    (memory.copy (local.get $p) (local.get $e_ptr) (i32.const 10))
                    (local.set $p (i32.add (local.get $p) (i32.const 10)))
                    (i32.store8 (local.get $p) (i32.const 32))
                    (local.set $p (i32.add (local.get $p) (i32.const 1)))
                  )
                )
                (memory.copy (local.get $p) (i32.add (local.get $e_ptr) (i32.const 11)) (i32.const 5))
                (local.set $p (i32.add (local.get $p) (i32.const 5)))
              )
            )
            (global.set $ft_len (i32.sub (local.get $p) (i32.const 281550)))
          )
        )
      )
      (else
        (memory.copy (i32.const 281500) (local.get $s_ptr) (local.get $s_len))
        (global.set $fd_len (local.get $s_len))
      )
    )
  )

  ;; ── Host Dispatch Helpers ────────────────────────────────────────────

  (func $is_perm_denied (param $res_ptr i32) (param $res_len i32) (result i32)
    (call $to_lower (local.get $res_ptr) (i32.const 282000) (local.get $res_len))
    (i32.or
      (i32.ge_s (call $find_sub_z (i32.const 282000) (local.get $res_len) (i32.const ${S.sub_denied1.offset})) (i32.const 0))
      (i32.ge_s (call $find_sub_z (i32.const 282000) (local.get $res_len) (i32.const ${S.sub_denied2.offset})) (i32.const 0))
    )
  )

  (func $set_default_lang
    (memory.copy (i32.const 270000) (i32.const ${S.def_en.offset}) (i32.const ${S.def_en.len}))
    (global.set $lang_len (i32.const ${S.def_en.len}))
  )

  ;; Extract and strip lang=<code> from plain text input; returns new length
  (func $strip_lang_token (param $ptr i32) (param $len i32) (result i32)
    (local $i i32)
    (local $new_len i32)
    (local $tok_len i32)
    (local $ws_idx i32)
    (call $set_default_lang)
    (if (i32.le_s (local.get $len) (i32.const 0)) (then (return (i32.const 0))))
    ;; Case 1: entire string starts with "lang=" and has no whitespace
    (if (i32.ge_s (local.get $len) (i32.const 6))
      (then
        (if (call $bytes_eq (local.get $ptr) (i32.const ${S.k_lang_eq.offset}) (i32.const 5))
          (then
            (local.set $i (i32.const 5))
            (loop $chk_ws
              (if (i32.and (i32.lt_s (local.get $i) (local.get $len))
                           (i32.eqz (call $is_ws (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))))
                (then (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $chk_ws))
              )
            )
            (if (i32.eq (local.get $i) (local.get $len))
              (then
                (local.set $tok_len (i32.sub (local.get $len) (i32.const 5)))
                (if (i32.gt_s (local.get $tok_len) (i32.const 24)) (then (local.set $tok_len (i32.const 24))))
                (memory.copy (i32.const 270000) (i32.add (local.get $ptr) (i32.const 5)) (local.get $tok_len))
                (global.set $lang_len (local.get $tok_len))
                (return (i32.const 0))
              )
            )
          )
        )
      )
    )
    ;; Case 2: find last whitespace, check if trailing token starts with "lang="
    (local.set $i (local.get $len))
    (local.set $ws_idx (i32.const -1))
    (loop $find_last_ws
      (if (i32.gt_s (local.get $i) (i32.const 0))
        (then
          (local.set $i (i32.sub (local.get $i) (i32.const 1)))
          (if (call $is_ws (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))
            (then (local.set $ws_idx (local.get $i)))
            (else (br $find_last_ws))
          )
        )
      )
    )
    (if (i32.ge_s (local.get $ws_idx) (i32.const 0))
      (then
        (local.set $tok_len (i32.sub (local.get $len) (i32.add (local.get $ws_idx) (i32.const 1))))
        (if (i32.ge_s (local.get $tok_len) (i32.const 6))
          (then
            (if (call $bytes_eq (i32.add (local.get $ptr) (i32.add (local.get $ws_idx) (i32.const 1)))
                              (i32.const ${S.k_lang_eq.offset}) (i32.const 5))
              (then
                (local.set $tok_len (i32.sub (local.get $tok_len) (i32.const 5)))
                (if (i32.gt_s (local.get $tok_len) (i32.const 24)) (then (local.set $tok_len (i32.const 24))))
                (memory.copy (i32.const 270000)
                  (i32.add (local.get $ptr) (i32.add (local.get $ws_idx) (i32.const 6)))
                  (local.get $tok_len))
                (global.set $lang_len (local.get $tok_len))
                (local.set $new_len (local.get $ws_idx))
                (loop $rtrim2
                  (if (i32.and (i32.gt_s (local.get $new_len) (i32.const 0))
                               (call $is_ws (i32.load8_u (i32.add (local.get $ptr) (i32.sub (local.get $new_len) (i32.const 1))))))
                    (then (local.set $new_len (i32.sub (local.get $new_len) (i32.const 1))) (br $rtrim2))
                  )
                )
                (return (local.get $new_len))
              )
            )
          )
        )
      )
    )
    (local.get $len)
  )

  ;; Dispatch host_call and handle non-zero return cleanly
  (func $dispatch_host (param $req_len i32) (result i32)
    (local $rc i32)
    (local.set $rc (call $host_call (i32.const 400000) (local.get $req_len) (i32.const 600000) (i32.const 390000)))
    (if (i32.eqz (local.get $rc)) (then (return (i32.const 0))))
    (if (i32.gt_s (local.get $rc) (i32.const 0))
      (then (return (call $handle_resume (i32.const 600000) (local.get $rc))))
    )
    ;; host_call returned -1; write safe empty error state & emit fallback UI
    (global.set $g_op_ok (i32.const 0))
    (global.set $saved_res_len (i32.const 0))
    (call $render_fallback_for_state)
  )

  (func $start_calendars_warmup (result i32)
    (local $len i32)
    (global.set $g_state (i32.const 10))
    (local.set $len (call $zlen (i32.const ${S.req_calendars.offset})))
    (memory.copy (i32.const 400000) (i32.const ${S.req_calendars.offset}) (local.get $len))
    (call $dispatch_host (local.get $len))
  )

  (func $start_create_call (result i32)
    (local $p i32)
    (global.set $g_state (i32.const 11))
    (local.set $p (call $copy_zstr (i32.const ${S.req_create_p.offset}) (i32.const 400000)))
    (local.set $p (call $copy_json_esc (i32.const 270150) (global.get $title_len) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
    (if (i32.gt_s (global.get $calid_len) (i32.const 0))
      (then
        (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_calid.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 273000) (global.get $calid_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
      )
    )
    (if (i32.gt_s (global.get $start_len) (i32.const 0))
      (then
        (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_start.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 270700) (global.get $start_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_startDate.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 270700) (global.get $start_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
      )
    )
    (if (i32.gt_s (global.get $end_len) (i32.const 0))
      (then
        (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_end.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 270800) (global.get $end_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_endDate.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 270800) (global.get $end_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
      )
    )
    (if (i32.gt_s (global.get $dur_val) (i32.const 0))
      (then
        (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_durMin.offset}) (local.get $p)))
        (local.set $p (call $copy_int_str (global.get $dur_val) (local.get $p)))
      )
    )
    (if (i32.gt_s (global.get $desc_len) (i32.const 0))
      (then
        (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_desc.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 270900) (global.get $desc_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
      )
    )
    (local.set $p (call $copy_zstr (i32.const ${S.req_end.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 400000)))
  )

  (func $start_events_warmup (result i32)
    (local $len i32)
    (if (global.get $g_user_calid)
      (then (return (call $start_events_call)))
    )
    (global.set $g_state (i32.const 9))
    (local.set $len (call $zlen (i32.const ${S.req_calendars.offset})))
    (memory.copy (i32.const 400000) (i32.const ${S.req_calendars.offset}) (local.get $len))
    (call $dispatch_host (local.get $len))
  )

  (func $start_events_call (result i32)
    (local $p i32)
    (local $has_field i32)
    (global.set $g_state (i32.const 12))
    ;; Normalize date-only / start-only queries to exact day bounds (prevent +30d spillover!)
    (if (i32.eq (global.get $start_len) (i32.const 10))
      (then
        (memory.copy (i32.const 270710) (i32.const ${S.t_sod.offset}) (i32.const 9))
        (global.set $start_len (i32.const 19))
      )
    )
    (if (i32.eq (global.get $end_len) (i32.const 10))
      (then
        (memory.copy (i32.const 270810) (i32.const ${S.t_eod.offset}) (i32.const 9))
        (global.set $end_len (i32.const 19))
      )
    )
    (if (i32.and (i32.ge_s (global.get $start_len) (i32.const 10)) (i32.le_s (global.get $end_len) (i32.const 0)))
      (then
        (memory.copy (i32.const 270800) (i32.const 270700) (i32.const 10))
        (memory.copy (i32.const 270810) (i32.const ${S.t_eod.offset}) (i32.const 9))
        (global.set $end_len (i32.const 19))
      )
    )
    (local.set $has_field (i32.const 0))
    (local.set $p (call $copy_zstr (i32.const ${S.req_events_p.offset}) (i32.const 400000)))
    (if (i32.gt_s (global.get $calid_len) (i32.const 0))
      (then
        (local.set $p (call $copy_zstr (i32.const ${S.jf_calid.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 273000) (global.get $calid_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
        (local.set $has_field (i32.const 1))
      )
    )
    (if (i32.gt_s (global.get $start_len) (i32.const 0))
      (then
        (if (local.get $has_field) (then (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_startDate.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 270700) (global.get $start_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
        (local.set $has_field (i32.const 1))
      )
    )
    (if (i32.gt_s (global.get $end_len) (i32.const 0))
      (then
        (if (local.get $has_field) (then (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_endDate.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 270800) (global.get $end_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
      )
    )
    (local.set $p (call $copy_zstr (i32.const ${S.req_end.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 400000)))
  )

  (func $start_update_call (result i32)
    (local $p i32)
    (global.set $g_state (i32.const 13))
    (local.set $p (call $copy_zstr (i32.const ${S.req_update_p.offset}) (i32.const 400000)))
    (local.set $p (call $copy_json_esc (i32.const 273300) (global.get $evid_len) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_calid.offset}) (local.get $p)))
    (local.set $p (call $copy_json_esc (i32.const 273000) (global.get $calid_len) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
    (if (i32.gt_s (global.get $title_len) (i32.const 0))
      (then
        (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_title.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 270150) (global.get $title_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
      )
    )
    (if (i32.gt_s (global.get $start_len) (i32.const 0))
      (then
        (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_start.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 270700) (global.get $start_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
      )
    )
    (if (i32.gt_s (global.get $end_len) (i32.const 0))
      (then
        (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_end.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 270800) (global.get $end_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
      )
    )
    (if (i32.gt_s (global.get $desc_len) (i32.const 0))
      (then
        (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_desc.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 270900) (global.get $desc_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
      )
    )
    (local.set $p (call $copy_zstr (i32.const ${S.req_end.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 400000)))
  )

  (func $start_delete_call (result i32)
    (local $p i32)
    (global.set $g_state (i32.const 14))
    (local.set $p (call $copy_zstr (i32.const ${S.req_delete_p.offset}) (i32.const 400000)))
    (local.set $p (call $copy_json_esc (i32.const 273300) (global.get $evid_len) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_calid.offset}) (local.get $p)))
    (local.set $p (call $copy_json_esc (i32.const 273000) (global.get $calid_len) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.req_end.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 400000)))
  )

  ;; ── Compact AI Help Dispatcher (direct /calendar help ONLY) ──────────

  (func $call_ai_help (param $r_ptr i32) (param $r_len i32) (result i32)
    (local $p i32)
    (global.set $g_state (i32.const 25))
    (local.set $p (call $copy_zstr (i32.const ${S.ai_help_p1.offset}) (i32.const 400000)))
    (local.set $p (call $copy_json_esc (i32.const 270000) (global.get $lang_len) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.ai_help_p2.offset}) (local.get $p)))
    (local.set $p (call $copy_json_esc (local.get $r_ptr) (local.get $r_len) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.ai_help_p3.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 400000)))
  )

  ;; ── Zero-Token English Flutter UI Card Renderers ─────────────────────

  (func $emit_kv_item (param $k_ptr i32) (param $k_len i32) (param $v_ptr i32) (param $v_len i32) (param $first i32)
    (if (i32.eqz (local.get $first)) (then (call $out_z (i32.const ${S.jf_comma.offset}))))
    (call $out_z (i32.const ${S.ui_kv_item1.offset}))
    (call $out_json_esc (local.get $k_ptr) (local.get $k_len) (i32.const 48))
    (call $out_z (i32.const ${S.ui_kv_item2.offset}))
    (call $out_json_esc (local.get $v_ptr) (local.get $v_len) (i32.const 190))
    (call $out_z (i32.const ${S.ui_kv_item3.offset}))
  )

  (func $emit_ui_header (param $disp_p i32) (param $disp_l i32) (param $title_p i32) (param $title_l i32) (param $sub_p i32) (param $sub_l i32) (param $badge_p i32) (param $badge_l i32) (param $style_z i32)
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.ui_p1.offset}))
    (call $out_json_esc (local.get $disp_p) (local.get $disp_l) (i32.const 300))
    (call $out_z (i32.const ${S.ui_p2.offset}))
    (call $out_json_esc (local.get $title_p) (local.get $title_l) (i32.const 95))
    (if (i32.gt_s (local.get $sub_l) (i32.const 0))
      (then
        (call $out_z (i32.const ${S.ui_sub.offset}))
        (call $out_json_esc (local.get $sub_p) (local.get $sub_l) (i32.const 180))
      )
    )
    (call $out_z (i32.const ${S.ui_badge.offset}))
    (call $out_json_esc (local.get $badge_p) (local.get $badge_l) (i32.const 28))
    (call $out_z (local.get $style_z))
  )

  (func $emit_ui_btn_footer (param $lbl_p i32) (param $lbl_l i32)
    (call $out_z (i32.const ${S.ui_div.offset}))
    (call $out_z (i32.const ${S.ui_btn_p1.offset}))
    (call $out_json_esc (local.get $lbl_p) (local.get $lbl_l) (i32.const 38))
    (call $out_z (i32.const ${S.ui_btn_p2.offset}))
    (call $out_z (i32.const ${S.ui_close.offset}))
  )

  ;; Render Event Creation Card (0 AI tokens)
  (func $render_create_ui (result i32)
    (local $has_kv i32)
    (if (global.get $g_op_ok)
      (then
        (call $emit_ui_header
          (i32.const ${S.en_sched_disp.offset}) (i32.const ${S.en_sched_disp.len})
          (i32.const ${S.en_sched_title.offset}) (i32.const ${S.en_sched_title.len})
          (i32.const 273600) (global.get $ct_len)
          (i32.const ${S.en_created_badge.offset}) (i32.const ${S.en_created_badge.len})
          (i32.const ${S.ui_bc_green.offset}))
        (call $format_dt (i32.const 274200) (global.get $cs_len) (i32.const 274300) (global.get $ce_len) (i32.const 0) (i32.const 0) (i32.const 0))
        (call $out_z (i32.const ${S.ui_kv_start.offset}))
        (local.set $has_kv (i32.const 0))
        (if (i32.gt_s (global.get $ct_len) (i32.const 0))
          (then
            (call $emit_kv_item (i32.const ${S.en_lbl_title.offset}) (i32.const ${S.en_lbl_title.len}) (i32.const 273600) (global.get $ct_len) (i32.const 1))
            (local.set $has_kv (i32.const 1))
          )
        )
        (if (i32.gt_s (global.get $fd_len) (i32.const 0))
          (then
            (call $emit_kv_item (i32.const ${S.en_lbl_date.offset}) (i32.const ${S.en_lbl_date.len}) (i32.const 281500) (global.get $fd_len) (i32.eqz (local.get $has_kv)))
            (local.set $has_kv (i32.const 1))
          )
        )
        (if (i32.gt_s (global.get $ft_len) (i32.const 0))
          (then
            (call $emit_kv_item (i32.const ${S.en_lbl_time.offset}) (i32.const ${S.en_lbl_time.len}) (i32.const 281550) (global.get $ft_len) (i32.eqz (local.get $has_kv)))
            (local.set $has_kv (i32.const 1))
          )
        )
        (if (i32.gt_s (global.get $desc_len) (i32.const 0))
          (then
            (call $emit_kv_item (i32.const ${S.en_lbl_desc.offset}) (i32.const ${S.en_lbl_desc.len}) (i32.const 270900) (global.get $desc_len) (i32.eqz (local.get $has_kv)))
          )
        )
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
        (call $emit_ui_btn_footer (i32.const ${S.en_btn_view.offset}) (i32.const ${S.en_btn_view.len}))
      )
      (else
        (call $emit_ui_header
          (i32.const ${S.en_cal_err.offset}) (i32.const ${S.en_cal_err.len})
          (i32.const ${S.en_cal_err.offset}) (i32.const ${S.en_cal_err.len})
          (i32.const 273600) (global.get $ct_len)
          (i32.const ${S.en_error_badge.offset}) (i32.const ${S.en_error_badge.len})
          (i32.const ${S.ui_bc_red.offset}))
        (call $out_z (i32.const ${S.ui_text_start.offset}))
        (if (i32.gt_s (global.get $err_len) (i32.const 0))
          (then (call $out_json_esc (i32.const 280400) (global.get $err_len) (i32.const 900)))
          (else (call $out_json_esc (i32.const ${S.en_err_fallback.offset}) (i32.const ${S.en_err_fallback.len}) (i32.const 900)))
        )
        (call $out_z (i32.const ${S.ui_text_end.offset}))
        (call $emit_ui_btn_footer (i32.const ${S.en_btn_retry.offset}) (i32.const ${S.en_btn_retry.len}))
      )
    )
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  ;; Render Upcoming Events Card for bare /calendar (0 AI tokens)
  (func $render_events_ui (result i32)
    (local $count i32)
    (local $tl i32)
    (local $sl i32)
    (local $el i32)
    (local $dl i32)
    (local $ad i32)
    (local $sub_p i32)
    (local $b_end i32)

    (if (i32.eqz (global.get $g_op_ok))
      (then
        (call $emit_ui_header
          (i32.const ${S.en_cal_err.offset}) (i32.const ${S.en_cal_err.len})
          (i32.const ${S.en_cal_err.offset}) (i32.const ${S.en_cal_err.len})
          (i32.const ${S.en_device_cal.offset}) (i32.const ${S.en_device_cal.len})
          (i32.const ${S.en_error_badge.offset}) (i32.const ${S.en_error_badge.len})
          (i32.const ${S.ui_bc_red.offset}))
        (call $out_z (i32.const ${S.ui_text_start.offset}))
        (if (i32.gt_s (global.get $err_len) (i32.const 0))
          (then (call $out_json_esc (i32.const 280400) (global.get $err_len) (i32.const 900)))
          (else (call $out_json_esc (i32.const ${S.en_err_fallback.offset}) (i32.const ${S.en_err_fallback.len}) (i32.const 900)))
        )
        (call $out_z (i32.const ${S.ui_text_end.offset}))
        (call $emit_ui_btn_footer (i32.const ${S.en_btn_retry.offset}) (i32.const ${S.en_btn_retry.len}))
        (return (i32.sub (global.get $out_pos) (i32.const 65536)))
      )
    )

    (if (i32.le_s (global.get $g_ev_count) (i32.const 0))
      (then
        (call $emit_ui_header
          (i32.const ${S.en_empty_msg.offset}) (i32.const ${S.en_empty_msg.len})
          (i32.const ${S.en_events_title.offset}) (i32.const ${S.en_events_title.len})
          (i32.const ${S.en_device_cal.offset}) (i32.const ${S.en_device_cal.len})
          (i32.const ${S.en_empty_badge.offset}) (i32.const ${S.en_empty_badge.len})
          (i32.const ${S.ui_bc_blue.offset}))
        (call $out_z (i32.const ${S.ui_text_start.offset}))
        (call $out_json_esc (i32.const ${S.en_empty_msg.offset}) (i32.const ${S.en_empty_msg.len}) (i32.const 480))
        (call $out_z (i32.const ${S.ui_text_end.offset}))
        (call $emit_ui_btn_footer (i32.const ${S.en_btn_refresh.offset}) (i32.const ${S.en_btn_refresh.len}))
        (return (i32.sub (global.get $out_pos) (i32.const 65536)))
      )
    )

    ;; Build badge "<N> EVENTS" into 281700
    (local.set $b_end (call $copy_int_str (global.get $g_ev_count) (i32.const 281700)))
    (i32.store8 (local.get $b_end) (i32.const 32))
    (local.set $b_end (i32.add (local.get $b_end) (i32.const 1)))
    (local.set $b_end (call $copy_mem (i32.const ${S.en_events_badge.offset}) (local.get $b_end) (i32.const ${S.en_events_badge.len})))

    (call $emit_ui_header
      (i32.const ${S.en_events_disp.offset}) (i32.const ${S.en_events_disp.len})
      (i32.const ${S.en_events_title.offset}) (i32.const ${S.en_events_title.len})
      (i32.const ${S.en_device_cal.offset}) (i32.const ${S.en_device_cal.len})
      (i32.const 281700) (i32.sub (local.get $b_end) (i32.const 281700))
      (i32.const ${S.ui_bc_alarm.offset}))

    (call $out_z (i32.const ${S.ui_list_start.offset}))
    (local.set $count (i32.const 0))
    (if (call $find_array_start (i32.const 1000000) (global.get $saved_res_len) (i32.const ${S.a_events.offset}))
      (then
        (loop $ev_loop
          (if (i32.and (i32.lt_s (local.get $count) (i32.const 20))
                       (call $next_array_obj (i32.const 1000000) (global.get $saved_res_len)))
            (then
              (local.set $tl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_title.offset}) (i32.const 279000) (i32.const 120)))
              (local.set $sl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_start.offset}) (i32.const 279300) (i32.const 48)))
              (local.set $el (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_end.offset}) (i32.const 279400) (i32.const 48)))
              (local.set $dl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_desc.offset}) (i32.const 279500) (i32.const 200)))
              (local.set $ad (call $extract_json_bool (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_allDay.offset})))

              (if (i32.gt_s (local.get $count) (i32.const 0)) (then (call $out_z (i32.const ${S.jf_comma.offset}))))
              (call $out_z (i32.const ${S.ui_list_item1.offset}))
              (if (i32.gt_s (local.get $tl) (i32.const 0))
                (then (call $out_json_esc (i32.const 279000) (local.get $tl) (i32.const 95)))
                (else (call $out_json_esc (i32.const ${S.def_cal.offset}) (i32.const ${S.def_cal.len}) (i32.const 95)))
              )
              (call $out_z (i32.const ${S.ui_list_item2.offset}))

              (call $format_dt (i32.const 279300) (local.get $sl) (i32.const 279400) (local.get $el) (local.get $ad) (i32.const ${S.en_all_day.offset}) (i32.const ${S.en_all_day.len}))
              (local.set $sub_p (i32.const 274800))
              (if (i32.gt_s (global.get $fd_len) (i32.const 0))
                (then (local.set $sub_p (call $copy_mem (i32.const 281500) (local.get $sub_p) (global.get $fd_len))))
              )
              (if (i32.gt_s (global.get $ft_len) (i32.const 0))
                (then
                  (if (i32.gt_s (local.get $sub_p) (i32.const 274800))
                    (then (local.set $sub_p (call $copy_zstr (i32.const ${S.def_sep_dot.offset}) (local.get $sub_p))))
                  )
                  (local.set $sub_p (call $copy_mem (i32.const 281550) (local.get $sub_p) (global.get $ft_len)))
                )
              )
              (if (i32.gt_s (local.get $dl) (i32.const 0))
                (then
                  (if (i32.gt_s (local.get $sub_p) (i32.const 274800))
                    (then (local.set $sub_p (call $copy_zstr (i32.const ${S.def_sep_dot.offset}) (local.get $sub_p))))
                  )
                  (local.set $sub_p (call $copy_mem (i32.const 279500) (local.get $sub_p) (call $utf8_clamp (i32.const 279500) (local.get $dl) (i32.const 90))))
                )
              )
              (call $out_json_esc (i32.const 274800) (i32.sub (local.get $sub_p) (i32.const 274800)) (i32.const 155))
              (call $out_z (i32.const ${S.ui_list_item3.offset}))

              (local.set $count (i32.add (local.get $count) (i32.const 1)))
              (br $ev_loop)
            )
          )
        )
      )
    )
    (call $out_z (i32.const ${S.ui_arr_end.offset}))
    (call $emit_ui_btn_footer (i32.const ${S.en_btn_refresh.offset}) (i32.const ${S.en_btn_refresh.len}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  ;; ── Grounded Direct-Text Renderers (0% hallucination, 0 extra LLM tokens) ──

  (func $dates_equal_10 (result i32)
    (local $i i32)
    (local.set $i (i32.const 0))
    (loop $de
      (if (i32.lt_s (local.get $i) (i32.const 10))
        (then
          (if (i32.ne (i32.load8_u (i32.add (i32.const 270700) (local.get $i)))
                      (i32.load8_u (i32.add (i32.const 270800) (local.get $i))))
            (then (return (i32.const 0)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $de)
        )
      )
    )
    (i32.const 1)
  )

  (func $emit_queried_range
    (call $out_json_esc (i32.const 270700) (i32.const 10) (i32.const 10))
    (if (i32.and (i32.ge_s (global.get $end_len) (i32.const 10)) (i32.eqz (call $dates_equal_10)))
      (then
        (call $out_json_esc (i32.const ${S.en_ev_to.offset}) (i32.const ${S.en_ev_to.len}) (i32.const 8))
        (call $out_json_esc (i32.const 270800) (i32.const 10) (i32.const 10))
      )
    )
  )

  (func $render_events_direct (result i32)
    (local $count i32)
    (local $tl i32)
    (local $sl i32)
    (local $el i32)
    (local $dl i32)
    (local $ad i32)
    (local $hdr_end i32)
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.direct_p1.offset}))
    (if (i32.eqz (global.get $g_op_ok))
      (then
        (call $out_json_esc (i32.const ${S.en_err_pref.offset}) (i32.const ${S.en_err_pref.len}) (i32.const 32))
        (if (i32.gt_s (global.get $err_len) (i32.const 0))
          (then (call $out_json_esc (i32.const 280400) (global.get $err_len) (i32.const 600)))
          (else (call $out_json_esc (i32.const ${S.en_err_fallback.offset}) (i32.const ${S.en_err_fallback.len}) (i32.const 600)))
        )
        (call $out_z (i32.const ${S.direct_p2.offset}))
        (return (i32.sub (global.get $out_pos) (i32.const 65536)))
      )
    )
    (if (i32.le_s (global.get $g_ev_count) (i32.const 0))
      (then
        (if (i32.ge_s (global.get $start_len) (i32.const 10))
          (then
            (call $out_json_esc (i32.const ${S.en_ev_none_for.offset}) (i32.const ${S.en_ev_none_for.len}) (i32.const 48))
            (call $emit_queried_range)
            (call $out_json_esc (i32.const ${S.en_dot_end.offset}) (i32.const ${S.en_dot_end.len}) (i32.const 4))
          )
          (else
            (call $out_json_esc (i32.const ${S.en_ev_none.offset}) (i32.const ${S.en_ev_none.len}) (i32.const 120))
          )
        )
        (call $out_z (i32.const ${S.direct_p2.offset}))
        (return (i32.sub (global.get $out_pos) (i32.const 65536)))
      )
    )
    (if (i32.ge_s (global.get $start_len) (i32.const 10))
      (then
        (call $out_json_esc (i32.const ${S.en_ev_for.offset}) (i32.const ${S.en_ev_for.len}) (i32.const 48))
        (call $emit_queried_range)
        (call $out_json_esc (i32.const ${S.en_ev_lp.offset}) (i32.const ${S.en_ev_lp.len}) (i32.const 8))
      )
      (else
        (call $out_json_esc (i32.const ${S.en_ev_hdr1.offset}) (i32.const ${S.en_ev_hdr1.len}) (i32.const 48))
      )
    )
    (local.set $hdr_end (call $copy_int_str (global.get $g_ev_count) (i32.const 281700)))
    (call $out_json_esc (i32.const 281700) (i32.sub (local.get $hdr_end) (i32.const 281700)) (i32.const 16))
    (call $out_json_esc (i32.const ${S.en_ev_hdr2.offset}) (i32.const ${S.en_ev_hdr2.len}) (i32.const 16))

    (local.set $count (i32.const 0))
    (if (call $find_array_start (i32.const 1000000) (global.get $saved_res_len) (i32.const ${S.a_events.offset}))
      (then
        (loop $dl_loop
          (if (i32.and (i32.lt_s (local.get $count) (i32.const 20))
                       (call $next_array_obj (i32.const 1000000) (global.get $saved_res_len)))
            (then
              (local.set $tl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_title.offset}) (i32.const 279000) (i32.const 120)))
              (local.set $sl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_start.offset}) (i32.const 279300) (i32.const 48)))
              (local.set $el (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_end.offset}) (i32.const 279400) (i32.const 48)))
              (local.set $dl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_desc.offset}) (i32.const 279500) (i32.const 160)))
              (local.set $ad (call $extract_json_bool (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_allDay.offset})))

              (call $out_json_esc (i32.const ${S.en_ev_bullet.offset}) (i32.const ${S.en_ev_bullet.len}) (i32.const 8))
              (if (i32.gt_s (local.get $tl) (i32.const 0))
                (then (call $out_json_esc (i32.const 279000) (local.get $tl) (i32.const 120)))
                (else (call $out_json_esc (i32.const ${S.def_cal.offset}) (i32.const ${S.def_cal.len}) (i32.const 32)))
              )

              (call $format_dt (i32.const 279300) (local.get $sl) (i32.const 279400) (local.get $el) (local.get $ad) (i32.const ${S.en_all_day.offset}) (i32.const ${S.en_all_day.len}))
              (if (i32.or (i32.gt_s (global.get $fd_len) (i32.const 0)) (i32.gt_s (global.get $ft_len) (i32.const 0)))
                (then
                  (call $out_json_esc (i32.const ${S.en_ev_lp.offset}) (i32.const ${S.en_ev_lp.len}) (i32.const 8))
                  (if (i32.gt_s (global.get $fd_len) (i32.const 0))
                    (then (call $out_json_esc (i32.const 281500) (global.get $fd_len) (i32.const 24)))
                  )
                  (if (i32.and (i32.gt_s (global.get $fd_len) (i32.const 0)) (i32.gt_s (global.get $ft_len) (i32.const 0)))
                    (then (call $out_json_esc (i32.const ${S.en_ev_comma.offset}) (i32.const ${S.en_ev_comma.len}) (i32.const 8)))
                  )
                  (if (i32.gt_s (global.get $ft_len) (i32.const 0))
                    (then (call $out_json_esc (i32.const 281550) (global.get $ft_len) (i32.const 32)))
                  )
                  (call $out_json_esc (i32.const ${S.en_ev_rp.offset}) (i32.const ${S.en_ev_rp.len}) (i32.const 8))
                )
              )
              (if (i32.gt_s (local.get $dl) (i32.const 0))
                (then
                  (call $out_json_esc (i32.const ${S.en_ev_desc.offset}) (i32.const ${S.en_ev_desc.len}) (i32.const 8))
                  (call $out_json_esc (i32.const 279500) (local.get $dl) (i32.const 160))
                )
              )
              (local.set $count (i32.add (local.get $count) (i32.const 1)))
              (br $dl_loop)
            )
          )
        )
      )
    )
    (call $out_z (i32.const ${S.direct_p2.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  (func $render_modify_direct (result i32)
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.direct_p1.offset}))
    (if (global.get $g_op_ok)
      (then
        (if (call $str_eq (i32.const 270050) (global.get $act_len) (i32.const ${S.a_delete.offset}))
          (then (call $out_json_esc (i32.const ${S.en_del_ok.offset}) (i32.const ${S.en_del_ok.len}) (i32.const 48)))
          (else (call $out_json_esc (i32.const ${S.en_upd_ok.offset}) (i32.const ${S.en_upd_ok.len}) (i32.const 48)))
        )
        (call $out_json_esc (i32.const 274400) (global.get $cid_len) (i32.const 120))
        (call $out_json_esc (i32.const ${S.en_id_end.offset}) (i32.const ${S.en_id_end.len}) (i32.const 8))
      )
      (else
        (call $out_json_esc (i32.const ${S.en_err_pref.offset}) (i32.const ${S.en_err_pref.len}) (i32.const 32))
        (if (i32.gt_s (global.get $err_len) (i32.const 0))
          (then (call $out_json_esc (i32.const 280400) (global.get $err_len) (i32.const 600)))
          (else (call $out_json_esc (i32.const ${S.en_err_fallback.offset}) (i32.const ${S.en_err_fallback.len}) (i32.const 600)))
        )
      )
    )
    (call $out_z (i32.const ${S.direct_p2.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  (func $render_help_direct_reason (param $r_ptr i32) (param $r_len i32) (result i32)
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.direct_p1.offset}))
    (if (call $str_eq (local.get $r_ptr) (local.get $r_len) (i32.const ${S.r_miss_title.offset}))
      (then (call $out_json_esc (i32.const ${S.en_miss_title.offset}) (i32.const ${S.en_miss_title.len}) (i32.const 120)))
      (else
        (if (call $str_eq (local.get $r_ptr) (local.get $r_len) (i32.const ${S.r_miss_evid.offset}))
          (then (call $out_json_esc (i32.const ${S.en_miss_evid.offset}) (i32.const ${S.en_miss_evid.len}) (i32.const 160)))
          (else (call $out_json_esc (i32.const ${S.en_help_fallback.offset}) (i32.const ${S.en_help_fallback.len}) (i32.const 600)))
        )
      )
    )
    (call $out_z (i32.const ${S.direct_p2.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  ;; Render Direct AI Help (state 25, plain-text /calendar help ONLY)
  (func $render_help_direct (result i32)
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.direct_p1.offset}))
    (if (i32.gt_s (global.get $ai_text_len) (i32.const 0))
      (then (call $out_json_esc (i32.const 320000) (global.get $ai_text_len) (i32.const 12000)))
      (else (call $out_json_esc (i32.const ${S.en_help_fallback.offset}) (i32.const ${S.en_help_fallback.len}) (i32.const 600)))
    )
    (call $out_z (i32.const ${S.direct_p2.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  (func $render_fallback_for_state (result i32)
    (if (i32.eq (global.get $g_state) (i32.const 25)) (then (return (call $render_help_direct))))
    (if (i32.or (i32.eq (global.get $g_state) (i32.const 10)) (i32.eq (global.get $g_state) (i32.const 11)))
      (then (return (call $render_create_ui)))
    )
    (if (i32.or (i32.eq (global.get $g_state) (i32.const 9)) (i32.eq (global.get $g_state) (i32.const 12)))
      (then
        (if (global.get $g_is_json) (then (return (call $render_events_direct))))
        (return (call $render_events_ui))
      )
    )
    (call $render_modify_direct)
  )

  ;; ── Entrypoint ───────────────────────────────────────────────────────

  (func (export "calendar_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $ts i32)
    (local $tl i32)
    (local $ll i32)
    (local $al i32)
    (local $pipe1 i32)
    (local $pipe2 i32)
    (local $pipe3 i32)
    (local $i i32)
    (local $p_s i32)
    (local $p_e i32)

    ;; Reset state
    (global.set $g_state (i32.const 0))
    (global.set $g_retry (i32.const 0))
    (global.set $g_op_ok (i32.const 0))
    (global.set $g_ev_count (i32.const 0))
    (global.set $g_user_calid (i32.const 0))
    (global.set $g_is_json (i32.const 0))
    (global.set $act_len (i32.const 0))
    (global.set $title_len (i32.const 0))
    (global.set $start_len (i32.const 0))
    (global.set $end_len (i32.const 0))
    (global.set $dur_val (i32.const 0))
    (global.set $desc_len (i32.const 0))
    (global.set $calid_len (i32.const 0))
    (global.set $evid_len (i32.const 0))
    (global.set $ct_len (i32.const 0))
    (global.set $cs_len (i32.const 0))
    (global.set $ce_len (i32.const 0))
    (global.set $cid_len (i32.const 0))
    (global.set $err_len (i32.const 0))
    (global.set $saved_res_len (i32.const 0))
    (global.set $ai_text_len (i32.const 0))
    (call $set_default_lang)

    ;; Trim whitespace
    (local.set $ts (local.get $in_ptr))
    (local.set $tl (local.get $in_len))
    (loop $ltrim
      (if (i32.and (i32.gt_s (local.get $tl) (i32.const 0)) (call $is_ws (i32.load8_u (local.get $ts))))
        (then
          (local.set $ts (i32.add (local.get $ts) (i32.const 1)))
          (local.set $tl (i32.sub (local.get $tl) (i32.const 1)))
          (br $ltrim)
        )
      )
    )
    (loop $rtrim
      (if (i32.and (i32.gt_s (local.get $tl) (i32.const 0))
                   (call $is_ws (i32.load8_u (i32.add (local.get $ts) (i32.sub (local.get $tl) (i32.const 1))))))
        (then
          (local.set $tl (i32.sub (local.get $tl) (i32.const 1)))
          (br $rtrim)
        )
      )
    )

    ;; Case A: JSON Input (conversational AI)
    (if (i32.and (i32.gt_s (local.get $tl) (i32.const 0))
                 (i32.eq (i32.load8_u (local.get $ts)) (i32.const 123))) ;; '{'
      (then
        (global.set $g_is_json (i32.const 1))
        (local.set $ll (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_lang.offset}) (i32.const 270000) (i32.const 24)))
        (if (i32.gt_s (local.get $ll) (i32.const 0)) (then (global.set $lang_len (local.get $ll))))

        ;; Extract operation / action / INTENT
        (local.set $al (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_op.offset}) (i32.const 270050) (i32.const 48)))
        (if (i32.le_s (local.get $al) (i32.const 0))
          (then (local.set $al (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_action.offset}) (i32.const 270050) (i32.const 48))))
        )
        (if (i32.le_s (local.get $al) (i32.const 0))
          (then (local.set $al (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_intent.offset}) (i32.const 270050) (i32.const 48))))
        )
        (if (i32.gt_s (local.get $al) (i32.const 0))
          (then
            (call $to_lower (i32.const 270050) (i32.const 270050) (local.get $al))
            (global.set $act_len (local.get $al))
          )
        )

        ;; Extract all fields (camelCase + lowercased marketplace_plugin keys)
        (global.set $title_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_title.offset}) (i32.const 270150) (i32.const 480)))
        (if (i32.le_s (global.get $title_len) (i32.const 0))
          (then (global.set $title_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_summary.offset}) (i32.const 270150) (i32.const 480))))
        )
        (if (i32.le_s (global.get $title_len) (i32.const 0))
          (then (global.set $title_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_event.offset}) (i32.const 270150) (i32.const 480))))
        )
        (if (i32.lt_s (global.get $title_len) (i32.const 0)) (then (global.set $title_len (i32.const 0))))

        (global.set $start_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_start.offset}) (i32.const 270700) (i32.const 60)))
        (if (i32.le_s (global.get $start_len) (i32.const 0))
          (then (global.set $start_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_startDate.offset}) (i32.const 270700) (i32.const 60))))
        )
        (if (i32.le_s (global.get $start_len) (i32.const 0))
          (then (global.set $start_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_startdate_lc.offset}) (i32.const 270700) (i32.const 60))))
        )
        (if (i32.lt_s (global.get $start_len) (i32.const 0)) (then (global.set $start_len (i32.const 0))))

        (global.set $end_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_end.offset}) (i32.const 270800) (i32.const 60)))
        (if (i32.le_s (global.get $end_len) (i32.const 0))
          (then (global.set $end_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_endDate.offset}) (i32.const 270800) (i32.const 60))))
        )
        (if (i32.le_s (global.get $end_len) (i32.const 0))
          (then (global.set $end_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_enddate_lc.offset}) (i32.const 270800) (i32.const 60))))
        )
        (if (i32.lt_s (global.get $end_len) (i32.const 0)) (then (global.set $end_len (i32.const 0))))

        (global.set $dur_val (call $extract_json_int (local.get $ts) (local.get $tl) (i32.const ${S.k_durMin.offset})))
        (if (i32.le_s (global.get $dur_val) (i32.const 0))
          (then (global.set $dur_val (call $extract_json_int (local.get $ts) (local.get $tl) (i32.const ${S.k_durmin_lc.offset}))))
        )
        (if (i32.le_s (global.get $dur_val) (i32.const 0))
          (then (global.set $dur_val (call $extract_json_int (local.get $ts) (local.get $tl) (i32.const ${S.k_dur.offset}))))
        )
        (if (i32.lt_s (global.get $dur_val) (i32.const 0)) (then (global.set $dur_val (i32.const 0))))

        (global.set $desc_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_desc.offset}) (i32.const 270900) (i32.const 1900)))
        (if (i32.le_s (global.get $desc_len) (i32.const 0))
          (then (global.set $desc_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_content.offset}) (i32.const 270900) (i32.const 1900))))
        )
        (if (i32.le_s (global.get $desc_len) (i32.const 0))
          (then (global.set $desc_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_details.offset}) (i32.const 270900) (i32.const 1900))))
        )
        (if (i32.le_s (global.get $desc_len) (i32.const 0))
          (then (global.set $desc_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_notes.offset}) (i32.const 270900) (i32.const 1900))))
        )
        (if (i32.lt_s (global.get $desc_len) (i32.const 0)) (then (global.set $desc_len (i32.const 0))))

        (global.set $calid_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_calId.offset}) (i32.const 273000) (i32.const 240)))
        (if (i32.le_s (global.get $calid_len) (i32.const 0))
          (then (global.set $calid_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_calid_lc.offset}) (i32.const 273000) (i32.const 240))))
        )
        (if (i32.gt_s (global.get $calid_len) (i32.const 0))
          (then (global.set $g_user_calid (i32.const 1)))
          (else (global.set $calid_len (i32.const 0)))
        )

        (global.set $evid_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_evId.offset}) (i32.const 273300) (i32.const 240)))
        (if (i32.le_s (global.get $evid_len) (i32.const 0))
          (then (global.set $evid_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_evid_lc.offset}) (i32.const 273300) (i32.const 240))))
        )
        (if (i32.le_s (global.get $evid_len) (i32.const 0))
          (then (global.set $evid_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_id.offset}) (i32.const 273300) (i32.const 240))))
        )
        (if (i32.lt_s (global.get $evid_len) (i32.const 0)) (then (global.set $evid_len (i32.const 0))))

        ;; Route by action
        (if (i32.or (call $str_eq (i32.const 270050) (global.get $act_len) (i32.const ${S.a_help.offset}))
                    (call $str_eq (i32.const 270050) (global.get $act_len) (i32.const ${S.a_unknown.offset})))
          (then (return (call $render_help_direct_reason (i32.const ${S.r_help.offset}) (i32.const ${S.r_help.len}))))
        )
        (if (i32.or
              (i32.or (call $str_eq (i32.const 270050) (global.get $act_len) (i32.const ${S.a_events.offset}))
                      (call $str_eq (i32.const 270050) (global.get $act_len) (i32.const ${S.a_list.offset})))
              (i32.or (call $str_eq (i32.const 270050) (global.get $act_len) (i32.const ${S.a_inbox.offset}))
                      (call $str_eq (i32.const 270050) (global.get $act_len) (i32.const ${S.a_get.offset}))))
          (then (return (call $start_events_warmup)))
        )
        (if (call $str_eq (i32.const 270050) (global.get $act_len) (i32.const ${S.a_update.offset}))
          (then
            (if (i32.or (i32.le_s (global.get $evid_len) (i32.const 0)) (i32.le_s (global.get $calid_len) (i32.const 0)))
              (then (return (call $render_help_direct_reason (i32.const ${S.r_miss_evid.offset}) (i32.const ${S.r_miss_evid.len}))))
            )
            (memory.copy (i32.const 274400) (i32.const 273300) (global.get $evid_len))
            (global.set $cid_len (global.get $evid_len))
            (return (call $start_update_call))
          )
        )
        (if (call $str_eq (i32.const 270050) (global.get $act_len) (i32.const ${S.a_delete.offset}))
          (then
            (if (i32.or (i32.le_s (global.get $evid_len) (i32.const 0)) (i32.le_s (global.get $calid_len) (i32.const 0)))
              (then (return (call $render_help_direct_reason (i32.const ${S.r_miss_evid.offset}) (i32.const ${S.r_miss_evid.len}))))
            )
            (memory.copy (i32.const 274400) (i32.const 273300) (global.get $evid_len))
            (global.set $cid_len (global.get $evid_len))
            (return (call $start_delete_call))
          )
        )
        (if (i32.or
              (i32.or (call $str_eq (i32.const 270050) (global.get $act_len) (i32.const ${S.a_create.offset}))
                      (call $str_eq (i32.const 270050) (global.get $act_len) (i32.const ${S.a_add.offset})))
              (i32.or (call $str_eq (i32.const 270050) (global.get $act_len) (i32.const ${S.a_new.offset}))
                      (call $str_eq (i32.const 270050) (global.get $act_len) (i32.const ${S.a_schedule.offset}))))
          (then
            (if (i32.le_s (global.get $title_len) (i32.const 0))
              (then (return (call $render_help_direct_reason (i32.const ${S.r_miss_title.offset}) (i32.const ${S.r_miss_title.len}))))
            )
            (return (call $start_calendars_warmup))
          )
        )
        ;; Default JSON fallback
        (if (i32.gt_s (global.get $title_len) (i32.const 0))
          (then (return (call $start_calendars_warmup)))
        )
        (return (call $start_events_warmup))
      )
    )

    ;; Case B: Plain Text / Bare Slash Command
    (local.set $tl (call $strip_lang_token (local.get $ts) (local.get $tl)))
    (if (i32.le_s (local.get $tl) (i32.const 0))
      (then (return (call $start_events_warmup)))
    )

    (call $to_lower (local.get $ts) (i32.const 282000) (local.get $tl))
    (if (i32.or (call $str_eq (i32.const 282000) (local.get $tl) (i32.const ${S.a_list.offset}))
                (call $str_eq (i32.const 282000) (local.get $tl) (i32.const ${S.a_events.offset})))
      (then (return (call $start_events_warmup)))
    )
    (if (i32.or (call $str_eq (i32.const 282000) (local.get $tl) (i32.const ${S.a_help.offset}))
                (i32.and (i32.eq (local.get $tl) (i32.const 1)) (i32.eq (i32.load8_u (local.get $ts)) (i32.const 63))))
      (then (return (call $call_ai_help (i32.const ${S.r_help.offset}) (i32.const ${S.r_help.len}))))
    )

    ;; Pipe-delimited: <title> | <start> [| <end>] [| <description>]
    (local.set $pipe1 (i32.const -1))
    (local.set $pipe2 (i32.const -1))
    (local.set $pipe3 (i32.const -1))
    (local.set $i (i32.const 0))
    (loop $fp
      (if (i32.lt_s (local.get $i) (local.get $tl))
        (then
          (if (i32.eq (i32.load8_u (i32.add (local.get $ts) (local.get $i))) (i32.const 124))
            (then
              (if (i32.lt_s (local.get $pipe1) (i32.const 0)) (then (local.set $pipe1 (local.get $i)))
              (else (if (i32.lt_s (local.get $pipe2) (i32.const 0)) (then (local.set $pipe2 (local.get $i)))
              (else (if (i32.lt_s (local.get $pipe3) (i32.const 0)) (then (local.set $pipe3 (local.get $i))))))))
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $fp)
        )
      )
    )

    (if (i32.ge_s (local.get $pipe1) (i32.const 0))
      (then
        ;; Title: [ts .. ts + pipe1)
        (local.set $p_s (local.get $ts))
        (local.set $p_e (i32.add (local.get $ts) (local.get $pipe1)))
        (loop $rt
          (if (i32.and (i32.gt_u (local.get $p_e) (local.get $p_s)) (call $is_ws (i32.load8_u (i32.sub (local.get $p_e) (i32.const 1)))))
            (then (local.set $p_e (i32.sub (local.get $p_e) (i32.const 1))) (br $rt))
          )
        )
        (global.set $title_len (i32.sub (local.get $p_e) (local.get $p_s)))
        (if (i32.gt_s (global.get $title_len) (i32.const 480)) (then (global.set $title_len (i32.const 480))))
        (memory.copy (i32.const 270150) (local.get $p_s) (global.get $title_len))

        ;; Start: [pipe1+1 .. pipe2 or end)
        (local.set $p_s (i32.add (local.get $ts) (i32.add (local.get $pipe1) (i32.const 1))))
        (local.set $p_e (if (result i32) (i32.ge_s (local.get $pipe2) (i32.const 0))
          (then (i32.add (local.get $ts) (local.get $pipe2)))
          (else (i32.add (local.get $ts) (local.get $tl)))))
        (loop $ls (if (i32.and (i32.lt_u (local.get $p_s) (local.get $p_e)) (call $is_ws (i32.load8_u (local.get $p_s)))) (then (local.set $p_s (i32.add (local.get $p_s) (i32.const 1))) (br $ls))))
        (loop $rs (if (i32.and (i32.gt_u (local.get $p_e) (local.get $p_s)) (call $is_ws (i32.load8_u (i32.sub (local.get $p_e) (i32.const 1))))) (then (local.set $p_e (i32.sub (local.get $p_e) (i32.const 1))) (br $rs))))
        (global.set $start_len (i32.sub (local.get $p_e) (local.get $p_s)))
        (if (i32.gt_s (global.get $start_len) (i32.const 60)) (then (global.set $start_len (i32.const 60))))
        (memory.copy (i32.const 270700) (local.get $p_s) (global.get $start_len))

        ;; End: [pipe2+1 .. pipe3 or end)
        (if (i32.ge_s (local.get $pipe2) (i32.const 0))
          (then
            (local.set $p_s (i32.add (local.get $ts) (i32.add (local.get $pipe2) (i32.const 1))))
            (local.set $p_e (if (result i32) (i32.ge_s (local.get $pipe3) (i32.const 0))
              (then (i32.add (local.get $ts) (local.get $pipe3)))
              (else (i32.add (local.get $ts) (local.get $tl)))))
            (loop $le (if (i32.and (i32.lt_u (local.get $p_s) (local.get $p_e)) (call $is_ws (i32.load8_u (local.get $p_s)))) (then (local.set $p_s (i32.add (local.get $p_s) (i32.const 1))) (br $le))))
            (loop $re (if (i32.and (i32.gt_u (local.get $p_e) (local.get $p_s)) (call $is_ws (i32.load8_u (i32.sub (local.get $p_e) (i32.const 1))))) (then (local.set $p_e (i32.sub (local.get $p_e) (i32.const 1))) (br $re))))
            (global.set $end_len (i32.sub (local.get $p_e) (local.get $p_s)))
            (if (i32.gt_s (global.get $end_len) (i32.const 60)) (then (global.set $end_len (i32.const 60))))
            (memory.copy (i32.const 270800) (local.get $p_s) (global.get $end_len))
          )
        )

        ;; Desc: [pipe3+1 .. end)
        (if (i32.ge_s (local.get $pipe3) (i32.const 0))
          (then
            (local.set $p_s (i32.add (local.get $ts) (i32.add (local.get $pipe3) (i32.const 1))))
            (local.set $p_e (i32.add (local.get $ts) (local.get $tl)))
            (loop $ld (if (i32.and (i32.lt_u (local.get $p_s) (local.get $p_e)) (call $is_ws (i32.load8_u (local.get $p_s)))) (then (local.set $p_s (i32.add (local.get $p_s) (i32.const 1))) (br $ld))))
            (global.set $desc_len (i32.sub (local.get $p_e) (local.get $p_s)))
            (if (i32.gt_s (global.get $desc_len) (i32.const 1900)) (then (global.set $desc_len (i32.const 1900))))
            (memory.copy (i32.const 270900) (local.get $p_s) (global.get $desc_len))
          )
        )

        (if (i32.le_s (global.get $title_len) (i32.const 0))
          (then (return (call $call_ai_help (i32.const ${S.r_miss_title.offset}) (i32.const ${S.r_miss_title.len}))))
        )
        (return (call $start_calendars_warmup))
      )
    )

    ;; Plain title only
    (global.set $title_len (local.get $tl))
    (if (i32.gt_s (global.get $title_len) (i32.const 480)) (then (global.set $title_len (i32.const 480))))
    (memory.copy (i32.const 270150) (local.get $ts) (global.get $title_len))
    (call $start_calendars_warmup)
  )

  ;; ── Resume State Machine ─────────────────────────────────────────────

  (func $save_res (param $res_ptr i32) (param $res_len i32)
    (local $n i32)
    (local.set $n (local.get $res_len))
    (if (i32.gt_s (local.get $n) (i32.const 390000)) (then (local.set $n (i32.const 390000))))
    (if (i32.gt_s (local.get $n) (i32.const 0))
      (then (memory.copy (i32.const 1000000) (local.get $res_ptr) (local.get $n)))
    )
    (global.set $saved_res_len (local.get $n))
  )

  (func $extract_err (param $res_ptr i32) (param $res_len i32)
    (local $el i32)
    (local.set $el (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_error.offset}) (i32.const 280400) (i32.const 900)))
    (if (i32.lt_s (local.get $el) (i32.const 0)) (then (local.set $el (i32.const 0))))
    (global.set $err_len (local.get $el))
  )

  (func $resolve_writable_calid (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $found_any i32)
    (local $ro i32)
    (local $def i32)
    (local $id_l i32)
    (local $cnt i32)
    (local.set $cnt (i32.const 0))
    (local.set $found_any (i32.const 0))
    (if (call $find_array_start (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_calendars.offset}))
      (then
        (loop $cl
          (if (call $next_array_obj (local.get $res_ptr) (local.get $res_len))
            (then
              (local.set $cnt (i32.add (local.get $cnt) (i32.const 1)))
              (local.set $ro (call $extract_json_bool (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_isReadOnly.offset})))
              (if (i32.ne (local.get $ro) (i32.const 1))
                (then
                  (local.set $id_l (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_id.offset}) (i32.const 279000) (i32.const 240)))
                  (if (i32.gt_s (local.get $id_l) (i32.const 0))
                    (then
                      (local.set $def (call $extract_json_bool (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_isDefault.offset})))
                      (if (i32.or (i32.eqz (local.get $found_any)) (i32.eq (local.get $def) (i32.const 1)))
                        (then
                          (memory.copy (i32.const 273000) (i32.const 279000) (local.get $id_l))
                          (global.set $calid_len (local.get $id_l))
                          (local.set $found_any (i32.const 1))
                        )
                      )
                      (if (i32.eq (local.get $def) (i32.const 1))
                        (then (return (local.get $cnt)))
                      )
                    )
                  )
                )
              )
              (br $cl)
            )
          )
        )
      )
    )
    (local.get $cnt)
  )

  (func $handle_resume (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $ok i32)
    (local $cr i32)
    (local $cal_cnt i32)
    (local $ev_cnt i32)

    ;; STATE 9: calendar.calendars warm-up for events (aligns calendarId with create!)
    (if (i32.eq (global.get $g_state) (i32.const 9))
      (then
        (local.set $ok (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})))
        (if (i32.eq (local.get $ok) (i32.const 1))
          (then
            (if (i32.eqz (global.get $g_user_calid))
              (then (drop (call $resolve_writable_calid (local.get $res_ptr) (local.get $res_len))))
            )
            (return (call $start_events_call))
          )
          (else
            (if (call $is_perm_denied (local.get $res_ptr) (local.get $res_len))
              (then
                (call $save_res (local.get $res_ptr) (local.get $res_len))
                (call $extract_err (local.get $res_ptr) (local.get $res_len))
                (global.set $g_op_ok (i32.const 0))
                (global.set $g_ev_count (i32.const 0))
                (if (global.get $g_is_json) (then (return (call $render_events_direct))))
                (return (call $render_events_ui))
              )
            )
            (return (call $start_events_call))
          )
        )
      )
    )

    ;; STATE 10: calendar.calendars warm-up for create
    (if (i32.eq (global.get $g_state) (i32.const 10))
      (then
        (local.set $ok (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})))
        (if (i32.eq (local.get $ok) (i32.const 1))
          (then
            (if (i32.eqz (global.get $g_user_calid))
              (then (local.set $cal_cnt (call $resolve_writable_calid (local.get $res_ptr) (local.get $res_len))))
              (else (local.set $cal_cnt (i32.const 1)))
            )
            (if (i32.and (i32.eqz (local.get $cal_cnt)) (i32.eqz (global.get $g_retry)))
              (then
                (global.set $g_retry (i32.const 1))
                (return (call $start_calendars_warmup))
              )
            )
            (global.set $g_retry (i32.const 0))
            (return (call $start_create_call))
          )
          (else
            (if (call $is_perm_denied (local.get $res_ptr) (local.get $res_len))
              (then
                (call $save_res (local.get $res_ptr) (local.get $res_len))
                (call $extract_err (local.get $res_ptr) (local.get $res_len))
                (global.set $g_op_ok (i32.const 0))
                (memory.copy (i32.const 273600) (i32.const 270150) (global.get $title_len))
                (global.set $ct_len (global.get $title_len))
                (return (call $render_create_ui))
              )
            )
            (if (i32.eqz (global.get $g_retry))
              (then
                (global.set $g_retry (i32.const 1))
                (return (call $start_calendars_warmup))
              )
            )
            (global.set $g_retry (i32.const 0))
            (return (call $start_create_call))
          )
        )
      )
    )

    ;; STATE 11: calendar.create response -> Instant English Flutter UI card (0 AI tokens)
    (if (i32.eq (global.get $g_state) (i32.const 11))
      (then
        (local.set $ok (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})))
        (local.set $cr (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_created.offset})))
        (if (i32.and (i32.eq (local.get $ok) (i32.const 1)) (i32.eq (local.get $cr) (i32.const 1)))
          (then
            (call $save_res (local.get $res_ptr) (local.get $res_len))
            (global.set $g_op_ok (i32.const 1))
            (global.set $err_len (i32.const 0))
            (global.set $ct_len (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_title.offset}) (i32.const 273600) (i32.const 480)))
            (if (i32.le_s (global.get $ct_len) (i32.const 0))
              (then (memory.copy (i32.const 273600) (i32.const 270150) (global.get $title_len)) (global.set $ct_len (global.get $title_len)))
            )
            (global.set $cs_len (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_start.offset}) (i32.const 274200) (i32.const 60)))
            (if (i32.le_s (global.get $cs_len) (i32.const 0))
              (then (memory.copy (i32.const 274200) (i32.const 270700) (global.get $start_len)) (global.set $cs_len (global.get $start_len)))
            )
            (global.set $ce_len (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_end.offset}) (i32.const 274300) (i32.const 60)))
            (if (i32.le_s (global.get $ce_len) (i32.const 0))
              (then (memory.copy (i32.const 274300) (i32.const 270800) (global.get $end_len)) (global.set $ce_len (global.get $end_len)))
            )
            (return (call $render_create_ui))
          )
          (else
            ;; Retry once on non-permission error
            (if (i32.and (i32.eqz (global.get $g_retry))
                         (i32.eqz (call $is_perm_denied (local.get $res_ptr) (local.get $res_len))))
              (then
                (global.set $g_retry (i32.const 1))
                (if (i32.eqz (global.get $g_user_calid)) (then (global.set $calid_len (i32.const 0))))
                (return (call $start_create_call))
              )
            )
            (call $save_res (local.get $res_ptr) (local.get $res_len))
            (call $extract_err (local.get $res_ptr) (local.get $res_len))
            (global.set $g_op_ok (i32.const 0))
            (memory.copy (i32.const 273600) (i32.const 270150) (global.get $title_len))
            (global.set $ct_len (global.get $title_len))
            (memory.copy (i32.const 274200) (i32.const 270700) (global.get $start_len))
            (global.set $cs_len (global.get $start_len))
            (memory.copy (i32.const 274300) (i32.const 270800) (global.get $end_len))
            (global.set $ce_len (global.get $end_len))
            (return (call $render_create_ui))
          )
        )
      )
    )

    ;; STATE 12: calendar.events response -> Flutter UI for bare /calendar, compact JSON for conversational AI
    (if (i32.eq (global.get $g_state) (i32.const 12))
      (then
        (local.set $ok (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})))
        (if (i32.eq (local.get $ok) (i32.const 1))
          (then
            (call $save_res (local.get $res_ptr) (local.get $res_len))
            (global.set $g_op_ok (i32.const 1))
            (global.set $err_len (i32.const 0))
            (local.set $ev_cnt (i32.const 0))
            (if (call $find_array_start (i32.const 1000000) (global.get $saved_res_len) (i32.const ${S.a_events.offset}))
              (then
                (loop $cnt_l
                  (if (call $next_array_obj (i32.const 1000000) (global.get $saved_res_len))
                    (then
                      (local.set $ev_cnt (i32.add (local.get $ev_cnt) (i32.const 1)))
                      (br $cnt_l)
                    )
                  )
                )
              )
            )
            (global.set $g_ev_count (local.get $ev_cnt))
            (if (global.get $g_is_json) (then (return (call $render_events_direct))))
            (return (call $render_events_ui))
          )
          (else
            (if (i32.and (i32.eqz (global.get $g_retry))
                         (i32.eqz (call $is_perm_denied (local.get $res_ptr) (local.get $res_len))))
              (then
                (global.set $g_retry (i32.const 1))
                (return (call $start_events_call))
              )
            )
            (call $save_res (local.get $res_ptr) (local.get $res_len))
            (call $extract_err (local.get $res_ptr) (local.get $res_len))
            (global.set $g_op_ok (i32.const 0))
            (global.set $g_ev_count (i32.const 0))
            (if (global.get $g_is_json) (then (return (call $render_events_direct))))
            (return (call $render_events_ui))
          )
        )
      )
    )

    ;; STATE 13/14: calendar.update / calendar.delete -> Grounded direct text (0 AI tokens)
    (if (i32.or (i32.eq (global.get $g_state) (i32.const 13)) (i32.eq (global.get $g_state) (i32.const 14)))
      (then
        (call $save_res (local.get $res_ptr) (local.get $res_len))
        (local.set $ok (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})))
        (if (i32.eq (local.get $ok) (i32.const 1))
          (then (global.set $g_op_ok (i32.const 1)) (global.set $err_len (i32.const 0)))
          (else (global.set $g_op_ok (i32.const 0)) (call $extract_err (local.get $res_ptr) (local.get $res_len)))
        )
        (return (call $render_modify_direct))
      )
    )

    ;; STATE 25: ai.complete finished (direct /calendar help ONLY)
    (global.set $ai_text_len (i32.const 0))
    (if (i32.eq (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})) (i32.const 1))
      (then
        (local.set $ok (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_text.offset}) (i32.const 320000) (i32.const 12000)))
        (if (i32.gt_s (local.get $ok) (i32.const 0)) (then (global.set $ai_text_len (local.get $ok))))
      )
    )
    (call $render_help_direct)
  )

  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (call $handle_resume (local.get $res_ptr) (local.get $res_len))
  )
)
`;

const watPath = path.join(pluginDir, 'plugin.wat');
const wasmPath = path.join(pluginDir, 'plugin.wasm');
const manifestPath = path.join(pluginDir, 'plugin.json');

fs.writeFileSync(watPath, wat, 'utf8');
console.log('Wrote calendar plugin.wat (' + wat.length + ' chars, staticPtr=' + staticPtr + ')');

execSync(`wat2wasm "${watPath}" -o "${wasmPath}"`, { stdio: 'inherit' });
const wasmBytes = fs.readFileSync(wasmPath);
const wasmSha256 = crypto.createHash('sha256').update(wasmBytes).digest('hex');
console.log('Compiled calendar plugin.wasm (' + wasmBytes.length + ' bytes), sha256=' + wasmSha256);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.wasmSha256 = wasmSha256;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('Updated calendar plugin.json wasmSha256.');

// ── Automated Comprehensive WASM Test Harness ─────────────────────────────

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
}

async function runTests() {
  const mod = await WebAssembly.compile(wasmBytes);

  async function execPlugin(inputStr, hostHandler) {
    let memRef;
    let pending = null;
    const instance = await WebAssembly.instantiate(mod, {
      chattree: {
        host_call: (reqPtr, reqLen, resPtr, resMaxLen) => {
          const reqStr = Buffer.from(memRef.buffer, reqPtr, reqLen).toString('utf8');
          const req = JSON.parse(reqStr);
          pending = { req, resPtr, resMaxLen };
          return 0;
        },
      },
    });
    memRef = instance.exports.memory;
    const u8 = new Uint8Array(memRef.buffer);
    const inBuf = Buffer.from(inputStr, 'utf8');
    u8.set(inBuf, 0);

    let rc = instance.exports.calendar_entry(0, inBuf.length);
    let hops = 0;
    while (rc === 0 && pending !== null) {
      hops++;
      assert(hops <= 15, 'Too many async hops');
      const { req, resPtr, resMaxLen } = pending;
      pending = null;
      const respObj = await hostHandler(req, hops);
      const resBuf = Buffer.from(JSON.stringify(respObj), 'utf8');
      assert(resBuf.length <= resMaxLen, 'Host response exceeds resMaxLen');
      new Uint8Array(memRef.buffer).set(resBuf, resPtr);
      rc = instance.exports.resume(resPtr, resBuf.length);
    }
    assert(rc > 0, 'Expected positive outputLen, got ' + rc);
    const outStr = Buffer.from(memRef.buffer, 65536, rc).toString('utf8');
    return JSON.parse(outStr);
  }

  // Test 1: Bare /calendar ("lang=es") -> resolves writable calendarId via calendars, calls events, 0 AI calls, English Flutter UI list card
  {
    const calls = [];
    const out = await execPlugin('lang=es', async (req) => {
      calls.push(req);
      if (req.api === 'calendar' && req.operation === 'calendars') {
        return {
          success: true,
          data: {
            calendars: [
              { id: 'ro1', name: 'Holidays', isReadOnly: true, isDefault: false },
              { id: 'cal_main', name: 'Personal', isReadOnly: false, isDefault: true },
            ],
          },
        };
      }
      if (req.api === 'calendar' && req.operation === 'events') {
        assert(req.payload.calendarId === 'cal_main', 'Bare /calendar queries the exact same writable calendarId used by create');
        return {
          success: true,
          data: {
            count: 2,
            events: [
              { id: '1', calendarId: 'cal_main', title: 'Cita m\u00e9dica', start: '2026-11-19T15:00:00', end: '2026-11-19T16:00:00', allDay: false, description: 'Cl\u00ednica Norte' },
              { id: '2', calendarId: 'cal_main', title: 'Entrega final', start: '2026-11-20T00:00:00', end: '2026-11-20T23:59:59', allDay: true, description: '' },
            ],
          },
        };
      }
      throw new Error('Unexpected host call (must NOT call AI): ' + JSON.stringify(req));
    });
    assert(calls.length === 2 && calls[0].operation === 'calendars' && calls[1].operation === 'events', 'Bare /calendar calls calendars -> events (0 AI tokens)');
    assert(out.type === 'ui' && out.ui.title === 'Upcoming Events' && out.ui.badge === '2 EVENTS', 'English events card');
    assert(out.ui.badgeColor === 'green' && out.ui.icon === 'alarm' && out.ui.hideText === true, 'Expected green alarm card');
    assert(out.ui.elements[0].type === 'list' && out.ui.elements[0].items.length === 2, 'Expected 2 list items');
    assert(out.ui.elements[0].items[0].subtitle.includes('2026-11-19') && out.ui.elements[0].items[0].subtitle.includes('15:00 - 16:00') && out.ui.elements[0].items[0].subtitle.includes('Clínica Norte'), 'Item 0 subtitle');
    assert(out.ui.elements[0].items[1].subtitle.includes('All day'), 'English All day label');
    assert(out.ui.elements[2].buttons[0].label === 'Refresh' && out.ui.elements[2].buttons[0].value === '/calendar', 'Button label is English action, not command');
  }

  // Test 2: Bare /calendar empty events -> 0 AI calls, English empty card
  {
    const out = await execPlugin('lang=en', async (req) => {
      if (req.api === 'calendar' && req.operation === 'calendars') {
        return { success: true, data: { calendars: [{ id: 'c1', isReadOnly: false, isDefault: true }] } };
      }
      if (req.api === 'calendar' && req.operation === 'events') {
        return { success: true, data: { count: 0, events: [] } };
      }
      throw new Error('Unexpected call');
    });
    assert(out.type === 'ui' && out.ui.badgeColor === 'blue' && out.ui.badge === 'EMPTY', 'Empty calendar blue info card');
    assert(out.ui.elements[0].content === 'No upcoming events scheduled.', 'English empty text');
    assert(out.ui.elements[2].buttons[0].label === 'Refresh', 'Refresh button');
  }

  // Test 3: First-message create via lowercased JSON + retry -> 0 AI calls, English Flutter UI card
  {
    const calls = [];
    let createAttempt = 0;
    const marketplaceInput = JSON.stringify({
      api: 'calendar',
      command: 'calendar',
      toolId: 'com.chattree.official.calendar.manager',
      operation: 'create',
      payload: {
        title: 'Reuni\u00f3n "Alpha" \\ Demo',
        start: '2026-11-19T15:30:00',
        startdate: '2026-11-19T15:30:00',
        end: '2026-11-19T16:15:00',
        enddate: '2026-11-19T16:15:00',
        durationminutes: 45,
        description: 'Sala 4\nZoom',
        lang: 'es',
      },
    });
    const out = await execPlugin(marketplaceInput, async (req) => {
      calls.push(req);
      if (req.api === 'calendar' && req.operation === 'calendars') {
        return {
          success: true,
          data: {
            calendars: [
              { id: 'ro1', name: 'Holidays', isReadOnly: true, isDefault: false },
              { id: 'cal_main', name: 'Personal', isReadOnly: false, isDefault: true },
            ],
          },
        };
      }
      if (req.api === 'calendar' && req.operation === 'create') {
        createAttempt++;
        if (createAttempt === 1) {
          return { success: false, error: 'Transient sync error' };
        }
        assert(req.payload.startDate === '2026-11-19T15:30:00' && req.payload.endDate === '2026-11-19T16:15:00', 'CamelCase dates restored');
        assert(req.payload.durationMinutes === 45 && typeof req.payload.durationMinutes === 'number', 'Integer durationMinutes');
        assert(req.payload.description === 'Sala 4\nZoom', 'Description passed');
        return {
          success: true,
          data: {
            created: true,
            eventId: 'evt_99',
            calendarId: 'cal_main',
            title: 'Reuni\u00f3n "Alpha" \\ Demo',
            start: '2026-11-19T15:30:00.000',
            end: '2026-11-19T16:15:00.000',
          },
        };
      }
      throw new Error('Unexpected call (must NOT call AI): ' + JSON.stringify(req));
    });
    assert(calls.length === 3, 'Expected calendars -> create (fail) -> create (retry ok), 0 AI calls');
    assert(calls[1].payload.calendarId === 'cal_main', 'Writable default calendarId resolved');
    assert(out.type === 'ui' && out.ui.title === 'Event Scheduled' && out.ui.badge === 'CREATED', 'English Event Scheduled card');
    const kv = out.ui.elements[0].items;
    assert(kv.length === 4 && kv[0].key === 'Title' && kv[1].key === 'Date' && kv[2].key === 'Time' && kv[3].key === 'Description', '4 English KV labels');
    assert(kv[0].value === 'Reunión "Alpha" \\ Demo' && kv[1].value === '2026-11-19' && kv[2].value === '15:30 - 16:15' && kv[3].value === 'Sala 4\nZoom', 'Event values preserved');
    assert(out.ui.elements[2].buttons[0].label === 'View Events' && out.ui.elements[2].buttons[0].value === '/calendar', 'Button label is View Events');
  }

  // Test 4: Permission error on create -> 0 AI calls, red English error card with "Retry"
  {
    const out = await execPlugin(
      JSON.stringify({ api: 'calendar', operation: 'create', payload: { title: 'Test', lang: 'es' } }),
      async (req) => {
        if (req.api === 'calendar' && req.operation === 'calendars') {
          return { success: false, error: 'Permission denied: calendar.create required' };
        }
        throw new Error('Unexpected call on permission denied: ' + JSON.stringify(req));
      }
    );
    assert(out.type === 'ui' && out.ui.icon === 'error' && out.ui.badgeColor === 'red' && out.ui.title === 'Calendar Error', 'Red English error card');
    assert(out.ui.elements[2].buttons[0].label === 'Retry', 'Retry button');
  }

  // Test 5: Conversational JSON events/update/delete/missing_title -> Grounded verbatim type:"direct" text (0% hallucination, exact day bounds, 0 AI calls!)
  {
    const outEvents = await execPlugin(
      JSON.stringify({ api: 'calendar', operation: 'events', payload: { startdate: '2026-11-26', enddate: '2026-11-27', lang: 'es' } }),
      async (req) => {
        if (req.api === 'calendar' && req.operation === 'calendars') {
          return { success: true, data: { calendars: [{ id: 'cal_main', isReadOnly: false, isDefault: true }] } };
        }
        assert(req.api === 'calendar' && req.operation === 'events', 'Only calls calendar.events');
        assert(req.payload.calendarId === 'cal_main', 'Resolves writable calendarId');
        assert(req.payload.startDate === '2026-11-26T00:00:00' && req.payload.endDate === '2026-11-27T23:59:59', 'Date-only bounds expanded to full day');
        return { success: true, data: { count: 1, events: [{ id: 'p1', calendarId: 'cal_main', title: 'Meeting', start: '2026-11-26T10:00:00', end: '2026-11-26T11:00:00', allDay: false, description: 'Room B' }] } };
      }
    );
    assert(outEvents.type === 'direct' && outEvents.displayText.includes('Calendar events for 2026-11-26 to 2026-11-27 (1):') && outEvents.displayText.includes('- Meeting (2026-11-26, 10:00 - 11:00) - Room B'), 'Verbatim grounded range events text');

    // Single-day query with start only (no end) must auto-cap endDate to 23:59:59 of that day (never +30 days!)
    const outTomorrow = await execPlugin(
      JSON.stringify({ api: 'calendar', operation: 'events', payload: { start: '2026-11-19', lang: 'es' } }),
      async (req) => {
        if (req.api === 'calendar' && req.operation === 'calendars') {
          return { success: true, data: { calendars: [{ id: 'cal_main', isReadOnly: false, isDefault: true }] } };
        }
        assert(req.payload.startDate === '2026-11-19T00:00:00' && req.payload.endDate === '2026-11-19T23:59:59', 'Start-only auto-capped to single day');
        return { success: true, data: { count: 1, events: [{ id: 'm1', calendarId: 'cal_main', title: 'Sync', start: '2026-11-19T15:00:00', end: '2026-11-19T16:00:00', allDay: false, description: '' }] } };
      }
    );
    assert(outTomorrow.type === 'direct' && outTomorrow.displayText === 'Calendar events for 2026-11-19 (1):\n- Sync (2026-11-19, 15:00 - 16:00)', 'Exact single-day response');

    const outTomorrowEmpty = await execPlugin(
      JSON.stringify({ api: 'calendar', operation: 'events', payload: { start: '2026-11-19T00:00:00', end: '2026-11-19T23:59:59', lang: 'es' } }),
      async (req) => {
        if (req.api === 'calendar' && req.operation === 'calendars') return { success: true, data: { calendars: [{ id: 'cal_main', isReadOnly: false, isDefault: true }] } };
        return { success: true, data: { count: 0, events: [] } };
      }
    );
    assert(outTomorrowEmpty.type === 'direct' && outTomorrowEmpty.displayText === 'No events found for 2026-11-19.', 'Empty single-day message');

    const outUpd = await execPlugin(
      JSON.stringify({ api: 'calendar', operation: 'update', payload: { eventid: 'e1', calendarid: 'c1', title: 'Updated', lang: 'fr' } }),
      async (req) => {
        assert(req.api === 'calendar' && req.operation === 'update' && req.payload.eventId === 'e1' && req.payload.calendarId === 'c1', 'Update camelCase IDs');
        return { success: true, data: { updated: true, eventId: 'e1' } };
      }
    );
    assert(outUpd.type === 'direct' && outUpd.displayText === 'Event updated (ID: e1).', 'Update returns grounded direct text');

    const outDel = await execPlugin(
      JSON.stringify({ api: 'calendar', operation: 'delete', payload: { eventid: 'ev-9', calendarid: 'cal-1', lang: 'es' } }),
      async (req) => {
        assert(req.api === 'calendar' && req.operation === 'delete' && req.payload.eventId === 'ev-9' && req.payload.calendarId === 'cal-1', 'Delete camelCase IDs');
        return { success: true, data: { deleted: true } };
      }
    );
    assert(outDel.type === 'direct' && outDel.displayText === 'Event deleted (ID: ev-9).', 'Delete returns grounded direct text');

    const outMiss = await execPlugin(
      JSON.stringify({ api: 'calendar', operation: 'create', payload: { startdate: '2026-11-26T09:00:00', lang: 'en' } }),
      async () => { throw new Error('missing_title in JSON mode must make 0 host calls'); }
    );
    assert(outMiss.type === 'direct' && outMiss.displayText.includes('event title'), 'missing_title returns grounded direct text');
  }

  // Test 6: Direct /calendar help (AI + offline English fallback) + pipe-format create + operation:"inbox" empty grounded text
  {
    const outHelp = await execPlugin('help lang=de', async (req) => {
      assert(req.api === 'ai' && req.payload.systemPrompt.includes('"de"'), 'Direct help passes lang');
      return { success: true, data: { text: 'So nutzt du den Kalender in Chattree...' } };
    });
    assert(outHelp.type === 'direct' && outHelp.displayText.includes('Kalender'), 'Help direct AI text');

    const outHelpFb = await execPlugin('help lang=en', async () => ({ success: false, error: 'Offline' }));
    assert(outHelpFb.type === 'direct' && outHelpFb.displayText.includes('Use /calendar'), 'English offline help fallback');

    const outPipe = await execPlugin('Dentist | 2026-11-25T10:00:00 | 2026-11-25T11:00:00 | Checkup lang=es', async (req) => {
      if (req.operation === 'calendars') return { success: true, data: { calendars: [{ id: 'c1', isReadOnly: false, isDefault: true }] } };
      if (req.operation === 'create') return { success: true, data: { created: true, title: 'Dentist', start: '2026-11-25T10:00:00', end: '2026-11-25T11:00:00' } };
      throw new Error('Unexpected pipe call');
    });
    assert(outPipe.type === 'ui' && outPipe.ui.title === 'Event Scheduled' && outPipe.ui.elements[0].items.length === 4, 'Pipe create renders instant Flutter UI card');

    const outInbox = await execPlugin(
      JSON.stringify({ api: 'calendar', operation: 'inbox', payload: { lang: 'pt' } }),
      async (req) => {
        if (req.api === 'calendar' && req.operation === 'calendars') return { success: true, data: { calendars: [{ id: 'c1', isReadOnly: false, isDefault: true }] } };
        assert(req.api === 'calendar' && req.operation === 'events', 'operation:inbox routes to calendar.events');
        return { success: true, data: { count: 0, events: [] } };
      }
    );
    assert(outInbox.type === 'direct' && outInbox.displayText === 'No upcoming events found in your calendar.', 'Empty events returns grounded direct text with 0 hallucination');
  }

  console.log('ALL CALENDAR WASM TESTS PASSED (6/6 suites)!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
