/*
 * Barthe Charpente — mise en mouvement (GSAP 3.13 + ScrollTrigger + SplitText + DrawSVG, WebGL).
 * Chargé après app.js. Rien ne se joue en « mouvement réduit » ni sans GSAP : le site reste entier.
 *
 *   1. Ouverture : le logo officiel se dessine (masque sur l'image d'origine), puis se pose dans l'en-tête.
 *   2. Premier écran : lueur de fin de journée (CSS), sortie en douceur au défilement ; la section suivante
 *      monte par-dessus pendant que la photo reste en place (position collante, gérée par le navigateur).
 *   3. Titres : lettres et lignes qui montent ; la phrase de l'atelier se remplit au défilement.
 *   4. Bandeau des savoir-faire qui défile, accéléré par la vitesse du défilement.
 *   5. Maison à ossature bois en 3D qui se construit (assets/maison3d.js, chargée à la demande).
 *   6. Galerie : inclinaison selon la vitesse, parallaxe des photos ; portrait dévoilé lame par lame.
 *   6 bis. Savoir-faire : cartes qui montent l'une sur l'autre (position collante, téléphone et ordinateur),
 *      épures tracées, photos en parallaxe ; formulaire animé.
 *   7. Curseur et boutons aimantés (ordinateur), grande signature du pied de page.
 */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;
const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pointeurFin = matchMedia('(hover: hover) and (pointer: fine)').matches;
const economie = navigator.connection?.saveData === true;
const { gsap, ScrollTrigger, SplitText, DrawSVGPlugin } = window;

