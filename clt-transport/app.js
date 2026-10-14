'use strict';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const mediaMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduced = mediaMotion.matches;
try { const saved = localStorage.getItem('clt-reduced-motion'); if (saved !== null) reduced = saved === 'true'; } catch (_) {}
const motion = window.CLTMotion;
const heroVehicle = $('.hero-vehicle');
const transportConfig = [
  { id: 'mouvement', sample: motion.sampleDeparture, positions: [.24, .72], still: [.43, .72], copy: [
    ['CHARGER', 'Chaque départ se prépare : votre matériel, ses dimensions et les conditions de chargement.'],
    ['ACHEMINER', 'Le matériel est en place. Le camion prend la route, direction votre prochain chantier.']
  ] },
  { id: 'livraison', sample: motion.sampleArrival, positions: [.22, .78], still: [.35, .96], copy: [
    ['ARRIVER', 'Au bout de la route, votre chantier. Un accès préparé, un emplacement défini, une arrivée maîtrisée.'],
    ['DÉPOSER', 'Le camion s’arrête. La rampe s’abaisse. Votre matériel rejoint le terrain, prêt à entrer en action.']
  ] }
];
const scenes = transportConfig.map(config => {
  const element = document.getElementById(config.id);
  const svg = $('.transport-world', element);
  svg.insertAdjacentHTML('afterbegin', CLTWheels.defs({ id: config.id }));
  $('.side-truck', element).setAttribute('mask', `url(#${config.id}-source-wheel-mask)`);
  $('.wheel-set', element).innerHTML = CLTWheels.markup({ id: config.id });
  // Effets de route : poussière derrière les roues (sous la caisse), gyrophare et phare (sur la cabine).
  $('.side-truck', element).insertAdjacentHTML('beforebegin', `<g class="truck-dust" aria-hidden="true">${'<ellipse rx="1" ry="1" opacity="0"/>'.repeat(10)}</g>`);
  $('.wheel-set', element).insertAdjacentHTML('afterend', `<g class="truck-lights" aria-hidden="true"><circle class="truck-headlight" cx="${motion.headlightPoint.x}" cy="${motion.headlightPoint.y}" r="34" opacity="0"/><circle class="truck-beacon-halo" cx="${motion.beaconPoint.x}" cy="${motion.beaconPoint.y}" r="46" opacity="0"/><circle class="truck-beacon" cx="${motion.beaconPoint.x}" cy="${motion.beaconPoint.y}" r="11" opacity="0"/></g>`);
  return { ...config, element, progress: 0, target: 0, phase: -1, manual: 0, initialized: false,
    truck: $('.truck-body', element), cargo: $('.cargo-pose', element), camera: $('.scene-camera', element),
    ramp: $('.loading-ramp', element), arm: $('.excavator-arm', element), tread: $('.track-tread', element),
    wheelSet: $('.wheel-set', element), roadLine: $('.road-line', element), roadTicks: $('.road-ticks', element),
    landscape: $('.landscape', element), heading: $('h2', element), lastDistance: null,
    body: $('.side-truck', element), track: $('.scene-services-track', element), dust: $$('.truck-dust ellipse', element), headlight: $('.truck-headlight', element),
    beacon: $('.truck-beacon', element), beaconHalo: $('.truck-beacon-halo', element), description: $('.journey-copy>p', element),
    stepNumber: $('.journey-eyebrow span', element), stops: $$('.journey-stop', element),
    percent: $('.journey-meter>span', element), meter: $('.journey-progress span', element) };
});
const illustratedScenes = [
  { id: 'terrassement', module: window.CLTEarthworks, controls: '[data-earth-step]', positions: [.15, .42, .82], still: [.15, .42, .94], reducedClass: 'earthworks-static' },
  { id: 'reseaux', module: window.CLTNetworks, controls: '[data-network-step]', positions: [.36, .62, .99], still: [.42, .72, 1] }
];
illustratedScenes.forEach(config => {
  const element = document.getElementById(config.id);
  if (!element || !config.module) return;
  config.module.mount(element);
  scenes.push({ ...config, element, progress: 0, target: 0, phase: 0, manual: 0, initialized: false });
});
function drawTransport(scene, p, elapsed) {
  const state = scene.sample(p, window.innerWidth <= 720);
  const speed = elapsed > 0 && scene.lastDistance !== null ? (state.distance - scene.lastDistance) / elapsed : 0;
  scene.lastDistance = state.distance;
  const fx = motion.roadEffects(state.distance, reduced ? 0 : speed);
  const onDeck = Math.abs(state.cargo.y - motion.deck) < .5 && Math.abs(state.cargo.angle) < .01;
  scene.truck.setAttribute('transform', `translate(${state.truckX} 0)`);
  scene.body.setAttribute('transform', `translate(0 ${fx.bob.toFixed(2)})`);
  scene.cargo.setAttribute('transform', `translate(${state.cargo.x} ${(state.cargo.y + (onDeck ? fx.bob : 0)).toFixed(2)}) rotate(${state.cargo.angle})`);
  scene.arm.setAttribute('transform', `rotate(${state.armAngle} 800 634)`);
  scene.ramp.setAttribute('transform', `translate(45 ${(497 + fx.bob).toFixed(2)}) rotate(${state.rampAngle})`);
  scene.dust.forEach((puff, i) => {
    const d = fx.dust[i];
    puff.setAttribute('cx', d.x.toFixed(1)); puff.setAttribute('cy', d.y.toFixed(1));
    puff.setAttribute('rx', d.r.toFixed(1)); puff.setAttribute('ry', (d.r * .55).toFixed(1));
    puff.setAttribute('opacity', d.opacity.toFixed(3));
  });
  scene.headlight.setAttribute('opacity', fx.headlight.toFixed(3));
  scene.beacon.setAttribute('opacity', (.5 + .5 * fx.beacon).toFixed(3));
  scene.beaconHalo.setAttribute('opacity', (fx.beacon * .8).toFixed(3));
  scene.camera.setAttribute('transform', `translate(${state.cameraX} 628) scale(${state.cameraZoom}) translate(0 -628)`);
  CLTWheels.update(scene.wheelSet, state.distance, elapsed);
  scene.tread.setAttribute('stroke-dashoffset', String(-state.trackDistance / motion.cargoScale));
  const units = $('.truck-scene', scene.element).clientWidth / 4000;
  const roadOffset = state.cameraX * units;
  scene.roadLine.style.backgroundPositionX = `${roadOffset}px`;
  scene.roadTicks.style.backgroundPositionX = `${roadOffset}px`;
  scene.landscape.style.transform = reduced ? 'none' : `translate3d(${roadOffset * .075}px,0,0)`;
  scene.meter.style.transform = `scaleX(${p})`;
  // Les prestations glissent de droite à gauche sous le camion, au rythme de la scène.
  if (scene.track) {
    const overflow = Math.max(0, scene.track.scrollWidth - scene.track.parentElement.clientWidth);
    scene.track.style.transform = reduced || innerWidth <= 720 ? '' : `translate3d(${(-p * overflow).toFixed(1)}px,0,0)`;
  }
  scene.percent.textContent = String(Math.round(p * 100)).padStart(2, '0');
  const phase = reduced ? scene.manual : state.phase;
  if (scene.phase !== phase) {
    scene.phase = phase;
    scene.heading.replaceChildren(document.createTextNode(scene.copy[phase][0]));
    const dot = document.createElement('span'); dot.className = 'red'; dot.textContent = '.';
    scene.heading.append(dot);
    scene.description.textContent = scene.copy[phase][1];
    scene.stepNumber.textContent = `0${phase + 1}`;
    scene.stops.forEach((button, i) => { button.classList.toggle('active', i === phase); button.setAttribute('aria-pressed', String(i === phase)); });
  }
}
function draw(scene, progress, elapsed = 0) {
  scene.progress = progress;
  if (scene.module) scene.module.render(scene.element, progress, window.innerWidth <= 720, reduced);
  else drawTransport(scene, progress, elapsed);
}
/* Scènes du camion : l'animation démarre dès que la scène entre à l'écran (pas seulement une fois épinglée en haut). */
const LEAD = .6;
const lead = scene => scene.module ? 0 : window.innerHeight * LEAD;
const travelOf = scene => Math.max(1, scene.element.offsetHeight - window.innerHeight) + lead(scene);
/** Position de défilement qui affiche l'étape p de la scène (boutons d'étape, « Réduire les animations »). */
const scrollFor = (scene, p) => scene.element.getBoundingClientRect().top + window.scrollY - lead(scene) + p * travelOf(scene);
let frame = 0, lastTime = 0;
function render(time) {
  frame = 0;
  const dt = lastTime ? time - lastTime : 16;
  let unsettled = false;
  scenes.forEach(scene => {
    const rect = scene.element.getBoundingClientRect();
    const visible = rect.top < window.innerHeight && rect.bottom > 0;
    scene.target = clamp((lead(scene) - rect.top) / travelOf(scene));
    if (reduced) {
      if (visible || !scene.initialized) draw(scene, scene.still[scene.manual]);
    } else if (visible || !scene.initialized || scene.progress !== scene.target) {
      const next = !scene.initialized || !visible ? scene.target : motion.follow(scene.progress, scene.target, dt);
      draw(scene, Math.abs(scene.target - next) < .00002 ? scene.target : next, scene.initialized && visible ? dt : 0);
      if (visible && Math.abs(scene.target - scene.progress) >= .00002) unsettled = true;
    }
    scene.initialized = true;
  });
  const hero = $('.hero').getBoundingClientRect();
  if (!reduced && hero.bottom > 0) heroVehicle.style.transform = `translate3d(0,${clamp(-hero.top / hero.height) * -25}px,0)`;
  if (unsettled) frame = requestAnimationFrame(render);
  lastTime = frame ? time : 0;
}
function requestRender() { if (!frame) frame = requestAnimationFrame(render); }
function updateMotion(save = false) {
  document.body.classList.toggle('motion-reduced', reduced);
  $$('.motion-toggle').forEach(button => {
    button.setAttribute('aria-pressed', String(reduced));
    $('.motion-label', button).textContent = reduced ? 'Activer les animations' : 'Réduire les animations';
    $('.motion-icon', button).textContent = reduced ? '▷' : 'Ⅱ';
  });
  if (save) { try { localStorage.setItem('clt-reduced-motion', String(reduced)); } catch (_) {} }
  scenes.forEach(scene => {
    if (scene.reducedClass) scene.element.classList.toggle(scene.reducedClass, reduced);
    scene.initialized = false;
  });
  requestRender();
}
$$('.motion-toggle').forEach(button => button.addEventListener('click', () => {
  const section = button.closest('section');
  const scene = scenes.find(item => item.element === section);
  if (scene && !reduced) scene.manual = scene.module ? scene.module.sample(scene.progress).phase : scene.phase;
  reduced = !reduced;
  updateMotion(true);
  const top = section.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: reduced ? top : scrollFor(scene, scene.positions[scene.manual]), behavior: 'instant' });
}));
scenes.forEach(scene => {
  const buttons = scene.module ? $$(scene.controls, scene.element) : scene.stops;
  buttons.forEach((button, index) => button.addEventListener('click', () => {
    scene.manual = index;
    if (reduced) { draw(scene, scene.still[index]); return; }
    window.scrollTo({ top: scrollFor(scene, scene.positions[index]), behavior: 'smooth' });
  }));
});
mediaMotion.addEventListener('change', event => { reduced = event.matches; updateMotion(); });
// Téléphone : les étapes défilent sous la scène épinglée. Avec les animations réduites, l'image fixe suit l'étape lue.
if ('IntersectionObserver' in window) {
  const flowObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const scene = scenes.find(item => item.element.contains(entry.target));
    if (!scene) return;
    scene.manual = Number(entry.target.dataset.flowStep);
    if (reduced) { scene.initialized = false; requestRender(); }
  }), { rootMargin: '-55% 0px -40% 0px' });
  $$('[data-flow-step]').forEach(step => flowObserver.observe(step));
}
window.addEventListener('scroll', requestRender, { passive: true });
window.addEventListener('resize', () => { scenes.forEach(scene => { scene.initialized = false; }); requestRender(); }, { passive: true });
updateMotion();
const menu = $('.menu-toggle');
const mobileNav = $('#mobile-nav');
function closeMenu() { mobileNav.hidden = true; menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Ouvrir le menu'); }
menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; mobileNav.hidden = !open; menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu'); });
$$('a', mobileNav).forEach(a => a.addEventListener('click', closeMenu));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
const form = $('#quote-form');
const date = $('input[name=date]');
const today = new Date();
date.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
// Prestations empilées : même hauteur pour toutes ; chacune s'arrête un peu plus bas que la précédente,
// et une prestation plus haute que l'écran défile d'abord en entier avant d'être recouverte.
const servicePanels = $$('.service-panel');
let stackWidth = 0;
function stackServicePanels() {
  if (!servicePanels.length) return;
  stackWidth = window.innerWidth;
  servicePanels.forEach(panel => { panel.style.minHeight = ''; });
  const tallest = Math.max(...servicePanels.map(panel => panel.offsetHeight));
  const base = window.innerWidth <= 720 ? 10 : 20;
  servicePanels.forEach((panel, i) => {
    panel.style.minHeight = `${tallest}px`;
    const top = `${Math.round(Math.min(base + i * 14, window.innerHeight - tallest - 10))}px`;
    panel.style.setProperty('--stick', top);
    const mark = panel.previousElementSibling;
    if (mark && mark.classList.contains('service-anchor')) mark.style.setProperty('--stick', top);
  });
}
stackServicePanels();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(stackServicePanels);
window.addEventListener('resize', () => { if (window.innerWidth !== stackWidth) stackServicePanels(); }, { passive: true });
// « Voir l'animation et le détail » : ouvre la prestation correspondante avant d'y descendre.
$$('[data-open-service]').forEach(link => link.addEventListener('click', () => {
  const target = document.querySelector(link.getAttribute('href'));
  if (target && target.tagName === 'DETAILS') target.open = true;
}));
// Formulaire en quatre étapes, une à la fois : le besoin choisi adapte la suite (un chantier n'a pas d'arrivée).
const TRAVAUX = ['Terrassement maison', 'VRD'];
const needKind = value => (TRAVAUX.includes(value) ? 'travaux' : value === 'À définir ensemble' ? 'libre' : value ? 'transport' : '');
const PLACEHOLDERS = {
  transport: 'Matériel à transporter (type, dimensions, poids), accès au chargement et à la livraison…',
  travaux: 'Votre projet de maison ou de travaux, le terrain, les accès, les plans disponibles…',
  libre: 'Décrivez votre besoin : transport, maison à construire, travaux VRD…',
  '': 'Matériel à transporter, maison à construire, terrain, accès, travaux VRD…'
};
const formSteps = $$('[data-form-step]', form);
const stepButtons = $$('[data-goto]', form);
const originLabel = $('[data-origin-label]', form);
const destinationField = $('[data-destination-field]', form);
const destination = $('input[name=destination]', form);
const message = $('textarea[name=message]', form);
const stepDone = [
  () => !!$('input[name=service]:checked', form),
  () => $('input[name=origin]', form).value.trim() !== '',
  () => message.value.trim() !== '',
  () => $('input[name=nom]', form).value.trim() !== '' && $('input[name=email]', form).value.trim() !== '' && $('input[name=email]', form).validity.valid
];
let currentStep = 0;
form.classList.add('form-wizard');
function adaptToNeed() {
  const kind = needKind(($('input[name=service]:checked', form) || {}).value);
  originLabel.textContent = kind === 'transport' ? 'Départ (lieu de chargement)' : kind === 'travaux' ? 'Lieu du chantier' : 'Départ ou lieu du chantier';
  destinationField.hidden = kind === 'travaux';
  destination.disabled = kind === 'travaux';
  message.placeholder = PLACEHOLDERS[kind];
}
function updateFormProgress() {
  const done = stepDone.map(check => check());
  formSteps.forEach((step, i) => step.classList.toggle('is-done', done[i]));
  stepButtons.forEach((button, i) => {
    button.classList.toggle('is-done', done[i]);
    button.classList.toggle('is-current', i === currentStep);
    if (i === currentStep) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
  });
  const count = done.filter(Boolean).length;
  $('[data-form-count]', form).textContent = String(count);
  form.style.setProperty('--form-progress', String(count / stepDone.length));
}
/** Les champs obligatoires d'une étape sont remplis ; sinon le navigateur montre ce qui manque. */
function stepValid(i) {
  return $$('input:not([type=hidden]):not(:disabled), textarea', formSteps[i]).every(field => field.closest('[hidden]') || field.reportValidity());
}
function showStep(i, focus = true) {
  currentStep = Math.max(0, Math.min(formSteps.length - 1, i));
  formSteps.forEach((step, n) => { step.hidden = n !== currentStep; });
  form.dataset.step = String(currentStep + 1);
  updateFormProgress();
  const top = form.getBoundingClientRect().top;
  if (focus && (top < 0 || top > window.innerHeight * .4)) form.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' });
  if (focus) {
    const first = $('input:checked, input:not([type=hidden]):not(:disabled), textarea', formSteps[currentStep]);
    if (first) first.focus({ preventScroll: true });
  }
}
$('[data-form-next]', form).addEventListener('click', () => { if (stepValid(currentStep)) showStep(currentStep + 1); });
$('[data-form-back]', form).addEventListener('click', () => showStep(currentStep - 1));
stepButtons.forEach((button, i) => button.addEventListener('click', () => {
  // On revient librement en arrière ; on n'avance que si les étapes précédentes sont remplies.
  for (let n = currentStep; n < i; n++) if (!stepValid(n)) { showStep(n); return; }
  showStep(i);
}));
// Choisir son besoin fait passer à l'étape suivante.
$$('input[name=service]', form).forEach(input => input.addEventListener('change', () => {
  adaptToNeed();
  if (currentStep === 0) setTimeout(() => showStep(1), reduced ? 0 : 380);
}));
// Entrée dans un champ : étape suivante plutôt qu'envoi prématuré.
form.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.target.tagName === 'TEXTAREA' || event.target.type === 'submit') return;
  if (currentStep < formSteps.length - 1) { event.preventDefault(); if (stepValid(currentStep)) showStep(currentStep + 1); }
});
form.addEventListener('input', updateFormProgress);
form.addEventListener('change', updateFormProgress);
form.addEventListener('reset', () => setTimeout(() => { adaptToNeed(); showStep(0, false); }));
adaptToNeed();
showStep(0, false);
// Les liens des prestations cochent le besoin correspondant et ouvrent l'étape suivante.
$$('[data-service]').forEach(a => a.addEventListener('click', () => {
  const choice = $$('input[name=service]', form).find(input => input.value === a.dataset.service);
  if (choice) { choice.checked = true; adaptToNeed(); showStep(1, false); }
}));
let preparedMessage = '';
const formTs = $('input[name=_ts]', form);
if (formTs) formTs.value = String(Date.now());
const formFeedback = $('[data-form-retour]', form);
form.addEventListener('submit', event => {
  event.preventDefault();
  // Une étape incomplète ? On y retourne et on montre ce qui manque.
  const incomplete = formSteps.findIndex(step => !$$('input:not([type=hidden]):not(:disabled), textarea', step).every(field => field.checkValidity()));
  if (incomplete !== -1) { showStep(incomplete); stepValid(incomplete); return; }
  if (!form.reportValidity()) return;
  // Kit Belle Devanture : avec l'adresse du service de réception (data-endpoint), la demande part vraiment
  // et le kit compte bdFormSent / bdFormFailed (bd-formulaire.js). Sans elle, on prépare l'e-mail comme avant.
  if (form.dataset.endpoint && window.bdFormulaire) {
    const submit = $('button[type=submit]', form);
    submit.disabled = true;
    formFeedback.hidden = true;
    window.bdFormulaire.envoyer(form).then(result => {
      submit.disabled = false;
      formFeedback.textContent = result.ok
        ? 'Merci, votre demande est bien partie. CLT Transport vous répond par e-mail.'
        : `Votre demande n’est pas partie${result.erreurs.length ? ` : ${result.erreurs.join(' ')}` : '. Réessayez dans un instant'}. Vous pouvez aussi écrire à sarl.clt@orange.fr.`;
      formFeedback.hidden = false;
      if (result.ok) form.reset();
    });
    return;
  }
  const data = Object.fromEntries(new FormData(form));
  const placeLines = d => needKind(d.service) === 'travaux' ? `Lieu du chantier : ${d.origin.trim()}`
    : `${needKind(d.service) === 'transport' ? 'Départ' : 'Départ / lieu du chantier'} : ${d.origin.trim()}\nArrivée : ${(d.destination || '').trim() || 'À préciser'}`;
  const requestedDate = data.date ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(`${data.date}T12:00:00`)) : 'À définir ensemble';
  preparedMessage = `Bonjour CLT Transport,\n\nJe souhaite échanger avec vous à propos de mon projet.\n\nNom : ${data.nom.trim()}\nE-mail : ${data.email.trim()}\nBesoin : ${data.service}\nDate souhaitée : ${requestedDate}\n${placeLines(data)}\n\nProjet et précisions :\n${data.message.trim()}\n\nMerci,\n${data.nom.trim()}`;
  $('#quote-summary').textContent = preparedMessage;
  $('#send-email').href = `mailto:sarl.clt@orange.fr?subject=${encodeURIComponent(`Projet CLT — ${data.service}`)}&body=${encodeURIComponent(preparedMessage)}`;
  $('#copy-feedback').textContent = '';
  $('#quote-dialog').showModal();
});
$('#copy-request').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(preparedMessage); $('#copy-feedback').textContent = 'Demande copiée. Vous pouvez la coller dans votre messagerie.'; }
  catch (_) { const range = document.createRange(); range.selectNodeContents($('#quote-summary')); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); $('#copy-feedback').textContent = 'Le texte est sélectionné. Utilisez Copier pour le récupérer.'; }
});
$$('.dialog-close').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target !== d) return; const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); }));
$$('[data-annee]').forEach(e => { e.textContent = String(new Date().getFullYear()); });
