import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDir = path.resolve(__dirname, '../plugins/official/briefing');
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
  if (staticPtr >= 256000) {
    throw new Error(`Static data overflow past 256000 at ${name}: ${staticPtr}`);
  }
  dataEntries.push({ name, offset, strLen: d.strLen, escaped: d.escaped });
  return { offset, len: d.strLen };
}

const S = {};

// Storage templates
S.st_get_p = registerData('st_get_p', '{"api":"storage","operation":"get","payload":{"key":"');
S.st_set_p = registerData('st_set_p', '{"api":"storage","operation":"set","payload":{"key":"');
S.st_set_m = registerData('st_set_m', '","value":"');
S.st_end = registerData('st_end', '"}}');

S.sk_city = registerData('sk_city', 'briefing_city');
S.sk_lat = registerData('sk_lat', 'briefing_lat');
S.sk_lon = registerData('sk_lon', 'briefing_lon');
S.sk_sched = registerData('sk_sched', 'briefing_schedule');
S.sk_date = registerData('sk_date', 'briefing_date');
S.sk_note = registerData('sk_note', 'briefing_note');
S.s_default_note = registerData('s_default_note', 'Daily');

// Host API request templates
S.req_cals = registerData('req_cals', '{"api":"calendar","operation":"calendars","payload":{}}');
S.req_ev_p1 = registerData('req_ev_p1', '{"api":"calendar","operation":"events","payload":{"calendarId":"');
S.req_ev_p2 = registerData('req_ev_p2', '","startDate":"');
S.req_ev_p3 = registerData('req_ev_p3', 'T00:00:00","endDate":"');
S.req_ev_p4 = registerData('req_ev_p4', 'T23:59:59"}}');
S.req_ev_end_nodate = registerData('req_ev_end_nodate', '"}}');

S.req_rems = registerData('req_rems', '{"api":"chattree.reminders","operation":"list","payload":{"pendingOnly":true,"limit":10}}');
S.req_mail = registerData('req_mail', '{"api":"email","operation":"inbox","payload":{}}');
S.req_note_p1 = registerData('req_note_p1', '{"api":"chattree.notes","operation":"search","payload":{"query":"');
S.req_note_p2 = registerData('req_note_p2', '","limit":1}}');
S.req_note_get_p1 = registerData('req_note_get_p1', '{"api":"chattree.notes","operation":"get","payload":{"id":"');
S.req_note_get_p2 = registerData('req_note_get_p2', '"}}');

S.req_geo_p1 = registerData('req_geo_p1', '{"api":"network","operation":"http_request","payload":{"url":"https://geocoding-api.open-meteo.com/v1/search?name=');
S.req_geo_p2 = registerData('req_geo_p2', '&count=1&language=en&format=json","method":"GET","timeoutMs":15000}}');
S.req_ipgeo = registerData('req_ipgeo', '{"api":"network","operation":"http_request","payload":{"url":"https://ipwho.is/?fields=success,city,latitude,longitude","method":"GET","timeoutMs":10000}}');

S.req_wx_p1 = registerData('req_wx_p1', '{"api":"network","operation":"http_request","payload":{"url":"https://api.open-meteo.com/v1/forecast?latitude=');
S.req_wx_p2 = registerData('req_wx_p2', '&longitude=');
S.req_wx_p3 = registerData('req_wx_p3', '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto","method":"GET","timeoutMs":15000}}');

S.req_sched_p1 = registerData('req_sched_p1', '{"api":"scheduler","operation":"schedule","payload":{"taskId":"daily_briefing","targetAction":"briefing","cronExpression":"');
S.req_sched_p2 = registerData('req_sched_p2', ' * * *"}}');
S.req_unsched = registerData('req_unsched', '{"api":"scheduler","operation":"cancel","payload":{"taskId":"daily_briefing"}}');

S.req_notif_p1 = registerData('req_notif_p1', '{"api":"notifications","operation":"send","payload":{"title":"Daily Briefing","body":"');
S.req_notif_p2 = registerData('req_notif_p2', '"}}');

// JSON keys
S.k_op = registerData('k_op', 'operation');
S.k_action = registerData('k_action', 'action');
S.k_city = registerData('k_city', 'city');
S.k_time = registerData('k_time', 'time');
S.k_date = registerData('k_date', 'date');
S.k_note = registerData('k_note', 'note');
S.k_content = registerData('k_content', 'content');
S.k_query = registerData('k_query', 'query');
S.k_value = registerData('k_value', 'value');
S.k_success = registerData('k_success', 'success');
S.k_id = registerData('k_id', 'id');
S.k_title = registerData('k_title', 'title');
S.k_subject = registerData('k_subject', 'subject');
S.k_unread_cnt = registerData('k_unread_cnt', 'unread_count');
S.k_count = registerData('k_count', 'count');
S.k_body = registerData('k_body', 'body');
S.k_name = registerData('k_name', 'name');
S.k_lat = registerData('k_lat', 'latitude');
S.k_lon = registerData('k_lon', 'longitude');
S.k_temp = registerData('k_temp', 'temperature_2m');
S.k_wcode = registerData('k_wcode', 'weather_code');
S.k_tmax = registerData('k_tmax', 'temperature_2m_max');
S.k_tmin = registerData('k_tmin', 'temperature_2m_min');
S.k_current = registerData('k_current', '"current"');
S.k_daily = registerData('k_daily', '"daily"');
S.k_lang_eq = registerData('k_lang_eq', 'lang=');
S.hex_chars = registerData('hex_chars', '0123456789ABCDEF');

// Actions
S.a_briefing = registerData('a_briefing', 'briefing');
S.a_today = registerData('a_today', 'today');
S.a_now = registerData('a_now', 'now');
S.a_notify = registerData('a_notify', 'notify');
S.a_city = registerData('a_city', 'city');
S.a_weather = registerData('a_weather', 'weather');
S.a_location = registerData('a_location', 'location');
S.a_schedule = registerData('a_schedule', 'schedule');
S.a_cron = registerData('a_cron', 'cron');
S.a_unschedule = registerData('a_unschedule', 'unschedule');
S.a_cancel = registerData('a_cancel', 'cancel');
S.a_off = registerData('a_off', 'off');
S.a_status = registerData('a_status', 'status');
S.a_help = registerData('a_help', 'help');
S.a_note = registerData('a_note', 'note');

// UI Card JSON fragments (blue Chattree theme)
S.ui_start = registerData('ui_start', '{"type":"ui","displayText":"');
S.ui_mid1 = registerData('ui_mid1', '","ui":{"title":"');
S.ui_sub = registerData('ui_sub', '","subtitle":"');
S.ui_badge = registerData('ui_badge', '","badge":"');
S.ui_bc_green = registerData('ui_bc_green', '","badgeColor":"blue","icon":"info","hideText":true,"elements":[');
S.ui_bc_alarm = registerData('ui_bc_alarm', '","badgeColor":"blue","icon":"alarm","hideText":true,"elements":[');
S.ui_bc_orange = registerData('ui_bc_orange', '","badgeColor":"orange","icon":"warning","hideText":true,"elements":[');
S.ui_bc_red = registerData('ui_bc_red', '","badgeColor":"red","icon":"error","hideText":true,"elements":[');
S.ui_end = registerData('ui_end', ']}}');
S.el_divider = registerData('el_divider', '{"type":"divider"}');

S.el_kv_start = registerData('el_kv_start', '{"type":"key_value","items":[');
S.el_kv_1 = registerData('el_kv_1', '{"key":"');
S.el_kv_2 = registerData('el_kv_2', '","value":"');
S.el_kv_item_end = registerData('el_kv_item_end', '"}');
S.el_kv_end = registerData('el_kv_end', ']}');
S.el_list_start = registerData('el_list_start', '{"type":"list","items":[');
S.el_list_1 = registerData('el_list_1', '{"title":"');
S.el_list_2 = registerData('el_list_2', '","subtitle":"');
S.el_list_end = registerData('el_list_end', ']}');
S.el_text_1 = registerData('el_text_1', '{"type":"text","content":"');
S.el_text_end = registerData('el_text_end', '"}');
S.el_btns_main = registerData('el_btns_main', '{"type":"button_row","buttons":[{"label":"Refresh","action":"command","value":"/briefing","style":"primary"},{"label":"Schedule 08:00","action":"command","value":"/briefing schedule 08:00","style":"secondary"},{"label":"Help","action":"command","value":"/briefing help","style":"secondary"}]}');
S.el_btns_simple = registerData('el_btns_simple', '{"type":"button_row","buttons":[{"label":"Get Briefing","action":"command","value":"/briefing","style":"primary"},{"label":"Status","action":"command","value":"/briefing status","style":"secondary"}]}');

// Copy strings
S.t_brief_title = registerData('t_brief_title', 'Daily Briefing');
S.t_brief_sub = registerData('t_brief_sub', 'Calendar, reminders, inbox & weather');
S.t_brief_badge = registerData('t_brief_badge', 'TODAY');
S.t_date_pfx = registerData('t_date_pfx', 'Summary for ');

S.kv_weather = registerData('kv_weather', 'Weather');
S.kv_calendar = registerData('kv_calendar', 'Calendar Events');
S.kv_reminders = registerData('kv_reminders', 'Pending Reminders');
S.kv_email = registerData('kv_email', 'Unread Emails');
S.kv_schedule = registerData('kv_schedule', 'Auto Schedule');
S.kv_note = registerData('kv_note', 'Daily Note');
S.kv_city = registerData('kv_city', 'City');
S.kv_coords = registerData('kv_coords', 'Coordinates');

S.s_not_set_city = registerData('s_not_set_city', 'Not set (/briefing city <name>)');
S.s_no_note = registerData('s_no_note', 'Create a note titled Daily to show it here');
S.s_empty_note = registerData('s_empty_note', 'Empty note');
S.s_note_hdr_p = registerData('s_note_hdr_p', 'Note: ');
S.s_note_hdr_s = registerData('s_note_hdr_s', '\\n');
S.t_note_ok = registerData('t_note_ok', 'Briefing Note Saved');
S.t_note_ok_sub = registerData('t_note_ok_sub', 'This Chattree note will appear inside your daily briefing');
S.t_note_ok_badge = registerData('t_note_ok_badge', 'SAVED');
S.s_wx_err = registerData('s_wx_err', 'Unavailable right now');
S.s_not_cfg_mail = registerData('s_not_cfg_mail', 'Not configured');
S.s_not_sched = registerData('s_not_sched', 'Off (/briefing schedule 08:00)');
S.s_daily_at = registerData('s_daily_at', 'Daily at ');
S.s_events_word = registerData('s_events_word', ' events');
S.s_event_word = registerData('s_event_word', ' event');
S.s_rems_word = registerData('s_rems_word', ' pending');
S.s_unread_word = registerData('s_unread_word', ' unread');
S.s_deg_c = registerData('s_deg_c', ' C');
S.s_hl_p = registerData('s_hl_p', ' (H: ');
S.s_hl_m = registerData('s_hl_m', ' / L: ');
S.s_hl_e = registerData('s_hl_e', ')');
S.s_sub_event = registerData('s_sub_event', 'Calendar Event');
S.s_sub_rem = registerData('s_sub_rem', 'Chattree Reminder');
S.s_sub_mail = registerData('s_sub_mail', 'Recent Email');

// Weather descriptions
S.w_clear = registerData('w_clear', 'Clear');
S.w_partly = registerData('w_partly', 'Partly Cloudy');
S.w_fog = registerData('w_fog', 'Foggy');
S.w_rain = registerData('w_rain', 'Rain');
S.w_snow = registerData('w_snow', 'Snow');
S.w_showers = registerData('w_showers', 'Showers');
S.w_storm = registerData('w_storm', 'Thunderstorm');

// Confirmation / Error / Status / Help cards
S.t_city_ok = registerData('t_city_ok', 'Weather City Saved');
S.t_city_ok_sub = registerData('t_city_ok_sub', 'Open-Meteo forecast enabled for your briefing');
S.t_city_ok_badge = registerData('t_city_ok_badge', 'SAVED');
S.t_city_err = registerData('t_city_err', 'City Not Found');
S.t_city_err_sub = registerData('t_city_err_sub', 'Could not geocode that location');
S.t_city_err_badge = registerData('t_city_err_badge', 'NOT FOUND');
S.t_city_err_body = registerData('t_city_err_body', 'Please provide a valid city name, e.g. /briefing city Madrid or /briefing city Mexico City.');

S.t_sched_ok = registerData('t_sched_ok', 'Morning Briefing Scheduled');
S.t_sched_ok_sub = registerData('t_sched_ok_sub', 'Automatic daily cron task registered');
S.t_sched_ok_badge = registerData('t_sched_ok_badge', 'SCHEDULED');
S.t_sched_err = registerData('t_sched_err', 'Invalid Time Format');
S.t_sched_err_sub = registerData('t_sched_err_sub', 'Use 24-hour HH:MM format');
S.t_sched_err_badge = registerData('t_sched_err_badge', 'INVALID');
S.t_sched_err_body = registerData('t_sched_err_body', 'Example: /briefing schedule 08:00 or /briefing schedule 07:30');

