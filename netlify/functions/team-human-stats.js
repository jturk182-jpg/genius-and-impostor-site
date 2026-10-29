/* Current Team Human standings: member count, median score, and the
   ten-bucket distribution. Cached for a minute so a traffic spike reads
   from the CDN, not the database. */

exports.handler = async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'not configured' }) };
  }
  const rpc = name => fetch(url + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: '{}'
  });
  /* v2 buckets by whole-number hits; v1 is the fallback until v2 exists. */
  let r = await rpc('team_human_stats_v2');
  if (r.status === 404) r = await rpc('team_human_stats');
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
