/* Sign-in for the Ayumu Training Room: no passwords, a link by email.

   POST { email }  ->  emails a link to ayumu-training.html?token=...
   The token is the email plus an expiry, signed with TRAINING_SECRET. The
   page keeps it in localStorage and sends it back with every save, so one
   click signs a browser in for TOKEN_DAYS. Nothing about the player is
   stored here; progress lives in training-progress.js.

   The address is also added to the site's own list (source
   'ayumu-training'), since asking for it twice would be silly.

   Env: TRAINING_SECRET, RESEND_API_KEY, optional FROM_EMAIL (defaults to
   Resend's onboarding sender, which only reaches the account owner until a
   domain is verified), SUPABASE_URL + SUPABASE_SERVICE_KEY for the list. */

const crypto = require('crypto');

const TOKEN_DAYS = 180;

function b64url(s) { return Buffer.from(s, 'utf8').toString('base64url'); }

function makeToken(email, secret) {
  const exp = Date.now() + TOKEN_DAYS * 86400000;
  const body = b64url(email) + '.' + exp;
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + sig;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  const secret = process.env.TRAINING_SECRET;
  const resendKey = process.env.RESEND_API_KEY;
  if (!secret || !resendKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'not configured' }) };
  }

  let email;
  try { email = (JSON.parse(event.body || '{}').email || '').trim().toLowerCase(); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'bad request' }) }; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid email' }) };
  }

  // The link points back at the site that served the request.
  const proto = (event.headers['x-forwarded-proto'] || 'https');
  const host = event.headers['x-forwarded-host'] || event.headers.host;
  const base = process.env.SITE_URL || (proto + '://' + host);
  const link = base.replace(/\/$/, '') + '/ayumu-training.html?token=' + encodeURIComponent(makeToken(email, secret));

  const from = process.env.FROM_EMAIL || 'The Ayumu Training Room <onboarding@resend.dev>';
  const text =
    'Here is your sign-in link for the Ayumu Training Room:\n\n' + link + '\n\n' +
    'Open it on the device you want to train on. It keeps you signed in for about six months, and your progress is saved every time you play.\n\n' +
    'If you did not ask for this, you can ignore it.\n';
  const html =
    '<p>Here is your sign-in link for the Ayumu Training Room:</p>' +
    '<p><a href="' + link + '">Open the Training Room</a></p>' +
    '<p>Open it on the device you want to train on. It keeps you signed in for about six months, and your progress is saved every time you play.</p>' +
    '<p style="color:#666">If you did not ask for this, you can ignore it.</p>';

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + resendKey, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: [email], subject: 'Your sign-in link for the Ayumu Training Room', text, html })
  });
  if (!r.ok) {
    return { statusCode: 502, body: JSON.stringify({ error: 'email unavailable' }) };
  }

  // Onto the site's list too. Best effort: a failure here never blocks sign-in.
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    try {
      await fetch(url + '/rest/v1/subscribers', {
        method: 'POST',
        headers: { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json', prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ email, source: 'ayumu-training' })
      });
    } catch (e) { /* ignore */ }
  }

  return { statusCode: 200, headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ ok: true }) };
};
