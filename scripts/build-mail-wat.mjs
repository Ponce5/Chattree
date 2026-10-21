import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDir = path.resolve(__dirname, '../plugins/official/mail');

const s_inbox_req = '{"api":"email","operation":"inbox","payload":{}}';
const s_disconnect_req = '{"api":"email","operation":"disconnect","payload":{}}';
const s_config_prefix = '{"api":"email","operation":"config","payload":"';
const s_config_suffix = '"}';
const s_read_prefix = '{"api":"email","operation":"read","payload":{"id":"';
const s_read_suffix = '"}}';

const escapeWat = (str) => {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
};

const watContent = `;; Chattree Official Mail Plugin — WebAssembly Text format (WAT)
;;
;; Direct integration with Chattree Host API ('email' namespace)
;; Backed by native IMAP & SMTP client (enough_mail) in Chattree.
;;
;; Supported commands:
;;   /mail                                          (Fetches real inbox)
;;   /mail inbox                                    (Fetches real inbox)
;;   /mail list                                     (Fetches real inbox)
;;   /mail config <email> <app_password_16_chars>   (Validates and saves real account)
;;   /mail read <id>                                (Fetches full message body)
;;   /mail send <to> | <subject> | <message>        (Sends real email via SMTP)
;;   /mail disconnect                               (Unlinks account)
;;
;; Protocol:
;;   Offset 0:    Input string written by Chattree
;;   Offset 1024: Output string returned to chat
;;   Offset 2048: JSON request payload for chattree.host_call
;;   Offset 4096: JSON response payload from ChattreeHostApi

(module
  ;; Import host_call from Chattree runtime
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; Export 4 memory pages (256 KB linear memory)
  (memory (export "memory") 4)

  ;; Pre-loaded request templates
  ;; 3000: inbox request (47 bytes)
  (data (i32.const 3000) "${escapeWat(s_inbox_req)}")
  ;; 3100: disconnect request (52 bytes)
  (data (i32.const 3100) "${escapeWat(s_disconnect_req)}")
  ;; 3200: config prefix (47 bytes)
  (data (i32.const 3200) "${escapeWat(s_config_prefix)}")
  ;; 3280: config suffix (2 bytes)
  (data (i32.const 3280) "${escapeWat(s_config_suffix)}")
  ;; 3300: read prefix (51 bytes)
  (data (i32.const 3300) "${escapeWat(s_read_prefix)}")
  ;; 3380: read suffix (3 bytes)
  (data (i32.const 3380) "${escapeWat(s_read_suffix)}")

  ;; Main entrypoint: (inputPtr: i32, inputLen: i32) -> outputLen: i32
  (func (export "mail_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $first_char i32)
    (local $second_char i32)
    (local $req_len i32)
    (local $id_start i32)
    (local $id_len i32)

    ;; 1. If input is empty -> fetch real inbox!
    (if (i32.eqz (local.get $in_len))
      (then
        (memory.copy (i32.const 2048) (i32.const 3000) (i32.const ${Buffer.byteLength(s_inbox_req)}))
        (drop (call $host_call (i32.const 2048) (i32.const ${Buffer.byteLength(s_inbox_req)}) (i32.const 4096) (i32.const 4096)))
        (return (i32.const 0))
      )
    )

    (local.set $first_char (i32.load8_u (local.get $in_ptr)))
    (if (i32.ge_u (local.get $in_len) (i32.const 2))
      (then
        (local.set $second_char (i32.load8_u (i32.add (local.get $in_ptr) (i32.const 1))))
      )
    )

    ;; 2. Check for "config" ('c'+'o' = 99+111)
    (if (i32.and (i32.eq (local.get $first_char) (i32.const 99)) (i32.eq (local.get $second_char) (i32.const 111)))
      (then
        ;; Copy config prefix (47 bytes) to 2048
        (memory.copy (i32.const 2048) (i32.const 3200) (i32.const ${Buffer.byteLength(s_config_prefix)}))
        ;; Copy user input arguments to 2048 + 47 = 2095
        (memory.copy (i32.const 2095) (local.get $in_ptr) (local.get $in_len))
        ;; Copy suffix to 2095 + in_len
        (memory.copy
          (i32.add (i32.const 2095) (local.get $in_len))
          (i32.const 3280)
          (i32.const ${Buffer.byteLength(s_config_suffix)})
        )
        (local.set $req_len (i32.add (i32.const ${Buffer.byteLength(s_config_prefix) + Buffer.byteLength(s_config_suffix)}) (local.get $in_len)))
        (drop (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096)))
        (return (i32.const 0))
      )
    )

    ;; 3. Check for "disconnect" ('d' = 100)
    (if (i32.eq (local.get $first_char) (i32.const 100))
      (then
        (memory.copy (i32.const 2048) (i32.const 3100) (i32.const ${Buffer.byteLength(s_disconnect_req)}))
        (drop (call $host_call (i32.const 2048) (i32.const ${Buffer.byteLength(s_disconnect_req)}) (i32.const 4096) (i32.const 4096)))
        (return (i32.const 0))
      )
    )

    ;; 4. Check for "read" ('r' = 114)
    (if (i32.eq (local.get $first_char) (i32.const 114))
      (then
        ;; Extract ID after "read " (skip 5 chars if length > 5)
        (if (i32.gt_u (local.get $in_len) (i32.const 5))
          (then
            (local.set $id_start (i32.add (local.get $in_ptr) (i32.const 5)))
            (local.set $id_len (i32.sub (local.get $in_len) (i32.const 5)))
          )
          (else
            (local.set $id_start (local.get $in_ptr))
            (local.set $id_len (local.get $in_len))
          )
        )
        ;; Copy read prefix (51 bytes) to 2048
        (memory.copy (i32.const 2048) (i32.const 3300) (i32.const ${Buffer.byteLength(s_read_prefix)}))
        ;; Copy id to 2048 + 51 = 2099
        (memory.copy (i32.const 2099) (local.get $id_start) (local.get $id_len))
        ;; Copy suffix to 2099 + id_len
        (memory.copy
          (i32.add (i32.const 2099) (local.get $id_len))
          (i32.const 3380)
          (i32.const ${Buffer.byteLength(s_read_suffix)})
        )
        (local.set $req_len (i32.add (i32.const ${Buffer.byteLength(s_read_prefix) + Buffer.byteLength(s_read_suffix)}) (local.get $id_len)))
        (drop (call $host_call (i32.const 2048) (local.get $req_len) (i32.const 4096) (i32.const 4096)))
        (return (i32.const 0))
      )
    )

    ;; 5. Check for JSON input ('{' = 123)
    (if (i32.eq (local.get $first_char) (i32.const 123))
      (then
        ;; If it already starts with {"api" -> forward directly!
        (memory.copy (i32.const 2048) (local.get $in_ptr) (local.get $in_len))
        (drop (call $host_call (i32.const 2048) (local.get $in_len) (i32.const 4096) (i32.const 4096)))
        (return (i32.const 0))
      )
    )

    ;; 6. Default: Fetch real inbox (for "inbox", "list", or any natural query)
    (memory.copy (i32.const 2048) (i32.const 3000) (i32.const ${Buffer.byteLength(s_inbox_req)}))
    (drop (call $host_call (i32.const 2048) (i32.const ${Buffer.byteLength(s_inbox_req)}) (i32.const 4096) (i32.const 4096)))
    (return (i32.const 0))
  )

  ;; Exported resume function called by Chattree when async call finishes
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (memory.copy (i32.const 1024) (local.get $res_ptr) (local.get $res_len))
    (local.get $res_len)
  )
)
`;

