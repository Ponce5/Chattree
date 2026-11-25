import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDir = path.resolve(__dirname, '../plugins/official/flashcards');
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

// SQLite Host API templates
S.sql_init = registerData(
  'sql_init',
  '{"api":"database","operation":"execute","payload":{"sql":"CREATE TABLE IF NOT EXISTS flashcards (id INTEGER PRIMARY KEY AUTOINCREMENT, deck TEXT NOT NULL DEFAULT \'General\', front TEXT NOT NULL, back TEXT NOT NULL, interval_days INTEGER NOT NULL DEFAULT 0, ease INTEGER NOT NULL DEFAULT 250, reps INTEGER NOT NULL DEFAULT 0, due_at INTEGER NOT NULL DEFAULT 0)"}}'
);
S.sql_add_p1 = registerData(
  'sql_add_p1',
  '{"api":"database","operation":"execute","payload":{"sql":"INSERT INTO flashcards (deck, front, back, interval_days, ease, reps, due_at) VALUES (?, ?, ?, 0, 250, 0, 0)","args":["'
);
S.sql_arg_sep = registerData('sql_arg_sep', '","');
S.sql_arg_end = registerData('sql_arg_end', '"]}}');

S.sql_next_due = registerData(
  'sql_next_due',
  '{"api":"database","operation":"query","payload":{"sql":"SELECT id, deck, front, back, interval_days, ease, reps, (SELECT COUNT(*) FROM flashcards WHERE due_at <= CAST(strftime(\'%s\',\'now\') AS INTEGER)) AS due_cnt, (SELECT COUNT(*) FROM flashcards) AS total_cnt FROM flashcards WHERE due_at <= CAST(strftime(\'%s\',\'now\') AS INTEGER) ORDER BY due_at ASC, id ASC LIMIT 1"}}'
);
S.sql_next_practice = registerData(
  'sql_next_practice',
  '{"api":"database","operation":"query","payload":{"sql":"SELECT id, deck, front, back, interval_days, ease, reps, (SELECT COUNT(*) FROM flashcards) AS due_cnt, (SELECT COUNT(*) FROM flashcards) AS total_cnt FROM flashcards ORDER BY due_at ASC, id ASC LIMIT 1"}}'
);
S.sql_next_skip_p1 = registerData(
  'sql_next_skip_p1',
  '{"api":"database","operation":"query","payload":{"sql":"SELECT id, deck, front, back, interval_days, ease, reps, (SELECT COUNT(*) FROM flashcards WHERE due_at <= CAST(strftime(\'%s\',\'now\') AS INTEGER)) AS due_cnt, (SELECT COUNT(*) FROM flashcards) AS total_cnt FROM flashcards WHERE id != ? ORDER BY due_at ASC, id ASC LIMIT 1","args":['
);
S.sql_num_end = registerData('sql_num_end', ']}}');

S.sql_count_all = registerData(
  'sql_count_all',
  '{"api":"database","operation":"query","payload":{"sql":"SELECT COUNT(*) AS total_cnt FROM flashcards"}}'
);
S.sql_get_p1 = registerData(
  'sql_get_p1',
  '{"api":"database","operation":"query","payload":{"sql":"SELECT id, deck, front, back, interval_days, ease, reps FROM flashcards WHERE id = ? LIMIT 1","args":['
);
S.sql_upd_p1 = registerData(
  'sql_upd_p1',
  '{"api":"database","operation":"execute","payload":{"sql":"UPDATE flashcards SET interval_days = ?, ease = ?, reps = ?, due_at = CAST(strftime(\'%s\',\'now\') AS INTEGER) + ? WHERE id = ?","args":['
);
S.sql_list = registerData(
  'sql_list',
  '{"api":"database","operation":"query","payload":{"sql":"SELECT id, deck, front, interval_days, reps FROM flashcards ORDER BY id DESC LIMIT 10"}}'
);
S.sql_stats = registerData(
  'sql_stats',
  '{"api":"database","operation":"query","payload":{"sql":"SELECT COUNT(*) AS total_cnt, COALESCE(SUM(CASE WHEN due_at <= CAST(strftime(\'%s\',\'now\') AS INTEGER) THEN 1 ELSE 0 END), 0) AS due_cnt, COALESCE(SUM(CASE WHEN reps >= 3 THEN 1 ELSE 0 END), 0) AS mastered_cnt FROM flashcards"}}'
);
S.sql_del_p1 = registerData(
  'sql_del_p1',
  '{"api":"database","operation":"execute","payload":{"sql":"DELETE FROM flashcards WHERE id = ?","args":['
);

// JSON keys
S.k_op = registerData('k_op', 'operation');
S.k_action = registerData('k_action', 'action');
S.k_front = registerData('k_front', 'front');
S.k_question = registerData('k_question', 'question');
S.k_back = registerData('k_back', 'back');
S.k_answer = registerData('k_answer', 'answer');
S.k_deck = registerData('k_deck', 'deck');
S.k_id = registerData('k_id', 'id');
S.k_rating = registerData('k_rating', 'rating');
S.k_interval = registerData('k_interval', 'interval_days');
S.k_ease = registerData('k_ease', 'ease');
S.k_reps = registerData('k_reps', 'reps');
S.k_due_cnt = registerData('k_due_cnt', 'due_cnt');
S.k_total_cnt = registerData('k_total_cnt', 'total_cnt');
S.k_mastered = registerData('k_mastered', 'mastered_cnt');
S.k_success = registerData('k_success', 'success');
S.k_rows = registerData('k_rows', '"rows"');
S.k_lang_eq = registerData('k_lang_eq', 'lang=');

// Actions & keywords
S.a_study = registerData('a_study', 'study');
S.a_add = registerData('a_add', 'add');
S.a_create = registerData('a_create', 'create');
S.a_new = registerData('a_new', 'new');
S.a_reveal = registerData('a_reveal', 'reveal');
S.a_show = registerData('a_show', 'show');
S.a_rate = registerData('a_rate', 'rate');
S.a_skip = registerData('a_skip', 'skip');
S.a_practice = registerData('a_practice', 'practice');
S.a_list = registerData('a_list', 'list');
S.a_stats = registerData('a_stats', 'stats');
S.a_delete = registerData('a_delete', 'delete');
S.a_remove = registerData('a_remove', 'remove');
S.a_help = registerData('a_help', 'help');

S.r_hard = registerData('r_hard', 'hard');
S.r_dificil = registerData('r_dificil', 'dificil');
S.r_easy = registerData('r_easy', 'easy');
S.r_facil = registerData('r_facil', 'facil');
S.def_deck = registerData('def_deck', 'General');

// Minimalist Purple UI JSON Fragments (distinct from Habits green & Briefing blue)
S.ui_start = registerData('ui_start', '{"type":"ui","displayText":"');
S.ui_mid1 = registerData('ui_mid1', '","ui":{"title":"');
S.ui_sub = registerData('ui_sub', '","subtitle":"');
S.ui_badge = registerData('ui_badge', '","badge":"');
S.ui_bc_note = registerData('ui_bc_note', '","badgeColor":"purple","icon":"note","hideText":true,"elements":[');
S.ui_bc_check = registerData('ui_bc_check', '","badgeColor":"purple","icon":"check","hideText":true,"elements":[');
S.ui_bc_stats = registerData('ui_bc_stats', '","badgeColor":"purple","icon":"analytics","hideText":true,"elements":[');
S.ui_bc_warn = registerData('ui_bc_warn', '","badgeColor":"orange","icon":"warning","hideText":true,"elements":[');
S.ui_end = registerData('ui_end', ']}}');

S.el_div = registerData('el_div', '{"type":"divider"}');
S.el_text_1 = registerData('el_text_1', '{"type":"text","content":"');
S.el_text_e = registerData('el_text_e', '"}');
S.el_pill_q = registerData('el_pill_q', '{"type":"badge","text":"QUESTION","color":"purple"}');
S.el_pill_a = registerData('el_pill_a', '{"type":"badge","text":"ANSWER","color":"green"}');
S.el_pill_done = registerData('el_pill_done', '{"type":"badge","text":"ALL CAUGHT UP","color":"green"}');
S.el_pill_start = registerData('el_pill_start', '{"type":"badge","text":"GET STARTED","color":"purple"}');
S.el_pill_saved = registerData('el_pill_saved', '{"type":"badge","text":"CARD SAVED","color":"purple"}');
S.el_pill_stats = registerData('el_pill_stats', '{"type":"badge","text":"MASTERY","color":"purple"}');

S.el_prog_1 = registerData('el_prog_1', '{"type":"progress","value":');
S.el_prog_2 = registerData('el_prog_2', ',"label":"');
S.el_prog_e = registerData('el_prog_e', '","color":"purple"}');

S.el_list_s = registerData('el_list_s', '{"type":"list","items":[');
S.el_list_1 = registerData('el_list_1', '{"title":"');
S.el_list_2 = registerData('el_list_2', '","subtitle":"');
S.el_list_ie = registerData('el_list_ie', '"}');
S.el_list_e = registerData('el_list_e', ']}');

// Interactive button rows
S.btn_study_p1 = registerData('btn_study_p1', '{"type":"button_row","buttons":[{"label":"Show Answer","action":"command","value":"/flashcards reveal ');
S.btn_study_p2 = registerData('btn_study_p2', '","style":"primary"},{"label":"Skip","action":"command","value":"/flashcards skip ');
S.btn_study_p3 = registerData('btn_study_p3', '","style":"secondary"}]}');

