/* Step counter for the Ayumu Test (2026-10-18). The game sends a beacon as a
   player reaches each screen, and this logs one line per step, so the Netlify
   function log shows how far people get before they leave. Nothing about
   the player is sent or stored: just the step name. */

const STEP = /^[a-z0-9:_-]{1,40}$/i;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' };
  let step = '';
  try { step = String(JSON.parse(event.body || '{}').s || ''); } catch (e) {}
  if (STEP.test(step)) console.log('step ' + step);
  return { statusCode: 204, body: '' };
};
