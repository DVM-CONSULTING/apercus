const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = reducedQuery.matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const desktop = window.matchMedia('(min-width: 761px)');
const header = $('.header');
let cinematic = null;
let craftTrigger = null;
let galleryTween = null;
let galleryContext = null;
let heroScroll = 0;
let galleryIndex = 0;
let documentScrollTween = null;
function scrollDocument(top, behavior = 'smooth', onComplete) {
  documentScrollTween?.kill();
  if (behavior !== 'smooth' || reducedQuery.matches || !window.gsap) {
    window.scrollTo({ top, behavior: 'instant' });
    onComplete?.();
    return;
  }
  const state = { y: window.scrollY };
  documentScrollTween = gsap.to(state, { y: top, duration: 1.05, ease: 'power3.inOut',
    onUpdate: () => window.scrollTo({ top: state.y, behavior: 'instant' }),
    onComplete: () => { documentScrollTween = null; onComplete?.(); }
  });
}
for (const type of ['wheel', 'touchstart']) addEventListener(type, () => { documentScrollTween?.kill(); documentScrollTween = null; }, { passive: true });
addEventListener('keydown', event => { if (['PageDown', 'PageUp', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) { documentScrollTween?.kill(); documentScrollTween = null; } });
let menuLastFocus;
let craftStep = -1;
let filterBusy = false;
let lastScroll = 0;

function syncHeader() {
  const y = window.scrollY;
  header.classList.toggle('is-scrolled', y > 80);
  document.body.classList.toggle('barre-cachee', y < innerHeight * 0.6);
  const total = document.documentElement.scrollHeight - innerHeight;
  $('.scroll-progress').style.transform = `scaleX(${total > 0 ? y / total : 0})`;
  lastScroll = y;
}
addEventListener('scroll', syncHeader, { passive: true });
syncHeader();

const menuButton = $('.menu-toggle');
const mobileMenu = $('#mobile-nav');
function closeMenu() {
  mobileMenu.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Ouvrir le menu');
  document.body.classList.remove('menu-open');
}
menuButton.addEventListener('click', () => {
  const opening = menuButton.getAttribute('aria-expanded') !== 'true';
  if (!opening) { closeMenu(); return; }
  menuLastFocus = document.activeElement;
  mobileMenu.hidden = false;
  menuButton.setAttribute('aria-expanded', 'true');
  menuButton.setAttribute('aria-label', 'Fermer le menu');
  document.body.classList.add('menu-open');
  $('a', mobileMenu).focus();
  if (window.gsap && !reducedMotion) gsap.fromTo($$('a', mobileMenu), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .45, stagger: .055, ease: 'power3.out' });
});
$$('a', mobileMenu).forEach(a => a.addEventListener('click', closeMenu));
desktop.addEventListener('change', () => { if (desktop.matches) closeMenu(); });
document.addEventListener('keydown', e => {
  if (mobileMenu.hidden) return;
  if (e.key === 'Escape') { closeMenu(); menuLastFocus?.focus(); }
  if (e.key === 'Tab') {
    const items = [menuButton, ...$$('a', mobileMenu)];
    const first = items[0], last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

const projects = [
  { title: 'Le bois, à l’état de structure.', category: 'CHARPENTE & ASSEMBLAGE', image: 'charpente-bois.webp', alt: 'Poutres en bois clair assemblées en structure adossée', description: 'Des pièces de bois qui dessinent un nouvel espace. Ce chantier donne à voir la structure, ses portées et le soin apporté à l’assemblage. Photographie d’un ouvrage Barthe Charpente.' },
  { title: 'Un nouvel espace à vivre.', category: 'CARPORT & EXTÉRIEUR', image: 'carport.webp', alt: 'Carport couvert adossé à une maison avec vue sur les montagnes', description: 'Un carport couvert vient prolonger la maison. Une façon de protéger un véhicule et de repenser l’usage des espaces extérieurs. Photographie d’un ouvrage Barthe Charpente.' },
  { title: 'Une toiture, un caractère.', category: 'COUVERTURE & ZINGUERIE', image: 'toiture.webp', alt: 'Toiture en zinc avec lucarne au-dessus d’une façade bleue', description: 'Une couverture en zinc, une lucarne intégrée et des raccords qui épousent les volumes du bâtiment. Les finitions participent autant à la protection qu’au caractère de la toiture. Photographie d’un ouvrage Barthe Charpente.' },
  { title: 'Redonner de l’avenir à l’existant.', category: 'RÉNOVATION DE TOITURE', image: 'chantier-toiture.webp', alt: 'Vue en hauteur d’un chantier de rénovation de couverture en tuiles', description: 'Un chantier de rénovation de toiture en tuiles. Intervenir sur l’existant, reprendre la couverture et accompagner le bâtiment vers une nouvelle étape. Photographie d’un chantier Barthe Charpente.' }
];
const projectDialog = $('#project-dialog');
function openDialog(dialog) {
  dialog.showModal();
  document.body.classList.add('modal-open');
  if (window.gsap && !reducedMotion) gsap.fromTo(dialog, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .3, ease: 'power3.out' });
}
function closeDialog(dialog) { dialog.close(); document.body.classList.remove('modal-open'); }
$$('dialog').forEach(dialog => {
  $('.dialog-close', dialog).addEventListener('click', () => closeDialog(dialog));
  dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
  dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(dialog);
  });
});
$$('[data-project]').forEach(button => button.addEventListener('click', () => {
  const p = projects[Number(button.dataset.project)];
  $('#dialog-image').src = `assets/${p.image}`;
  $('#dialog-image').alt = p.alt;
  $('#dialog-title').textContent = p.title;
  $('#dialog-category').textContent = p.category;
  $('#dialog-description').textContent = p.description;
  projectDialog.setAttribute('aria-labelledby', 'dialog-title');
  openDialog(projectDialog);
}));
$('.dialog-contact').addEventListener('click', () => closeDialog(projectDialog));