// hauteur d'écran stable sur iPhone (100svh : sans la barre d'adresse qui apparaît et disparaît au défilement)
const hauteurEcran = (() => {
  let sonde = null;
  return () => {
    if (!sonde) { sonde = document.createElement('div'); sonde.setAttribute('aria-hidden', 'true'); sonde.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:100svh;visibility:hidden;pointer-events:none'; document.body.append(sonde); }
    return sonde.offsetHeight || innerHeight;
  };
})();

function finIntro() {
  html.classList.remove('avec-ouverture');
  try { sessionStorage.setItem('bc-intro', '1'); } catch {}
  document.dispatchEvent(new Event('intro:fin'));
}

if (!gsap || !ScrollTrigger || reduit) {
  if (html.classList.contains('avec-ouverture')) finIntro();
} else {
  gsap.registerPlugin(ScrollTrigger, ...[SplitText, DrawSVGPlugin].filter(Boolean));
  document.fonts.ready.then(() => {
    ouverture();
    titres();
    defile();
    galerie();
    savoirFaire();
    formulaire();
    portrait();
    piedDePage();
    if (pointeurFin) { curseur(); aimants(); }
    ScrollTrigger.refresh();
  });
  sortieHero();
  rideauHero();
  maison3d();
}

/* 1. Ouverture ------------------------------------------------------------------------------ */
function ouverture() {
  const rideau = $('.ouverture');
  if (!rideau || !html.classList.contains('avec-ouverture') || !DrawSVGPlugin || !SplitText) { if (html.classList.contains('avec-ouverture')) finIntro(); return; }
  rideau.style.animation = 'none';
  // Le logo officiel n'est pas redessiné : un masque suit sa ligne et dévoile l'image d'origine, pixel pour pixel.
  const logo = $('.ouverture-logo', rideau), guide = $('.ouverture-guide', rideau), volet = $('.ouverture-volet', rideau);
  const titre = new SplitText($('.ouverture-titre', rideau), { type: 'chars', mask: 'chars' });
  let parti = false;
  const lever = () => { if (!parti) { parti = true; document.dispatchEvent(new Event('intro:fin')); } };
  // le logo dessiné vient se poser exactement sur celui de l'en-tête
  const versEntete = () => {
    const img = $('.header .brand img'), r = img?.getBoundingClientRect(), l = logo.getBoundingClientRect();
    if (!r || !r.width || !l.width) return { x: 0, y: -innerHeight * 0.4, scale: 0.3 };
    const cible = { x: r.left, y: r.top + (r.height * 117) / 512, w: r.width, h: (r.height * 229) / 512 };
    const k = cible.w / l.width;
    return { x: cible.x + cible.w / 2 - (l.left + l.width / 2), y: cible.y + cible.h / 2 - (l.top + l.height / 2), scale: k };
  };
  const tl = gsap.timeline({ onComplete: () => { titre.revert(); finIntro(); } });
  tl.set(guide, { drawSVG: 0 })
    .set(volet, { scaleX: 0, transformOrigin: '0% 50%' })
    .to(guide, { drawSVG: '100%', duration: 1.7, ease: 'power2.inOut' }, 0.15)
    .to(volet, { scaleX: 1, duration: 0.75, ease: 'power3.inOut' }, 1.25)
    .from(titre.chars, { yPercent: 110, duration: 0.7, ease: 'power4.out', stagger: 0.02 }, 1.7)
    .to(titre.chars, { yPercent: -110, duration: 0.45, ease: 'power3.in', stagger: 0.012 }, 2.75)
    // valeurs relues au moment du déplacement (polices chargées, écran tourné)
    .to(logo, { x: () => versEntete().x, y: () => versEntete().y, scale: () => versEntete().scale, transformOrigin: '50% 50%', duration: 1, ease: 'expo.inOut' }, 2.9)
    .to(rideau, { clipPath: 'inset(0 0 100% 0)', duration: 1.05, ease: 'expo.inOut' }, 3.55)
    .add(lever, 3.8)
    .from('.hero-photo img', { scale: 1.1, duration: 1.8, ease: 'expo.out', transformOrigin: '68% 34%' }, 3.6);
  const passer = () => tl.timeScale(5);
  $('.ouverture-passer', rideau)?.addEventListener('click', passer);
  rideau.addEventListener('click', passer);
  addEventListener('keydown', passer, { once: true });
}

/* 2. Premier écran ------------------------------------------------------------------------- */
function sortieHero() {
  if (CSS.supports('animation-timeline: scroll()')) return; // fait par le navigateur (motion.css), plus fluide
  gsap.to('.hero-content', { yPercent: -18, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 25%', scrub: true } });
  gsap.to('.hero-defiler', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: '15% top', scrub: true } });
}

// La photo reste collée en bas de l'écran (CSS position: sticky, voir motion.css : aucun calcul à chaque
// image, donc fluide sur téléphone) et « L'esprit Barthe » glisse par-dessus. Ici, seulement :
// la hauteur où la photo se colle (son bas sur le bas de l'écran) et, si le navigateur ne sait pas
// animer selon le défilement, l'assombrissement (opacité seule, peu coûteuse).
function rideauHero() {
  const hero = $('.hero'), voile = $('.hero-voile'), rideau = $('.hero-rideau'), suite = $('#atelier');
  if (!hero || !rideau || !suite) return;
  // la photo reste en place sur la hauteur de l'écran, mais jamais plus longtemps que la section qui la recouvre
  // n'est haute (sur téléphone, « L'esprit Barthe » est plus courte que l'écran)
  const caler = () => {
    hero.style.setProperty('--hero-haut', `${Math.min(0, hauteurEcran() - hero.offsetHeight)}px`);
    rideau.style.setProperty('--rideau-espace', `${Math.min(hauteurEcran(), suite.offsetHeight)}px`);
  };
  caler();
  addEventListener('resize', caler, { passive: true });
  new ResizeObserver(caler).observe(suite);
  if (voile && !CSS.supports('animation-timeline: view()')) {
    gsap.fromTo(voile, { opacity: 0 }, { opacity: 0.7, ease: 'none', scrollTrigger: { trigger: '#atelier', start: 'top bottom', end: 'top top', scrub: true } });
  }
}

/* 3. Titres ------------------------------------------------------------------------------------ */
function titres() {
  if (!SplitText) return;
  // phrase de l'atelier : les lettres se remplissent au fil du défilement
  const phrase = $('.statement');
  if (phrase) {
    const s = new SplitText(phrase, { type: 'chars,words' });
    gsap.fromTo(s.chars, { opacity: 0.12 }, { opacity: 1, ease: 'none', stagger: 0.05, scrollTrigger: { trigger: phrase, start: 'top 85%', end: 'bottom 45%', scrub: true } });
  }
  // grands titres : chaque ligne monte depuis un masque
  $$('.projects-title h2, .section-title, .maker-copy h2, .contact-heading h2').forEach((h) => {
    const s = new SplitText(h, { type: 'lines,chars', mask: 'lines', linesClass: 'ligne' });
    gsap.from(s.chars, { yPercent: 115, rotate: 4, duration: 1, ease: 'power4.out', stagger: 0.018, scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
  });
}

/* 4. Bandeau défilant ------------------------------------------------------------------------- */
function defile() {
  const piste = $('.defile-piste');
  if (!piste) return;
  const boucle = gsap.to(piste, { xPercent: -50, ease: 'none', duration: 34, repeat: -1 });
  const elan = gsap.quickTo(piste, 'skewX', { duration: 0.5, ease: 'power3' });
  let sens = 1;
  const repos = gsap.delayedCall(0.18, () => { elan(0); gsap.to(boucle, { timeScale: sens, duration: 1.2, overwrite: true }); }).pause();
  ScrollTrigger.create({
    trigger: '.defile', start: 'top bottom', end: 'bottom top',
    onUpdate: (self) => {
      const v = self.getVelocity();
      sens = self.direction;
      gsap.to(boucle, { timeScale: gsap.utils.clamp(-6, 6, v / 280) || sens, duration: 0.25, overwrite: true });
      elan(gsap.utils.clamp(-8, 8, v / -260));
      repos.restart(true);
    },
  });
}

/* 5. Maison 3D -------------------------------------------------------------------------------- */
function maison3d() {
  const section = $('.craft'), toile = $('.craft-3d');
  if (!section || !toile || economie) return;
  const essai = document.createElement('canvas');
  if (!(essai.getContext('webgl2') || essai.getContext('webgl'))) return;
  let scene = null, attente = 0, etapes = [], indice = -1;
  const num = $('.craft-etape-num'), txt = $('.craft-etape-txt');
  function legende(p) {
    let i = 0;
    etapes.forEach(([seuil], k) => { if (p >= seuil) i = k; });
    if (i === indice) return;
    indice = i;
    num.textContent = `ÉTAPE ${String(i + 1).padStart(2, '0')} / ${String(etapes.length).padStart(2, '0')}`;
    gsap.fromTo(txt, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power3.out', overwrite: true, onStart: () => { txt.textContent = etapes[i][1]; } });
  }
  document.addEventListener('craft:progression', (e) => { attente = e.detail; scene?.progression(attente); if (etapes.length) legende(attente); });
  const charger = async () => {
    try {
      const mod = await import('./assets/maison3d.js');
      etapes = mod.ETAPES;
      section.classList.add('a-3d');
      scene = mod.demarrer({ canvas: toile, mobile: innerWidth <= 1000 });
      scene.progression(attente);
      legende(attente);
      ScrollTrigger.refresh();
    } catch (err) {
      section.classList.remove('a-3d');
    }
  };
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); charger(); } }, { rootMargin: '1200px 0px' });
  io.observe(section);
}

