import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDir = path.resolve(__dirname, '../plugins/official/mail');

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

let staticPtr = 340000;
const dataEntries = [];

function registerData(name, str) {
  const d = toWatData(str);
  const offset = staticPtr;
  staticPtr += d.byteLen + 8;
  staticPtr = (staticPtr + 3) & ~3;
  if (staticPtr >= 410000) {
    throw new Error(`Static data overflow past 410000 at ${name}: ${staticPtr}`);
  }
  dataEntries.push({ name, offset, strLen: d.strLen, escaped: d.escaped });
  return { offset, len: d.strLen };
}

const S = {};

// Storage keys matching EmailApiHandler in Chattree Host
S.sk_email = registerData('sk_email', 'chattree_email_account');
S.sk_imap = registerData('sk_imap', 'chattree_email_imap_host');
S.sk_smtp = registerData('sk_smtp', 'chattree_email_smtp_host');
S.sk_port = registerData('sk_port', 'chattree_email_smtp_port');

// Input JSON keys
S.k_lang = registerData('k_lang', 'lang');
S.k_lang_eq = registerData('k_lang_eq', 'lang=');
S.k_op = registerData('k_op', 'operation');
S.k_action = registerData('k_action', 'action');
S.k_intent = registerData('k_intent', 'INTENT');
S.k_email = registerData('k_email', 'email');
S.k_account = registerData('k_account', 'account');
S.k_user = registerData('k_user', 'user');
S.k_address = registerData('k_address', 'address');
S.k_password = registerData('k_password', 'password');
S.k_app_pw1 = registerData('k_app_pw1', 'app_password');
S.k_app_pw2 = registerData('k_app_pw2', 'apppassword');
S.k_pass = registerData('k_pass', 'pass');
S.k_token = registerData('k_token', 'token');
S.k_id = registerData('k_id', 'id');
S.k_msg_id = registerData('k_msg_id', 'message_id');
S.k_email_id = registerData('k_email_id', 'email_id');
S.k_query = registerData('k_query', 'query');
S.k_to = registerData('k_to', 'to');
S.k_recipient = registerData('k_recipient', 'recipient');
S.k_subject = registerData('k_subject', 'subject');
S.k_title = registerData('k_title', 'title');
S.k_body = registerData('k_body', 'body');
S.k_content = registerData('k_content', 'content');
S.k_message = registerData('k_message', 'message');
S.k_text = registerData('k_text', 'text');
S.k_imapHost = registerData('k_imapHost', 'imapHost');
S.k_imaphost_lc = registerData('k_imaphost_lc', 'imaphost');
S.k_imapPort = registerData('k_imapPort', 'imapPort');
S.k_imapport_lc = registerData('k_imapport_lc', 'imapport');
S.k_smtpHost = registerData('k_smtpHost', 'smtpHost');
S.k_smtphost_lc = registerData('k_smtphost_lc', 'smtphost');
S.k_smtpPort = registerData('k_smtpPort', 'smtpPort');
S.k_smtpport_lc = registerData('k_smtpport_lc', 'smtpport');

// Action names
S.a_status = registerData('a_status', 'status');
S.a_check = registerData('a_check', 'check');
S.a_config = registerData('a_config', 'config');
S.a_setup = registerData('a_setup', 'setup');
S.a_connect = registerData('a_connect', 'connect');
S.a_login = registerData('a_login', 'login');
S.a_configure = registerData('a_configure', 'configure');
S.a_inbox = registerData('a_inbox', 'inbox');
S.a_list = registerData('a_list', 'list');
S.a_events = registerData('a_events', 'events');
S.a_read = registerData('a_read', 'read');
S.a_get = registerData('a_get', 'get');
S.a_open = registerData('a_open', 'open');
S.a_send = registerData('a_send', 'send');
S.a_create = registerData('a_create', 'create');
S.a_disconnect = registerData('a_disconnect', 'disconnect');
S.a_logout = registerData('a_logout', 'logout');
S.a_delete = registerData('a_delete', 'delete');
S.a_remove = registerData('a_remove', 'remove');
S.a_help = registerData('a_help', 'help');
S.a_unknown = registerData('a_unknown', 'unknown');

// Host response keys
S.k_success = registerData('k_success', 'success');
S.k_exists = registerData('k_exists', 'exists');
S.k_value = registerData('k_value', 'value');
S.k_error = registerData('k_error', 'error');
S.k_provider = registerData('k_provider', 'provider');
S.k_configured = registerData('k_configured', 'configured');
S.k_unread_cnt = registerData('k_unread_cnt', 'unread_count');
S.k_total_cnt = registerData('k_total_cnt', 'total_count');
S.k_emails = registerData('k_emails', 'emails');
S.k_from = registerData('k_from', 'from');
S.k_date = registerData('k_date', 'date');
S.k_unread = registerData('k_unread', 'unread');
S.k_snippet = registerData('k_snippet', 'snippet');

// English UI & predefined strings (zero raw commands on button labels!)
S.def_en = registerData('def_en', 'en');
S.def_gmail = registerData('def_gmail', 'Gmail');
S.def_true = registerData('def_true', 'true');
S.def_false = registerData('def_false', 'false');
S.def_imap_def = registerData('def_imap_def', 'imap.gmail.com');
S.def_smtp_def = registerData('def_smtp_def', 'smtp.gmail.com');
S.def_port_def = registerData('def_port_def', '465');
S.def_cmd_cfg = registerData('def_cmd_cfg', '/gmail config <email> <app_password>');
S.def_cmd_gmail = registerData('def_cmd_gmail', '/gmail');
S.def_cmd_inbox = registerData('def_cmd_inbox', '/gmail inbox');
S.def_cmd_help = registerData('def_cmd_help', '/gmail help');
S.def_cmd_disc = registerData('def_cmd_disc', '/gmail disconnect');
S.def_colon = registerData('def_colon', ':');
S.def_nl = registerData('def_nl', '\n');

// English UI Card labels & button action labels
S.en_btn_inbox = registerData('en_btn_inbox', 'View Inbox');
S.en_btn_status = registerData('en_btn_status', 'Check Status');
S.en_btn_help = registerData('en_btn_help', 'Help');
S.en_btn_disc = registerData('en_btn_disc', 'Disconnect');
S.en_btn_retry = registerData('en_btn_retry', 'Retry');

S.en_setup_title = registerData('en_setup_title', 'Gmail Setup');
S.en_setup_sub = registerData('en_setup_sub', 'Account not connected');
S.en_setup_badge = registerData('en_setup_badge', 'NOT CONFIGURED');
S.en_setup_guide = registerData('en_setup_guide', 'Enable 2-Step Verification at myaccount.google.com/security, generate a 16-letter App Password, and run: /gmail config user@gmail.com abcd efgh ijkl mnop');
S.en_status_title = registerData('en_status_title', 'Gmail Status');
S.en_conn_badge = registerData('en_conn_badge', 'CONNECTED');
S.en_verified_val = registerData('en_verified_val', 'Verified (IMAP & SMTP)');
S.en_err_title = registerData('en_err_title', 'Connection Error');
S.en_auth_badge = registerData('en_auth_badge', 'AUTH FAILED');
S.en_auth_fb = registerData('en_auth_fb', 'Saved credentials failed IMAP verification. Generate a new 16-letter Google App Password and run /gmail config.');
S.en_cfg_ok_title = registerData('en_cfg_ok_title', 'Gmail Connected');
S.en_cfg_fail_title = registerData('en_cfg_fail_title', 'Connection Failed');
S.en_err_badge = registerData('en_err_badge', 'ERROR');
S.en_lbl_status = registerData('en_lbl_status', 'Status');
S.en_lbl_account = registerData('en_lbl_account', 'Account');
S.en_lbl_provider = registerData('en_lbl_provider', 'Provider');
S.en_lbl_imap = registerData('en_lbl_imap', 'IMAP');
S.en_lbl_smtp = registerData('en_lbl_smtp', 'SMTP');
S.en_lbl_unread = registerData('en_lbl_unread', 'Unread');
S.en_lbl_cmd = registerData('en_lbl_cmd', 'Command');
S.en_val_uncfg = registerData('en_val_uncfg', 'Not configured');
S.en_val_verified = registerData('en_val_verified', 'Verified');
S.en_err_generic = registerData('en_err_generic', 'Gmail operation failed. Check your connection and credentials.');
S.en_help_fb = registerData('en_help_fb', 'Gmail commands: /gmail (check status), /gmail config <email> <16-letter App Password>, /gmail inbox, /gmail read <id>, /gmail send <to> | <subject> | <body>, /gmail disconnect.');
S.en_inb_empty = registerData('en_inb_empty', 'Your inbox is empty.');
S.en_inb_hdr = registerData('en_inb_hdr', 'Recent emails:\n');
S.en_sent_ok = registerData('en_sent_ok', 'Email sent successfully.');
S.en_disc_ok = registerData('en_disc_ok', 'Gmail account disconnected.');
S.en_hdr_from = registerData('en_hdr_from', 'From: ');
S.en_hdr_to = registerData('en_hdr_to', '\nTo: ');
S.en_hdr_subj = registerData('en_hdr_subj', '\nSubject: ');
S.en_hdr_date = registerData('en_hdr_date', '\nDate: ');
S.en_hdr_body = registerData('en_hdr_body', '\n\n');

// Reasons for help / missing args
S.r_help = registerData('r_help', 'help');
S.r_miss_cfg = registerData('r_miss_cfg', 'missing_config');
S.r_miss_id = registerData('r_miss_id', 'missing_id');
S.r_miss_send = registerData('r_miss_send', 'missing_send');

// Storage & Email Host API JSON fragments
S.req_st_get_p = registerData('req_st_get_p', '{"api":"storage","operation":"get","payload":{"key":"');
S.req_em_inbox = registerData('req_em_inbox', '{"api":"email","operation":"inbox","payload":{}}');
S.req_em_disc = registerData('req_em_disc', '{"api":"email","operation":"disconnect","payload":{}}');
S.req_em_cfg_p = registerData('req_em_cfg_p', '{"api":"email","operation":"config","payload":{"email":"');
S.req_em_read_p = registerData('req_em_read_p', '{"api":"email","operation":"read","payload":{"id":"');
S.req_em_send_p = registerData('req_em_send_p', '{"api":"email","operation":"send","payload":{"to":"');
S.req_end = registerData('req_end', '}}');
S.jf_q = registerData('jf_q', '"');
S.jf_comma = registerData('jf_comma', ',');
S.jf_pass = registerData('jf_pass', '"password":"');
S.jf_imaph = registerData('jf_imaph', '"imapHost":"');
S.jf_imapp = registerData('jf_imapp', '"imapPort":"');
S.jf_smtph = registerData('jf_smtph', '"smtpHost":"');
S.jf_smtpp = registerData('jf_smtpp', '"smtpPort":"');
S.jf_subj = registerData('jf_subj', '"subject":"');
S.jf_body = registerData('jf_body', '"body":"');

// Ultra-compact AI templates (ONLY used for direct slash/button natural-text commands)
S.ai_txt_p1 = registerData('ai_txt_p1', '{"api":"ai","operation":"complete","payload":{"systemPrompt":"Reply concisely in language \\"');
S.ai_txt_p2 = registerData('ai_txt_p2', '\\". Natural plain text only.","prompt":"');
S.ai_txt_p3 = registerData('ai_txt_p3', '","maxTokens":220,"temperature":0.2,"timeoutMs":15000}}');

S.p_inb_ask = registerData('p_inb_ask', 'Summarize these inbox emails concisely (include [id] so user can read any): ');
S.p_sd_ask = registerData('p_sd_ask', 'Confirm briefly that email was sent or explain error. ok=');
S.p_dc_ask = registerData('p_dc_ask', 'Confirm briefly that Gmail was disconnected or explain error. ok=');
S.p_help_ask = registerData('p_help_ask', 'Explain briefly how to set up a Google 16-letter App Password and use /gmail config, /gmail, /gmail inbox, /gmail read <id>, /gmail send, /gmail disconnect. Reason: ');
S.p_to_k = registerData('p_to_k', ' to=');
S.p_sub_k = registerData('p_sub_k', ' subject=');
S.p_err_k = registerData('p_err_k', ' error=');

// UI Card JSON Output Templates (hideText:true for clean English cards)
S.ui_p1 = registerData('ui_p1', '{"type":"ui","displayText":"');
S.ui_p2 = registerData('ui_p2', '","ui":{"title":"');
S.ui_sub = registerData('ui_sub', '","subtitle":"');
S.ui_badge = registerData('ui_badge', '","badge":"');
S.ui_bc_green = registerData('ui_bc_green', '","badgeColor":"green","icon":"check","hideText":true,"elements":[');
S.ui_bc_orange = registerData('ui_bc_orange', '","badgeColor":"orange","icon":"warning","hideText":true,"elements":[');
S.ui_bc_red = registerData('ui_bc_red', '","badgeColor":"red","icon":"error","hideText":true,"elements":[');
S.ui_kv_start = registerData('ui_kv_start', '{"type":"key_value","items":[');
S.ui_kv_item1 = registerData('ui_kv_item1', '{"key":"');
S.ui_kv_item2 = registerData('ui_kv_item2', '","value":"');
S.ui_kv_item3 = registerData('ui_kv_item3', '"}');
S.ui_text_start = registerData('ui_text_start', '{"type":"text","content":"');
S.ui_text_end = registerData('ui_text_end', '"}');
S.ui_arr_end = registerData('ui_arr_end', ']}');
S.ui_div = registerData('ui_div', '{"type":"divider"}');
S.ui_btn_start = registerData('ui_btn_start', '{"type":"button_row","buttons":[');
S.ui_btn_1 = registerData('ui_btn_1', '{"label":"');
S.ui_btn_2 = registerData('ui_btn_2', '","action":"command","value":"');
S.ui_btn_pri = registerData('ui_btn_pri', '","style":"primary"}');
S.ui_btn_sec = registerData('ui_btn_sec', '","style":"secondary"}');
S.ui_btn_dng = registerData('ui_btn_dng', '","style":"danger","confirm":true}');
S.ui_close = registerData('ui_close', ']}}');
S.direct_p1 = registerData('direct_p1', '{"type":"direct","displayText":"');
S.direct_p2 = registerData('direct_p2', '"}');

