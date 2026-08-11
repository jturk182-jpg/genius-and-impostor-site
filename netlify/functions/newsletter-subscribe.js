/* Newsletter signup. One row per email in the `subscribers` table (see
   newsletter-schema.sql). Uses the same Supabase project and service key as
   Team Human; the service key lives only here, never in the browser.

   We own this list rather than handing signups to a third-party newsletter,
   so the destination stays our decision later. */

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'not configured' }) };
  }

  let email;
  try { email = (JSON.parse(event.body || '{}').email || '').trim().toLowerCase(); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'bad request' }) }; }

  // Light validation only; this is a low-stakes signup, not an auth flow.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid email' }) };
  }

  const r = await fetch(url + '/rest/v1/subscribers', {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: 'Bearer ' + key,
      'content-type': 'application/json',
      // Ignore duplicates so a repeat signup still returns success, not an error.
      prefer: 'resolution=ignore-duplicates,return=minimal'
    },
    body: JSON.stringify({ email, source: 'gi-home' })
  });

  if (!r.ok && r.status !== 409) {
    return { statusCode: 502, body: JSON.stringify({ error: 'signup unavailable' }) };
  }
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