/* 6. Galerie et portrait ---------------------------------------------------------------------- */
function galerie() {
  const photos = $$('.project-photo img');
  if (!photos.length) return;
  gsap.from('.project', { clipPath: 'inset(100% 0 0 0)', duration: 1.2, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.gallery-viewport', start: 'top 80%', once: true } });
  gsap.set(photos, { scale: 1.14 });
  const incline = gsap.quickTo(photos, 'skewX', { duration: 0.6, ease: 'power3' });
  const redresse = gsap.delayedCall(0.18, () => incline(0)).pause();
  ScrollTrigger.create({ trigger: '.projects', start: 'top bottom', end: 'bottom top', onUpdate: (s) => { incline(gsap.utils.clamp(-5, 5, s.getVelocity() / -320)); redresse.restart(true); } });
  // parallaxe : la photo glisse dans son cadre selon sa place à l'écran
  const vue = $('.gallery-viewport');
  let actif = false;
  ScrollTrigger.create({ trigger: '.projects', start: 'top bottom', end: 'bottom top', onToggle: (s) => { actif = s.isActive; } });
  vue.addEventListener('scroll', () => { actif = true; }, { passive: true });
  gsap.ticker.add(() => {
    if (!actif) return;
    const centre = innerWidth / 2;
    photos.forEach((img) => {
      const r = img.parentElement.getBoundingClientRect();
      if (r.right < 0 || r.left > innerWidth) return;
      gsap.set(img, { xPercent: gsap.utils.clamp(-6, 6, ((r.left + r.width / 2 - centre) / innerWidth) * -9) });
    });
  });
}

function portrait() {
  const cadre = $('.maker-photo');
  if (!cadre) return;
  const lattes = document.createElement('div');
  lattes.className = 'lattes';
  lattes.setAttribute('aria-hidden', 'true');
  lattes.innerHTML = '<span></span>'.repeat(7);
  cadre.append(lattes);
  gsap.to($$('span', lattes), { scaleX: 0, duration: 1.1, ease: 'expo.inOut', stagger: 0.08, scrollTrigger: { trigger: cadre, start: 'top 70%', once: true }, onComplete: () => lattes.remove() });
}

/* 6 bis. Savoir-faire et formulaire -------------------------------------------------------- */
function savoirFaire() {
  const chapo = $('.sf-chapo');
  if (chapo && SplitText) {
    const s = new SplitText(chapo, { type: 'words' });
    gsap.fromTo(s.words, { opacity: 0.15 }, { opacity: 1, ease: 'none', stagger: 0.08, scrollTrigger: { trigger: chapo, start: 'top 85%', end: 'bottom 55%', scrub: true } });
  }
  const cartes = $$('.sf-carte');
  cartes.forEach((carte) => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: carte, start: 'top 80%', once: true } });
    tl.from($('.sf-interieur', carte), { y: 90, opacity: 0, duration: 1.1, ease: 'expo.out' })
      .from($('.sf-num', carte), { yPercent: 70, opacity: 0, duration: 0.9, ease: 'power4.out' }, 0.15);
    const titre = $('h3', carte);
    if (SplitText) {
      const s = new SplitText(titre, { type: 'lines', mask: 'lines' });
      tl.from(s.lines, { yPercent: 105, duration: 0.9, ease: 'power4.out', stagger: 0.08 }, 0.25);
    }
    tl.from($$('.sf-accroche, .sf-texte p:not(.sf-accroche)', carte), { y: 18, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08 }, 0.4)
      .from($$('.sf-tags li', carte), { y: 12, opacity: 0, scale: 0.92, duration: 0.5, ease: 'back.out(2)', stagger: 0.05 }, 0.6)
      .from($('.sf-lien', carte), { y: 14, opacity: 0, duration: 0.6, ease: 'power3.out' }, 0.75);
    const img = $('.sf-visuel img', carte);
    if (img) {
      tl.from($('.sf-visuel', carte), { clipPath: 'inset(0 0 100% 0)', duration: 1.3, ease: 'expo.inOut' }, 0.1);
      gsap.fromTo(img, { yPercent: -7, scale: 1.18 }, { yPercent: 7, scale: 1.08, ease: 'none', scrollTrigger: { trigger: carte, start: 'top bottom', end: 'bottom top', scrub: true } });
    }
    const traits = $$('.sf-epure path', carte);
    if (traits.length && DrawSVGPlugin) {
      gsap.set(traits, { drawSVG: 0 });
      gsap.to(traits, { drawSVG: '100%', duration: 0.9, ease: 'power2.inOut', stagger: { amount: 1.6 }, scrollTrigger: { trigger: carte, start: 'top 70%', once: true } });
    }
  });
  // les cartes montent l'une sur l'autre, sur téléphone comme sur ordinateur. Chaque carte se colle
  // (position: sticky, motion.css : gérée par le navigateur, donc fluide) : en haut, en léger décalé, si elle
  // tient dans l'écran ; sinon quand son bas arrive en bas de l'écran (au-dessus de la barre d'appel), pour
  // être lue en entier. La suivante monte par-dessus ; la précédente s'assombrit et recule un peu.
  if (!cartes.length) return;
  const haut = (carte, i) => Math.min(84 + i * 16, hauteurEcran() - carte.offsetHeight - (innerWidth <= 760 ? 92 : 24));
  const caler = () => cartes.forEach((carte, i) => carte.style.setProperty('--sf-haut', `${haut(carte, i)}px`));
  caler();
  addEventListener('resize', caler, { passive: true });
  new ResizeObserver(caler).observe(cartes[0].parentElement);
  cartes.slice(0, -1).forEach((carte, i) => {
    const interieur = $('.sf-interieur', carte), voile = document.createElement('div');
    voile.className = 'sf-voile'; voile.setAttribute('aria-hidden', 'true'); interieur.append(voile);
    const suivante = cartes[i + 1];
    gsap.timeline({ scrollTrigger: { trigger: suivante, start: 'top bottom', end: () => `top ${haut(suivante, i + 1)}px`, scrub: true, invalidateOnRefresh: true } })
      .fromTo(voile, { opacity: 0 }, { opacity: 0.6, ease: 'none' }, 0)
      .fromTo(interieur, { scale: 1 }, { scale: 0.94, ease: 'none', immediateRender: false }, 0);
  });
}

