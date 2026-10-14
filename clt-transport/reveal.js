/* Transitions entre les sections : chaque bloc marqué [data-reveal] monte et s'éclaire en entrant dans
   l'écran, et redescend en remontant (réversible, piloté par le défilement). Rien sans JavaScript :
   la valeur par défaut est « visible ». Animations réduites : tout reste en place. */
(function (root) {
  'use strict';
  const clamp = n => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
  /** 0 quand le haut du bloc touche le bas de l'écran, 1 quand il a monté de 55 % de l'écran. */
  function amount(top, viewport) {
    if (!(viewport > 0)) return 1;
    const t = clamp((viewport - top) / (viewport * .55));
    return 1 - Math.pow(1 - t, 3);
  }
  const api = { amount };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.CLTReveal = api;
  const blocks = Array.from(document.querySelectorAll('[data-reveal], [data-step-reveal]'));
  if (!blocks.length) return;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  function paint() {
    frame = 0;
    const still = media.matches || document.body.classList.contains('motion-reduced');
    const h = innerHeight;
    blocks.forEach(block => {
      const value = still ? 1 : amount(block.getBoundingClientRect().top, h);
      block.style.setProperty('--reveal', value.toFixed(3));
    });
  }
  const request = () => { if (!frame) frame = requestAnimationFrame(paint); };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request, { passive: true });
  media.addEventListener('change', request);
  new MutationObserver(request).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  paint();
})(typeof globalThis === 'undefined' ? this : globalThis);
