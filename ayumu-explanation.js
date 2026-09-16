/* ============================================================================
   ayumu-explanation.js — the one explanation of the Ayumu Test.

   The game's tap-through walk and the science page both render THIS list, so
   the argument lives in exactly one place. Pass in what the reader has done
   and it words itself accordingly: a player who matched or passed Ayumu is
   never told he lost to him, and someone who has not played yet is not told
   what "just happened".

   JT's voice pass, 2026-09-16 (from the Google Doc "Ayumu Test — The
   Explanation (copy for editing)"): eight cards. Order: result → this is an
   IQ-test item and the headlines said "smarter than humans" → if IQ =
   intelligence and fixed, then what? → practice (and moved scores mean not
   fixed) → Ai → the extra step → no single ladder → keep going, the
   Training Room, an email box to get started.

     AyumuExplanation.steps({
       played:      true | false      (has a scored flash round on record)
       playedNine:  true | false
       acc:         0..1 | null        (flash accuracy)
       nineBestMs:  ms | null          (fastest clean commit on the nine)
       training:    true | false       (is the Training Room launched)
     })

   Step shapes match learn-flow.js: { beat } is a plain card (the game's walk
   uses `beat`; the shared card player wants `chunk`, see toFlow), and
   { ask, choices, correct, answer } is a graded question. A step with
   `signup: true` also carries the Training Room email box (both renderers
   draw it; see signupFormHTML / wireSignupForm).
   ========================================================================== */