function formulaire() {
  const f = $('#project-form');
  if (!f) return;
  const tl = gsap.timeline({ scrollTrigger: { trigger: f, start: 'top 85%', once: true } });
  tl.from(f, { y: 70, opacity: 0, duration: 1.1, ease: 'expo.out' })
    .from($$('.formulaire-tete > *', f), { y: 16, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' }, 0.25)
    .from($$('.pastille', f), { y: 14, opacity: 0, scale: 0.9, duration: 0.45, stagger: 0.035, ease: 'back.out(2)' }, 0.4)
    .from($$('.champ', f), { y: 18, opacity: 0, duration: 0.55, stagger: 0.06, ease: 'power3.out' }, 0.55)
    .from($('.formulaire-pied', f), { y: 14, opacity: 0, duration: 0.6, ease: 'power3.out' }, 0.8);
  gsap.from('.contact-carte', { x: -30, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1, scrollTrigger: { trigger: '.contact-details', start: 'top 85%', once: true } });
  // petit rebond quand on choisit un projet
  $$('.pastille input', f).forEach((r) => r.addEventListener('change', () => gsap.fromTo(r.nextElementSibling, { scale: 0.92 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' })));
}

/* 7. Pied de page, curseur, aimants ------------------------------------------------------------- */
function piedDePage() {
  const signe = $('.pied-signe');
  if (!signe || !SplitText) return;
  const s = new SplitText(signe, { type: 'chars' });
  gsap.from(s.chars, { yPercent: 100, ease: 'none', stagger: 0.04, scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'top 35%', scrub: true } });
}

function curseur() {
  const c = document.createElement('div');
  c.className = 'curseur';
  c.setAttribute('aria-hidden', 'true');
  c.innerHTML = '<span>VOIR</span>';
  document.body.append(c);
  const x = gsap.quickTo(c, 'x', { duration: 0.35, ease: 'power3' }), y = gsap.quickTo(c, 'y', { duration: 0.35, ease: 'power3' });
  addEventListener('pointermove', (e) => {
    x(e.clientX); y(e.clientY);
    c.classList.add('est-visible');
    const cible = e.target.closest?.('a,button,summary,select,input,textarea,.project');
    c.classList.toggle('voir', !!cible?.classList.contains('project'));
    c.classList.toggle('sur-lien', !!cible && !cible.classList.contains('project'));
  }, { passive: true });
  document.addEventListener('pointerleave', () => c.classList.remove('est-visible'));
}

function aimants() {
  $$('.solid-link, .header-contact, .gallery-controls button, .bouton-envoi, .sf-lien').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'elastic.out(1,0.45)' }), y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'elastic.out(1,0.45)' });
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * 0.25); y((e.clientY - r.top - r.height / 2) * 0.35); });
    el.addEventListener('pointerleave', () => { x(0); y(0); });
  });
}
