/* Newsletter signup ("first access to new games").

   Brand rule (JT, 2026-10-16): ActiveCampaign is the single home for leads.
   The signup is forwarded, server to server, to the Institute site's shared
   lead-capture endpoint, which holds the ActiveCampaign key and tags the
   contact `gi-site-newsletter`. The earlier Supabase `subscribers` table is
   still written as a best-effort backup so no signup is lost.

   Env:
     LEAD_CAPTURE_URL   (optional) defaults to the Institute's live endpoint;
                        set per deploy context to test against a preview.
     SUPABASE_URL, SUPABASE_SERVICE_KEY  (optional backup copy) */

const DEFAULT_LEAD_CAPTURE_URL = 'https://performanceneurology.institute/api/lead-capture';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'method not allowed' }) };
  }

  let email;
  try { email = (JSON.parse(event.body || '{}').email || '').trim().toLowerCase(); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'bad request' }) }; }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid email' }) };
  }

  // Backup copy in our own table (best-effort; never blocks the signup).
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (sbUrl && sbKey) {
    try {
      await fetch(sbUrl + '/rest/v1/subscribers', {
        method: 'POST',
        headers: {
          apikey: sbKey,
          authorization: 'Bearer ' + sbKey,
          'content-type': 'application/json',
          prefer: 'resolution=ignore-duplicates,return=minimal'
        },
        body: JSON.stringify({ email, source: 'gi-home' })
      });
    } catch (e) { console.error('supabase backup failed', e); }
  }

  // The real destination: ActiveCampaign, via the shared lead-capture endpoint.
  try {
    const r = await fetch(process.env.LEAD_CAPTURE_URL || DEFAULT_LEAD_CAPTURE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, source: 'gi-site' })
    });
    if (!r.ok) {
      console.error('lead-capture returned', r.status, await r.text().catch(() => ''));
      return { statusCode: 502, body: JSON.stringify({ error: 'signup unavailable' }) };
    }
  } catch (e) {
    console.error('lead-capture unreachable', e);
    return { statusCode: 502, body: JSON.stringify({ error: 'signup unavailable' }) };
  }
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
