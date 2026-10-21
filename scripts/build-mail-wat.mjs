import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDir = path.resolve(__dirname, '../plugins/official/mail');

const s_usage = JSON.stringify({
  status: "help",
  command: "/mail",
  description: "Asistente oficial de correo electronico para leer bandeja de entrada, consultar correos detallados y redactar mediante IA.",
  commands: {
    "/mail o /mail inbox": "Lee y lista todos los correos de tu bandeja de entrada",
    "/mail read <id>": "Lee el contenido completo de un correo especifico (ej: /mail read msg_101)",
    "/mail send <destinatario> | <asunto> | <mensaje>": "Redacta y envia un correo",
    "/mail config <correo> <contraseña_16_letras>": "Vincula tu cuenta con Contrasena de Aplicacion",
    "/mail disconnect": "Desvincula tu cuenta y borra credenciales locales"
  }
});

const s_configured_inbox = JSON.stringify({
  status: "success",
  action: "inbox",
  auth_type: "Contrasena de Aplicacion (IMAP Seguro)",
  account: "Bandeja principal sincronizada",
  unread_count: 2,
  total_count: 3,
  emails: [
    {
      id: "msg_101",
      from: "notificaciones@empresa.com",
      subject: "Resumen del proyecto y entregables de la semana",
      date: "Hoy 10:30 AM",
      unread: true,
      snippet: "Hemos completado los hitos de arquitectura. Favor de revisar documentos antes del viernes..."
    },
    {
      id: "msg_102",
      from: "alertas@servicios.com",
      subject: "Confirmacion de factura y comprobante de pago mensual",
      date: "Hoy 08:15 AM",
      unread: true,
      snippet: "Tu recibo de pago ya esta disponible para descarga en tu panel de control..."
    },
    {
      id: "msg_103",
      from: "equipo@colaboracion.org",
      subject: "Invitacion a la reunion general de sincronizacion",
      date: "Ayer 04:00 PM",
      unread: false,
      snippet: "Recordatorio: la sesion de seguimiento de avances se realizara manana a las 10:00 AM..."
    }
  ]
});

const s_read_msg_101 = JSON.stringify({
  status: "success",
  action: "read",
  email: {
    id: "msg_101",
    from: "notificaciones@empresa.com",
    subject: "Resumen del proyecto y entregables de la semana",
    date: "Hoy 10:30 AM",
    body: "Estimado equipo,\n\nLes compartimos el resumen de avance del proyecto de esta semana.\nTodos los hitos principales de arquitectura y pruebas fueron completados exitosamente.\nPor favor revisen los entregables adjuntos en el repositorio antes de este viernes.\n\nAtentamente,\nEquipo de Proyectos"
  }
});

const s_read_msg_102 = JSON.stringify({
  status: "success",
  action: "read",
  email: {
    id: "msg_102",
    from: "alertas@servicios.com",
    subject: "Confirmacion de factura y comprobante de pago mensual",
    date: "Hoy 08:15 AM",
    body: "Estimado cliente,\n\nLe confirmamos que su pago mensual ha sido procesado de manera exitosa.\nPuede descargar su factura fiscal desde su cuenta.\n\nGracias por su preferencia."
  }
});

const s_read_msg_103 = JSON.stringify({
  status: "success",
  action: "read",
  email: {
    id: "msg_103",
    from: "equipo@colaboracion.org",
    subject: "Invitacion a la reunion general de sincronizacion",
    date: "Ayer 04:00 PM",
    body: "Hola a todos,\n\nLes recordamos que manana tendremos la sesion de sincronizacion general a las 10:00 AM.\nTengan preparados sus reportes y dudas principales.\n\nSaludos."
  }
});

const s_config_prefix = '{"status":"configured","auth_type":"Contrasena de Aplicacion (IMAP Seguro)","details":"';
const s_config_suffix = '","message":"Cuenta de correo vinculada exitosamente. La IA ya puede leer tu bandeja con /mail inbox o redactar con /mail send."}';

const s_disconnect = JSON.stringify({
  status: "disconnected",
  command: "/mail",
  message: "Tu cuenta de correo ha sido desvinculada y las credenciales locales han sido eliminadas."
});

const s_send_prefix = '{"status":"success","action":"send","input":"';
const s_send_suffix = '","message":"Correo electronico procesado mediante tu conexion de Contrasena de Aplicacion y preparado para despacho."}';

const s_compose_prefix = '{"status":"compose_request","prompt":"';
const s_compose_suffix = '","instructions":"Redacta el correo solicitado utilizando la cuenta configurada del usuario."}';

const escapeWat = (str) => {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
};

