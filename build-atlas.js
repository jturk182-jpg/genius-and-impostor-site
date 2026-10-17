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
      <a href="../index.html">GeniusAndImpostor.com</a>
      <a href="../book.html">The Genius and the Impostor</a>
      <a href="index.html">The Map</a>
      <a data-game="ayumu-test" href="../ayumu-test.html">The Ayumu Test</a>
      <a data-game="bottleneck" href="../bottleneck.html">The Bottleneck</a>
      <a data-game="diagnostic" href="../diagnostic.html">The Genius Diagnostic</a>
      <a data-game="unstoppable-reader" href="../unstoppable-reader.html">The Unstoppable Reader</a>
      <a data-game="secret-grammar" href="../secret-grammar.html">The Secret Grammar</a>
    </div>
    <div class="foot-copy">&copy; 2026 Josh Turknett</div>
  </footer>`;

// ---- the cards for one station, shared by the Map, station pages and home --
// JT, 2026-10-16: tapping a station opens its cards right away. The cards open
// with the station's question (never the answer), run the hand-authored flow,
// close on the station's one-line summary, then offer where to go next. One
// builder feeds every page so the experience can't drift between them.
function flowStepsFor(s) {
  const flowSteps = [];
  if (Array.isArray(s.flow) && s.flow.length) {
    s.flow.forEach(st => {
      if (st.ask) flowSteps.push({ ask: st.ask, choices: st.choices, correct: st.correct,
        answer: st.answer + (st.cite ? '<p class="lf-cite">' + esc(st.cite) + '</p>' : '') });
      else flowSteps.push({ chunk: st.chunk + (st.cite ? '<p class="lf-cite">' + esc(st.cite) + '</p>' : '') });
    });
  } else if (s.claimsBlock) {
    flowSteps.push({
      ask: 'A lot of people would say: “' + s.claimsBlock.believe + '” Does that hold up?',
      choices: ['Sounds about right', 'I’m not sure', 'No, that’s off'],
      answer: '<p>' + s.claimsBlock.evidence + '</p>'
    });
  }
  if (!(Array.isArray(s.flow) && s.flow.length)) {
    (s.evidence || []).forEach(e => {
      flowSteps.push({ chunk: '<p>' + e.text + '</p>' + (e.cite ? '<p class="lf-cite">' + esc(e.cite) + '</p>' : '') });
    });
    (s.stories || []).forEach(st => { flowSteps.push({ chunk: '<p>' + st.text + '</p>' }); });
  }
  return flowSteps;
}

function cardsFor(s) {
  const lineNames = linesForStation(s).map(l => l.name).join(' · ');
  const intro = { label: lineNames, chunk: '<h2 class="lf-station-name">' + esc(s.name) + '</h2>' +
    (s.opener ? '<p class="lf-opener">' + esc(s.opener) + '</p>' : '') };
  const closing = { label: 'What this station shows', chunk: '<p class="lf-takeaway">' + esc(s.oneBreath) + '</p>' +
    (s.bookRef ? '<p class="lf-bookref">' + esc(s.bookRef) + '</p>' : '') };
  return {
    name: s.name,
    steps: [intro].concat(flowStepsFor(s), [closing]),
    next: s.next ? { id: s.next.target, name: byId[s.next.target].name, reason: s.next.reason } : null,
    links: (s.relations || []).filter(r => !s.next || r.target !== s.next.target)
      .map(r => ({ id: r.target, name: byId[r.target].name })),
    game: (s.games && s.games[0]) ? { name: s.games[0].name, url: s.games[0].url } : null
  };
}

// The runtime that every page loads (written to atlas/cards.js). `base` is the
// path from the calling page to the atlas folder: '' inside atlas/, 'atlas/'
// from the site root. Finished stations are remembered on this device.
const CARDS_RUNTIME = `
window.AtlasCards = (function () {
  var DONE_KEY = 'gi.atlas.done';
  function done() { try { return JSON.parse(localStorage.getItem(DONE_KEY) || '[]'); } catch (e) { return []; } }
  function markDone(id) {
    try { var d = done(); if (d.indexOf(id) < 0) { d.push(id); localStorage.setItem(DONE_KEY, JSON.stringify(d)); } } catch (e) {}
    if (window.AtlasCards.onDone) window.AtlasCards.onDone(id);
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function injectStyles() {
    if (document.getElementById('atlas-cards-styles')) return;
    var el = document.createElement('style'); el.id = 'atlas-cards-styles';
    el.textContent =
      '.lf-station-name{font-family:var(--serif,Georgia,serif);font-size:clamp(26px,5vw,34px);line-height:1.2;font-weight:600;letter-spacing:-.01em;margin:0 0 16px;}' +
      '.lf-opener{font-size:clamp(19px,3.6vw,22px);line-height:1.45;margin:0;}' +
      '.lf-takeaway{font-size:clamp(18px,3.4vw,21px);line-height:1.5;}' +
      '.lf-bookref{font-size:15px;font-style:italic;color:var(--muted,#666);line-height:1.55;margin-top:14px;}' +
      '.ac-next{display:block;text-decoration:none;border:1px solid var(--rule,#e0dcd4);border-left:3px solid var(--red,#c44b3a);border-radius:4px;padding:16px 18px;margin:0 0 18px;background:#fff;}' +
      '.ac-next:hover{background:#fdfbf7;}' +
      '.ac-kicker{font-family:var(--mono,"Courier New",monospace);font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted,#666);margin:0 0 8px;}' +
      '.ac-next-name{font-size:21px;font-weight:600;color:var(--red,#c44b3a);margin:0 0 4px;}' +
      '.ac-next-reason{font-size:16px;color:var(--muted,#666);line-height:1.5;margin:0;}' +
      '.ac-links{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px;}' +
      '.ac-link{font-size:15px;text-decoration:none;border:1px solid var(--rule,#e0dcd4);border-radius:3px;padding:7px 12px;background:#fff;}' +
      '.ac-link:hover{border-color:var(--red,#c44b3a);color:var(--red,#c44b3a);}' +
      '.ac-map{font-family:var(--mono,"Courier New",monospace);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#666);text-decoration:none;}' +
      '.ac-map:hover{color:var(--red,#c44b3a);}';
    document.head.appendChild(el);
  }
  function stationHref(base, id) { return base + 'index.html#' + id; }
  function nextCard(id, base) {
    var c = window.ATLAS_CARDS[id], h = '';
    if (c.next) {
      h += '<a class="ac-next" data-station="' + c.next.id + '" href="' + stationHref(base, c.next.id) + '">' +
        '<p class="ac-kicker">Next station</p><p class="ac-next-name">' + esc(c.next.name) + ' &rarr;</p>' +
        '<p class="ac-next-reason">' + esc(c.next.reason) + '</p></a>';
    }
    if (c.links.length) {
      h += '<p class="ac-kicker">Connected stations</p><div class="ac-links">' +
        c.links.map(function (l) { return '<a class="ac-link" data-station="' + l.id + '" href="' + stationHref(base, l.id) + '">' + esc(l.name) + '</a>'; }).join('') + '</div>';
    }
    var slug = c.game ? c.game.url.split('/').pop().split('.')[0] : null;
    if (c.game && window.launched && window.launched(slug)) {
      h += '<p class="ac-kicker">A game that shows this idea</p><div class="ac-links"><a class="ac-link" href="' + base + c.game.url + '">Play ' + esc(c.game.name) + '</a></div>';
    }
    h += '<a class="ac-map" href="' + base + 'index.html">See the whole Map &rarr;</a>';
    return { label: 'Where to next', chunk: h };
  }
  var current = null;
  /* opts.base: path to the atlas folder. opts.inPlace: the page is the Map
     itself, so station links open the next station's cards here instead of
     loading a page. */
  function open(id, opts) {
    opts = opts || {};
    var c = window.ATLAS_CARDS[id]; if (!c || !window.LearnFlow) return;
    injectStyles();
    if (current) { var prev = current; current = null; prev.close(); }
    var base = opts.base || '';
    /* card media paths are written relative to the atlas folder */
    var steps = c.steps.map(function (s) {
      if (!base) return s;
      var f = function (h) { return h && h.replace(/src="media\\//g, 'src="' + base + 'media/'); };
      return Object.assign({}, s, { chunk: f(s.chunk), answer: f(s.answer) });
    }).concat([nextCard(id, base)]);
    var handle = LearnFlow.open(steps, {
      doneLabel: 'Done',
      onComplete: function () { markDone(id); },
      onClose: function () { if (current === handle) current = null; if (opts.onClose) opts.onClose(); }
    });
    current = handle;
    var modals = document.querySelectorAll('.lf-modal'), modal = modals[modals.length - 1];
    if (modal) modal.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (!a) return;
      markDone(id);
      var to = a.getAttribute('data-station');
      if (to && opts.inPlace) { e.preventDefault(); open(to, opts); if (history.replaceState) history.replaceState(null, '', '#' + to); }
    });
    return handle;
  }
  return { open: open, done: done, markDone: markDone };
})();
`;

// ---- station page --------------------------------------------------------
/* Cut a description at a word boundary for meta/preview tags. */
function clip(text, max) {
  if (text.length <= max) return text;
  return text.slice(0, text.lastIndexOf(' ', max - 1)).replace(/[,;:.\s]+$/, '') + '…';
}

function stationPage(s) {
  const stationLines = linesForStation(s);
  const chips = stationLines.map(l =>
    `<a class="linechip" style="background:${l.color}" href="index.html#line-${l.id}">${esc(l.name)}</a>`
  ).join('');

  const flowSteps = flowStepsFor(s);
  const walk = flowSteps.length
    ? `<button class="walk-btn" id="walk-btn" type="button">Start this station &rarr;</button>`
    : '';

  const feelit = (s.games && s.games.length) ? `
    <div class="sec">
      <div class="sec-label">Feel it</div>
      ${s.games.map(g => `<a class="feelit" data-game="${esc(g.url.replace(/^.*\//, "").replace(/\.html.*$/, ""))}" href="${esc(g.url)}"><div class="feelit-name">${esc(g.name)}</div><div class="feelit-blurb">${esc(g.blurb)}</div><div class="feelit-cue">Play &middot; about 2 min &rarr;</div></a>`).join('')}
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
<meta name="description" content="${esc(clip(s.oneBreath, 155))}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="The Genius and the Impostor">
<meta property="og:title" content="${esc(s.name)} &mdash; The Map">
<meta property="og:description" content="${esc(clip(s.oneBreath, 155))}">
<meta property="og:url" content="https://geniusandimpostor.com/atlas/${s.id}.html">
<meta property="og:image" content="https://geniusandimpostor.com/og/og-map.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
<style>${CSS}</style>
  <script src="../launched.js"></script>
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
<script src="cards.js"></script>
<script>
(function () {
  /* The cards open as soon as the page loads (JT, 2026-10-16); the page
     underneath stays for anyone who closes them, and for search engines. */
  var open = function () { AtlasCards.open(${JSON.stringify(s.id)}, { base: '' }); };
  var btn = document.getElementById('walk-btn');
  if (btn) btn.addEventListener('click', open);
  open();
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
    return `<g class="station" tabindex="0" role="link" data-id="${s.id}" data-name="${esc(s.name)}" data-breath="${esc(s.oneBreath)}">
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
    return `<details class="route"><summary><span class="route-name">${esc(rt.name)}</span><span class="route-blurb">${esc(rt.blurb)}</span></summary><div class="route-stops">${stops}</div><a class="route-start" data-station="${rt.stations[0]}" href="#${rt.stations[0]}">Start riding &rarr;</a></details>`;
  }).join('');

  // list view: lines as collapsible sections
  const listView = lines.map(l => `
    <details class="lv-line" open>
      <summary><span class="lv-swatch" style="background:${l.color}"></span><span class="lv-name">${esc(l.name)}</span><span class="lv-sub">${esc(l.subtitle)}</span></summary>
      <ol class="lv-stops">
        ${l.stations.map(sid => { const t = byId[sid]; const g = (t.games && t.games.length) ? t.games[0].url.split('/').pop().split('.')[0] : null; return `<li><a data-station="${t.id}" href="#${t.id}"><span class="lv-stop-name">${esc(t.name)}</span>${g ? `<span class="lv-tick" data-game="${g}">play</span>` : ''}</a></li>`; }).join('')}
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
<meta property="og:type" content="website">
<meta property="og:site_name" content="The Genius and the Impostor">
<meta property="og:title" content="The Map: The Genius and the Impostor">
<meta property="og:description" content="A map of the ideas from The Genius and the Impostor. Concepts are the stations, and each line is a route through them.">
<meta property="og:url" content="https://geniusandimpostor.com/atlas/">
<meta property="og:image" content="https://geniusandimpostor.com/og/og-map.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
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
  /* finished stations fill in */
  .station.done circle:nth-of-type(2) { fill:var(--ink); }
  .lv-done { font-family:var(--mono); font-size:9px; letter-spacing:.15em; text-transform:uppercase; color:var(--muted); border:1px solid var(--rule); border-radius:2px; padding:1px 6px; margin-left:8px; }
  .mapline { transition:opacity .2s; }
  .map.dim .mapline { opacity:0.16; }
  .map.dim .mapline.lit { opacity:0.95; }
  .map.dim .station { opacity:0.35; }
  .map.dim .station.lit { opacity:1; }
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
  <script src="../launched.js"></script>
</head>
<body>
<div class="shell">
  <header class="mast">
    <a class="mast-home" href="../index.html">&larr; GeniusAndImpostor.com</a>
    <span class="mast-kicker">Genius &amp; Impostor</span>
  </header>
  <main class="shell-main">
    <div class="atlas-hero">
      <h1 class="atlas-title">The Map</h1>
      <p class="atlas-sub">A map of the ideas in The Genius and the Impostor. Each station is one idea, and each line is a route you can ride from one idea to the next. Tap a station to start.</p>
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
<script src="../learn-flow.js"></script>
<script src="cards.js"></script>
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

  // A station opens its cards right here (JT, 2026-10-16). Links inside the
  // cards to other stations open those stations here too, and #station-id in
  // the address opens one on arrival, so old and shared links still work.
  function clearHash(){ if (history.replaceState) history.replaceState(null, '', location.pathname + location.search); }
  function openStation(id){ if (window.ATLAS_CARDS && ATLAS_CARDS[id]) AtlasCards.open(id, { base: '', inPlace: true, onClose: clearHash }); }
  Array.prototype.forEach.call(document.querySelectorAll('.station'), function(g){
    function act(){ var id = g.getAttribute('data-id'); if (history.replaceState) history.replaceState(null, '', '#' + id); openStation(id); }
    g.addEventListener('click', act);
    g.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); } });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-station]'), function(a){
    a.addEventListener('click', function(e){ e.preventDefault(); var id = a.getAttribute('data-station'); if (history.replaceState) history.replaceState(null, '', '#' + id); openStation(id); });
  });
  function paintDone(){
    var d = AtlasCards.done();
    d.forEach(function(id){
      var g = document.querySelector('.station[data-id="'+id+'"]'); if (g) g.classList.add('done');
      Array.prototype.forEach.call(document.querySelectorAll('.lv-stops a[data-station="'+id+'"]'), function(a){ if (!a.querySelector('.lv-done')) a.querySelector('.lv-stop-name').insertAdjacentHTML('afterend', '<span class="lv-done">done</span>'); });
    });
  }
  AtlasCards.onDone = paintDone;
  paintDone();
  var fromHash = (location.hash || '').replace('#', '');
  if (fromHash && ATLAS_CARDS[fromHash]) openStation(fromHash);
  window.addEventListener('hashchange', function(){ var id = (location.hash || '').replace('#',''); if (ATLAS_CARDS[id]) openStation(id); });

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
const cards = {};
stationsData.forEach(s => { cards[s.id] = cardsFor(s); });
fs.writeFileSync(path.join(OUT, 'cards.js'), '/* Generated by build-atlas.js. Do not edit. */\nwindow.ATLAS_CARDS = ' + JSON.stringify(cards) + ';\n' + CARDS_RUNTIME);
written++;
console.log(`Atlas built: ${written} pages (${stationsData.length} stations + map) into atlas/`);
