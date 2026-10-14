/* Camera motion on the authentic photograph; no generated frames. */
(() => {
  const hero = document.querySelector('.hero-photographic');
  const image = hero?.querySelector('.hero-photograph img');
  if (!image) return;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const dialog = document.querySelector('#photo-dialog');
  let visible = false, frame = 0, last = 0, elapsed = 0, progress = 0;
  const blocked = () => media.matches || document.body.classList.contains('motion-reduced');
  const running = () => visible && !blocked() && !document.hidden && !dialog?.open;
  function paint(time) {
    frame = 0;
    if (!running()) { last = 0; return; }
    const dt = last ? Math.min(time - last, 80) : 16;
    elapsed += dt;
    last = time;
    const wave = (1 - Math.cos(elapsed / 24000 * Math.PI * 2)) / 2;
    const rect = hero.getBoundingClientRect();
    // Reach the close-up while the photograph is still on screen.
    const distance = Math.max(280, Math.min(480, innerHeight * .58));
    const target = Math.min(1, Math.max(0, -rect.top / distance));
    progress += (target - progress) * (1 - Math.exp(-dt / 95));
    const mobile = innerWidth <= 720;
    const scale = 1.035 + wave * .035 + progress * (mobile ? .23 : .28);
    const travelX = Math.min(mobile ? 8 : 20, image.clientWidth * .022);
    // Panoramique lent vers la droite pendant la respiration : la marge gauche du zoom le permet sans bord vide.
    const x = -progress * travelX + wave * (mobile ? 4 : 9) * (1 - progress) + Math.sin(elapsed / 24000 * Math.PI * 2) * .5;
    const y = progress * (mobile ? 3 : 4);
    image.style.transform = `translate3d(${x.toFixed(3)}px,${y.toFixed(3)}px,0) scale(${scale.toFixed(5)})`;
    frame = requestAnimationFrame(paint);
  }
  function sync() {
    hero.classList.toggle('hero-camera-running', running());
    if (blocked()) image.style.removeProperty('transform');
    if (running()) { if (!frame) { last = 0; frame = requestAnimationFrame(paint); } }
    else { cancelAnimationFrame(frame); frame = 0; last = 0; }
  }
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0 }).observe(image.closest('a'));
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  if (dialog) new MutationObserver(sync).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  media.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  sync();
})();
