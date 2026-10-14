/*
 * Le quotidien de CLT : les vraies photos défilent à l'horizontale pendant qu'on descend la page
 * (la bande reste épinglée, comme les cartes sous le camion). Animations réduites ou sans JavaScript :
 * la bande se fait glisser du doigt, photo par photo.
 */
(function (root) {
  'use strict';
  /** Décalage de la bande et photo affichée, pour un avancement p (0 → 1) de la section. */
  function railState(p, overflow, count) {
    const t = Math.min(1, Math.max(0, p));
    return { x: -t * overflow, index: Math.min(count, Math.round(t * (count - 1)) + 1) };
  }
  const api = { railState };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  const rail = document.querySelector('[data-news-rail]');
  if (!rail) return;
  const sticky = rail.querySelector('.news-rail-sticky');
  const track = rail.querySelector('[data-rail-track]');
  const cards = [...track.children];
  const counter = rail.querySelector('[data-rail-count]');
  const bar = rail.querySelector('.news-rail-progress > span');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => media.matches || document.body.classList.contains('motion-reduced');
  let overflow = 0, frame = 0, width = 0;

  function travel() { return Math.max(1, rail.offsetHeight - sticky.offsetHeight); }
  function paint() {
    frame = 0;
    if (!rail.classList.contains('news-rail-on')) return;
    const p = -rail.getBoundingClientRect().top / travel();
    const state = railState(p, overflow, cards.length);
    // Défilement interne de la bande (scrollLeft) : Safari sur iPhone ne redessinait pas un déplacement par transform ici.
    track.scrollLeft = -state.x;
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, p)).toFixed(4)})`;
    counter.textContent = String(state.index).padStart(2, '0');
  }
  function measure() {
    if (reduced()) {
      rail.classList.remove('news-rail-on');
      rail.style.height = '';
      track.scrollLeft = 0;
      return;
    }
    rail.classList.add('news-rail-on');
    sticky.scrollLeft = 0;
    overflow = Math.max(0, track.scrollWidth - track.clientWidth);
    rail.style.height = `${Math.round(overflow + sticky.offsetHeight)}px`;
    width = window.innerWidth;
    paint();
  }
  const request = () => { if (!frame) frame = requestAnimationFrame(paint); };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', () => { if (window.innerWidth !== width) measure(); else request(); }, { passive: true });
  media.addEventListener('change', measure);
  new MutationObserver(measure).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  // Au clavier, la photo qui reçoit le focus est amenée à l'écran par le défilement de la page.
  track.addEventListener('focusin', event => {
    if (!rail.classList.contains('news-rail-on')) return;
    const card = event.target.closest('.social-photo');
    if (!card || !overflow) return;
    sticky.scrollLeft = 0;
    const p = Math.min(1, card.offsetLeft / overflow);
    const top = rail.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + p * travel(), behavior: 'instant' });
  });
  measure();
})(typeof globalThis === 'undefined' ? this : globalThis);
