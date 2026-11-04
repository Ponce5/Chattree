/**
 * Chattree Webhook Relay — Cloudflare Worker (plan gratuito)
 *
 * Recibe un webhook HTTP normal (GitHub, Stripe, curl, IoT...) y lo reenvia
 * por Firebase Cloud Messaging al telefono, aunque Chattree este cerrado.
 *
 * El Worker NO autentica el webhook: solo lo transporta. El token Bearer o la
 * firma HMAC se verifican dentro de Chattree, en el dispositivo.
 *
 * Secretos requeridos (wrangler secret put <NOMBRE>):
 *   FIREBASE_SERVICE_ACCOUNT  JSON completo de la cuenta de servicio de Firebase
 *   FCM_TOKEN                 Token FCM del telefono (se copia desde Chattree)
 *
 * URL de uso:
 *   POST https://<tu-worker>.workers.dev/plugins/<pluginId>/<ruta>
 *   (misma ruta que muestra Chattree en Ajustes > Plugins > Webhooks Entrantes)
 */

const MAX_BODY_CHARS = 3500; // FCM permite ~4 KB en "data"
const FORWARDED_HEADERS = new Set([
  'authorization',
  'content-type',
  'x-chattree-delivery-id',
  'x-chattree-signature-256',
  'x-github-delivery',
  'x-hub-signature-256',
  'x-signature-256',
  'x-signature-sha256',
]);

let cachedToken = null; // { value, expiresAt }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
    }
    if (!url.pathname.startsWith('/plugins/')) {
      return json({ error: 'not_found' }, 404);
    }
    if (!env.FIREBASE_SERVICE_ACCOUNT || !env.FCM_TOKEN) {
      return json({ error: 'relay_not_configured' }, 500);
    }

    const body = await request.text();
    if (body.length > MAX_BODY_CHARS) {
      return json({ error: 'payload_too_large', maxChars: MAX_BODY_CHARS }, 413);
    }
    // Chattree exige un objeto JSON; se descarta basura antes de gastar un push.
    try {
      const parsed = JSON.parse(body);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return json({ error: 'json_object_required' }, 400);
      }
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }

    const headers = {};
    for (const [name, value] of request.headers) {
      if (FORWARDED_HEADERS.has(name.toLowerCase())) headers[name] = value;
    }
    if (!headers['authorization'] && !headers['Authorization'] &&
        !Object.keys(headers).some((h) => h.toLowerCase().includes('signature'))) {
      return json({ error: 'missing_credentials' }, 401);
    }

    let account;
    try {
      account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
    } catch {
      return json({ error: 'relay_misconfigured' }, 500);
    }

    try {
      const accessToken = await getAccessToken(account);
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: env.FCM_TOKEN,
              // Solo "data": despierta el handler de fondo de Chattree.
              data: {
                path: url.pathname,
                body,
                headers: JSON.stringify(headers),
              },
              android: { priority: 'HIGH' },
            },
          }),
        },
      );
      if (!res.ok) {
        return json({ error: 'fcm_rejected', status: res.status }, 502);
      }
      return json({ status: 'queued' }, 202);
    } catch {
      return json({ error: 'relay_unavailable' }, 503);
    }
  },
};

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

/** OAuth2 de Google con JWT RS256 (WebCrypto, sin dependencias). */
async function getAccessToken(account) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.value;

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error('oauth_failed');
  const data = await res.json();
  cachedToken = { value: data.access_token, expiresAt: now + (data.expires_in || 3600) };
  return cachedToken.value;
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function b64url(input) {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