S.t_unsched_ok = registerData('t_unsched_ok', 'Schedule Cancelled');
S.t_unsched_ok_sub = registerData('t_unsched_ok_sub', 'Automatic morning briefing disabled');
S.t_unsched_ok_badge = registerData('t_unsched_ok_badge', 'OFF');
S.t_unsched_body = registerData('t_unsched_body', 'Your daily briefing cron task was removed. You can still run /briefing anytime.');

S.t_status_title = registerData('t_status_title', 'Briefing Settings');
S.t_status_sub = registerData('t_status_sub', 'Current city and daily cron schedule');
S.t_status_badge = registerData('t_status_badge', 'STATUS');

S.t_help_title = registerData('t_help_title', 'Daily Briefing Guide');
S.t_help_sub = registerData('t_help_sub', 'Morning summary: calendar, reminders, email & weather');
S.t_help_badge = registerData('t_help_badge', 'GUIDE');
S.t_help_body = registerData('t_help_body', 'Commands & natural language:\\n- /briefing — Get your morning briefing now\\n- /briefing city <name> — Set city for live Open-Meteo weather\\n- /briefing note <title> — Choose Chattree note to display (default: Daily)\\n- /briefing schedule 08:00 — Schedule automatic daily briefing\\n- /briefing unschedule — Turn off automatic schedule\\n- /briefing status — View saved city, note & schedule');

const dataBlock = dataEntries
  .map((e) => `  (data (i32.const ${e.offset}) "${e.escaped}") ;; ${e.name} (${e.strLen})`)
  .join('\n');

