#!/usr/bin/env node
/* ============================================================================
   build-atlas.js  —  the Concept Atlas generator.

   Reads atlas/data/stations.json + atlas/data/lines.json and stamps them into
   one HTML page per station plus the subway-map home page. Run it whenever the
   data changes:

       node build-atlas.js

   This is the ONE build step in the project, and it exists for a reason: the
   atlas is ~21 near-identical pages, and hand-maintaining them guarantees they
   drift (see how the tool pages already carry "keep the copies in sync by hand"
   notes). Here the layout lives once, in this file, and the words live once, in
   the data. Change the template, every page updates. Add a station, add a data
   entry. The single-file tool pages are untouched by any of this.
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'atlas', 'data');
const OUT = path.join(ROOT, 'atlas');

const stationsData = JSON.parse(fs.readFileSync(path.join(DATA, 'stations.json'), 'utf8')).stations;
const linesFile = JSON.parse(fs.readFileSync(path.join(DATA, 'lines.json'), 'utf8'));
const lines = linesFile.lines;
const routes = linesFile.routes || [];

// ---- lookups -------------------------------------------------------------
const byId = {};
stationsData.forEach(s => { byId[s.id] = s; });
const lineById = {};
lines.forEach(l => { lineById[l.id] = l; });

// ---- validation (fail loud; a broken link should never ship) -------------
const problems = [];
stationsData.forEach(s => {
  if (typeof s.x !== 'number' || typeof s.y !== 'number') problems.push(`${s.id}: missing coordinates`);
  (s.lines || []).forEach(lid => { if (!lineById[lid]) problems.push(`${s.id}: unknown line "${lid}"`); });
  (s.relations || []).forEach(r => { if (!byId[r.target]) problems.push(`${s.id}: relation target "${r.target}" does not exist`); });
  if (s.next && !byId[s.next.target]) problems.push(`${s.id}: next-station target "${s.next.target}" does not exist`);
});
lines.forEach(l => l.stations.forEach(sid => { if (!byId[sid]) problems.push(`line ${l.id}: unknown station "${sid}"`); }));
routes.forEach(rt => rt.stations.forEach(sid => { if (!byId[sid]) problems.push(`route ${rt.id}: unknown station "${sid}"`); }));
if (problems.length) {
  console.error('Atlas build FAILED. Fix the data:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}

// ---- helpers -------------------------------------------------------------
const esc = str => String(str)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function linesForStation(s) {
  return (s.lines || []).map(lid => lineById[lid]);
}

// The shared design furniture, held ONCE. Lifted from the live tool pages so
// the atlas reads as the same site (build-context section 3 tokens).
const CSS = `
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
  :root {
    --bg:#fafaf8; --ink:#1a1a1a; --red:#c44b3a; --muted:#666;
    --rule:#e0dcd4; --parchment:#f1ebde; --parchment-line:#d6cfc2;
    --serif:'Source Serif 4', Georgia, serif; --mono:'Space Mono','Courier New',monospace;
    --genius:#6a4a95; --impostor:#a34a72; --machinery:#c0503f; --access:#3a6ea5; --bias:#b8843a; --intelligence:#4f7d3a;
  }
  html { scroll-behavior:smooth; }
  [hidden] { display:none !important; }
  body { font-family:var(--serif); background:var(--bg); color:var(--ink); line-height:1.75; font-size:18px; -webkit-font-smoothing:antialiased; }
  a { color:inherit; }
  .shell { max-width:720px; margin:0 auto; padding:0 24px; min-height:100vh; min-height:100dvh; display:flex; flex-direction:column; }
  @media (min-width:600px){ .shell { padding:0 40px; } }
  .shell-main { flex:1; padding:40px 0 56px; }
  /* mast */
  .mast { padding:26px 0 18px; border-bottom:1px solid var(--rule); display:flex; align-items:baseline; justify-content:space-between; gap:16px; }
  .mast-home { font-family:var(--mono); font-size:10px; letter-spacing:.2em; text-transform:uppercase; color:var(--muted); text-decoration:none; transition:color .2s; }
  .mast-home:hover { color:var(--red); }
  .mast-kicker { font-family:var(--mono); font-size:10px; letter-spacing:.2em; text-transform:uppercase; color:var(--muted); }
  /* line chips */
  .linechips { display:flex; flex-wrap:wrap; gap:8px; margin:26px 0 8px; }
  .linechip { font-family:var(--mono); font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:#fff; padding:3px 10px; border-radius:2px; text-decoration:none; }
  /* headings */
  h1.station { font-size:38px; line-height:1.15; font-weight:600; letter-spacing:-.01em; margin:14px 0 22px; }
  @media (min-width:600px){ h1.station { font-size:46px; } }
  .lead { font-size:22px; line-height:1.5; color:var(--ink); margin-bottom:8px; }
  @media (min-width:600px){ .lead { font-size:24px; } }
  .sec { margin-top:44px; }
  .sec-label { font-family:var(--mono); font-size:10px; font-weight:700; letter-spacing:.22em; text-transform:uppercase; color:var(--muted); margin-bottom:16px; padding-bottom:8px; border-bottom:1px solid var(--rule); }
  .sec p { margin-bottom:16px; }
  .cite { font-family:var(--mono); font-size:12px; color:var(--muted); letter-spacing:.02em; display:block; margin-top:-8px; margin-bottom:20px; }
  /* claims block */
  .claims { display:grid; grid-template-columns:1fr; gap:0; border:1px solid var(--parchment-line); background:var(--parchment); border-radius:3px; overflow:hidden; margin-top:36px; }
  @media (min-width:640px){ .claims { grid-template-columns:1fr 1fr; } }
  .claims-cell { padding:22px 24px; }
  .claims-cell + .claims-cell { border-top:1px solid var(--parchment-line); }
  @media (min-width:640px){ .claims-cell + .claims-cell { border-top:none; border-left:1px solid var(--parchment-line); } }
  .claims-head { font-family:var(--mono); font-size:10px; font-weight:700; letter-spacing:.15em; text-transform:uppercase; margin-bottom:12px; }
  .claims-believe .claims-head { color:var(--muted); }
  .claims-evidence .claims-head { color:var(--red); }
  .claims-cell p { font-size:17px; line-height:1.55; margin:0; }
  /* walk me through it (opens the learn-flow modal) */
  .walk-btn { display:inline-block; font-family:var(--mono); font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; background:var(--ink); color:var(--bg); border:none; border-radius:4px; padding:14px 26px; margin-top:6px; cursor:pointer; transition:background .2s; }
  .walk-btn:hover, .walk-btn:focus-visible { background:var(--red); outline:none; }
  /* feel it (games) */
  .feelit { display:block; border:1px solid var(--rule); border-left:3px solid var(--red); border-radius:3px; padding:20px 22px; text-decoration:none; margin-bottom:14px; transition:background .2s, transform .2s; background:#fff; }
  .feelit:hover { background:#fdfbf7; transform:translateY(-1px); }
  .feelit-name { font-weight:600; font-size:19px; margin-bottom:4px; }
  .feelit-blurb { font-size:16px; color:var(--muted); line-height:1.5; }
  .feelit-cue { font-family:var(--mono); font-size:10px; letter-spacing:.15em; text-transform:uppercase; color:var(--red); margin-top:10px; }
  /* map fragment */
  .frag { border-top:1px solid var(--rule); }
  .frag-edge { padding:14px 0; border-bottom:1px solid var(--rule); }
  .frag-edge summary { list-style:none; cursor:pointer; display:flex; align-items:baseline; gap:10px; justify-content:space-between; }
  .frag-edge summary::-webkit-details-marker { display:none; }
  .frag-rel { font-family:var(--mono); font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); white-space:nowrap; }
  .frag-target { font-size:18px; font-weight:600; color:var(--ink); text-decoration:none; flex:1; }
  .frag-target:hover { color:var(--red); }
  .frag-why { font-size:15px; color:var(--muted); line-height:1.5; padding-top:10px; }
  .frag-open { font-family:var(--mono); font-size:16px; color:var(--rule); }
  /* next */
  .next { display:block; margin-top:44px; border:1px solid var(--rule); border-radius:3px; padding:24px; text-decoration:none; background:#fff; transition:background .2s; }
  .next:hover { background:#fdfbf7; }
  .next-label { font-family:var(--mono); font-size:10px; font-weight:700; letter-spacing:.22em; text-transform:uppercase; color:var(--muted); margin-bottom:10px; }
  .next-name { font-size:24px; font-weight:600; color:var(--red); margin-bottom:6px; }
  .next-reason { font-size:16px; color:var(--muted); line-height:1.5; }
  /* book */
  .book { margin-top:40px; padding:22px 0 0; border-top:1px solid var(--rule); font-size:17px; color:var(--muted); font-style:italic; line-height:1.6; }
  /* footer */
  .foot { border-top:1px solid var(--rule); padding:34px 0 46px; text-align:center; margin-top:12px; }
  .foot-label { font-family:var(--mono); font-size:9px; font-weight:700; letter-spacing:.25em; text-transform:uppercase; color:var(--muted); opacity:.7; margin-bottom:14px; }
  .foot-links { display:flex; flex-direction:column; align-items:center; gap:8px; }
  .foot-links a { font-family:var(--mono); font-size:12px; letter-spacing:.1em; color:var(--muted); text-decoration:none; transition:color .2s; }
  .foot-links a:hover { color:var(--red); }
  .foot-copy { font-family:var(--mono); font-size:11px; color:var(--muted); opacity:.5; margin-top:18px; }
`;

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">`;

// Cross-tool footer, kept in one place now.
const FOOTER = `
  <footer class="foot">
    <div class="foot-label">While you're here</div>
    <div class="foot-links">
      <a href="../index.html">The Genius and the Impostor</a>
      <a href="index.html">The Map</a>
      <a href="../ayumu-test.html">The Ayumu Test</a>
      <a href="../diagnostic.html">The Genius Diagnostic</a>
      <a href="../unstoppable-reader.html">The Unstoppable Reader</a>
      <a href="../secret-grammar.html">The Secret Grammar</a>
    </div>
    <div class="foot-copy">&copy; 2026 Josh Turknett</div>
  </footer>`;

// ---- station page --------------------------------------------------------
function stationPage(s) {
  const stationLines = linesForStation(s);
  const chips = stationLines.map(l =>
    `<a class="linechip" style="background:${l.color}" href="index.html#line-${l.id}">${esc(l.name)}</a>`
  ).join('');

  // The teaching content (the claim, the evidence, the stories) is delivered
  // as a reader-paced modal flow via learn-flow.js, not as static prose on the
  // page, per the standing rule that learning content on this site is chunked
  // and reader-driven. The claim becomes a bias-surfacing question; evidence
  // and stories become one-idea cards.
  const flowSteps = [];
  if (s.claimsBlock) {
    flowSteps.push({
      ask: 'A lot of people would say: “' + s.claimsBlock.believe + '” Does that hold up?',
      choices: ['Sounds about right', 'I’m not sure', 'No, that’s off'],
      answer: '<p>' + s.claimsBlock.evidence + '</p>'
    });
  }
  (s.evidence || []).forEach(e => {
    flowSteps.push({ chunk: '<p>' + e.text + '</p>' + (e.cite ? '<p class="lf-cite">' + esc(e.cite) + '</p>' : '') });
  });
  (s.stories || []).forEach(st => {
    flowSteps.push({ chunk: '<p>' + st.text + '</p>' });
  });
  const walk = flowSteps.length
    ? `<button class="walk-btn" id="walk-btn" type="button">Walk me through it &rarr;</button>`
    : '';

  const feelit = (s.games && s.games.length) ? `
    <div class="sec">
      <div class="sec-label">Feel it</div>
      ${s.games.map(g => `<a class="feelit" href="${esc(g.url)}"><div class="feelit-name">${esc(g.name)}</div><div class="feelit-blurb">${esc(g.blurb)}</div><div class="feelit-cue">Play &middot; about 2 min &rarr;</div></a>`).join('')}
    </div>` : '';

  const frag = (s.relations && s.relations.length) ? `
    <div class="sec">
      <div class="sec-label">On the map</div>
      <div class="frag">
        ${s.relations.map(r => {
          const t = byId[r.target];
          return `<details class="frag-edge"><summary><span class="frag-rel">${esc(r.type)}</span><a class="frag-target" href="${t.id}.html">${esc(t.name)}</a><span class="frag-open">+</span></summary><div class="frag-why">${esc(r.justification)}</div></details>`;
        }).join('')}
      </div>
    </div>` : '';

  const nextS = s.next ? (() => {
    const t = byId[s.next.target];
    return `<a class="next" href="${t.id}.html"><div class="next-label">Next station</div><div class="next-name">${esc(t.name)} &rarr;</div><div class="next-reason">${esc(s.next.reason)}</div></a>`;
  })() : '';

  const book = s.bookRef ? `<div class="book">${esc(s.bookRef)}</div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(s.name)} &mdash; The Map</title>
<meta name="description" content="${esc(s.oneBreath.slice(0, 155))}">
${FONTS}
<style>${CSS}</style>
</head>
<body>
<div class="shell">
  <header class="mast">
    <a class="mast-home" href="index.html">&larr; The Map</a>
    <span class="mast-kicker">Genius &amp; Impostor</span>
  </header>
  <main class="shell-main">
    <div class="linechips">${chips}</div>
    <h1 class="station">${esc(s.name)}</h1>
    <p class="lead">${esc(s.oneBreath)}</p>
    ${walk}
    ${feelit}
    ${frag}
    ${book}
    ${nextS}
  </main>
  ${FOOTER}
</div>
${flowSteps.length ? `<script src="../learn-flow.js"></script>
<script>
(function () {
  var steps = ${JSON.stringify(flowSteps)};
  var btn = document.getElementById('walk-btn');
  if (btn && window.LearnFlow) btn.addEventListener('click', function () { LearnFlow.open(steps, { doneLabel: 'Done' }); });
})();
</script>` : ''}
</body>
</html>`;
}

// ---- the map (atlas home) ------------------------------------------------
function mapPage() {
  const W = 1250, H = 680;
  const R = 9;            // station dot radius
  const RI = 13;          // interchange ring radius

  // Rounded-corner path per line. Strict tube-map geometry: coordinates in the
  // data keep every segment at 0/45/90 degrees; bends get a small radius so the
  // line flows instead of kinking. Optional per-line vias insert corner points
  // between two named stations (for routes that turn where no station sits).
  function roundedPath(pts, r) {
    r = r || 16;
    let dPath = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const v1 = [x1 - x0, y1 - y0], v2 = [x2 - x1, y2 - y1];
      const l1 = Math.hypot(v1[0], v1[1]), l2 = Math.hypot(v2[0], v2[1]);
      const cross = v1[0] * v2[1] - v1[1] * v2[0];
      if (Math.abs(cross) < 1e-6) continue; // straight through, no bend
      const rr = Math.min(r, l1 / 2, l2 / 2);
      const a = [x1 - v1[0] / l1 * rr, y1 - v1[1] / l1 * rr];
      const b = [x1 + v2[0] / l2 * rr, y1 + v2[1] / l2 * rr];
      dPath += ` L ${a[0]} ${a[1]} Q ${x1} ${y1} ${b[0]} ${b[1]}`;
    }
    dPath += ` L ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
    return dPath;
  }

  // Raw point list per line (stations + any via corners).
  const raw = lines.map(l => {
    const pts = [];
    l.stations.forEach((sid, i) => {
      pts.push([byId[sid].x, byId[sid].y]);
      if (i < l.stations.length - 1 && l.vias) {
        const via = l.vias.find(v => v.between[0] === sid && v.between[1] === l.stations[i + 1]);
        if (via) via.points.forEach(p => pts.push(p));
      }
    });
    return { l, pts };
  });

  // Line bundling: where two lines share a segment, draw them as parallel
  // stripes (standard subway-map move) instead of one on top of the other.
  const GAP = 11; // centre-to-centre spacing of bundled stripes
  const canon = (a, b) => (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])) ? [a, b] : [b, a];
  const segKey = (a, b) => { const [p, q] = canon(a, b); return `${p[0]},${p[1]}|${q[0]},${q[1]}`; };
  const users = {};
  raw.forEach(({ l, pts }) => { for (let i = 0; i < pts.length - 1; i++) { const k = segKey(pts[i], pts[i + 1]); (users[k] = users[k] || []).push(l.id); } });

  function offsetVec(a, b, lineId) {
    const k = segKey(a, b); const u = users[k];
    if (u.length < 2) return [0, 0];
    const slot = (u.indexOf(lineId) - (u.length - 1) / 2) * GAP;
    const [p, q] = canon(a, b);           // consistent basis for all users
    const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
    return [-dy / L * slot, dx / L * slot]; // perpendicular to the segment
  }
  function segDir(a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; }
  function intersect(p1, d1, p2, d2) {
    const den = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(den) < 1e-9) return null;
    const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den;
    return [p1[0] + d1[0] * t, p1[1] + d1[1] * t];
  }

  const polylines = raw.map(({ l, pts }) => {
    if (pts.length < 2) return '';
    // offset each segment's endpoints, then rebuild vertices as the meeting
    // point of adjacent offset segments (keeps corners crisp when the offset
    // changes at a shared/solo boundary).
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const o = offsetVec(pts[i], pts[i + 1], l.id);
      segs.push({ a: [pts[i][0] + o[0], pts[i][1] + o[1]], b: [pts[i + 1][0] + o[0], pts[i + 1][1] + o[1]], dir: segDir(pts[i], pts[i + 1]) });
    }
    const verts = [segs[0].a];
    for (let i = 1; i < segs.length; i++) {
      const hit = intersect(segs[i - 1].a, segs[i - 1].dir, segs[i].a, segs[i].dir);
      verts.push(hit || segs[i].a);
    }
    verts.push(segs[segs.length - 1].b);
    return `<path d="${roundedPath(verts)}" fill="none" stroke="${l.color}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" opacity="0.9" class="mapline" data-line="${l.id}"/>`;
  }).join('\n');

  // Map-only presentation overrides (shorter labels, and which side the label
  // sits on to avoid collisions). Content names live in the data; these are
  // cartography, kept here so the data stays about ideas, not pixels.
  const SHORT = {
    'capability-accessibility-model': 'Capability & Access',
    'domain-specific-intelligence': 'Domain-Specific',
    'bottleneck-chunking': 'Bottleneck & Chunking'
  };
  const LABEL_ABOVE = new Set([
    'the-genius', 'adult-learning', 'genius-led-learning',
    'progressive-composition', 'bottleneck-chunking', 'everyday-genius',
    'domain-specific-intelligence', 'effort-inversion', 'introspective-bias'
  ]);
  // Side labels for stations on vertical segments (a below-label would sit on
  // the line). Value is the side the label extends toward.
  const LABEL_SIDE = { 'the-impostor': 'left', 'unreliable-narrator': 'left' };
  // Horizontal nudge for labels at crowded hubs.
  const LABEL_DX = {};

  // station glyphs + labels
  const nodes = stationsData.map(s => {
    const multi = (s.lines || []).length > 1;
    const hasGame = (s.games && s.games.length) > 0;
    const color = lineById[s.lines[0]].color;
    const glyph = multi
      ? `<circle cx="${s.x}" cy="${s.y}" r="${RI}" fill="#fafaf8" stroke="#1a1a1a" stroke-width="3"/>`
      : `<circle cx="${s.x}" cy="${s.y}" r="${R}" fill="#fafaf8" stroke="${color}" stroke-width="4"/>`;
    const tick = hasGame ? `<circle cx="${s.x}" cy="${s.y}" r="3" fill="var(--red)"/>` : '';
    const label = SHORT[s.id] || s.name;
    const side = LABEL_SIDE[s.id];
    let lx, ly, anchor;
    if (side) {
      lx = side === 'right' ? s.x + (RI + 13) : s.x - (RI + 13);
      ly = s.y + 4;
      anchor = side === 'right' ? 'start' : 'end';
    } else {
      const above = LABEL_ABOVE.has(s.id);
      lx = s.x + (LABEL_DX[s.id] || 0);
      ly = above ? s.y - (RI + 10) : s.y + (RI + 18);
      anchor = 'middle';
    }
    return `<g class="station" tabindex="0" role="link" data-id="${s.id}" data-name="${esc(s.name)}" data-breath="${esc(s.oneBreath)}" data-game="${hasGame ? esc(s.games[0].name) : ''}" data-gameurl="${hasGame ? esc(s.games[0].url) : ''}">
      <circle cx="${s.x}" cy="${s.y}" r="26" fill="transparent"/>
      ${glyph}${tick}
      <text class="station-label" x="${lx}" y="${ly}" text-anchor="${anchor}">${esc(label)}</text>
    </g>`;
  }).join('\n');

  const legend = lines.map(l =>
    `<a class="leg" id="line-${l.id}" href="#" data-line="${l.id}"><span class="leg-swatch" style="background:${l.color}"></span><span class="leg-name">${esc(l.name)}</span><span class="leg-sub">${esc(l.subtitle)}</span></a>`
  ).join('');

  const routeCards = routes.map(rt => {
    const stops = rt.stations.map(sid => esc(byId[sid].name)).join(' &rarr; ');
    return `<details class="route"><summary><span class="route-name">${esc(rt.name)}</span><span class="route-blurb">${esc(rt.blurb)}</span></summary><div class="route-stops">${stops}</div><a class="route-start" href="${rt.stations[0]}.html">Start riding &rarr;</a></details>`;
  }).join('');

  // list view: lines as collapsible sections
  const listView = lines.map(l => `
    <details class="lv-line" open>
      <summary><span class="lv-swatch" style="background:${l.color}"></span><span class="lv-name">${esc(l.name)}</span><span class="lv-sub">${esc(l.subtitle)}</span></summary>
      <ol class="lv-stops">
        ${l.stations.map(sid => { const t = byId[sid]; const g = (t.games && t.games.length); return `<li><a href="${t.id}.html"><span class="lv-stop-name">${esc(t.name)}</span>${g ? '<span class="lv-tick">play</span>' : ''}</a></li>`; }).join('')}
      </ol>
    </details>`).join('');

  const mapData = {};
  stationsData.forEach(s => { mapData[s.id] = { name: s.name, breath: s.oneBreath, game: (s.games && s.games[0]) || null }; });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>The Map &mdash; The Genius and the Impostor</title>
<meta name="description" content="A map of the ideas from The Genius and the Impostor. Concepts are the stations, and each line is a route through them.">
${FONTS}
<style>${CSS}
  .atlas-hero { padding:44px 0 8px; }
  .atlas-title { font-size:40px; line-height:1.1; font-weight:600; letter-spacing:-.01em; margin-bottom:16px; }
  @media (min-width:600px){ .atlas-title { font-size:52px; } }
  .atlas-sub { font-size:20px; color:var(--muted); line-height:1.5; max-width:44ch; }
  .viewtoggle { display:flex; gap:0; margin:30px 0 10px; border:1px solid var(--rule); border-radius:3px; width:max-content; overflow:hidden; }
  .viewtoggle button { font-family:var(--mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; padding:9px 18px; background:#fff; border:none; color:var(--muted); cursor:pointer; }
  .viewtoggle button.on { background:var(--ink); color:#fafaf8; }
  .mapwrap { margin:8px 0 0; overflow-x:auto; -webkit-overflow-scrolling:touch; border:1px solid var(--rule); border-radius:4px; background:#fff; }
  /* On desktop the map breaks out of the reading column and uses the screen. */
  @media (min-width:760px){ .mapwrap { width:min(1300px,94vw); position:relative; left:50%; transform:translateX(-50%); } }
  svg.map { display:block; width:1250px; max-width:none; height:auto; }
  .station-label { font-family:var(--mono); font-size:12px; fill:#1a1a1a; letter-spacing:.01em; paint-order:stroke; stroke:#fafaf8; stroke-width:4px; }
  .station { cursor:pointer; }
  .station:hover .station-label, .station:focus .station-label { fill:var(--red); }
  .station:focus { outline:none; }
  .mapline { transition:opacity .2s; }
  .map.dim .mapline { opacity:0.16; }
  .map.dim .mapline.lit { opacity:0.95; }
  .map.dim .station { opacity:0.35; }
  .map.dim .station.lit { opacity:1; }
  /* preview card */
  .preview { position:sticky; bottom:0; margin-top:14px; border:1px solid var(--rule); border-radius:4px; background:var(--parchment); padding:20px 22px; display:none; }
  .preview.on { display:block; }
  .preview-name { font-size:22px; font-weight:600; margin-bottom:6px; }
  .preview-breath { font-size:16px; color:var(--muted); line-height:1.5; margin-bottom:16px; }
  .preview-actions { display:flex; flex-wrap:wrap; gap:10px; }
  .preview-btn { font-family:var(--mono); font-size:12px; letter-spacing:.08em; text-transform:uppercase; text-decoration:none; padding:9px 16px; border-radius:3px; }
  .preview-enter { background:var(--ink); color:#fafaf8; }
  .preview-play { background:var(--red); color:#fff; }
  .preview-close { background:transparent; color:var(--muted); border:1px solid var(--rule); cursor:pointer; }
  /* legend */
  .legend { margin-top:34px; display:grid; grid-template-columns:1fr; gap:2px; }
  @media (min-width:600px){ .legend { grid-template-columns:1fr 1fr; gap:2px 28px; } }
  .leg { display:flex; align-items:baseline; gap:10px; padding:11px 0; text-decoration:none; border-bottom:1px solid var(--rule); }
  .leg-swatch { width:22px; height:6px; border-radius:3px; flex-shrink:0; position:relative; top:-3px; }
  .leg-name { font-weight:600; font-size:16px; }
  .leg-sub { font-size:14px; color:var(--muted); }
  .leg.on .leg-name { color:var(--red); }
  /* routes */
  .routes-head, .list-head { font-family:var(--mono); font-size:10px; font-weight:700; letter-spacing:.22em; text-transform:uppercase; color:var(--muted); margin:44px 0 14px; padding-bottom:8px; border-bottom:1px solid var(--rule); }
  .route { border-bottom:1px solid var(--rule); padding:14px 0; }
  .route summary { list-style:none; cursor:pointer; }
  .route summary::-webkit-details-marker { display:none; }
  .route-name { font-weight:600; font-size:18px; margin-right:10px; }
  .route-blurb { font-size:15px; color:var(--muted); }
  .route-stops { font-family:var(--mono); font-size:13px; color:var(--muted); line-height:1.7; margin:12px 0; }
  .route-start { font-family:var(--mono); font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--red); text-decoration:none; }
  /* list view */
  .lv-line { border:1px solid var(--rule); border-radius:4px; margin-bottom:12px; overflow:hidden; }
  .lv-line summary { list-style:none; cursor:pointer; display:flex; align-items:baseline; gap:10px; padding:16px 18px; background:#fff; }
  .lv-line summary::-webkit-details-marker { display:none; }
  .lv-swatch { width:22px; height:6px; border-radius:3px; position:relative; top:-3px; }
  .lv-name { font-weight:600; font-size:17px; }
  .lv-sub { font-size:14px; color:var(--muted); }
  .lv-stops { list-style:none; padding:6px 18px 16px; }
  .lv-stops li { border-top:1px solid var(--rule); }
  .lv-stops a { display:flex; align-items:center; justify-content:space-between; padding:12px 4px; text-decoration:none; }
  .lv-stops a:hover .lv-stop-name { color:var(--red); }
  .lv-stop-name { font-size:17px; }
  .lv-tick { font-family:var(--mono); font-size:9px; letter-spacing:.15em; text-transform:uppercase; color:var(--red); border:1px solid var(--red); border-radius:2px; padding:1px 6px; }
  .note { font-family:var(--mono); font-size:11px; color:var(--muted); opacity:.7; margin-top:12px; line-height:1.6; }
</style>
</head>
<body>
<div class="shell">
  <header class="mast">
    <a class="mast-home" href="../index.html">&larr; The book</a>
    <span class="mast-kicker">Genius &amp; Impostor</span>
  </header>
  <main class="shell-main">
    <div class="atlas-hero">
      <h1 class="atlas-title">The Map</h1>
      <p class="atlas-sub">A map of the ideas from the book. Each station is a concept, and each line is a route you can ride from one idea to the next. Tap a station to look inside.</p>
    </div>

    <div class="viewtoggle" role="tablist">
      <button id="tab-map" class="on" type="button">Map</button>
      <button id="tab-list" type="button">List</button>
    </div>

    <div id="view-map">
      <div class="mapwrap">
        <svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Subway map of the concepts">
          ${polylines}
          ${nodes}
        </svg>
      </div>
      <div class="preview" id="preview">
        <div class="preview-name" id="pv-name"></div>
        <div class="preview-breath" id="pv-breath"></div>
        <div class="preview-actions">
          <a class="preview-btn preview-enter" id="pv-enter" href="#">Enter station &rarr;</a>
          <a class="preview-btn preview-play" id="pv-play" href="#" hidden>Play the game</a>
          <button class="preview-btn preview-close" id="pv-close" type="button">Close</button>
        </div>
      </div>
      <p class="note">First-draft map. Every connection here is a claim about how the ideas relate, and the topology is still up for a vetting pass. The line re-routing toggle (focused service vs. rest service) is coming in a later version.</p>

      <div class="legend">${legend}</div>
    </div>

    <div id="view-list" hidden>
      ${listView}
    </div>

    <div class="routes-head">Curated routes</div>
    ${routeCards}
  </main>
  ${FOOTER}
</div>
<script>
  var MAP = ${JSON.stringify(mapData)};
  var LINES = ${JSON.stringify(lines.map(l => ({ id: l.id, stations: l.stations })))};

  // view toggle, default to list on narrow screens
  var tabMap = document.getElementById('tab-map'), tabList = document.getElementById('tab-list');
  var viewMap = document.getElementById('view-map'), viewList = document.getElementById('view-list');
  function show(which){
    var isMap = which === 'map';
    tabMap.classList.toggle('on', isMap); tabList.classList.toggle('on', !isMap);
    viewMap.hidden = !isMap; viewList.hidden = isMap;
  }
  tabMap.onclick = function(){ show('map'); };
  tabList.onclick = function(){ show('list'); };
  if (window.matchMedia('(max-width:600px)').matches) show('list');

  // station preview
  var preview = document.getElementById('preview');
  var pvName = document.getElementById('pv-name'), pvBreath = document.getElementById('pv-breath');
  var pvEnter = document.getElementById('pv-enter'), pvPlay = document.getElementById('pv-play');
  function openStation(id){
    var d = MAP[id]; if(!d) return;
    pvName.textContent = d.name;
    pvBreath.textContent = d.breath;
    pvEnter.setAttribute('href', id + '.html');
    if (d.game){ pvPlay.hidden = false; pvPlay.setAttribute('href', d.game.url); pvPlay.textContent = 'Play ' + d.game.name; }
    else { pvPlay.hidden = true; }
    preview.classList.add('on');
    preview.scrollIntoView({behavior:'smooth', block:'nearest'});
  }
  document.getElementById('pv-close').onclick = function(){ preview.classList.remove('on'); undim(); };
  Array.prototype.forEach.call(document.querySelectorAll('.station'), function(g){
    function act(){ openStation(g.getAttribute('data-id')); }
    g.addEventListener('click', act);
    g.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); } });
  });

  // legend highlight a line
  var svg = document.querySelector('svg.map');
  function undim(){ svg.classList.remove('dim'); Array.prototype.forEach.call(svg.querySelectorAll('.lit'), function(el){ el.classList.remove('lit'); }); Array.prototype.forEach.call(document.querySelectorAll('.leg.on'), function(el){ el.classList.remove('on'); }); }
  Array.prototype.forEach.call(document.querySelectorAll('.leg'), function(a){
    a.addEventListener('click', function(e){
      e.preventDefault();
      var lid = a.getAttribute('data-line');
      var already = a.classList.contains('on');
      undim();
      if (already) return;
      a.classList.add('on');
      svg.classList.add('dim');
      var line = LINES.filter(function(l){ return l.id===lid; })[0];
      svg.querySelector('.mapline[data-line="'+lid+'"]').classList.add('lit');
      line.stations.forEach(function(sid){ var st = svg.querySelector('.station[data-id="'+sid+'"]'); if(st) st.classList.add('lit'); });
    });
  });
</script>
</body>
</html>`;
}

// ---- write ---------------------------------------------------------------
let written = 0;
stationsData.forEach(s => {
  fs.writeFileSync(path.join(OUT, s.id + '.html'), stationPage(s));
  written++;
});
fs.writeFileSync(path.join(OUT, 'index.html'), mapPage());
written++;
console.log(`Atlas built: ${written} pages (${stationsData.length} stations + map) into atlas/`);
