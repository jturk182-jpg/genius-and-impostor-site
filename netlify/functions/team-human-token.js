/* Issued when a scored round starts. The submit endpoint requires one, and
   uses its timestamp to reject "rounds" that finished faster than a real
   round physically can. The token is just a signed timestamp; it carries
   nothing about the player. */

const crypto = require('crypto');

exports.handler = async () => {
  const secret = process.env.TEAM_HUMAN_SECRET;
  if (!secret) {
    return { statusCode: 500, body: JSON.stringify({ error: 'not configured' }) };
  }
  const ts = Date.now();
  const sig = crypto.createHmac('sha256', secret).update(String(ts)).digest('hex');
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify({ token: ts + '.' + sig })
  };
};
