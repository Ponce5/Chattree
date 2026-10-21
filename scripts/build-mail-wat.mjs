import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDir = path.resolve(__dirname, '../plugins/official/mail');

const s_usage = "Uso: /mail | /mail send destinatario | asunto | mensaje | /mail gmail | /mail outlook";

const s_inbox = JSON.stringify({
  status: "ready",
  command: "/mail",
  service: "Gmail / Outlook / Default Mail",
  inbox: [],
  unread: 0,
  message: "Bandeja local sin correos pendientes. Para redactar o preparar un correo para Gmail u Outlook usa /mail send destinatario | asunto | mensaje"
});

const s_gmail = JSON.stringify({
  status: "info",
  service: "Gmail",
  compose_url: "https://mail.google.com/mail/?view=cm&fs=1",
  instructions: "Para redactar un correo de Gmail usa /mail send usuario@ejemplo.com | Asunto | Mensaje"
});

const s_outlook = JSON.stringify({
  status: "info",
  service: "Outlook",
  compose_url: "https://outlook.office.com/mail/deeplink/compose",
  instructions: "Para redactar un correo de Outlook usa /mail send usuario@ejemplo.com | Asunto | Mensaje"
});

const s_compose_prefix = '{"status":"compose_request","prompt":"';
const s_compose_suffix = '","instructions":"Genera el correo solicitado para Gmail y Outlook sin inventar correos previos inexistentes."}';

const s_send_prefix = '{"status":"success","action":"compose","input":"';
const s_send_suffix = '","message":"Borrador preparado para envio en Gmail y Outlook. La IA formateara el correo con los enlaces directos."}';

const escapeWat = (str) => {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
};