S.btn_rate_p1 = registerData('btn_rate_p1', '{"type":"button_row","buttons":[{"label":"Hard","action":"command","value":"/flashcards rate ');
S.btn_rate_p2 = registerData('btn_rate_p2', ' hard","style":"danger"},{"label":"Good","action":"command","value":"/flashcards rate ');
S.btn_rate_p3 = registerData('btn_rate_p3', ' good","style":"primary"},{"label":"Easy","action":"command","value":"/flashcards rate ');
S.btn_rate_p4 = registerData('btn_rate_p4', ' easy","style":"secondary"}]}');

S.btn_done = registerData('btn_done', '{"type":"button_row","buttons":[{"label":"Practice Early","action":"command","value":"/flashcards practice","style":"primary"},{"label":"Stats","action":"command","value":"/flashcards stats","style":"secondary"}]}');
S.btn_home = registerData('btn_home', '{"type":"button_row","buttons":[{"label":"Study Now","action":"command","value":"/flashcards","style":"primary"},{"label":"All Cards","action":"command","value":"/flashcards list","style":"secondary"}]}');
S.btn_empty = registerData('btn_empty', '{"type":"button_row","buttons":[{"label":"Guide","action":"command","value":"/flashcards help","style":"secondary"}]}');

// Copy strings (all JSON-safe, zero unescaped quotes)
S.t_app = registerData('t_app', 'Flashcards');
S.t_study_badge = registerData('t_study_badge', 'STUDY');
S.t_ans_badge = registerData('t_ans_badge', 'ANSWER');
S.t_ans_sub = registerData('t_ans_sub', 'Rate how well you remembered');
S.t_due_suf = registerData('t_due_suf', ' due now');
S.t_of = registerData('t_of', ' of ');
S.t_mastery_p = registerData('t_mastery_p', 'Mastery · Level ');
S.t_mastery_s = registerData('t_mastery_s', '/5');

S.t_done_title = registerData('t_done_title', 'Study Session');
S.t_done_sub = registerData('t_done_sub', 'All due cards reviewed');
S.t_done_badge = registerData('t_done_badge', 'DONE');
S.t_done_prog = registerData('t_done_prog', '100% reviewed today');
S.t_done_body = registerData('t_done_body', 'Nice work. Add a new card or practice early anytime.');

S.t_empty_sub = registerData('t_empty_sub', 'Spaced repetition study tutor');
S.t_empty_badge = registerData('t_empty_badge', 'READY');
S.t_empty_body = registerData('t_empty_body', 'Create your first flashcard:\\n/flashcards add Question | Answer\\n\\nOr ask naturally in chat.');

S.t_saved_title = registerData('t_saved_title', 'Flashcard Added');
S.t_saved_sub = registerData('t_saved_sub', 'Ready for spaced repetition');
S.t_saved_badge = registerData('t_saved_badge', 'SAVED');
S.t_q_pfx = registerData('t_q_pfx', 'Q: ');
S.t_a_pfx = registerData('t_a_pfx', '\\nA: ');

S.t_err_add_title = registerData('t_err_add_title', 'Missing Question or Answer');
S.t_err_add_sub = registerData('t_err_add_sub', 'Separate front and back with |');
S.t_err_add_badge = registerData('t_err_add_badge', 'FORMAT');
S.t_err_add_body = registerData('t_err_add_body', 'Example: /flashcards add Capital of Japan? | Tokyo');

S.t_del_title = registerData('t_del_title', 'Flashcard Deleted');
S.t_del_sub = registerData('t_del_sub', 'Removed from your SQLite deck');
S.t_del_badge = registerData('t_del_badge', 'DELETED');
S.t_del_body = registerData('t_del_body', 'Card removed. Start studying your remaining deck anytime.');

S.t_list_title = registerData('t_list_title', 'Your Flashcards');
S.t_list_sub = registerData('t_list_sub', 'Recent cards in your SQLite deck');
S.t_list_badge = registerData('t_list_badge', 'DECK');
S.t_lv_pfx = registerData('t_lv_pfx', ' · Lv ');
S.t_d_pfx = registerData('t_d_pfx', ' · ');
S.t_d_suf = registerData('t_d_suf', 'd');
S.t_hash = registerData('t_hash', '#');
S.t_dot = registerData('t_dot', ' · ');

S.t_stats_title = registerData('t_stats_title', 'Study Progress');
S.t_stats_sub = registerData('t_stats_sub', 'Spaced repetition mastery');
S.t_stats_badge = registerData('t_stats_badge', 'STATS');
S.t_mastered_suf = registerData('t_mastered_suf', ' mastered');
S.t_due_lbl = registerData('t_due_lbl', 'Due now: ');
S.t_tot_lbl = registerData('t_tot_lbl', ' · Total cards: ');

S.t_help_title = registerData('t_help_title', 'Flashcards Guide');
S.t_help_sub = registerData('t_help_sub', 'Spaced repetition stored in local SQLite');
S.t_help_badge = registerData('t_help_badge', 'GUIDE');
S.t_help_body = registerData('t_help_body', 'Commands & natural language:\\n- /flashcards — Study next due card\\n- /flashcards add Question | Answer — Create a flashcard\\n- /flashcards practice — Review cards early\\n- /flashcards list — View saved cards\\n- /flashcards stats — View mastery progress\\n- /flashcards delete <id> — Delete a card');

const dataBlock = dataEntries
  .map((e) => `  (data (i32.const ${e.offset}) "${e.escaped}") ;; ${e.name} (${e.strLen})`)
  .join('\n');

