/* Le Reel de CLT : vidéo muette, en boucle, chargée seulement à l'approche, en pause hors de l'écran.
   Bouton pause toujours disponible. Animations réduites : rien ne démarre seul, le bouton lance la lecture. */
(function () {
  'use strict';
  const video = document.querySelector('[data-reel]');
  if (!video) return;
  const button = video.parentElement.querySelector('.reel-toggle');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => media.matches || document.body.classList.contains('motion-reduced');
  // MP4 (H.264) partout où il est lu, sinon WebM (VP9).
  const base = video.dataset.src;
  const src = video.canPlayType('video/mp4; codecs="avc1.42E01E"') ? base : base.replace(/\.mp4$/, '.webm');
  let visible = false, userPaused = false;
  function load() { if (!video.getAttribute('src')) video.src = src; }
  function label() {
    const playing = !video.paused;
    button.setAttribute('aria-pressed', String(!playing));
    button.querySelector('.reel-toggle-label').textContent = playing ? 'Mettre en pause' : 'Lire la vidéo';
    button.querySelector('.reel-toggle-icon').textContent = playing ? 'Ⅱ' : '▷';
  }
  function sync() {
    if (visible && !userPaused && !still()) { load(); video.play().catch(() => {}); }
    else video.pause();
  }
  button.hidden = false;
  button.addEventListener('click', () => {
    if (video.paused) { userPaused = false; load(); video.play().catch(() => {}); }
    else { userPaused = true; video.pause(); }
  });
  video.addEventListener('play', label);
  video.addEventListener('pause', label);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { rootMargin: '300px 0px' }).observe(video);
  media.addEventListener('change', sync);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  label();
})();
