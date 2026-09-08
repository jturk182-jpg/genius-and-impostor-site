/* Which games have been announced.
   A game that is not listed here is live at its URL but linked from nowhere
   on the site: no footer line, no handoff card, nothing to stumble into.
   Pages tag any link to a game with data-game="<slug>", and this script
   removes the ones that have not launched.

   LAUNCH DAY FOR A GAME: add its slug to the list below and push main.
   Slugs: ayumu-test · bottleneck · unstoppable-reader · secret-grammar · diagnostic · ayumu-training (the separate Training Room app) */
window.LAUNCHED = new Set(['ayumu-test']);
window.launched = function (slug) { return window.LAUNCHED.has(slug); };
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-game]').forEach(function (el) {
    if (!window.launched(el.dataset.game)) el.remove();
  });
});