const wat = `;; Chattree Official Flashcards / Study Tutor Plugin v1.0.0
;; Spaced Repetition (SRS) backed by private isolated SQLite (database.sql) + Minimalist Purple Flutter UI
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  (memory (export "memory") 32)

  (global $state       (mut i32) (i32.const 0))
  (global $act_len     (mut i32) (i32.const 0))
  (global $front_len   (mut i32) (i32.const 0))
  (global $back_len    (mut i32) (i32.const 0))
  (global $deck_len    (mut i32) (i32.const 0))
  (global $target_id   (mut i32) (i32.const 0))
  (global $rating_code (mut i32) (i32.const 2)) ;; 1=hard, 2=good, 3=easy

  (global $card_id     (mut i32) (i32.const 0))
  (global $card_int    (mut i32) (i32.const 0))
  (global $card_ease   (mut i32) (i32.const 250))
  (global $card_reps   (mut i32) (i32.const 0))
  (global $due_cnt     (mut i32) (i32.const 0))
  (global $total_cnt   (mut i32) (i32.const 0))
  (global $mastered    (mut i32) (i32.const 0))

  (global $out_ptr     (mut i32) (i32.const 65536))
  (global $req_ptr     (mut i32) (i32.const 300000))

  ;; ── Static Data Segments ─────────────────────────────────────────────
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

  (func $parse_uint (param $ptr i32) (param $len i32) (result i32)
    (local $i i32) (local $val i32) (local $ch i32) (local $found i32)
    (local.set $i (i32.const 0)) (local.set $val (i32.const 0)) (local.set $found (i32.const 0))
    (loop $l
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 48)) (i32.le_u (local.get $ch) (i32.const 57)))
            (then
              (local.set $val (i32.add (i32.mul (local.get $val) (i32.const 10)) (i32.sub (local.get $ch) (i32.const 48))))
              (local.set $found (i32.const 1))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $l)
            )
            (else
              (if (i32.eqz (local.get $found))
                (then (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $l))
              )
            )
          )
        )
      )
    )
    (if (i32.eqz (local.get $found)) (then (return (i32.const 0))))
    (local.get $val)
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

  ;; ── Output & Request Emitters ────────────────────────────────────────

  (func $emit_reset (global.set $out_ptr (i32.const 65536)))
  (func $emit_byte (param $b i32) (i32.store8 (global.get $out_ptr) (local.get $b)) (global.set $out_ptr (i32.add (global.get $out_ptr) (i32.const 1))))
  (func $emit_zstr (param $z i32) (global.set $out_ptr (call $copy_zstr (local.get $z) (global.get $out_ptr))))
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
    (local.set $v (local.get $n)) (local.set $len (i32.const 0))
    (loop $rev
      (if (i32.gt_u (local.get $v) (i32.const 0))
        (then
          (i32.store8 (i32.add (i32.const 261400) (local.get $len)) (i32.add (i32.const 48) (i32.rem_u (local.get $v) (i32.const 10))))
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
          (call $emit_byte (i32.load8_u (i32.add (i32.const 261400) (local.get $i))))
          (br $wr)
        )
      )
    )
  )

  ;; Emit ratio 0.00..1.00 as JSON decimal (e.g. 0.40 or 1.00)
  (func $emit_ratio (param $num i32) (param $den i32)
    (local $pct i32)
    (if (i32.le_s (local.get $den) (i32.const 0)) (then (call $emit_byte (i32.const 48)) (return)))
    (local.set $pct (i32.div_u (i32.mul (local.get $num) (i32.const 100)) (local.get $den)))
    (if (i32.ge_u (local.get $pct) (i32.const 100))
      (then (call $emit_byte (i32.const 49)) (call $emit_byte (i32.const 46)) (call $emit_byte (i32.const 48)) (return))
    )
    (call $emit_byte (i32.const 48))
    (call $emit_byte (i32.const 46))
    (call $emit_byte (i32.add (i32.const 48) (i32.div_u (local.get $pct) (i32.const 10))))
    (call $emit_byte (i32.add (i32.const 48) (i32.rem_u (local.get $pct) (i32.const 10))))
  )

  ;; Request buffer emitters (300000+)
  (func $req_reset (global.set $req_ptr (i32.const 300000)))
  (func $req_byte (param $b i32) (i32.store8 (global.get $req_ptr) (local.get $b)) (global.set $req_ptr (i32.add (global.get $req_ptr) (i32.const 1))))
  (func $req_zstr (param $z i32) (global.set $req_ptr (call $copy_zstr (local.get $z) (global.get $req_ptr))))
  (func $req_len (result i32) (i32.sub (global.get $req_ptr) (i32.const 300000)))

  (func $req_json_esc (param $ptr i32) (param $len i32)
    (local $i i32) (local $ch i32)
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 34)) (i32.eq (local.get $ch) (i32.const 92)))
            (then (call $req_byte (i32.const 92)) (call $req_byte (local.get $ch)))
            (else
              (if (i32.eq (local.get $ch) (i32.const 10))
                (then (call $req_byte (i32.const 92)) (call $req_byte (i32.const 110)))
                (else (if (i32.ge_u (local.get $ch) (i32.const 32)) (then (call $req_byte (local.get $ch)))))
              )
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
  )

  (func $req_uint (param $n i32)
    (local $len i32) (local $i i32) (local $v i32)
    (if (i32.le_s (local.get $n) (i32.const 0)) (then (call $req_byte (i32.const 48)) (return)))
    (local.set $v (local.get $n)) (local.set $len (i32.const 0))
    (loop $rev
      (if (i32.gt_u (local.get $v) (i32.const 0))
        (then
          (i32.store8 (i32.add (i32.const 261400) (local.get $len)) (i32.add (i32.const 48) (i32.rem_u (local.get $v) (i32.const 10))))
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
          (call $req_byte (i32.load8_u (i32.add (i32.const 261400) (local.get $i))))
          (br $wr)
        )
      )
    )
  )

  ;; ── JSON Extractors ──────────────────────────────────────────────────

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
          (local.set $j (i32.const 0)) (local.set $m (i32.const 1))
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

  (func $extract_json_int (param $json i32) (param $jlen i32) (param $key_z i32) (result i32)
    (local $pos i32) (local $val i32) (local $ch i32) (local $found i32)
    (local.set $pos (call $find_json_val (local.get $json) (local.get $jlen) (local.get $key_z)))
    (if (i32.or (i32.lt_s (local.get $pos) (i32.const 0)) (i32.ge_u (local.get $pos) (local.get $jlen))) (then (return (i32.const -1))))
    ;; Allow quoted integer like "42"
    (if (i32.eq (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 34))
      (then (local.set $pos (i32.add (local.get $pos) (i32.const 1))))
    )
    (local.set $val (i32.const 0)) (local.set $found (i32.const 0))
    (loop $p
      (if (i32.lt_u (local.get $pos) (local.get $jlen))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 48)) (i32.le_u (local.get $ch) (i32.const 57)))
            (then
              (local.set $val (i32.add (i32.mul (local.get $val) (i32.const 10)) (i32.sub (local.get $ch) (i32.const 48))))
              (local.set $found (i32.const 1))
              (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
              (br $p)
            )
          )
        )
      )
    )
    (if (i32.eqz (local.get $found)) (then (return (i32.const -1))))
    (local.get $val)
  )

  ;; ── Minimalist Purple Flutter UI Renderers ───────────────────────────

  (func $render_simple (param $t i32) (param $sub i32) (param $b i32) (param $bc i32) (param $pill i32) (param $body i32) (param $btns i32) (result i32)
    (call $emit_reset)
    (call $emit_zstr (i32.const ${S.ui_start.offset})) (call $emit_zstr (local.get $t))
    (call $emit_zstr (i32.const ${S.ui_mid1.offset})) (call $emit_zstr (local.get $t))
    (call $emit_zstr (i32.const ${S.ui_sub.offset})) (call $emit_zstr (local.get $sub))
    (call $emit_zstr (i32.const ${S.ui_badge.offset})) (call $emit_zstr (local.get $b))
    (call $emit_zstr (local.get $bc))
    (if (i32.gt_s (local.get $pill) (i32.const 0))
      (then (call $emit_zstr (local.get $pill)) (call $emit_byte (i32.const 44)))
    )
    (call $emit_zstr (i32.const ${S.el_text_1.offset})) (call $emit_zstr (local.get $body)) (call $emit_zstr (i32.const ${S.el_text_e.offset}))
    (call $emit_byte (i32.const 44)) (call $emit_zstr (local.get $btns))
    (call $emit_zstr (i32.const ${S.ui_end.offset}))
    (call $emit_len)
  )

  ;; Question card: ultra-minimalist focus view
  (func $render_question (result i32)
    (call $emit_reset)
    (call $emit_zstr (i32.const ${S.ui_start.offset})) (call $emit_zstr (i32.const ${S.t_app.offset}))
    (call $emit_zstr (i32.const ${S.ui_mid1.offset}))
    (if (i32.gt_s (global.get $deck_len) (i32.const 0))
      (then (call $emit_json_esc (i32.const 261100) (global.get $deck_len)))
      (else (call $emit_zstr (i32.const ${S.t_app.offset})))
    )
    (call $emit_zstr (i32.const ${S.ui_sub.offset}))
    (call $emit_uint (global.get $due_cnt))
    (call $emit_zstr (i32.const ${S.t_due_suf.offset}))
    (call $emit_zstr (i32.const ${S.ui_badge.offset})) (call $emit_zstr (i32.const ${S.t_study_badge.offset}))
    (call $emit_zstr (i32.const ${S.ui_bc_note.offset}))
    (call $emit_zstr (i32.const ${S.el_pill_q.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_text_1.offset}))
    (call $emit_json_esc (i32.const 260100) (global.get $front_len))
    (call $emit_zstr (i32.const ${S.el_text_e.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_div.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.btn_study_p1.offset})) (call $emit_uint (global.get $card_id))
    (call $emit_zstr (i32.const ${S.btn_study_p2.offset})) (call $emit_uint (global.get $card_id))
    (call $emit_zstr (i32.const ${S.btn_study_p3.offset}))
    (call $emit_zstr (i32.const ${S.ui_end.offset}))
    (call $emit_len)
  )

  ;; Answer + 3-tier SRS rating card
  (func $render_answer (result i32)
    (local $lv i32)
    (local.set $lv (global.get $card_reps))
    (if (i32.gt_u (local.get $lv) (i32.const 5)) (then (local.set $lv (i32.const 5))))
    (call $emit_reset)
    (call $emit_zstr (i32.const ${S.ui_start.offset})) (call $emit_zstr (i32.const ${S.t_app.offset}))
    (call $emit_zstr (i32.const ${S.ui_mid1.offset}))
    (if (i32.gt_s (global.get $deck_len) (i32.const 0))
      (then (call $emit_json_esc (i32.const 261100) (global.get $deck_len)))
      (else (call $emit_zstr (i32.const ${S.t_app.offset})))
    )
    (call $emit_zstr (i32.const ${S.ui_sub.offset})) (call $emit_zstr (i32.const ${S.t_ans_sub.offset}))
    (call $emit_zstr (i32.const ${S.ui_badge.offset})) (call $emit_zstr (i32.const ${S.t_ans_badge.offset}))
    (call $emit_zstr (i32.const ${S.ui_bc_note.offset}))
    ;; Question
    (call $emit_zstr (i32.const ${S.el_text_1.offset}))
    (call $emit_json_esc (i32.const 260100) (global.get $front_len))
    (call $emit_zstr (i32.const ${S.el_text_e.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_div.offset})) (call $emit_byte (i32.const 44))
    ;; Answer pill + Answer text
    (call $emit_zstr (i32.const ${S.el_pill_a.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_text_1.offset}))
    (call $emit_json_esc (i32.const 260600) (global.get $back_len))
    (call $emit_zstr (i32.const ${S.el_text_e.offset})) (call $emit_byte (i32.const 44))
    ;; Mastery progress bar
    (call $emit_zstr (i32.const ${S.el_prog_1.offset}))
    (call $emit_ratio (local.get $lv) (i32.const 5))
    (call $emit_zstr (i32.const ${S.el_prog_2.offset}))
    (call $emit_zstr (i32.const ${S.t_mastery_p.offset})) (call $emit_uint (local.get $lv)) (call $emit_zstr (i32.const ${S.t_mastery_s.offset}))
    (call $emit_zstr (i32.const ${S.el_prog_e.offset})) (call $emit_byte (i32.const 44))
    ;; Hard / Good / Easy buttons
    (call $emit_zstr (i32.const ${S.btn_rate_p1.offset})) (call $emit_uint (global.get $card_id))
    (call $emit_zstr (i32.const ${S.btn_rate_p2.offset})) (call $emit_uint (global.get $card_id))
    (call $emit_zstr (i32.const ${S.btn_rate_p3.offset})) (call $emit_uint (global.get $card_id))
    (call $emit_zstr (i32.const ${S.btn_rate_p4.offset}))
    (call $emit_zstr (i32.const ${S.ui_end.offset}))
    (call $emit_len)
  )

  (func $render_done (result i32)
    (call $emit_reset)
    (call $emit_zstr (i32.const ${S.ui_start.offset})) (call $emit_zstr (i32.const ${S.t_done_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_mid1.offset})) (call $emit_zstr (i32.const ${S.t_done_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_sub.offset})) (call $emit_zstr (i32.const ${S.t_done_sub.offset}))
    (call $emit_zstr (i32.const ${S.ui_badge.offset})) (call $emit_zstr (i32.const ${S.t_done_badge.offset}))
    (call $emit_zstr (i32.const ${S.ui_bc_check.offset}))
    (call $emit_zstr (i32.const ${S.el_pill_done.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_prog_1.offset})) (call $emit_byte (i32.const 49)) (call $emit_byte (i32.const 46)) (call $emit_byte (i32.const 48))
    (call $emit_zstr (i32.const ${S.el_prog_2.offset})) (call $emit_zstr (i32.const ${S.t_done_prog.offset})) (call $emit_zstr (i32.const ${S.el_prog_e.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_text_1.offset})) (call $emit_zstr (i32.const ${S.t_done_body.offset})) (call $emit_zstr (i32.const ${S.el_text_e.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.btn_done.offset}))
    (call $emit_zstr (i32.const ${S.ui_end.offset}))
    (call $emit_len)
  )

  (func $render_saved (result i32)
    (call $emit_reset)
    (call $emit_zstr (i32.const ${S.ui_start.offset})) (call $emit_zstr (i32.const ${S.t_saved_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_mid1.offset})) (call $emit_zstr (i32.const ${S.t_saved_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_sub.offset})) (call $emit_zstr (i32.const ${S.t_saved_sub.offset}))
    (call $emit_zstr (i32.const ${S.ui_badge.offset})) (call $emit_zstr (i32.const ${S.t_saved_badge.offset}))
    (call $emit_zstr (i32.const ${S.ui_bc_check.offset}))
    (call $emit_zstr (i32.const ${S.el_pill_saved.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_text_1.offset}))
    (call $emit_zstr (i32.const ${S.t_q_pfx.offset})) (call $emit_json_esc (i32.const 260100) (global.get $front_len))
    (call $emit_zstr (i32.const ${S.t_a_pfx.offset})) (call $emit_json_esc (i32.const 260600) (global.get $back_len))
    (call $emit_zstr (i32.const ${S.el_text_e.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.btn_home.offset}))
    (call $emit_zstr (i32.const ${S.ui_end.offset}))
    (call $emit_len)
  )

  (func $render_stats (result i32)
    (call $emit_reset)
    (call $emit_zstr (i32.const ${S.ui_start.offset})) (call $emit_zstr (i32.const ${S.t_stats_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_mid1.offset})) (call $emit_zstr (i32.const ${S.t_stats_title.offset}))
    (call $emit_zstr (i32.const ${S.ui_sub.offset})) (call $emit_zstr (i32.const ${S.t_stats_sub.offset}))
    (call $emit_zstr (i32.const ${S.ui_badge.offset})) (call $emit_zstr (i32.const ${S.t_stats_badge.offset}))
    (call $emit_zstr (i32.const ${S.ui_bc_stats.offset}))
    (call $emit_zstr (i32.const ${S.el_pill_stats.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_prog_1.offset}))
    (call $emit_ratio (global.get $mastered) (global.get $total_cnt))
    (call $emit_zstr (i32.const ${S.el_prog_2.offset}))
    (call $emit_uint (global.get $mastered)) (call $emit_zstr (i32.const ${S.t_of.offset})) (call $emit_uint (global.get $total_cnt)) (call $emit_zstr (i32.const ${S.t_mastered_suf.offset}))
    (call $emit_zstr (i32.const ${S.el_prog_e.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.el_text_1.offset}))
    (call $emit_zstr (i32.const ${S.t_due_lbl.offset})) (call $emit_uint (global.get $due_cnt))
    (call $emit_zstr (i32.const ${S.t_tot_lbl.offset})) (call $emit_uint (global.get $total_cnt))
    (call $emit_zstr (i32.const ${S.el_text_e.offset})) (call $emit_byte (i32.const 44))
    (call $emit_zstr (i32.const ${S.btn_home.offset}))
    (call $emit_zstr (i32.const ${S.ui_end.offset}))
    (call $emit_len)
  )

  ;; ── SQL Dispatchers ──────────────────────────────────────────────────

  (func $dispatch_next_due (result i32)
    (global.set $state (i32.const 3))
    (drop (call $host_call (i32.const ${S.sql_next_due.offset}) (i32.const ${S.sql_next_due.len}) (i32.const 350000) (i32.const 80000)))
    (i32.const 0)
  )

  (func $dispatch_after_init (result i32)
    ;; add / create / new
    (if (i32.or (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_add.offset}))
                (i32.or (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_create.offset}))
                        (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_new.offset}))))
      (then
        (if (i32.or (i32.le_s (global.get $front_len) (i32.const 0)) (i32.le_s (global.get $back_len) (i32.const 0)))
          (then
            (return (call $render_simple
              (i32.const ${S.t_err_add_title.offset}) (i32.const ${S.t_err_add_sub.offset})
              (i32.const ${S.t_err_add_badge.offset}) (i32.const ${S.ui_bc_warn.offset})
              (i32.const 0) (i32.const ${S.t_err_add_body.offset}) (i32.const ${S.btn_empty.offset})
            ))
          )
        )
        (call $req_reset)
        (call $req_zstr (i32.const ${S.sql_add_p1.offset}))
        (call $req_json_esc (i32.const 261100) (global.get $deck_len))
        (call $req_zstr (i32.const ${S.sql_arg_sep.offset}))
        (call $req_json_esc (i32.const 260100) (global.get $front_len))
        (call $req_zstr (i32.const ${S.sql_arg_sep.offset}))
        (call $req_json_esc (i32.const 260600) (global.get $back_len))
        (call $req_zstr (i32.const ${S.sql_arg_end.offset}))
        (global.set $state (i32.const 2))
        (drop (call $host_call (i32.const 300000) (call $req_len) (i32.const 350000) (i32.const 8000)))
        (return (i32.const 0))
      )
    )

    ;; reveal / show
    (if (i32.or (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_reveal.offset}))
                (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_show.offset})))
      (then
        (if (i32.gt_s (global.get $target_id) (i32.const 0))
          (then
            (call $req_reset)
            (call $req_zstr (i32.const ${S.sql_get_p1.offset}))
            (call $req_uint (global.get $target_id))
            (call $req_zstr (i32.const ${S.sql_num_end.offset}))
            (global.set $state (i32.const 4))
            (drop (call $host_call (i32.const 300000) (call $req_len) (i32.const 350000) (i32.const 80000)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; rate
    (if (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_rate.offset}))
      (then
        (if (i32.gt_s (global.get $target_id) (i32.const 0))
          (then
            (call $req_reset)
            (call $req_zstr (i32.const ${S.sql_get_p1.offset}))
            (call $req_uint (global.get $target_id))
            (call $req_zstr (i32.const ${S.sql_num_end.offset}))
            (global.set $state (i32.const 5))
            (drop (call $host_call (i32.const 300000) (call $req_len) (i32.const 350000) (i32.const 80000)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; skip
    (if (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_skip.offset}))
      (then
        (if (i32.gt_s (global.get $target_id) (i32.const 0))
          (then
            (call $req_reset)
            (call $req_zstr (i32.const ${S.sql_next_skip_p1.offset}))
            (call $req_uint (global.get $target_id))
            (call $req_zstr (i32.const ${S.sql_num_end.offset}))
            (global.set $state (i32.const 3))
            (drop (call $host_call (i32.const 300000) (call $req_len) (i32.const 350000) (i32.const 80000)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; practice
    (if (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_practice.offset}))
      (then
        (global.set $state (i32.const 3))
        (drop (call $host_call (i32.const ${S.sql_next_practice.offset}) (i32.const ${S.sql_next_practice.len}) (i32.const 350000) (i32.const 80000)))
        (return (i32.const 0))
      )
    )

    ;; list
    (if (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_list.offset}))
      (then
        (global.set $state (i32.const 7))
        (drop (call $host_call (i32.const ${S.sql_list.offset}) (i32.const ${S.sql_list.len}) (i32.const 350000) (i32.const 80000)))
        (return (i32.const 0))
      )
    )

    ;; stats
    (if (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_stats.offset}))
      (then
        (global.set $state (i32.const 8))
        (drop (call $host_call (i32.const ${S.sql_stats.offset}) (i32.const ${S.sql_stats.len}) (i32.const 350000) (i32.const 80000)))
        (return (i32.const 0))
      )
    )

    ;; delete / remove
    (if (i32.or (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_delete.offset}))
                (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_remove.offset})))
      (then
        (if (i32.gt_s (global.get $target_id) (i32.const 0))
          (then
            (call $req_reset)
            (call $req_zstr (i32.const ${S.sql_del_p1.offset}))
            (call $req_uint (global.get $target_id))
            (call $req_zstr (i32.const ${S.sql_num_end.offset}))
            (global.set $state (i32.const 9))
            (drop (call $host_call (i32.const 300000) (call $req_len) (i32.const 350000) (i32.const 8000)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; Default: study next due card
    (call $dispatch_next_due)
  )

  ;; Helper: parse rating word at ptr..len into 1 (hard), 2 (good), 3 (easy)
  (func $parse_rating (param $ptr i32) (param $len i32) (result i32)
    (local $clen i32)
    (local.set $clen (if (result i32) (i32.gt_u (local.get $len) (i32.const 30)) (then (i32.const 30)) (else (local.get $len))))
    (call $to_lower (local.get $ptr) (i32.const 261200) (local.get $clen))
    (if (i32.or (call $starts_with_z (i32.const 261200) (local.get $clen) (i32.const ${S.r_hard.offset}))
                (call $starts_with_z (i32.const 261200) (local.get $clen) (i32.const ${S.r_dificil.offset})))
      (then (return (i32.const 1)))
    )
    (if (i32.or (call $starts_with_z (i32.const 261200) (local.get $clen) (i32.const ${S.r_easy.offset}))
                (call $starts_with_z (i32.const 261200) (local.get $clen) (i32.const ${S.r_facil.offset})))
      (then (return (i32.const 3)))
    )
    (i32.const 2)
  )

  ;; ── Main Entrypoint ──────────────────────────────────────────────────

  (func (export "flashcards_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $ts i32) (local $tl i32) (local $vlen i32) (local $v i32)
    (local $arg_p i32) (local $arg_l i32) (local $i i32) (local $pipe i32) (local $sp i32)

    ;; Reset state
    (global.set $state (i32.const 0))
    (global.set $act_len (i32.const 0))
    (global.set $front_len (i32.const 0))
    (global.set $back_len (i32.const 0))
    (drop (call $copy_zstr (i32.const ${S.def_deck.offset}) (i32.const 261100)))
    (global.set $deck_len (i32.const ${S.def_deck.len}))
    (global.set $target_id (i32.const 0))
    (global.set $rating_code (i32.const 2))
    (global.set $card_id (i32.const 0))
    (global.set $due_cnt (i32.const 0))
    (global.set $total_cnt (i32.const 0))
    (global.set $mastered (i32.const 0))

    ;; Trim whitespace
    (local.set $ts (local.get $in_ptr)) (local.set $tl (local.get $in_len))
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

    ;; Parse JSON envelope or plain text slash command
    (if (i32.and (i32.gt_u (local.get $tl) (i32.const 0)) (i32.eq (i32.load8_u (local.get $ts)) (i32.const 123)))
      (then
        (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_op.offset}) (i32.const 260000) (i32.const 60)))
        (if (i32.le_s (local.get $vlen) (i32.const 0))
          (then (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_action.offset}) (i32.const 260000) (i32.const 60))))
        )
        (if (i32.gt_s (local.get $vlen) (i32.const 0))
          (then (call $to_lower (i32.const 260000) (i32.const 260000) (local.get $vlen)) (global.set $act_len (local.get $vlen)))
        )

        (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_front.offset}) (i32.const 260100) (i32.const 460)))
        (if (i32.le_s (local.get $vlen) (i32.const 0))
          (then (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_question.offset}) (i32.const 260100) (i32.const 460))))
        )
        (if (i32.gt_s (local.get $vlen) (i32.const 0)) (then (global.set $front_len (local.get $vlen))))

        (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_back.offset}) (i32.const 260600) (i32.const 460)))
        (if (i32.le_s (local.get $vlen) (i32.const 0))
          (then (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_answer.offset}) (i32.const 260600) (i32.const 460))))
        )
        (if (i32.gt_s (local.get $vlen) (i32.const 0)) (then (global.set $back_len (local.get $vlen))))

        (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_deck.offset}) (i32.const 261100) (i32.const 72)))
        (if (i32.gt_s (local.get $vlen) (i32.const 0)) (then (global.set $deck_len (local.get $vlen))))

        (local.set $v (call $extract_json_int (local.get $ts) (local.get $tl) (i32.const ${S.k_id.offset})))
        (if (i32.gt_s (local.get $v) (i32.const 0)) (then (global.set $target_id (local.get $v))))

        (local.set $vlen (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_rating.offset}) (i32.const 261200) (i32.const 30)))
        (if (i32.gt_s (local.get $vlen) (i32.const 0)) (then (global.set $rating_code (call $parse_rating (i32.const 261200) (local.get $vlen)))))
      )
      (else
        (local.set $tl (call $strip_lang (local.get $ts) (local.get $tl)))
        (if (i32.gt_s (local.get $tl) (i32.const 0))
          (then
            (call $to_lower (local.get $ts) (i32.const 261300) (if (result i32) (i32.gt_u (local.get $tl) (i32.const 80)) (then (i32.const 80)) (else (local.get $tl))))
            (local.set $arg_p (i32.const 0)) (local.set $arg_l (i32.const 0))

            (if (call $match_cmd (i32.const 261300) (local.get $tl) (i32.const ${S.a_help.offset}))
              (then (drop (call $copy_zstr (i32.const ${S.a_help.offset}) (i32.const 260000))) (global.set $act_len (i32.const ${S.a_help.len})))
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 261300) (local.get $tl) (i32.const ${S.a_stats.offset})))
              (then (drop (call $copy_zstr (i32.const ${S.a_stats.offset}) (i32.const 260000))) (global.set $act_len (i32.const ${S.a_stats.len})))
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 261300) (local.get $tl) (i32.const ${S.a_list.offset})))
              (then (drop (call $copy_zstr (i32.const ${S.a_list.offset}) (i32.const 260000))) (global.set $act_len (i32.const ${S.a_list.len})))
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 261300) (local.get $tl) (i32.const ${S.a_practice.offset})))
              (then (drop (call $copy_zstr (i32.const ${S.a_practice.offset}) (i32.const 260000))) (global.set $act_len (i32.const ${S.a_practice.len})))
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 261300) (local.get $tl) (i32.const ${S.a_reveal.offset})))
              (then
                (drop (call $copy_zstr (i32.const ${S.a_reveal.offset}) (i32.const 260000))) (global.set $act_len (i32.const ${S.a_reveal.len}))
                (global.set $target_id (call $parse_uint (i32.add (local.get $ts) (i32.const 6)) (i32.sub (local.get $tl) (i32.const 6))))
              )
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 261300) (local.get $tl) (i32.const ${S.a_skip.offset})))
              (then
                (drop (call $copy_zstr (i32.const ${S.a_skip.offset}) (i32.const 260000))) (global.set $act_len (i32.const ${S.a_skip.len}))
                (global.set $target_id (call $parse_uint (i32.add (local.get $ts) (i32.const 4)) (i32.sub (local.get $tl) (i32.const 4))))
              )
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 261300) (local.get $tl) (i32.const ${S.a_delete.offset})))
              (then
                (drop (call $copy_zstr (i32.const ${S.a_delete.offset}) (i32.const 260000))) (global.set $act_len (i32.const ${S.a_delete.len}))
                (global.set $target_id (call $parse_uint (i32.add (local.get $ts) (i32.const 6)) (i32.sub (local.get $tl) (i32.const 6))))
              )
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 261300) (local.get $tl) (i32.const ${S.a_rate.offset})))
              (then
                (drop (call $copy_zstr (i32.const ${S.a_rate.offset}) (i32.const 260000))) (global.set $act_len (i32.const ${S.a_rate.len}))
                (local.set $arg_p (i32.add (local.get $ts) (i32.const 4))) (local.set $arg_l (i32.sub (local.get $tl) (i32.const 4)))
                (global.set $target_id (call $parse_uint (local.get $arg_p) (local.get $arg_l)))
                ;; Find space after id to parse rating word
                (loop $sk1
                  (if (i32.and (i32.gt_s (local.get $arg_l) (i32.const 0)) (call $is_ws (i32.load8_u (local.get $arg_p))))
                    (then (local.set $arg_p (i32.add (local.get $arg_p) (i32.const 1))) (local.set $arg_l (i32.sub (local.get $arg_l) (i32.const 1))) (br $sk1))
                  )
                )
                (loop $sk2
                  (if (i32.and (i32.gt_s (local.get $arg_l) (i32.const 0)) (i32.eqz (call $is_ws (i32.load8_u (local.get $arg_p)))))
                    (then (local.set $arg_p (i32.add (local.get $arg_p) (i32.const 1))) (local.set $arg_l (i32.sub (local.get $arg_l) (i32.const 1))) (br $sk2))
                  )
                )
                (loop $sk3
                  (if (i32.and (i32.gt_s (local.get $arg_l) (i32.const 0)) (call $is_ws (i32.load8_u (local.get $arg_p))))
                    (then (local.set $arg_p (i32.add (local.get $arg_p) (i32.const 1))) (local.set $arg_l (i32.sub (local.get $arg_l) (i32.const 1))) (br $sk3))
                  )
                )
                (if (i32.gt_s (local.get $arg_l) (i32.const 0))
                  (then (global.set $rating_code (call $parse_rating (local.get $arg_p) (local.get $arg_l))))
                )
              )
            )
            (if (i32.and (i32.eqz (global.get $act_len)) (call $match_cmd (i32.const 261300) (local.get $tl) (i32.const ${S.a_add.offset})))
              (then
                (drop (call $copy_zstr (i32.const ${S.a_add.offset}) (i32.const 260000))) (global.set $act_len (i32.const ${S.a_add.len}))
                (local.set $arg_p (i32.add (local.get $ts) (i32.const 3))) (local.set $arg_l (i32.sub (local.get $tl) (i32.const 3)))
                ;; Find '|' (124) separating front and back
                (local.set $pipe (i32.const -1)) (local.set $i (i32.const 0))
                (loop $fp
                  (if (i32.lt_s (local.get $i) (local.get $arg_l))
                    (then
                      (if (i32.eq (i32.load8_u (i32.add (local.get $arg_p) (local.get $i))) (i32.const 124))
                        (then (local.set $pipe (local.get $i)))
                        (else (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $fp))
                      )
                    )
                  )
                )
                (if (i32.gt_s (local.get $pipe) (i32.const 0))
                  (then
                    ;; Trim front [arg_p .. arg_p+pipe)
                    (local.set $sp (local.get $arg_p)) (local.set $vlen (local.get $pipe))
                    (loop $fl
                      (if (i32.and (i32.gt_s (local.get $vlen) (i32.const 0)) (call $is_ws (i32.load8_u (local.get $sp))))
                        (then (local.set $sp (i32.add (local.get $sp) (i32.const 1))) (local.set $vlen (i32.sub (local.get $vlen) (i32.const 1))) (br $fl))
                      )
                    )
                    (loop $fr
                      (if (i32.and (i32.gt_s (local.get $vlen) (i32.const 0)) (call $is_ws (i32.load8_u (i32.add (local.get $sp) (i32.sub (local.get $vlen) (i32.const 1))))))
                        (then (local.set $vlen (i32.sub (local.get $vlen) (i32.const 1))) (br $fr))
                      )
                    )
                    (if (i32.gt_s (local.get $vlen) (i32.const 460)) (then (local.set $vlen (i32.const 460))))
                    (drop (call $copy_mem (local.get $sp) (i32.const 260100) (local.get $vlen)))
                    (global.set $front_len (local.get $vlen))

                    ;; Trim back [arg_p+pipe+1 .. arg_p+arg_l)
                    (local.set $sp (i32.add (local.get $arg_p) (i32.add (local.get $pipe) (i32.const 1))))
                    (local.set $vlen (i32.sub (local.get $arg_l) (i32.add (local.get $pipe) (i32.const 1))))
                    (loop $bl
                      (if (i32.and (i32.gt_s (local.get $vlen) (i32.const 0)) (call $is_ws (i32.load8_u (local.get $sp))))
                        (then (local.set $sp (i32.add (local.get $sp) (i32.const 1))) (local.set $vlen (i32.sub (local.get $vlen) (i32.const 1))) (br $bl))
                      )
                    )
                    (loop $br2
                      (if (i32.and (i32.gt_s (local.get $vlen) (i32.const 0)) (call $is_ws (i32.load8_u (i32.add (local.get $sp) (i32.sub (local.get $vlen) (i32.const 1))))))
                        (then (local.set $vlen (i32.sub (local.get $vlen) (i32.const 1))) (br $br2))
                      )
                    )
                    (if (i32.gt_s (local.get $vlen) (i32.const 460)) (then (local.set $vlen (i32.const 460))))
                    (drop (call $copy_mem (local.get $sp) (i32.const 260600) (local.get $vlen)))
                    (global.set $back_len (local.get $vlen))
                  )
                )
              )
            )
          )
        )
      )
    )

    ;; Help runs synchronously without touching SQLite
    (if (call $str_eq_z (i32.const 260000) (global.get $act_len) (i32.const ${S.a_help.offset}))
      (then
        (return (call $render_simple
          (i32.const ${S.t_help_title.offset}) (i32.const ${S.t_help_sub.offset})
          (i32.const ${S.t_help_badge.offset}) (i32.const ${S.ui_bc_note.offset})
          (i32.const 0) (i32.const ${S.t_help_body.offset}) (i32.const ${S.btn_home.offset})
        ))
      )
    )

    ;; Step 1: Ensure flashcards SQLite table exists
    (global.set $state (i32.const 1))
    (drop (call $host_call (i32.const ${S.sql_init.offset}) (i32.const ${S.sql_init.len}) (i32.const 350000) (i32.const 4096)))
    (i32.const 0)
  )

  ;; ── Async Resume Handler ─────────────────────────────────────────────

  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $v i32) (local $nlen i32) (local $new_int i32) (local $new_ease i32) (local $new_reps i32)
    (local $off i32) (local $rel i32) (local $cnt i32) (local $idv i32) (local $repv i32) (local $intv i32) (local $fl i32) (local $dl i32)

    ;; State 1: table created -> dispatch requested action
    (if (i32.eq (global.get $state) (i32.const 1))
      (then (return (call $dispatch_after_init)))
    )

    ;; State 2: INSERT done -> render saved card
    (if (i32.eq (global.get $state) (i32.const 2))
      (then (return (call $render_saved)))
    )

    ;; State 3: SELECT next card -> render question or check total count
    (if (i32.eq (global.get $state) (i32.const 3))
      (then
        (local.set $v (call $extract_json_int (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_id.offset})))
        (if (i32.gt_s (local.get $v) (i32.const 0))
          (then
            (global.set $card_id (local.get $v))
            (local.set $nlen (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_deck.offset}) (i32.const 261100) (i32.const 72)))
            (if (i32.gt_s (local.get $nlen) (i32.const 0)) (then (global.set $deck_len (local.get $nlen))))
            (local.set $nlen (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_front.offset}) (i32.const 260100) (i32.const 460)))
            (if (i32.gt_s (local.get $nlen) (i32.const 0)) (then (global.set $front_len (local.get $nlen))))
            (local.set $v (call $extract_json_int (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_due_cnt.offset})))
            (global.set $due_cnt (if (result i32) (i32.gt_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 1))))
            (return (call $render_question))
          )
        )
        ;; No card returned -> check total card count to distinguish Empty vs All Caught Up
        (global.set $state (i32.const 31))
        (drop (call $host_call (i32.const ${S.sql_count_all.offset}) (i32.const ${S.sql_count_all.len}) (i32.const 350000) (i32.const 4096)))
        (return (i32.const 0))
      )
    )

    ;; State 31: COUNT(*) -> render Done (if total > 0) or Empty Deck (if total == 0)
    (if (i32.eq (global.get $state) (i32.const 31))
      (then
        (local.set $v (call $extract_json_int (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_total_cnt.offset})))
        (if (i32.gt_s (local.get $v) (i32.const 0)) (then (return (call $render_done))))
        (return (call $render_simple
          (i32.const ${S.t_app.offset}) (i32.const ${S.t_empty_sub.offset})
          (i32.const ${S.t_empty_badge.offset}) (i32.const ${S.ui_bc_note.offset})
          (i32.const ${S.el_pill_start.offset}) (i32.const ${S.t_empty_body.offset}) (i32.const ${S.btn_empty.offset})
        ))
      )
    )

    ;; State 4: SELECT card for reveal -> render Answer + Hard/Good/Easy
    (if (i32.eq (global.get $state) (i32.const 4))
      (then
        (local.set $v (call $extract_json_int (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_id.offset})))
        (if (i32.gt_s (local.get $v) (i32.const 0))
          (then
            (global.set $card_id (local.get $v))
            (local.set $nlen (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_deck.offset}) (i32.const 261100) (i32.const 72)))
            (if (i32.gt_s (local.get $nlen) (i32.const 0)) (then (global.set $deck_len (local.get $nlen))))
            (local.set $nlen (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_front.offset}) (i32.const 260100) (i32.const 460)))
            (if (i32.gt_s (local.get $nlen) (i32.const 0)) (then (global.set $front_len (local.get $nlen))))
            (local.set $nlen (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_back.offset}) (i32.const 260600) (i32.const 460)))
            (if (i32.gt_s (local.get $nlen) (i32.const 0)) (then (global.set $back_len (local.get $nlen))))
            (local.set $v (call $extract_json_int (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_reps.offset})))
            (global.set $card_reps (if (result i32) (i32.ge_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 0))))
            (return (call $render_answer))
          )
        )
        (return (call $dispatch_next_due))
      )
    )

    ;; State 5: SELECT card for SRS rate -> compute SM-2 interval -> UPDATE
    (if (i32.eq (global.get $state) (i32.const 5))
      (then
        (local.set $v (call $extract_json_int (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_interval.offset})))
        (global.set $card_int (if (result i32) (i32.ge_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 0))))
        (local.set $v (call $extract_json_int (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_ease.offset})))
        (global.set $card_ease (if (result i32) (i32.gt_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 250))))
        (local.set $v (call $extract_json_int (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_reps.offset})))
        (global.set $card_reps (if (result i32) (i32.ge_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 0))))

        ;; SM-2 SRS calculation
        (if (i32.eq (global.get $rating_code) (i32.const 1))
          (then
            ;; Hard: reset reps to 0, interval = 1 day, ease = max(130, ease - 20)
            (local.set $new_reps (i32.const 0))
            (local.set $new_int (i32.const 1))
            (local.set $new_ease (i32.sub (global.get $card_ease) (i32.const 20)))
            (if (i32.lt_s (local.get $new_ease) (i32.const 130)) (then (local.set $new_ease (i32.const 130))))
          )
          (else
            (local.set $new_reps (i32.add (global.get $card_reps) (i32.const 1)))
            (if (i32.eq (global.get $rating_code) (i32.const 3))
              (then
                ;; Easy: ease = min(350, ease + 15), jump interval
                (local.set $new_ease (i32.add (global.get $card_ease) (i32.const 15)))
                (if (i32.gt_s (local.get $new_ease) (i32.const 350)) (then (local.set $new_ease (i32.const 350))))
                (if (i32.le_s (global.get $card_int) (i32.const 0))
                  (then (local.set $new_int (i32.const 4)))
                  (else (local.set $new_int (i32.div_u (i32.mul (i32.mul (global.get $card_int) (local.get $new_ease)) (i32.const 13)) (i32.const 1000))))
                )
                (if (i32.lt_s (local.get $new_int) (i32.const 4)) (then (local.set $new_int (i32.const 4))))
              )
              (else
                ;; Good: keep ease, 1d -> 3d -> interval * ease / 100
                (local.set $new_ease (global.get $card_ease))
                (if (i32.eq (local.get $new_reps) (i32.const 1))
                  (then (local.set $new_int (i32.const 1)))
                  (else
                    (if (i32.eq (local.get $new_reps) (i32.const 2))
                      (then (local.set $new_int (i32.const 3)))
                      (else (local.set $new_int (i32.div_u (i32.mul (global.get $card_int) (local.get $new_ease)) (i32.const 100))))
                    )
                  )
                )
                (if (i32.lt_s (local.get $new_int) (i32.const 1)) (then (local.set $new_int (i32.const 1))))
              )
            )
          )
        )

        (call $req_reset)
        (call $req_zstr (i32.const ${S.sql_upd_p1.offset}))
        (call $req_uint (local.get $new_int)) (call $req_byte (i32.const 44))
        (call $req_uint (local.get $new_ease)) (call $req_byte (i32.const 44))
        (call $req_uint (local.get $new_reps)) (call $req_byte (i32.const 44))
        (call $req_uint (i32.mul (local.get $new_int) (i32.const 86400))) (call $req_byte (i32.const 44))
        (call $req_uint (global.get $target_id))
        (call $req_zstr (i32.const ${S.sql_num_end.offset}))
        (global.set $state (i32.const 6))
        (drop (call $host_call (i32.const 300000) (call $req_len) (i32.const 350000) (i32.const 4096)))
        (return (i32.const 0))
      )
    )

    ;; State 6: UPDATE done -> seamlessly advance to next due card
    (if (i32.eq (global.get $state) (i32.const 6))
      (then (return (call $dispatch_next_due)))
    )

    ;; State 7: SELECT list -> render deck list
    (if (i32.eq (global.get $state) (i32.const 7))
      (then
        (call $emit_reset)
        (call $emit_zstr (i32.const ${S.ui_start.offset})) (call $emit_zstr (i32.const ${S.t_list_title.offset}))
        (call $emit_zstr (i32.const ${S.ui_mid1.offset})) (call $emit_zstr (i32.const ${S.t_list_title.offset}))
        (call $emit_zstr (i32.const ${S.ui_sub.offset})) (call $emit_zstr (i32.const ${S.t_list_sub.offset}))
        (call $emit_zstr (i32.const ${S.ui_badge.offset})) (call $emit_zstr (i32.const ${S.t_list_badge.offset}))
        (call $emit_zstr (i32.const ${S.ui_bc_note.offset}))
        (call $emit_zstr (i32.const ${S.el_list_s.offset}))

        (local.set $off (i32.const 0)) (local.set $cnt (i32.const 0))
        (loop $rows_l
          (if (i32.and (i32.lt_u (local.get $off) (local.get $res_len)) (i32.lt_u (local.get $cnt) (i32.const 10)))
            (then
              (local.set $rel (call $find_json_val (i32.add (local.get $res_ptr) (local.get $off)) (i32.sub (local.get $res_len) (local.get $off)) (i32.const ${S.k_front.offset})))
              (if (i32.ge_s (local.get $rel) (i32.const 0))
                (then
                  (local.set $idv (call $extract_json_int (i32.add (local.get $res_ptr) (local.get $off)) (i32.sub (local.get $res_len) (local.get $off)) (i32.const ${S.k_id.offset})))
                  (local.set $dl (call $extract_json_str (i32.add (local.get $res_ptr) (local.get $off)) (i32.sub (local.get $res_len) (local.get $off)) (i32.const ${S.k_deck.offset}) (i32.const 261100) (i32.const 40)))
                  (local.set $fl (call $extract_json_str (i32.add (local.get $res_ptr) (local.get $off)) (i32.sub (local.get $res_len) (local.get $off)) (i32.const ${S.k_front.offset}) (i32.const 260100) (i32.const 90)))
                  (local.set $intv (call $extract_json_int (i32.add (local.get $res_ptr) (local.get $off)) (i32.sub (local.get $res_len) (local.get $off)) (i32.const ${S.k_interval.offset})))
                  (local.set $repv (call $extract_json_int (i32.add (local.get $res_ptr) (local.get $off)) (i32.sub (local.get $res_len) (local.get $off)) (i32.const ${S.k_reps.offset})))
                  (if (i32.gt_s (local.get $fl) (i32.const 0))
                    (then
                      (if (i32.gt_u (local.get $cnt) (i32.const 0)) (then (call $emit_byte (i32.const 44))))
                      (call $emit_zstr (i32.const ${S.el_list_1.offset}))
                      (call $emit_zstr (i32.const ${S.t_hash.offset})) (call $emit_uint (local.get $idv)) (call $emit_zstr (i32.const ${S.t_dot.offset}))
                      (call $emit_json_esc (i32.const 260100) (local.get $fl))
                      (call $emit_zstr (i32.const ${S.el_list_2.offset}))
                      (if (i32.gt_s (local.get $dl) (i32.const 0))
                        (then (call $emit_json_esc (i32.const 261100) (local.get $dl)))
                        (else (call $emit_zstr (i32.const ${S.def_deck.offset})))
                      )
                      (call $emit_zstr (i32.const ${S.t_lv_pfx.offset})) (call $emit_uint (local.get $repv))
                      (call $emit_zstr (i32.const ${S.t_d_pfx.offset})) (call $emit_uint (local.get $intv)) (call $emit_zstr (i32.const ${S.t_d_suf.offset}))
                      (call $emit_zstr (i32.const ${S.el_list_ie.offset}))
                      (local.set $cnt (i32.add (local.get $cnt) (i32.const 1)))
                    )
                  )
                  (local.set $off (i32.add (i32.add (local.get $off) (local.get $rel)) (i32.const 8)))
                  (br $rows_l)
                )
              )
            )
          )
        )
        (if (i32.eqz (local.get $cnt))
          (then
            (return (call $render_simple
              (i32.const ${S.t_app.offset}) (i32.const ${S.t_empty_sub.offset})
              (i32.const ${S.t_empty_badge.offset}) (i32.const ${S.ui_bc_note.offset})
              (i32.const ${S.el_pill_start.offset}) (i32.const ${S.t_empty_body.offset}) (i32.const ${S.btn_empty.offset})
            ))
          )
        )
        (call $emit_zstr (i32.const ${S.el_list_e.offset})) (call $emit_byte (i32.const 44))
        (call $emit_zstr (i32.const ${S.btn_home.offset}))
        (call $emit_zstr (i32.const ${S.ui_end.offset}))
        (return (call $emit_len))
      )
    )

    ;; State 8: SELECT stats -> render mastery stats card
    (if (i32.eq (global.get $state) (i32.const 8))
      (then
        (local.set $v (call $extract_json_int (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_total_cnt.offset})))
        (global.set $total_cnt (if (result i32) (i32.gt_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 0))))
        (local.set $v (call $extract_json_int (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_due_cnt.offset})))
        (global.set $due_cnt (if (result i32) (i32.gt_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 0))))
        (local.set $v (call $extract_json_int (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_mastered.offset})))
        (global.set $mastered (if (result i32) (i32.gt_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 0))))
        (return (call $render_stats))
      )
    )

    ;; State 9: DELETE done
    (if (i32.eq (global.get $state) (i32.const 9))
      (then
        (return (call $render_simple
          (i32.const ${S.t_del_title.offset}) (i32.const ${S.t_del_sub.offset})
          (i32.const ${S.t_del_badge.offset}) (i32.const ${S.ui_bc_warn.offset})
          (i32.const 0) (i32.const ${S.t_del_body.offset}) (i32.const ${S.btn_home.offset})
        ))
      )
    )

    (call $render_done)
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
  id: 'com.chattree.official.flashcards',
  version: '1.0.0',
  name: 'Flashcards Tutor',
  description: 'Minimalist Spaced Repetition (SRS) study tutor backed by isolated SQLite (database.sql) with interactive purple Flutter cards and 1-tap Hard / Good / Easy review buttons.',
  author: 'Chattree Core Team',
  primaryCommand: 'flashcards',
  aliases: ['study', 'cards', 'srs', 'tarjetas'],
  type: 'imported',
  category: 'education',
  capabilities: [
    'database.sql',
    'ui.components',
  ],
  tags: ['flashcards', 'srs', 'study', 'learning', 'sqlite', 'database', 'ui', 'official'],
  iconUrl: 'https://raw.githubusercontent.com/Ponce5/Chattree/main/plugins/official/flashcards/icon.png?v=1.0.0',
  bannerUrl: 'https://raw.githubusercontent.com/Ponce5/Chattree/main/plugins/official/flashcards/banner.png?v=1.0.0',
  changelog: '1.0.0: Initial official release with SM-2 spaced repetition stored in isolated SQLite (database.sql), minimalist purple Flutter study cards, and 1-tap Hard / Good / Easy review flow.',
  runtime: 'wasm',
  entrypoint: 'flashcards_entry',
  wasmPath: 'plugin.wasm',
  wasmSha256,
  runtimeApiVersion: '1.0.0',
  maxMemoryPages: 32,
  timeoutMs: 15000,
  fuelLimit: 80000000,
  inputOffset: 0,
  outputOffset: 65536,
  maxPayloadSizeBytes: 65536,
  tools: [
    {
      id: 'com.chattree.official.flashcards.tutor',
      command: 'flashcards',
      displayName: 'Flashcards Tutor',
      description: 'Spaced repetition flashcards tutor stored in SQLite. Always include "tool":"flashcards" and return ONE JSON object. Actions: "study" (next due card), "add" (requires "front", "back", optional "deck"), "reveal" (requires "id"), "rate" (requires "id" and "rating": "hard"|"good"|"easy"), "skip" (requires "id"), "practice" (review early), "list", "stats", "delete" (requires "id"), or "help".',
      capabilities: [
        'database.sql',
        'ui.components',
      ],
      intentContract: {
        intent: 'flashcards_action',
        validIntents: ['study', 'add', 'reveal', 'rate', 'skip', 'practice', 'list', 'stats', 'delete', 'help'],
        description: 'Interpret the user\'s flashcard or study request (English or Spanish) and return ONE valid JSON object with "tool":"flashcards" and "action".',
        fields: [
          {
            name: 'action',
            key: 'action',
            type: 'string',
            description: 'Action: "study", "add", "reveal", "rate", "skip", "practice", "list", "stats", "delete", or "help".',
            required: true,
          },
          {
            name: 'front',
            key: 'front',
            type: 'string',
            description: 'Question or prompt on the front of the flashcard (for action="add").',
            required: false,
          },
          {
            name: 'back',
            key: 'back',
            type: 'string',
            description: 'Answer or explanation on the back of the flashcard (for action="add").',
            required: false,
          },
          {
            name: 'deck',
            key: 'deck',
            type: 'string',
            description: 'Optional topic/deck name (default "General").',
            required: false,
          },
          {
            name: 'id',
            key: 'id',
            type: 'integer',
            description: 'Numeric flashcard ID (for reveal, rate, skip, delete).',
            required: false,
          },
          {
            name: 'rating',
            key: 'rating',
            type: 'string',
            description: 'SRS rating: "hard", "good", or "easy" (for action="rate").',
            required: false,
          },
        ],
        examples: [
          {
            input: 'crea una flashcard: ¿Cuál es la capital de Japón? respuesta Tokio',
            output: { tool: 'flashcards', action: 'add', front: '¿Cuál es la capital de Japón?', back: 'Tokio', deck: 'Geografía' },
          },
          {
            input: 'quiero estudiar mis flashcards',
            output: { tool: 'flashcards', action: 'study' },
          },
          {
            input: 'muéstrame mis estadísticas de estudio',
            output: { tool: 'flashcards', action: 'stats' },
          },
        ],
        maxResponseTokens: 400,
      },
    },
  ],
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`[OK] Built ${wasmPath} (${wasmBytes.length} bytes, sha256=${wasmSha256})`);

// ── Self-Test Suite (Full Async SQLite SRS Pipeline) ─────────────────────
function wrapEnvelope(aiObj) {
  const decoded = { ...aiObj, lang: 'es' };
  const operation = (decoded.action || 'study').toLowerCase();
  const payload = {};
  for (const [k, v] of Object.entries(decoded)) {
    const kl = k.toLowerCase();
    if (kl !== 'tool' && kl !== 'action') payload[kl] = v;
  }
  return JSON.stringify({ api: 'flashcards', command: 'flashcards', toolId: 'com.chattree.official.flashcards.tutor', operation, payload });
}

let dbRows = [];
let nextId = 1;
const nowSec = () => Math.floor(Date.now() / 1000);

function mockSqlHost(req) {
  assert.equal(req.api, 'database');
  const sql = req.payload.sql;
  const args = req.payload.args || [];
  if (req.operation === 'execute') {
    if (sql.startsWith('CREATE TABLE')) return { success: true, data: { executed: true, result: 0 } };
    if (sql.startsWith('INSERT INTO flashcards')) {
      const row = { id: nextId++, deck: args[0], front: args[1], back: args[2], interval_days: 0, ease: 250, reps: 0, due_at: 0 };
      dbRows.push(row);
      return { success: true, data: { executed: true, result: row.id } };
    }
    if (sql.startsWith('UPDATE flashcards')) {
      const [intD, ease, reps, delta, id] = args;
      const r = dbRows.find((x) => x.id === id);
      if (r) { r.interval_days = intD; r.ease = ease; r.reps = reps; r.due_at = nowSec() + delta; }
      return { success: true, data: { executed: true, result: r ? 1 : 0 } };
    }
    if (sql.startsWith('DELETE FROM flashcards')) {
      const before = dbRows.length;
      dbRows = dbRows.filter((x) => x.id !== args[0]);
      return { success: true, data: { executed: true, result: before - dbRows.length } };
    }
  }
  if (req.operation === 'query') {
    const now = nowSec();
    if (sql.includes('AS mastered_cnt')) {
      const total_cnt = dbRows.length;
      const due_cnt = dbRows.filter((r) => r.due_at <= now).length;
      const mastered_cnt = dbRows.filter((r) => r.reps >= 3).length;
      return { success: true, data: { rows: [{ total_cnt, due_cnt, mastered_cnt }], count: 1, limit: 2000 } };
    }
    if (sql === 'SELECT COUNT(*) AS total_cnt FROM flashcards') {
      return { success: true, data: { rows: [{ total_cnt: dbRows.length }], count: 1, limit: 2000 } };
    }
    if (sql.includes('WHERE id = ?')) {
      const found = dbRows.filter((r) => r.id === args[0]);
      return { success: true, data: { rows: found, count: found.length, limit: 2000 } };
    }
    if (sql.includes('WHERE id != ?')) {
      const found = dbRows.filter((r) => r.id !== args[0]).sort((a, b) => a.due_at - b.due_at || a.id - b.id).slice(0, 1);
      const due_cnt = dbRows.filter((r) => r.due_at <= now).length;
      const rows = found.map((r) => ({ ...r, due_cnt, total_cnt: dbRows.length }));
      return { success: true, data: { rows, count: rows.length, limit: 2000 } };
    }
    if (sql.includes('ORDER BY id DESC LIMIT 10')) {
      const rows = [...dbRows].sort((a, b) => b.id - a.id).slice(0, 10);
      return { success: true, data: { rows, count: rows.length, limit: 2000 } };
    }
    if (sql.includes('WHERE due_at <=')) {
      const due = dbRows.filter((r) => r.due_at <= now).sort((a, b) => a.due_at - b.due_at || a.id - b.id);
      const rows = due.slice(0, 1).map((r) => ({ ...r, due_cnt: due.length, total_cnt: dbRows.length }));
      return { success: true, data: { rows, count: rows.length, limit: 2000 } };
    }
    if (sql.includes('ORDER BY due_at ASC, id ASC LIMIT 1')) {
      const sorted = [...dbRows].sort((a, b) => a.due_at - b.due_at || a.id - b.id);
      const rows = sorted.slice(0, 1).map((r) => ({ ...r, due_cnt: dbRows.length, total_cnt: dbRows.length }));
      return { success: true, data: { rows, count: rows.length, limit: 2000 } };
    }
  }
  throw new Error('Unhandled SQL: ' + JSON.stringify(req));
}

let mem;
let pendingReq = null;
let pendingResPtr = 0;
let pendingResMax = 0;

const mod = await WebAssembly.instantiate(wasmBytes, {
  chattree: {
    host_call: (reqPtr, reqLen, resPtr, resMaxLen) => {
      const reqStr = Buffer.from(mem.buffer, reqPtr, reqLen).toString('utf8');
      pendingReq = JSON.parse(reqStr);
      pendingResPtr = resPtr;
      pendingResMax = resMaxLen;
      return 0;
    },
  },
});
mem = mod.instance.exports.memory;

function runAsync(inp) {
  pendingReq = null;
  const buf = Buffer.from(inp, 'utf8');
  Buffer.from(mem.buffer).set(buf, 0);
  let outLen = mod.instance.exports.flashcards_entry(0, buf.length);
  let hops = 0;
  while (outLen === 0 && pendingReq && hops < 10) {
    hops++;
    const req = pendingReq;
    pendingReq = null;
    const respObj = mockSqlHost(req);
    const rbuf = Buffer.from(JSON.stringify(respObj), 'utf8');
    const wlen = Math.min(rbuf.length, pendingResMax);
    Buffer.from(mem.buffer).set(rbuf.subarray(0, wlen), pendingResPtr);
    outLen = mod.instance.exports.resume(pendingResPtr, wlen);
  }
  const raw = Buffer.from(mem.buffer, 65536, outLen).toString('utf8');
  return JSON.parse(raw);
}

// 1. Empty deck on first run
let out = runAsync('lang=es');
assert.equal(out.type, 'ui');
assert.equal(out.ui.badge, 'READY');
assert.equal(out.ui.badgeColor, 'purple');

// 2. Add cards via natural language & slash command
out = runAsync(wrapEnvelope({ tool: 'flashcards', action: 'add', front: '¿Capital de Japón?', back: 'Tokio', deck: 'Geografía' }));
assert.equal(out.ui.badge, 'SAVED');
out = runAsync('add What is 2+2? | 4 lang=es');
assert.equal(out.ui.badge, 'SAVED');
assert.equal(dbRows.length, 2);

// 3. Study shows Question card with Show Answer button
out = runAsync('lang=es');
assert.equal(out.ui.badge, 'STUDY');
assert.equal(out.ui.elements[0].type, 'badge');
assert.equal(out.ui.elements[0].text, 'QUESTION');
assert.equal(out.ui.elements[1].content, '¿Capital de Japón?');
assert.equal(out.ui.elements[3].buttons[0].value, '/flashcards reveal 1');

// 4. Reveal shows Answer + Mastery progress + Hard/Good/Easy buttons
out = runAsync('reveal 1 lang=es');
assert.equal(out.ui.badge, 'ANSWER');
assert.equal(out.ui.elements[2].text, 'ANSWER');
assert.equal(out.ui.elements[3].content, 'Tokio');
assert.equal(out.ui.elements[5].buttons.length, 3);
assert.equal(out.ui.elements[5].buttons[0].value, '/flashcards rate 1 hard');
assert.equal(out.ui.elements[5].buttons[1].value, '/flashcards rate 1 good');
assert.equal(out.ui.elements[5].buttons[2].value, '/flashcards rate 1 easy');

// 5. Rate card #1 as Easy -> updates SRS (4d, ease 265, reps 1) and advances straight to card #2!
out = runAsync('rate 1 easy lang=es');
assert.equal(dbRows[0].interval_days, 4);
assert.equal(dbRows[0].ease, 265);
assert.equal(dbRows[0].reps, 1);
assert.equal(out.ui.badge, 'STUDY');
assert.equal(out.ui.elements[1].content, 'What is 2+2?');

// 6. Rate card #2 as Good -> advances to DONE (All Caught Up!)
out = runAsync('rate 2 good lang=es');
assert.equal(dbRows[1].interval_days, 1);
assert.equal(dbRows[1].reps, 1);
assert.equal(out.ui.badge, 'DONE');
assert.equal(out.ui.elements[0].text, 'ALL CAUGHT UP');

// 7. Practice Early still lets you study when none are due
out = runAsync('practice lang=es');
assert.equal(out.ui.badge, 'STUDY');

// 8. List, Stats, Delete, Help
out = runAsync('list lang=es');
assert.equal(out.ui.badge, 'DECK');
assert.equal(out.ui.elements[0].items.length, 2);
out = runAsync('stats lang=es');
assert.equal(out.ui.badge, 'STATS');
assert.match(out.ui.elements[2].content, /Due now: 0 · Total cards: 2/);
out = runAsync('delete 2 lang=es');
assert.equal(out.ui.badge, 'DELETED');
assert.equal(dbRows.length, 1);
out = runAsync('help lang=es');
assert.equal(out.ui.badge, 'GUIDE');

console.log('[OK] All 8 Flashcards SQLite SRS WASM tests passed!');
