const OTP_LIFETIME_SECONDS = 5 * 60;
const SEND_COOLDOWN_SECONDS = 60;
const MAX_PHONE_SENDS_PER_DAY = 3;
const MAX_IP_SENDS_PER_DAY = 20;
const MAX_CODE_ATTEMPTS = 5;

function json(data, status, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers.Vary = 'Origin';
  }
  return new Response(status === 204 ? null : JSON.stringify(data), { status, headers });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return origin && allowed.includes(origin) ? origin : '';
}

function normalizePhone(value) {
  const phone = typeof value === 'string' ? value.replace(/[\s()-]/g, '') : '';
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : '';
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > 4096) throw new Error('Kërkesa është tepër e madhe.');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Të dhënat e kërkesës nuk janë JSON i vlefshëm.');
  }
}

function toHex(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function base64Url(value) {
  const bytes = new TextEncoder().encode(value);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlBytes(value) {
  const binary = String.fromCharCode(...new Uint8Array(value));
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemBytes(pem) {
  const base64 = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function createFirebaseCustomToken(phone, phoneHash, env) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: env.FIREBASE_SERVICE_ACCOUNT_EMAIL,
    sub: env.FIREBASE_SERVICE_ACCOUNT_EMAIL,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid: phoneHash,
    claims: { whatsapp_phone: phone }
  }));
  const unsignedToken = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemBytes(env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedToken)
  );
  return `${unsignedToken}.${base64UrlBytes(signature)}`;
}

function createCode() {
  const limit = Math.floor(0x100000000 / 1000000) * 1000000;
  const value = new Uint32Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);
  return String(value[0] % 1000000).padStart(6, '0');
}

async function sendCode(request, env, origin) {
  const body = await readJson(request);
  const phone = normalizePhone(body.phone);
  if (!phone) return json({ error: 'Shkruaj numrin në format ndërkombëtar, p.sh. +38349123456.' }, 400, origin);

  const now = Math.floor(Date.now() / 1000);
  const phoneHash = await hmacHex(env.OTP_HASH_SECRET, `phone:${phone}`);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await hmacHex(env.OTP_HASH_SECRET, `ip:${ip}`);

  await env.DB.prepare('DELETE FROM otp_codes WHERE expires_at <= ?').bind(now).run();
  await env.DB.prepare('DELETE FROM otp_send_log WHERE sent_at <= ?').bind(now - 7 * 86400).run();

  const lastPhoneSend = await env.DB.prepare(
    'SELECT sent_at FROM otp_send_log WHERE phone_hash = ? ORDER BY sent_at DESC LIMIT 1'
  ).bind(phoneHash).first();
  if (lastPhoneSend && now - Number(lastPhoneSend.sent_at) < SEND_COOLDOWN_SECONDS) {
    return json({ error: 'Prit një minutë para se të kërkosh kod tjetër.' }, 429, origin);
  }

  const phoneSends = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM otp_send_log WHERE phone_hash = ? AND sent_at > ?'
  ).bind(phoneHash, now - 86400).first();
  if (Number(phoneSends.count) >= MAX_PHONE_SENDS_PER_DAY) {
    return json({ error: 'U arrit kufiri ditor i kodeve për këtë numër.' }, 429, origin);
  }

  const ipSends = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM otp_send_log WHERE ip_hash = ? AND sent_at > ?'
  ).bind(ipHash, now - 86400).first();
  if (Number(ipSends.count) >= MAX_IP_SENDS_PER_DAY) {
    return json({ error: 'U arrit kufiri ditor i kërkesave. Provo përsëri nesër.' }, 429, origin);
  }

  const sendSlot = await env.DB.prepare(
    `INSERT INTO otp_send_log (phone_hash, ip_hash, sent_at)
     SELECT ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM otp_send_log WHERE phone_hash = ? AND sent_at > ?
     )
     AND (
       SELECT COUNT(*) FROM otp_send_log WHERE phone_hash = ? AND sent_at > ?
     ) < ?
     AND (
       SELECT COUNT(*) FROM otp_send_log WHERE ip_hash = ? AND sent_at > ?
     ) < ?
     RETURNING id`
  ).bind(
    phoneHash,
    ipHash,
    now,
    phoneHash,
    now - SEND_COOLDOWN_SECONDS,
    phoneHash,
    now - 86400,
    MAX_PHONE_SENDS_PER_DAY,
    ipHash,
    now - 86400,
    MAX_IP_SENDS_PER_DAY
  ).first();
  if (!sendSlot) {
    return json({ error: 'Prit para të kërkosh një kod tjetër ose provo përsëri nesër.' }, 429, origin);
  }

  const code = createCode();
  const codeHash = await hmacHex(env.OTP_HASH_SECRET, `code:${phone}:${code}`);
  await env.DB.prepare(
    `INSERT INTO otp_codes (phone_hash, code_hash, expires_at, attempts, consumed_at)
     VALUES (?, ?, ?, 0, NULL)
     ON CONFLICT(phone_hash) DO UPDATE SET
       code_hash = excluded.code_hash,
       expires_at = excluded.expires_at,
       attempts = 0,
       consumed_at = NULL`
  ).bind(phoneHash, codeHash, now + OTP_LIFETIME_SECONDS).run();
  let response;
  try {
    response = await fetch('https://www.wasenderapi.com/api/send-message', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WASENDER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: phone.slice(1),
        text: `Kodi yt i verifikimit për rezervimin te Frizer Nissi është: ${code}. Kodi skadon pas 5 minutash.`
      }),
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    await env.DB.prepare(
      'DELETE FROM otp_codes WHERE phone_hash = ? AND code_hash = ?'
    ).bind(phoneHash, codeHash).run();
    console.error('Wasender request failed before receiving a response.');
    return json({ error: 'Nuk u arrit të dërgohej kodi. Provo përsëri më vonë.' }, 502, origin);
  }

  if (!response.ok) {
    await env.DB.prepare(
      'DELETE FROM otp_codes WHERE phone_hash = ? AND code_hash = ?'
    ).bind(phoneHash, codeHash).run();
    console.error(`Wasender returned HTTP ${response.status}.`);
    return json({ error: 'Shërbimi WhatsApp nuk e pranoi mesazhin. Kontrollo lidhjen e Wasender dhe provo përsëri.' }, 502, origin);
  }

  return json({ message: 'Kodi u dërgua. Kontrollo WhatsApp-in.' }, 200, origin);
}

