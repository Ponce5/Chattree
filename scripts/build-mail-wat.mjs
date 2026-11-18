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

// AI JSON output keys
S.ak_intro = registerData('ak_intro', 'intro');
S.ak_ct = registerData('ak_ct', 'card_title');
S.ak_cs = registerData('ak_cs', 'card_subtitle');
S.ak_badge = registerData('ak_badge', 'badge');
S.ak_guide = registerData('ak_guide', 'guide');
S.ak_ls = registerData('ak_ls', 'lbl_status');
S.ak_vs = registerData('ak_vs', 'val_status');
S.ak_la = registerData('ak_la', 'lbl_account');
S.ak_li = registerData('ak_li', 'lbl_imap');
S.ak_lsmtp = registerData('ak_lsmtp', 'lbl_smtp');
S.ak_lu = registerData('ak_lu', 'lbl_unread');
S.ak_lp = registerData('ak_lp', 'lbl_provider');
S.ak_lc = registerData('ak_lc', 'lbl_cmd');
S.ak_lf = registerData('ak_lf', 'lbl_from');
S.ak_lt = registerData('ak_lt', 'lbl_to');
S.ak_lsub = registerData('ak_lsub', 'lbl_subject');
S.ak_ld = registerData('ak_ld', 'lbl_date');
S.ak_empty = registerData('ak_empty', 'empty_text');
S.ak_utag = registerData('ak_utag', 'unread_tag');
S.ak_b1 = registerData('ak_b1', 'btn_1');
S.ak_b2 = registerData('ak_b2', 'btn_2');
S.ak_b3 = registerData('ak_b3', 'btn_3');
S.ak_err = registerData('ak_err', 'err_text');

// Defaults & tokens
S.def_en = registerData('def_en', 'en');
S.def_gmail = registerData('def_gmail', 'Gmail');
S.def_ok = registerData('def_ok', 'OK');
S.def_err = registerData('def_err', 'ERR');
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
S.def_dot = registerData('def_dot', ' \u2022 ');
S.def_colon = registerData('def_colon', ':');
S.def_lbr = registerData('def_lbr', '[');
S.def_rbr = registerData('def_rbr', '] ');
S.def_star = registerData('def_star', '\u25cf ');

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

// AI Request JSON fragments
S.ai_req_p1 = registerData(
  'ai_req_p1',
  '{"api":"ai","operation":"complete","payload":{"systemPrompt":"You are Chattree Gmail assistant. Write natural, accurate text strictly in language code \\"'
);
S.ai_req_p2 = registerData(
  'ai_req_p2',
  '\\". When JSON is requested, output ONLY one valid flat JSON object with the exact requested keys and plain-text values (no markdown *, #, backticks, or emojis). Never invent data or credentials not in DATA.","prompt":"'
);
S.ai_req_p3 = registerData('ai_req_p3', '","maxTokens":420,"temperature":0.2,"timeoutMs":18000}}');

S.ai_sys_help_p1 = registerData(
  'ai_sys_help_p1',
  '{"api":"ai","operation":"complete","payload":{"systemPrompt":"You are Chattree Gmail assistant. Reply strictly in language code \\"'
);
S.ai_sys_help_p2 = registerData(
  'ai_sys_help_p2',
  '\\". Never use hardcoded fixed text; explain clearly and naturally in the user language.","prompt":"'
);

// AI Prompts
S.p_st_hdr = registerData('p_st_hdr', 'DATA:\nop=gmail_status\nconfigured=');
S.p_verified = registerData('p_verified', '\nimap_verified=');
S.p_account = registerData('p_account', '\naccount=');
S.p_imap = registerData('p_imap', '\nimap=');
S.p_smtp = registerData('p_smtp', '\nsmtp=');
S.p_unread = registerData('p_unread', '\nunread_count=');
S.p_total = registerData('p_total', '\ntotal_count=');
S.p_err = registerData('p_err', '\nerror=');
S.p_st_ask_uncfg = registerData(
  'p_st_ask_uncfg',
  '\nReturn ONLY JSON with keys: intro (1 friendly sentence explaining Gmail is not configured yet), card_title, card_subtitle, badge, lbl_status, val_status, lbl_cmd, guide (concise step-by-step setup guide: enable Google 2-Step Verification, generate a 16-char App Password at myaccount.google.com/security, run /gmail config <email> <16-char-password>), btn_1 (label for Help).'
);
S.p_st_ask_ok = registerData(
  'p_st_ask_ok',
  '\nReturn ONLY JSON with keys: intro (1 sentence confirming Gmail is connected and IMAP verified), card_title, card_subtitle, badge, lbl_status, val_status, lbl_account, lbl_imap, lbl_smtp, lbl_unread, btn_1 (Inbox), btn_2 (Help), btn_3 (Disconnect).'
);
S.p_st_ask_err = registerData(
  'p_st_ask_err',
  '\nReturn ONLY JSON with keys: intro (1 sentence explaining saved credentials failed IMAP check), card_title, card_subtitle, badge, lbl_status, val_status, lbl_account, lbl_imap, err_text (clear advice to verify App Password and re-run /gmail config), btn_1 (Retry), btn_2 (Disconnect).'
);

S.p_cfg_hdr = registerData('p_cfg_hdr', 'DATA:\nop=gmail_config\nsuccess=');
S.p_prov = registerData('p_prov', '\nprovider=');
S.p_cfg_ask = registerData(
  'p_cfg_ask',
  '\nReturn ONLY JSON with keys: intro (1 sentence), card_title, card_subtitle, badge, lbl_account, lbl_provider, lbl_status, val_status, err_text (if failed, explain Google App Password / IMAP auth fix), btn_1 (Inbox if ok, Help if failed), btn_2 (Status if ok).'
);

S.p_inb_hdr = registerData('p_inb_hdr', 'DATA:\nop=gmail_inbox\nsuccess=');
S.p_preview = registerData('p_preview', '\nemails=');
S.p_inb_ask = registerData(
  'p_inb_ask',
  '\nReturn ONLY JSON with keys: intro (1 concise summary sentence mentioning unread count or highlights), card_title, card_subtitle, badge, empty_text, unread_tag (short word like UNREAD), btn_1 (Refresh), btn_2 (Status), err_text.'
);

S.p_rd_hdr = registerData('p_rd_hdr', 'DATA:\nop=gmail_read\nsuccess=');
S.p_from = registerData('p_from', '\nfrom=');
S.p_to = registerData('p_to', '\nto=');
S.p_subj = registerData('p_subj', '\nsubject=');
S.p_date = registerData('p_date', '\ndate=');
S.p_body = registerData('p_body', '\nbody_preview=');
S.p_rd_ask = registerData(
  'p_rd_ask',
  '\nReturn ONLY JSON with keys: intro (1 concise summary sentence of the email), card_title, card_subtitle, badge, lbl_from, lbl_to, lbl_subject, lbl_date, btn_1 (Inbox), err_text.'
);

S.p_sd_hdr = registerData('p_sd_hdr', 'DATA:\nop=gmail_send\nsuccess=');
S.p_sd_ask = registerData(
  'p_sd_ask',
  '\nReturn ONLY JSON with keys: intro (1 sentence), card_title, card_subtitle, badge, lbl_to, lbl_subject, lbl_status, val_status, err_text, btn_1 (Inbox).'
);

S.p_dc_hdr = registerData('p_dc_hdr', 'DATA:\nop=gmail_disconnect\nsuccess=');
S.p_dc_ask = registerData(
  'p_dc_ask',
  '\nReturn ONLY JSON with keys: intro (1 sentence), card_title, card_subtitle, badge, lbl_status, val_status, err_text, btn_1 (Status).'
);

S.p_help_1 = registerData('p_help_1', 'Reason: ');
S.p_help_2 = registerData(
  'p_help_2',
  '. Explain clearly in the user language how to set up and use Gmail in Chattree: (1) Enable Google 2-Step Verification at myaccount.google.com/security and create a 16-letter App Password; (2) Connect using /gmail config <email> <app_password> (works with 4 space-separated groups like abcd efgh ijkl mnop); (3) Check connection status anytime by typing /gmail alone; (4) Read inbox with /gmail inbox or natural language, open an email with /gmail read <id>, send with /gmail send <to> | <subject> | <body> or natural language, and unlink with /gmail disconnect. If Reason is missing_config, missing_id, or missing_send, clearly explain which parameters were missing and show an example.'
);

// UI Card JSON Output Templates
S.ui_p1 = registerData('ui_p1', '{"type":"ui","displayText":"');
S.ui_p2 = registerData('ui_p2', '","ui":{"title":"');
S.ui_sub = registerData('ui_sub', '","subtitle":"');
S.ui_badge = registerData('ui_badge', '","badge":"');
S.ui_bc_green = registerData('ui_bc_green', '","badgeColor":"green","icon":"check","hideText":false,"elements":[');
S.ui_bc_orange = registerData('ui_bc_orange', '","badgeColor":"orange","icon":"warning","hideText":false,"elements":[');
S.ui_bc_red = registerData('ui_bc_red', '","badgeColor":"red","icon":"error","hideText":false,"elements":[');
S.ui_bc_blue = registerData('ui_bc_blue', '","badgeColor":"blue","icon":"info","hideText":false,"elements":[');
S.ui_bc_msg = registerData('ui_bc_msg', '","badgeColor":"green","icon":"message","hideText":false,"elements":[');
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

const dataLines = dataEntries
  .map((e) => `  (data (i32.const ${e.offset}) "${e.escaped}") ;; ${e.name} (len=${e.strLen})`)
  .join('\n');