const wat = `;; Chattree Official Daily Briefing Plugin v1.0.0
;; Combines calendar.events + chattree.reminders + email.inbox + Open-Meteo weather + scheduler.cron
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; 32 pages = 2 MB linear memory
  (memory (export "memory") 32)

  (global $state        (mut i32) (i32.const 0))
  (global $want_notify  (mut i32) (i32.const 0))
  (global $act_len      (mut i32) (i32.const 0))
  (global $arg_len      (mut i32) (i32.const 0))
  (global $date_len     (mut i32) (i32.const 0))
  (global $city_len     (mut i32) (i32.const 0))
  (global $lat_len      (mut i32) (i32.const 0))
  (global $lon_len      (mut i32) (i32.const 0))
  (global $sched_len    (mut i32) (i32.const 0))
  (global $note_key_len (mut i32) (i32.const 0))
  (global $cal_id_len   (mut i32) (i32.const 0))

  (global $ev_count     (mut i32) (i32.const 0))
  (global $ev_shown     (mut i32) (i32.const 0))
  (global $rem_count    (mut i32) (i32.const 0))
  (global $rem_shown    (mut i32) (i32.const 0))
  (global $mail_ok      (mut i32) (i32.const 0))
  (global $mail_unread  (mut i32) (i32.const 0))
  (global $mail_shown   (mut i32) (i32.const 0))
  (global $note_found   (mut i32) (i32.const 0))
  (global $note_t_len   (mut i32) (i32.const 0))
  (global $note_c_len   (mut i32) (i32.const 0))
  (global $wx_ok        (mut i32) (i32.const 0))
  (global $temp_len     (mut i32) (i32.const 0))
  (global $tmax_len     (mut i32) (i32.const 0))
  (global $tmin_len     (mut i32) (i32.const 0))
  (global $wcode        (mut i32) (i32.const 0))
  (global $out_ptr      (mut i32) (i32.const 65536))

  ;; ── Static Data Segments (200000+) ───────────────────────────────────
${dataBlock}

  ;; ── Core Utilities ───────────────────────────────────────────────────

  (func $zlen (param $ptr i32) (result i32)
    (local $i i32)
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.ne (i32.load8_u (i32.add (local.get $ptr) (local.get $i))) (i32.const 0))
        (then (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $l))
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

  (func $str_eq_z (param $a i32) (param $alen i32) (param $bz i32) (result i32)
    (local $blen i32) (local $i i32)
    (local.set $blen (call $zlen (local.get $bz)))
    (if (i32.ne (local.get $alen) (local.get $blen)) (then (return (i32.const 0))))
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.lt_u (local.get $i) (local.get $alen))
        (then
          (if (i32.ne (i32.load8_u (i32.add (local.get $a) (local.get $i))) (i32.load8_u (i32.add (local.get $bz) (local.get $i))))
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
      (if (i32.gt_u (i32.add (local.get $i) (local.get $nlen)) (local.get $hlen)) (then (return (i32.const -1))))
      (local.set $j (i32.const 0))
      (local.set $m (i32.const 1))
      (loop $in
        (if (i32.lt_u (local.get $j) (local.get $nlen))
          (then
            (if (i32.ne (i32.load8_u (i32.add (local.get $hay) (i32.add (local.get $i) (local.get $j))))
                        (i32.load8_u (i32.add (local.get $ned) (local.get $j))))
              (then (local.set $m (i32.const 0)))
              (else (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $in))
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
      (then (i32.store8 (local.get $dst) (local.get $cp)) (return (i32.add (local.get $dst) (i32.const 1))))
    )
    (if (i32.le_u (local.get $cp) (i32.const 2047))
      (then
        (i32.store8 (local.get $dst) (i32.or (i32.const 192) (i32.shr_u (local.get $cp) (i32.const 6))))
        (i32.store8 (i32.add (local.get $dst) (i32.const 1)) (i32.or (i32.const 128) (i32.and (local.get $cp) (i32.const 63))))
        (return (i32.add (local.get $dst) (i32.const 2)))
      )
    )
    (i32.store8 (local.get $dst) (i32.or (i32.const 224) (i32.shr_u (local.get $cp) (i32.const 12))))
    (i32.store8 (i32.add (local.get $dst) (i32.const 1)) (i32.or (i32.const 128) (i32.and (i32.shr_u (local.get $cp) (i32.const 6)) (i32.const 63))))
    (i32.store8 (i32.add (local.get $dst) (i32.const 2)) (i32.or (i32.const 128) (i32.and (local.get $cp) (i32.const 63))))
    (i32.add (local.get $dst) (i32.const 3))
  )

  ;; Output buffer emitters
  (func $emit_reset (global.set $out_ptr (i32.const 65536)))
  (func $emit_byte (param $b i32) (i32.store8 (global.get $out_ptr) (local.get $b)) (global.set $out_ptr (i32.add (global.get $out_ptr) (i32.const 1))))
  (func $emit_zstr (param $z i32) (global.set $out_ptr (call $copy_zstr (local.get $z) (global.get $out_ptr))))
  (func $emit_mem (param $ptr i32) (param $len i32) (global.set $out_ptr (call $copy_mem (local.get $ptr) (global.get $out_ptr) (local.get $len))))
  (func $emit_len (result i32) (i32.sub (global.get $out_ptr) (i32.const 65536)))

  (func $emit_json_esc (param $ptr i32) (param $len i32)
    (local $i i32) (local $ch i32)
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 34)) (i32.eq (local.get $ch) (i32.const 92)))
            (then (call $emit_byte (i32.const 92)) (call $emit_byte (local.get $ch)))
            (else
              (if (i32.eq (local.get $ch) (i32.const 10))
                (then (call $emit_byte (i32.const 92)) (call $emit_byte (i32.const 110)))
                (else (if (i32.ge_u (local.get $ch) (i32.const 32)) (then (call $emit_byte (local.get $ch)))))
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
    (if (i32.le_s (local.get $n) (i32.const 0)) (then (call $emit_byte (i32.const 48)) (return)))
    (local.set $v (local.get $n))
    (local.set $len (i32.const 0))
    (loop $rev
      (if (i32.gt_u (local.get $v) (i32.const 0))
        (then
          (i32.store8 (i32.add (i32.const 260940) (local.get $len)) (i32.add (i32.const 48) (i32.rem_u (local.get $v) (i32.const 10))))
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
          (call $emit_byte (i32.load8_u (i32.add (i32.const 260940) (local.get $i))))
          (br $wr)
        )
      )
    )
  )

  (func $buf_uint (param $p i32) (param $n i32) (result i32)
    (local $len i32) (local $v i32) (local $i i32)
    (if (i32.le_s (local.get $n) (i32.const 0))
      (then (i32.store8 (local.get $p) (i32.const 48)) (return (i32.add (local.get $p) (i32.const 1))))
    )
    (local.set $v (local.get $n))
    (local.set $len (i32.const 0))
    (loop $rev
      (if (i32.gt_u (local.get $v) (i32.const 0))
        (then
          (i32.store8 (i32.add (i32.const 260940) (local.get $len)) (i32.add (i32.const 48) (i32.rem_u (local.get $v) (i32.const 10))))
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
          (i32.store8 (local.get $p) (i32.load8_u (i32.add (i32.const 260940) (local.get $i))))
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (br $wr)
        )
      )
    )
    (local.get $p)
  )

  ;; URL-encode $src[0..$len] into 262400, returns encoded length
  (func $url_encode (param $src i32) (param $len i32) (result i32)
    (local $i i32) (local $out i32) (local $ch i32)
    (local.set $i (i32.const 0))
    (local.set $out (i32.const 0))
    (loop $l
      (if (i32.and (i32.lt_u (local.get $i) (local.get $len)) (i32.lt_u (local.get $out) (i32.const 240)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.or
                (i32.or (i32.and (i32.ge_u (local.get $ch) (i32.const 65)) (i32.le_u (local.get $ch) (i32.const 90)))
                        (i32.and (i32.ge_u (local.get $ch) (i32.const 97)) (i32.le_u (local.get $ch) (i32.const 122))))
                (i32.or (i32.and (i32.ge_u (local.get $ch) (i32.const 48)) (i32.le_u (local.get $ch) (i32.const 57)))
                        (i32.or (i32.eq (local.get $ch) (i32.const 45)) (i32.eq (local.get $ch) (i32.const 95)))))
            (then
              (i32.store8 (i32.add (i32.const 262400) (local.get $out)) (local.get $ch))
              (local.set $out (i32.add (local.get $out) (i32.const 1)))
            )
            (else
              (i32.store8 (i32.add (i32.const 262400) (local.get $out)) (i32.const 37))
              (i32.store8 (i32.add (i32.const 262400) (i32.add (local.get $out) (i32.const 1)))
                (i32.load8_u (i32.add (i32.const ${S.hex_chars.offset}) (i32.shr_u (local.get $ch) (i32.const 4)))))
              (i32.store8 (i32.add (i32.const 262400) (i32.add (local.get $out) (i32.const 2)))
                (i32.load8_u (i32.add (i32.const ${S.hex_chars.offset}) (i32.and (local.get $ch) (i32.const 15)))))
              (local.set $out (i32.add (local.get $out) (i32.const 3)))
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (local.get $out)
  )

  ;; Strip trailing lang=<code>
  (func $strip_lang (param $ptr i32) (param $len i32) (result i32)
    (local $i i32) (local $ts i32) (local $tl i32) (local $nl i32)
    (if (i32.le_s (local.get $len) (i32.const 0)) (then (return (i32.const 0))))
    (if (call $starts_with_z (local.get $ptr) (local.get $len) (i32.const ${S.k_lang_eq.offset}))
      (then
        (local.set $i (i32.const 0))
        (loop $b
          (if (i32.lt_u (local.get $i) (local.get $len))
            (then
              (if (call $is_ws (i32.load8_u (i32.add (local.get $ptr) (local.get $i)))) (then (return (local.get $len))))
              (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $b)
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
          (if (i32.eqz (call $is_ws (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))) (then (br $fs)))
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

  ;; ── JSON Extractors ──────────────────────────────────────────────────

  ;; Find offset of value start after "key" : (returns -1 if not found)
  (func $find_json_val (param $json i32) (param $jlen i32) (param $key_z i32) (result i32)
    (local $klen i32) (local $i i32) (local $j i32) (local $m i32) (local $pos i32)
    (local.set $klen (call $zlen (local.get $key_z)))
    (local.set $i (i32.const 0))
    (loop $scan
      (if (i32.gt_u (i32.add (local.get $i) (i32.add (local.get $klen) (i32.const 3))) (local.get $jlen))
        (then (return (i32.const -1)))
      )
      (if (i32.and
            (i32.eq (i32.load8_u (i32.add (local.get $json) (local.get $i))) (i32.const 34))
            (i32.eq (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $i) (i32.add (local.get $klen) (i32.const 1))))) (i32.const 34)))
        (then
          (local.set $j (i32.const 0))
          (local.set $m (i32.const 1))
          (loop $cmp
            (if (i32.lt_u (local.get $j) (local.get $klen))
              (then
                (if (i32.ne (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $i) (i32.add (local.get $j) (i32.const 1)))))
                            (i32.load8_u (i32.add (local.get $key_z) (local.get $j))))
                  (then (local.set $m (i32.const 0)))
                  (else (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $cmp))
                )
              )
            )
          )
          (if (local.get $m)
            (then
              (local.set $pos (i32.add (local.get $i) (i32.add (local.get $klen) (i32.const 2))))
              (loop $w1
                (if (i32.and (i32.lt_u (local.get $pos) (local.get $jlen)) (call $is_ws (i32.load8_u (i32.add (local.get $json) (local.get $pos)))))
                  (then (local.set $pos (i32.add (local.get $pos) (i32.const 1))) (br $w1))
                )
              )
              (if (i32.and (i32.lt_u (local.get $pos) (local.get $jlen)) (i32.eq (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 58)))
                (then
                  (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
                  (loop $w2
                    (if (i32.and (i32.lt_u (local.get $pos) (local.get $jlen)) (call $is_ws (i32.load8_u (i32.add (local.get $json) (local.get $pos)))))
                      (then (local.set $pos (i32.add (local.get $pos) (i32.const 1))) (br $w2))
                    )
                  )
                  (return (local.get $pos))
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

  ;; Extract JSON string with \\uXXXX decoding (returns len or -1)
  (func $extract_json_str (param $json i32) (param $jlen i32) (param $key_z i32) (param $dst i32) (param $max_out i32) (result i32)
    (local $pos i32) (local $out i32) (local $ch i32) (local $esc i32)
    (local $d0 i32) (local $d1 i32) (local $d2 i32) (local $d3 i32) (local $cp i32)
    (local.set $pos (call $find_json_val (local.get $json) (local.get $jlen) (local.get $key_z)))
    (if (i32.or (i32.lt_s (local.get $pos) (i32.const 0)) (i32.ge_u (local.get $pos) (local.get $jlen))) (then (return (i32.const -1))))
    (if (i32.ne (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 34)) (then (return (i32.const -1))))
    (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
    (local.set $out (local.get $dst))
    (loop $read
      (if (i32.and (i32.lt_u (local.get $pos) (local.get $jlen)) (i32.lt_u (i32.sub (local.get $out) (local.get $dst)) (local.get $max_out)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
          (if (i32.eq (local.get $ch) (i32.const 34)) (then (return (i32.sub (local.get $out) (local.get $dst)))))
          (if (i32.eq (local.get $ch) (i32.const 92))
            (then
              (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
              (if (i32.ge_u (local.get $pos) (local.get $jlen)) (then (return (i32.sub (local.get $out) (local.get $dst)))))
              (local.set $esc (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
              (if (i32.and (i32.eq (local.get $esc) (i32.const 117)) (i32.le_u (i32.add (local.get $pos) (i32.const 4)) (local.get $jlen)))
                (then
                  (local.set $d0 (call $hex_val (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 1))))))
                  (local.set $d1 (call $hex_val (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 2))))))
                  (local.set $d2 (call $hex_val (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 3))))))
                  (local.set $d3 (call $hex_val (i32.load8_u (i32.add (local.get $json) (i32.add (local.get $pos) (i32.const 4))))))
                  (if (i32.and (i32.and (i32.ge_s (local.get $d0) (i32.const 0)) (i32.ge_s (local.get $d1) (i32.const 0)))
                               (i32.and (i32.ge_s (local.get $d2) (i32.const 0)) (i32.ge_s (local.get $d3) (i32.const 0))))
                    (then
                      (local.set $cp (i32.or (i32.or (i32.shl (local.get $d0) (i32.const 12)) (i32.shl (local.get $d1) (i32.const 8)))
                                             (i32.or (i32.shl (local.get $d2) (i32.const 4)) (local.get $d3))))
                      (if (i32.le_u (i32.add (i32.sub (local.get $out) (local.get $dst)) (i32.const 3)) (local.get $max_out))
                        (then (local.set $out (call $write_utf8 (local.get $cp) (local.get $out))))
                      )
                      (local.set $pos (i32.add (local.get $pos) (i32.const 5)))
                      (br $read)
                    )
                  )
                )
              )
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

  ;; Extract raw JSON number (or first number inside [...]) as ASCII string into $dst (returns len or -1)
  (func $extract_json_num_str (param $json i32) (param $jlen i32) (param $key_z i32) (param $dst i32) (param $max_out i32) (result i32)
    (local $pos i32) (local $out i32) (local $ch i32)
    (local.set $pos (call $find_json_val (local.get $json) (local.get $jlen) (local.get $key_z)))
    (if (i32.or (i32.lt_s (local.get $pos) (i32.const 0)) (i32.ge_u (local.get $pos) (local.get $jlen))) (then (return (i32.const -1))))
    ;; Allow array wrapper like [24.5]
    (if (i32.eq (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 91))
      (then (local.set $pos (i32.add (local.get $pos) (i32.const 1))))
    )
    (local.set $out (i32.const 0))
    (loop $rn
      (if (i32.and (i32.lt_u (local.get $pos) (local.get $jlen)) (i32.lt_u (local.get $out) (local.get $max_out)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
          (if (i32.or (i32.and (i32.ge_u (local.get $ch) (i32.const 48)) (i32.le_u (local.get $ch) (i32.const 57)))
                      (i32.or (i32.eq (local.get $ch) (i32.const 45)) (i32.eq (local.get $ch) (i32.const 46))))
            (then
              (i32.store8 (i32.add (local.get $dst) (local.get $out)) (local.get $ch))
              (local.set $out (i32.add (local.get $out) (i32.const 1)))
              (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
              (br $rn)
            )
          )
        )
      )
    )
    (if (i32.eqz (local.get $out)) (then (return (i32.const -1))))
    (local.get $out)
  )

  ;; Extract integer from JSON key (returns -1 if missing)
  (func $extract_json_int (param $json i32) (param $jlen i32) (param $key_z i32) (result i32)
    (local $nlen i32) (local $i i32) (local $val i32) (local $ch i32)
    (local.set $nlen (call $extract_json_num_str (local.get $json) (local.get $jlen) (local.get $key_z) (i32.const 260940) (i32.const 16)))
    (if (i32.le_s (local.get $nlen) (i32.const 0)) (then (return (i32.const -1))))
    (local.set $val (i32.const 0))
    (local.set $i (i32.const 0))
    (loop $p
      (if (i32.lt_u (local.get $i) (local.get $nlen))
        (then
          (local.set $ch (i32.load8_u (i32.add (i32.const 260940) (local.get $i))))
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 48)) (i32.le_u (local.get $ch) (i32.const 57)))
            (then
              (local.set $val (i32.add (i32.mul (local.get $val) (i32.const 10)) (i32.sub (local.get $ch) (i32.const 48))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $p)
            )
          )
        )
      )
    )
    (local.get $val)
  )

  ;; Extract boolean true (1) vs false/missing (0)
  (func $extract_json_bool (param $json i32) (param $jlen i32) (param $key_z i32) (result i32)
    (local $pos i32)
    (local.set $pos (call $find_json_val (local.get $json) (local.get $jlen) (local.get $key_z)))
    (if (i32.or (i32.lt_s (local.get $pos) (i32.const 0)) (i32.ge_u (local.get $pos) (local.get $jlen))) (then (return (i32.const 0))))
    (i32.eq (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 116)) ;; 't'
  )

  ;; Extract up to $max_items string values for $key_z into slots ($base + idx*128, len at +120), returns total count found
  (func $collect_json_strings (param $json i32) (param $jlen i32) (param $key_z i32) (param $base i32) (param $max_items i32) (param $shown_out i32) (result i32)
    (local $off i32) (local $rel i32) (local $cnt i32) (local $shown i32) (local $slot i32) (local $slen i32)
    (local.set $off (i32.const 0))
    (local.set $cnt (i32.const 0))
    (local.set $shown (i32.const 0))
    (loop $scan
      (if (i32.lt_u (local.get $off) (local.get $jlen))
        (then
          (local.set $rel (call $find_json_val (i32.add (local.get $json) (local.get $off)) (i32.sub (local.get $jlen) (local.get $off)) (local.get $key_z)))
          (if (i32.ge_s (local.get $rel) (i32.const 0))
            (then
              (if (i32.lt_u (local.get $shown) (local.get $max_items))
                (then
                  (local.set $slot (i32.add (local.get $base) (i32.mul (local.get $shown) (i32.const 128))))
                  (local.set $slen (call $extract_json_str (i32.add (local.get $json) (local.get $off)) (i32.sub (local.get $jlen) (local.get $off)) (local.get $key_z) (local.get $slot) (i32.const 100)))
                  (if (i32.gt_s (local.get $slen) (i32.const 0))
                    (then
                      (i32.store (i32.add (local.get $slot) (i32.const 120)) (local.get $slen))
                      (local.set $shown (i32.add (local.get $shown) (i32.const 1)))
                    )
                  )
                )
              )
              (local.set $cnt (i32.add (local.get $cnt) (i32.const 1)))
              (local.set $off (i32.add (i32.add (local.get $off) (local.get $rel)) (i32.const 2)))
              (br $scan)
            )
          )
        )
      )
    )
    (i32.store (local.get $shown_out) (local.get $shown))
    (local.get $cnt)
  )

  ;; ── Storage Helpers ──────────────────────────────────────────────────

  (func $st_get (param $key_z i32) (param $dst i32) (param $max_out i32) (result i32)
    (local $p i32) (local $rc i32) (local $vlen i32)
    (local.set $p (call $copy_zstr (i32.const ${S.st_get_p.offset}) (i32.const 300000)))
    (local.set $p (call $copy_zstr (local.get $key_z) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.st_end.offset}) (local.get $p)))
    (local.set $rc (call $host_call (i32.const 300000) (i32.sub (local.get $p) (i32.const 300000)) (i32.const 350000) (i32.const 2048)))
    (if (i32.le_s (local.get $rc) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $vlen (call $extract_json_str (i32.const 350000) (local.get $rc) (i32.const ${S.k_value.offset}) (local.get $dst) (local.get $max_out)))
    (if (i32.le_s (local.get $vlen) (i32.const 0)) (then (return (i32.const 0))))
    (local.get $vlen)
  )

  (func $st_set (param $key_z i32) (param $val_ptr i32) (param $val_len i32)
    (local $p i32)
    (local.set $p (call $copy_zstr (i32.const ${S.st_set_p.offset}) (i32.const 300000)))
    (local.set $p (call $copy_zstr (local.get $key_z) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.st_set_m.offset}) (local.get $p)))
    (local.set $p (call $copy_mem (local.get $val_ptr) (local.get $p) (local.get $val_len)))
    (local.set $p (call $copy_zstr (i32.const ${S.st_end.offset}) (local.get $p)))
    (drop (call $host_call (i32.const 300000) (i32.sub (local.get $p) (i32.const 300000)) (i32.const 350000) (i32.const 1024)))
  )

  (func $load_prefs
    (global.set $city_len (call $st_get (i32.const ${S.sk_city.offset}) (i32.const 260350) (i32.const 76)))
    (global.set $lat_len (call $st_get (i32.const ${S.sk_lat.offset}) (i32.const 260450) (i32.const 24)))
    (global.set $lon_len (call $st_get (i32.const ${S.sk_lon.offset}) (i32.const 260500) (i32.const 24)))
    (global.set $sched_len (call $st_get (i32.const ${S.sk_sched.offset}) (i32.const 260550) (i32.const 12)))
    (global.set $note_key_len (call $st_get (i32.const ${S.sk_note.offset}) (i32.const 262500) (i32.const 76)))
    (if (i32.le_s (global.get $note_key_len) (i32.const 0))
      (then
        (drop (call $copy_zstr (i32.const ${S.s_default_note.offset}) (i32.const 262500)))
        (global.set $note_key_len (i32.const ${S.s_default_note.len}))
      )
    )
    (if (i32.gt_s (global.get $date_len) (i32.const 0))
      (then (call $st_set (i32.const ${S.sk_date.offset}) (i32.const 260300) (global.get $date_len)))
      (else (global.set $date_len (call $st_get (i32.const ${S.sk_date.offset}) (i32.const 260300) (i32.const 12))))
    )
  )

  ;; Map Open-Meteo WMO code to short label zstr
  (func $wmo_label (param $code i32) (result i32)
    (if (i32.eqz (local.get $code)) (then (return (i32.const ${S.w_clear.offset}))))
    (if (i32.le_s (local.get $code) (i32.const 3)) (then (return (i32.const ${S.w_partly.offset}))))
    (if (i32.le_s (local.get $code) (i32.const 48)) (then (return (i32.const ${S.w_fog.offset}))))
    (if (i32.le_s (local.get $code) (i32.const 67)) (then (return (i32.const ${S.w_rain.offset}))))
    (if (i32.le_s (local.get $code) (i32.const 77)) (then (return (i32.const ${S.w_snow.offset}))))
    (if (i32.le_s (local.get $code) (i32.const 82)) (then (return (i32.const ${S.w_showers.offset}))))
    (i32.const ${S.w_storm.offset})
  )

  ;; ── UI Card Renderers ────────────────────────────────────────────────

  (func $render_simple (param $t i32) (param $sub i32) (param $b i32) (param $bc i32) (param $body i32) (param $btns i32) (result i32)
    (call $emit_reset)
    (call $emit_zstr (i32.const ${S.ui_start.offset})) (call $emit_zstr (local.get $t))
    (call $emit_zstr (i32.const ${S.ui_mid1.offset})) (call $emit_zstr (local.get $t))
    (call $emit_zstr (i32.const ${S.ui_sub.offset})) (call $emit_zstr (local.get $sub))
    (call $emit_zstr (i32.const ${S.ui_badge.offset})) (call $emit_zstr (local.get $b))
    (call $emit_zstr (local.get $bc))
    (call $emit_zstr (i32.const ${S.el_text_1.offset})) (call $emit_zstr (local.get $body)) (call $emit_zstr (i32.const ${S.el_text_end.offset}))
    (call $emit_byte (i32.const 44)) (call $emit_zstr (local.get $btns))
    (call $emit_zstr (i32.const ${S.ui_end.offset}))
    (call $emit_len)
  )

  (func $render_status (result i32)
    (call $emit_reset)
    (call $emit_zstr (i32.const ${S.ui_start.offset})) (call $emit_zstr (i32.const ${S.t_status_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_mid1.offset})) (call $emit_zstr (i32.const ${S.t_status_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_sub.offset})) (call $emit_zstr (i32.const ${S.t_status_sub.offset}))
    (call $emit_zstr (i32.const ${S.ui_badge.offset})) (call $emit_zstr (i32.const ${S.t_status_badge.offset}))
    (call $emit_zstr (i32.const ${S.ui_bc_green.offset}))
    (call $emit_zstr (i32.const ${S.el_list_start.offset}))
    (call $emit_zstr (i32.const ${S.el_list_1.offset})) (call $emit_zstr (i32.const ${S.kv_city.offset})) (call $emit_zstr (i32.const ${S.el_list_2.offset}))
    (if (i32.gt_s (global.get $city_len) (i32.const 0))
      (then (call $emit_json_esc (i32.const 260350) (global.get $city_len)))
      (else (call $emit_zstr (i32.const ${S.s_not_set_city.offset})))
    )
    (call $emit_zstr (i32.const ${S.el_kv_item_end.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_list_1.offset})) (call $emit_zstr (i32.const ${S.kv_note.offset})) (call $emit_zstr (i32.const ${S.el_list_2.offset}))
    (call $emit_json_esc (i32.const 262500) (global.get $note_key_len))
    (call $emit_zstr (i32.const ${S.el_kv_item_end.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_list_1.offset})) (call $emit_zstr (i32.const ${S.kv_schedule.offset})) (call $emit_zstr (i32.const ${S.el_list_2.offset}))
    (if (i32.gt_s (global.get $sched_len) (i32.const 0))
      (then (call $emit_zstr (i32.const ${S.s_daily_at.offset})) (call $emit_mem (i32.const 260550) (global.get $sched_len)))
      (else (call $emit_zstr (i32.const ${S.s_not_sched.offset})))
    )
    (call $emit_zstr (i32.const ${S.el_kv_item_end.offset}))
    (call $emit_zstr (i32.const ${S.el_list_end.offset}))
    (call $emit_byte (i32.const 44)) (call $emit_zstr (i32.const ${S.el_btns_main.offset}))
    (call $emit_zstr (i32.const ${S.ui_end.offset}))
    (call $emit_len)
  )

  (func $render_briefing (result i32)
    (local $i i32) (local $slot i32) (local $any_list i32) (local $ncap i32)
    (call $emit_reset)
    (call $emit_zstr (i32.const ${S.ui_start.offset})) (call $emit_zstr (i32.const ${S.t_brief_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_mid1.offset})) (call $emit_zstr (i32.const ${S.t_brief_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_sub.offset}))
    (if (i32.gt_s (global.get $date_len) (i32.const 0))
      (then (call $emit_zstr (i32.const ${S.t_date_pfx.offset})) (call $emit_mem (i32.const 260300) (global.get $date_len)))
      (else (call $emit_zstr (i32.const ${S.t_brief_sub.offset})))
    )
    (call $emit_zstr (i32.const ${S.ui_badge.offset})) (call $emit_zstr (i32.const ${S.t_brief_badge.offset}))
    (call $emit_zstr (i32.const ${S.ui_bc_alarm.offset}))

    ;; Vertical summary list (one row below another)
    (call $emit_zstr (i32.const ${S.el_list_start.offset}))
    ;; 1. Weather
    (call $emit_zstr (i32.const ${S.el_list_1.offset})) (call $emit_zstr (i32.const ${S.kv_weather.offset})) (call $emit_zstr (i32.const ${S.el_list_2.offset}))
    (if (global.get $wx_ok)
      (then
        (if (i32.gt_s (global.get $city_len) (i32.const 0))
          (then (call $emit_json_esc (i32.const 260350) (global.get $city_len)) (call $emit_byte (i32.const 58)) (call $emit_byte (i32.const 32)))
        )
        (call $emit_mem (i32.const 260800) (global.get $temp_len))
        (call $emit_zstr (i32.const ${S.s_deg_c.offset}))
        (call $emit_byte (i32.const 32))
        (call $emit_zstr (call $wmo_label (global.get $wcode)))
        (if (i32.and (i32.gt_s (global.get $tmax_len) (i32.const 0)) (i32.gt_s (global.get $tmin_len) (i32.const 0)))
          (then
            (call $emit_zstr (i32.const ${S.s_hl_p.offset}))
            (call $emit_mem (i32.const 260840) (global.get $tmax_len))
            (call $emit_zstr (i32.const ${S.s_hl_m.offset}))
            (call $emit_mem (i32.const 260880) (global.get $tmin_len))
            (call $emit_zstr (i32.const ${S.s_hl_e.offset}))
          )
        )
      )
      (else
        (if (i32.gt_s (global.get $lat_len) (i32.const 0))
          (then (call $emit_zstr (i32.const ${S.s_wx_err.offset})))
          (else (call $emit_zstr (i32.const ${S.s_not_set_city.offset})))
        )
      )
    )
    (call $emit_zstr (i32.const ${S.el_kv_item_end.offset})) (call $emit_byte (i32.const 44))

    ;; 2. Calendar Events
    (call $emit_zstr (i32.const ${S.el_list_1.offset})) (call $emit_zstr (i32.const ${S.kv_calendar.offset})) (call $emit_zstr (i32.const ${S.el_list_2.offset}))
    (call $emit_uint (global.get $ev_count))
    (if (i32.eq (global.get $ev_count) (i32.const 1))
      (then (call $emit_zstr (i32.const ${S.s_event_word.offset})))
      (else (call $emit_zstr (i32.const ${S.s_events_word.offset})))
    )
    (call $emit_zstr (i32.const ${S.el_kv_item_end.offset})) (call $emit_byte (i32.const 44))

    ;; 3. Reminders
    (call $emit_zstr (i32.const ${S.el_list_1.offset})) (call $emit_zstr (i32.const ${S.kv_reminders.offset})) (call $emit_zstr (i32.const ${S.el_list_2.offset}))
    (call $emit_uint (global.get $rem_count))
    (call $emit_zstr (i32.const ${S.s_rems_word.offset}))
    (call $emit_zstr (i32.const ${S.el_kv_item_end.offset})) (call $emit_byte (i32.const 44))

    ;; 4. Unread Emails
    (call $emit_zstr (i32.const ${S.el_list_1.offset})) (call $emit_zstr (i32.const ${S.kv_email.offset})) (call $emit_zstr (i32.const ${S.el_list_2.offset}))
    (if (global.get $mail_ok)
      (then (call $emit_uint (global.get $mail_unread)) (call $emit_zstr (i32.const ${S.s_unread_word.offset})))
      (else (call $emit_zstr (i32.const ${S.s_not_cfg_mail.offset})))
    )
    (call $emit_zstr (i32.const ${S.el_kv_item_end.offset})) (call $emit_byte (i32.const 44))

    ;; 5. Daily Note (show ONLY the note content, never the title)
    (call $emit_zstr (i32.const ${S.el_list_1.offset})) (call $emit_zstr (i32.const ${S.kv_note.offset})) (call $emit_zstr (i32.const ${S.el_list_2.offset}))
    (if (global.get $note_found)
      (then
        (if (i32.gt_s (global.get $note_c_len) (i32.const 0))
          (then
            (local.set $ncap (global.get $note_c_len))
            (if (i32.gt_u (local.get $ncap) (i32.const 150))
              (then
                (local.set $ncap (i32.const 150))
                (loop $utf8_back
                  (if (i32.and (i32.gt_u (local.get $ncap) (i32.const 0))
                               (i32.eq (i32.and (i32.load8_u (i32.add (i32.const 295000) (local.get $ncap))) (i32.const 192)) (i32.const 128)))
                    (then (local.set $ncap (i32.sub (local.get $ncap) (i32.const 1))) (br $utf8_back))
                  )
                )
              )
            )
            (call $emit_json_esc (i32.const 295000) (local.get $ncap))
          )
          (else (call $emit_zstr (i32.const ${S.s_empty_note.offset})))
        )
      )
      (else (call $emit_zstr (i32.const ${S.s_no_note.offset})))
    )
    (call $emit_zstr (i32.const ${S.el_kv_item_end.offset})) (call $emit_byte (i32.const 44))

    ;; 6. Auto Schedule
    (call $emit_zstr (i32.const ${S.el_list_1.offset})) (call $emit_zstr (i32.const ${S.kv_schedule.offset})) (call $emit_zstr (i32.const ${S.el_list_2.offset}))
    (if (i32.gt_s (global.get $sched_len) (i32.const 0))
      (then (call $emit_zstr (i32.const ${S.s_daily_at.offset})) (call $emit_mem (i32.const 260550) (global.get $sched_len)))
      (else (call $emit_zstr (i32.const ${S.s_not_sched.offset})))
    )
    (call $emit_zstr (i32.const ${S.el_kv_item_end.offset}))
    (call $emit_zstr (i32.const ${S.el_list_end.offset}))

    ;; Full Daily Note content section only if longer than 150 bytes (no title prefix)
    (if (i32.and (global.get $note_found) (i32.gt_s (global.get $note_c_len) (i32.const 150)))
      (then
        (call $emit_byte (i32.const 44))
        (call $emit_zstr (i32.const ${S.el_divider.offset}))
        (call $emit_byte (i32.const 44))
        (call $emit_zstr (i32.const ${S.el_text_1.offset}))
        (call $emit_json_esc (i32.const 295000) (global.get $note_c_len))
        (call $emit_zstr (i32.const ${S.el_text_end.offset}))
      )
    )

    ;; Highlights list (events + reminders + recent emails)
    (local.set $any_list (i32.add (i32.add (global.get $ev_shown) (global.get $rem_shown)) (global.get $mail_shown)))
    (if (i32.gt_s (local.get $any_list) (i32.const 0))
      (then
        (call $emit_byte (i32.const 44))
        (call $emit_zstr (i32.const ${S.el_divider.offset}))
        (call $emit_byte (i32.const 44))
        (call $emit_zstr (i32.const ${S.el_list_start.offset}))
        (local.set $any_list (i32.const 0))
        ;; Calendar items
        (local.set $i (i32.const 0))
        (loop $el
          (if (i32.lt_u (local.get $i) (global.get $ev_shown))
            (then
              (if (i32.gt_u (local.get $any_list) (i32.const 0)) (then (call $emit_byte (i32.const 44))))
              (local.set $slot (i32.add (i32.const 261000) (i32.mul (local.get $i) (i32.const 128))))
              (call $emit_zstr (i32.const ${S.el_list_1.offset}))
              (call $emit_json_esc (local.get $slot) (i32.load (i32.add (local.get $slot) (i32.const 120))))
              (call $emit_zstr (i32.const ${S.el_list_2.offset}))
              (call $emit_zstr (i32.const ${S.s_sub_event.offset}))
              (call $emit_zstr (i32.const ${S.el_kv_item_end.offset}))
              (local.set $any_list (i32.add (local.get $any_list) (i32.const 1)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $el)
            )
          )
        )
        ;; Reminder items
        (local.set $i (i32.const 0))
        (loop $rl
          (if (i32.lt_u (local.get $i) (global.get $rem_shown))
            (then
              (if (i32.gt_u (local.get $any_list) (i32.const 0)) (then (call $emit_byte (i32.const 44))))
              (local.set $slot (i32.add (i32.const 261500) (i32.mul (local.get $i) (i32.const 128))))
              (call $emit_zstr (i32.const ${S.el_list_1.offset}))
              (call $emit_json_esc (local.get $slot) (i32.load (i32.add (local.get $slot) (i32.const 120))))
              (call $emit_zstr (i32.const ${S.el_list_2.offset}))
              (call $emit_zstr (i32.const ${S.s_sub_rem.offset}))
              (call $emit_zstr (i32.const ${S.el_kv_item_end.offset}))
              (local.set $any_list (i32.add (local.get $any_list) (i32.const 1)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $rl)
            )
          )
        )
        ;; Mail items
        (local.set $i (i32.const 0))
        (loop $ml
          (if (i32.lt_u (local.get $i) (global.get $mail_shown))
            (then
              (if (i32.gt_u (local.get $any_list) (i32.const 0)) (then (call $emit_byte (i32.const 44))))
              (local.set $slot (i32.add (i32.const 262000) (i32.mul (local.get $i) (i32.const 128))))
              (call $emit_zstr (i32.const ${S.el_list_1.offset}))
              (call $emit_json_esc (local.get $slot) (i32.load (i32.add (local.get $slot) (i32.const 120))))
              (call $emit_zstr (i32.const ${S.el_list_2.offset}))
              (call $emit_zstr (i32.const ${S.s_sub_mail.offset}))
              (call $emit_zstr (i32.const ${S.el_kv_item_end.offset}))
              (local.set $any_list (i32.add (local.get $any_list) (i32.const 1)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $ml)
            )
          )
        )
        (call $emit_zstr (i32.const ${S.el_list_end.offset}))
      )
    )

    (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_btns_main.offset}))
    (call $emit_zstr (i32.const ${S.ui_end.offset}))
    (call $emit_len)
  )

  ;; ── Async Step Dispatchers ───────────────────────────────────────────

  (func $dispatch_reminders (result i32)
    (global.set $state (i32.const 3))
    (drop (call $host_call (i32.const ${S.req_rems.offset}) (i32.const ${S.req_rems.len}) (i32.const 350000) (i32.const 80000)))
    (i32.const 0)
  )

  (func $dispatch_email (result i32)
    (global.set $state (i32.const 4))
    (drop (call $host_call (i32.const ${S.req_mail.offset}) (i32.const ${S.req_mail.len}) (i32.const 350000) (i32.const 80000)))
    (i32.const 0)
  )

  (func $dispatch_daily_note (result i32)
    (local $p i32)
    (local.set $p (call $copy_zstr (i32.const ${S.req_note_p1.offset}) (i32.const 300000)))
    (local.set $p (call $copy_mem (i32.const 262500) (local.get $p) (global.get $note_key_len)))
    (local.set $p (call $copy_zstr (i32.const ${S.req_note_p2.offset}) (local.get $p)))
    (global.set $state (i32.const 7))
    (drop (call $host_call (i32.const 300000) (i32.sub (local.get $p) (i32.const 300000)) (i32.const 350000) (i32.const 60000)))
    (i32.const 0)
  )

  (func $dispatch_weather (result i32)
    (local $p i32)
    (local.set $p (call $copy_zstr (i32.const ${S.req_wx_p1.offset}) (i32.const 300000)))
    (local.set $p (call $copy_mem (i32.const 260450) (local.get $p) (global.get $lat_len)))
    (local.set $p (call $copy_zstr (i32.const ${S.req_wx_p2.offset}) (local.get $p)))
    (local.set $p (call $copy_mem (i32.const 260500) (local.get $p) (global.get $lon_len)))
    (local.set $p (call $copy_zstr (i32.const ${S.req_wx_p3.offset}) (local.get $p)))
    (global.set $state (i32.const 5))
    (drop (call $host_call (i32.const 300000) (i32.sub (local.get $p) (i32.const 300000)) (i32.const 350000) (i32.const 80000)))
    (i32.const 0)
  )

  (func $dispatch_weather_or_finish (result i32)
    (if (i32.and (i32.gt_s (global.get $lat_len) (i32.const 0)) (i32.gt_s (global.get $lon_len) (i32.const 0)))
      (then (return (call $dispatch_weather)))
    )
    ;; Auto-detect city/lat/lon via ipwho.is on first run
    (global.set $state (i32.const 8))
    (drop (call $host_call (i32.const ${S.req_ipgeo.offset}) (i32.const ${S.req_ipgeo.len}) (i32.const 350000) (i32.const 16000)))
    (i32.const 0)
  )

  (func $finish_or_notify (result i32)
    (local $p i32)
    (if (global.get $want_notify)
      (then
        (global.set $want_notify (i32.const 0))
        (local.set $p (call $copy_zstr (i32.const ${S.req_notif_p1.offset}) (i32.const 300000)))
        (local.set $p (call $buf_uint (local.get $p) (global.get $ev_count)))
        (local.set $p (call $copy_zstr (i32.const ${S.s_events_word.offset}) (local.get $p)))
        (i32.store8 (local.get $p) (i32.const 44)) (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (i32.store8 (local.get $p) (i32.const 32)) (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (local.set $p (call $buf_uint (local.get $p) (global.get $rem_count)))
        (local.set $p (call $copy_zstr (i32.const ${S.s_rems_word.offset}) (local.get $p)))
        (if (global.get $mail_ok)
          (then
            (i32.store8 (local.get $p) (i32.const 44)) (local.set $p (i32.add (local.get $p) (i32.const 1)))
            (i32.store8 (local.get $p) (i32.const 32)) (local.set $p (i32.add (local.get $p) (i32.const 1)))
            (local.set $p (call $buf_uint (local.get $p) (global.get $mail_unread)))
            (local.set $p (call $copy_zstr (i32.const ${S.s_unread_word.offset}) (local.get $p)))
          )
        )
        (local.set $p (call $copy_zstr (i32.const ${S.req_notif_p2.offset}) (local.get $p)))
        (global.set $state (i32.const 6))
        (drop (call $host_call (i32.const 300000) (i32.sub (local.get $p) (i32.const 300000)) (i32.const 350000) (i32.const 2048)))
        (return (i32.const 0))
      )
    )
    (call $render_briefing)
  )

  ;; Parse HH:MM (or H) from 260100 (len $arg_len), store normalized HH:MM in 260550, schedule cron
  (func $start_schedule (result i32)
    (local $i i32) (local $ch i32) (local $h i32) (local $m i32) (local $in_min i32) (local $has_h i32) (local $p i32)
    (local.set $h (i32.const 0))
    (local.set $m (i32.const 0))
    (local.set $in_min (i32.const 0))
    (local.set $has_h (i32.const 0))
    (local.set $i (i32.const 0))
    (loop $pt
      (if (i32.lt_u (local.get $i) (global.get $arg_len))
        (then
          (local.set $ch (i32.load8_u (i32.add (i32.const 260100) (local.get $i))))
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 48)) (i32.le_u (local.get $ch) (i32.const 57)))
            (then
              (if (local.get $in_min)
                (then (local.set $m (i32.add (i32.mul (local.get $m) (i32.const 10)) (i32.sub (local.get $ch) (i32.const 48)))))
                (else
                  (local.set $h (i32.add (i32.mul (local.get $h) (i32.const 10)) (i32.sub (local.get $ch) (i32.const 48))))
                  (local.set $has_h (i32.const 1))
                )
              )
            )
            (else
              (if (i32.and (i32.eq (local.get $ch) (i32.const 58)) (local.get $has_h))
                (then (local.set $in_min (i32.const 1)))
              )
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $pt)
        )
      )
    )
    ;; Default to 08:00 if no digits given
    (if (i32.eqz (local.get $has_h))
      (then (local.set $h (i32.const 8)) (local.set $m (i32.const 0)))
    )
    (if (i32.or (i32.gt_u (local.get $h) (i32.const 23)) (i32.gt_u (local.get $m) (i32.const 59)))
      (then
        (return (call $render_simple
          (i32.const ${S.t_sched_err.offset}) (i32.const ${S.t_sched_err_sub.offset})
          (i32.const ${S.t_sched_err_badge.offset}) (i32.const ${S.ui_bc_red.offset})
          (i32.const ${S.t_sched_err_body.offset}) (i32.const ${S.el_btns_simple.offset})
        ))
      )
    )
    ;; Store HH:MM in 260550
    (i32.store8 (i32.const 260550) (i32.add (i32.const 48) (i32.div_u (local.get $h) (i32.const 10))))
    (i32.store8 (i32.const 260551) (i32.add (i32.const 48) (i32.rem_u (local.get $h) (i32.const 10))))
    (i32.store8 (i32.const 260552) (i32.const 58))
    (i32.store8 (i32.const 260553) (i32.add (i32.const 48) (i32.div_u (local.get $m) (i32.const 10))))
    (i32.store8 (i32.const 260554) (i32.add (i32.const 48) (i32.rem_u (local.get $m) (i32.const 10))))
    (global.set $sched_len (i32.const 5))

    ;; Build scheduler.schedule request: cron "<m> <h> * * *"
    (local.set $p (call $copy_zstr (i32.const ${S.req_sched_p1.offset}) (i32.const 300000)))
    (local.set $p (call $buf_uint (local.get $p) (local.get $m)))
    (i32.store8 (local.get $p) (i32.const 32)) (local.set $p (i32.add (local.get $p) (i32.const 1)))
    (local.set $p (call $buf_uint (local.get $p) (local.get $h)))
    (local.set $p (call $copy_zstr (i32.const ${S.req_sched_p2.offset}) (local.get $p)))
    (global.set $state (i32.const 11))
    (drop (call $host_call (i32.const 300000) (i32.sub (local.get $p) (i32.const 300000)) (i32.const 350000) (i32.const 2048)))
    (i32.const 0)
  )

  ;; ── Main Entrypoint ──────────────────────────────────────────────────

  (func (export "briefing_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $ts i32) (local $tl i32) (local $vlen i32) (local $arg_p i32) (local $arg_l i32) (local $enc_len i32) (local $p i32)

    ;; Reset globals
    (global.set $state (i32.const 0))
    (global.set $want_notify (i32.const 0))
    (global.set $act_len (i32.const 0))
    (global.set $arg_len (i32.const 0))
    (global.set $date_len (i32.const 0))
    (global.set $ev_count (i32.const 0))
    (global.set $ev_shown (i32.const 0))
    (global.set $rem_count (i32.const 0))
    (global.set $rem_shown (i32.const 0))
    (global.set $mail_ok (i32.const 0))
    (global.set $mail_unread (i32.const 0))
    (global.set $mail_shown (i32.const 0))
    (global.set $note_found (i32.const 0))
    (global.set $note_t_len (i32.const 0))
    (global.set $note_c_len (i32.const 0))
    (global.set $wx_ok (i32.const 0))
    (global.set $temp_len (i32.const 0))
    (global.set $tmax_len (i32.const 0))
    (global.set $tmin_len (i32.const 0))
    (global.set $wcode (i32.const 0))

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

    ;; Parse JSON or plain text
    (if (i32.and (i32.gt_u (local.get $tl) (i32.const 0)) (i32.eq (i32.load8_u (local.get $ts)) (i32.const 123)))
      (then
        (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_op.offset}) (i32.const 260000) (i32.const 60)))
        (if (i32.le_s (local.get $vlen) (i32.const 0))
          (then (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_action.offset}) (i32.const 260000) (i32.const 60))))
        )
        (if (i32.gt_s (local.get $vlen) (i32.const 0))
          (then (call $to_lower (i32.const 260000) (i32.const 260000) (local.get $vlen)) (global.set $act_len (local.get $vlen)))
        )
        (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_date.offset}) (i32.const 260300) (i32.const 12)))
        (if (i32.ge_s (local.get $vlen) (i32.const 10)) (then (global.set $date_len (i32.const 10))))

        ;; Extract arg from city / time / note / query
        (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_city.offset}) (i32.const 260100) (i32.const 120)))
        (if (i32.le_s (local.get $vlen) (i32.const 0))
          (then (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_time.offset}) (i32.const 260100) (i32.const 120))))
        )
        (if (i32.le_s (local.get $vlen) (i32.const 0))
          (then (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_note.offset}) (i32.const 260100) (i32.const 120))))
        )
        (if (i32.le_s (local.get $vlen) (i32.const 0))
          (then (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_query.offset}) (i32.const 260100) (i32.const 120))))
        )
        (if (i32.gt_s (local.get $vlen) (i32.const 0)) (then (global.set $arg_len (local.get $vlen))))
      )
      (else
        (local.set $tl (call $strip_lang (local.get $ts) (local.get $tl)))
        (if (i32.gt_s (local.get $tl) (i32.const 0))
          (then
            (call $to_lower (local.get $ts) (i32.const 260200) (if (result i32) (i32.gt_u (local.get $tl) (i32.const 80)) (then (i32.const 80)) (else (local.get $tl))))
            (local.set $arg_p (i32.const 0))
            (local.set $arg_l (i32.const 0))
            (if (call $match_cmd (i32.const 260200) (local.get $tl) (i32.const ${S.a_help.offset}))
              (then (drop (call $copy_zstr (i32.const ${S.a_help.offset}) (i32.const 260000))) (global.set $act_len (i32.const ${S.a_help.len})))
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 260200) (local.get $tl) (i32.const ${S.a_status.offset})))
              (then (drop (call $copy_zstr (i32.const ${S.a_status.offset}) (i32.const 260000))) (global.set $act_len (i32.const ${S.a_status.len})))
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 260200) (local.get $tl) (i32.const ${S.a_notify.offset})))
              (then (drop (call $copy_zstr (i32.const ${S.a_notify.offset}) (i32.const 260000))) (global.set $act_len (i32.const ${S.a_notify.len})))
            )
            (if (i32.and (i32.eqz (global.get $act_len))
                         (i32.or (call $match_cmd (i32.const 260200) (local.get $tl) (i32.const ${S.a_unschedule.offset}))
                                 (i32.or (call $match_cmd (i32.const 260200) (local.get $tl) (i32.const ${S.a_cancel.offset}))
                                         (call $match_cmd (i32.const 260200) (local.get $tl) (i32.const ${S.a_off.offset})))))
              (then (drop (call $copy_zstr (i32.const ${S.a_unschedule.offset}) (i32.const 260000))) (global.set $act_len (i32.const ${S.a_unschedule.len})))
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 260200) (local.get $tl) (i32.const ${S.a_city.offset})))
              (then
                (drop (call $copy_zstr (i32.const ${S.a_city.offset}) (i32.const 260000))) (global.set $act_len (i32.const ${S.a_city.len}))
                (local.set $arg_p (i32.add (local.get $ts) (i32.const 4))) (local.set $arg_l (i32.sub (local.get $tl) (i32.const 4)))
              )
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 260200) (local.get $tl) (i32.const ${S.a_note.offset})))
              (then
                (drop (call $copy_zstr (i32.const ${S.a_note.offset}) (i32.const 260000))) (global.set $act_len (i32.const ${S.a_note.len}))
                (local.set $arg_p (i32.add (local.get $ts) (i32.const 4))) (local.set $arg_l (i32.sub (local.get $tl) (i32.const 4)))
              )
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 260200) (local.get $tl) (i32.const ${S.a_schedule.offset})))
              (then
                (drop (call $copy_zstr (i32.const ${S.a_schedule.offset}) (i32.const 260000))) (global.set $act_len (i32.const ${S.a_schedule.len}))
                (local.set $arg_p (i32.add (local.get $ts) (i32.const 8))) (local.set $arg_l (i32.sub (local.get $tl) (i32.const 8)))
              )
            )
            ;; Trim arg_p..arg_l into 260100
            (loop $alt
              (if (i32.and (i32.gt_s (local.get $arg_l) (i32.const 0)) (call $is_ws (i32.load8_u (local.get $arg_p))))
                (then (local.set $arg_p (i32.add (local.get $arg_p) (i32.const 1))) (local.set $arg_l (i32.sub (local.get $arg_l) (i32.const 1))) (br $alt))
              )
            )
            (if (i32.gt_s (local.get $arg_l) (i32.const 0))
              (then
                (if (i32.gt_u (local.get $arg_l) (i32.const 120)) (then (local.set $arg_l (i32.const 120))))
                (drop (call $copy_mem (local.get $arg_p) (i32.const 260100) (local.get $arg_l)))
                (global.set $arg_len (local.get $arg_l))
              )
            )
          )
        )
      )
    )

    ;; Load saved city / schedule / date from storage.private
    (call $load_prefs)

    ;; Dispatch
    (if (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_help.offset}))
      (then
        (return (call $render_simple
          (i32.const ${S.t_help_title.offset}) (i32.const ${S.t_help_sub.offset})
          (i32.const ${S.t_help_badge.offset}) (i32.const ${S.ui_bc_green.offset})
          (i32.const ${S.t_help_body.offset}) (i32.const ${S.el_btns_simple.offset})
        ))
      )
    )
    (if (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_status.offset}))
      (then (return (call $render_status)))
    )
    (if (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_note.offset}))
      (then
        (if (i32.gt_s (global.get $arg_len) (i32.const 0))
          (then
            (if (i32.gt_u (global.get $arg_len) (i32.const 76)) (then (global.set $arg_len (i32.const 76))))
            (drop (call $copy_mem (i32.const 260100) (i32.const 262500) (global.get $arg_len)))
            (global.set $note_key_len (global.get $arg_len))
            (call $st_set (i32.const ${S.sk_note.offset}) (i32.const 262500) (global.get $note_key_len))
          )
        )
        (call $emit_reset)
        (call $emit_zstr (i32.const ${S.ui_start.offset})) (call $emit_zstr (i32.const ${S.t_note_ok.offset}))
        (call $emit_zstr (i32.const ${S.ui_mid1.offset})) (call $emit_zstr (i32.const ${S.t_note_ok.offset}))
        (call $emit_zstr (i32.const ${S.ui_sub.offset})) (call $emit_zstr (i32.const ${S.t_note_ok_sub.offset}))
        (call $emit_zstr (i32.const ${S.ui_badge.offset})) (call $emit_zstr (i32.const ${S.t_note_ok_badge.offset}))
        (call $emit_zstr (i32.const ${S.ui_bc_green.offset}))
        (call $emit_zstr (i32.const ${S.el_kv_start.offset}))
        (call $emit_zstr (i32.const ${S.el_kv_1.offset})) (call $emit_zstr (i32.const ${S.kv_note.offset})) (call $emit_zstr (i32.const ${S.el_kv_2.offset})) (call $emit_json_esc (i32.const 262500) (global.get $note_key_len)) (call $emit_zstr (i32.const ${S.el_kv_item_end.offset}))
        (call $emit_zstr (i32.const ${S.el_kv_end.offset}))
        (call $emit_byte (i32.const 44)) (call $emit_zstr (i32.const ${S.el_btns_simple.offset}))
        (call $emit_zstr (i32.const ${S.ui_end.offset}))
        (return (call $emit_len))
      )
    )
    (if (i32.or (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_city.offset}))
                (i32.or (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_location.offset}))
                        (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_weather.offset}))))
      (then
        (if (i32.gt_s (global.get $arg_len) (i32.const 0))
          (then
            (local.set $enc_len (call $url_encode (i32.const 260100) (global.get $arg_len)))
            (local.set $p (call $copy_zstr (i32.const ${S.req_geo_p1.offset}) (i32.const 300000)))
            (local.set $p (call $copy_mem (i32.const 262400) (local.get $p) (local.get $enc_len)))
            (local.set $p (call $copy_zstr (i32.const ${S.req_geo_p2.offset}) (local.get $p)))
            (global.set $state (i32.const 10))
            (drop (call $host_call (i32.const 300000) (i32.sub (local.get $p) (i32.const 300000)) (i32.const 350000) (i32.const 60000)))
            (return (i32.const 0))
          )
        )
        (return (call $render_simple
          (i32.const ${S.t_city_err.offset}) (i32.const ${S.t_city_err_sub.offset})
          (i32.const ${S.t_city_err_badge.offset}) (i32.const ${S.ui_bc_orange.offset})
          (i32.const ${S.t_city_err_body.offset}) (i32.const ${S.el_btns_simple.offset})
        ))
      )
    )
    (if (i32.or (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_schedule.offset}))
                (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_cron.offset})))
      (then (return (call $start_schedule)))
    )
    (if (i32.or (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_unschedule.offset}))
                (i32.or (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_cancel.offset}))
                        (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_off.offset}))))
      (then
        (global.set $state (i32.const 12))
        (drop (call $host_call (i32.const ${S.req_unsched.offset}) (i32.const ${S.req_unsched.len}) (i32.const 350000) (i32.const 2048)))
        (return (i32.const 0))
      )
    )
    (if (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_notify.offset}))
      (then (global.set $want_notify (i32.const 1)))
    )

    ;; Start multi-source briefing pipeline: Step 1 = calendar.calendars
    (global.set $state (i32.const 1))
    (drop (call $host_call (i32.const ${S.req_cals.offset}) (i32.const ${S.req_cals.len}) (i32.const 350000) (i32.const 60000)))
    (i32.const 0)
  )

  ;; ── Async Resume Handler ─────────────────────────────────────────────

  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $p i32) (local $blen i32) (local $cur_off i32) (local $day_off i32) (local $nlen i32) (local $llen i32) (local $rlen i32) (local $v i32)

    ;; State 1: calendar.calendars -> dispatch calendar.events
    (if (i32.eq (global.get $state) (i32.const 1))
      (then
        (if (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset}))
          (then
            (local.set $nlen (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_id.offset}) (i32.const 260600) (i32.const 120)))
            (if (i32.gt_s (local.get $nlen) (i32.const 0))
              (then
                (global.set $cal_id_len (local.get $nlen))
                (local.set $p (call $copy_zstr (i32.const ${S.req_ev_p1.offset}) (i32.const 300000)))
                (local.set $p (call $copy_mem (i32.const 260600) (local.get $p) (global.get $cal_id_len)))
                (if (i32.gt_s (global.get $date_len) (i32.const 0))
                  (then
                    (local.set $p (call $copy_zstr (i32.const ${S.req_ev_p2.offset}) (local.get $p)))
                    (local.set $p (call $copy_mem (i32.const 260300) (local.get $p) (global.get $date_len)))
                    (local.set $p (call $copy_zstr (i32.const ${S.req_ev_p3.offset}) (local.get $p)))
                    (local.set $p (call $copy_mem (i32.const 260300) (local.get $p) (global.get $date_len)))
                    (local.set $p (call $copy_zstr (i32.const ${S.req_ev_p4.offset}) (local.get $p)))
                  )
                  (else (local.set $p (call $copy_zstr (i32.const ${S.req_ev_end_nodate.offset}) (local.get $p))))
                )
                (global.set $state (i32.const 2))
                (drop (call $host_call (i32.const 300000) (i32.sub (local.get $p) (i32.const 300000)) (i32.const 350000) (i32.const 80000)))
                (return (i32.const 0))
              )
            )
          )
        )
        (return (call $dispatch_reminders))
      )
    )

    ;; State 2: calendar.events -> collect titles -> dispatch reminders
    (if (i32.eq (global.get $state) (i32.const 2))
      (then
        (if (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset}))
          (then
            (global.set $ev_count (call $collect_json_strings (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_title.offset}) (i32.const 261000) (i32.const 3) (i32.const 260980)))
            (global.set $ev_shown (i32.load (i32.const 260980)))
          )
        )
        (return (call $dispatch_reminders))
      )
    )

    ;; State 3: chattree.reminders.list -> collect titles -> dispatch email
    (if (i32.eq (global.get $state) (i32.const 3))
      (then
        (if (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset}))
          (then
            (global.set $rem_count (call $collect_json_strings (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_title.offset}) (i32.const 261500) (i32.const 3) (i32.const 260980)))
            (global.set $rem_shown (i32.load (i32.const 260980)))
          )
        )
        (return (call $dispatch_email))
      )
    )

    ;; State 4: email.inbox -> extract unread_count & subjects -> dispatch Daily Note search
    (if (i32.eq (global.get $state) (i32.const 4))
      (then
        (if (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset}))
          (then
            (global.set $mail_ok (i32.const 1))
            (local.set $v (call $extract_json_int (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_unread_cnt.offset})))
            (global.set $mail_unread (if (result i32) (i32.gt_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 0))))
            (drop (call $collect_json_strings (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_subject.offset}) (i32.const 262000) (i32.const 2) (i32.const 260980)))
            (global.set $mail_shown (i32.load (i32.const 260980)))
          )
        )
        (return (call $dispatch_daily_note))
      )
    )

    ;; State 7: chattree.notes.search ("Daily") -> extract id/title/content -> if content missing, call chattree.notes.get
    (if (i32.eq (global.get $state) (i32.const 7))
      (then
        (if (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset}))
          (then
            (local.set $nlen (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_title.offset}) (i32.const 262600) (i32.const 76)))
            (local.set $llen (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_id.offset}) (i32.const 262700) (i32.const 76)))
            (if (i32.le_s (local.get $llen) (i32.const 0))
              (then (local.set $llen (call $extract_json_num_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_id.offset}) (i32.const 262700) (i32.const 76))))
            )
            (if (i32.or (i32.gt_s (local.get $nlen) (i32.const 0)) (i32.gt_s (local.get $llen) (i32.const 0)))
              (then
                (global.set $note_found (i32.const 1))
                (if (i32.gt_s (local.get $nlen) (i32.const 0)) (then (global.set $note_t_len (local.get $nlen))))
                (local.set $blen (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_content.offset}) (i32.const 295000) (i32.const 400)))
                (if (i32.gt_s (local.get $blen) (i32.const 0))
                  (then (global.set $note_c_len (local.get $blen)))
                  (else
                    (if (i32.gt_s (local.get $llen) (i32.const 0))
                      (then
                        (local.set $p (call $copy_zstr (i32.const ${S.req_note_get_p1.offset}) (i32.const 300000)))
                        (local.set $p (call $copy_mem (i32.const 262700) (local.get $p) (local.get $llen)))
                        (local.set $p (call $copy_zstr (i32.const ${S.req_note_get_p2.offset}) (local.get $p)))
                        (global.set $state (i32.const 9))
                        (drop (call $host_call (i32.const 300000) (i32.sub (local.get $p) (i32.const 300000)) (i32.const 350000) (i32.const 60000)))
                        (return (i32.const 0))
                      )
                    )
                  )
                )
              )
            )
          )
        )
        (return (call $dispatch_weather_or_finish))
      )
    )

    ;; State 9: chattree.notes.get -> extract full note content -> dispatch weather or finish
    (if (i32.eq (global.get $state) (i32.const 9))
      (then
        (if (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset}))
          (then
            (local.set $blen (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_content.offset}) (i32.const 295000) (i32.const 400)))
            (if (i32.gt_s (local.get $blen) (i32.const 0))
              (then (global.set $note_c_len (local.get $blen)))
            )
          )
        )
        (return (call $dispatch_weather_or_finish))
      )
    )

    ;; State 8: Auto IP geolocation (ipwho.is) -> save city/lat/lon -> fetch weather
    (if (i32.eq (global.get $state) (i32.const 8))
      (then
        (if (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset}))
          (then
            (local.set $blen (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_body.offset}) (i32.const 262800) (i32.const 8000)))
            (if (i32.gt_s (local.get $blen) (i32.const 0))
              (then
                (local.set $nlen (call $extract_json_str (i32.const 262800) (local.get $blen) (i32.const ${S.k_city.offset}) (i32.const 260350) (i32.const 76)))
                (local.set $llen (call $extract_json_num_str (i32.const 262800) (local.get $blen) (i32.const ${S.k_lat.offset}) (i32.const 260450) (i32.const 24)))
                (local.set $rlen (call $extract_json_num_str (i32.const 262800) (local.get $blen) (i32.const ${S.k_lon.offset}) (i32.const 260500) (i32.const 24)))
                (if (i32.and (i32.gt_s (local.get $llen) (i32.const 0)) (i32.gt_s (local.get $rlen) (i32.const 0)))
                  (then
                    (global.set $lat_len (local.get $llen))
                    (global.set $lon_len (local.get $rlen))
                    (call $st_set (i32.const ${S.sk_lat.offset}) (i32.const 260450) (global.get $lat_len))
                    (call $st_set (i32.const ${S.sk_lon.offset}) (i32.const 260500) (global.get $lon_len))
                    (if (i32.gt_s (local.get $nlen) (i32.const 0))
                      (then
                        (global.set $city_len (local.get $nlen))
                        (call $st_set (i32.const ${S.sk_city.offset}) (i32.const 260350) (global.get $city_len))
                      )
                    )
                    (return (call $dispatch_weather))
                  )
                )
              )
            )
          )
        )
        (return (call $finish_or_notify))
      )
    )

    ;; State 5: Open-Meteo weather HTTP response -> parse body -> finish or notify
    (if (i32.eq (global.get $state) (i32.const 5))
      (then
        (if (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset}))
          (then
            (local.set $blen (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_body.offset}) (i32.const 262800) (i32.const 30000)))
            (if (i32.gt_s (local.get $blen) (i32.const 0))
              (then
                (local.set $cur_off (call $find_sub (i32.const 262800) (local.get $blen) (i32.const ${S.k_current.offset}) (i32.const ${S.k_current.len})))
                (if (i32.ge_s (local.get $cur_off) (i32.const 0))
                  (then
                    (local.set $nlen (call $extract_json_num_str (i32.add (i32.const 262800) (local.get $cur_off)) (i32.sub (local.get $blen) (local.get $cur_off)) (i32.const ${S.k_temp.offset}) (i32.const 260800) (i32.const 16)))
                    (if (i32.gt_s (local.get $nlen) (i32.const 0))
                      (then
                        (global.set $temp_len (local.get $nlen))
                        (global.set $wx_ok (i32.const 1))
                        (local.set $v (call $extract_json_int (i32.add (i32.const 262800) (local.get $cur_off)) (i32.sub (local.get $blen) (local.get $cur_off)) (i32.const ${S.k_wcode.offset})))
                        (global.set $wcode (if (result i32) (i32.ge_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 0))))
                      )
                    )
                  )
                )
                (local.set $day_off (call $find_sub (i32.const 262800) (local.get $blen) (i32.const ${S.k_daily.offset}) (i32.const ${S.k_daily.len})))
                (if (i32.ge_s (local.get $day_off) (i32.const 0))
                  (then
                    (local.set $nlen (call $extract_json_num_str (i32.add (i32.const 262800) (local.get $day_off)) (i32.sub (local.get $blen) (local.get $day_off)) (i32.const ${S.k_tmax.offset}) (i32.const 260840) (i32.const 16)))
                    (if (i32.gt_s (local.get $nlen) (i32.const 0)) (then (global.set $tmax_len (local.get $nlen))))
                    (local.set $nlen (call $extract_json_num_str (i32.add (i32.const 262800) (local.get $day_off)) (i32.sub (local.get $blen) (local.get $day_off)) (i32.const ${S.k_tmin.offset}) (i32.const 260880) (i32.const 16)))
                    (if (i32.gt_s (local.get $nlen) (i32.const 0)) (then (global.set $tmin_len (local.get $nlen))))
                  )
                )
              )
            )
          )
        )
        (return (call $finish_or_notify))
      )
    )

    ;; State 6: notifications.send completed -> return UI card
    (if (i32.eq (global.get $state) (i32.const 6))
      (then (return (call $render_briefing)))
    )

    ;; State 10: Open-Meteo Geocoding response -> save city/lat/lon
    (if (i32.eq (global.get $state) (i32.const 10))
      (then
        (if (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset}))
          (then
            (local.set $blen (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_body.offset}) (i32.const 262800) (i32.const 30000)))
            (if (i32.gt_s (local.get $blen) (i32.const 0))
              (then
                (local.set $nlen (call $extract_json_str (i32.const 262800) (local.get $blen) (i32.const ${S.k_name.offset}) (i32.const 260350) (i32.const 76)))
                (local.set $llen (call $extract_json_num_str (i32.const 262800) (local.get $blen) (i32.const ${S.k_lat.offset}) (i32.const 260450) (i32.const 24)))
                (local.set $rlen (call $extract_json_num_str (i32.const 262800) (local.get $blen) (i32.const ${S.k_lon.offset}) (i32.const 260500) (i32.const 24)))
                (if (i32.and (i32.gt_s (local.get $nlen) (i32.const 0))
                             (i32.and (i32.gt_s (local.get $llen) (i32.const 0)) (i32.gt_s (local.get $rlen) (i32.const 0))))
                  (then
                    (global.set $city_len (local.get $nlen))
                    (global.set $lat_len (local.get $llen))
                    (global.set $lon_len (local.get $rlen))
                    (call $st_set (i32.const ${S.sk_city.offset}) (i32.const 260350) (global.get $city_len))
                    (call $st_set (i32.const ${S.sk_lat.offset}) (i32.const 260450) (global.get $lat_len))
                    (call $st_set (i32.const ${S.sk_lon.offset}) (i32.const 260500) (global.get $lon_len))

                    (call $emit_reset)
                    (call $emit_zstr (i32.const ${S.ui_start.offset})) (call $emit_zstr (i32.const ${S.t_city_ok.offset}))
                    (call $emit_zstr (i32.const ${S.ui_mid1.offset})) (call $emit_zstr (i32.const ${S.t_city_ok.offset}))
                    (call $emit_zstr (i32.const ${S.ui_sub.offset})) (call $emit_zstr (i32.const ${S.t_city_ok_sub.offset}))
                    (call $emit_zstr (i32.const ${S.ui_badge.offset})) (call $emit_zstr (i32.const ${S.t_city_ok_badge.offset}))
                    (call $emit_zstr (i32.const ${S.ui_bc_green.offset}))
                    (call $emit_zstr (i32.const ${S.el_kv_start.offset}))
                    (call $emit_zstr (i32.const ${S.el_kv_1.offset})) (call $emit_zstr (i32.const ${S.kv_city.offset})) (call $emit_zstr (i32.const ${S.el_kv_2.offset})) (call $emit_json_esc (i32.const 260350) (global.get $city_len)) (call $emit_zstr (i32.const ${S.el_kv_item_end.offset})) (call $emit_byte (i32.const 44))
                    (call $emit_zstr (i32.const ${S.el_kv_1.offset})) (call $emit_zstr (i32.const ${S.kv_coords.offset})) (call $emit_zstr (i32.const ${S.el_kv_2.offset})) (call $emit_mem (i32.const 260450) (global.get $lat_len)) (call $emit_byte (i32.const 44)) (call $emit_byte (i32.const 32)) (call $emit_mem (i32.const 260500) (global.get $lon_len)) (call $emit_zstr (i32.const ${S.el_kv_item_end.offset}))
                    (call $emit_zstr (i32.const ${S.el_kv_end.offset}))
                    (call $emit_byte (i32.const 44)) (call $emit_zstr (i32.const ${S.el_btns_simple.offset}))
                    (call $emit_zstr (i32.const ${S.ui_end.offset}))
                    (return (call $emit_len))
                  )
                )
              )
            )
          )
        )
        (return (call $render_simple
          (i32.const ${S.t_city_err.offset}) (i32.const ${S.t_city_err_sub.offset})
          (i32.const ${S.t_city_err_badge.offset}) (i32.const ${S.ui_bc_red.offset})
          (i32.const ${S.t_city_err_body.offset}) (i32.const ${S.el_btns_simple.offset})
        ))
      )
    )

    ;; State 11: scheduler.schedule response
    (if (i32.eq (global.get $state) (i32.const 11))
      (then
        (call $st_set (i32.const ${S.sk_sched.offset}) (i32.const 260550) (global.get $sched_len))
        (call $emit_reset)
        (call $emit_zstr (i32.const ${S.ui_start.offset})) (call $emit_zstr (i32.const ${S.t_sched_ok.offset}))
        (call $emit_zstr (i32.const ${S.ui_mid1.offset})) (call $emit_zstr (i32.const ${S.t_sched_ok.offset}))
        (call $emit_zstr (i32.const ${S.ui_sub.offset})) (call $emit_zstr (i32.const ${S.t_sched_ok_sub.offset}))
        (call $emit_zstr (i32.const ${S.ui_badge.offset})) (call $emit_zstr (i32.const ${S.t_sched_ok_badge.offset}))
        (call $emit_zstr (i32.const ${S.ui_bc_alarm.offset}))
        (call $emit_zstr (i32.const ${S.el_kv_start.offset}))
        (call $emit_zstr (i32.const ${S.el_kv_1.offset})) (call $emit_zstr (i32.const ${S.kv_schedule.offset})) (call $emit_zstr (i32.const ${S.el_kv_2.offset})) (call $emit_zstr (i32.const ${S.s_daily_at.offset})) (call $emit_mem (i32.const 260550) (global.get $sched_len)) (call $emit_zstr (i32.const ${S.el_kv_item_end.offset}))
        (call $emit_zstr (i32.const ${S.el_kv_end.offset}))
        (call $emit_byte (i32.const 44)) (call $emit_zstr (i32.const ${S.el_btns_simple.offset}))
        (call $emit_zstr (i32.const ${S.ui_end.offset}))
        (return (call $emit_len))
      )
    )

    ;; State 12: scheduler.cancel response
    (if (i32.eq (global.get $state) (i32.const 12))
      (then
        (call $st_set (i32.const ${S.sk_sched.offset}) (i32.const 260550) (i32.const 0))
        (global.set $sched_len (i32.const 0))
        (return (call $render_simple
          (i32.const ${S.t_unsched_ok.offset}) (i32.const ${S.t_unsched_ok_sub.offset})
          (i32.const ${S.t_unsched_ok_badge.offset}) (i32.const ${S.ui_bc_orange.offset})
          (i32.const ${S.t_unsched_body.offset}) (i32.const ${S.el_btns_simple.offset})
        ))
      )
    )

    (call $render_briefing)
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
  id: 'com.chattree.official.briefing',
  version: '1.0.4',
  name: 'Daily Briefing',
  description: 'Automatic morning summary combining today\'s calendar events, pending reminders, unread emails, your "Daily" Chattree note, and live Open-Meteo weather in one blue Flutter UI card with daily cron scheduling.',
  author: 'Chattree Core Team',
  primaryCommand: 'briefing',
  aliases: ['morning', 'resumen', 'digest'],
  type: 'imported',
  category: 'productivity',
  capabilities: [
    'storage.private',
    'calendar.read',
    'chattree.reminders.read',
    'chattree.notes.read',
    'chattree.notes.search',
    'email.read',
    'network.http',
    'scheduler.cron',
    'notifications.send',
    'ui.components',
  ],
  allowedDomains: [
    'api.open-meteo.com',
    'geocoding-api.open-meteo.com',
    'ipwho.is',
  ],
  tags: ['briefing', 'morning', 'calendar', 'reminders', 'notes', 'email', 'weather', 'cron', 'ui', 'official'],
  iconUrl: 'https://raw.githubusercontent.com/Ponce5/Chattree/main/plugins/official/briefing/icon.png?v=1.0.4',
  bannerUrl: 'https://raw.githubusercontent.com/Ponce5/Chattree/main/plugins/official/briefing/banner.png?v=1.0.4',
  changelog: '1.0.4: Fetches full Daily note body via chattree.notes.get when search omits content and displays only the note content in the Daily Note section.',
  runtime: 'wasm',
  entrypoint: 'briefing_entry',
  wasmPath: 'plugin.wasm',
  wasmSha256,
  runtimeApiVersion: '1.0.0',
  maxMemoryPages: 32,
  timeoutMs: 35000,
  fuelLimit: 100000000,
  inputOffset: 0,
  outputOffset: 65536,
  maxPayloadSizeBytes: 65536,
  tools: [
    {
      id: 'com.chattree.official.briefing.digest',
      command: 'briefing',
      displayName: 'Daily Briefing',
      description: 'Generate a morning briefing combining calendar events, pending reminders, unread emails, your "Daily" Chattree note, and live weather, or schedule it daily. Always include "tool":"briefing" and return ONE JSON object. Actions: "briefing", "city" (set weather city in "city"), "note" (set which Chattree note title to include in "note", default "Daily"), "schedule" (24h "time" like "08:00"), "unschedule", "notify", "status", or "help". Always include "date" as YYYY-MM-DD.',
      capabilities: [
        'storage.private',
        'calendar.read',
        'chattree.reminders.read',
        'chattree.notes.read',
        'chattree.notes.search',
        'email.read',
        'network.http',
        'scheduler.cron',
        'notifications.send',
        'ui.components',
      ],
      intentContract: {
        intent: 'briefing_action',
        validIntents: ['briefing', 'city', 'note', 'schedule', 'unschedule', 'notify', 'status', 'help'],
        description: 'Interpret the user\'s daily briefing request (English or Spanish) and return ONE valid JSON object with "tool":"briefing", "action", optional "city"/"note"/"time", and "date" (YYYY-MM-DD).',
        fields: [
          {
            name: 'action',
            key: 'action',
            type: 'string',
            description: 'Action: "briefing", "city", "note", "schedule", "unschedule", "notify", "status", or "help".',
            required: true,
          },
          {
            name: 'city',
            key: 'city',
            type: 'string',
            description: 'City name for weather (when action="city", e.g. "Madrid", "Mexico City").',
            required: false,
          },
          {
            name: 'note',
            key: 'note',
            type: 'string',
            description: 'Chattree note title to display in briefing (when action="note", default "Daily").',
            required: false,
          },
          {
            name: 'time',
            key: 'time',
            type: 'string',
            description: '24-hour time HH:MM for daily cron schedule (when action="schedule", e.g. "08:00", "07:30").',
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
            input: 'dame mi resumen del día',
            output: { tool: 'briefing', action: 'briefing', date: '2026-11-25' },
          },
          {
            input: 'configura mi ciudad en Ciudad de México',
            output: { tool: 'briefing', action: 'city', city: 'Ciudad de México', date: '2026-11-25' },
          },
          {
            input: 'programa mi briefing diario a las 7:30 am',
            output: { tool: 'briefing', action: 'schedule', time: '07:30', date: '2026-11-25' },
          },
          {
            input: 'cancela el resumen automático',
            output: { tool: 'briefing', action: 'unschedule', date: '2026-11-25' },
          },
        ],
        maxResponseTokens: 400,
      },
    },
  ],
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`[OK] Built ${wasmPath} (${wasmBytes.length} bytes, sha256=${wasmSha256})`);

// ── Self-Test Suite (Full Async Host Pipeline) ───────────────────────────
function wrapEnvelope(aiObj) {
  const decoded = { ...aiObj, lang: 'es' };
  const operation = (decoded.action || 'briefing').toLowerCase();
  const payload = {};
  for (const [k, v] of Object.entries(decoded)) {
    const kl = k.toLowerCase();
    if (kl !== 'tool' && kl !== 'action') payload[kl] = v;
  }
  return JSON.stringify({ api: 'briefing', command: 'briefing', toolId: 'com.chattree.official.briefing.digest', operation, payload });
}

const storage = {};
let mem;
let pendingReq = null;
let pendingResPtr = 0;
let pendingResMax = 0;
const calls = [];

const mod = await WebAssembly.instantiate(wasmBytes, {
  chattree: {
    host_call: (reqPtr, reqLen, resPtr, resMaxLen) => {
      const reqStr = Buffer.from(mem.buffer, reqPtr, reqLen).toString('utf8');
      const req = JSON.parse(reqStr);
      calls.push(req);
      if (req.api === 'storage') {
        let resp;
        if (req.operation === 'set') {
          storage[req.payload.key] = req.payload.value;
          resp = JSON.stringify({ success: true, data: { key: req.payload.key, value: req.payload.value, stored: true }, error: null });
        } else {
          const val = storage[req.payload.key] ?? null;
          resp = JSON.stringify({ success: true, data: { key: req.payload.key, value: val, exists: val !== null }, error: null });
        }
        const buf = Buffer.from(resp, 'utf8');
        Buffer.from(mem.buffer).set(buf, resPtr);
        return buf.length;
      }
      pendingReq = req;
      pendingResPtr = resPtr;
      pendingResMax = resMaxLen;
      return 0;
    },
  },
});
mem = mod.instance.exports.memory;

function runAsync(inp, asyncResponder) {
  calls.length = 0;
  pendingReq = null;
  const buf = Buffer.from(inp, 'utf8');
  Buffer.from(mem.buffer).set(buf, 0);
  let outLen = mod.instance.exports.briefing_entry(0, buf.length);
  let hops = 0;
  while (outLen === 0 && pendingReq && hops < 10) {
    hops++;
    const req = pendingReq;
    pendingReq = null;
    const respObj = asyncResponder(req);
    const rbuf = Buffer.from(JSON.stringify(respObj), 'utf8');
    const wlen = Math.min(rbuf.length, pendingResMax);
    Buffer.from(mem.buffer).set(rbuf.subarray(0, wlen), pendingResPtr);
    outLen = mod.instance.exports.resume(pendingResPtr, wlen);
  }
  const raw = Buffer.from(mem.buffer, 65536, outLen).toString('utf8');
  return JSON.parse(raw);
}

const mockHost = (req) => {
  if (req.api === 'calendar' && req.operation === 'calendars') {
    return { success: true, data: { calendars: [{ id: 'cal_primary', name: 'Personal' }] } };
  }
  if (req.api === 'calendar' && req.operation === 'events') {
    return { success: true, data: { events: [{ title: 'Team Standup', start: '2026-11-25T10:00:00' }, { title: 'Dentist', start: '2026-11-25T16:00:00' }] } };
  }
  if (req.api === 'chattree.reminders' && req.operation === 'list') {
    return { success: true, data: { reminders: [{ id: 'r1', title: 'Pay rent', status: 'pending' }], count: 1 } };
  }
  if (req.api === 'email' && req.operation === 'inbox') {
    return { success: true, data: { account: 'user@gmail.com', unread_count: 3, total_count: 10, emails: [{ subject: 'Invoice Ready' }] } };
  }
  if (req.api === 'chattree.notes' && req.operation === 'search') {
    return { success: true, data: { notes: [{ id: 'n1', title: 'Daily' }], count: 1 } };
  }
  if (req.api === 'chattree.notes' && req.operation === 'get') {
    return { success: true, data: { note: { id: 'n1', title: 'Daily', content: 'Focus on shipping v1.0\nReview PRs before noon' } } };
  }
  if (req.api === 'network' && req.payload.url.includes('geocoding-api')) {
    return { success: true, data: { statusCode: 200, body: JSON.stringify({ results: [{ name: 'Madrid', latitude: 40.4165, longitude: -3.7026 }] }) } };
  }
  if (req.api === 'network' && req.payload.url.includes('ipwho.is')) {
    return { success: true, data: { statusCode: 200, body: JSON.stringify({ success: true, city: 'Mexico City', latitude: 19.4326, longitude: -99.1332 }) } };
  }
  if (req.api === 'network' && req.payload.url.includes('api.open-meteo.com')) {
    return { success: true, data: { statusCode: 200, body: JSON.stringify({ current: { temperature_2m: 21.5, weather_code: 1 }, daily: { temperature_2m_max: [24.0], temperature_2m_min: [12.5] } }) } };
  }
  if (req.api === 'scheduler' && req.operation === 'schedule') {
    return { success: true, data: { scheduled: true, taskId: 'daily_briefing' } };
  }
  if (req.api === 'scheduler' && req.operation === 'cancel') {
    return { success: true, data: { cancelled: true, taskId: 'daily_briefing' } };
  }
  if (req.api === 'notifications' && req.operation === 'send') {
    return { success: true, data: { sent: true, notificationId: 1 } };
  }
  return { success: false, error: 'Not mocked' };
};

// 1. Set city via AI envelope
let out = runAsync(wrapEnvelope({ tool: 'briefing', action: 'city', city: 'Madrid', date: '2026-11-25' }), mockHost);
assert.equal(out.ui.badge, 'SAVED');
assert.equal(storage.briefing_city, 'Madrid');
assert.equal(storage.briefing_lat, '40.4165');

// 2. Schedule daily briefing at 07:30
out = runAsync(wrapEnvelope({ tool: 'briefing', action: 'schedule', time: '07:30', date: '2026-11-25' }), mockHost);
assert.equal(out.ui.badge, 'SCHEDULED');
assert.equal(storage.briefing_schedule, '07:30');
assert.ok(calls.some((c) => c.api === 'scheduler' && c.payload.cronExpression === '30 7 * * *'));

// 3. Full briefing (calendar + reminders + email + Daily note content + weather) in BLUE vertical list layout
out = runAsync('lang=es', mockHost);
assert.equal(out.type, 'ui');
assert.equal(out.ui.badgeColor, 'blue');
assert.equal(out.ui.elements[0].type, 'list');
assert.match(out.ui.elements[0].items[0].subtitle, /Madrid: 21\.5 C Partly Cloudy/);
assert.equal(out.ui.elements[0].items[1].subtitle, '2 events');
assert.equal(out.ui.elements[0].items[2].subtitle, '1 pending');
assert.equal(out.ui.elements[0].items[3].subtitle, '3 unread');
// Daily Note row shows ONLY the note content (fetched via chattree.notes.get), NOT the title "Daily"
assert.match(out.ui.elements[0].items[4].subtitle, /Focus on shipping v1\.0/);
assert.ok(!out.ui.elements[0].items[4].subtitle.includes('Daily'));
assert.ok(calls.some((c) => c.api === 'chattree.notes' && c.operation === 'get' && c.payload.id === 'n1'));
assert.equal(out.ui.elements[0].items[5].subtitle, 'Daily at 07:30');
// Divider + highlights list
assert.equal(out.ui.elements[1].type, 'divider');
assert.equal(out.ui.elements[2].items.length, 4); // 2 events + 1 reminder + 1 email

// 3b. Custom briefing note name
out = runAsync('note Morning Goals lang=es', mockHost);
assert.equal(out.ui.badge, 'SAVED');
assert.equal(storage.briefing_note, 'Morning Goals');

// 4. Notify mode sends local notification
out = runAsync('notify lang=es', mockHost);
assert.ok(calls.some((c) => c.api === 'notifications' && c.operation === 'send'));

// 5. Graceful fallback when email is NOT configured
out = runAsync('lang=es', (req) => req.api === 'email' ? { success: false, error: 'Not configured' } : mockHost(req));
assert.equal(out.ui.elements[0].items[3].subtitle, 'Not configured');

// 6. Unschedule, Status, Help
out = runAsync('unschedule lang=es', mockHost);
assert.equal(out.ui.badge, 'OFF');
assert.equal(storage.briefing_schedule, '');
out = runAsync('status lang=es', mockHost);
assert.equal(out.ui.badge, 'STATUS');
assert.equal(out.ui.elements[0].type, 'list');
out = runAsync('help lang=es', mockHost);
assert.equal(out.ui.badge, 'GUIDE');

// 7. Auto-detect weather city via ipwho.is on first run (no city saved)
delete storage.briefing_city;
delete storage.briefing_lat;
delete storage.briefing_lon;
delete storage.briefing_note;
delete storage.briefing_date;
out = runAsync('lang=es', mockHost);
assert.equal(out.type, 'ui');
assert.equal(out.ui.badgeColor, 'blue');
assert.equal(storage.briefing_city, 'Mexico City');
assert.equal(storage.briefing_lat, '19.4326');
assert.match(out.ui.elements[0].items[0].subtitle, /Mexico City: 21\.5 C Partly Cloudy/);

// 8. Graceful fallback when ipwho.is fails + no Daily note + email not configured
delete storage.briefing_city;
delete storage.briefing_lat;
delete storage.briefing_lon;
out = runAsync('lang=es', (req) => {
  if (req.api === 'network' && req.payload.url.includes('ipwho.is')) return { success: false, error: 'Offline' };
  if (req.api === 'chattree.notes') return { success: true, data: { notes: [], count: 0 } };
  if (req.api === 'chattree.reminders') return { success: true, data: { reminders: [], count: 0 } };
  if (req.api === 'email') return { success: false, error: 'Not configured' };
  return mockHost(req);
});
assert.equal(out.type, 'ui');
assert.equal(out.ui.badgeColor, 'blue');
assert.equal(out.ui.elements[0].items[0].subtitle, 'Not set (/briefing city <name>)');
assert.equal(out.ui.elements[0].items[4].subtitle, 'Create a note titled Daily to show it here');

console.log('[OK] All 10 Daily Briefing WASM async pipeline tests passed!');
