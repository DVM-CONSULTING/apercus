/*
 * « En route avec CLT » : entre le départ et la livraison, la route vue du ciel.
 * Le porte-engins (pelle chargée) arrive par un virage puis descend la route à droite de l'écran,
 * au rythme du défilement ; les quatre étapes de présentation s'affichent une à une à gauche.
 * Calculs purs (sample) testés ; le dessin est construit au chargement (décoratif, aria-hidden).
 */
(function (root) {
  'use strict';
  const clamp = n => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  const ease = n => { const t = clamp(n); return t * t * t * (10 + t * (-15 + 6 * t)); };
  const mix = (a, b, t) => a + (b - a) * t;
  const ROAD_X = 1200, ROAD_W = 150, WORLD_W = 1600, WORLD_H = 4300;
  /* Tracé : arrivée par la gauche, virage, puis longue descente verticale. */
  function buildPath() {
    const pts = [];
    for (let x = -260; x <= 520; x += 20) pts.push({ x, y: 230 });
    const p0 = { x: 520, y: 230 }, c1 = { x: 940, y: 230 }, c2 = { x: ROAD_X, y: 330 }, p3 = { x: ROAD_X, y: 700 };
    for (let i = 1; i <= 60; i++) {
      const t = i / 60, u = 1 - t;
      pts.push({ x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y });
    }
    for (let y = 720; y <= WORLD_H; y += 20) pts.push({ x: ROAD_X, y });
    const lengths = [0];
    for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const d = `M${pts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}`;
    return { pts, lengths, length: lengths[lengths.length - 1], d };
  }
  const path = buildPath();
  const START = 980, END = path.length - 700;
  function pointAt(distance) {
    const L = Math.max(0, Math.min(path.length, distance));
    let i = path.lengths.findIndex(v => v >= L);
    if (i < 1) i = 1;
    const a = path.pts[i - 1], b = path.pts[i], seg = path.lengths[i] - path.lengths[i - 1];
    const f = seg ? (L - path.lengths[i - 1]) / seg : 0;
    return { x: mix(a.x, b.x, f), y: mix(a.y, b.y, f), angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
  }
  const steps = 4;
  /** État de la section pour une progression 0..1 et un écran (largeur, hauteur). */
  function sample(progress, width = 1440, height = 900) {
    const p = clamp(progress);
    const compact = width <= 720;
    const distance = mix(START, END, p);
    const truck = pointAt(distance);
    const viewW = compact ? 860 : WORLD_W;
    const viewX = compact ? ROAD_X - viewW * .78 : 0;
    const viewH = viewW * (height > 0 && width > 0 ? height / width : .625);
    const cameraY = Math.max(0, Math.min(WORLD_H - viewH, truck.y - viewH * .52));
    const active = Math.min(steps - 1, Math.floor(p * steps));
    const opacities = Array.from({ length: steps }, (_, i) => {
      const a = i / steps, b = (i + 1) / steps;
      const fadeIn = i === 0 ? 1 : ease((p - a + .04) / .08);
      const fadeOut = i === steps - 1 ? 1 : 1 - ease((p - b + .04) / .08);
      return clamp(Math.min(fadeIn, fadeOut));
    });
    return { progress: p, distance, truck, viewBox: [viewX, cameraY, viewW, viewH], active, opacities };
  }
  /* Repères le long de la route, à l'endroit où le camion passe pour chaque étape. */
  const markers = Array.from({ length: steps }, (_, i) => {
    // Repère sur le bord de la route, du côté du texte, quelle que soit la direction du tracé.
    const at = pointAt(mix(START, END, (i + .5) / steps)), r = at.angle * Math.PI / 180, d = ROAD_W / 2 + 30;
    return { x: at.x - Math.sin(r) * d, y: at.y + Math.cos(r) * d, angle: at.angle };
  });
  const api = { sample, pointAt, path, markers, steps, ROAD_X, ROAD_W, WORLD_W, WORLD_H, START, END };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.CLTRoute = api;

  /* --- Dessin -------------------------------------------------------------------------------- */
  function truckMarkup(labelAngle = 0) {
    // Porte-engins vu de dessus, cabine vers +x, centre du plateau à l'origine.
    const wheels = [-118, -92, -66, 88, 118].map(x => `<rect x="${x - 9}" y="-33" width="18" height="9" rx="2" fill="#141213"/><rect x="${x - 9}" y="24" width="18" height="9" rx="2" fill="#141213"/>`).join('');
    return `<g class="route-truck-shadow"><rect x="-150" y="-26" width="320" height="60" rx="10" fill="#000" opacity=".28" filter="url(#route-blur)"/></g>
      ${wheels}
      <rect x="-150" y="-27" width="236" height="54" rx="3" fill="#b52430"/>
      ${[-130, -100, -70, -40, -10, 20, 50].map(x => `<path d="M${x} -27V27" stroke="#8d1b25" stroke-width="2"/>`).join('')}
      <rect x="-166" y="-24" width="18" height="20" fill="#7d7b78"/><rect x="-166" y="4" width="18" height="20" fill="#7d7b78"/>
      <rect x="80" y="-10" width="18" height="20" fill="#2a2627"/>
      <g class="route-machine">
        <rect x="-112" y="-25" width="104" height="13" rx="6" fill="#242122"/><rect x="-112" y="12" width="104" height="13" rx="6" fill="#242122"/>
        ${Array.from({ length: 9 }, (_, i) => `<path d="M${-106 + i * 11} -25V-12M${-106 + i * 11} 12V25" stroke="#3b3738" stroke-width="2"/>`).join('')}
        <rect x="-104" y="-17" width="80" height="34" rx="6" fill="#f2b705"/><rect x="-104" y="-17" width="22" height="34" rx="5" fill="#d99f00"/>
        <rect x="-58" y="-15" width="26" height="15" rx="3" fill="#29323a"/><rect x="-55" y="-13" width="20" height="5" rx="1" fill="#5d6f7a"/>
        <rect x="-30" y="-5" width="62" height="11" rx="4" fill="#f2b705"/><rect x="30" y="-9" width="20" height="18" rx="3" fill="#3a3536"/>
      </g>
      <rect x="98" y="-29" width="64" height="58" rx="9" fill="#f4f1ea"/><rect x="146" y="-27" width="14" height="54" rx="5" fill="#2b3238"/>
      <rect x="104" y="-22" width="36" height="44" rx="5" fill="#e2ddd2"/><g class="route-cab-label" transform="rotate(${labelAngle} 122 0)"><text x="122" y="4.5" text-anchor="middle" class="route-cab-text">CLT</text></g>
      <circle class="route-beacon-halo" cx="114" cy="-16" r="16" fill="#ffa31a" opacity=".6" filter="url(#route-blur)"/><circle class="route-beacon" cx="114" cy="-16" r="5" fill="#ffb21a"/>
      <path d="M160 -24 L172 -27 M160 24 L172 27" stroke="#ffe8a8" stroke-width="3" stroke-linecap="round"/>`;
  }
  function sceneMarkup() {
    const half = ROAD_W / 2;
    const trees = [];
    for (let y = 900; y < WORLD_H; y += 260) {
      trees.push([ROAD_X - half - 70 - (y * 7 % 90), y], [ROAD_X + half + 60 + (y * 11 % 70), y + 120]);
    }
    const tree = ([x, y]) => `<g transform="translate(${x} ${y})"><circle r="30" fill="#00000014" cx="6" cy="8"/><circle r="28" fill="#c9c7c1"/><circle r="17" cx="-6" cy="-6" fill="#d8d6d0"/></g>`;
    return `<defs><filter id="route-blur" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="7"/></filter></defs>
      <rect x="-400" y="0" width="${WORLD_W + 800}" height="${WORLD_H}" fill="#e8e7e4"/>
      ${Array.from({ length: 16 }, (_, i) => `<path d="M-400 ${400 + i * 260}C200 ${330 + i * 260} 600 ${470 + i * 260} ${WORLD_W + 400} ${380 + i * 260}" fill="none" stroke="#d6d4cf" stroke-width="1.2"/>`).join('')}
      ${trees.map(tree).join('')}
      <path d="${path.d}" fill="none" stroke="#c9c6c0" stroke-width="${ROAD_W + 26}" stroke-linejoin="round"/>
      <path d="${path.d}" fill="none" stroke="#2b2a2d" stroke-width="${ROAD_W}" stroke-linejoin="round"/>
      <path d="${path.d}" fill="none" stroke="#f2efe6" stroke-width="${ROAD_W - 22}" stroke-linejoin="round" opacity=".9"/>
      <path d="${path.d}" fill="none" stroke="#2b2a2d" stroke-width="${ROAD_W - 28}" stroke-linejoin="round"/>
      <path d="${path.d}" fill="none" stroke="#f2efe6" stroke-width="4" stroke-dasharray="36 30" opacity=".85"/>
      ${markers.map((m, i) => `<g class="route-marker" data-route-marker="${i}" transform="translate(${m.x.toFixed(1)} ${m.y.toFixed(1)})"><circle r="9" fill="#e32735"/><circle r="17" fill="none" stroke="#e32735" stroke-width="1.5" opacity=".5"/><text x="-26" y="7" text-anchor="end" class="route-marker-text">0${i + 1}</text></g>`).join('')}
      <g class="route-truck" data-route-truck="">${truckMarkup()}</g>`;
  }

  const section = document.getElementById('en-route');
  if (!section) return;
  const svg = section.querySelector('.route-world');
  svg.innerHTML = sceneMarkup();
  /* Téléphone : bande de route étroite à droite, le camion y reste à l'écran pendant que le texte défile. */
  section.querySelector('.route-sticky').insertAdjacentHTML('beforeend', `<div class="route-lane" aria-hidden="true"><div class="route-lane-truck"><svg viewBox="-36 -182 72 360"><defs><filter id="route-blur-lane" x="-60%" y="-20%" width="220%" height="140%"><feGaussianBlur stdDeviation="7"/></filter></defs><g transform="rotate(90)">${truckMarkup(-90).replace(/route-blur/g, 'route-blur-lane')}</g></svg></div></div>`);
  const laneBeacon = section.querySelector('.route-lane .route-beacon'), laneHalo = section.querySelector('.route-lane .route-beacon-halo');
  const cabLabel = svg.querySelector('[data-route-truck] .route-cab-label');
  const truck = svg.querySelector('[data-route-truck]'), beacon = svg.querySelector('.route-beacon'), halo = svg.querySelector('.route-beacon-halo');
  const items = Array.from(section.querySelectorAll('[data-route-step]'));
  const meter = section.querySelector('.route-progress > span');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => media.matches || document.body.classList.contains('motion-reduced');
  let frame = 0, shown = -1;
  function paint() {
    frame = 0;
    const box = svg.getBoundingClientRect();
    const rect = section.getBoundingClientRect();
    const travel = Math.max(1, section.offsetHeight - innerHeight);
    const quiet = still();
    const flow = innerWidth <= 720;
    if (flow) {
      // Le texte défile normalement ; seul le gyrophare suit le défilement.
      items.forEach(item => { item.style.opacity = ''; item.style.transform = ''; });
      const b = root.CLTMotion ? root.CLTMotion.roadEffects(scrollY * 1.4, quiet ? 0 : 1).beacon : .6;
      laneBeacon.setAttribute('opacity', (.55 + .45 * b).toFixed(3));
      laneHalo.setAttribute('opacity', (.7 * b).toFixed(3));
      return;
    }
    const state = sample(quiet ? .62 : -rect.top / travel, box.width || innerWidth, box.height || innerHeight);
    svg.setAttribute('viewBox', state.viewBox.map(v => v.toFixed(1)).join(' '));
    truck.setAttribute('transform', `translate(${state.truck.x.toFixed(1)} ${state.truck.y.toFixed(1)}) rotate(${state.truck.angle.toFixed(2)})`);
    // Le logo du toit reste à l'endroit pour le visiteur, quelle que soit la direction du camion.
    cabLabel.setAttribute('transform', `rotate(${(-state.truck.angle).toFixed(2)} 122 0)`);
    const fx = root.CLTMotion ? root.CLTMotion.roadEffects(state.distance * 2, quiet ? 0 : 1) : { beacon: .6 };
    beacon.setAttribute('opacity', (.55 + .45 * fx.beacon).toFixed(3));
    halo.setAttribute('opacity', (.7 * fx.beacon).toFixed(3));
    items.forEach((item, i) => {
      item.style.opacity = quiet ? '' : state.opacities[i].toFixed(3);
      item.style.transform = quiet ? '' : `translate3d(0,${((1 - state.opacities[i]) * (i < state.active ? -30 : 30)).toFixed(1)}px,0)`;
    });
    if (state.active !== shown) {
      items.forEach((item, i) => item.classList.toggle('is-active', i === state.active));
      shown = state.active;
    }
    if (meter) meter.style.transform = `scaleX(${quiet ? 1 : state.progress})`;
  }
  const request = () => { if (!frame) frame = requestAnimationFrame(paint); };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request, { passive: true });
  media.addEventListener('change', request);
  new MutationObserver(request).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  paint();
})(typeof globalThis === 'undefined' ? this : globalThis);