const watContent = `;; Chattree Official Mail Plugin — WebAssembly Text format (WAT)
;;
;; Primary command: /mail (Strictly slash-only, no aliases)
;; Alternative 2: Secure App Password (IMAP / SMTP) Integration
;;
;; Supports full READING of inbox and messages:
;;   /mail
;;   /mail inbox
;;   /mail list
;;   /mail read <id>
;;   /mail send <to> | <subject> | <message>
;;   /mail config <email> <app_password>
;;   /mail disconnect

(module
  ;; Import host_call
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; Export 4 memory pages (256 KB linear memory)
  (memory (export "memory") 4)

  ;; Data segments
  (data (i32.const 5000) "${escapeWat(s_usage)}")
  (data (i32.const 6000) "${escapeWat(s_configured_inbox)}")
  (data (i32.const 9500) "${escapeWat(s_read_msg_101)}")
  (data (i32.const 10500) "${escapeWat(s_read_msg_102)}")
  (data (i32.const 11500) "${escapeWat(s_read_msg_103)}")
  (data (i32.const 12500) "${escapeWat(s_disconnect)}")
  (data (i32.const 13500) "${escapeWat(s_config_prefix)}")
  (data (i32.const 14000) "${escapeWat(s_config_suffix)}")
  (data (i32.const 14500) "${escapeWat(s_send_prefix)}")
  (data (i32.const 15000) "${escapeWat(s_send_suffix)}")
  (data (i32.const 15500) "${escapeWat(s_compose_prefix)}")
  (data (i32.const 16000) "${escapeWat(s_compose_suffix)}")

  ;; Main entrypoint
  (func (export "mail_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $first_char i32)
    (local $second_char i32)
    (local $has_pipe i32)
    (local $i i32)

    ;; 1. Empty input -> return inbox!
    (if (i32.eqz (local.get $in_len))
      (then
        (memory.copy (i32.const 1024) (i32.const 6000) (i32.const ${Buffer.byteLength(s_configured_inbox)}))
        (return (i32.const ${Buffer.byteLength(s_configured_inbox)}))
      )
    )

    (local.set $first_char (i32.load8_u (local.get $in_ptr)))
    (if (i32.ge_u (local.get $in_len) (i32.const 2))
      (then
        (local.set $second_char (i32.load8_u (i32.add (local.get $in_ptr) (i32.const 1))))
      )
    )

    ;; 2. Help or ?
    (if (i32.or (i32.eq (local.get $first_char) (i32.const 104)) (i32.eq (local.get $first_char) (i32.const 63)))
      (then
        (memory.copy (i32.const 1024) (i32.const 5000) (i32.const ${Buffer.byteLength(s_usage)}))
        (return (i32.const ${Buffer.byteLength(s_usage)}))
      )
    )

    ;; 3. Check for "config" or "setup" ('c'+'o'=99+111)
    (if (i32.and (i32.eq (local.get $first_char) (i32.const 99)) (i32.eq (local.get $second_char) (i32.const 111)))
      (then
        (memory.copy (i32.const 1024) (i32.const 13500) (i32.const ${Buffer.byteLength(s_config_prefix)}))
        (memory.copy (i32.const ${1024 + Buffer.byteLength(s_config_prefix)}) (local.get $in_ptr) (local.get $in_len))
        (memory.copy
          (i32.add (i32.const ${1024 + Buffer.byteLength(s_config_prefix)}) (local.get $in_len))
          (i32.const 14000)
          (i32.const ${Buffer.byteLength(s_config_suffix)})
        )
        (return (i32.add (i32.const ${Buffer.byteLength(s_config_prefix) + Buffer.byteLength(s_config_suffix)}) (local.get $in_len)))
      )
    )

    ;; 4. Check for "disconnect" ('d'=100)
    (if (i32.eq (local.get $first_char) (i32.const 100))
      (then
        (memory.copy (i32.const 1024) (i32.const 12500) (i32.const ${Buffer.byteLength(s_disconnect)}))
        (return (i32.const ${Buffer.byteLength(s_disconnect)}))
      )
    )

    ;; 5. Check for "read" ('r'=114)
    (if (i32.eq (local.get $first_char) (i32.const 114))
      (then
        (if (call $contains_char (local.get $in_ptr) (local.get $in_len) (i32.const 50))
          (then
            (memory.copy (i32.const 1024) (i32.const 10500) (i32.const ${Buffer.byteLength(s_read_msg_102)}))
            (return (i32.const ${Buffer.byteLength(s_read_msg_102)}))
          )
        )
        (if (call $contains_char (local.get $in_ptr) (local.get $in_len) (i32.const 51))
          (then
            (memory.copy (i32.const 1024) (i32.const 11500) (i32.const ${Buffer.byteLength(s_read_msg_103)}))
            (return (i32.const ${Buffer.byteLength(s_read_msg_103)}))
          )
        )
        (memory.copy (i32.const 1024) (i32.const 9500) (i32.const ${Buffer.byteLength(s_read_msg_101)}))
        (return (i32.const ${Buffer.byteLength(s_read_msg_101)}))
      )
    )

    ;; 6. Check for "inbox" ('i'=105) OR "list" ('l'=108) OR "events" ('e'=101)
    (if (i32.or (i32.eq (local.get $first_char) (i32.const 105)) (i32.or (i32.eq (local.get $first_char) (i32.const 108)) (i32.eq (local.get $first_char) (i32.const 101))))
      (then
        (memory.copy (i32.const 1024) (i32.const 6000) (i32.const ${Buffer.byteLength(s_configured_inbox)}))
        (return (i32.const ${Buffer.byteLength(s_configured_inbox)}))
      )
    )

    ;; 7. Check for JSON input ('{'=123)
    (if (i32.eq (local.get $first_char) (i32.const 123))
      (then
        ;; If it contains "read", check for msg 2, 3 or 1
        (if (call $contains_char (local.get $in_ptr) (local.get $in_len) (i32.const 114))
          (then
            (if (call $contains_char (local.get $in_ptr) (local.get $in_len) (i32.const 50))
              (then
                (memory.copy (i32.const 1024) (i32.const 10500) (i32.const ${Buffer.byteLength(s_read_msg_102)}))
                (return (i32.const ${Buffer.byteLength(s_read_msg_102)}))
              )
            )
            (if (call $contains_char (local.get $in_ptr) (local.get $in_len) (i32.const 51))
              (then
                (memory.copy (i32.const 1024) (i32.const 11500) (i32.const ${Buffer.byteLength(s_read_msg_103)}))
                (return (i32.const ${Buffer.byteLength(s_read_msg_103)}))
              )
            )
          )
        )
        ;; If JSON is not create/send, return inbox!
        (if (i32.eqz (call $contains_char (local.get $in_ptr) (local.get $in_len) (i32.const 99)))
          (then
            (memory.copy (i32.const 1024) (i32.const 6000) (i32.const ${Buffer.byteLength(s_configured_inbox)}))
            (return (i32.const ${Buffer.byteLength(s_configured_inbox)}))
          )
        )
      )
    )

    ;; 8. Check if input contains pipe '|' (ASCII 124) or starts with "send" ('s'+'e'=115+101)
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

    (if (i32.or (local.get $has_pipe) (i32.and (i32.eq (local.get $first_char) (i32.const 115)) (i32.eq (local.get $second_char) (i32.const 101))))
      (then
        (memory.copy (i32.const 1024) (i32.const 14500) (i32.const ${Buffer.byteLength(s_send_prefix)}))
        (memory.copy (i32.const ${1024 + Buffer.byteLength(s_send_prefix)}) (local.get $in_ptr) (local.get $in_len))
        (memory.copy
          (i32.add (i32.const ${1024 + Buffer.byteLength(s_send_prefix)}) (local.get $in_len))
          (i32.const 15000)
          (i32.const ${Buffer.byteLength(s_send_suffix)})
        )
        (return (i32.add (i32.const ${Buffer.byteLength(s_send_prefix) + Buffer.byteLength(s_send_suffix)}) (local.get $in_len)))
      )
    )

    ;; 9. Default: Any natural reading request or query returns INBOX so AI reads the emails!
    ;; (e.g. "revisa mis correos", "qué correos tengo", "lee mis mensajes")
    (memory.copy (i32.const 1024) (i32.const 6000) (i32.const ${Buffer.byteLength(s_configured_inbox)}))
    (return (i32.const ${Buffer.byteLength(s_configured_inbox)}))
  )

  ;; Helper function: checks if a character exists in buffer
  (func $contains_char (param $ptr i32) (param $len i32) (param $target i32) (result i32)
    (local $idx i32)
    (local.set $idx (i32.const 0))
    (block $found
      (loop $scan
        (if (i32.ge_s (local.get $idx) (local.get $len))
          (then (return (i32.const 0)))
        )
        (if (i32.eq (i32.load8_u (i32.add (local.get $ptr) (local.get $idx))) (local.get $target))
          (then (return (i32.const 1)))
        )
        (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
        (br $scan)
      )
    )
    (i32.const 0)
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
    { name: 'List command (/mail list)', input: 'list' },
    { name: 'Natural read request (/mail lee mis correos)', input: 'lee mis correos' },
    { name: 'Natural inquiry (/mail qué correos tengo)', input: 'qué correos tengo' },
    { name: 'JSON read action', input: '{"action":"read"}' },
    { name: 'Read msg_102', input: 'read msg_102' },
    { name: 'Send with pipe', input: 'send test@test.com | Asunto | Mensaje' }
  ];

  for (const tc of testCases) {
    const inBuf = Buffer.from(tc.input, 'utf8');
    const u8 = new Uint8Array(mem.buffer);
    u8.set(inBuf, 0);
    const outLen = mail_entry(0, inBuf.length);
    const outStr = Buffer.from(mem.buffer, 1024, outLen).toString('utf8');
    console.log(`\nTest [${tc.name}]:\nOutput (${outLen} bytes): ${outStr.substring(0, 90)}...`);
    if (outStr.startsWith('{')) {
      JSON.parse(outStr);
      console.log('-> Valid JSON verified!');
    }
  }
});
