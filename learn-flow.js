/* ============================================================================
   learn-flow.js  —  the reusable "learn flow" card stepper.

   A data-driven, reader-paced way to deliver educational content: one idea per
   card, the reader taps to advance, and multiple-choice questions are woven in
   that surface a common assumption before the answer overturns it. This is the
   site practicing what the book preaches (see feedback_learning_content_chunked
   in memory): learning happens in small chunks, driven by the learner, with
   retrieval built in — never a wall of text to scroll.

   It is deliberately generic. Hand it a list of steps and it renders the whole
   experience. The Ayumu science page is the first caller; the atlas concept
   pages are next. It is also the renderer a future "turn any content into a
   learning flow" tool would output into.

   USAGE
     <div id="flow"></div>
     <script src="learn-flow.js"></script>
     <script>
       LearnFlow.render(document.getElementById('flow'), [
         { chunk: '<p>A plain idea, one card.</p>' },
         { ask: 'A question?',
           choices: ['Option A', 'Option B', 'Option C'],
           answer: '<p>Why the common guess is wrong and what is true.</p>' },
         ...
       ], {
         doneLabel: 'Finish',
         onComplete: function () { ...reveal whatever comes after... }
       });
     </script>

   STEP SHAPES
     { chunk: html }                        a plain content card
     { ask, choices:[...], answer: html }   a question card, then its answer card

   Styling uses the site's CSS variables with fallbacks, so it inherits each
   page's palette. No dependencies, no build step.
   ========================================================================== */