// Compact JSON Output Templates (Conversational AI mode, 0 extra LLM calls)
S.j_err1 = registerData('j_err1', '{"ok":false,"error":"');
S.j_inb1 = registerData('j_inb1', '{"ok":true,"account":"');
S.j_inb2 = registerData('j_inb2', '","unread":');
S.j_inb3 = registerData('j_inb3', ',"total":');
S.j_inb4 = registerData('j_inb4', ',"emails":[');
S.j_em1 = registerData('j_em1', '{"id":"');
S.j_em2 = registerData('j_em2', '","from":"');
S.j_em3 = registerData('j_em3', '","subject":"');
S.j_em4 = registerData('j_em4', '","date":"');
S.j_em5 = registerData('j_em5', '","unread":');
S.j_em6 = registerData('j_em6', ',"snippet":"');
S.j_em7 = registerData('j_em7', '"}');
S.j_arr_end = registerData('j_arr_end', ']}');
S.j_rd1 = registerData('j_rd1', '{"ok":true,"id":"');
S.j_rd2 = registerData('j_rd2', '","from":"');
S.j_rd3 = registerData('j_rd3', '","to":"');
S.j_rd4 = registerData('j_rd4', '","subject":"');
S.j_rd5 = registerData('j_rd5', '","date":"');
S.j_rd6 = registerData('j_rd6', '","body":"');
S.j_sd1 = registerData('j_sd1', '{"ok":true,"sent":true,"to":"');
S.j_sd2 = registerData('j_sd2', '","subject":"');
S.j_dc_ok = registerData('j_dc_ok', '{"ok":true,"disconnected":true}');
S.j_help_r1 = registerData('j_help_r1', '{"ok":false,"reason":"');
S.j_help_ok = registerData('j_help_ok', '{"ok":true,"action":"help","commands":["/gmail","/gmail config <email> <app_password>","/gmail inbox","/gmail read <id>","/gmail send <to> | <subject> | <body>","/gmail disconnect"]}');

const dataLines = dataEntries
  .map((e) => `  (data (i32.const ${e.offset}) "${e.escaped}") ;; ${e.name} (len=${e.strLen})`)
  .join('\n');