async function verifyCode(request, env, origin) {
  const body = await readJson(request);
  const phone = normalizePhone(body.phone);
  const code = typeof body.code === 'string' ? body.code : '';
  if (!phone || !/^\d{6}$/.test(code)) {
    return json({ error: 'Numri ose kodi nuk është në formatin e duhur.' }, 400, origin);
  }

  const now = Math.floor(Date.now() / 1000);
  const phoneHash = await hmacHex(env.OTP_HASH_SECRET, `phone:${phone}`);
  const challenge = await env.DB.prepare(
    'SELECT code_hash, expires_at, attempts, consumed_at FROM otp_codes WHERE phone_hash = ?'
  ).bind(phoneHash).first();
  if (!challenge || challenge.consumed_at !== null || Number(challenge.expires_at) <= now
    || Number(challenge.attempts) >= MAX_CODE_ATTEMPTS) {
    return json({ error: 'Kodi është i pasaktë, ka skaduar ose është përdorur. Kërko një kod të ri.' }, 400, origin);
  }

  const submittedHash = await hmacHex(env.OTP_HASH_SECRET, `code:${phone}:${code}`);
  if (!constantTimeEqual(submittedHash, challenge.code_hash)) {
    await env.DB.prepare(
      'UPDATE otp_codes SET attempts = attempts + 1 WHERE phone_hash = ? AND consumed_at IS NULL AND attempts < ?'
    ).bind(phoneHash, MAX_CODE_ATTEMPTS).run();
    return json({ error: 'Kodi është i pasaktë. Kontrollo mesazhin dhe provo përsëri.' }, 400, origin);
  }

  const customToken = await createFirebaseCustomToken(phone, phoneHash, env);
  const consumed = await env.DB.prepare(
    `UPDATE otp_codes SET consumed_at = ?
     WHERE phone_hash = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < ?
     RETURNING phone_hash`
  ).bind(now, phoneHash, now, MAX_CODE_ATTEMPTS).first();
  if (!consumed) {
    return json({ error: 'Kodi është përdorur ose ka skaduar. Kërko një kod të ri.' }, 400, origin);
  }

  return json({ firebaseCustomToken: customToken }, 200, origin);
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (!origin) return json({ error: 'Origjina e kërkesës nuk është e lejuar.' }, 403);
    if (request.method === 'OPTIONS') return json({}, 204, origin);
    if (request.method !== 'POST') return json({ error: 'Metoda nuk lejohet.' }, 405, origin);

    try {
      if (!env.DB || !env.WASENDER_API_KEY || !env.OTP_HASH_SECRET
        || !env.FIREBASE_SERVICE_ACCOUNT_EMAIL || !env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY) {
        console.error('Required Worker bindings or secrets are missing.');
        return json({ error: 'Shërbimi i verifikimit nuk është konfiguruar plotësisht.' }, 503, origin);
      }
      const path = new URL(request.url).pathname;
      if (path === '/send-code') return await sendCode(request, env, origin);
      if (path === '/verify-code') return await verifyCode(request, env, origin);
      return json({ error: 'Adresa nuk u gjet.' }, 404, origin);
    } catch (error) {
      console.error('WhatsApp OTP request failed:', error?.message || 'unknown error');
      return json({ error: 'Gabim gjatë verifikimit. Provo përsëri më vonë.' }, 500, origin);
    }
  }
};