const gallery = $('.gallery-viewport');
const track = $('.project-grid');
const visibleProjects = () => $$('.project').filter(p => !p.hidden);
function syncGallery(index = 0) {
  const cards = visibleProjects();
  galleryIndex = Math.max(0, Math.min(cards.length - 1, index));
  $('#gallery-count').textContent = `${String(galleryIndex + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
  $('.gallery-prev').disabled = galleryIndex === 0;
  $('.gallery-next').disabled = galleryIndex === cards.length - 1;
}
function goToProject(index, behavior = reducedQuery.matches ? 'auto' : 'smooth') {
  const cards = visibleProjects();
  const target = cards[Math.max(0, Math.min(cards.length - 1, index))];
  if (!target) return;
  const gutter = parseFloat(getComputedStyle(track).paddingLeft);
  const offset = Math.min(Math.max(0, track.scrollWidth - gallery.clientWidth), Math.max(0, target.offsetLeft - gutter));
  if (galleryTween) {
    const trigger = galleryTween.scrollTrigger;
    const distance = Math.max(1, track.scrollWidth - gallery.clientWidth);
    scrollDocument(trigger.start + Math.min(1, offset / distance) * (trigger.end - trigger.start), behavior);
  } else gallery.scrollTo({ left: offset, behavior });
  syncGallery(cards.indexOf(target));
}
$('.gallery-prev').addEventListener('click', () => goToProject(galleryIndex - 1));
$('.gallery-next').addEventListener('click', () => goToProject(galleryIndex + 1));
gallery.addEventListener('scroll', () => {
  if (galleryTween) return;
  const cards = visibleProjects();
  let nearest = 0, distance = Infinity;
  cards.forEach((card, i) => { const targetOffset = Math.min(track.scrollWidth - gallery.clientWidth, Math.max(0, card.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft))); const d = Math.abs(targetOffset - gallery.scrollLeft); if (d < distance) { distance = d; nearest = i; } });
  syncGallery(nearest);
}, { passive: true });
track.addEventListener('focusin', e => {
  const card = e.target.closest('.project');
  if (!card || !galleryTween) return;
  gallery.scrollLeft = 0;
  goToProject(visibleProjects().indexOf(card), 'auto');
});
function setupGalleryMotion() {
  galleryContext?.revert();
  galleryTween = null;
  gallery.scrollLeft = 0;
  syncGallery(0);
  if (!window.gsap || !window.ScrollTrigger) return;
  galleryContext = gsap.matchMedia();
  galleryContext.add('(prefers-reduced-motion: no-preference) and (min-height: 520px)', () => {
    $('.projects-pin').classList.add('gallery-pinned');
    galleryTween = gsap.to(track, { x: () => -(track.scrollWidth - gallery.clientWidth), ease: 'none', scrollTrigger: {
      trigger: '.projects', pin: '.projects-pin', start: 'top top', end: () => `+=${Math.max(1, track.scrollWidth - gallery.clientWidth)}`,
      scrub: .65, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: self => {
        const distance = self.progress * (track.scrollWidth - gallery.clientWidth);
        const cards = visibleProjects();
        const maxDistance = track.scrollWidth - gallery.clientWidth;
        const closest = cards.reduce((best, card, i) => { const offset = Math.min(maxDistance, Math.max(0, card.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft))); const delta = Math.abs(offset - distance); return delta < best.distance ? { index: i, distance: delta } : best; }, { index: 0, distance: Infinity });
        syncGallery(closest.index);
      }
    } });
    return () => { galleryTween = null; $('.projects-pin').classList.remove('gallery-pinned'); requestAnimationFrame(() => { if (!galleryTween) { gallery.scrollLeft = 0; syncGallery(0); } }); };
  });
}
$$('[data-filter]').forEach(button => button.addEventListener('click', async () => {
  if (filterBusy || button.classList.contains('active')) return;
  filterBusy = true;
  const filter = button.dataset.filter;
  $$('[data-filter]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
  if (window.gsap && !reducedMotion) await gsap.to(track, { opacity: 0, duration: .15 });
  $$('.project').forEach(p => { p.hidden = filter !== 'all' && p.dataset.category !== filter; });
  setupGalleryMotion();
  if (window.gsap && !reducedMotion) gsap.to(track, { opacity: 1, duration: .35 });
  window.ScrollTrigger?.refresh();
  navigateToSection('#realisations', 'auto');
  syncGallery(0);
  filterBusy = false;
}));
$$('.service').forEach(details => details.addEventListener('toggle', () => {
  if (details.open) $$('.service').forEach(other => { if (other !== details) other.open = false; });
  window.ScrollTrigger?.refresh();
}));
$('#project-form [name="_ts"]').value = String(Date.now());
// Formulaire : compteur de caractères, projet présélectionné depuis les savoir-faire, champs en erreur après un essai
const projetForm = $('#project-form'), messageProjet = $('#project-message'), compteurMessage = $('.compteur');
messageProjet?.addEventListener('input', () => { compteurMessage.textContent = `${messageProjet.value.length} / 3000`; });
$$('[data-projet]').forEach(lien => lien.addEventListener('click', () => {
  const choix = $(`.pastille input[value="${lien.dataset.projet}"]`);
  if (choix) choix.checked = true;
}));
projetForm.addEventListener('invalid', () => projetForm.classList.add('a-essaye'), true);
$('#project-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  if (!form.reportValidity()) return;
  // Service de réception branché (data-endpoint) : envoi suivi par le kit (bdFormSent / bdFormFailed).
  if (/^https:\/\//.test(form.dataset.endpoint || '') && window.bdEnvoyerFormulaire) {
    const statusEl = $('#form-status');
    const submit = $('button[type="submit"]', form);
    submit.disabled = true;
    statusEl.hidden = true;
    const result = await window.bdEnvoyerFormulaire(form);
    submit.disabled = false;
    statusEl.textContent = result.ok
      ? 'Merci, votre demande est bien partie. Josselyn vous répond au plus vite.'
      : `Votre demande n’est pas partie${result.erreurs.length ? ' : ' + result.erreurs.join(' ') : '. Réessayez dans un instant.'} Vous pouvez aussi appeler le 06 87 73 51 78.`;
    statusEl.hidden = false;
    if (result.ok) { form.reset(); $('[name="_ts"]', form).value = String(Date.now()); }
    return;
  }
  // Sinon : prépare un e-mail dans la messagerie du visiteur (aucun envoi automatique, donc aucun bdFormSent).
  const data = new FormData(form);
  const champ = n => String(data.get(n) || '').trim();
  const lignes = [`Nom : ${champ('nom')}`, `E-mail : ${champ('email')}`, champ('telephone') && `Téléphone : ${champ('telephone')}`, `Projet : ${champ('type')}`, champ('commune') && `Commune du chantier : ${champ('commune')}`].filter(Boolean);
  const body = `Bonjour Josselyn,\n\nJe souhaite vous parler de mon projet.\n\n${lignes.join('\n')}\n\n${champ('message')}\n\nÀ bientôt,\n${champ('nom')}`;
  const mailto = `mailto:contact@barthecharpente.fr?subject=${encodeURIComponent('Mon projet — ' + data.get('type'))}&body=${encodeURIComponent(body)}`;
  const status = $('#form-status');
  status.replaceChildren();
  status.append('Votre e-mail est prêt. Si votre messagerie ne s’est pas ouverte, ');
  const link = document.createElement('a');
  link.href = mailto; link.textContent = 'ouvrez le message ici';
  status.append(link, ' ou contactez-nous au 06 87 73 51 78. Aucun message n’est envoyé automatiquement.');
  status.hidden = false;
  $('.bouton-envoi', form)?.classList.add('est-pret');
  window.location.href = mailto;
});
const craftDescriptions = ['Penser les lignes.<br>Préparer la structure.', 'Donner forme à la matière.<br>Soigner chaque coupe.', 'Réunir les pièces.<br>Faire corps, ensemble.', 'Couvrir, fermer, isoler.<br>Donner un visage à la maison.'];
// Seuils des quatre gestes sur la progression de la section (alignés sur la maison 3D).
const craftSeuils = [0, 0.16, 0.32, 0.58];
const craftEtapeDe = p => craftSeuils.reduce((n, s, i) => (p >= s ? i : n), 0);
function setCraftStep(index) {
  if (craftStep === index) return;
  craftStep = index;
  $$('.craft-word').forEach((word, i) => word.classList.toggle('active', i === index));
  $$('[data-craft]').forEach((button, i) => { button.classList.toggle('active', i === index); button.setAttribute('aria-pressed', String(i === index)); });
  $('#craft-description').innerHTML = craftDescriptions[index];
}
$$('[data-craft]').forEach((button, i) => button.addEventListener('click', () => {
  if (craftTrigger) scrollDocument(craftTrigger.start + (craftTrigger.end - craftTrigger.start) * (craftSeuils[i] + .03));
  else setCraftStep(i);
}));
function craftProgress(self) {
  setCraftStep(craftEtapeDe(self.progress));
  $('.craft-progress span').style.transform = `scaleX(${self.progress})`;
  document.dispatchEvent(new CustomEvent('craft:progression', { detail: self.progress }));
}
function initMotion() {
  setCraftStep(0);
  if (!window.gsap || !window.ScrollTrigger) { $('.hero').classList.add('motion-unavailable');syncGallery(); return; }
  gsap.registerPlugin(ScrollTrigger);
  const motion = gsap.matchMedia();
  motion.add('(prefers-reduced-motion: no-preference)', () => {
    const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from('.hero h1 .line>span', { yPercent: 110, duration: 1.25, stagger: .13 }, .12)
      .from('.hero-kicker,.hero-bottom,.joinery-caption,.hero-footer', { opacity: 0, y: 10, duration: .9, stagger: .08 }, .5);
    // Ouverture « épure » (motion.js) : le titre attend la fin du tracé.
    if (document.documentElement.classList.contains('avec-ouverture')) { heroTl.pause(); document.addEventListener('intro:fin', () => heroTl.play(), { once: true }); }
    $$('.reveal').forEach(element => gsap.from(element, { y: 55, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 92%', once: true } }));
    gsap.from('.maker-photo img', { scale: 1.08, ease: 'none', scrollTrigger: { trigger: '.maker', start: 'top bottom', end: 'bottom top', scrub: true } });

  });
  motion.add('(min-width: 1001px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)', () => {
    craftTrigger = ScrollTrigger.create({ trigger: '.craft', pin: '.craft-pin', start: 'top top', end: '+=4600', scrub: true, anticipatePin: 1, onUpdate: craftProgress });
    gsap.to('.craft-visual img', { scale: 1.12, yPercent: -3, ease: 'none', scrollTrigger: { trigger: '.craft', start: () => craftTrigger.start, end: () => craftTrigger.end, scrub: true } });
    return () => { craftTrigger = null; setCraftStep(0); $('.craft-progress span').style.transform = 'scaleX(0)'; };
  });
  // Téléphone, tablette, écran bas : la section reste collée à l'écran (CSS sticky) le temps de construire la maison.
  motion.add({ petit: '(max-width: 1000px)', bas: '(max-height: 699px)', mouvement: '(prefers-reduced-motion: no-preference)' }, ctx => {
    const { petit, bas, mouvement } = ctx.conditions;
    if (!mouvement || !(petit || bas)) return;
    craftTrigger = ScrollTrigger.create({ trigger: '.craft', start: 'top top', end: 'bottom bottom', scrub: true, onUpdate: craftProgress });
    return () => { craftTrigger = null; setCraftStep(0); $('.craft-progress span').style.transform = 'scaleX(0)'; };
  });
  setupGalleryMotion();
  document.fonts.ready.then(() => ScrollTrigger.refresh());
  // Image slots have fixed dimensions; refreshing on lazy-image loads interrupts anchor scrolling.
}
initMotion();

// Native fragment scrolling uses the unpinned layout in some browsers. Resolve
// the final document coordinate after ScrollTrigger has laid out its spacers.
function navigateToSection(hash, behavior = reducedQuery.matches ? 'auto' : 'smooth') {
  const target = document.getElementById(hash.slice(1));
  if (!target) return;
  window.ScrollTrigger?.refresh();
  scrollDocument(Math.max(0, target.getBoundingClientRect().top + window.scrollY), behavior, () => {
    const finalTop = Math.max(0, target.getBoundingClientRect().top + window.scrollY);
    if (Math.abs(window.scrollY - finalTop) > 2) window.scrollTo({ top: finalTop, behavior: 'instant' });
  });
}
$$('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
  const hash = link.getAttribute('href');
  if (!document.getElementById(hash.slice(1))) return;
  event.preventDefault();
  if (location.hash !== hash) history.pushState(null, '', hash);
  navigateToSection(hash);
}));
document.fonts.ready.then(() => { if (location.hash) navigateToSection(location.hash, 'auto'); });

addEventListener('load', () => { if (location.hash) requestAnimationFrame(() => navigateToSection(location.hash, 'auto')); }, { once: true });

$$('[data-assembly]').forEach(button=>button.addEventListener('click',()=>{
  const hero=$('.hero');
  const start=hero.getBoundingClientRect().top+scrollY;
  scrollDocument(start+Math.max(0,hero.offsetHeight-innerHeight)*Number(button.dataset.assembly));
}));