const wat = `;; Chattree Official Gmail Plugin (v2.4.0)
;; Token-Optimized English Flutter Status/Config UI + Natural-Language Inbox/Read/Send
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
  (global $g_op_ok (mut i32) (i32.const 0))
  (global $g_configured (mut i32) (i32.const 0))
  (global $g_verified (mut i32) (i32.const 0))
  (global $g_unread_cnt (mut i32) (i32.const 0))
  (global $g_total_cnt (mut i32) (i32.const 0))
  (global $g_is_json (mut i32) (i32.const 0))

  (global $lang_len (mut i32) (i32.const 0))
  (global $act_len (mut i32) (i32.const 0))
  (global $email_len (mut i32) (i32.const 0))
  (global $pass_len (mut i32) (i32.const 0))
  (global $id_len (mut i32) (i32.const 0))
  (global $to_len (mut i32) (i32.const 0))
  (global $subj_len (mut i32) (i32.const 0))
  (global $body_len (mut i32) (i32.const 0))
  (global $imap_len (mut i32) (i32.const 0))
  (global $imap_port_len (mut i32) (i32.const 0))
  (global $smtp_len (mut i32) (i32.const 0))
  (global $smtp_port_len (mut i32) (i32.const 0))
  (global $query_len (mut i32) (i32.const 0))

  (global $se_len (mut i32) (i32.const 0))
  (global $si_len (mut i32) (i32.const 0))
  (global $ss_len (mut i32) (i32.const 0))
  (global $sp_len (mut i32) (i32.const 0))
  (global $prov_len (mut i32) (i32.const 0))
  (global $err_len (mut i32) (i32.const 0))
  (global $saved_res_len (mut i32) (i32.const 0))
  (global $ai_text_len (mut i32) (i32.const 0))

  (global $arr_cursor (mut i32) (i32.const 0))
  (global $arr_obj_start (mut i32) (i32.const 0))
  (global $arr_obj_len (mut i32) (i32.const 0))
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
    (if (i32.lt_s (local.get $a_len) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $b_len (call $zlen (local.get $b_zstr)))
    (if (i32.ne (local.get $a_len) (local.get $b_len)) (then (return (i32.const 0))))
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

  (func $match_cmd (param $buf i32) (param $len i32) (param $kw_zstr i32) (result i32)
    (local $k_len i32)
    (local $i i32)
    (local.set $k_len (call $zlen (local.get $kw_zstr)))
    (if (i32.lt_s (local.get $len) (local.get $k_len)) (then (return (i32.const 0))))
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.lt_u (local.get $i) (local.get $k_len))
        (then
          (if (i32.ne
                (i32.load8_u (i32.add (local.get $buf) (local.get $i)))
                (i32.load8_u (i32.add (local.get $kw_zstr) (local.get $i))))
            (then (return (i32.const 0)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (if (i32.eq (local.get $len) (local.get $k_len)) (then (return (i32.const 1))))
    (call $is_ws (i32.load8_u (i32.add (local.get $buf) (local.get $k_len))))
  )

  (func $contains_char (param $ptr i32) (param $len i32) (param $ch i32) (result i32)
    (local $i i32)
    (local.set $i (i32.const 0))
    (loop $l
      (if (i32.lt_s (local.get $i) (local.get $len))
        (then
          (if (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $i))) (local.get $ch))
            (then (return (i32.const 1)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (i32.const 0)
  )

  (func $strip_ws_inplace (param $ptr i32) (param $len i32) (result i32)
    (local $i i32)
    (local $out i32)
    (local $ch i32)
    (local.set $i (i32.const 0))
    (local.set $out (i32.const 0))
    (loop $l
      (if (i32.lt_s (local.get $i) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $ptr) (local.get $i))))
          (if (i32.eqz (call $is_ws (local.get $ch)))
            (then
              (i32.store8 (i32.add (local.get $ptr) (local.get $out)) (local.get $ch))
              (local.set $out (i32.add (local.get $out) (i32.const 1)))
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)
        )
      )
    )
    (local.get $out)
  )

  (func $zero_pass_buf
    (local $i i32)
    (local.set $i (i32.const 0))
    (loop $z
      (if (i32.lt_u (local.get $i) (i32.const 256))
        (then
          (i32.store8 (i32.add (i32.const 410450) (local.get $i)) (i32.const 0))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $z)
        )
      )
    )
    (global.set $pass_len (i32.const 0))
  )

  (func $utf8_clamp (param $ptr i32) (param $len i32) (param $max_bytes i32) (result i32)
    (local $n i32)
    (if (i32.le_s (local.get $len) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $n (local.get $len))
    (if (i32.gt_s (local.get $n) (local.get $max_bytes))
      (then
        (local.set $n (local.get $max_bytes))
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

  (func $out_bytes (param $ptr i32) (param $len i32)
    (local $avail i32)
    (local $n i32)
    (if (i32.le_s (local.get $len) (i32.const 0)) (then (return)))
    (local.set $avail (i32.sub (i32.const 327000) (global.get $out_pos)))
    (if (i32.le_s (local.get $avail) (i32.const 0)) (then (return)))
    (local.set $n (local.get $len))
    (if (i32.gt_s (local.get $n) (local.get $avail)) (then (local.set $n (local.get $avail))))
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
          (if (i32.lt_u (local.get $ch) (i32.const 32)) (then (local.set $ch (i32.const 32))))
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
    (if (i32.ge_s (i32.add (global.get $out_pos) (i32.mul (local.get $n) (i32.const 2))) (i32.const 327000))
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
    (local.set $rev (i32.const 449300))
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

  ;; Extract string OR numeric literal as string (useful for ports/IDs)
  (func $extract_json_str_or_int (param $json i32) (param $jlen i32) (param $key_zstr i32) (param $dst i32) (param $max_out i32) (result i32)
    (local $pos i32)
    (local $ch i32)
    (local $out i32)
    (local $sl i32)
    (local.set $sl (call $extract_json_str (local.get $json) (local.get $jlen) (local.get $key_zstr) (local.get $dst) (local.get $max_out)))
    (if (i32.ge_s (local.get $sl) (i32.const 0)) (then (return (local.get $sl))))
    (local.set $pos (call $find_json_val_pos (local.get $json) (local.get $jlen) (local.get $key_zstr)))
    (if (i32.lt_s (local.get $pos) (i32.const 0)) (then (return (i32.const -1))))
    (local.set $out (local.get $dst))
    (loop $d
      (if (i32.and (i32.lt_s (local.get $pos) (local.get $jlen))
                   (i32.lt_s (i32.sub (local.get $out) (local.get $dst)) (local.get $max_out)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $json) (local.get $pos))))
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 48)) (i32.le_u (local.get $ch) (i32.const 57)))
            (then
              (i32.store8 (local.get $out) (local.get $ch))
              (local.set $out (i32.add (local.get $out) (i32.const 1)))
              (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
              (br $d)
            )
          )
        )
      )
    )
    (if (i32.eq (local.get $out) (local.get $dst)) (then (return (i32.const -1))))
    (i32.sub (local.get $out) (local.get $dst))
  )

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

  (func $find_array_start (param $json i32) (param $jlen i32) (param $key_zstr i32) (result i32)
    (local $pos i32)
    (local.set $pos (call $find_json_val_pos (local.get $json) (local.get $jlen) (local.get $key_zstr)))
    (if (i32.lt_s (local.get $pos) (i32.const 0)) (then (return (i32.const 0))))
    (if (i32.ne (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 91))
      (then (return (i32.const 0)))
    )
    (global.set $arr_cursor (i32.add (local.get $pos) (i32.const 1)))
    (i32.const 1)
  )

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
        (then (local.set $pos (i32.add (local.get $pos) (i32.const 1))) (br $skip))
      )
    )
    (if (i32.ne (i32.load8_u (i32.add (local.get $json) (local.get $pos))) (i32.const 123))
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
          (if (local.get $esc) (then (local.set $esc (i32.const 0)))
          (else (if (i32.eq (local.get $ch) (i32.const 92)) (then (local.set $esc (i32.const 1)))
          (else (if (i32.eq (local.get $ch) (i32.const 34)) (then (local.set $in_str (i32.const 0))))))))
        )
        (else
          (if (i32.eq (local.get $ch) (i32.const 34)) (then (local.set $in_str (i32.const 1)))
          (else (if (i32.eq (local.get $ch) (i32.const 123)) (then (local.set $depth (i32.add (local.get $depth) (i32.const 1))))
          (else (if (i32.eq (local.get $ch) (i32.const 125))
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
          )))))
        )
      )
      (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
      (br $walk)
    )
    (i32.const 0)
  )

  ;; ── Lang Stripper ────────────────────────────────────────────────────

  (func $set_default_lang
    (memory.copy (i32.const 410000) (i32.const ${S.def_en.offset}) (i32.const ${S.def_en.len}))
    (global.set $lang_len (i32.const ${S.def_en.len}))
  )

  (func $strip_lang_token (param $ptr i32) (param $len i32) (result i32)
    (local $i i32)
    (local $new_len i32)
    (local $tok_len i32)
    (local $ws_idx i32)
    (call $set_default_lang)
    (if (i32.le_s (local.get $len) (i32.const 0)) (then (return (i32.const 0))))
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
                (memory.copy (i32.const 410000) (i32.add (local.get $ptr) (i32.const 5)) (local.get $tok_len))
                (global.set $lang_len (local.get $tok_len))
                (return (i32.const 0))
              )
            )
          )
        )
      )
    )
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
                (memory.copy (i32.const 410000)
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

  ;; ── Storage Sync Helper & Host Dispatchers ───────────────────────────

  (func $sync_storage_get (param $key_z i32) (param $dst i32) (param $max_out i32) (result i32)
    (local $p i32)
    (local $rc i32)
    (local $vlen i32)
    (local.set $p (call $copy_zstr (i32.const ${S.req_st_get_p.offset}) (i32.const 560000)))
    (local.set $p (call $copy_zstr (local.get $key_z) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.req_end.offset}) (local.get $p)))
    (local.set $rc (call $host_call (i32.const 560000) (i32.sub (local.get $p) (i32.const 560000)) (i32.const 760000) (i32.const 500000)))
    (if (i32.le_s (local.get $rc) (i32.const 0)) (then (return (i32.const 0))))
    (if (i32.ne (call $extract_json_bool (i32.const 760000) (local.get $rc) (i32.const ${S.k_exists.offset})) (i32.const 1))
      (then (return (i32.const 0)))
    )
    (local.set $vlen (call $extract_json_str (i32.const 760000) (local.get $rc) (i32.const ${S.k_value.offset}) (local.get $dst) (local.get $max_out)))
    (if (i32.lt_s (local.get $vlen) (i32.const 0)) (then (return (i32.const 0))))
    (local.get $vlen)
  )

  (func $read_stored_meta
    (global.set $se_len (call $sync_storage_get (i32.const ${S.sk_email.offset}) (i32.const 447000) (i32.const 240)))
    (global.set $si_len (call $sync_storage_get (i32.const ${S.sk_imap.offset}) (i32.const 447300) (i32.const 240)))
    (global.set $ss_len (call $sync_storage_get (i32.const ${S.sk_smtp.offset}) (i32.const 447600) (i32.const 240)))
    (global.set $sp_len (call $sync_storage_get (i32.const ${S.sk_port.offset}) (i32.const 447900) (i32.const 14)))
  )

  (func $dispatch_host (param $req_len i32) (result i32)
    (local $rc i32)
    (local.set $rc (call $host_call (i32.const 560000) (local.get $req_len) (i32.const 760000) (i32.const 500000)))
    (if (i32.eqz (local.get $rc)) (then (return (i32.const 0))))
    (if (i32.gt_s (local.get $rc) (i32.const 0))
      (then (return (call $handle_resume (i32.const 760000) (local.get $rc))))
    )
    (global.set $g_op_ok (i32.const 0))
    (global.set $saved_res_len (i32.const 0))
    (call $render_fallback_for_state)
  )

  (func $start_status_flow (result i32)
    (local $len i32)
    (call $read_stored_meta)
    (if (i32.le_s (global.get $se_len) (i32.const 0))
      (then
        (global.set $g_configured (i32.const 0))
        (global.set $g_verified (i32.const 0))
        (global.set $g_op_ok (i32.const 0))
        (return (call $render_status_ui))
      )
    )
    (global.set $g_configured (i32.const 1))
    (global.set $g_state (i32.const 10))
    (local.set $len (call $zlen (i32.const ${S.req_em_inbox.offset})))
    (memory.copy (i32.const 560000) (i32.const ${S.req_em_inbox.offset}) (local.get $len))
    (call $dispatch_host (local.get $len))
  )

  (func $start_config_flow (result i32)
    (local $p i32)
    (local $rc i32)
    (global.set $g_state (i32.const 11))
    (local.set $p (call $copy_zstr (i32.const ${S.req_em_cfg_p.offset}) (i32.const 560000)))
    (local.set $p (call $copy_json_esc (i32.const 410150) (global.get $email_len) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_pass.offset}) (local.get $p)))
    (local.set $p (call $copy_json_esc (i32.const 410450) (global.get $pass_len) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
    (if (i32.gt_s (global.get $imap_len) (i32.const 0))
      (then
        (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_imaph.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 445200) (global.get $imap_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
      )
    )
    (if (i32.gt_s (global.get $imap_port_len) (i32.const 0))
      (then
        (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_imapp.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 445500) (global.get $imap_port_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
      )
    )
    (if (i32.gt_s (global.get $smtp_len) (i32.const 0))
      (then
        (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_smtph.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 445550) (global.get $smtp_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
      )
    )
    (if (i32.gt_s (global.get $smtp_port_len) (i32.const 0))
      (then
        (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_smtpp.offset}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 445850) (global.get $smtp_port_len) (local.get $p)))
        (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
      )
    )
    (local.set $p (call $copy_zstr (i32.const ${S.req_end.offset}) (local.get $p)))
    (local.set $rc (call $dispatch_host (i32.sub (local.get $p) (i32.const 560000))))
    (call $zero_pass_buf)
    (local.get $rc)
  )

  (func $start_inbox_flow (result i32)
    (local $len i32)
    (global.set $g_state (i32.const 12))
    (local.set $len (call $zlen (i32.const ${S.req_em_inbox.offset})))
    (memory.copy (i32.const 560000) (i32.const ${S.req_em_inbox.offset}) (local.get $len))
    (call $dispatch_host (local.get $len))
  )

  (func $start_read_flow (result i32)
    (local $p i32)
    (global.set $g_state (i32.const 13))
    (local.set $p (call $copy_zstr (i32.const ${S.req_em_read_p.offset}) (i32.const 560000)))
    (local.set $p (call $copy_json_esc (i32.const 410750) (global.get $id_len) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.req_end.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 560000)))
  )

  (func $start_send_flow (result i32)
    (local $p i32)
    (global.set $g_state (i32.const 14))
    (local.set $p (call $copy_zstr (i32.const ${S.req_em_send_p.offset}) (i32.const 560000)))
    (local.set $p (call $copy_json_esc (i32.const 410900) (global.get $to_len) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_subj.offset}) (local.get $p)))
    (if (i32.gt_s (global.get $subj_len) (i32.const 0))
      (then (local.set $p (call $copy_json_esc (i32.const 411200) (global.get $subj_len) (local.get $p))))
    )
    (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.jf_body.offset}) (local.get $p)))
    (if (i32.gt_s (global.get $body_len) (i32.const 0))
      (then (local.set $p (call $copy_json_esc (i32.const 412300) (global.get $body_len) (local.get $p))))
    )
    (local.set $p (call $copy_zstr (i32.const ${S.jf_q.offset}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.req_end.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 560000)))
  )

  (func $start_disconnect_flow (result i32)
    (local $len i32)
    (global.set $g_state (i32.const 15))
    (local.set $len (call $zlen (i32.const ${S.req_em_disc.offset})))
    (memory.copy (i32.const 560000) (i32.const ${S.req_em_disc.offset}) (local.get $len))
    (call $dispatch_host (local.get $len))
  )

  ;; ── Compact Direct-Mode AI Dispatchers (plain-text slash/button ONLY) ─

  (func $begin_ai_txt_req (result i32)
    (local $p i32)
    (local.set $p (call $copy_zstr (i32.const ${S.ai_txt_p1.offset}) (i32.const 560000)))
    (local.set $p (call $copy_json_esc (i32.const 410000) (global.get $lang_len) (local.get $p)))
    (call $copy_zstr (i32.const ${S.ai_txt_p2.offset}) (local.get $p))
  )

  (func $call_ai_inbox_direct (result i32)
    (local $p i32)
    (local $shown i32)
    (local $il i32) (local $fl i32) (local $sl i32)
    (global.set $g_state (i32.const 22))
    (local.set $p (call $begin_ai_txt_req))
    (local.set $p (call $copy_json_esc (i32.const ${S.p_inb_ask.offset}) (i32.const ${S.p_inb_ask.len}) (local.get $p)))
    (if (global.get $g_op_ok)
      (then
        (if (call $find_array_start (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_emails.offset}))
          (then
            (local.set $shown (i32.const 0))
            (loop $pl
              (if (i32.and (i32.lt_s (local.get $shown) (i32.const 8))
                           (call $next_array_obj (i32.const 1260000) (global.get $saved_res_len)))
                (then
                  (local.set $il (call $extract_json_str_or_int (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_id.offset}) (i32.const 453200) (i32.const 40)))
                  (local.set $fl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_from.offset}) (i32.const 453400) (i32.const 64)))
                  (local.set $sl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_subject.offset}) (i32.const 453700) (i32.const 80)))
                  (if (i32.gt_s (local.get $shown) (i32.const 0)) (then (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p)))))
                  (if (i32.gt_s (local.get $il) (i32.const 0))
                    (then
                      (i32.store8 (local.get $p) (i32.const 91))
                      (local.set $p (i32.add (local.get $p) (i32.const 1)))
                      (local.set $p (call $copy_json_esc (i32.const 453200) (local.get $il) (local.get $p)))
                      (i32.store8 (local.get $p) (i32.const 93))
                      (i32.store8 (i32.add (local.get $p) (i32.const 1)) (i32.const 32))
                      (local.set $p (i32.add (local.get $p) (i32.const 2)))
                    )
                  )
                  (if (i32.gt_s (local.get $sl) (i32.const 0)) (then (local.set $p (call $copy_json_esc (i32.const 453700) (local.get $sl) (local.get $p)))))
                  (if (i32.gt_s (local.get $fl) (i32.const 0))
                    (then
                      (i32.store8 (local.get $p) (i32.const 40))
                      (local.set $p (i32.add (local.get $p) (i32.const 1)))
                      (local.set $p (call $copy_json_esc (i32.const 453400) (local.get $fl) (local.get $p)))
                      (i32.store8 (local.get $p) (i32.const 41))
                      (local.set $p (i32.add (local.get $p) (i32.const 1)))
                    )
                  )
                  (local.set $shown (i32.add (local.get $shown) (i32.const 1)))
                  (br $pl)
                )
              )
            )
          )
        )
      )
      (else
        (local.set $p (call $copy_json_esc (i32.const ${S.p_err_k.offset}) (i32.const ${S.p_err_k.len}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 448000) (call $utf8_clamp (i32.const 448000) (global.get $err_len) (i32.const 300)) (local.get $p)))
      )
    )
    (local.set $p (call $copy_zstr (i32.const ${S.ai_txt_p3.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 560000)))
  )

  (func $call_ai_send_direct (result i32)
    (local $p i32)
    (global.set $g_state (i32.const 24))
    (local.set $p (call $begin_ai_txt_req))
    (local.set $p (call $copy_json_esc (i32.const ${S.p_sd_ask.offset}) (i32.const ${S.p_sd_ask.len}) (local.get $p)))
    (if (global.get $g_op_ok)
      (then (local.set $p (call $copy_zstr (i32.const ${S.def_true.offset}) (local.get $p))))
      (else (local.set $p (call $copy_zstr (i32.const ${S.def_false.offset}) (local.get $p))))
    )
    (local.set $p (call $copy_json_esc (i32.const ${S.p_to_k.offset}) (i32.const ${S.p_to_k.len}) (local.get $p)))
    (local.set $p (call $copy_json_esc (i32.const 410900) (global.get $to_len) (local.get $p)))
    (local.set $p (call $copy_json_esc (i32.const ${S.p_sub_k.offset}) (i32.const ${S.p_sub_k.len}) (local.get $p)))
    (local.set $p (call $copy_json_esc (i32.const 411200) (call $utf8_clamp (i32.const 411200) (global.get $subj_len) (i32.const 120)) (local.get $p)))
    (if (i32.gt_s (global.get $err_len) (i32.const 0))
      (then
        (local.set $p (call $copy_json_esc (i32.const ${S.p_err_k.offset}) (i32.const ${S.p_err_k.len}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 448000) (call $utf8_clamp (i32.const 448000) (global.get $err_len) (i32.const 300)) (local.get $p)))
      )
    )
    (local.set $p (call $copy_zstr (i32.const ${S.ai_txt_p3.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 560000)))
  )

  (func $call_ai_disc_direct (result i32)
    (local $p i32)
    (global.set $g_state (i32.const 26))
    (local.set $p (call $begin_ai_txt_req))
    (local.set $p (call $copy_json_esc (i32.const ${S.p_dc_ask.offset}) (i32.const ${S.p_dc_ask.len}) (local.get $p)))
    (if (global.get $g_op_ok)
      (then (local.set $p (call $copy_zstr (i32.const ${S.def_true.offset}) (local.get $p))))
      (else (local.set $p (call $copy_zstr (i32.const ${S.def_false.offset}) (local.get $p))))
    )
    (if (i32.gt_s (global.get $err_len) (i32.const 0))
      (then
        (local.set $p (call $copy_json_esc (i32.const ${S.p_err_k.offset}) (i32.const ${S.p_err_k.len}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 448000) (call $utf8_clamp (i32.const 448000) (global.get $err_len) (i32.const 300)) (local.get $p)))
      )
    )
    (local.set $p (call $copy_zstr (i32.const ${S.ai_txt_p3.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 560000)))
  )

  (func $call_ai_help (param $r_ptr i32) (param $r_len i32) (result i32)
    (local $p i32)
    (global.set $g_state (i32.const 25))
    (local.set $p (call $begin_ai_txt_req))
    (local.set $p (call $copy_json_esc (i32.const ${S.p_help_ask.offset}) (i32.const ${S.p_help_ask.len}) (local.get $p)))
    (local.set $p (call $copy_json_esc (local.get $r_ptr) (local.get $r_len) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.ai_txt_p3.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 560000)))
  )

  ;; ── Zero-Token English Flutter UI Card Renderers (Status & Config) ───

  (func $emit_kv (param $kp i32) (param $kl i32) (param $vp i32) (param $vl i32) (param $first i32)
    (if (i32.eqz (local.get $first)) (then (call $out_z (i32.const ${S.jf_comma.offset}))))
    (call $out_z (i32.const ${S.ui_kv_item1.offset}))
    (call $out_json_esc (local.get $kp) (local.get $kl) (i32.const 48))
    (call $out_z (i32.const ${S.ui_kv_item2.offset}))
    (call $out_json_esc (local.get $vp) (local.get $vl) (i32.const 190))
    (call $out_z (i32.const ${S.ui_kv_item3.offset}))
  )

  (func $emit_btn (param $lbl_z i32) (param $cmd_z i32) (param $style_z i32) (param $first i32)
    (if (i32.eqz (local.get $first)) (then (call $out_z (i32.const ${S.jf_comma.offset}))))
    (call $out_z (i32.const ${S.ui_btn_1.offset}))
    (call $out_json_esc (local.get $lbl_z) (call $zlen (local.get $lbl_z)) (i32.const 38))
    (call $out_z (i32.const ${S.ui_btn_2.offset}))
    (call $out_json_esc (local.get $cmd_z) (call $zlen (local.get $cmd_z)) (i32.const 64))
    (call $out_z (local.get $style_z))
  )

  (func $emit_ui_header (param $disp_z i32) (param $title_z i32) (param $sub_p i32) (param $sub_l i32) (param $badge_z i32) (param $style_z i32)
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.ui_p1.offset}))
    (call $out_json_esc (local.get $disp_z) (call $zlen (local.get $disp_z)) (i32.const 200))
    (call $out_z (i32.const ${S.ui_p2.offset}))
    (call $out_json_esc (local.get $title_z) (call $zlen (local.get $title_z)) (i32.const 95))
    (if (i32.gt_s (local.get $sub_l) (i32.const 0))
      (then
        (call $out_z (i32.const ${S.ui_sub.offset}))
        (call $out_json_esc (local.get $sub_p) (local.get $sub_l) (i32.const 180))
      )
    )
    (call $out_z (i32.const ${S.ui_badge.offset}))
    (call $out_json_esc (local.get $badge_z) (call $zlen (local.get $badge_z)) (i32.const 28))
    (call $out_z (local.get $style_z))
  )

  ;; Render Bare /gmail & /gmail status Flutter UI Card (0 AI tokens)
  (func $render_status_ui (result i32)
    (local $sp i32)
    (local $up i32)
    (if (i32.eqz (global.get $g_configured))
      (then
        (call $emit_ui_header
          (i32.const ${S.en_setup_sub.offset})
          (i32.const ${S.en_setup_title.offset})
          (i32.const ${S.en_setup_sub.offset}) (i32.const ${S.en_setup_sub.len})
          (i32.const ${S.en_setup_badge.offset})
          (i32.const ${S.ui_bc_orange.offset}))
        (call $out_z (i32.const ${S.ui_kv_start.offset}))
        (call $emit_kv (i32.const ${S.en_lbl_status.offset}) (i32.const ${S.en_lbl_status.len}) (i32.const ${S.en_val_uncfg.offset}) (i32.const ${S.en_val_uncfg.len}) (i32.const 1))
        (call $emit_kv (i32.const ${S.en_lbl_cmd.offset}) (i32.const ${S.en_lbl_cmd.len}) (i32.const ${S.def_cmd_cfg.offset}) (i32.const ${S.def_cmd_cfg.len}) (i32.const 0))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_div.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_text_start.offset}))
        (call $out_json_esc (i32.const ${S.en_setup_guide.offset}) (i32.const ${S.en_setup_guide.len}) (i32.const 600))
        (call $out_z (i32.const ${S.ui_text_end.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_div.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_btn_start.offset}))
        (call $emit_btn (i32.const ${S.en_btn_help.offset}) (i32.const ${S.def_cmd_help.offset}) (i32.const ${S.ui_btn_pri.offset}) (i32.const 1))
        (call $emit_btn (i32.const ${S.en_btn_status.offset}) (i32.const ${S.def_cmd_gmail.offset}) (i32.const ${S.ui_btn_sec.offset}) (i32.const 0))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
        (call $out_z (i32.const ${S.ui_close.offset}))
        (return (i32.sub (global.get $out_pos) (i32.const 65536)))
      )
    )

    (if (global.get $g_verified)
      (then
        (call $emit_ui_header
          (i32.const ${S.en_cfg_ok_title.offset})
          (i32.const ${S.en_status_title.offset})
          (i32.const 447000) (global.get $se_len)
          (i32.const ${S.en_conn_badge.offset})
          (i32.const ${S.ui_bc_green.offset}))
        (call $out_z (i32.const ${S.ui_kv_start.offset}))
        (call $emit_kv (i32.const ${S.en_lbl_status.offset}) (i32.const ${S.en_lbl_status.len}) (i32.const ${S.en_verified_val.offset}) (i32.const ${S.en_verified_val.len}) (i32.const 1))
        (call $emit_kv (i32.const ${S.en_lbl_account.offset}) (i32.const ${S.en_lbl_account.len}) (i32.const 447000) (global.get $se_len) (i32.const 0))
        (if (i32.gt_s (global.get $si_len) (i32.const 0))
          (then (call $emit_kv (i32.const ${S.en_lbl_imap.offset}) (i32.const ${S.en_lbl_imap.len}) (i32.const 447300) (global.get $si_len) (i32.const 0)))
          (else (call $emit_kv (i32.const ${S.en_lbl_imap.offset}) (i32.const ${S.en_lbl_imap.len}) (i32.const ${S.def_imap_def.offset}) (i32.const ${S.def_imap_def.len}) (i32.const 0)))
        )
        (local.set $sp (i32.const 454500))
        (if (i32.gt_s (global.get $ss_len) (i32.const 0))
          (then (local.set $sp (call $copy_mem (i32.const 447600) (local.get $sp) (global.get $ss_len))))
          (else (local.set $sp (call $copy_zstr (i32.const ${S.def_smtp_def.offset}) (local.get $sp))))
        )
        (local.set $sp (call $copy_zstr (i32.const ${S.def_colon.offset}) (local.get $sp)))
        (if (i32.gt_s (global.get $sp_len) (i32.const 0))
          (then (local.set $sp (call $copy_mem (i32.const 447900) (local.get $sp) (global.get $sp_len))))
          (else (local.set $sp (call $copy_zstr (i32.const ${S.def_port_def.offset}) (local.get $sp))))
        )
        (call $emit_kv (i32.const ${S.en_lbl_smtp.offset}) (i32.const ${S.en_lbl_smtp.len}) (i32.const 454500) (i32.sub (local.get $sp) (i32.const 454500)) (i32.const 0))
        (local.set $up (call $copy_int_str (global.get $g_unread_cnt) (i32.const 454450)))
        (call $emit_kv (i32.const ${S.en_lbl_unread.offset}) (i32.const ${S.en_lbl_unread.len}) (i32.const 454450) (i32.sub (local.get $up) (i32.const 454450)) (i32.const 0))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_div.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_btn_start.offset}))
        (call $emit_btn (i32.const ${S.en_btn_inbox.offset}) (i32.const ${S.def_cmd_inbox.offset}) (i32.const ${S.ui_btn_pri.offset}) (i32.const 1))
        (call $emit_btn (i32.const ${S.en_btn_help.offset}) (i32.const ${S.def_cmd_help.offset}) (i32.const ${S.ui_btn_sec.offset}) (i32.const 0))
        (call $emit_btn (i32.const ${S.en_btn_disc.offset}) (i32.const ${S.def_cmd_disc.offset}) (i32.const ${S.ui_btn_dng.offset}) (i32.const 0))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
        (call $out_z (i32.const ${S.ui_close.offset}))
        (return (i32.sub (global.get $out_pos) (i32.const 65536)))
      )
    )

    ;; Configured but IMAP verification failed
    (call $emit_ui_header
      (i32.const ${S.en_err_title.offset})
      (i32.const ${S.en_err_title.offset})
      (i32.const 447000) (global.get $se_len)
      (i32.const ${S.en_auth_badge.offset})
      (i32.const ${S.ui_bc_red.offset}))
    (call $out_z (i32.const ${S.ui_kv_start.offset}))
    (call $emit_kv (i32.const ${S.en_lbl_account.offset}) (i32.const ${S.en_lbl_account.len}) (i32.const 447000) (global.get $se_len) (i32.const 1))
    (if (i32.gt_s (global.get $si_len) (i32.const 0))
      (then (call $emit_kv (i32.const ${S.en_lbl_imap.offset}) (i32.const ${S.en_lbl_imap.len}) (i32.const 447300) (global.get $si_len) (i32.const 0)))
    )
    (call $out_z (i32.const ${S.ui_arr_end.offset}))
    (call $out_z (i32.const ${S.jf_comma.offset}))
    (call $out_z (i32.const ${S.ui_div.offset}))
    (call $out_z (i32.const ${S.jf_comma.offset}))
    (call $out_z (i32.const ${S.ui_text_start.offset}))
    (if (i32.gt_s (global.get $err_len) (i32.const 0))
      (then (call $out_json_esc (i32.const 448000) (global.get $err_len) (i32.const 900)))
      (else (call $out_json_esc (i32.const ${S.en_auth_fb.offset}) (i32.const ${S.en_auth_fb.len}) (i32.const 900)))
    )
    (call $out_z (i32.const ${S.ui_text_end.offset}))
    (call $out_z (i32.const ${S.jf_comma.offset}))
    (call $out_z (i32.const ${S.ui_div.offset}))
    (call $out_z (i32.const ${S.jf_comma.offset}))
    (call $out_z (i32.const ${S.ui_btn_start.offset}))
    (call $emit_btn (i32.const ${S.en_btn_retry.offset}) (i32.const ${S.def_cmd_gmail.offset}) (i32.const ${S.ui_btn_pri.offset}) (i32.const 1))
    (call $emit_btn (i32.const ${S.en_btn_disc.offset}) (i32.const ${S.def_cmd_disc.offset}) (i32.const ${S.ui_btn_dng.offset}) (i32.const 0))
    (call $out_z (i32.const ${S.ui_arr_end.offset}))
    (call $out_z (i32.const ${S.ui_close.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  ;; Render /gmail config Flutter UI Card (0 AI tokens)
  (func $render_config_ui (result i32)
    (if (global.get $g_op_ok)
      (then
        (call $emit_ui_header
          (i32.const ${S.en_cfg_ok_title.offset})
          (i32.const ${S.en_cfg_ok_title.offset})
          (i32.const 410150) (global.get $email_len)
          (i32.const ${S.en_conn_badge.offset})
          (i32.const ${S.ui_bc_green.offset}))
        (call $out_z (i32.const ${S.ui_kv_start.offset}))
        (call $emit_kv (i32.const ${S.en_lbl_account.offset}) (i32.const ${S.en_lbl_account.len}) (i32.const 410150) (global.get $email_len) (i32.const 1))
        (if (i32.gt_s (global.get $prov_len) (i32.const 0))
          (then (call $emit_kv (i32.const ${S.en_lbl_provider.offset}) (i32.const ${S.en_lbl_provider.len}) (i32.const 449200) (global.get $prov_len) (i32.const 0)))
        )
        (call $emit_kv (i32.const ${S.en_lbl_status.offset}) (i32.const ${S.en_lbl_status.len}) (i32.const ${S.en_val_verified.offset}) (i32.const ${S.en_val_verified.len}) (i32.const 0))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_div.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_btn_start.offset}))
        (call $emit_btn (i32.const ${S.en_btn_inbox.offset}) (i32.const ${S.def_cmd_inbox.offset}) (i32.const ${S.ui_btn_pri.offset}) (i32.const 1))
        (call $emit_btn (i32.const ${S.en_btn_status.offset}) (i32.const ${S.def_cmd_gmail.offset}) (i32.const ${S.ui_btn_sec.offset}) (i32.const 0))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
      )
      (else
        (call $emit_ui_header
          (i32.const ${S.en_cfg_fail_title.offset})
          (i32.const ${S.en_cfg_fail_title.offset})
          (i32.const 410150) (global.get $email_len)
          (i32.const ${S.en_err_badge.offset})
          (i32.const ${S.ui_bc_red.offset}))
        (call $out_z (i32.const ${S.ui_text_start.offset}))
        (if (i32.gt_s (global.get $err_len) (i32.const 0))
          (then (call $out_json_esc (i32.const 448000) (global.get $err_len) (i32.const 900)))
          (else (call $out_json_esc (i32.const ${S.en_err_generic.offset}) (i32.const ${S.en_err_generic.len}) (i32.const 900)))
        )
        (call $out_z (i32.const ${S.ui_text_end.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_div.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_btn_start.offset}))
        (call $emit_btn (i32.const ${S.en_btn_help.offset}) (i32.const ${S.def_cmd_help.offset}) (i32.const ${S.ui_btn_pri.offset}) (i32.const 1))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
      )
    )
    (call $out_z (i32.const ${S.ui_close.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  ;; ── Zero-Token Compact JSON Renderers (Conversational Natural Text) ──

  (func $emit_json_err (result i32)
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.j_err1.offset}))
    (if (i32.gt_s (global.get $err_len) (i32.const 0))
      (then (call $out_json_esc (i32.const 448000) (global.get $err_len) (i32.const 600)))
      (else (call $out_json_esc (i32.const ${S.en_err_generic.offset}) (i32.const ${S.en_err_generic.len}) (i32.const 600)))
    )
    (call $out_z (i32.const ${S.direct_p2.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  (func $render_inbox_json (result i32)
    (local $count i32)
    (local $il i32) (local $fl i32) (local $sl i32) (local $dl i32) (local $snl i32) (local $unr i32)
    (if (i32.eqz (global.get $g_op_ok)) (then (return (call $emit_json_err))))
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.j_inb1.offset}))
    (call $out_json_esc (i32.const 447000) (global.get $se_len) (i32.const 160))
    (call $out_z (i32.const ${S.j_inb2.offset}))
    (global.set $out_pos (call $copy_int_str (global.get $g_unread_cnt) (global.get $out_pos)))
    (call $out_z (i32.const ${S.j_inb3.offset}))
    (global.set $out_pos (call $copy_int_str (global.get $g_total_cnt) (global.get $out_pos)))
    (call $out_z (i32.const ${S.j_inb4.offset}))
    (local.set $count (i32.const 0))
    (if (call $find_array_start (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_emails.offset}))
      (then
        (loop $el
          (if (i32.and (i32.lt_s (local.get $count) (i32.const 12))
                       (call $next_array_obj (i32.const 1260000) (global.get $saved_res_len)))
            (then
              (local.set $il (call $extract_json_str_or_int (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_id.offset}) (i32.const 453200) (i32.const 60)))
              (local.set $fl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_from.offset}) (i32.const 453400) (i32.const 120)))
              (local.set $sl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_subject.offset}) (i32.const 453700) (i32.const 140)))
              (local.set $dl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_date.offset}) (i32.const 454000) (i32.const 60)))
              (local.set $snl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_snippet.offset}) (i32.const 454200) (i32.const 140)))
              (local.set $unr (call $extract_json_bool (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_unread.offset})))
              (if (i32.gt_s (local.get $count) (i32.const 0)) (then (call $out_z (i32.const ${S.jf_comma.offset}))))
              (call $out_z (i32.const ${S.j_em1.offset}))
              (if (i32.gt_s (local.get $il) (i32.const 0)) (then (call $out_json_esc (i32.const 453200) (local.get $il) (i32.const 60))))
              (call $out_z (i32.const ${S.j_em2.offset}))
              (if (i32.gt_s (local.get $fl) (i32.const 0)) (then (call $out_json_esc (i32.const 453400) (local.get $fl) (i32.const 120))))
              (call $out_z (i32.const ${S.j_em3.offset}))
              (if (i32.gt_s (local.get $sl) (i32.const 0)) (then (call $out_json_esc (i32.const 453700) (local.get $sl) (i32.const 140))))
              (call $out_z (i32.const ${S.j_em4.offset}))
              (if (i32.gt_s (local.get $dl) (i32.const 0)) (then (call $out_json_esc (i32.const 454000) (local.get $dl) (i32.const 60))))
              (call $out_z (i32.const ${S.j_em5.offset}))
              (if (i32.eq (local.get $unr) (i32.const 1)) (then (call $out_z (i32.const ${S.def_true.offset}))) (else (call $out_z (i32.const ${S.def_false.offset}))))
              (call $out_z (i32.const ${S.j_em6.offset}))
              (if (i32.gt_s (local.get $snl) (i32.const 0)) (then (call $out_json_esc (i32.const 454200) (local.get $snl) (i32.const 140))))
              (call $out_z (i32.const ${S.j_em7.offset}))
              (local.set $count (i32.add (local.get $count) (i32.const 1)))
              (br $el)
            )
          )
        )
      )
    )
    (call $out_z (i32.const ${S.j_arr_end.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  (func $render_read_json (result i32)
    (local $fl i32) (local $tl i32) (local $sl i32) (local $dl i32) (local $bl i32)
    (if (i32.eqz (global.get $g_op_ok)) (then (return (call $emit_json_err))))
    (local.set $fl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_from.offset}) (i32.const 453400) (i32.const 200)))
    (local.set $tl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_to.offset}) (i32.const 453700) (i32.const 200)))
    (local.set $sl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_subject.offset}) (i32.const 454000) (i32.const 240)))
    (local.set $dl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_date.offset}) (i32.const 454300) (i32.const 100)))
    (local.set $bl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_body.offset}) (i32.const 412300) (i32.const 3500)))
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.j_rd1.offset}))
    (call $out_json_esc (i32.const 410750) (global.get $id_len) (i32.const 60))
    (call $out_z (i32.const ${S.j_rd2.offset}))
    (if (i32.gt_s (local.get $fl) (i32.const 0)) (then (call $out_json_esc (i32.const 453400) (local.get $fl) (i32.const 200))))
    (call $out_z (i32.const ${S.j_rd3.offset}))
    (if (i32.gt_s (local.get $tl) (i32.const 0)) (then (call $out_json_esc (i32.const 453700) (local.get $tl) (i32.const 200))))
    (call $out_z (i32.const ${S.j_rd4.offset}))
    (if (i32.gt_s (local.get $sl) (i32.const 0)) (then (call $out_json_esc (i32.const 454000) (local.get $sl) (i32.const 240))))
    (call $out_z (i32.const ${S.j_rd5.offset}))
    (if (i32.gt_s (local.get $dl) (i32.const 0)) (then (call $out_json_esc (i32.const 454300) (local.get $dl) (i32.const 100))))
    (call $out_z (i32.const ${S.j_rd6.offset}))
    (if (i32.gt_s (local.get $bl) (i32.const 0)) (then (call $out_json_esc (i32.const 412300) (local.get $bl) (i32.const 3500))))
    (call $out_z (i32.const ${S.direct_p2.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  (func $render_send_json (result i32)
    (if (i32.eqz (global.get $g_op_ok)) (then (return (call $emit_json_err))))
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.j_sd1.offset}))
    (call $out_json_esc (i32.const 410900) (global.get $to_len) (i32.const 180))
    (call $out_z (i32.const ${S.j_sd2.offset}))
    (call $out_json_esc (i32.const 411200) (global.get $subj_len) (i32.const 200))
    (call $out_z (i32.const ${S.direct_p2.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  (func $render_disconnect_json (result i32)
    (if (i32.eqz (global.get $g_op_ok)) (then (return (call $emit_json_err))))
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.j_dc_ok.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  (func $render_help_json (param $r_ptr i32) (param $r_len i32) (result i32)
    (global.set $out_pos (i32.const 65536))
    (if (call $str_eq (local.get $r_ptr) (local.get $r_len) (i32.const ${S.r_help.offset}))
      (then (call $out_z (i32.const ${S.j_help_ok.offset})))
      (else
        (call $out_z (i32.const ${S.j_help_r1.offset}))
        (call $out_json_esc (local.get $r_ptr) (local.get $r_len) (i32.const 48))
        (call $out_z (i32.const ${S.direct_p2.offset}))
      )
    )
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  ;; ── Direct Plain-Text Renderers (button / slash commands, NO UI card) ─

  (func $render_read_direct (result i32)
    (local $fl i32) (local $tl i32) (local $sl i32) (local $dl i32) (local $bl i32)
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.direct_p1.offset}))
    (if (global.get $g_op_ok)
      (then
        (local.set $fl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_from.offset}) (i32.const 453400) (i32.const 200)))
        (local.set $tl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_to.offset}) (i32.const 453700) (i32.const 200)))
        (local.set $sl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_subject.offset}) (i32.const 454000) (i32.const 240)))
        (local.set $dl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_date.offset}) (i32.const 454300) (i32.const 100)))
        (local.set $bl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_body.offset}) (i32.const 412300) (i32.const 4000)))
        (call $out_json_esc (i32.const ${S.en_hdr_from.offset}) (i32.const ${S.en_hdr_from.len}) (i32.const 16))
        (if (i32.gt_s (local.get $fl) (i32.const 0)) (then (call $out_json_esc (i32.const 453400) (local.get $fl) (i32.const 200))))
        (if (i32.gt_s (local.get $tl) (i32.const 0))
          (then
            (call $out_json_esc (i32.const ${S.en_hdr_to.offset}) (i32.const ${S.en_hdr_to.len}) (i32.const 16))
            (call $out_json_esc (i32.const 453700) (local.get $tl) (i32.const 200))
          )
        )
        (call $out_json_esc (i32.const ${S.en_hdr_subj.offset}) (i32.const ${S.en_hdr_subj.len}) (i32.const 16))
        (if (i32.gt_s (local.get $sl) (i32.const 0)) (then (call $out_json_esc (i32.const 454000) (local.get $sl) (i32.const 240))))
        (if (i32.gt_s (local.get $dl) (i32.const 0))
          (then
            (call $out_json_esc (i32.const ${S.en_hdr_date.offset}) (i32.const ${S.en_hdr_date.len}) (i32.const 16))
            (call $out_json_esc (i32.const 454300) (local.get $dl) (i32.const 100))
          )
        )
        (call $out_json_esc (i32.const ${S.en_hdr_body.offset}) (i32.const ${S.en_hdr_body.len}) (i32.const 16))
        (if (i32.gt_s (local.get $bl) (i32.const 0)) (then (call $out_json_esc (i32.const 412300) (local.get $bl) (i32.const 4000))))
      )
      (else
        (if (i32.gt_s (global.get $err_len) (i32.const 0))
          (then (call $out_json_esc (i32.const 448000) (global.get $err_len) (i32.const 600)))
          (else (call $out_json_esc (i32.const ${S.en_err_generic.offset}) (i32.const ${S.en_err_generic.len}) (i32.const 600)))
        )
      )
    )
    (call $out_z (i32.const ${S.direct_p2.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  (func $render_inbox_direct (result i32)
    (local $count i32) (local $il i32) (local $fl i32) (local $sl i32)
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.direct_p1.offset}))
    (if (i32.gt_s (global.get $ai_text_len) (i32.const 0))
      (then (call $out_json_esc (i32.const 480000) (global.get $ai_text_len) (i32.const 12000)))
      (else
        (if (i32.eqz (global.get $g_op_ok))
          (then
            (if (i32.gt_s (global.get $err_len) (i32.const 0))
              (then (call $out_json_esc (i32.const 448000) (global.get $err_len) (i32.const 600)))
              (else (call $out_json_esc (i32.const ${S.en_err_generic.offset}) (i32.const ${S.en_err_generic.len}) (i32.const 600)))
            )
          )
          (else
            (if (i32.le_s (global.get $g_total_cnt) (i32.const 0))
              (then (call $out_json_esc (i32.const ${S.en_inb_empty.offset}) (i32.const ${S.en_inb_empty.len}) (i32.const 120)))
              (else
                (call $out_json_esc (i32.const ${S.en_inb_hdr.offset}) (i32.const ${S.en_inb_hdr.len}) (i32.const 64))
                (local.set $count (i32.const 0))
                (if (call $find_array_start (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_emails.offset}))
                  (then
                    (loop $flp
                      (if (i32.and (i32.lt_s (local.get $count) (i32.const 10))
                                   (call $next_array_obj (i32.const 1260000) (global.get $saved_res_len)))
                        (then
                          (local.set $il (call $extract_json_str_or_int (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_id.offset}) (i32.const 453200) (i32.const 40)))
                          (local.set $fl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_from.offset}) (i32.const 453400) (i32.const 80)))
                          (local.set $sl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_subject.offset}) (i32.const 453700) (i32.const 100)))
                          (if (i32.gt_s (local.get $count) (i32.const 0)) (then (call $out_json_esc (i32.const ${S.def_nl.offset}) (i32.const 1) (i32.const 4))))
                          (if (i32.gt_s (local.get $il) (i32.const 0)) (then (call $out_json_esc (i32.const 453200) (local.get $il) (i32.const 40)) (call $out_z (i32.const ${S.def_colon.offset}))))
                          (if (i32.gt_s (local.get $sl) (i32.const 0)) (then (call $out_json_esc (i32.const 453700) (local.get $sl) (i32.const 100))))
                          (if (i32.gt_s (local.get $fl) (i32.const 0)) (then (call $out_z (i32.const ${S.jf_comma.offset})) (call $out_json_esc (i32.const 453400) (local.get $fl) (i32.const 80))))
                          (local.set $count (i32.add (local.get $count) (i32.const 1)))
                          (br $flp)
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
    (call $out_z (i32.const ${S.direct_p2.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  (func $render_direct_with_fb (param $ok_z i32) (result i32)
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.direct_p1.offset}))
    (if (i32.gt_s (global.get $ai_text_len) (i32.const 0))
      (then (call $out_json_esc (i32.const 480000) (global.get $ai_text_len) (i32.const 12000)))
      (else
        (if (global.get $g_op_ok)
          (then (call $out_json_esc (local.get $ok_z) (call $zlen (local.get $ok_z)) (i32.const 400)))
          (else
            (if (i32.gt_s (global.get $err_len) (i32.const 0))
              (then (call $out_json_esc (i32.const 448000) (global.get $err_len) (i32.const 600)))
              (else (call $out_json_esc (i32.const ${S.en_err_generic.offset}) (i32.const ${S.en_err_generic.len}) (i32.const 600)))
            )
          )
        )
      )
    )
    (call $out_z (i32.const ${S.direct_p2.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  (func $render_help_direct (result i32)
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.direct_p1.offset}))
    (if (i32.gt_s (global.get $ai_text_len) (i32.const 0))
      (then (call $out_json_esc (i32.const 480000) (global.get $ai_text_len) (i32.const 12000)))
      (else (call $out_json_esc (i32.const ${S.en_help_fb.offset}) (i32.const ${S.en_help_fb.len}) (i32.const 600)))
    )
    (call $out_z (i32.const ${S.direct_p2.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  (func $render_fallback_for_state (result i32)
    (if (i32.eq (global.get $g_state) (i32.const 10)) (then (return (call $render_status_ui))))
    (if (i32.eq (global.get $g_state) (i32.const 11)) (then (return (call $render_config_ui))))
    (if (i32.or (i32.eq (global.get $g_state) (i32.const 12)) (i32.eq (global.get $g_state) (i32.const 22)))
      (then
        (if (global.get $g_is_json) (then (return (call $render_inbox_json))))
        (return (call $render_inbox_direct))
      )
    )
    (if (i32.eq (global.get $g_state) (i32.const 13))
      (then
        (if (global.get $g_is_json) (then (return (call $render_read_json))))
        (return (call $render_read_direct))
      )
    )
    (if (i32.or (i32.eq (global.get $g_state) (i32.const 14)) (i32.eq (global.get $g_state) (i32.const 24)))
      (then
        (if (global.get $g_is_json) (then (return (call $render_send_json))))
        (return (call $render_direct_with_fb (i32.const ${S.en_sent_ok.offset})))
      )
    )
    (if (i32.or (i32.eq (global.get $g_state) (i32.const 15)) (i32.eq (global.get $g_state) (i32.const 26)))
      (then
        (if (global.get $g_is_json) (then (return (call $render_disconnect_json))))
        (return (call $render_direct_with_fb (i32.const ${S.en_disc_ok.offset})))
      )
    )
    (call $render_help_direct)
  )

  ;; ── Config Token Splitter Fallback ───────────────────────────────────

  (func $try_split_email_pass (param $ptr i32) (param $len i32)
    (local $p i32)
    (local $end i32)
    (local $tok_s i32)
    (local $tok_e i32)
    (local $pw_len i32)
    (local.set $p (local.get $ptr))
    (local.set $end (i32.add (local.get $ptr) (local.get $len)))
    (loop $ws (if (i32.and (i32.lt_u (local.get $p) (local.get $end)) (call $is_ws (i32.load8_u (local.get $p)))) (then (local.set $p (i32.add (local.get $p) (i32.const 1))) (br $ws))))
    (local.set $tok_s (local.get $p))
    (loop $sc
      (if (i32.and (i32.lt_u (local.get $p) (local.get $end)) (i32.eqz (call $is_ws (i32.load8_u (local.get $p)))))
        (then (local.set $p (i32.add (local.get $p) (i32.const 1))) (br $sc))
      )
    )
    (local.set $tok_e (local.get $p))
    (if (call $contains_char (local.get $tok_s) (i32.sub (local.get $tok_e) (local.get $tok_s)) (i32.const 64))
      (then
        (if (i32.le_s (global.get $email_len) (i32.const 0))
          (then
            (global.set $email_len (i32.sub (local.get $tok_e) (local.get $tok_s)))
            (if (i32.gt_s (global.get $email_len) (i32.const 240)) (then (global.set $email_len (i32.const 240))))
            (memory.copy (i32.const 410150) (local.get $tok_s) (global.get $email_len))
          )
        )
        (if (i32.le_s (global.get $pass_len) (i32.const 0))
          (then
            (local.set $pw_len (i32.sub (local.get $end) (local.get $tok_e)))
            (if (i32.gt_s (local.get $pw_len) (i32.const 240)) (then (local.set $pw_len (i32.const 240))))
            (memory.copy (i32.const 410450) (local.get $tok_e) (local.get $pw_len))
            (global.set $pass_len (call $strip_ws_inplace (i32.const 410450) (local.get $pw_len)))
          )
        )
      )
    )
  )

  ;; ── Entrypoint ───────────────────────────────────────────────────────

  (func (export "mail_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $ts i32) (local $tl i32)
    (local $ll i32) (local $al i32)
    (local $arg_p i32) (local $arg_l i32)
    (local $p1 i32) (local $p2 i32)
    (local $pipe1 i32) (local $pipe2 i32) (local $i i32)
    (local $s i32) (local $e i32)

    ;; Reset globals & zero password
    (global.set $g_state (i32.const 0))
    (global.set $g_op_ok (i32.const 0))
    (global.set $g_configured (i32.const 0))
    (global.set $g_verified (i32.const 0))
    (global.set $g_unread_cnt (i32.const 0))
    (global.set $g_total_cnt (i32.const 0))
    (global.set $g_is_json (i32.const 0))
    (global.set $act_len (i32.const 0))
    (global.set $email_len (i32.const 0))
    (call $zero_pass_buf)
    (global.set $id_len (i32.const 0))
    (global.set $to_len (i32.const 0))
    (global.set $subj_len (i32.const 0))
    (global.set $body_len (i32.const 0))
    (global.set $imap_len (i32.const 0))
    (global.set $imap_port_len (i32.const 0))
    (global.set $smtp_len (i32.const 0))
    (global.set $smtp_port_len (i32.const 0))
    (global.set $query_len (i32.const 0))
    (global.set $se_len (i32.const 0))
    (global.set $si_len (i32.const 0))
    (global.set $ss_len (i32.const 0))
    (global.set $sp_len (i32.const 0))
    (global.set $prov_len (i32.const 0))
    (global.set $err_len (i32.const 0))
    (global.set $saved_res_len (i32.const 0))
    (global.set $ai_text_len (i32.const 0))
    (call $set_default_lang)

    ;; Trim whitespace
    (local.set $ts (local.get $in_ptr))
    (local.set $tl (local.get $in_len))
    (loop $lt (if (i32.and (i32.gt_s (local.get $tl) (i32.const 0)) (call $is_ws (i32.load8_u (local.get $ts))))
      (then (local.set $ts (i32.add (local.get $ts) (i32.const 1))) (local.set $tl (i32.sub (local.get $tl) (i32.const 1))) (br $lt))))
    (loop $rt (if (i32.and (i32.gt_s (local.get $tl) (i32.const 0)) (call $is_ws (i32.load8_u (i32.add (local.get $ts) (i32.sub (local.get $tl) (i32.const 1))))))
      (then (local.set $tl (i32.sub (local.get $tl) (i32.const 1))) (br $rt))))

    ;; Case A: JSON input (conversational AI)
    (if (i32.and (i32.gt_s (local.get $tl) (i32.const 0)) (i32.eq (i32.load8_u (local.get $ts)) (i32.const 123)))
      (then
        (global.set $g_is_json (i32.const 1))
        (local.set $ll (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_lang.offset}) (i32.const 410000) (i32.const 24)))
        (if (i32.gt_s (local.get $ll) (i32.const 0)) (then (global.set $lang_len (local.get $ll))))

        (local.set $al (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_op.offset}) (i32.const 410050) (i32.const 48)))
        (if (i32.le_s (local.get $al) (i32.const 0))
          (then (local.set $al (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_action.offset}) (i32.const 410050) (i32.const 48))))
        )
        (if (i32.le_s (local.get $al) (i32.const 0))
          (then (local.set $al (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_intent.offset}) (i32.const 410050) (i32.const 48))))
        )
        (if (i32.gt_s (local.get $al) (i32.const 0))
          (then
            (call $to_lower (i32.const 410050) (i32.const 410050) (local.get $al))
            (global.set $act_len (local.get $al))
          )
        )

        ;; Route actions (NEVER forward raw "api":"gmail"!)
        (if (i32.or (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_help.offset}))
                    (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_unknown.offset})))
          (then (return (call $render_help_json (i32.const ${S.r_help.offset}) (i32.const ${S.r_help.len}))))
        )

        (if (i32.or (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_status.offset}))
                    (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_check.offset})))
          (then (return (call $start_status_flow)))
        )

        (if (i32.or
              (i32.or (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_disconnect.offset}))
                      (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_logout.offset})))
              (i32.or (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_delete.offset}))
                      (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_remove.offset}))))
          (then (return (call $start_disconnect_flow)))
        )

        ;; config / setup / connect / login / configure
        (if (i32.or
              (i32.or (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_config.offset}))
                      (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_setup.offset})))
              (i32.or
                (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_connect.offset}))
                (i32.or (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_login.offset}))
                        (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_configure.offset})))))
          (then
            (global.set $email_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_email.offset}) (i32.const 410150) (i32.const 240)))
            (if (i32.le_s (global.get $email_len) (i32.const 0)) (then (global.set $email_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_account.offset}) (i32.const 410150) (i32.const 240)))))
            (if (i32.le_s (global.get $email_len) (i32.const 0)) (then (global.set $email_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_user.offset}) (i32.const 410150) (i32.const 240)))))
            (if (i32.le_s (global.get $email_len) (i32.const 0)) (then (global.set $email_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_address.offset}) (i32.const 410150) (i32.const 240)))))
            (if (i32.lt_s (global.get $email_len) (i32.const 0)) (then (global.set $email_len (i32.const 0))))

            (global.set $pass_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_password.offset}) (i32.const 410450) (i32.const 240)))
            (if (i32.le_s (global.get $pass_len) (i32.const 0)) (then (global.set $pass_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_app_pw1.offset}) (i32.const 410450) (i32.const 240)))))
            (if (i32.le_s (global.get $pass_len) (i32.const 0)) (then (global.set $pass_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_app_pw2.offset}) (i32.const 410450) (i32.const 240)))))
            (if (i32.le_s (global.get $pass_len) (i32.const 0)) (then (global.set $pass_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_pass.offset}) (i32.const 410450) (i32.const 240)))))
            (if (i32.le_s (global.get $pass_len) (i32.const 0)) (then (global.set $pass_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_token.offset}) (i32.const 410450) (i32.const 240)))))
            (if (i32.lt_s (global.get $pass_len) (i32.const 0)) (then (global.set $pass_len (i32.const 0))))

            (if (i32.gt_s (global.get $pass_len) (i32.const 0))
              (then (global.set $pass_len (call $strip_ws_inplace (i32.const 410450) (global.get $pass_len))))
            )

            ;; Fallback splitter if LLM put "email pass" in query/content/title/text
            (if (i32.or (i32.le_s (global.get $email_len) (i32.const 0)) (i32.le_s (global.get $pass_len) (i32.const 0)))
              (then
                (global.set $query_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_query.offset}) (i32.const 445900) (i32.const 512)))
                (if (i32.le_s (global.get $query_len) (i32.const 0)) (then (global.set $query_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_content.offset}) (i32.const 445900) (i32.const 512)))))
                (if (i32.le_s (global.get $query_len) (i32.const 0)) (then (global.set $query_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_text.offset}) (i32.const 445900) (i32.const 512)))))
                (if (i32.gt_s (global.get $query_len) (i32.const 0))
                  (then (call $try_split_email_pass (i32.const 445900) (global.get $query_len)))
                )
              )
            )

            ;; Optional hosts/ports (camelCase + lowercased)
            (global.set $imap_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_imapHost.offset}) (i32.const 445200) (i32.const 240)))
            (if (i32.le_s (global.get $imap_len) (i32.const 0)) (then (global.set $imap_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_imaphost_lc.offset}) (i32.const 445200) (i32.const 240)))))
            (if (i32.lt_s (global.get $imap_len) (i32.const 0)) (then (global.set $imap_len (i32.const 0))))

            (global.set $imap_port_len (call $extract_json_str_or_int (local.get $ts) (local.get $tl) (i32.const ${S.k_imapPort.offset}) (i32.const 445500) (i32.const 14)))
            (if (i32.le_s (global.get $imap_port_len) (i32.const 0)) (then (global.set $imap_port_len (call $extract_json_str_or_int (local.get $ts) (local.get $tl) (i32.const ${S.k_imapport_lc.offset}) (i32.const 445500) (i32.const 14)))))
            (if (i32.lt_s (global.get $imap_port_len) (i32.const 0)) (then (global.set $imap_port_len (i32.const 0))))

            (global.set $smtp_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_smtpHost.offset}) (i32.const 445550) (i32.const 240)))
            (if (i32.le_s (global.get $smtp_len) (i32.const 0)) (then (global.set $smtp_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_smtphost_lc.offset}) (i32.const 445550) (i32.const 240)))))
            (if (i32.lt_s (global.get $smtp_len) (i32.const 0)) (then (global.set $smtp_len (i32.const 0))))

            (global.set $smtp_port_len (call $extract_json_str_or_int (local.get $ts) (local.get $tl) (i32.const ${S.k_smtpPort.offset}) (i32.const 445850) (i32.const 14)))
            (if (i32.le_s (global.get $smtp_port_len) (i32.const 0)) (then (global.set $smtp_port_len (call $extract_json_str_or_int (local.get $ts) (local.get $tl) (i32.const ${S.k_smtpport_lc.offset}) (i32.const 445850) (i32.const 14)))))
            (if (i32.lt_s (global.get $smtp_port_len) (i32.const 0)) (then (global.set $smtp_port_len (i32.const 0))))

            (if (i32.or (i32.eqz (call $contains_char (i32.const 410150) (global.get $email_len) (i32.const 64)))
                        (i32.le_s (global.get $pass_len) (i32.const 0)))
              (then
                (call $zero_pass_buf)
                (return (call $render_help_json (i32.const ${S.r_miss_cfg.offset}) (i32.const ${S.r_miss_cfg.len})))
              )
            )
            (return (call $start_config_flow))
          )
        )

        ;; read / get / open (IMPORTANT: normalizeArgs rewrites 'read' -> 'get'!)
        (if (i32.or (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_read.offset}))
                    (i32.or (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_get.offset}))
                            (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_open.offset}))))
          (then
            (global.set $id_len (call $extract_json_str_or_int (local.get $ts) (local.get $tl) (i32.const ${S.k_id.offset}) (i32.const 410750) (i32.const 120)))
            (if (i32.le_s (global.get $id_len) (i32.const 0)) (then (global.set $id_len (call $extract_json_str_or_int (local.get $ts) (local.get $tl) (i32.const ${S.k_msg_id.offset}) (i32.const 410750) (i32.const 120)))))
            (if (i32.le_s (global.get $id_len) (i32.const 0)) (then (global.set $id_len (call $extract_json_str_or_int (local.get $ts) (local.get $tl) (i32.const ${S.k_email_id.offset}) (i32.const 410750) (i32.const 120)))))
            (if (i32.le_s (global.get $id_len) (i32.const 0)) (then (global.set $id_len (call $extract_json_str_or_int (local.get $ts) (local.get $tl) (i32.const ${S.k_query.offset}) (i32.const 410750) (i32.const 120)))))
            (if (i32.le_s (global.get $id_len) (i32.const 0))
              (then (return (call $render_help_json (i32.const ${S.r_miss_id.offset}) (i32.const ${S.r_miss_id.len}))))
            )
            (return (call $start_read_flow))
          )
        )

        ;; send / create
        (if (i32.or (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_send.offset}))
                    (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_create.offset})))
          (then
            (global.set $to_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_to.offset}) (i32.const 410900) (i32.const 240)))
            (if (i32.le_s (global.get $to_len) (i32.const 0)) (then (global.set $to_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_recipient.offset}) (i32.const 410900) (i32.const 240)))))
            (if (i32.le_s (global.get $to_len) (i32.const 0)) (then (global.set $to_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_email.offset}) (i32.const 410900) (i32.const 240)))))
            (if (i32.lt_s (global.get $to_len) (i32.const 0)) (then (global.set $to_len (i32.const 0))))

            (global.set $subj_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_subject.offset}) (i32.const 411200) (i32.const 1000)))
            (if (i32.le_s (global.get $subj_len) (i32.const 0)) (then (global.set $subj_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_title.offset}) (i32.const 411200) (i32.const 1000)))))
            (if (i32.lt_s (global.get $subj_len) (i32.const 0)) (then (global.set $subj_len (i32.const 0))))

            (global.set $body_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_body.offset}) (i32.const 412300) (i32.const 30000)))
            (if (i32.le_s (global.get $body_len) (i32.const 0)) (then (global.set $body_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_content.offset}) (i32.const 412300) (i32.const 30000)))))
            (if (i32.le_s (global.get $body_len) (i32.const 0)) (then (global.set $body_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_message.offset}) (i32.const 412300) (i32.const 30000)))))
            (if (i32.le_s (global.get $body_len) (i32.const 0)) (then (global.set $body_len (call $extract_json_str (local.get $ts) (local.get $tl) (i32.const ${S.k_text.offset}) (i32.const 412300) (i32.const 30000)))))
            (if (i32.lt_s (global.get $body_len) (i32.const 0)) (then (global.set $body_len (i32.const 0))))

            (if (i32.eqz (call $contains_char (i32.const 410900) (global.get $to_len) (i32.const 64)))
              (then (return (call $render_help_json (i32.const ${S.r_miss_send.offset}) (i32.const ${S.r_miss_send.len}))))
            )
            (return (call $start_send_flow))
          )
        )

        ;; inbox / list / events
        (if (i32.or (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_inbox.offset}))
                    (i32.or (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_list.offset}))
                            (call $str_eq (i32.const 410050) (global.get $act_len) (i32.const ${S.a_events.offset}))))
          (then (return (call $start_inbox_flow)))
        )

        (return (call $start_status_flow))
      )
    )

    ;; Case B: Plain Text / Bare Slash Command
    (local.set $tl (call $strip_lang_token (local.get $ts) (local.get $tl)))
    (if (i32.le_s (local.get $tl) (i32.const 0))
      (then (return (call $start_status_flow)))
    )

    (call $to_lower (local.get $ts) (i32.const 454600) (local.get $tl))

    (if (i32.or (call $match_cmd (i32.const 454600) (local.get $tl) (i32.const ${S.a_help.offset}))
                (i32.and (i32.eq (local.get $tl) (i32.const 1)) (i32.eq (i32.load8_u (local.get $ts)) (i32.const 63))))
      (then (return (call $call_ai_help (i32.const ${S.r_help.offset}) (i32.const ${S.r_help.len}))))
    )
    (if (i32.or (call $match_cmd (i32.const 454600) (local.get $tl) (i32.const ${S.a_status.offset}))
                (call $match_cmd (i32.const 454600) (local.get $tl) (i32.const ${S.a_check.offset})))
      (then (return (call $start_status_flow)))
    )
    (if (i32.or (call $match_cmd (i32.const 454600) (local.get $tl) (i32.const ${S.a_disconnect.offset}))
                (call $match_cmd (i32.const 454600) (local.get $tl) (i32.const ${S.a_logout.offset})))
      (then (return (call $start_disconnect_flow)))
    )
    (if (i32.or (call $match_cmd (i32.const 454600) (local.get $tl) (i32.const ${S.a_inbox.offset}))
                (call $match_cmd (i32.const 454600) (local.get $tl) (i32.const ${S.a_list.offset})))
      (then (return (call $start_inbox_flow)))
    )

    ;; config / setup <email> <password...>
    (if (i32.or (call $match_cmd (i32.const 454600) (local.get $tl) (i32.const ${S.a_config.offset}))
                (call $match_cmd (i32.const 454600) (local.get $tl) (i32.const ${S.a_setup.offset})))
      (then
        (local.set $i (if (result i32) (call $match_cmd (i32.const 454600) (local.get $tl) (i32.const ${S.a_config.offset})) (then (i32.const 6)) (else (i32.const 5))))
        (local.set $arg_p (i32.add (local.get $ts) (local.get $i)))
        (local.set $arg_l (i32.sub (local.get $tl) (local.get $i)))
        (call $try_split_email_pass (local.get $arg_p) (local.get $arg_l))
        (if (i32.or (i32.eqz (call $contains_char (i32.const 410150) (global.get $email_len) (i32.const 64)))
                    (i32.le_s (global.get $pass_len) (i32.const 0)))
          (then
            (call $zero_pass_buf)
            (return (call $call_ai_help (i32.const ${S.r_miss_cfg.offset}) (i32.const ${S.r_miss_cfg.len})))
          )
        )
        (return (call $start_config_flow))
      )
    )

    ;; read <id>
    (if (call $match_cmd (i32.const 454600) (local.get $tl) (i32.const ${S.a_read.offset}))
      (then
        (local.set $arg_p (i32.add (local.get $ts) (i32.const 4)))
        (local.set $arg_l (i32.sub (local.get $tl) (i32.const 4)))
        (loop $wrd (if (i32.and (i32.gt_s (local.get $arg_l) (i32.const 0)) (call $is_ws (i32.load8_u (local.get $arg_p))))
          (then (local.set $arg_p (i32.add (local.get $arg_p) (i32.const 1))) (local.set $arg_l (i32.sub (local.get $arg_l) (i32.const 1))) (br $wrd))))
        (if (i32.le_s (local.get $arg_l) (i32.const 0))
          (then (return (call $call_ai_help (i32.const ${S.r_miss_id.offset}) (i32.const ${S.r_miss_id.len}))))
        )
        (if (i32.gt_s (local.get $arg_l) (i32.const 120)) (then (local.set $arg_l (i32.const 120))))
        (memory.copy (i32.const 410750) (local.get $arg_p) (local.get $arg_l))
        (global.set $id_len (local.get $arg_l))
        (return (call $start_read_flow))
      )
    )

    ;; send <to> | <subject> | <body>
    (if (call $match_cmd (i32.const 454600) (local.get $tl) (i32.const ${S.a_send.offset}))
      (then
        (local.set $arg_p (i32.add (local.get $ts) (i32.const 4)))
        (local.set $arg_l (i32.sub (local.get $tl) (i32.const 4)))
        (loop $wsd (if (i32.and (i32.gt_s (local.get $arg_l) (i32.const 0)) (call $is_ws (i32.load8_u (local.get $arg_p))))
          (then (local.set $arg_p (i32.add (local.get $arg_p) (i32.const 1))) (local.set $arg_l (i32.sub (local.get $arg_l) (i32.const 1))) (br $wsd))))
        (local.set $pipe1 (i32.const -1))
        (local.set $pipe2 (i32.const -1))
        (local.set $i (i32.const 0))
        (loop $fp
          (if (i32.lt_s (local.get $i) (local.get $arg_l))
            (then
              (if (i32.eq (i32.load8_u (i32.add (local.get $arg_p) (local.get $i))) (i32.const 124))
                (then
                  (if (i32.lt_s (local.get $pipe1) (i32.const 0)) (then (local.set $pipe1 (local.get $i)))
                  (else (if (i32.lt_s (local.get $pipe2) (i32.const 0)) (then (local.set $pipe2 (local.get $i))))))
                )
              )
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $fp)
            )
          )
        )
        (if (i32.lt_s (local.get $pipe1) (i32.const 0))
          (then (return (call $call_ai_help (i32.const ${S.r_miss_send.offset}) (i32.const ${S.r_miss_send.len}))))
        )
        (local.set $s (local.get $arg_p))
        (local.set $e (i32.add (local.get $arg_p) (local.get $pipe1)))
        (loop $rto (if (i32.and (i32.gt_u (local.get $e) (local.get $s)) (call $is_ws (i32.load8_u (i32.sub (local.get $e) (i32.const 1))))) (then (local.set $e (i32.sub (local.get $e) (i32.const 1))) (br $rto))))
        (global.set $to_len (i32.sub (local.get $e) (local.get $s)))
        (if (i32.gt_s (global.get $to_len) (i32.const 240)) (then (global.set $to_len (i32.const 240))))
        (memory.copy (i32.const 410900) (local.get $s) (global.get $to_len))

        (local.set $s (i32.add (local.get $arg_p) (i32.add (local.get $pipe1) (i32.const 1))))
        (local.set $e (if (result i32) (i32.ge_s (local.get $pipe2) (i32.const 0))
          (then (i32.add (local.get $arg_p) (local.get $pipe2)))
          (else (i32.add (local.get $arg_p) (local.get $arg_l)))))
        (loop $ls2 (if (i32.and (i32.lt_u (local.get $s) (local.get $e)) (call $is_ws (i32.load8_u (local.get $s)))) (then (local.set $s (i32.add (local.get $s) (i32.const 1))) (br $ls2))))
        (loop $rs2 (if (i32.and (i32.gt_u (local.get $e) (local.get $s)) (call $is_ws (i32.load8_u (i32.sub (local.get $e) (i32.const 1))))) (then (local.set $e (i32.sub (local.get $e) (i32.const 1))) (br $rs2))))
        (global.set $subj_len (i32.sub (local.get $e) (local.get $s)))
        (if (i32.gt_s (global.get $subj_len) (i32.const 1000)) (then (global.set $subj_len (i32.const 1000))))
        (memory.copy (i32.const 411200) (local.get $s) (global.get $subj_len))

        (if (i32.ge_s (local.get $pipe2) (i32.const 0))
          (then
            (local.set $s (i32.add (local.get $arg_p) (i32.add (local.get $pipe2) (i32.const 1))))
            (local.set $e (i32.add (local.get $arg_p) (local.get $arg_l)))
            (loop $lbd (if (i32.and (i32.lt_u (local.get $s) (local.get $e)) (call $is_ws (i32.load8_u (local.get $s)))) (then (local.set $s (i32.add (local.get $s) (i32.const 1))) (br $lbd))))
            (global.set $body_len (i32.sub (local.get $e) (local.get $s)))
            (if (i32.gt_s (global.get $body_len) (i32.const 30000)) (then (global.set $body_len (i32.const 30000))))
            (memory.copy (i32.const 412300) (local.get $s) (global.get $body_len))
          )
        )
        (if (i32.eqz (call $contains_char (i32.const 410900) (global.get $to_len) (i32.const 64)))
          (then (return (call $call_ai_help (i32.const ${S.r_miss_send.offset}) (i32.const ${S.r_miss_send.len}))))
        )
        (return (call $start_send_flow))
      )
    )

    ;; Fallback plain text -> status
    (call $start_status_flow)
  )

  ;; ── Resume Handler ───────────────────────────────────────────────────

  (func $save_res (param $res_ptr i32) (param $res_len i32)
    (local $n i32)
    (local.set $n (local.get $res_len))
    (if (i32.gt_s (local.get $n) (i32.const 495000)) (then (local.set $n (i32.const 495000))))
    (if (i32.gt_s (local.get $n) (i32.const 0))
      (then (memory.copy (i32.const 1260000) (local.get $res_ptr) (local.get $n)))
    )
    (global.set $saved_res_len (local.get $n))
  )

  (func $extract_err (param $res_ptr i32) (param $res_len i32)
    (local $el i32)
    (local.set $el (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_error.offset}) (i32.const 448000) (i32.const 900)))
    (if (i32.lt_s (local.get $el) (i32.const 0)) (then (local.set $el (i32.const 0))))
    (global.set $err_len (local.get $el))
  )

  (func $handle_resume (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $ok i32)
    (local $v i32)

    ;; STATE 10: Status live IMAP check result -> Instant English Flutter UI card (0 AI tokens)
    (if (i32.eq (global.get $g_state) (i32.const 10))
      (then
        (call $save_res (local.get $res_ptr) (local.get $res_len))
        (local.set $ok (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})))
        (if (i32.eq (local.get $ok) (i32.const 1))
          (then
            (global.set $g_verified (i32.const 1))
            (global.set $g_op_ok (i32.const 1))
            (global.set $err_len (i32.const 0))
            (local.set $v (call $extract_json_int (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_unread_cnt.offset})))
            (global.set $g_unread_cnt (if (result i32) (i32.ge_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 0))))
            (local.set $v (call $extract_json_int (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_total_cnt.offset})))
            (global.set $g_total_cnt (if (result i32) (i32.ge_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 0))))
          )
          (else
            (global.set $g_verified (i32.const 0))
            (global.set $g_op_ok (i32.const 0))
            (call $extract_err (local.get $res_ptr) (local.get $res_len))
          )
        )
        (return (call $render_status_ui))
      )
    )

    ;; STATE 11: Config response -> Instant English Flutter UI card (0 AI tokens)
    (if (i32.eq (global.get $g_state) (i32.const 11))
      (then
        (call $save_res (local.get $res_ptr) (local.get $res_len))
        (local.set $ok (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})))
        (if (i32.eq (local.get $ok) (i32.const 1))
          (then
            (global.set $g_op_ok (i32.const 1))
            (global.set $err_len (i32.const 0))
            (local.set $v (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_email.offset}) (i32.const 410150) (i32.const 240)))
            (if (i32.gt_s (local.get $v) (i32.const 0)) (then (global.set $email_len (local.get $v))))
            (local.set $v (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_provider.offset}) (i32.const 449200) (i32.const 120)))
            (global.set $prov_len (if (result i32) (i32.gt_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 0))))
          )
          (else
            (global.set $g_op_ok (i32.const 0))
            (global.set $prov_len (i32.const 0))
            (call $extract_err (local.get $res_ptr) (local.get $res_len))
          )
        )
        (return (call $render_config_ui))
      )
    )

    ;; STATE 12: Inbox response -> Compact JSON for conversational AI, short natural text for direct /gmail inbox
    (if (i32.eq (global.get $g_state) (i32.const 12))
      (then
        (call $save_res (local.get $res_ptr) (local.get $res_len))
        (local.set $ok (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})))
        (if (i32.eq (local.get $ok) (i32.const 1))
          (then
            (global.set $g_op_ok (i32.const 1))
            (global.set $err_len (i32.const 0))
            (local.set $v (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_account.offset}) (i32.const 447000) (i32.const 240)))
            (if (i32.gt_s (local.get $v) (i32.const 0)) (then (global.set $se_len (local.get $v))))
            (local.set $v (call $extract_json_int (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_unread_cnt.offset})))
            (global.set $g_unread_cnt (if (result i32) (i32.ge_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 0))))
            (local.set $v (call $extract_json_int (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_total_cnt.offset})))
            (global.set $g_total_cnt (if (result i32) (i32.ge_s (local.get $v) (i32.const 0)) (then (local.get $v)) (else (i32.const 0))))
          )
          (else
            (global.set $g_op_ok (i32.const 0))
            (global.set $g_total_cnt (i32.const 0))
            (call $extract_err (local.get $res_ptr) (local.get $res_len))
          )
        )
        (if (global.get $g_is_json) (then (return (call $render_inbox_json))))
        (return (call $call_ai_inbox_direct))
      )
    )

    ;; STATE 13: Read response -> 0 AI tokens! Compact JSON for AI mode, formatted English text for direct /gmail read
    (if (i32.eq (global.get $g_state) (i32.const 13))
      (then
        (call $save_res (local.get $res_ptr) (local.get $res_len))
        (local.set $ok (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})))
        (if (i32.eq (local.get $ok) (i32.const 1))
          (then (global.set $g_op_ok (i32.const 1)) (global.set $err_len (i32.const 0)))
          (else (global.set $g_op_ok (i32.const 0)) (call $extract_err (local.get $res_ptr) (local.get $res_len)))
        )
        (if (global.get $g_is_json) (then (return (call $render_read_json))))
        (return (call $render_read_direct))
      )
    )

    ;; STATE 14: Send response -> Compact JSON for conversational AI, short natural text for direct /gmail send
    (if (i32.eq (global.get $g_state) (i32.const 14))
      (then
        (call $save_res (local.get $res_ptr) (local.get $res_len))
        (local.set $ok (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})))
        (if (i32.eq (local.get $ok) (i32.const 1))
          (then (global.set $g_op_ok (i32.const 1)) (global.set $err_len (i32.const 0)))
          (else (global.set $g_op_ok (i32.const 0)) (call $extract_err (local.get $res_ptr) (local.get $res_len)))
        )
        (if (global.get $g_is_json) (then (return (call $render_send_json))))
        (return (call $call_ai_send_direct))
      )
    )

    ;; STATE 15: Disconnect response -> Compact JSON for conversational AI, short natural text for direct /gmail disconnect
    (if (i32.eq (global.get $g_state) (i32.const 15))
      (then
        (call $save_res (local.get $res_ptr) (local.get $res_len))
        (local.set $ok (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})))
        (if (i32.eq (local.get $ok) (i32.const 1))
          (then (global.set $g_op_ok (i32.const 1)) (global.set $err_len (i32.const 0)))
          (else (global.set $g_op_ok (i32.const 0)) (call $extract_err (local.get $res_ptr) (local.get $res_len)))
        )
        (if (global.get $g_is_json) (then (return (call $render_disconnect_json))))
        (return (call $call_ai_disc_direct))
      )
    )

    ;; STATES 22..26: Direct-mode AI complete finished
    (global.set $ai_text_len (i32.const 0))
    (if (i32.eq (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})) (i32.const 1))
      (then
        (local.set $v (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_text.offset}) (i32.const 480000) (i32.const 12000)))
        (if (i32.gt_s (local.get $v) (i32.const 0)) (then (global.set $ai_text_len (local.get $v))))
      )
    )
    (if (i32.eq (global.get $g_state) (i32.const 22)) (then (return (call $render_inbox_direct))))
    (if (i32.eq (global.get $g_state) (i32.const 24)) (then (return (call $render_direct_with_fb (i32.const ${S.en_sent_ok.offset})))))
    (if (i32.eq (global.get $g_state) (i32.const 26)) (then (return (call $render_direct_with_fb (i32.const ${S.en_disc_ok.offset})))))
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
console.log('Wrote mail plugin.wat (' + wat.length + ' chars, staticPtr=' + staticPtr + ')');

execSync(`wat2wasm "${watPath}" -o "${wasmPath}"`, { stdio: 'inherit' });
const wasmBytes = fs.readFileSync(wasmPath);
const wasmSha256 = crypto.createHash('sha256').update(wasmBytes).digest('hex');
console.log('Compiled mail plugin.wasm (' + wasmBytes.length + ' bytes), sha256=' + wasmSha256);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.wasmSha256 = wasmSha256;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('Updated mail plugin.json wasmSha256.');

// ── Automated Comprehensive WASM Test Harness ─────────────────────────────

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
}

async function runTests() {
  const mod = await WebAssembly.compile(wasmBytes);

  async function execPlugin(inputStr, syncHandler, asyncHandler) {
    let memRef;
    let pending = null;
    const instance = await WebAssembly.instantiate(mod, {
      chattree: {
        host_call: (reqPtr, reqLen, resPtr, resMaxLen) => {
          const reqStr = Buffer.from(memRef.buffer, reqPtr, reqLen).toString('utf8');
          const req = JSON.parse(reqStr);
          if (req.api === 'storage') {
            const resp = syncHandler(req);
            const buf = Buffer.from(JSON.stringify(resp), 'utf8');
            new Uint8Array(memRef.buffer).set(buf, resPtr);
            return buf.length;
          }
          pending = { req, resPtr, resMaxLen };
          return 0;
        },
      },
    });
    memRef = instance.exports.memory;
    const u8 = new Uint8Array(memRef.buffer);
    const inBuf = Buffer.from(inputStr, 'utf8');
    u8.set(inBuf, 0);

    let rc = instance.exports.mail_entry(0, inBuf.length);
    let hops = 0;
    while (rc === 0 && pending !== null) {
      hops++;
      assert(hops <= 15, 'Too many async hops');
      const { req, resPtr, resMaxLen } = pending;
      pending = null;
      const respObj = await asyncHandler(req, hops);
      const resBuf = Buffer.from(JSON.stringify(respObj), 'utf8');
      assert(resBuf.length <= resMaxLen, 'Response exceeds resMaxLen');
      new Uint8Array(memRef.buffer).set(resBuf, resPtr);
      rc = instance.exports.resume(resPtr, resBuf.length);
    }
    assert(rc > 0, 'Expected positive outputLen, got ' + rc);
    const outStr = Buffer.from(memRef.buffer, 65536, rc).toString('utf8');
    return JSON.parse(outStr);
  }

  // Test 1: Bare /gmail ("lang=es") when NOT configured -> 0 async hops, 0 AI tokens, orange English setup card
  {
    const storage = {};
    const out = await execPlugin(
      'lang=es',
      (req) => ({ success: true, data: { key: req.payload.key, value: storage[req.payload.key] || null, exists: !!storage[req.payload.key] } }),
      async (req) => { throw new Error('Unconfigured bare /gmail must make 0 async calls: ' + JSON.stringify(req)); }
    );
    assert(out.type === 'ui' && out.ui.title === 'Gmail Setup' && out.ui.badge === 'NOT CONFIGURED' && out.ui.badgeColor === 'orange' && out.ui.hideText === true, 'English orange setup card');
    const btns = out.ui.elements[4].buttons;
    assert(btns[0].label === 'Help' && btns[0].value === '/gmail help', 'Button 1 is Help (no raw command label)');
    assert(btns[1].label === 'Check Status' && btns[1].value === '/gmail', 'Button 2 is Check Status');
  }

  // Test 2: Conversational /gmail config ("api":"gmail"!) -> routes to "api":"email", strips spaces, 0 AI calls, English connected card
  {
    const asyncCalls = [];
    const marketplaceInput = JSON.stringify({
      api: 'gmail',
      command: 'gmail',
      toolId: 'com.chattree.official.gmail.manager',
      operation: 'config',
      payload: {
        email: 'user@gmail.com',
        password: 'abcd efgh ijkl mnop',
        imaphost: 'imap.gmail.com',
        smtpport: 465,
        lang: 'es',
      },
    });
    const out = await execPlugin(
      marketplaceInput,
      () => ({ success: true, data: { exists: false } }),
      async (req) => {
        asyncCalls.push(req);
        if (req.api === 'email' && req.operation === 'config') {
          assert(req.payload.email === 'user@gmail.com', 'Email preserved');
          assert(req.payload.password === 'abcdefghijklmnop', 'Spaces stripped from App Password');
          assert(req.payload.imapHost === 'imap.gmail.com' && req.payload.smtpPort === '465', 'CamelCase hosts/ports restored');
          return {
            success: true,
            data: { configured: true, email: 'user@gmail.com', provider: 'Google Gmail', message: 'Connected' },
          };
        }
        throw new Error('Unexpected call (must NOT call AI): ' + JSON.stringify(req));
      }
    );
    assert(asyncCalls.length === 1 && asyncCalls[0].api === 'email' && asyncCalls[0].operation === 'config', 'Critical: only 1 email.config call (0 AI tokens)');
    assert(out.type === 'ui' && out.ui.title === 'Gmail Connected' && out.ui.badge === 'CONNECTED' && out.ui.badgeColor === 'green', 'English connected card');
    assert(!JSON.stringify(out).includes('abcdefgh'), 'Password must never appear in output');
    const btns = out.ui.elements[2].buttons;
    assert(btns[0].label === 'View Inbox' && btns[0].value === '/gmail inbox', 'View Inbox button');
    assert(btns[1].label === 'Check Status' && btns[1].value === '/gmail', 'Check Status button');
  }

  // Test 3: Direct plain-text config user@gmail.com abcd efgh ijkl mnop lang=es -> 0 AI calls
  {
    const out = await execPlugin(
      'config user@gmail.com abcd efgh ijkl mnop lang=es',
      () => ({ success: true, data: { exists: false } }),
      async (req) => {
        if (req.api === 'email' && req.operation === 'config') {
          assert(req.payload.email === 'user@gmail.com' && req.payload.password === 'abcdefghijklmnop', 'Direct 4-group app password stripped');
          return { success: true, data: { configured: true, email: 'user@gmail.com', provider: 'Google Gmail' } };
        }
        throw new Error('Unexpected call');
      }
    );
    assert(out.type === 'ui' && out.ui.icon === 'check' && out.ui.title === 'Gmail Connected', 'Plain-text config succeeds with 0 AI calls');
  }

  // Test 4: Bare /gmail configured & IMAP verified + IMAP auth failure -> 0 AI calls, English buttons
  {
    const storage = {
      chattree_email_account: 'user@gmail.com',
      chattree_email_imap_host: 'imap.gmail.com',
      chattree_email_smtp_host: 'smtp.gmail.com',
      chattree_email_smtp_port: '465',
    };
    const out = await execPlugin(
      'lang=es',
      (req) => ({ success: true, data: { key: req.payload.key, value: storage[req.payload.key] || null, exists: !!storage[req.payload.key] } }),
      async (req) => {
        assert(req.api === 'email' && req.operation === 'inbox', 'Only calls email.inbox (0 AI tokens)');
        return { success: true, data: { status: 'success', account: 'user@gmail.com', unread_count: 3, total_count: 8, emails: [] } };
      }
    );
    assert(out.type === 'ui' && out.ui.title === 'Gmail Status' && out.ui.badge === 'CONNECTED' && out.ui.badgeColor === 'green', 'Green English status card');
    const kv = out.ui.elements[0].items;
    assert(kv.some((x) => x.key === 'Account' && x.value === 'user@gmail.com') && kv.some((x) => x.key === 'Unread' && x.value === '3'), 'Account & Unread in card');
    const btns = out.ui.elements[2].buttons;
    assert(btns.length === 3 && btns[0].label === 'View Inbox' && btns[1].label === 'Help' && btns[2].label === 'Disconnect' && btns[2].confirm === true, 'English action labels: View Inbox, Help, Disconnect');

    // Failed IMAP verification
    const outErr = await execPlugin(
      'lang=en',
      (req) => ({ success: true, data: { key: req.payload.key, value: storage[req.payload.key] || null, exists: !!storage[req.payload.key] } }),
      async (req) => {
        assert(req.api === 'email' && req.operation === 'inbox', 'Only email.inbox');
        return { success: false, error: 'Authentication failed' };
      }
    );
    assert(outErr.type === 'ui' && outErr.ui.badgeColor === 'red' && outErr.ui.title === 'Connection Error' && outErr.ui.badge === 'AUTH FAILED', 'Red English error card');
    assert(outErr.ui.elements[4].buttons[0].label === 'Retry' && outErr.ui.elements[4].buttons[1].label === 'Disconnect', 'Retry and Disconnect buttons');
  }

  // Test 5: Conversational JSON inbox / read (rewritten as get) / send / disconnect -> compact JSON (NO Flutter UI, 0 AI calls!)
  {
    const outInbox = await execPlugin(
      JSON.stringify({ api: 'gmail', operation: 'inbox', payload: { lang: 'es' } }),
      () => ({ success: true, data: { exists: false } }),
      async (req) => {
        assert(req.api === 'email' && req.operation === 'inbox', 'Only email.inbox (0 AI tokens)');
        return {
          success: true,
          data: {
            status: 'success',
            account: 'user@gmail.com',
            unread_count: 1,
            total_count: 2,
            emails: [
              { id: '12', from: 'Ana <ana@test.com>', subject: 'Invoice Nov', date: '2026-11-18 10:00', unread: true, snippet: 'Attached invoice.' },
              { id: '11', from: 'Team <team@test.com>', subject: 'Summary', date: '2026-11-17 09:00', unread: false, snippet: 'All set.' },
            ],
          },
        };
      }
    );
    assert(outInbox.type === undefined && outInbox.ok === true && outInbox.unread === 1 && outInbox.emails.length === 2, 'Conversational inbox returns compact JSON for natural language');

    const outRead = await execPlugin(
      JSON.stringify({ api: 'gmail', operation: 'get', payload: { id: '12', lang: 'es' } }),
      () => ({ success: true, data: { exists: false } }),
      async (req) => {
        assert(req.api === 'email' && req.operation === 'read' && req.payload.id === '12', 'Normalized get -> email.read (0 AI tokens)');
        return {
          success: true,
          data: { id: '12', from: 'Ana <ana@test.com>', to: 'user@gmail.com', subject: 'Invoice Nov', date: '2026-11-18 10:00', body: 'Hello,\nInvoice attached.' },
        };
      }
    );
    assert(outRead.type === undefined && outRead.ok === true && outRead.body.includes('Invoice attached.'), 'Conversational read returns compact JSON');

    const outSend = await execPlugin(
      JSON.stringify({ api: 'gmail', operation: 'send', payload: { to: 'alex@example.com', subject: 'Hi', body: 'Body', lang: 'es' } }),
      () => ({ success: true, data: { exists: false } }),
      async (req) => {
        assert(req.api === 'email' && req.operation === 'send', 'Only email.send (0 AI tokens)');
        return { success: true, data: { sent: true, to: 'alex@example.com', subject: 'Hi' } };
      }
    );
    assert(outSend.type === undefined && outSend.ok === true && outSend.sent === true, 'Conversational send returns compact JSON');

    const outDisc = await execPlugin(
      JSON.stringify({ api: 'gmail', operation: 'disconnect', payload: { lang: 'en' } }),
      () => ({ success: true, data: { exists: false } }),
      async (req) => {
        assert(req.api === 'email' && req.operation === 'disconnect', 'Only email.disconnect (0 AI tokens)');
        return { success: true, data: { disconnected: true } };
      }
    );
    assert(outDisc.type === undefined && outDisc.ok === true && outDisc.disconnected === true, 'Conversational disconnect returns compact JSON');
  }

  // Test 6: Direct slash/button commands -> natural plain text (type:"direct", NO Flutter UI) + English offline fallbacks
  {
    // Button tap "View Inbox" -> /gmail inbox -> short AI text summary (not UI card)
    const outInbBtn = await execPlugin(
      'inbox lang=es',
      () => ({ success: true, data: { exists: false } }),
      async (req) => {
        if (req.api === 'email' && req.operation === 'inbox') {
          return { success: true, data: { account: 'user@gmail.com', unread_count: 1, total_count: 1, emails: [{ id: '12', from: 'Ana', subject: 'Invoice', date: '2026-11-18', unread: true, snippet: '' }] } };
        }
        if (req.api === 'ai' && req.operation === 'complete') {
          assert(req.payload.systemPrompt.includes('"es"'), 'Direct inbox AI respects lang');
          return { success: true, data: { text: 'Tienes 1 correo nuevo: [12] Invoice de Ana.' } };
        }
        throw new Error('Unexpected direct inbox call');
      }
    );
    assert(outInbBtn.type === 'direct' && outInbBtn.displayText.includes('[12]'), 'Direct inbox returns natural text');

    // Direct /gmail read 12 -> 0 AI tokens, formatted English headers + body
    const outRdDir = await execPlugin(
      'read 12 lang=es',
      () => ({ success: true, data: { exists: false } }),
      async (req) => {
        assert(req.api === 'email' && req.operation === 'read', 'Direct read makes 0 AI calls');
        return { success: true, data: { id: '12', from: 'Ana', to: 'user@gmail.com', subject: 'Invoice', date: '2026-11-18', body: 'Attached.' } };
      }
    );
    assert(outRdDir.type === 'direct' && outRdDir.displayText.includes('From: Ana') && outRdDir.displayText.includes('Attached.'), 'Direct read formats email with 0 AI tokens');

    // Direct /gmail help + offline English fallback
    const outHelpFb = await execPlugin(
      'help lang=en',
      () => ({ success: true, data: { exists: false } }),
      async () => ({ success: false, error: 'AI offline' })
    );
    assert(outHelpFb.type === 'direct' && outHelpFb.displayText.includes('Gmail commands:'), 'English offline help fallback');
  }

  console.log('ALL GMAIL WASM TESTS PASSED (6/6 suites)!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