const wat = `;; Chattree Official Gmail Plugin (v2.3.0)
;; Multilingual AI + Live Status Flutter UI + Native IMAP/SMTP Host API ('email' namespace)
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
  (global $reason_len (mut i32) (i32.const 0))
  (global $saved_res_len (mut i32) (i32.const 0))

  (global $ai_text_len (mut i32) (i32.const 0))
  (global $ai_intro_len (mut i32) (i32.const 0))
  (global $ai_ct_len (mut i32) (i32.const 0))
  (global $ai_cs_len (mut i32) (i32.const 0))
  (global $ai_badge_len (mut i32) (i32.const 0))
  (global $ai_guide_len (mut i32) (i32.const 0))
  (global $ai_ls_len (mut i32) (i32.const 0))
  (global $ai_vs_len (mut i32) (i32.const 0))
  (global $ai_la_len (mut i32) (i32.const 0))
  (global $ai_li_len (mut i32) (i32.const 0))
  (global $ai_lsmtp_len (mut i32) (i32.const 0))
  (global $ai_lu_len (mut i32) (i32.const 0))
  (global $ai_lp_len (mut i32) (i32.const 0))
  (global $ai_lc_len (mut i32) (i32.const 0))
  (global $ai_lf_len (mut i32) (i32.const 0))
  (global $ai_lt_len (mut i32) (i32.const 0))
  (global $ai_lsub_len (mut i32) (i32.const 0))
  (global $ai_ld_len (mut i32) (i32.const 0))
  (global $ai_empty_len (mut i32) (i32.const 0))
  (global $ai_utag_len (mut i32) (i32.const 0))
  (global $ai_b1_len (mut i32) (i32.const 0))
  (global $ai_b2_len (mut i32) (i32.const 0))
  (global $ai_b3_len (mut i32) (i32.const 0))
  (global $ai_err_len (mut i32) (i32.const 0))

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
        (return (call $call_ai_status))
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

  ;; ── AI Prompt Dispatchers ────────────────────────────────────────────

  (func $begin_ai_json_req (result i32)
    (local $p i32)
    (local.set $p (call $copy_zstr (i32.const ${S.ai_req_p1.offset}) (i32.const 560000)))
    (local.set $p (call $copy_json_esc (i32.const 410000) (global.get $lang_len) (local.get $p)))
    (call $copy_zstr (i32.const ${S.ai_req_p2.offset}) (local.get $p))
  )

  (func $call_ai_status (result i32)
    (local $p i32)
    (global.set $g_state (i32.const 20))
    (local.set $p (call $begin_ai_json_req))
    (local.set $p (call $copy_json_esc (i32.const ${S.p_st_hdr.offset}) (i32.const ${S.p_st_hdr.len}) (local.get $p)))
    (if (global.get $g_configured)
      (then (local.set $p (call $copy_zstr (i32.const ${S.def_true.offset}) (local.get $p))))
      (else (local.set $p (call $copy_zstr (i32.const ${S.def_false.offset}) (local.get $p))))
    )
    (if (global.get $g_configured)
      (then
        (local.set $p (call $copy_json_esc (i32.const ${S.p_verified.offset}) (i32.const ${S.p_verified.len}) (local.get $p)))
        (if (global.get $g_verified)
          (then (local.set $p (call $copy_zstr (i32.const ${S.def_true.offset}) (local.get $p))))
          (else (local.set $p (call $copy_zstr (i32.const ${S.def_false.offset}) (local.get $p))))
        )
        (local.set $p (call $copy_json_esc (i32.const ${S.p_account.offset}) (i32.const ${S.p_account.len}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 447000) (global.get $se_len) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const ${S.p_imap.offset}) (i32.const ${S.p_imap.len}) (local.get $p)))
        (if (i32.gt_s (global.get $si_len) (i32.const 0))
          (then (local.set $p (call $copy_json_esc (i32.const 447300) (global.get $si_len) (local.get $p))))
          (else (local.set $p (call $copy_zstr (i32.const ${S.def_imap_def.offset}) (local.get $p))))
        )
        (local.set $p (call $copy_json_esc (i32.const ${S.p_smtp.offset}) (i32.const ${S.p_smtp.len}) (local.get $p)))
        (if (i32.gt_s (global.get $ss_len) (i32.const 0))
          (then (local.set $p (call $copy_json_esc (i32.const 447600) (global.get $ss_len) (local.get $p))))
          (else (local.set $p (call $copy_zstr (i32.const ${S.def_smtp_def.offset}) (local.get $p))))
        )
        (if (global.get $g_verified)
          (then
            (local.set $p (call $copy_json_esc (i32.const ${S.p_unread.offset}) (i32.const ${S.p_unread.len}) (local.get $p)))
            (local.set $p (call $copy_int_str (global.get $g_unread_cnt) (local.get $p)))
            (local.set $p (call $copy_json_esc (i32.const ${S.p_total.offset}) (i32.const ${S.p_total.len}) (local.get $p)))
            (local.set $p (call $copy_int_str (global.get $g_total_cnt) (local.get $p)))
            (local.set $p (call $copy_json_esc (i32.const ${S.p_st_ask_ok.offset}) (i32.const ${S.p_st_ask_ok.len}) (local.get $p)))
          )
          (else
            (if (i32.gt_s (global.get $err_len) (i32.const 0))
              (then
                (local.set $p (call $copy_json_esc (i32.const ${S.p_err.offset}) (i32.const ${S.p_err.len}) (local.get $p)))
                (local.set $p (call $copy_json_esc (i32.const 448000) (call $utf8_clamp (i32.const 448000) (global.get $err_len) (i32.const 400)) (local.get $p)))
              )
            )
            (local.set $p (call $copy_json_esc (i32.const ${S.p_st_ask_err.offset}) (i32.const ${S.p_st_ask_err.len}) (local.get $p)))
          )
        )
      )
      (else
        (local.set $p (call $copy_json_esc (i32.const ${S.p_st_ask_uncfg.offset}) (i32.const ${S.p_st_ask_uncfg.len}) (local.get $p)))
      )
    )
    (local.set $p (call $copy_zstr (i32.const ${S.ai_req_p3.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 560000)))
  )

  (func $call_ai_config (result i32)
    (local $p i32)
    (global.set $g_state (i32.const 21))
    (local.set $p (call $begin_ai_json_req))
    (local.set $p (call $copy_json_esc (i32.const ${S.p_cfg_hdr.offset}) (i32.const ${S.p_cfg_hdr.len}) (local.get $p)))
    (if (global.get $g_op_ok)
      (then (local.set $p (call $copy_zstr (i32.const ${S.def_true.offset}) (local.get $p))))
      (else (local.set $p (call $copy_zstr (i32.const ${S.def_false.offset}) (local.get $p))))
    )
    (local.set $p (call $copy_json_esc (i32.const ${S.p_account.offset}) (i32.const ${S.p_account.len}) (local.get $p)))
    (local.set $p (call $copy_json_esc (i32.const 410150) (global.get $email_len) (local.get $p)))
    (if (i32.gt_s (global.get $prov_len) (i32.const 0))
      (then
        (local.set $p (call $copy_json_esc (i32.const ${S.p_prov.offset}) (i32.const ${S.p_prov.len}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 449200) (global.get $prov_len) (local.get $p)))
      )
    )
    (if (i32.gt_s (global.get $err_len) (i32.const 0))
      (then
        (local.set $p (call $copy_json_esc (i32.const ${S.p_err.offset}) (i32.const ${S.p_err.len}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 448000) (call $utf8_clamp (i32.const 448000) (global.get $err_len) (i32.const 400)) (local.get $p)))
      )
    )
    (local.set $p (call $copy_json_esc (i32.const ${S.p_cfg_ask.offset}) (i32.const ${S.p_cfg_ask.len}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.ai_req_p3.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 560000)))
  )

  (func $call_ai_inbox (result i32)
    (local $p i32)
    (local $shown i32)
    (local $fl i32)
    (local $sl i32)
    (global.set $g_state (i32.const 22))
    (local.set $p (call $begin_ai_json_req))
    (local.set $p (call $copy_json_esc (i32.const ${S.p_inb_hdr.offset}) (i32.const ${S.p_inb_hdr.len}) (local.get $p)))
    (if (global.get $g_op_ok)
      (then (local.set $p (call $copy_zstr (i32.const ${S.def_true.offset}) (local.get $p))))
      (else (local.set $p (call $copy_zstr (i32.const ${S.def_false.offset}) (local.get $p))))
    )
    (if (global.get $g_op_ok)
      (then
        (if (i32.gt_s (global.get $se_len) (i32.const 0))
          (then
            (local.set $p (call $copy_json_esc (i32.const ${S.p_account.offset}) (i32.const ${S.p_account.len}) (local.get $p)))
            (local.set $p (call $copy_json_esc (i32.const 447000) (global.get $se_len) (local.get $p)))
          )
        )
        (local.set $p (call $copy_json_esc (i32.const ${S.p_unread.offset}) (i32.const ${S.p_unread.len}) (local.get $p)))
        (local.set $p (call $copy_int_str (global.get $g_unread_cnt) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const ${S.p_total.offset}) (i32.const ${S.p_total.len}) (local.get $p)))
        (local.set $p (call $copy_int_str (global.get $g_total_cnt) (local.get $p)))
        (if (i32.gt_s (global.get $g_total_cnt) (i32.const 0))
          (then
            (local.set $p (call $copy_json_esc (i32.const ${S.p_preview.offset}) (i32.const ${S.p_preview.len}) (local.get $p)))
            (if (call $find_array_start (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_emails.offset}))
              (then
                (local.set $shown (i32.const 0))
                (loop $pl
                  (if (i32.and (i32.lt_s (local.get $shown) (i32.const 8))
                               (call $next_array_obj (i32.const 1260000) (global.get $saved_res_len)))
                    (then
                      (local.set $fl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_from.offset}) (i32.const 453400) (i32.const 64)))
                      (local.set $sl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_subject.offset}) (i32.const 453700) (i32.const 80)))
                      (if (i32.gt_s (local.get $shown) (i32.const 0))
                        (then (local.set $p (call $copy_zstr (i32.const ${S.jf_comma.offset}) (local.get $p))))
                      )
                      (if (i32.gt_s (local.get $sl) (i32.const 0))
                        (then (local.set $p (call $copy_json_esc (i32.const 453700) (local.get $sl) (local.get $p))))
                      )
                      (if (i32.gt_s (local.get $fl) (i32.const 0))
                        (then
                          (i32.store8 (local.get $p) (i32.const 40)) ;; '('
                          (local.set $p (i32.add (local.get $p) (i32.const 1)))
                          (local.set $p (call $copy_json_esc (i32.const 453400) (local.get $fl) (local.get $p)))
                          (i32.store8 (local.get $p) (i32.const 41)) ;; ')'
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
        )
      )
      (else
        (if (i32.gt_s (global.get $err_len) (i32.const 0))
          (then
            (local.set $p (call $copy_json_esc (i32.const ${S.p_err.offset}) (i32.const ${S.p_err.len}) (local.get $p)))
            (local.set $p (call $copy_json_esc (i32.const 448000) (call $utf8_clamp (i32.const 448000) (global.get $err_len) (i32.const 400)) (local.get $p)))
          )
        )
      )
    )
    (local.set $p (call $copy_json_esc (i32.const ${S.p_inb_ask.offset}) (i32.const ${S.p_inb_ask.len}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.ai_req_p3.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 560000)))
  )

  (func $call_ai_read (result i32)
    (local $p i32)
    (local $fl i32) (local $tl i32) (local $sl i32) (local $dl i32) (local $bl i32)
    (global.set $g_state (i32.const 23))
    (local.set $p (call $begin_ai_json_req))
    (local.set $p (call $copy_json_esc (i32.const ${S.p_rd_hdr.offset}) (i32.const ${S.p_rd_hdr.len}) (local.get $p)))
    (if (global.get $g_op_ok)
      (then (local.set $p (call $copy_zstr (i32.const ${S.def_true.offset}) (local.get $p))))
      (else (local.set $p (call $copy_zstr (i32.const ${S.def_false.offset}) (local.get $p))))
    )
    (if (global.get $g_op_ok)
      (then
        (local.set $fl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_from.offset}) (i32.const 453400) (i32.const 200)))
        (local.set $tl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_to.offset}) (i32.const 453700) (i32.const 200)))
        (local.set $sl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_subject.offset}) (i32.const 454000) (i32.const 120)))
        (local.set $dl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_date.offset}) (i32.const 454200) (i32.const 100)))
        (local.set $bl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_body.offset}) (i32.const 412300) (i32.const 4000)))
        (if (i32.gt_s (local.get $fl) (i32.const 0))
          (then
            (local.set $p (call $copy_json_esc (i32.const ${S.p_from.offset}) (i32.const ${S.p_from.len}) (local.get $p)))
            (local.set $p (call $copy_json_esc (i32.const 453400) (local.get $fl) (local.get $p)))
          )
        )
        (if (i32.gt_s (local.get $tl) (i32.const 0))
          (then
            (local.set $p (call $copy_json_esc (i32.const ${S.p_to.offset}) (i32.const ${S.p_to.len}) (local.get $p)))
            (local.set $p (call $copy_json_esc (i32.const 453700) (local.get $tl) (local.get $p)))
          )
        )
        (if (i32.gt_s (local.get $sl) (i32.const 0))
          (then
            (local.set $p (call $copy_json_esc (i32.const ${S.p_subj.offset}) (i32.const ${S.p_subj.len}) (local.get $p)))
            (local.set $p (call $copy_json_esc (i32.const 454000) (local.get $sl) (local.get $p)))
          )
        )
        (if (i32.gt_s (local.get $dl) (i32.const 0))
          (then
            (local.set $p (call $copy_json_esc (i32.const ${S.p_date.offset}) (i32.const ${S.p_date.len}) (local.get $p)))
            (local.set $p (call $copy_json_esc (i32.const 454200) (local.get $dl) (local.get $p)))
          )
        )
        (if (i32.gt_s (local.get $bl) (i32.const 0))
          (then
            (local.set $p (call $copy_json_esc (i32.const ${S.p_body.offset}) (i32.const ${S.p_body.len}) (local.get $p)))
            (local.set $p (call $copy_json_esc (i32.const 412300) (call $utf8_clamp (i32.const 412300) (local.get $bl) (i32.const 350)) (local.get $p)))
          )
        )
      )
      (else
        (if (i32.gt_s (global.get $err_len) (i32.const 0))
          (then
            (local.set $p (call $copy_json_esc (i32.const ${S.p_err.offset}) (i32.const ${S.p_err.len}) (local.get $p)))
            (local.set $p (call $copy_json_esc (i32.const 448000) (call $utf8_clamp (i32.const 448000) (global.get $err_len) (i32.const 400)) (local.get $p)))
          )
        )
      )
    )
    (local.set $p (call $copy_json_esc (i32.const ${S.p_rd_ask.offset}) (i32.const ${S.p_rd_ask.len}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.ai_req_p3.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 560000)))
  )

  (func $call_ai_send (result i32)
    (local $p i32)
    (global.set $g_state (i32.const 24))
    (local.set $p (call $begin_ai_json_req))
    (local.set $p (call $copy_json_esc (i32.const ${S.p_sd_hdr.offset}) (i32.const ${S.p_sd_hdr.len}) (local.get $p)))
    (if (global.get $g_op_ok)
      (then (local.set $p (call $copy_zstr (i32.const ${S.def_true.offset}) (local.get $p))))
      (else (local.set $p (call $copy_zstr (i32.const ${S.def_false.offset}) (local.get $p))))
    )
    (local.set $p (call $copy_json_esc (i32.const ${S.p_to.offset}) (i32.const ${S.p_to.len}) (local.get $p)))
    (local.set $p (call $copy_json_esc (i32.const 410900) (global.get $to_len) (local.get $p)))
    (local.set $p (call $copy_json_esc (i32.const ${S.p_subj.offset}) (i32.const ${S.p_subj.len}) (local.get $p)))
    (local.set $p (call $copy_json_esc (i32.const 411200) (call $utf8_clamp (i32.const 411200) (global.get $subj_len) (i32.const 160)) (local.get $p)))
    (if (i32.gt_s (global.get $err_len) (i32.const 0))
      (then
        (local.set $p (call $copy_json_esc (i32.const ${S.p_err.offset}) (i32.const ${S.p_err.len}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 448000) (call $utf8_clamp (i32.const 448000) (global.get $err_len) (i32.const 400)) (local.get $p)))
      )
    )
    (local.set $p (call $copy_json_esc (i32.const ${S.p_sd_ask.offset}) (i32.const ${S.p_sd_ask.len}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.ai_req_p3.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 560000)))
  )

  (func $call_ai_disconnect (result i32)
    (local $p i32)
    (global.set $g_state (i32.const 26))
    (local.set $p (call $begin_ai_json_req))
    (local.set $p (call $copy_json_esc (i32.const ${S.p_dc_hdr.offset}) (i32.const ${S.p_dc_hdr.len}) (local.get $p)))
    (if (global.get $g_op_ok)
      (then (local.set $p (call $copy_zstr (i32.const ${S.def_true.offset}) (local.get $p))))
      (else (local.set $p (call $copy_zstr (i32.const ${S.def_false.offset}) (local.get $p))))
    )
    (if (i32.gt_s (global.get $err_len) (i32.const 0))
      (then
        (local.set $p (call $copy_json_esc (i32.const ${S.p_err.offset}) (i32.const ${S.p_err.len}) (local.get $p)))
        (local.set $p (call $copy_json_esc (i32.const 448000) (call $utf8_clamp (i32.const 448000) (global.get $err_len) (i32.const 400)) (local.get $p)))
      )
    )
    (local.set $p (call $copy_json_esc (i32.const ${S.p_dc_ask.offset}) (i32.const ${S.p_dc_ask.len}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.ai_req_p3.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 560000)))
  )

  (func $call_ai_help (param $r_ptr i32) (param $r_len i32) (result i32)
    (local $p i32)
    (global.set $g_state (i32.const 25))
    (memory.copy (i32.const 449100) (local.get $r_ptr) (local.get $r_len))
    (global.set $reason_len (local.get $r_len))
    (local.set $p (call $copy_zstr (i32.const ${S.ai_sys_help_p1.offset}) (i32.const 560000)))
    (local.set $p (call $copy_json_esc (i32.const 410000) (global.get $lang_len) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.ai_sys_help_p2.offset}) (local.get $p)))
    (local.set $p (call $copy_json_esc (i32.const ${S.p_help_1.offset}) (i32.const ${S.p_help_1.len}) (local.get $p)))
    (local.set $p (call $copy_json_esc (local.get $r_ptr) (local.get $r_len) (local.get $p)))
    (local.set $p (call $copy_json_esc (i32.const ${S.p_help_2.offset}) (i32.const ${S.p_help_2.len}) (local.get $p)))
    (local.set $p (call $copy_zstr (i32.const ${S.ai_req_p3.offset}) (local.get $p)))
    (call $dispatch_host (i32.sub (local.get $p) (i32.const 560000)))
  )

  ;; ── AI Response Parser & Flutter UI Card Renderers ───────────────────

  (func $parse_ai_fields (param $res_ptr i32) (param $res_len i32)
    (local $tl i32)
    (global.set $ai_text_len (i32.const 0))
    (global.set $ai_intro_len (i32.const 0))
    (global.set $ai_ct_len (i32.const 0))
    (global.set $ai_cs_len (i32.const 0))
    (global.set $ai_badge_len (i32.const 0))
    (global.set $ai_guide_len (i32.const 0))
    (global.set $ai_ls_len (i32.const 0))
    (global.set $ai_vs_len (i32.const 0))
    (global.set $ai_la_len (i32.const 0))
    (global.set $ai_li_len (i32.const 0))
    (global.set $ai_lsmtp_len (i32.const 0))
    (global.set $ai_lu_len (i32.const 0))
    (global.set $ai_lp_len (i32.const 0))
    (global.set $ai_lc_len (i32.const 0))
    (global.set $ai_lf_len (i32.const 0))
    (global.set $ai_lt_len (i32.const 0))
    (global.set $ai_lsub_len (i32.const 0))
    (global.set $ai_ld_len (i32.const 0))
    (global.set $ai_empty_len (i32.const 0))
    (global.set $ai_utag_len (i32.const 0))
    (global.set $ai_b1_len (i32.const 0))
    (global.set $ai_b2_len (i32.const 0))
    (global.set $ai_b3_len (i32.const 0))
    (global.set $ai_err_len (i32.const 0))

    (if (i32.ne (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})) (i32.const 1))
      (then (return))
    )
    (local.set $tl (call $extract_json_str (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_text.offset}) (i32.const 480000) (i32.const 16000)))
    (if (i32.le_s (local.get $tl) (i32.const 0)) (then (return)))
    (global.set $ai_text_len (local.get $tl))

    (global.set $ai_intro_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_intro.offset}) (i32.const 497000) (i32.const 1000)))
    (global.set $ai_ct_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_ct.offset}) (i32.const 498100) (i32.const 180)))
    (global.set $ai_cs_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_cs.offset}) (i32.const 498400) (i32.const 280)))
    (global.set $ai_badge_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_badge.offset}) (i32.const 498800) (i32.const 48)))
    (global.set $ai_guide_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_guide.offset}) (i32.const 499000) (i32.const 3200)))
    (global.set $ai_ls_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_ls.offset}) (i32.const 502600) (i32.const 48)))
    (global.set $ai_vs_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_vs.offset}) (i32.const 502700) (i32.const 120)))
    (global.set $ai_la_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_la.offset}) (i32.const 502900) (i32.const 48)))
    (global.set $ai_li_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_li.offset}) (i32.const 503000) (i32.const 48)))
    (global.set $ai_lsmtp_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_lsmtp.offset}) (i32.const 503100) (i32.const 48)))
    (global.set $ai_lu_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_lu.offset}) (i32.const 503200) (i32.const 48)))
    (global.set $ai_lp_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_lp.offset}) (i32.const 503300) (i32.const 48)))
    (global.set $ai_lc_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_lc.offset}) (i32.const 503400) (i32.const 48)))
    (global.set $ai_lf_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_lf.offset}) (i32.const 503500) (i32.const 48)))
    (global.set $ai_lt_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_lt.offset}) (i32.const 503600) (i32.const 48)))
    (global.set $ai_lsub_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_lsub.offset}) (i32.const 503700) (i32.const 48)))
    (global.set $ai_ld_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_ld.offset}) (i32.const 503800) (i32.const 48)))
    (global.set $ai_empty_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_empty.offset}) (i32.const 503900) (i32.const 480)))
    (global.set $ai_utag_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_utag.offset}) (i32.const 504500) (i32.const 48)))
    (global.set $ai_b1_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_b1.offset}) (i32.const 504600) (i32.const 48)))
    (global.set $ai_b2_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_b2.offset}) (i32.const 504700) (i32.const 48)))
    (global.set $ai_b3_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_b3.offset}) (i32.const 504800) (i32.const 48)))
    (global.set $ai_err_len (call $extract_json_str (i32.const 480000) (local.get $tl) (i32.const ${S.ak_err.offset}) (i32.const 504900) (i32.const 900)))
  )

  (func $emit_kv (param $kp i32) (param $kl i32) (param $vp i32) (param $vl i32) (param $first i32)
    (if (i32.eqz (local.get $first)) (then (call $out_z (i32.const ${S.jf_comma.offset}))))
    (call $out_z (i32.const ${S.ui_kv_item1.offset}))
    (call $out_json_esc (local.get $kp) (local.get $kl) (i32.const 48))
    (call $out_z (i32.const ${S.ui_kv_item2.offset}))
    (call $out_json_esc (local.get $vp) (local.get $vl) (i32.const 190))
    (call $out_z (i32.const ${S.ui_kv_item3.offset}))
  )

  (func $emit_btn (param $lp i32) (param $ll i32) (param $cmd_z i32) (param $style_z i32) (param $first i32)
    (if (i32.eqz (local.get $first)) (then (call $out_z (i32.const ${S.jf_comma.offset}))))
    (call $out_z (i32.const ${S.ui_btn_1.offset}))
    (if (i32.gt_s (local.get $ll) (i32.const 0))
      (then (call $out_json_esc (local.get $lp) (local.get $ll) (i32.const 38)))
      (else (call $out_json_esc (local.get $cmd_z) (call $zlen (local.get $cmd_z)) (i32.const 38)))
    )
    (call $out_z (i32.const ${S.ui_btn_2.offset}))
    (call $out_z (local.get $cmd_z))
    (call $out_z (local.get $style_z))
  )

  (func $emit_ui_header (param $intro_p i32) (param $intro_l i32) (param $sub_p i32) (param $sub_l i32) (param $badge_fb i32) (param $style_z i32)
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.ui_p1.offset}))
    (if (i32.gt_s (local.get $intro_l) (i32.const 0))
      (then (call $out_json_esc (local.get $intro_p) (local.get $intro_l) (i32.const 900)))
    )
    (call $out_z (i32.const ${S.ui_p2.offset}))
    (if (i32.gt_s (global.get $ai_ct_len) (i32.const 0))
      (then (call $out_json_esc (i32.const 498100) (global.get $ai_ct_len) (i32.const 95)))
      (else (call $out_json_esc (i32.const ${S.def_gmail.offset}) (i32.const ${S.def_gmail.len}) (i32.const 95)))
    )
    (if (i32.gt_s (local.get $sub_l) (i32.const 0))
      (then
        (call $out_z (i32.const ${S.ui_sub.offset}))
        (call $out_json_esc (local.get $sub_p) (local.get $sub_l) (i32.const 180))
      )
    )
    (call $out_z (i32.const ${S.ui_badge.offset}))
    (if (i32.gt_s (global.get $ai_badge_len) (i32.const 0))
      (then (call $out_json_esc (i32.const 498800) (global.get $ai_badge_len) (i32.const 28)))
      (else (call $out_z (local.get $badge_fb)))
    )
    (call $out_z (local.get $style_z))
  )

  ;; Render Status UI Card (state 20)
  (func $render_status_ui (result i32)
    (local $sub_p i32) (local $sub_l i32)
    (local $nlen i32)
    (local $p i32)
    (local.set $sub_p (i32.const 498400))
    (local.set $sub_l (global.get $ai_cs_len))
    (if (i32.and (i32.le_s (local.get $sub_l) (i32.const 0)) (i32.gt_s (global.get $se_len) (i32.const 0)))
      (then (local.set $sub_p (i32.const 447000)) (local.set $sub_l (global.get $se_len)))
    )

    ;; Unconfigured -> Orange Warning Card
    (if (i32.eqz (global.get $g_configured))
      (then
        (call $emit_ui_header (i32.const 497000) (global.get $ai_intro_len) (local.get $sub_p) (local.get $sub_l) (i32.const ${S.def_err.offset}) (i32.const ${S.ui_bc_orange.offset}))
        (call $out_z (i32.const ${S.ui_kv_start.offset}))
        (call $emit_kv
          (if (result i32) (i32.gt_s (global.get $ai_ls_len) (i32.const 0)) (then (i32.const 502600)) (else (i32.const ${S.a_status.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_ls_len) (i32.const 0)) (then (global.get $ai_ls_len)) (else (i32.const ${S.a_status.len})))
          (if (result i32) (i32.gt_s (global.get $ai_vs_len) (i32.const 0)) (then (i32.const 502700)) (else (i32.const ${S.def_false.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_vs_len) (i32.const 0)) (then (global.get $ai_vs_len)) (else (i32.const ${S.def_false.len})))
          (i32.const 1))
        (call $emit_kv
          (if (result i32) (i32.gt_s (global.get $ai_lc_len) (i32.const 0)) (then (i32.const 503400)) (else (i32.const ${S.a_config.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_lc_len) (i32.const 0)) (then (global.get $ai_lc_len)) (else (i32.const ${S.a_config.len})))
          (i32.const ${S.def_cmd_cfg.offset}) (i32.const ${S.def_cmd_cfg.len}) (i32.const 0))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
        (if (i32.gt_s (global.get $ai_guide_len) (i32.const 0))
          (then
            (call $out_z (i32.const ${S.jf_comma.offset}))
            (call $out_z (i32.const ${S.ui_text_start.offset}))
            (call $out_json_esc (i32.const 499000) (global.get $ai_guide_len) (i32.const 3200))
            (call $out_z (i32.const ${S.ui_text_end.offset}))
          )
        )
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_div.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_btn_start.offset}))
        (call $emit_btn (i32.const 504600) (global.get $ai_b1_len) (i32.const ${S.def_cmd_help.offset}) (i32.const ${S.ui_btn_pri.offset}) (i32.const 1))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
        (call $out_z (i32.const ${S.ui_close.offset}))
        (return (i32.sub (global.get $out_pos) (i32.const 65536)))
      )
    )

    ;; Configured & Live IMAP Verified -> Green Card
    (if (global.get $g_verified)
      (then
        (call $emit_ui_header (i32.const 497000) (global.get $ai_intro_len) (local.get $sub_p) (local.get $sub_l) (i32.const ${S.def_ok.offset}) (i32.const ${S.ui_bc_green.offset}))
        (call $out_z (i32.const ${S.ui_kv_start.offset}))
        (call $emit_kv
          (if (result i32) (i32.gt_s (global.get $ai_la_len) (i32.const 0)) (then (i32.const 502900)) (else (i32.const ${S.k_account.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_la_len) (i32.const 0)) (then (global.get $ai_la_len)) (else (i32.const ${S.k_account.len})))
          (i32.const 447000) (global.get $se_len) (i32.const 1))
        (call $emit_kv
          (if (result i32) (i32.gt_s (global.get $ai_ls_len) (i32.const 0)) (then (i32.const 502600)) (else (i32.const ${S.a_status.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_ls_len) (i32.const 0)) (then (global.get $ai_ls_len)) (else (i32.const ${S.a_status.len})))
          (if (result i32) (i32.gt_s (global.get $ai_vs_len) (i32.const 0)) (then (i32.const 502700)) (else (i32.const ${S.def_ok.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_vs_len) (i32.const 0)) (then (global.get $ai_vs_len)) (else (i32.const ${S.def_ok.len})))
          (i32.const 0))
        (call $emit_kv
          (if (result i32) (i32.gt_s (global.get $ai_li_len) (i32.const 0)) (then (i32.const 503000)) (else (i32.const ${S.k_imapHost.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_li_len) (i32.const 0)) (then (global.get $ai_li_len)) (else (i32.const ${S.k_imapHost.len})))
          (if (result i32) (i32.gt_s (global.get $si_len) (i32.const 0)) (then (i32.const 447300)) (else (i32.const ${S.def_imap_def.offset})))
          (if (result i32) (i32.gt_s (global.get $si_len) (i32.const 0)) (then (global.get $si_len)) (else (i32.const ${S.def_imap_def.len})))
          (i32.const 0))
        ;; SMTP host:port into 449200
        (local.set $p (i32.const 449200))
        (if (i32.gt_s (global.get $ss_len) (i32.const 0))
          (then (local.set $p (call $copy_mem (i32.const 447600) (local.get $p) (global.get $ss_len))))
          (else (local.set $p (call $copy_zstr (i32.const ${S.def_smtp_def.offset}) (local.get $p))))
        )
        (local.set $p (call $copy_zstr (i32.const ${S.def_colon.offset}) (local.get $p)))
        (if (i32.gt_s (global.get $sp_len) (i32.const 0))
          (then (local.set $p (call $copy_mem (i32.const 447900) (local.get $p) (global.get $sp_len))))
          (else (local.set $p (call $copy_zstr (i32.const ${S.def_port_def.offset}) (local.get $p))))
        )
        (call $emit_kv
          (if (result i32) (i32.gt_s (global.get $ai_lsmtp_len) (i32.const 0)) (then (i32.const 503100)) (else (i32.const ${S.k_smtpHost.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_lsmtp_len) (i32.const 0)) (then (global.get $ai_lsmtp_len)) (else (i32.const ${S.k_smtpHost.len})))
          (i32.const 449200) (i32.sub (local.get $p) (i32.const 449200)) (i32.const 0))
        ;; Unread count
        (local.set $nlen (i32.sub (call $copy_int_str (global.get $g_unread_cnt) (i32.const 449200)) (i32.const 449200)))
        (call $emit_kv
          (if (result i32) (i32.gt_s (global.get $ai_lu_len) (i32.const 0)) (then (i32.const 503200)) (else (i32.const ${S.k_unread.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_lu_len) (i32.const 0)) (then (global.get $ai_lu_len)) (else (i32.const ${S.k_unread.len})))
          (i32.const 449200) (local.get $nlen) (i32.const 0))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_div.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_btn_start.offset}))
        (call $emit_btn (i32.const 504600) (global.get $ai_b1_len) (i32.const ${S.def_cmd_inbox.offset}) (i32.const ${S.ui_btn_pri.offset}) (i32.const 1))
        (call $emit_btn (i32.const 504700) (global.get $ai_b2_len) (i32.const ${S.def_cmd_help.offset}) (i32.const ${S.ui_btn_sec.offset}) (i32.const 0))
        (call $emit_btn (i32.const 504800) (global.get $ai_b3_len) (i32.const ${S.def_cmd_disc.offset}) (i32.const ${S.ui_btn_dng.offset}) (i32.const 0))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
        (call $out_z (i32.const ${S.ui_close.offset}))
        (return (i32.sub (global.get $out_pos) (i32.const 65536)))
      )
    )

    ;; Configured, IMAP verification failed -> Red Error Card
    (call $emit_ui_header
      (if (result i32) (i32.gt_s (global.get $ai_intro_len) (i32.const 0)) (then (i32.const 497000)) (else (i32.const 448000)))
      (if (result i32) (i32.gt_s (global.get $ai_intro_len) (i32.const 0)) (then (global.get $ai_intro_len)) (else (global.get $err_len)))
      (local.get $sub_p) (local.get $sub_l) (i32.const ${S.def_err.offset}) (i32.const ${S.ui_bc_red.offset}))
    (call $out_z (i32.const ${S.ui_kv_start.offset}))
    (call $emit_kv
      (if (result i32) (i32.gt_s (global.get $ai_la_len) (i32.const 0)) (then (i32.const 502900)) (else (i32.const ${S.k_account.offset})))
      (if (result i32) (i32.gt_s (global.get $ai_la_len) (i32.const 0)) (then (global.get $ai_la_len)) (else (i32.const ${S.k_account.len})))
      (i32.const 447000) (global.get $se_len) (i32.const 1))
    (call $emit_kv
      (if (result i32) (i32.gt_s (global.get $ai_li_len) (i32.const 0)) (then (i32.const 503000)) (else (i32.const ${S.k_imapHost.offset})))
      (if (result i32) (i32.gt_s (global.get $ai_li_len) (i32.const 0)) (then (global.get $ai_li_len)) (else (i32.const ${S.k_imapHost.len})))
      (if (result i32) (i32.gt_s (global.get $si_len) (i32.const 0)) (then (i32.const 447300)) (else (i32.const ${S.def_imap_def.offset})))
      (if (result i32) (i32.gt_s (global.get $si_len) (i32.const 0)) (then (global.get $si_len)) (else (i32.const ${S.def_imap_def.len})))
      (i32.const 0))
    (call $out_z (i32.const ${S.ui_arr_end.offset}))
    (call $out_z (i32.const ${S.jf_comma.offset}))
    (call $out_z (i32.const ${S.ui_text_start.offset}))
    (if (i32.gt_s (global.get $ai_err_len) (i32.const 0))
      (then (call $out_json_esc (i32.const 504900) (global.get $ai_err_len) (i32.const 900)))
      (else (call $out_json_esc (i32.const 448000) (global.get $err_len) (i32.const 900)))
    )
    (call $out_z (i32.const ${S.ui_text_end.offset}))
    (call $out_z (i32.const ${S.jf_comma.offset}))
    (call $out_z (i32.const ${S.ui_div.offset}))
    (call $out_z (i32.const ${S.jf_comma.offset}))
    (call $out_z (i32.const ${S.ui_btn_start.offset}))
    (call $emit_btn (i32.const 504600) (global.get $ai_b1_len) (i32.const ${S.def_cmd_gmail.offset}) (i32.const ${S.ui_btn_pri.offset}) (i32.const 1))
    (call $emit_btn (i32.const 504700) (global.get $ai_b2_len) (i32.const ${S.def_cmd_disc.offset}) (i32.const ${S.ui_btn_dng.offset}) (i32.const 0))
    (call $out_z (i32.const ${S.ui_arr_end.offset}))
    (call $out_z (i32.const ${S.ui_close.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  ;; Render Config UI Card (state 21)
  (func $render_config_ui (result i32)
    (if (global.get $g_op_ok)
      (then
        (call $emit_ui_header (i32.const 497000) (global.get $ai_intro_len) (i32.const 410150) (global.get $email_len) (i32.const ${S.def_ok.offset}) (i32.const ${S.ui_bc_green.offset}))
        (call $out_z (i32.const ${S.ui_kv_start.offset}))
        (call $emit_kv
          (if (result i32) (i32.gt_s (global.get $ai_la_len) (i32.const 0)) (then (i32.const 502900)) (else (i32.const ${S.k_account.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_la_len) (i32.const 0)) (then (global.get $ai_la_len)) (else (i32.const ${S.k_account.len})))
          (i32.const 410150) (global.get $email_len) (i32.const 1))
        (if (i32.gt_s (global.get $prov_len) (i32.const 0))
          (then
            (call $emit_kv
              (if (result i32) (i32.gt_s (global.get $ai_lp_len) (i32.const 0)) (then (i32.const 503300)) (else (i32.const ${S.k_provider.offset})))
              (if (result i32) (i32.gt_s (global.get $ai_lp_len) (i32.const 0)) (then (global.get $ai_lp_len)) (else (i32.const ${S.k_provider.len})))
              (i32.const 449200) (global.get $prov_len) (i32.const 0))
          )
        )
        (call $emit_kv
          (if (result i32) (i32.gt_s (global.get $ai_ls_len) (i32.const 0)) (then (i32.const 502600)) (else (i32.const ${S.a_status.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_ls_len) (i32.const 0)) (then (global.get $ai_ls_len)) (else (i32.const ${S.a_status.len})))
          (if (result i32) (i32.gt_s (global.get $ai_vs_len) (i32.const 0)) (then (i32.const 502700)) (else (i32.const ${S.def_ok.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_vs_len) (i32.const 0)) (then (global.get $ai_vs_len)) (else (i32.const ${S.def_ok.len})))
          (i32.const 0))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_div.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_btn_start.offset}))
        (call $emit_btn (i32.const 504600) (global.get $ai_b1_len) (i32.const ${S.def_cmd_inbox.offset}) (i32.const ${S.ui_btn_pri.offset}) (i32.const 1))
        (call $emit_btn (i32.const 504700) (global.get $ai_b2_len) (i32.const ${S.def_cmd_gmail.offset}) (i32.const ${S.ui_btn_sec.offset}) (i32.const 0))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
      )
      (else
        (call $emit_ui_header
          (if (result i32) (i32.gt_s (global.get $ai_intro_len) (i32.const 0)) (then (i32.const 497000)) (else (i32.const 448000)))
          (if (result i32) (i32.gt_s (global.get $ai_intro_len) (i32.const 0)) (then (global.get $ai_intro_len)) (else (global.get $err_len)))
          (i32.const 410150) (global.get $email_len) (i32.const ${S.def_err.offset}) (i32.const ${S.ui_bc_red.offset}))
        (call $out_z (i32.const ${S.ui_text_start.offset}))
        (if (i32.gt_s (global.get $ai_err_len) (i32.const 0))
          (then (call $out_json_esc (i32.const 504900) (global.get $ai_err_len) (i32.const 900)))
          (else (call $out_json_esc (i32.const 448000) (global.get $err_len) (i32.const 900)))
        )
        (call $out_z (i32.const ${S.ui_text_end.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_div.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_btn_start.offset}))
        (call $emit_btn (i32.const 504600) (global.get $ai_b1_len) (i32.const ${S.def_cmd_help.offset}) (i32.const ${S.ui_btn_pri.offset}) (i32.const 1))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
      )
    )
    (call $out_z (i32.const ${S.ui_close.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  ;; Render Inbox List Card (state 22)
  (func $render_inbox_ui (result i32)
    (local $cnt i32)
    (local $idl i32) (local $fl i32) (local $sl i32) (local $dl i32) (local $snl i32) (local $unr i32)
    (local $p i32)
    (local $sub_p i32) (local $sub_l i32)
    (local.set $sub_p (i32.const 498400))
    (local.set $sub_l (global.get $ai_cs_len))
    (if (i32.and (i32.le_s (local.get $sub_l) (i32.const 0)) (i32.gt_s (global.get $se_len) (i32.const 0)))
      (then (local.set $sub_p (i32.const 447000)) (local.set $sub_l (global.get $se_len)))
    )

    (if (i32.eqz (global.get $g_op_ok))
      (then
        (call $emit_ui_header
          (if (result i32) (i32.gt_s (global.get $ai_intro_len) (i32.const 0)) (then (i32.const 497000)) (else (i32.const 448000)))
          (if (result i32) (i32.gt_s (global.get $ai_intro_len) (i32.const 0)) (then (global.get $ai_intro_len)) (else (global.get $err_len)))
          (local.get $sub_p) (local.get $sub_l) (i32.const ${S.def_err.offset}) (i32.const ${S.ui_bc_red.offset}))
        (call $out_z (i32.const ${S.ui_text_start.offset}))
        (if (i32.gt_s (global.get $ai_err_len) (i32.const 0))
          (then (call $out_json_esc (i32.const 504900) (global.get $ai_err_len) (i32.const 900)))
          (else (call $out_json_esc (i32.const 448000) (global.get $err_len) (i32.const 900)))
        )
        (call $out_z (i32.const ${S.ui_text_end.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_div.offset}))
        (call $out_z (i32.const ${S.jf_comma.offset}))
        (call $out_z (i32.const ${S.ui_btn_start.offset}))
        (call $emit_btn (i32.const 504700) (global.get $ai_b2_len) (i32.const ${S.def_cmd_help.offset}) (i32.const ${S.ui_btn_pri.offset}) (i32.const 1))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
        (call $out_z (i32.const ${S.ui_close.offset}))
        (return (i32.sub (global.get $out_pos) (i32.const 65536)))
      )
    )

    (if (i32.le_s (global.get $g_total_cnt) (i32.const 0))
      (then
        (call $emit_ui_header (i32.const 497000) (global.get $ai_intro_len) (local.get $sub_p) (local.get $sub_l) (i32.const ${S.def_ok.offset}) (i32.const ${S.ui_bc_blue.offset}))
        (call $out_z (i32.const ${S.ui_text_start.offset}))
        (if (i32.gt_s (global.get $ai_empty_len) (i32.const 0))
          (then (call $out_json_esc (i32.const 503900) (global.get $ai_empty_len) (i32.const 480)))
          (else (call $out_json_esc (i32.const ${S.def_gmail.offset}) (i32.const ${S.def_gmail.len}) (i32.const 480)))
        )
        (call $out_z (i32.const ${S.ui_text_end.offset}))
      )
      (else
        (call $emit_ui_header (i32.const 497000) (global.get $ai_intro_len) (local.get $sub_p) (local.get $sub_l) (i32.const ${S.def_ok.offset}) (i32.const ${S.ui_bc_msg.offset}))
        (call $out_z (i32.const ${S.ui_list_start.offset}))
        (local.set $cnt (i32.const 0))
        (if (call $find_array_start (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_emails.offset}))
          (then
            (loop $em_l
              (if (i32.and (i32.lt_s (local.get $cnt) (i32.const 15))
                           (call $next_array_obj (i32.const 1260000) (global.get $saved_res_len)))
                (then
                  (local.set $idl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_id.offset}) (i32.const 454500) (i32.const 48)))
                  (local.set $fl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_from.offset}) (i32.const 453400) (i32.const 120)))
                  (local.set $sl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_subject.offset}) (i32.const 453700) (i32.const 120)))
                  (local.set $dl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_date.offset}) (i32.const 454000) (i32.const 48)))
                  (local.set $snl (call $extract_json_str (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_snippet.offset}) (i32.const 454200) (i32.const 160)))
                  (local.set $unr (call $extract_json_bool (global.get $arr_obj_start) (global.get $arr_obj_len) (i32.const ${S.k_unread.offset})))

                  ;; Assemble item title: [id] (● )subject into 449200
                  (local.set $p (i32.const 449200))
                  (if (i32.gt_s (local.get $idl) (i32.const 0))
                    (then
                      (local.set $p (call $copy_zstr (i32.const ${S.def_lbr.offset}) (local.get $p)))
                      (local.set $p (call $copy_mem (i32.const 454500) (local.get $p) (local.get $idl)))
                      (local.set $p (call $copy_zstr (i32.const ${S.def_rbr.offset}) (local.get $p)))
                    )
                  )
                  (if (i32.eq (local.get $unr) (i32.const 1))
                    (then (local.set $p (call $copy_zstr (i32.const ${S.def_star.offset}) (local.get $p))))
                  )
                  (if (i32.gt_s (local.get $sl) (i32.const 0))
                    (then (local.set $p (call $copy_mem (i32.const 453700) (local.get $p) (call $utf8_clamp (i32.const 453700) (local.get $sl) (i32.const 70)))))
                  )
                  (if (i32.gt_s (local.get $cnt) (i32.const 0)) (then (call $out_z (i32.const ${S.jf_comma.offset}))))
                  (call $out_z (i32.const ${S.ui_list_item1.offset}))
                  (call $out_json_esc (i32.const 449200) (i32.sub (local.get $p) (i32.const 449200)) (i32.const 95))
                  (call $out_z (i32.const ${S.ui_list_item2.offset}))

                  ;; Assemble subtitle: from • date(16) • snippet into 449200
                  (local.set $p (i32.const 449200))
                  (if (i32.gt_s (local.get $fl) (i32.const 0))
                    (then (local.set $p (call $copy_mem (i32.const 453400) (local.get $p) (call $utf8_clamp (i32.const 453400) (local.get $fl) (i32.const 60)))))
                  )
                  (if (i32.gt_s (local.get $dl) (i32.const 0))
                    (then
                      (if (i32.gt_s (local.get $p) (i32.const 449200)) (then (local.set $p (call $copy_zstr (i32.const ${S.def_dot.offset}) (local.get $p)))))
                      (local.set $p (call $copy_mem (i32.const 454000) (local.get $p) (call $utf8_clamp (i32.const 454000) (local.get $dl) (i32.const 16))))
                    )
                  )
                  (if (i32.gt_s (local.get $snl) (i32.const 0))
                    (then
                      (if (i32.gt_s (local.get $p) (i32.const 449200)) (then (local.set $p (call $copy_zstr (i32.const ${S.def_dot.offset}) (local.get $p)))))
                      (local.set $p (call $copy_mem (i32.const 454200) (local.get $p) (call $utf8_clamp (i32.const 454200) (local.get $snl) (i32.const 70))))
                    )
                  )
                  (call $out_json_esc (i32.const 449200) (i32.sub (local.get $p) (i32.const 449200)) (i32.const 155))
                  (call $out_z (i32.const ${S.ui_list_item3.offset}))

                  (local.set $cnt (i32.add (local.get $cnt) (i32.const 1)))
                  (br $em_l)
                )
              )
            )
          )
        )
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
      )
    )
    (call $out_z (i32.const ${S.jf_comma.offset}))
    (call $out_z (i32.const ${S.ui_div.offset}))
    (call $out_z (i32.const ${S.jf_comma.offset}))
    (call $out_z (i32.const ${S.ui_btn_start.offset}))
    (call $emit_btn (i32.const 504600) (global.get $ai_b1_len) (i32.const ${S.def_cmd_inbox.offset}) (i32.const ${S.ui_btn_pri.offset}) (i32.const 1))
    (call $emit_btn (i32.const 504700) (global.get $ai_b2_len) (i32.const ${S.def_cmd_gmail.offset}) (i32.const ${S.ui_btn_sec.offset}) (i32.const 0))
    (call $out_z (i32.const ${S.ui_arr_end.offset}))
    (call $out_z (i32.const ${S.ui_close.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  ;; Render Full Email Read Card (state 23)
  (func $render_read_ui (result i32)
    (local $fl i32) (local $tl i32) (local $sl i32) (local $dl i32) (local $bl i32)
    (local $has_kv i32)
    (if (i32.eqz (global.get $g_op_ok))
      (then
        (call $emit_ui_header
          (if (result i32) (i32.gt_s (global.get $ai_intro_len) (i32.const 0)) (then (i32.const 497000)) (else (i32.const 448000)))
          (if (result i32) (i32.gt_s (global.get $ai_intro_len) (i32.const 0)) (then (global.get $ai_intro_len)) (else (global.get $err_len)))
          (i32.const 410750) (global.get $id_len) (i32.const ${S.def_err.offset}) (i32.const ${S.ui_bc_red.offset}))
        (call $out_z (i32.const ${S.ui_text_start.offset}))
        (if (i32.gt_s (global.get $ai_err_len) (i32.const 0))
          (then (call $out_json_esc (i32.const 504900) (global.get $ai_err_len) (i32.const 900)))
          (else (call $out_json_esc (i32.const 448000) (global.get $err_len) (i32.const 900)))
        )
        (call $out_z (i32.const ${S.ui_text_end.offset}))
      )
      (else
        (local.set $fl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_from.offset}) (i32.const 453400) (i32.const 200)))
        (local.set $tl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_to.offset}) (i32.const 453700) (i32.const 200)))
        (local.set $sl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_subject.offset}) (i32.const 454000) (i32.const 200)))
        (local.set $dl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_date.offset}) (i32.const 454200) (i32.const 100)))
        (local.set $bl (call $extract_json_str (i32.const 1260000) (global.get $saved_res_len) (i32.const ${S.k_body.offset}) (i32.const 412300) (i32.const 4000)))

        (call $emit_ui_header
          (i32.const 497000) (global.get $ai_intro_len)
          (if (result i32) (i32.gt_s (global.get $ai_cs_len) (i32.const 0)) (then (i32.const 498400)) (else (i32.const 453400)))
          (if (result i32) (i32.gt_s (global.get $ai_cs_len) (i32.const 0)) (then (global.get $ai_cs_len)) (else (local.get $fl)))
          (i32.const ${S.def_ok.offset}) (i32.const ${S.ui_bc_msg.offset}))
        (call $out_z (i32.const ${S.ui_kv_start.offset}))
        (local.set $has_kv (i32.const 0))
        (if (i32.gt_s (local.get $fl) (i32.const 0))
          (then
            (call $emit_kv
              (if (result i32) (i32.gt_s (global.get $ai_lf_len) (i32.const 0)) (then (i32.const 503500)) (else (i32.const ${S.k_from.offset})))
              (if (result i32) (i32.gt_s (global.get $ai_lf_len) (i32.const 0)) (then (global.get $ai_lf_len)) (else (i32.const ${S.k_from.len})))
              (i32.const 453400) (local.get $fl) (i32.const 1))
            (local.set $has_kv (i32.const 1))
          )
        )
        (if (i32.gt_s (local.get $tl) (i32.const 0))
          (then
            (call $emit_kv
              (if (result i32) (i32.gt_s (global.get $ai_lt_len) (i32.const 0)) (then (i32.const 503600)) (else (i32.const ${S.k_to.offset})))
              (if (result i32) (i32.gt_s (global.get $ai_lt_len) (i32.const 0)) (then (global.get $ai_lt_len)) (else (i32.const ${S.k_to.len})))
              (i32.const 453700) (local.get $tl) (i32.eqz (local.get $has_kv)))
            (local.set $has_kv (i32.const 1))
          )
        )
        (if (i32.gt_s (local.get $sl) (i32.const 0))
          (then
            (call $emit_kv
              (if (result i32) (i32.gt_s (global.get $ai_lsub_len) (i32.const 0)) (then (i32.const 503700)) (else (i32.const ${S.k_subject.offset})))
              (if (result i32) (i32.gt_s (global.get $ai_lsub_len) (i32.const 0)) (then (global.get $ai_lsub_len)) (else (i32.const ${S.k_subject.len})))
              (i32.const 454000) (local.get $sl) (i32.eqz (local.get $has_kv)))
            (local.set $has_kv (i32.const 1))
          )
        )
        (if (i32.gt_s (local.get $dl) (i32.const 0))
          (then
            (call $emit_kv
              (if (result i32) (i32.gt_s (global.get $ai_ld_len) (i32.const 0)) (then (i32.const 503800)) (else (i32.const ${S.k_date.offset})))
              (if (result i32) (i32.gt_s (global.get $ai_ld_len) (i32.const 0)) (then (global.get $ai_ld_len)) (else (i32.const ${S.k_date.len})))
              (i32.const 454200) (local.get $dl) (i32.eqz (local.get $has_kv)))
          )
        )
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
        (if (i32.gt_s (local.get $bl) (i32.const 0))
          (then
            (call $out_z (i32.const ${S.jf_comma.offset}))
            (call $out_z (i32.const ${S.ui_div.offset}))
            (call $out_z (i32.const ${S.jf_comma.offset}))
            (call $out_z (i32.const ${S.ui_text_start.offset}))
            (call $out_json_esc (i32.const 412300) (local.get $bl) (i32.const 3800))
            (call $out_z (i32.const ${S.ui_text_end.offset}))
          )
        )
      )
    )
    (call $out_z (i32.const ${S.jf_comma.offset}))
    (call $out_z (i32.const ${S.ui_div.offset}))
    (call $out_z (i32.const ${S.jf_comma.offset}))
    (call $out_z (i32.const ${S.ui_btn_start.offset}))
    (call $emit_btn (i32.const 504600) (global.get $ai_b1_len) (i32.const ${S.def_cmd_inbox.offset}) (i32.const ${S.ui_btn_pri.offset}) (i32.const 1))
    (call $out_z (i32.const ${S.ui_arr_end.offset}))
    (call $out_z (i32.const ${S.ui_close.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  ;; Render Send Card (state 24)
  (func $render_send_ui (result i32)
    (if (global.get $g_op_ok)
      (then
        (call $emit_ui_header (i32.const 497000) (global.get $ai_intro_len) (i32.const 410900) (global.get $to_len) (i32.const ${S.def_ok.offset}) (i32.const ${S.ui_bc_green.offset}))
        (call $out_z (i32.const ${S.ui_kv_start.offset}))
        (call $emit_kv
          (if (result i32) (i32.gt_s (global.get $ai_lt_len) (i32.const 0)) (then (i32.const 503600)) (else (i32.const ${S.k_to.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_lt_len) (i32.const 0)) (then (global.get $ai_lt_len)) (else (i32.const ${S.k_to.len})))
          (i32.const 410900) (global.get $to_len) (i32.const 1))
        (if (i32.gt_s (global.get $subj_len) (i32.const 0))
          (then
            (call $emit_kv
              (if (result i32) (i32.gt_s (global.get $ai_lsub_len) (i32.const 0)) (then (i32.const 503700)) (else (i32.const ${S.k_subject.offset})))
              (if (result i32) (i32.gt_s (global.get $ai_lsub_len) (i32.const 0)) (then (global.get $ai_lsub_len)) (else (i32.const ${S.k_subject.len})))
              (i32.const 411200) (global.get $subj_len) (i32.const 0))
          )
        )
        (call $emit_kv
          (if (result i32) (i32.gt_s (global.get $ai_ls_len) (i32.const 0)) (then (i32.const 502600)) (else (i32.const ${S.a_status.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_ls_len) (i32.const 0)) (then (global.get $ai_ls_len)) (else (i32.const ${S.a_status.len})))
          (if (result i32) (i32.gt_s (global.get $ai_vs_len) (i32.const 0)) (then (i32.const 502700)) (else (i32.const ${S.def_ok.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_vs_len) (i32.const 0)) (then (global.get $ai_vs_len)) (else (i32.const ${S.def_ok.len})))
          (i32.const 0))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
      )
      (else
        (call $emit_ui_header
          (if (result i32) (i32.gt_s (global.get $ai_intro_len) (i32.const 0)) (then (i32.const 497000)) (else (i32.const 448000)))
          (if (result i32) (i32.gt_s (global.get $ai_intro_len) (i32.const 0)) (then (global.get $ai_intro_len)) (else (global.get $err_len)))
          (i32.const 410900) (global.get $to_len) (i32.const ${S.def_err.offset}) (i32.const ${S.ui_bc_red.offset}))
        (call $out_z (i32.const ${S.ui_text_start.offset}))
        (if (i32.gt_s (global.get $ai_err_len) (i32.const 0))
          (then (call $out_json_esc (i32.const 504900) (global.get $ai_err_len) (i32.const 900)))
          (else (call $out_json_esc (i32.const 448000) (global.get $err_len) (i32.const 900)))
        )
        (call $out_z (i32.const ${S.ui_text_end.offset}))
      )
    )
    (call $out_z (i32.const ${S.jf_comma.offset}))
    (call $out_z (i32.const ${S.ui_div.offset}))
    (call $out_z (i32.const ${S.jf_comma.offset}))
    (call $out_z (i32.const ${S.ui_btn_start.offset}))
    (call $emit_btn (i32.const 504600) (global.get $ai_b1_len) (i32.const ${S.def_cmd_inbox.offset}) (i32.const ${S.ui_btn_pri.offset}) (i32.const 1))
    (call $out_z (i32.const ${S.ui_arr_end.offset}))
    (call $out_z (i32.const ${S.ui_close.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  ;; Render Disconnect Card (state 26)
  (func $render_disconnect_ui (result i32)
    (if (global.get $g_op_ok)
      (then
        (call $emit_ui_header (i32.const 497000) (global.get $ai_intro_len) (i32.const 498400) (global.get $ai_cs_len) (i32.const ${S.def_ok.offset}) (i32.const ${S.ui_bc_blue.offset}))
        (call $out_z (i32.const ${S.ui_kv_start.offset}))
        (call $emit_kv
          (if (result i32) (i32.gt_s (global.get $ai_ls_len) (i32.const 0)) (then (i32.const 502600)) (else (i32.const ${S.a_status.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_ls_len) (i32.const 0)) (then (global.get $ai_ls_len)) (else (i32.const ${S.a_status.len})))
          (if (result i32) (i32.gt_s (global.get $ai_vs_len) (i32.const 0)) (then (i32.const 502700)) (else (i32.const ${S.def_ok.offset})))
          (if (result i32) (i32.gt_s (global.get $ai_vs_len) (i32.const 0)) (then (global.get $ai_vs_len)) (else (i32.const ${S.def_ok.len})))
          (i32.const 1))
        (call $out_z (i32.const ${S.ui_arr_end.offset}))
      )
      (else
        (call $emit_ui_header (i32.const 497000) (global.get $ai_intro_len) (i32.const 498400) (global.get $ai_cs_len) (i32.const ${S.def_err.offset}) (i32.const ${S.ui_bc_red.offset}))
        (call $out_z (i32.const ${S.ui_text_start.offset}))
        (if (i32.gt_s (global.get $ai_err_len) (i32.const 0))
          (then (call $out_json_esc (i32.const 504900) (global.get $ai_err_len) (i32.const 900)))
          (else (call $out_json_esc (i32.const 448000) (global.get $err_len) (i32.const 900)))
        )
        (call $out_z (i32.const ${S.ui_text_end.offset}))
      )
    )
    (call $out_z (i32.const ${S.jf_comma.offset}))
    (call $out_z (i32.const ${S.ui_div.offset}))
    (call $out_z (i32.const ${S.jf_comma.offset}))
    (call $out_z (i32.const ${S.ui_btn_start.offset}))
    (call $emit_btn (i32.const 504600) (global.get $ai_b1_len) (i32.const ${S.def_cmd_gmail.offset}) (i32.const ${S.ui_btn_pri.offset}) (i32.const 1))
    (call $out_z (i32.const ${S.ui_arr_end.offset}))
    (call $out_z (i32.const ${S.ui_close.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  (func $render_help_direct (result i32)
    (global.set $out_pos (i32.const 65536))
    (call $out_z (i32.const ${S.direct_p1.offset}))
    (if (i32.gt_s (global.get $ai_text_len) (i32.const 0))
      (then (call $out_json_esc (i32.const 480000) (global.get $ai_text_len) (i32.const 12000)))
      (else (call $out_json_esc (i32.const ${S.def_cmd_cfg.offset}) (i32.const ${S.def_cmd_cfg.len}) (i32.const 120)))
    )
    (call $out_z (i32.const ${S.direct_p2.offset}))
    (i32.sub (global.get $out_pos) (i32.const 65536))
  )

  (func $render_fallback_for_state (result i32)
    (if (i32.or (i32.eq (global.get $g_state) (i32.const 10)) (i32.eq (global.get $g_state) (i32.const 20))) (then (return (call $render_status_ui))))
    (if (i32.or (i32.eq (global.get $g_state) (i32.const 11)) (i32.eq (global.get $g_state) (i32.const 21))) (then (return (call $render_config_ui))))
    (if (i32.or (i32.eq (global.get $g_state) (i32.const 12)) (i32.eq (global.get $g_state) (i32.const 22))) (then (return (call $render_inbox_ui))))
    (if (i32.or (i32.eq (global.get $g_state) (i32.const 13)) (i32.eq (global.get $g_state) (i32.const 23))) (then (return (call $render_read_ui))))
    (if (i32.or (i32.eq (global.get $g_state) (i32.const 14)) (i32.eq (global.get $g_state) (i32.const 24))) (then (return (call $render_send_ui))))
    (if (i32.or (i32.eq (global.get $g_state) (i32.const 15)) (i32.eq (global.get $g_state) (i32.const 26))) (then (return (call $render_disconnect_ui))))
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
    (call $set_default_lang)

    ;; Trim whitespace
    (local.set $ts (local.get $in_ptr))
    (local.set $tl (local.get $in_len))
    (loop $lt (if (i32.and (i32.gt_s (local.get $tl) (i32.const 0)) (call $is_ws (i32.load8_u (local.get $ts))))
      (then (local.set $ts (i32.add (local.get $ts) (i32.const 1))) (local.set $tl (i32.sub (local.get $tl) (i32.const 1))) (br $lt))))
    (loop $rt (if (i32.and (i32.gt_s (local.get $tl) (i32.const 0)) (call $is_ws (i32.load8_u (i32.add (local.get $ts) (i32.sub (local.get $tl) (i32.const 1))))))
      (then (local.set $tl (i32.sub (local.get $tl) (i32.const 1))) (br $rt))))

    ;; Case A: JSON input
    (if (i32.and (i32.gt_s (local.get $tl) (i32.const 0)) (i32.eq (i32.load8_u (local.get $ts)) (i32.const 123)))
      (then
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
          (then (return (call $call_ai_help (i32.const ${S.r_help.offset}) (i32.const ${S.r_help.len}))))
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
                (return (call $call_ai_help (i32.const ${S.r_miss_cfg.offset}) (i32.const ${S.r_miss_cfg.len})))
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
              (then (return (call $call_ai_help (i32.const ${S.r_miss_id.offset}) (i32.const ${S.r_miss_id.len}))))
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
              (then (return (call $call_ai_help (i32.const ${S.r_miss_send.offset}) (i32.const ${S.r_miss_send.len}))))
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

    ;; STATE 10: Status live IMAP check result
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
        (return (call $call_ai_status))
      )
    )

    ;; STATE 11: Config response
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
        (return (call $call_ai_config))
      )
    )

    ;; STATE 12: Inbox response
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
        (return (call $call_ai_inbox))
      )
    )

    ;; STATE 13: Read response
    (if (i32.eq (global.get $g_state) (i32.const 13))
      (then
        (call $save_res (local.get $res_ptr) (local.get $res_len))
        (local.set $ok (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})))
        (if (i32.eq (local.get $ok) (i32.const 1))
          (then (global.set $g_op_ok (i32.const 1)) (global.set $err_len (i32.const 0)))
          (else (global.set $g_op_ok (i32.const 0)) (call $extract_err (local.get $res_ptr) (local.get $res_len)))
        )
        (return (call $call_ai_read))
      )
    )

    ;; STATE 14: Send response
    (if (i32.eq (global.get $g_state) (i32.const 14))
      (then
        (call $save_res (local.get $res_ptr) (local.get $res_len))
        (local.set $ok (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})))
        (if (i32.eq (local.get $ok) (i32.const 1))
          (then (global.set $g_op_ok (i32.const 1)) (global.set $err_len (i32.const 0)))
          (else (global.set $g_op_ok (i32.const 0)) (call $extract_err (local.get $res_ptr) (local.get $res_len)))
        )
        (return (call $call_ai_send))
      )
    )

    ;; STATE 15: Disconnect response
    (if (i32.eq (global.get $g_state) (i32.const 15))
      (then
        (call $save_res (local.get $res_ptr) (local.get $res_len))
        (local.set $ok (call $extract_json_bool (local.get $res_ptr) (local.get $res_len) (i32.const ${S.k_success.offset})))
        (if (i32.eq (local.get $ok) (i32.const 1))
          (then (global.set $g_op_ok (i32.const 1)) (global.set $err_len (i32.const 0)))
          (else (global.set $g_op_ok (i32.const 0)) (call $extract_err (local.get $res_ptr) (local.get $res_len)))
        )
        (return (call $call_ai_disconnect))
      )
    )

    ;; STATES 20..26: AI complete finished
    (call $parse_ai_fields (local.get $res_ptr) (local.get $res_len))
    (if (i32.eq (global.get $g_state) (i32.const 20)) (then (return (call $render_status_ui))))
    (if (i32.eq (global.get $g_state) (i32.const 21)) (then (return (call $render_config_ui))))
    (if (i32.eq (global.get $g_state) (i32.const 22)) (then (return (call $render_inbox_ui))))
    (if (i32.eq (global.get $g_state) (i32.const 23)) (then (return (call $render_read_ui))))
    (if (i32.eq (global.get $g_state) (i32.const 24)) (then (return (call $render_send_ui))))
    (if (i32.eq (global.get $g_state) (i32.const 26)) (then (return (call $render_disconnect_ui))))
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

  // Test 1: Bare /gmail ("lang=es") when NOT configured -> orange setup Flutter UI card
  {
    const storage = {};
    const out = await execPlugin(
      'lang=es',
      (req) => ({ success: true, data: { key: req.payload.key, value: storage[req.payload.key] || null, exists: !!storage[req.payload.key] } }),
      async (req) => {
        assert(req.api === 'ai' && req.operation === 'complete', 'Unconfigured bare /gmail must NOT call email.inbox; only ai.complete');
        assert(req.payload.systemPrompt.includes('"es"'), 'AI lang es');
        return {
          success: true,
          data: {
            text: JSON.stringify({
              intro: 'Tu cuenta de Gmail aún no está configurada.',
              card_title: 'Configuración de Gmail',
              card_subtitle: 'Cuenta sin vincular',
              badge: 'SIN CONFIGURAR',
              lbl_status: 'Estado',
              val_status: 'No conectado',
              lbl_cmd: 'Comando',
              guide: '1. Activa la verificación en 2 pasos.\n2. Crea una contraseña de aplicación de 16 letras.\n3. Ejecuta /gmail config tu-correo@gmail.com abcd efgh ijkl mnop.',
              btn_1: 'Ayuda',
            }),
          },
        };
      }
    );
    assert(out.type === 'ui' && out.ui.badgeColor === 'orange' && out.ui.icon === 'warning', 'Orange warning card when unconfigured');
    assert(out.ui.elements[1].type === 'text' && out.ui.elements[1].content.includes('16 letras'), 'Setup guide displayed');
    assert(out.ui.elements[3].buttons[0].value === '/gmail help', 'Help button');
  }

  // Test 2: Exact user /gmail config command via marketplace_plugin.dart ("api":"gmail"!) -> routes to "api":"email" + strips password spaces + zeroizes password
  {
    const storage = {};
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
          storage.chattree_email_account = req.payload.email;
          return {
            success: true,
            data: { configured: true, email: 'user@gmail.com', provider: 'Google Gmail', message: 'Connected' },
          };
        }
        if (req.api === 'ai' && req.operation === 'complete') {
          assert(!JSON.stringify(req).includes('abcd') && !JSON.stringify(req).includes('mnop'), 'Password MUST NEVER be sent to AI');
          return {
            success: true,
            data: {
              text: JSON.stringify({
                intro: 'Tu cuenta user@gmail.com se conectó correctamente.',
                card_title: 'Gmail Conectado',
                card_subtitle: 'user@gmail.com',
                badge: 'CONECTADO',
                lbl_account: 'Cuenta',
                lbl_provider: 'Proveedor',
                lbl_status: 'Estado',
                val_status: 'Verificado',
                btn_1: 'Bandeja',
                btn_2: 'Estado',
              }),
            },
          };
        }
        throw new Error('Unexpected call: ' + JSON.stringify(req));
      }
    );
    assert(asyncCalls[0].api === 'email' && asyncCalls[0].operation === 'config', 'Critical: api must be email, never gmail');
    assert(out.type === 'ui' && out.ui.badgeColor === 'green' && out.ui.icon === 'check', 'Green connected card');
    assert(!JSON.stringify(out).includes('abcdefgh'), 'Password must never appear in output');
  }

  // Test 3: Direct plain-text config user@gmail.com abcd efgh ijkl mnop lang=es
  {
    const out = await execPlugin(
      'config user@gmail.com abcd efgh ijkl mnop lang=es',
      () => ({ success: true, data: { exists: false } }),
      async (req) => {
        if (req.api === 'email' && req.operation === 'config') {
          assert(req.payload.email === 'user@gmail.com', 'Direct email parsed');
          assert(req.payload.password === 'abcdefghijklmnop', 'Direct 4-group app password joined & stripped');
          return { success: true, data: { configured: true, email: 'user@gmail.com', provider: 'Google Gmail' } };
        }
        if (req.api === 'ai') return { success: true, data: { text: '{"intro":"Conectado.","card_title":"Gmail","badge":"OK","val_status":"Conectado","btn_1":"Inbox","btn_2":"Estado"}' } };
        throw new Error('Unexpected call');
      }
    );
    assert(out.type === 'ui' && out.ui.icon === 'check', 'Plain-text config succeeds');
  }

  // Test 4: Bare /gmail when configured & IMAP live-verified -> Green Flutter UI Card
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
        if (req.api === 'email' && req.operation === 'inbox') {
          return { success: true, data: { status: 'success', account: 'user@gmail.com', unread_count: 3, total_count: 8, emails: [] } };
        }
        if (req.api === 'ai') {
          assert(req.payload.prompt.includes('unread_count=3'), 'Prompt has live unread_count');
          return {
            success: true,
            data: {
              text: JSON.stringify({
                intro: 'Tu cuenta user@gmail.com está conectada y verificada.',
                card_title: 'Estado de Gmail',
                card_subtitle: 'user@gmail.com',
                badge: 'ACTIVO',
                lbl_status: 'Estado',
                val_status: 'IMAP y SMTP verificados',
                lbl_account: 'Cuenta',
                lbl_imap: 'IMAP',
                lbl_smtp: 'SMTP',
                lbl_unread: 'No leídos',
                btn_1: 'Bandeja',
                btn_2: 'Ayuda',
                btn_3: 'Desconectar',
              }),
            },
          };
        }
        throw new Error('Unexpected call');
      }
    );
    assert(out.type === 'ui' && out.ui.badgeColor === 'green' && out.ui.icon === 'check', 'Green status card');
    const kv = out.ui.elements[0].items;
    assert(kv.some((x) => x.value === 'user@gmail.com') && kv.some((x) => x.value === '3'), 'Account and unread count in status card');
    assert(out.ui.elements[2].buttons.length === 3 && out.ui.elements[2].buttons[2].confirm === true, '3 action buttons including confirmed disconnect');
  }

  // Test 5: Configured /gmail when IMAP auth fails -> Red Error Flutter UI Card
  {
    const storage = { chattree_email_account: 'user@gmail.com', chattree_email_imap_host: 'imap.gmail.com' };
    const out = await execPlugin(
      'lang=en',
      (req) => ({ success: true, data: { key: req.payload.key, value: storage[req.payload.key] || null, exists: !!storage[req.payload.key] } }),
      async (req) => {
        if (req.api === 'email' && req.operation === 'inbox') {
          return { success: false, error: 'Authentication failed (Invalid credentials)' };
        }
        if (req.api === 'ai') {
          return {
            success: true,
            data: {
              text: JSON.stringify({
                intro: 'Saved Gmail credentials failed IMAP authentication.',
                card_title: 'Gmail Error',
                card_subtitle: 'user@gmail.com',
                badge: 'AUTH FAILED',
                lbl_account: 'Account',
                lbl_imap: 'IMAP',
                err_text: 'Please generate a fresh 16-char Google App Password and run /gmail config.',
                btn_1: 'Retry',
                btn_2: 'Disconnect',
              }),
            },
          };
        }
        throw new Error('Unexpected call');
      }
    );
    assert(out.type === 'ui' && out.ui.badgeColor === 'red' && out.ui.icon === 'error', 'Red error card on failed IMAP verify');
  }

  // Test 6: Inbox list + Read (with ToolRegistry.normalizeArgs rewriting read->get!) + Send + Disconnect + Help + AI fallback
  {
    const outInbox = await execPlugin(
      JSON.stringify({ api: 'gmail', operation: 'inbox', payload: { lang: 'es' } }),
      () => ({ success: true, data: { exists: false } }),
      async (req) => {
        if (req.api === 'email' && req.operation === 'inbox') {
          return {
            success: true,
            data: {
              status: 'success',
              account: 'user@gmail.com',
              unread_count: 1,
              total_count: 2,
              emails: [
                { id: '12', from: 'Ana <ana@test.com>', subject: 'Factura Noviembre', date: '2026-11-18 10:00', unread: true, snippet: 'Adjunto factura.' },
                { id: '11', from: 'Equipo <team@test.com>', subject: 'Resumen', date: '2026-11-17 09:00', unread: false, snippet: 'Todo listo.' },
              ],
            },
          };
        }
        return { success: true, data: { text: '{"intro":"Tienes 1 correo sin leer.","card_title":"Bandeja","card_subtitle":"user@gmail.com","badge":"1 NUEVO","btn_1":"Actualizar","btn_2":"Estado"}' } };
      }
    );
    assert(outInbox.type === 'ui' && outInbox.ui.elements[0].type === 'list' && outInbox.ui.elements[0].items.length === 2, 'Inbox list rendered');
    assert(outInbox.ui.elements[0].items[0].title.includes('[12]') && outInbox.ui.elements[0].items[0].title.includes('Factura Noviembre'), 'Email ID and subject shown');

    // Normalized action "get" -> email.read!
    const outRead = await execPlugin(
      JSON.stringify({ api: 'gmail', operation: 'get', payload: { id: '12', lang: 'es' } }),
      () => ({ success: true, data: { exists: false } }),
      async (req) => {
        if (req.api === 'email' && req.operation === 'read') {
          assert(req.payload.id === '12', 'Read ID forwarded');
          return {
            success: true,
            data: { id: '12', from: 'Ana <ana@test.com>', to: 'user@gmail.com', subject: 'Factura Noviembre', date: '2026-11-18 10:00', body: 'Hola,\nTe envío la factura.\nSaludos.' },
          };
        }
        if (req.api === 'ai') {
          return { success: true, data: { text: '{"intro":"Correo de Ana sobre la factura de noviembre.","card_title":"Mensaje #12","card_subtitle":"Ana","badge":"CORREO","lbl_from":"De","lbl_to":"Para","lbl_subject":"Asunto","lbl_date":"Fecha","btn_1":"Bandeja"}' } };
        }
        throw new Error('Unexpected read call: ' + JSON.stringify(req));
      }
    );
    assert(outRead.type === 'ui' && outRead.ui.elements[2].type === 'text' && outRead.ui.elements[2].content.includes('Te envío la factura.'), 'Full email body in UI card');

    const outSend = await execPlugin(
      JSON.stringify({ api: 'gmail', operation: 'send', payload: { to: 'alex@example.com', subject: 'Hola', body: 'Contenido', lang: 'es' } }),
      () => ({ success: true, data: { exists: false } }),
      async (req) => {
        if (req.api === 'email' && req.operation === 'send') return { success: true, data: { sent: true, to: 'alex@example.com', subject: 'Hola' } };
        return { success: true, data: { text: '{"intro":"Correo enviado.","card_title":"Enviado","badge":"ENVIADO","lbl_to":"Para","lbl_subject":"Asunto","lbl_status":"Estado","val_status":"Entregado","btn_1":"Bandeja"}' } };
      }
    );
    assert(outSend.type === 'ui' && outSend.ui.icon === 'check', 'Send confirmation card');

    const outDisc = await execPlugin(
      JSON.stringify({ api: 'gmail', operation: 'disconnect', payload: { lang: 'en' } }),
      () => ({ success: true, data: { exists: false } }),
      async (req) => {
        if (req.api === 'email' && req.operation === 'disconnect') return { success: true, data: { disconnected: true } };
        return { success: false, error: 'AI offline' }; // Verify AI offline fallback too!
      }
    );
    assert(outDisc.type === 'ui' && outDisc.ui.badgeColor === 'blue', 'Disconnect fallback card');

    const outHelp = await execPlugin(
      'help lang=es',
      () => ({ success: true, data: { exists: false } }),
      async (req) => {
        assert(req.api === 'ai' && req.payload.systemPrompt.includes('"es"'), 'Help uses lang es');
        return { success: true, data: { text: 'Para conectar Gmail usa /gmail config <correo> <contraseña de aplicación>.' } };
      }
    );
    assert(outHelp.type === 'direct' && outHelp.displayText.includes('/gmail config'), 'Help direct AI output');
  }

  console.log('ALL GMAIL WASM TESTS PASSED (6/6 suites)!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
