/* Current Team Human standings: member count, median score, and the
   ten-bucket distribution. Cached for a minute so a traffic spike reads
   from the CDN, not the database. */

exports.handler = async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'not configured' }) };
  }
  const r = await fetch(url + '/rest/v1/rpc/team_human_stats', {
    method: 'POST',
    headers: { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: '{}'
  });
  if (!r.ok) return { statusCode: 502, body: JSON.stringify({ error: 'stats unavailable' }) };
  const stats = await r.json();
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=60'
    },
    body: JSON.stringify(stats)
  };
};