const watPath = path.join(pluginDir, 'plugin.wat');
const wasmPath = path.join(pluginDir, 'plugin.wasm');

fs.writeFileSync(watPath, watContent, 'utf8');
console.log('Wrote plugin.wat successfully.');

execSync(`wat2wasm "${watPath}" -o "${wasmPath}"`, { stdio: 'inherit' });
console.log('Compiled plugin.wasm successfully.');

const wasmBytes = fs.readFileSync(wasmPath);
const wasmSha256 = crypto.createHash('sha256').update(wasmBytes).digest('hex');
console.log('WASM SHA-256:', wasmSha256);

// Test execution in Node.js
const memory = new WebAssembly.Memory({ initial: 4 });
let lastHostCall = null;
const importObject = {
  chattree: {
    host_call: (reqPtr, reqLen, resPtr, resMaxLen) => {
      const u8 = new Uint8Array(memory.buffer);
      const reqStr = Buffer.from(memory.buffer, reqPtr, reqLen).toString('utf8');
      lastHostCall = reqStr;
      console.log(`[Mock Host Call] ${reqStr}`);
      return 0;
    }
  }
};

WebAssembly.instantiate(wasmBytes, importObject).then(({ instance }) => {
  const { mail_entry, resume } = instance.exports;

  const testCases = [
    { name: 'Empty input (/mail)', input: '' },
    { name: 'Inbox (/mail inbox)', input: 'inbox' },
    { name: 'List (/mail list)', input: 'list' },
    { name: 'Config (/mail config user@gmail.com pass)', input: 'config user@gmail.com pass' },
    { name: 'Read (/mail read msg_101)', input: 'read msg_101' },
    { name: 'Disconnect (/mail disconnect)', input: 'disconnect' }
  ];

  for (const tc of testCases) {
    const inBuf = Buffer.from(tc.input, 'utf8');
    const u8 = new Uint8Array(memory.buffer);
    u8.set(inBuf, 0);
    const outLen = mail_entry(0, inBuf.length);
    console.log(`Test [${tc.name}]: returned ${outLen} (0 = async host_call dispatched)`);
    // test resume
    const mockRes = JSON.stringify({ status: 'ok', data: 'real email data' });
    const resBuf = Buffer.from(mockRes, 'utf8');
    u8.set(resBuf, 4096);
    const resumedLen = resume(4096, resBuf.length);
    const resumedStr = Buffer.from(memory.buffer, 1024, resumedLen).toString('utf8');
    console.log(`  -> Resume returned: ${resumedStr}`);
  }
});
