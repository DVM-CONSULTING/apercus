/* Bandeaux d'ambiance vidéo (journée Kling) : invisibles tant que tools/kling-video.sh n'a pas posé la vidéo
   (attribut data-kling-ready) : aucune requête vers un fichier absent. Vidéo muette, en boucle, chargée seulement à l'approche, en pause hors de l'écran.
   Animations réduites (réglage du téléphone ou bouton du site) : on ne charge rien, image fixe seulement. */
(function () {
  'use strict';
  const bands = Array.from(document.querySelectorAll('[data-kling]'));
  if (!bands.length) return;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => media.matches || document.body.classList.contains('motion-reduced');
  bands.forEach(band => {
    const video = band.querySelector('video');
    // WebM (VP9) quand le navigateur sait le lire, sinon MP4 (H.264) : les deux sont déposés ensemble.
    const base = video && video.dataset.src;
    const src = base && video.canPlayType('video/webm; codecs="vp9"') ? base.replace(/\.mp4$/, '.webm') : base;
    if (!src || !band.hasAttribute('data-kling-ready')) return;
    band.hidden = false;
    const sync = visible => {
      if (still()) { video.pause(); return; }
      if (visible) {
        if (!video.src) video.src = src;
        video.play().catch(() => {});
      } else video.pause();
    };
    let visible = false;
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(visible); }, { rootMargin: '400px 0px' }).observe(band);
    media.addEventListener('change', () => sync(visible));
    new MutationObserver(() => sync(visible)).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  });
})();