const watContent = `;; Chattree Official Mail Plugin — WebAssembly Text format (WAT)
;;
;; Primary command: /mail (Strictly slash-only, no aliases)
;; Subcommands:    /mail
;;                 /mail send <destinatario> | <asunto> | <mensaje>
;;                 /mail gmail
;;                 /mail outlook
;;
;; Protocol:
;;   Offset 0:    Input string written by Chattree (/mail arguments)
;;   Offset 1024: Output string returned to chat (structured JSON for conversational AI)
;;   Offset 2048: Host API request buffer
;;   Offset 4096: Host API response buffer

(module
  ;; Import host_call
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; Export 4 memory pages (256 KB linear memory)
  (memory (export "memory") 4)

  ;; Data segments
  (data (i32.const 5000) "${escapeWat(s_usage)}")
  (data (i32.const 6000) "${escapeWat(s_inbox)}")
  (data (i32.const 7000) "${escapeWat(s_gmail)}")
  (data (i32.const 8000) "${escapeWat(s_outlook)}")
  (data (i32.const 9000) "${escapeWat(s_compose_prefix)}")
  (data (i32.const 9500) "${escapeWat(s_compose_suffix)}")
  (data (i32.const 10000) "${escapeWat(s_send_prefix)}")
  (data (i32.const 10500) "${escapeWat(s_send_suffix)}")

  ;; Main entrypoint
  (func (export "mail_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $first_char i32)
    (local $has_pipe i32)
    (local $i i32)

    ;; 1. Empty input -> return clean inbox/status (no fake data)
    (if (i32.eqz (local.get $in_len))
      (then
        (memory.copy (i32.const 1024) (i32.const 6000) (i32.const ${Buffer.byteLength(s_inbox)}))
        (return (i32.const ${Buffer.byteLength(s_inbox)}))
      )
    )

    (local.set $first_char (i32.load8_u (local.get $in_ptr)))

    ;; 2. Help or ?
    (if (i32.or (i32.eq (local.get $first_char) (i32.const 104)) (i32.eq (local.get $first_char) (i32.const 63)))
      (then
        (memory.copy (i32.const 1024) (i32.const 5000) (i32.const ${Buffer.byteLength(s_usage)}))
        (return (i32.const ${Buffer.byteLength(s_usage)}))
      )
    )

    ;; 3. Check for "gmail" (starts with 'g' = 103)
    (if (i32.eq (local.get $first_char) (i32.const 103))
      (then
        (memory.copy (i32.const 1024) (i32.const 7000) (i32.const ${Buffer.byteLength(s_gmail)}))
        (return (i32.const ${Buffer.byteLength(s_gmail)}))
      )
    )

    ;; 4. Check for "outlook" (starts with 'o' = 111)
    (if (i32.eq (local.get $first_char) (i32.const 111))
      (then
        (memory.copy (i32.const 1024) (i32.const 8000) (i32.const ${Buffer.byteLength(s_outlook)}))
        (return (i32.const ${Buffer.byteLength(s_outlook)}))
      )
    )

    ;; 5. Check if input contains pipe '|' (ASCII 124) or starts with "send" ('s' = 115)
    (local.set $has_pipe (i32.const 0))
    (local.set $i (i32.const 0))
    (block $scan_pipe
      (loop $scan_pipe_loop
        (if (i32.ge_s (local.get $i) (local.get $in_len))
          (then (br $scan_pipe))
        )
        (if (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (local.get $i))) (i32.const 124))
          (then
            (local.set $has_pipe (i32.const 1))
            (br $scan_pipe)
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan_pipe_loop)
      )
    )

    (if (i32.or (local.get $has_pipe) (i32.eq (local.get $first_char) (i32.const 115)))
      (then
        ;; Copy send prefix (48 bytes) to 1024
        (memory.copy (i32.const 1024) (i32.const 10000) (i32.const ${Buffer.byteLength(s_send_prefix)}))
        ;; Copy user input to 1024 + 48 = 1072
        (memory.copy (i32.const 1072) (local.get $in_ptr) (local.get $in_len))
        ;; Copy send suffix (117 bytes) to 1072 + in_len
        (memory.copy
          (i32.add (i32.const 1072) (local.get $in_len))
          (i32.const 10500)
          (i32.const ${Buffer.byteLength(s_send_suffix)})
        )
        (return (i32.add (i32.const ${Buffer.byteLength(s_send_prefix) + Buffer.byteLength(s_send_suffix)}) (local.get $in_len)))
      )
    )

    ;; 6. Check for "inbox" or "status" or "list"
    (if (i32.or (i32.eq (local.get $first_char) (i32.const 105)) (i32.eq (local.get $first_char) (i32.const 108)))
      (then
        (memory.copy (i32.const 1024) (i32.const 6000) (i32.const ${Buffer.byteLength(s_inbox)}))
        (return (i32.const ${Buffer.byteLength(s_inbox)}))
      )
    )

    ;; 7. Default: General composition request for AI (e.g. /mail redacta un correo para cliente@...)
    ;; Copy compose prefix (38 bytes) to 1024
    (memory.copy (i32.const 1024) (i32.const 9000) (i32.const ${Buffer.byteLength(s_compose_prefix)}))
    ;; Copy user input to 1024 + 38 = 1062
    (memory.copy (i32.const 1062) (local.get $in_ptr) (local.get $in_len))
    ;; Copy compose suffix (111 bytes) to 1062 + in_len
    (memory.copy
      (i32.add (i32.const 1062) (local.get $in_len))
      (i32.const 9500)
      (i32.const ${Buffer.byteLength(s_compose_suffix)})
    )
    (return (i32.add (i32.const ${Buffer.byteLength(s_compose_prefix) + Buffer.byteLength(s_compose_suffix)}) (local.get $in_len)))
  )

  ;; Exported resume
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
const importObject = {
  chattree: {
    host_call: () => 0
  }
};

WebAssembly.instantiate(wasmBytes, importObject).then(({ instance }) => {
  const { mail_entry, memory: modMem } = instance.exports;
  const mem = modMem || memory;

  const testCases = [
    { name: 'Empty input (/mail)', input: '' },
    { name: 'Gmail command (/mail gmail)', input: 'gmail' },
    { name: 'Outlook command (/mail outlook)', input: 'outlook' },
    { name: 'Send with pipe (/mail test@example.com | Asunto | Mensaje)', input: 'test@example.com | Asunto | Mensaje' },
    { name: 'General prompt (/mail redacta una respuesta)', input: 'redacta una respuesta' }
  ];

  for (const tc of testCases) {
    const inBuf = Buffer.from(tc.input, 'utf8');
    const u8 = new Uint8Array(mem.buffer);
    u8.set(inBuf, 0);
    const outLen = mail_entry(0, inBuf.length);
    const outStr = Buffer.from(mem.buffer, 1024, outLen).toString('utf8');
    console.log(`\nTest [${tc.name}]:\nOutput (${outLen} bytes): ${outStr.substring(0, 120)}...`);
    // verify it is valid JSON or valid text
    if (outStr.startsWith('{')) {
      JSON.parse(outStr); // should not throw
      console.log('-> Valid JSON verified!');
    }
  }
});