window.AyumuExplanation = (function () {
  var AYUMU_ACC = 0.80;        /* Inoue & Matsuzawa 2007, flat across holds */
  var AYUMU_COMMIT_MS = 670;   /* his first-touch time on the nine */
  var SIGNIN_URL = '/.netlify/functions/training-signin';

  function pct(x) { return Math.round(x * 100); }

  /* Read the game's saved state on this device, for pages outside the game. */
  function contextFromStorage() {
    var ctx = { played: false, playedNine: false, acc: null, nineBestMs: null,
                training: !!(window.launched && window.launched('ayumu-training')) };
    try {
      var st = JSON.parse(localStorage.getItem('giAyumu.v2') || 'null');
      if (st && st.attempt && st.attempt.trials) { ctx.played = true; ctx.acc = st.attempt.acc; }
      if (st && st.nine && st.nine.tries) { ctx.playedNine = true; ctx.nineBestMs = st.nine.bestMs; }
    } catch (e) {}
    return ctx;
  }

  function steps(ctx) {
    ctx = ctx || {};
    var played = !!ctx.played;
    var playedNine = !!ctx.playedNine;
    var acc = played && typeof ctx.acc === 'number' ? ctx.acc : null;
    var wonFlash = acc !== null && acc >= AYUMU_ACC;
    var nineBest = playedNine && typeof ctx.nineBestMs === 'number' ? ctx.nineBestMs : null;
    var wonNine = nineBest !== null && nineBest <= AYUMU_COMMIT_MS;
    var wonAny = wonFlash || wonNine;

    /* Three voices. 'lost': the usual first-timer. 'won': matched or passed
       him on the flash (the IQ-test item). 'none': has not played, reading
       the science page cold. */
    var mode = !played ? 'none' : (wonFlash ? 'won' : 'lost');
    var you = mode === 'lost';

    /* Card 1: the plain result. */
    var superhuman = 'He commits the locations of 9 digits to memory in less than a second. <strong>To many, it looks like a superhuman feat.</strong>';
    var opening;
    if (mode === 'none') {
      opening = 'Ayumu is a chimpanzee at a research institute in Japan, and at this game he almost always beats the humans who try it, and it usually isn’t even close. ' + superhuman;
    } else if (!playedNine) {
      opening = 'You have now played Ayumu’s game, so let’s talk about what happened. First, Ayumu beats most humans in this game, usually by a wide margin.' +
        (wonFlash ? ' So consider yourself in elite company.' : '');
    } else {
      opening = 'You have now played both of Ayumu’s games, so let’s talk about what happened. First, Ayumu beats most humans in these games, usually by a wide margin. ' + superhuman +
        (wonFlash ? ' So consider yourself in elite company.' : (wonNine ? ' That means you’re in elite company.' : ''));
    }

    return [
      { beat: opening },

      { beat: 'Holding a set of numbers in your head for a moment and giving them back in order is a standard kind of task on IQ tests. It is one of the ways those tests measure working memory. So, in other words, a chimpanzee beat ' +
          (you ? '<strong>you at an item from an IQ test.</strong>' : '<strong>the majority of humans on an IQ test.</strong>') +
          '\n\nThat’s why when this study was first published, the headlines were about how a chimp appeared to be smarter than humans.' },

      { ask: 'Many people believe two things about IQ tests: the first is that they measure intelligence, and the second is that intelligence is fixed at birth. If both of those beliefs were true, what would Ayumu’s score mean?',
        choices: [
          'That the test is broken',
          'That a chimpanzee is more intelligent than ' + (you ? 'you' : 'almost everyone you know') + ', and always will be',
          'Nothing, because he is a chimpanzee'
        ],
        correct: 1,
        answer: '<p>If both beliefs were true, you would have to accept that a chimpanzee is more intelligent than ' + (you ? 'you' : 'almost everyone you know') + ', and that nothing could ever be done about it. If that feels wrong to you, which it does to most, then <strong>it means there’s something fundamentally wrong with our concept of IQ and intelligence.</strong></p><p>As it turns out, there are two reasons why Ayumu has a distinct advantage over most humans. Let’s explore those.</p>' },

      { ask: you
          ? 'What is one reason why Ayumu is so much better at this? Take a guess.'
          : 'So why is Ayumu so good at this, and why do almost all of the humans who try it lose to him? Take a guess.',
        choices: [
          'Chimp brains work faster and have better memories',
          'He has had a lot of practice',
          'Humans are just bad with numbers'
        ],
        correct: 1,
        answer: '<p>Ayumu has had lots of practice. By the time this study was published, Ayumu had played this game hundreds of times, and the people he was tested against had played it a handful of times. When other researchers later gave people a real chance to practice, their scores climbed toward his, and a couple of them caught him.</p><p><strong>If performance improves that much with training, it’s not something we were born with.</strong> But is it right to even consider this kind of test a measure of “intelligence”? For that, let’s look at the story of Ayumu’s mother, Ai.</p>' },

      { beat: 'Like Ayumu, Ai had learned the order of the numerals, but years earlier she had also been taught what each one actually means as an amount, the way you know that a 7 means seven. <strong>And Ai was worse at this game than Ayumu.</strong>' },

      { ask: 'Both chimps knew the order of the numerals, because they had practiced tapping them in sequence thousands of times. But unlike Ayumu, Ai had also been taught what each numeral means as an amount, the way you know that a 7 means seven. Why would knowing the meaning make her slower?',
        choices: [
          'Understanding a symbol takes an extra step, and that step costs time',
          'She was less clever than Ayumu',
          'Older chimpanzees remember less'
        ],
        correct: 0,
        answer: '<p>Turning a shape into a meaning is an extra step, and it takes time. For Ayumu, a 7 was a shape with a known place in the sequence, and nothing more. For Ai it also meant seven, and that meaning is the most likely reason she was a step behind.</p><p>Your brain does the same thing Ai’s did. You cannot look at a 7 and not see “seven,” because you have practiced reading symbols nearly every day of your life. And that processing slows you down. ' +
          (mode === 'lost'
            ? '<strong>So you are behind Ayumu for two reasons: you have not practiced his skill, and you have spent years practicing a different skill that gets in the way of it.</strong></p>'
            : mode === 'won'
            ? '<strong>So most people are behind Ayumu for two reasons: they have not practiced his skill, and they have spent years practicing a different skill that gets in the way of it.</strong> You managed it in spite of that extra step, which is what makes your score so unusual.</p>'
            : '<strong>So most people are behind Ayumu for two reasons: they have not practiced his skill, and they have spent years practicing a different skill that gets in the way of it.</strong></p>') },

      { beat: 'So does this test measure intelligence? It measures how good you are at one specific thing, holding a snapshot of shapes in mind for a moment, and that depends on what you have practiced. Ayumu practiced the game. You practiced something else: reading, which turns every symbol into meaning the instant you see it, and which is the skill that lets you read this sentence. <strong>There is no single ladder of intelligence with one of you above the other. There is only what each of you has built.</strong>' },

      { beat: '<strong>And what you have built can keep growing.</strong> ' +
          (wonAny
            ? 'You are already level with a chimpanzee who has practiced this for years, and the people who kept practicing went further still. '
            : 'The people who practiced this game got much closer to Ayumu, and some of them caught him. ') +
          'The book this site is built around, The Genius and the Impostor, is about exactly this: how every extraordinary ability gets built, Ayumu’s included.' +
          (ctx.training ? '\n\nIf you want to train your brain to try to beat Ayumu, there’s a program here that’s just for that.' : ''),
        signup: !!ctx.training }
    ];
  }

  /* The Training Room email box, drawn under the last card by whichever
     player is rendering. Sends the sign-in link; nothing else. */
  function signupFormHTML() {
    return '<form class="ax-signup" novalidate>' +
      '<label class="ax-signup-label" for="ax-signup-email">Enter your email and we’ll send you a link to get started.</label>' +
      '<div class="ax-signup-row">' +
      '<input type="email" id="ax-signup-email" class="ax-signup-input" placeholder="you@email.com" autocomplete="email" required>' +
      '<button type="submit" class="ax-signup-btn">Send me the link</button>' +
      '</div>' +
      '<p class="ax-signup-msg" aria-live="polite"></p>' +
      '</form>';
  }

  function wireSignupForm(root) {
    var form = root.querySelector('.ax-signup');
    if (!form) return;
    var input = form.querySelector('.ax-signup-input');
    var btn = form.querySelector('.ax-signup-btn');
    var msg = form.querySelector('.ax-signup-msg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (input.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'That does not look like an email address.'; return; }
      btn.disabled = true;
      msg.textContent = 'Sending…';
      fetch(SIGNIN_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email }) })
        .then(function (r) {
          if (r.ok) { msg.textContent = 'Sent. Check your email for your link, and look in spam if it is not there in a minute.'; input.disabled = true; return; }
          msg.textContent = r.status === 400 ? 'That does not look like an email address.' : 'That did not go through. Please try again in a minute.';
          btn.disabled = false;
        })
        .catch(function () { msg.textContent = 'That did not go through. Please try again in a minute.'; btn.disabled = false; });
    });
  }

  var STYLE_ID = 'ax-signup-styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent =
      '.ax-signup{margin-top:18px;padding-top:16px;border-top:1px solid var(--rule,#e0dcd4);}' +
      '.ax-signup-label{display:block;font-family:var(--serif,Georgia,serif);font-size:inherit;line-height:1.5;margin-bottom:10px;}' +
      '.ax-signup-row{display:flex;flex-wrap:wrap;gap:10px;}' +
      '.ax-signup-input{flex:1 1 200px;min-width:0;font-family:var(--serif,Georgia,serif);font-size:17px;padding:11px 14px;border:1.5px solid var(--ink,#1a1a1a);background:#fff;color:var(--ink,#1a1a1a);border-radius:4px;}' +
      '.ax-signup-btn{font-family:var(--mono,"Courier New",monospace);font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:var(--red,#c44b3a);color:#fff;border:none;border-radius:4px;padding:13px 20px;cursor:pointer;}' +
      '.ax-signup-btn:disabled{opacity:.6;cursor:default;}' +
      '.ax-signup-msg{font-family:var(--mono,"Courier New",monospace);font-size:11px;letter-spacing:.04em;color:var(--muted,#666);margin:10px 0 0;min-height:16px;}';
    document.head.appendChild(el);
  }

  /* The same steps in the shape learn-flow.js renders. */
  function toFlow(list) {
    return list.map(function (st) {
      if (!st.beat) return st;
      var out = { chunk: st.beat.split('\n\n').map(function (p) { return '<p>' + p + '</p>'; }).join('') };
      if (st.signup) out.signup = true;
      return out;
    });
  }

  return { steps: steps, toFlow: toFlow, contextFromStorage: contextFromStorage,
           signupFormHTML: signupFormHTML, wireSignupForm: wireSignupForm, injectStyles: injectStyles,
           AYUMU_ACC: AYUMU_ACC, AYUMU_COMMIT_MS: AYUMU_COMMIT_MS };
})();
