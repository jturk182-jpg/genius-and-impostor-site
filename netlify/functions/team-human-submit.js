/* Accepts one finished flash round and adds it to Team Human. The client is
   untrusted by definition (the whole game runs in the player's browser), so
   this endpoint never takes a bare score at face value: it wants the full
   try log the game already keeps, checks the story hangs together, and
   rejects anything impossible. A determined faker can still construct a
   plausible log; the display design (median + distribution, no trophy case)
   is what makes that pointless. */

const crypto = require('crypto');

const MIN_ROUND_MS = 25 * 1000;      /* three real tries take longer than this */
const MAX_TOKEN_AGE_MS = 3 * 60 * 60 * 1000;
const RATE_LIMIT_PER_HOUR = 6;

function bad(code, msg) {
  return { statusCode: code, body: JSON.stringify({ error: msg }) };
}

function sbHeaders(key, extra) {
  return Object.assign({
    apikey: key,
    authorization: 'Bearer ' + key,
    'content-type': 'application/json'
  }, extra || {});
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return bad(405, 'POST only');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const secret = process.env.TEAM_HUMAN_SECRET;
  if (!url || !key || !secret) return bad(500, 'not configured');

  let body;
  try { body = JSON.parse(event.body); } catch (e) { return bad(400, 'bad json'); }

  /* --- Token: signed at round start, so we know when the round began. --- */
  const token = String(body.token || '');
  const dot = token.indexOf('.');
  if (dot < 1) return bad(400, 'no token');
  const ts = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  const expect = crypto.createHmac('sha256', secret).update(String(ts)).digest('hex');
  if (!Number.isFinite(ts) || sig.length !== expect.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) {
    return bad(400, 'bad token');
  }
  const age = Date.now() - ts;
  if (age < MIN_ROUND_MS) return bad(400, 'too fast to be a round');
  if (age > MAX_TOKEN_AGE_MS) return bad(400, 'token expired');

  /* --- The round itself: does the story hang together? --- */
  const a = body.attempt || {};
  const log = Array.isArray(a.log) ? a.log : null;
  if (!log || log.length < 3 || log.length > 30) return bad(400, 'bad log');

  const validTries = log.filter(t => t && t.valid === true);
  const hits = validTries.filter(t => t.success === true).length;
  const trials = validTries.length;

  if (trials !== a.trials || hits !== a.hits) return bad(400, 'log does not match totals');
  /* The game runs 3 tries, extending to 10 the moment any try succeeds. */
  if (!((trials === 3 && hits === 0) || (trials === 10 && hits >= 1))) {
    return bad(400, 'impossible round shape');
  }
  const acc = Number(a.acc);
  if (!Number.isFinite(acc) || Math.abs(acc - hits / trials) > 0.001) return bad(400, 'acc mismatch');

  const frameDur = Number(a.frameDur);
  if (!Number.isFinite(frameDur) || frameDur < 4 || frameDur > 40) return bad(400, 'implausible screen');

  for (const t of log) {
    if (!t || t.numerals !== 5 || t.hold !== 210) return bad(400, 'wrong task');
    if (t.valid) {
      const m = Number(t.measured);
      /* A valid try's measured hold sits within a frame of 210 by the
         game's own rule; give one extra frame of slack, no more. */
      if (!Number.isFinite(m) || Math.abs(m - 210) > 2 * frameDur + 2) return bad(400, 'timing off');
    }
  }

  /* --- Rate limit per IP; the IP is only ever stored hashed. --- */
  const ip = (event.headers['x-nf-client-connection-ip'] ||
              (event.headers['x-forwarded-for'] || '').split(',')[0] || '').trim();
  const ipHash = crypto.createHmac('sha256', secret).update(ip).digest('hex').slice(0, 32);
  const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();

  const rl = await fetch(url + '/rest/v1/flash_scores?select=id&ip_hash=eq.' + ipHash +
    '&created_at=gte.' + encodeURIComponent(hourAgo), {
    method: 'HEAD',
    headers: sbHeaders(key, { prefer: 'count=exact' })
  });
  const range = rl.headers.get('content-range') || '';
  const recent = Number(range.split('/')[1] || 0);
  if (recent >= RATE_LIMIT_PER_HOUR) return bad(429, 'easy there');

  /* --- How many of the existing members this score is ahead of. --- */
  const below = await fetch(url + '/rest/v1/flash_scores?select=id&acc=lt.' + acc, {
    method: 'HEAD',
    headers: sbHeaders(key, { prefer: 'count=exact' })
  });
  const belowRange = below.headers.get('content-range') || '';
  const belowN = Number(belowRange.split('/')[1] || 0);

  const ins = await fetch(url + '/rest/v1/flash_scores', {
    method: 'POST',
    headers: sbHeaders(key, { prefer: 'return=minimal' }),
    body: JSON.stringify({
      acc: acc,
      hits: hits,
      trials: trials,
      mean_measured: Number(a.meanMeasured) || null,
      frame_dur: frameDur,
      ip_hash: ipHash
    })
  });
  if (!ins.ok) return bad(502, 'could not save');

  const statsRes = await fetch(url + '/rest/v1/rpc/team_human_stats', {
    method: 'POST',
    headers: sbHeaders(key),
    body: '{}'
  });
  const stats = statsRes.ok ? await statsRes.json() : null;

  /* ahead = share of the team (before you joined) scoring strictly below you. */
  const priorCount = stats ? Math.max(0, stats.count - 1) : null;
  const ahead = priorCount ? belowN / priorCount : null;

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify({ ok: true, ahead: ahead, stats: stats })
  };
};
