/* Which games have been announced, on PRODUCTION.
   The Map pages load this file and remove any link to a game whose slug is not
   listed here. Production lists none yet: the games and the new home page are
   still on staging. LAUNCH DAY FOR A GAME: add its slug and push main.
   Slugs: ayumu-test · bottleneck · unstoppable-reader · secret-grammar · diagnostic · ayumu-training */
window.LAUNCHED = new Set([]);
window.launched = function (slug) { return window.LAUNCHED.has(slug); };
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-game]').forEach(function (el) {
    if (!window.launched(el.dataset.game)) el.remove();
  });
});