window.LearnFlow = (function () {

  var STYLE_ID = 'learn-flow-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '.lf{max-width:640px;margin:0 auto;}' +
      '.lf-progress{height:3px;background:var(--rule,#e0dcd4);border-radius:2px;overflow:hidden;margin-bottom:34px;}' +
      '.lf-bar{height:100%;background:var(--red,#c44b3a);border-radius:2px;transition:width .35s ease;}' +
      '.lf-card{min-height:44vh;display:flex;flex-direction:column;}' +
      '.lf-label{font-family:var(--mono,"Courier New",monospace);font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--muted,#666);margin-bottom:18px;}' +
      '.lf-body{font-family:var(--serif,Georgia,serif);font-size:clamp(19px,4.2vw,23px);line-height:1.55;color:var(--ink,#1a1a1a);}' +
      '.lf-body p{margin-bottom:16px;}.lf-body p:last-child{margin-bottom:0;}' +
      '.lf-body em{font-style:italic;}' +
      '.lf-cite{font-family:var(--mono,"Courier New",monospace)!important;font-size:12px!important;letter-spacing:.02em;color:var(--muted,#666);}' +
      '.lf-choices{display:flex;flex-direction:column;gap:10px;margin-top:28px;}' +
      '.lf-choice{text-align:left;font-family:var(--serif,Georgia,serif);font-size:clamp(16px,3.4vw,18px);line-height:1.4;color:var(--ink,#1a1a1a);background:#fff;border:1.5px solid var(--rule,#e0dcd4);border-radius:6px;padding:16px 20px;cursor:pointer;transition:border-color .15s,background .15s,transform .15s;}' +
      '.lf-choice:hover,.lf-choice:focus-visible{border-color:var(--red,#c44b3a);background:#fdfbf7;transform:translateY(-1px);outline:none;}' +
      '.lf-actions{display:flex;gap:10px;align-items:center;margin-top:auto;padding-top:34px;}' +
      '.lf-next{font-family:var(--mono,"Courier New",monospace);font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:var(--ink,#1a1a1a);color:var(--bg,#fafaf8);border:none;border-radius:4px;padding:13px 26px;cursor:pointer;transition:background .2s;}' +
      '.lf-next:hover,.lf-next:focus-visible{background:var(--red,#c44b3a);outline:none;}' +
      '.lf-back{font-family:var(--mono,"Courier New",monospace);font-size:11px;letter-spacing:.08em;text-transform:uppercase;background:transparent;color:var(--muted,#666);border:none;cursor:pointer;padding:13px 4px;}' +
      '.lf-back:hover,.lf-back:focus-visible{color:var(--ink,#1a1a1a);outline:none;}' +
      /* modal wrapper: the flow popped over the current page */
      '.lf-modal{position:fixed;inset:0;background:rgba(26,26,24,.5);display:flex;align-items:center;justify-content:center;padding:24px;z-index:9999;overflow-y:auto;-webkit-overflow-scrolling:touch;}' +
      '.lf-modal-inner{position:relative;background:var(--bg,#fafaf8);border-radius:8px;max-width:700px;width:100%;padding:48px 34px 34px;box-shadow:0 24px 70px rgba(0,0,0,.34);max-height:calc(100vh - 48px);overflow-y:auto;}' +
      '.lf-modal .lf-card{min-height:38vh;}' +
      '@media (max-width:600px){.lf-modal{padding:0;}.lf-modal-inner{border-radius:0;max-width:none;min-height:100vh;max-height:none;padding:52px 22px 28px;}}' +
      '.lf-close{position:absolute;top:12px;right:14px;background:transparent;border:none;font-size:24px;line-height:1;color:var(--muted,#666);cursor:pointer;padding:6px 10px;border-radius:4px;}' +
      '.lf-close:hover,.lf-close:focus-visible{color:var(--red,#c44b3a);outline:none;}';
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function render(mount, steps, opts) {
    injectStyles();
    opts = opts || {};
    var idx = 0;         // which step
    var answered = false; // for question steps: has a choice been made
    var total = steps.length;

    function progress() {
      var step = steps[idx];
      var within = step.ask ? (answered ? 1 : 0.5) : 1;
      return Math.round(((idx + within) / total) * 100);
    }

    function actionsHTML() {
      var last = idx === total - 1;
      var canBack = idx > 0 || (steps[idx].ask && answered);
      var h = '<div class="lf-actions">';
      h += '<button class="lf-next" type="button">' + esc(last ? (opts.doneLabel || 'Done') : 'Next') + ' &rarr;</button>';
      if (canBack) h += '<button class="lf-back" type="button">Back</button>';
      h += '</div>';
      return h;
    }

    function draw() {
      var step = steps[idx];
      var h = '<div class="lf-progress"><div class="lf-bar" style="width:' + progress() + '%"></div></div>';
      h += '<div class="lf-card">';
      if (step.ask && !answered) {
        h += '<div class="lf-label">Question &middot; ' + (idx + 1) + ' of ' + total + '</div>';
        h += '<div class="lf-body"><p>' + step.ask + '</p></div>';
        h += '<div class="lf-choices">';
        step.choices.forEach(function (c, i) {
          h += '<button class="lf-choice" type="button" data-i="' + i + '">' + c + '</button>';
        });
        h += '</div>';
      } else if (step.ask && answered) {
        h += '<div class="lf-label">The answer</div>';
        h += '<div class="lf-body">' + step.answer + '</div>';
        h += actionsHTML();
      } else {
        h += '<div class="lf-label">' + esc(step.label || ((idx + 1) + ' of ' + total)) + '</div>';
        h += '<div class="lf-body">' + (step.chunk || '') + '</div>';
        h += actionsHTML();
      }
      h += '</div>';
      mount.innerHTML = h;
      wire();
    }

    function advance() {
      if (idx === total - 1) { if (opts.onComplete) opts.onComplete(); return; }
      idx++; answered = false; draw(); nudge();
    }

    function back() {
      if (steps[idx].ask && answered) { answered = false; draw(); nudge(); return; }
      if (idx > 0) { idx--; answered = false; draw(); nudge(); }
    }

    function nudge() {
      if (opts.scroll === false) return;
      if (mount.getBoundingClientRect().top < 0) mount.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function wire() {
      var choices = mount.querySelectorAll('.lf-choice');
      choices.forEach(function (b) {
        b.addEventListener('click', function () { answered = true; draw(); nudge(); });
      });
      var next = mount.querySelector('.lf-next');
      if (next) next.addEventListener('click', advance);
      var b = mount.querySelector('.lf-back');
      if (b) b.addEventListener('click', back);
      var focusEl = mount.querySelector('.lf-choice') || next;
      if (focusEl) focusEl.focus();
    }

    draw();
  }

  /* Pop the same flow in a focused modal over the current page. Any trigger
     anywhere can call this; when the reader finishes or closes, they land
     right back where they were. Esc, the close button, and the backdrop all
     dismiss it, and the background is scroll-locked while it is open. */
  function open(steps, opts) {
    injectStyles();
    opts = opts || {};
    var prevFocus = document.activeElement;
    var ov = document.createElement('div');
    ov.className = 'lf-modal';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="lf-modal-inner"><button class="lf-close" type="button" aria-label="Close">&times;</button><div class="lf-modal-mount"></div></div>';
    document.body.appendChild(ov);
    var rootOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    function close() {
      document.documentElement.style.overflow = rootOverflow;
      document.removeEventListener('keydown', onKey, true);
      ov.remove();
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') {
        // simple focus trap
        var f = ov.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    ov.querySelector('.lf-close').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

    render(ov.querySelector('.lf-modal-mount'), steps, Object.assign({}, opts, {
      scroll: false,
      doneLabel: opts.doneLabel || 'Done',
      onComplete: function () { if (opts.onComplete) opts.onComplete(); close(); }
    }));

    return { close: close };
  }

  return { render: render, open: open };
})();
