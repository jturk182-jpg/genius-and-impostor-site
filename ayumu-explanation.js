/* ============================================================================
   ayumu-explanation.js — the one explanation of the Ayumu Test.

   The game's tap-through walk and the science page both render THIS list, so
   the argument lives in exactly one place. Pass in what the reader has done
   and it words itself accordingly: a player who matched or passed Ayumu is
   never told he won, and someone who has not played yet is not told what
   "just happened".

     AyumuExplanation.steps({
       played:      true | false      (has a scored flash round on record)
       playedNine:  true | false
       acc:         0..1 | null        (flash accuracy)
       nineBestMs:  ms | null          (fastest clean commit on the nine)
       training:    true | false       (is the Training Room launched)
     })

   Step shapes match learn-flow.js: { beat } is a plain card (the game's walk
   uses `beat`; the shared card player wants `chunk`, see toFlow), and
   { ask, choices, correct, answer } is a graded question.
   ========================================================================== */

window.AyumuExplanation = (function () {
  var AYUMU_ACC = 0.80;        /* Inoue & Matsuzawa 2007, flat across holds */
  var AYUMU_COMMIT_MS = 670;   /* his first-touch time on the nine */

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
    var tiedFlash = wonFlash && Math.abs(acc - AYUMU_ACC) < 0.005;
    var nineBest = playedNine && typeof ctx.nineBestMs === 'number' ? ctx.nineBestMs : null;
    var wonNine = nineBest !== null && nineBest <= AYUMU_COMMIT_MS;
    var wonAny = wonFlash || wonNine;

    /* Three voices. 'lost': the usual first-timer. 'won': matched or passed
       him on the flash (the IQ-test item). 'none': has not played, reading
       the science page cold. */
    var mode = !played ? 'none' : (wonFlash ? 'won' : 'lost');
    var you = mode === 'lost';

    var nineSlower = nineBest !== null && !wonNine
      ? (nineBest / AYUMU_COMMIT_MS >= 1.95
          ? Math.round(nineBest / AYUMU_COMMIT_MS * 10) / 10 + ' times faster than your best'
          : 'a little faster than your best')
      : null;

    /* Card 1: the plain result, in whichever shape it actually took. */
    var opening;
    if (mode === 'none') {
      opening = 'Ayumu is a chimpanzee at a research institute in Japan, and at this game he almost always beats the humans who try it, and it usually isn’t even close. Five numbers flash up for a fifth of a second, and he gets about eighty percent of them right. In his other game, all nine numbers stay on the screen until he touches the first one, and he commits in about two thirds of a second and almost never misses.';
    } else {
      var lead = playedNine
        ? 'You have now played both of Ayumu’s games, so let’s talk about what happened. '
        : 'You have now played Ayumu’s game, so let’s talk about what happened. ';
      if (wonFlash) {
        opening = lead + 'First, the plain part: you ' + (tiedFlash ? 'matched' : 'went past') +
          ' a chimpanzee at his own game, and almost nobody does that on a first try. Ayumu takes in five numbers in a fifth of a second and gets about eighty percent of them right, and you got ' + pct(acc) + ' percent.' +
          (nineBest !== null
            ? (wonNine
              ? ' On the nine you matched his time as well, which puts you in very rare company.'
              : ' On the nine, though, he still wins: he commits in about two thirds of a second, ' + nineSlower + '.')
            : (playedNine ? ' On the nine, he still wins: he commits in about two thirds of a second and almost never misses.' : ''));
      } else if (wonNine) {
        opening = lead + 'First, the plain part: on the flash, he almost always wins, and it usually isn’t even close. He takes in five numbers in a fifth of a second and gets about eighty percent of them right, and you got ' + pct(acc) + ' percent. On the nine, though, you matched his time, and very few people manage that.';
      } else {
        opening = lead + 'First, the plain part: he almost always wins, and it usually isn’t even close. He takes in five numbers in a fifth of a second and gets about eighty percent of them right' +
          (playedNine
            ? ', and on the nine he commits in about two thirds of a second and almost never misses.'
            : ', and he looks like he is barely trying.');
      }
    }

    return [
      { beat: opening },

      { ask: you
          ? 'So why is Ayumu so much better at this than you? Take a guess.'
          : 'So why is Ayumu so good at this, and why do almost all of the humans who try it lose to him? Take a guess.',
        choices: [
          'His brain is built for it',
          'He has practised it far more than ' + (you ? 'you have' : 'they have'),
          'Humans are just bad with numbers'
        ],
        correct: 1,
        answer: '<p>The biggest reason is practice. By the time this study was published, Ayumu had played this game hundreds of times, and the people he was tested against had played it a handful of times. When other researchers later gave people a real chance to practise, their scores climbed toward his, and a couple of them caught him.</p><p>So Ayumu is good at this game because he has spent years getting good at it. That is most of the story, but the rest of it is where things get interesting.</p>' },

      { beat: 'Holding a set of numbers in your head for a moment and giving them back in order is a standard task on IQ tests. It is one of the ways those tests measure working memory. So think about what ' + (mode === 'none' ? 'that means' : 'just happened') + ': a chimpanzee ' +
          (mode === 'lost' ? 'beat you at an item from an IQ test.'
            : mode === 'won' ? 'beats almost every human who tries an item from an IQ test, and you were the rare exception.'
            : 'beats almost every human who tries an item from an IQ test.') },

      { ask: 'Many people believe two things about IQ tests: that they measure intelligence, and that intelligence is fixed at birth. If both of those beliefs were true, what would Ayumu’s score mean?',
        choices: [
          'That the test is broken',
          'That a chimpanzee is more intelligent than ' + (you ? 'you' : 'almost everyone you know') + ', and always will be',
          'Nothing, because he is a chimpanzee'
        ],
        correct: 1,
        answer: '<p>If both beliefs were true, you would have to accept that a chimpanzee is more intelligent than ' + (you ? 'you' : 'almost everyone you know') + ', and that nothing could ever be done about it. Almost nobody is willing to accept that, which tells you something about the beliefs. So let’s check each one against what actually happened.</p>' },

      { beat: 'Start with the belief that what the test measures is fixed. Ayumu’s score came from years of practice, and when people practised, their scores moved too. Whatever this test measures, it changes with what you have built. That is true of Ayumu, and it is true of you.' },

      { beat: 'Now the belief that the test measures intelligence. There was a second chimpanzee in the study, named Ai. She is Ayumu’s mother. Like him, she had learned the order of the numerals, but years earlier she had also been taught what each one actually means as an amount, the way you know that a 7 means seven. Ai was worse at this game than Ayumu.' },

      { ask: 'Both chimps knew the order of the numerals, because they had practised tapping them in sequence thousands of times. But Ai had also been taught what each numeral means as an amount, the way you know that a 7 means seven. Why would knowing the meaning make her slower?',
        choices: [
          'Understanding a symbol takes an extra step, and that step costs time',
          'She was less clever than Ayumu',
          'Older chimpanzees remember less'
        ],
        correct: 0,
        answer: '<p>Turning a shape into a meaning is an extra step, and it takes time. For Ayumu, a 7 was a shape with a known place in the sequence, and nothing more. For Ai it also meant seven, and that meaning is the most likely reason she was a step behind. The study itself does not test why she scored lower, so this is the most likely reading of the pattern rather than a proven one.</p><p>Your brain does the same thing Ai’s did. You cannot look at a 7 and not see “seven,” because you have practised reading symbols nearly every day of your life. ' +
          (mode === 'lost'
            ? 'So you are behind Ayumu for two reasons: you have not practised his skill, and you have spent years practising a different skill that gets in the way of it.</p>'
            : mode === 'won'
            ? 'So most people are behind Ayumu for two reasons: they have not practised his skill, and they have spent years practising a different skill that gets in the way of it. You managed it in spite of that extra step, which is what makes your score so unusual.</p>'
            : 'So most people are behind Ayumu for two reasons: they have not practised his skill, and they have spent years practising a different skill that gets in the way of it.</p>') },

      { beat: 'So does this test measure intelligence? It measures how good you are at one specific thing, holding a snapshot of shapes in mind for a moment, and that depends on what you have practised. Ayumu built years of it. You built something else: a brain that turns every symbol into meaning, which is the skill that lets you read this sentence. There is no single ladder of intelligence with one of you above the other. There is only what each of you has built.' },

      { beat: 'And what you have built can keep growing. ' +
          (wonAny
            ? 'You are already level with a chimpanzee who has practised this for years, and the people who kept practising went further still. '
            : 'The people who practised this game got much closer to Ayumu, and some of them caught him. ') +
          (ctx.training ? 'There is a place on this site to train at this, one step at a time, if you want to close the gap. ' : '') +
          'The book this site is built around, The Genius and the Impostor, is about exactly this: how every extraordinary ability gets built, Ayumu’s included.' }
    ];
  }

  /* The same steps in the shape learn-flow.js renders. */
  function toFlow(list) {
    return list.map(function (st) { return st.beat ? { chunk: '<p>' + st.beat + '</p>' } : st; });
  }

  return { steps: steps, toFlow: toFlow, contextFromStorage: contextFromStorage,
           AYUMU_ACC: AYUMU_ACC, AYUMU_COMMIT_MS: AYUMU_COMMIT_MS };
})();
