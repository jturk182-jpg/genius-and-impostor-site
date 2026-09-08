/* Saved progress for the Ayumu Training Room.

   GET  (Authorization: Bearer <token>)          -> { email, store, updated_at }
   PUT  (Authorization: Bearer <token>) { store } -> { ok, updated_at }

   One row per email in `training_players` (see training-schema.sql). The
   token comes from training-signin.js; its signature and expiry are checked
   here on every call, so the browser never talks to the database directly.

   Env: TRAINING_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY. */

const crypto = require('crypto');

function verify(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const body = parts[0] + '.' + parts[1];
  const want = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(parts[2]), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const exp = parseInt(parts[1], 10);
  if (!(exp > Date.now())) return null;
  const email = Buffer.from(parts[0], 'base64url').toString('utf8');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

exports.handler = async (event) => {
  const secret = process.env.TRAINING_SECRET;
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!secret || !url || !key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'not configured' }) };
  }
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const email = verify(auth.replace(/^Bearer\s+/i, ''), secret);
  if (!email) return { statusCode: 401, body: JSON.stringify({ error: 'sign in again' }) };

  const headers = { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json' };
  const noStore = { 'content-type': 'application/json', 'cache-control': 'no-store' };

  if (event.httpMethod === 'GET') {
    const r = await fetch(url + '/rest/v1/training_players?select=email,store,updated_at&email=eq.' + encodeURIComponent(email), { headers });
    if (!r.ok) return { statusCode: 502, body: JSON.stringify({ error: 'storage unavailable' }) };
    const rows = await r.json();
    const row = rows[0] || null;
    return { statusCode: 200, headers: noStore, body: JSON.stringify({ email, store: row ? row.store : null, updated_at: row ? row.updated_at : null }) };
  }

  if (event.httpMethod === 'PUT') {
    let store;
    try { store = JSON.parse(event.body || '{}').store; }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'bad request' }) }; }
    if (!store || typeof store !== 'object') return { statusCode: 400, body: JSON.stringify({ error: 'bad request' }) };
    if ((event.body || '').length > 400000) return { statusCode: 413, body: JSON.stringify({ error: 'too large' }) };
    const updated_at = new Date().toISOString();
    const r = await fetch(url + '/rest/v1/training_players?on_conflict=email', {
      method: 'POST',
      headers: Object.assign({ prefer: 'resolution=merge-duplicates,return=minimal' }, headers),
      body: JSON.stringify({ email, store, updated_at })
    });
    if (!r.ok) return { statusCode: 502, body: JSON.stringify({ error: 'storage unavailable' }) };
    return { statusCode: 200, headers: noStore, body: JSON.stringify({ ok: true, updated_at }) };
  }

  return { statusCode: 405, body: JSON.stringify({ error: 'method not allowed' }) };
};
