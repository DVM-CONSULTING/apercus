/*
 * Prestations : une petite scène animée par ligne, avec les vrais visuels du site.
 * Porte-engins et plateaux : le camion roule (roues, gyrophare, poussière de motion.js / wheels.js).
 * Bras de grue : le camion stabilisé déploie sa grue articulée, lève une palette du plateau et la pose au sol, puis l'inverse.
 * Terrassement : la pelle articulée de la scène terrassement creuse et charge la benne (earthworks.js).
 * VRD : coupe de tranchée, quatre réseaux qui circulent jusqu'à la maison.
 * Une scène ne tourne que si sa ligne est ouverte et visible ; animations réduites : image fixe.
 */
(function (root) {
  'use strict';
  const TRUCK_SCALE = .36;
  /* Coupe VRD : position des réseaux (y), couleur, sens du flux. */
  const vrdPipes = [
    { id: 'water', y: 268, color: '#3f9fe0', dir: 1, w: 10 },
    { id: 'power', y: 246, color: '#e2493b', dir: 1, w: 7 },
    { id: 'telecom', y: 226, color: '#4fb36b', dir: 1, w: 7 },
    { id: 'drain', y: 300, color: '#a5734a', dir: -1, w: 15 }
  ];
  /** Aller-retour régulier entre 0 et 1 (sans saut), pour la pelle qui creuse puis revient. */
  function pingPong(t) { const f = ((t % 2) + 2) % 2; return f < 1 ? f : 2 - f; }
  /* Grue articulée, en coordonnées de l'image du camion (truck-side.webp, 2172 × 724) :
     pivot en haut de la colonne, flèche principale fixe, bras secondaire télescopique, palette accrochée par élingues. */
  const CRANE = { scale: .32, pivot: { x: 1652, y: 220 }, main: 520, minJib: 330, maxJib: 1500, deck: 448, ground: 628,
    pickX: 1150, dropX: -170, sling: 246, tipDeck: 140, tipHigh: -120, tipGround: 60, headboard: { x0: 1500, x1: 1580, top: 280 } };
  /** Départ et arrivée sans à-coup (vitesse et accélération nulles aux extrémités). */
  function ease(t) { t = Math.min(1, Math.max(0, t)); return t * t * t * (t * (t * 6 - 15) + 10); }
  /** Pose de la grue pour u de 0 (palette sur le plateau) à 1 (palette posée au sol derrière le camion). */
  function cranePose(u) {
    const c = CRANE, lift = ease((u - .12) / .18), travel = ease((u - .3) / .4), lower = ease((u - .7) / .18);
    const tip = { x: c.pickX + (c.dropX - c.pickX) * travel, y: c.tipDeck + (c.tipHigh - c.tipDeck) * lift + (c.tipGround - c.tipHigh) * lower };
    const deckCable = c.deck - c.sling - c.tipDeck, groundCable = c.ground - c.sling - c.tipGround;
    const cable = deckCable + (80 - deckCable) * lift + (groundCable - 80) * lower;
    const dx = tip.x - c.pivot.x, dy = tip.y - c.pivot.y, d = Math.hypot(dx, dy);
    const jib = Math.min(c.maxJib, Math.max(c.minJib, d - .15 * c.main));
    const a = Math.acos(Math.max(-1, Math.min(1, (c.main * c.main + d * d - jib * jib) / (2 * c.main * d))));
    const base = Math.atan2(dy, dx);
    // Coude vers le haut : des deux solutions, celle dont l'articulation est la plus haute.
    const angles = [base + a, base - a].sort((p, q) => Math.sin(p) - Math.sin(q));
    const mainAngle = angles[0];
    const knuckle = { x: c.pivot.x + c.main * Math.cos(mainAngle), y: c.pivot.y + c.main * Math.sin(mainAngle) };
    const jibAngle = Math.atan2(tip.y - knuckle.y, tip.x - knuckle.x);
    return { tip, knuckle, jib, cable, mainAngle, jibAngle, load: { x: tip.x, bottom: tip.y + cable + c.sling } };
  }
  /** Balancement de la palette : elle répond à l'accélération du crochet (nul à l'arrêt, sans saut). */
  function craneSwing(u) {
    const e = .004, x = v => cranePose(Math.min(1, Math.max(0, v))).tip.x;
    return (x(u + e) - 2 * x(u) + x(u - e)) / (e * e) * 6e-5;
  }
  const api = { pingPong, vrdPipes, TRUCK_SCALE, CRANE, cranePose, craneSwing };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.CLTServiceScenes = api;

  const motion = root.CLTMotion, wheels = root.CLTWheels, earth = root.CLTEarthworks;
  const ground = 330;
  const road = (light) => `<rect x="0" y="${ground}" width="1000" height="70" fill="${light ? '#26201f' : '#1d1716'}"/><path class="svc-road-line" d="M-60 ${ground + 26}H1060" stroke="#6b605c" stroke-width="3" stroke-dasharray="34 26"/><path d="M0 ${ground}H1000" stroke="#4b403d" stroke-width="2"/>`;

  function truckScene(id, cargo) {
    const s = TRUCK_SCALE, x = 500 - 1086 * s, y = ground - 628 * s;
    const load = cargo === 'excavator'
      ? '<image href="assets/excavator.webp" width="1536" height="1024" transform="translate(760 448) scale(.65) translate(-1020 -903)"/>'
      : pallets();
    return `<svg viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${wheels.defs({ id })}
      ${road()}<g class="svc-truck" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})">
        <g class="truck-dust">${'<ellipse rx="1" ry="1" opacity="0"/>'.repeat(10)}</g>
        <g class="svc-body"><image href="assets/truck-side.webp" width="2172" height="724" mask="url(#${id}-source-wheel-mask)"/>${load}</g>
        <g class="wheel-set">${wheels.markup({ id })}</g>
        <g class="truck-lights"><circle class="truck-headlight" cx="${motion.headlightPoint.x}" cy="${motion.headlightPoint.y}" r="34"/><circle class="truck-beacon-halo" cx="${motion.beaconPoint.x}" cy="${motion.beaconPoint.y}" r="46"/><circle class="truck-beacon" cx="${motion.beaconPoint.x}" cy="${motion.beaconPoint.y}" r="11"/></g>
      </g></svg>`;
  }
  /* Palettes filmées et sanglées sur le plateau (porte-engins : y = 448 dans l'image du camion) */
  function pallets() {
    const loads = [[250, 150, '#cfc9be'], [440, 190, '#b9b2a5'], [655, 165, '#d6d0c4'], [860, 120, '#c4bdb0']];
    return loads.map(([x, h, c]) => `<g transform="translate(${x} 448)"><rect x="0" y="-22" width="180" height="22" fill="#8a6440"/><rect x="12" y="-22" width="22" height="22" fill="#6e4f31"/><rect x="146" y="-22" width="22" height="22" fill="#6e4f31"/>
      <rect x="4" y="${-22 - h}" width="172" height="${h}" fill="${c}"/><rect x="4" y="${-22 - h}" width="172" height="${h}" fill="url(#svc-film)"/>
      <path d="M48 ${-22 - h}V-22M132 ${-22 - h}V-22" stroke="#e2493b" stroke-width="7"/></g>`).join('') +
      '<defs><linearGradient id="svc-film" x1="0" x2="1"><stop stop-color="#fff" stop-opacity=".35"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs>';
  }
  function craneScene() {
    const c = CRANE, s = c.scale, x = 585 - 1086 * s, y = ground - 628 * s, P = c.pivot;
    const blocks = [0, 1, 2].map(r => [0, 1, 2, 3].map(k => `<rect x="${-122 + k * 61.5}" y="${-26 - (r + 1) * 50}" width="58" height="47" fill="${(r + k) % 2 ? '#aaa59c' : '#b8b3a9'}"/>`).join('')).join('');
    return `<svg viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><mask id="svc-crane-fold" maskUnits="userSpaceOnUse" x="0" y="0" width="2172" height="724"><rect width="2172" height="724" fill="#fff"/><path d="M1560 80H1760V388H1560Z" fill="#000"/></mask></defs>
      ${road()}<path d="M${(x + (c.dropX - 165) * s).toFixed(1)} ${ground + 4}h${(330 * s).toFixed(1)}" stroke="#e32735" stroke-width="3" stroke-dasharray="10 8"/>
      <g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})">
        <image href="assets/truck-side.webp" width="2172" height="724" mask="url(#svc-crane-fold)"/>
        <g class="svc-crane-legs" fill="#161515"><rect x="1588" y="452" width="36" height="160"/><rect x="1566" y="610" width="80" height="18" fill="#4a4441"/><rect x="18" y="430" width="30" height="182"/><rect x="0" y="610" width="66" height="18" fill="#4a4441"/></g>
        <path d="M1618 392V${P.y}H1686V392Z" fill="#201e1d" stroke="#5a5450" stroke-width="4"/><path d="M1628 380V${P.y + 30}" stroke="#3d3a38" stroke-width="5"/>
        <path d="M1690 300l18 0v60h-18z" fill="#e32735"/><path d="M1690 312h18M1690 336h18" stroke="#f4efe6" stroke-width="7"/>
        <line class="svc-cyl-sleeve" stroke="#1b1a1a" stroke-width="26" stroke-linecap="round"/><line class="svc-cyl-rod" stroke="#cfcac2" stroke-width="11" stroke-linecap="round"/>
        <g class="svc-crane-main"><rect x="-10" y="-28" width="${c.main + 20}" height="56" rx="14" fill="#222020" stroke="#625b57" stroke-width="4"/><path d="M8 -16H${c.main - 10}" stroke="#454140" stroke-width="5"/><circle cx="${c.main}" cy="0" r="30" fill="#1f1d1d" stroke="#4a4644" stroke-width="5"/></g>
        <line class="svc-jcyl-sleeve" stroke="#1b1a1a" stroke-width="20" stroke-linecap="round"/><line class="svc-jcyl-rod" stroke="#cfcac2" stroke-width="9" stroke-linecap="round"/>
        <g class="svc-crane-jib"><rect class="svc-jib-1" x="-24" y="-24" height="48" rx="8" fill="#252322" stroke="#625b57" stroke-width="4"/><rect class="svc-jib-2" y="-19" height="38" rx="6" fill="#33302e" stroke="#6d6662" stroke-width="3"/><rect class="svc-jib-3" y="-15" height="30" rx="5" fill="#423e3b" stroke="#7a726d" stroke-width="3"/><path class="svc-jib-shine" d="M0 -12H10" stroke="#4d4846" stroke-width="4"/></g>
        <circle cx="${P.x}" cy="${P.y}" r="36" fill="#1f1d1d" stroke="#4a4644" stroke-width="6"/>
        <circle class="svc-sheave" r="20" fill="#2a2827" stroke="#8d8781" stroke-width="5"/>
        <g class="svc-hanging"><line class="svc-cable" stroke="#d8d2c8" stroke-width="5"/>
          <g class="svc-load"><path d="M0 -246V-232M0 -232L-118 -176M0 -232L118 -176" fill="none" stroke="#e2b23a" stroke-width="6"/><path d="M-14 -262h28v22h-28z" fill="#e2b23a"/><path d="M0 -240q0 12 -10 12" fill="none" stroke="#2b2827" stroke-width="5"/>
            <rect x="-130" y="-26" width="260" height="26" fill="#8a6440"/><rect x="-118" y="-26" width="28" height="26" fill="#6e4f31"/><rect x="90" y="-26" width="28" height="26" fill="#6e4f31"/>${blocks}
            <path d="M-56 -176V-26M56 -176V-26" stroke="#e32735" stroke-width="7"/></g></g>
        <g class="truck-lights"><circle class="truck-beacon-halo" cx="${motion.beaconPoint.x}" cy="${motion.beaconPoint.y}" r="46"/><circle class="truck-beacon" cx="${motion.beaconPoint.x}" cy="${motion.beaconPoint.y}" r="11"/></g>
      </g></svg>`;
  }
  function earthScene() {
    return `<svg viewBox="-60 70 1720 688" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect x="-200" y="610" width="2100" height="300" fill="url(#earthworks-soil-photo)"/><rect x="-200" y="610" width="2100" height="300" fill="#150e0f" opacity=".35"/>
      <path d="M915 610L929 618 938 633 950 639 960 657 975 667 986 685 1003 693 1016 701 1031 698 1044 705 1059 701 1072 702 1084 696 1092 676 1099 659 1105 635 1110 610Z" fill="#1d100a"/>
      <path d="M-200 610H1900" stroke="#a78261" stroke-width="2" opacity=".7"/>
      <image href="assets/dump-truck.webp" x="-90" y="178.25" width="975.7" height="487.85"/><text class="truck-door-logo" x="29" y="421" text-anchor="middle" aria-hidden="true">CLT</text>
      <g transform="translate(1370 610) scale(.54) translate(-1020 -903)">
        <image href="assets/excavator.webp" width="1536" height="1024" mask="url(#earthworks-body-mask)"/>
        <g class="svc-boom"><image href="assets/excavator.webp" width="1536" height="1024" clip-path="url(#earthworks-arm-clip)" mask="url(#earthworks-boom-mask)"/>
          <g class="svc-stick"><image href="assets/excavator.webp" width="1536" height="1024" clip-path="url(#earthworks-stick-clip)" mask="url(#earthworks-stick-mask)"/>
            <g class="svc-bucket"><image href="assets/excavator.webp" width="1536" height="1024" clip-path="url(#earthworks-bucket-clip)"/></g></g>
          <g class="svc-cylinder"><image href="assets/excavator.webp" width="1536" height="1024" clip-path="url(#earthworks-cylinder-clip)"/></g></g>
      </g></svg>`;
  }
  function vrdScene() {
    const G = 150;
    const house = `<path d="M812 ${G - 92}L882 ${G - 140}L952 ${G - 92}V${G}H812Z" fill="#ece5d6"/><path d="M800 ${G - 88}L882 ${G - 148}L964 ${G - 88}" fill="none" stroke="#3b3534" stroke-width="13" stroke-linejoin="round"/>
      <rect x="828" y="${G - 74}" width="28" height="28" class="svc-window" fill="#28323a"/><rect x="910" y="${G - 74}" width="28" height="28" class="svc-window" fill="#28323a"/><rect x="868" y="${G - 46}" width="26" height="46" fill="#5b3e2b"/>`;
    const route = p => `M40 ${p.y}H770Q796 ${p.y} 796 ${p.y - 26}V${G - 6}`;
    const pipes = vrdPipes.map(p => `<path d="${route(p)}" fill="none" stroke="${p.color}" stroke-width="${p.w}" stroke-linecap="round"/>` +
      `<path class="svc-flow" data-dir="${p.dir}" d="${route(p)}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="${Math.max(2, p.w / 3)}" stroke-linecap="round" stroke-dasharray="6 54"/>`).join('');
    return `<svg viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="1000" height="${G}" fill="#150e0f"/><rect y="${G}" width="1000" height="${400 - G}" fill="#3d2b21"/><rect y="${G}" width="1000" height="34" fill="#5b4334"/>
      <rect y="${G - 8}" width="600" height="10" fill="#2f2e31"/><rect x="600" y="${G - 6}" width="400" height="8" fill="#4c6b3a"/>
      <rect x="30" y="${G}" width="${780 - 30}" height="172" fill="#7a5c47"/><rect x="30" y="${G + 58}" width="750" height="114" fill="#cfa970"/>
      ${vrdPipes.map((p, i) => `<path d="M40 ${G + 50 - i * 4}H770" stroke="${p.color}" stroke-width="3" stroke-dasharray="9 3"/>`).join('')}
      <rect x="110" y="${G - 4}" width="38" height="168" fill="#9b968d"/><rect x="104" y="${G - 6}" width="50" height="6" fill="#3d3b3a"/>
      ${pipes}${house}
      <text x="24" y="38" class="svc-caption">COUPE DE PRINCIPE — BRANCHEMENTS DE LA MAISON</text>
      <text x="300" y="${G + 30}" class="svc-caption svc-caption-small">GRILLAGE AVERTISSEUR</text><text x="300" y="${G + 160}" class="svc-caption svc-caption-small">LIT DE SABLE</text></svg>`;
  }
  const builders = { 'porte-engins': () => truckScene('svc-porte', 'excavator'), plateau: () => truckScene('svc-plateau', 'pallets'), grue: craneScene, terrassement: earthScene, vrd: vrdScene };
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => media.matches || document.body.classList.contains('motion-reduced');
  const scenes = [];
  document.querySelectorAll('[data-service-scene]').forEach(box => {
    const kind = box.getAttribute('data-service-scene');
    if (!builders[kind]) return;
    box.innerHTML = builders[kind]();
    const details = box.closest('details');
    const scene = { kind, box, details, visible: false, distance: 0,
      truck: box.querySelector('.wheel-set'), body: box.querySelector('.svc-body'), dust: [...box.querySelectorAll('.truck-dust ellipse')],
      beacon: box.querySelector('.truck-beacon'), halo: box.querySelector('.truck-beacon-halo'), headlight: box.querySelector('.truck-headlight'),
      roadLine: box.querySelector('.svc-road-line'), crane: box.querySelector('.svc-crane-main') ? craneParts(box) : null, flows: [...box.querySelectorAll('.svc-flow')],
      boom: box.querySelector('.svc-boom'), stick: box.querySelector('.svc-stick'), bucket: box.querySelector('.svc-bucket'), cylinder: box.querySelector('.svc-cylinder'),
      windows: [...box.querySelectorAll('.svc-window')] };
    scenes.push(scene);
    new IntersectionObserver(entries => { scene.visible = entries[0].isIntersecting; request(); }).observe(box);
    if (details) details.addEventListener('toggle', request);
  });

  function draw(scene, time, dt) {
    const t = time / 1000;
    if (scene.truck) {
      const speed = dt ? .34 : 0;
      scene.distance += speed * (dt || 0);
      const fx = motion.roadEffects(scene.distance, dt ? speed * 4 : 0);
      wheels.update(scene.truck, scene.distance, dt || 0);
      scene.body.setAttribute('transform', `translate(0 ${fx.bob.toFixed(2)})`);
      scene.dust.forEach((p, i) => { const d = fx.dust[i]; p.setAttribute('cx', d.x.toFixed(1)); p.setAttribute('cy', d.y.toFixed(1)); p.setAttribute('rx', d.r.toFixed(1)); p.setAttribute('ry', (d.r * .55).toFixed(1)); p.setAttribute('opacity', d.opacity.toFixed(3)); });
      scene.beacon.setAttribute('opacity', (.5 + .5 * fx.beacon).toFixed(3));
      scene.halo.setAttribute('opacity', (.8 * fx.beacon).toFixed(3));
      scene.headlight.setAttribute('opacity', fx.headlight.toFixed(3));
      scene.roadLine.setAttribute('stroke-dashoffset', (scene.distance * TRUCK_SCALE % 60).toFixed(1));
    }
    if (scene.crane) drawCrane(scene.crane, dt ? pingPong(t / 7.5) : .5, t);
    if (scene.boom && earth) {
      const p = .14 + .68 * pingPong(t / 4.2);
      const pose = earth.samplePose(dt ? p : .42), cyl = earth.cylinderPose(pose.stickAngle);
      scene.boom.setAttribute('transform', `rotate(${pose.boomAngle} 860 568)`);
      scene.stick.setAttribute('transform', `rotate(${pose.stickAngle} 220 284)`);
      scene.bucket.setAttribute('transform', `rotate(${pose.bucketAngle} 258 651)`);
      scene.cylinder.setAttribute('transform', `translate(620 200) rotate(${cyl.sourceAngle + cyl.angle}) scale(${cyl.scale} 1) rotate(${-cyl.sourceAngle}) translate(-620 -200)`);
    }
    if (scene.flows.length) {
      scene.flows.forEach(f => f.setAttribute('stroke-dashoffset', (-Number(f.dataset.dir) * t * 70 % 60).toFixed(1)));
      scene.windows.forEach(w => w.setAttribute('fill', '#f3c66a'));
    }
  }
  function craneParts(box) {
    const q = sel => box.querySelector(sel);
    return { main: q('.svc-crane-main'), jib: q('.svc-crane-jib'), j1: q('.svc-jib-1'), j2: q('.svc-jib-2'), j3: q('.svc-jib-3'), shine: q('.svc-jib-shine'),
      sleeve: q('.svc-cyl-sleeve'), rod: q('.svc-cyl-rod'), jSleeve: q('.svc-jcyl-sleeve'), jRod: q('.svc-jcyl-rod'), sheave: q('.svc-sheave'),
      hanging: q('.svc-hanging'), cable: q('.svc-cable'), load: q('.svc-load'), beacon: q('.truck-beacon'), halo: q('.truck-beacon-halo') };
  }
  const line = (el, a, b) => { el.setAttribute('x1', a.x.toFixed(1)); el.setAttribute('y1', a.y.toFixed(1)); el.setAttribute('x2', b.x.toFixed(1)); el.setAttribute('y2', b.y.toFixed(1)); };
  const along = (o, angle, l, n = 0) => ({ x: o.x + Math.cos(angle) * l - Math.sin(angle) * n, y: o.y + Math.sin(angle) * l + Math.cos(angle) * n });
  /** Vérin : corps fixé au premier point, tige qui sort vers le second. */
  function cylinder(sleeve, rod, a, b) { const m = { x: a.x + (b.x - a.x) * .55, y: a.y + (b.y - a.y) * .55 }; line(sleeve, a, m); line(rod, { x: a.x + (b.x - a.x) * .5, y: a.y + (b.y - a.y) * .5 }, b); }
  function drawCrane(c, u, t) {
    const pose = cranePose(u), P = CRANE.pivot, deg = r => (r * 180 / Math.PI).toFixed(2);
    c.main.setAttribute('transform', `translate(${P.x} ${P.y}) rotate(${deg(pose.mainAngle)})`);
    c.jib.setAttribute('transform', `translate(${pose.knuckle.x.toFixed(1)} ${pose.knuckle.y.toFixed(1)}) rotate(${deg(pose.jibAngle)})`);
    // Bras télescopique : trois éléments emboîtés qui sortent l'un après l'autre.
    const L = pose.jib, s2 = Math.min(L - 40, 420), s3 = Math.min(L - 20, Math.max(s2 + 30, L - 420));
    c.j1.setAttribute('width', String(Math.min(L, 470) + 24));
    c.j2.setAttribute('x', String(s2 - 60)); c.j2.setAttribute('width', String(Math.max(0, Math.min(L, s2 + 460) - s2 + 60)));
    c.j3.setAttribute('x', String(s3 - 40)); c.j3.setAttribute('width', String(Math.max(0, L - s3 + 40)));
    c.shine.setAttribute('d', `M0 -12H${(L - 30).toFixed(0)}`);
    cylinder(c.sleeve, c.rod, { x: P.x + 22, y: P.y + 150 }, along(P, pose.mainAngle, CRANE.main * .42, 28));
    cylinder(c.jSleeve, c.jRod, along(P, pose.mainAngle, CRANE.main * .6, 30), along(pose.knuckle, pose.jibAngle, 120, 26));
    c.sheave.setAttribute('cx', pose.tip.x.toFixed(1)); c.sheave.setAttribute('cy', pose.tip.y.toFixed(1));
    const top = { x: pose.tip.x, y: pose.tip.y + 20 }, hook = { x: pose.load.x, y: pose.load.bottom - 262 };
    line(c.cable, top, hook);
    c.load.setAttribute('transform', `translate(${pose.load.x.toFixed(1)} ${pose.load.bottom.toFixed(1)})`);
    c.hanging.setAttribute('transform', `rotate(${craneSwing(u).toFixed(2)} ${pose.tip.x.toFixed(1)} ${pose.tip.y.toFixed(1)})`);
    const blink = (Math.sin(t * 7) + 1) / 2;
    c.beacon.setAttribute('opacity', (.45 + .55 * blink).toFixed(3)); c.halo.setAttribute('opacity', (.7 * blink).toFixed(3));
  }
  let frame = 0, last = 0;
  function loop(time) {
    frame = 0;
    const dt = last ? Math.min(50, time - last) : 16;
    last = time;
    let running = false;
    scenes.forEach(scene => {
      if (!scene.visible || (scene.details && !scene.details.open)) return;
      if (still()) { draw(scene, 0, 0); return; }
      draw(scene, time, dt);
      running = true;
    });
    if (running) frame = requestAnimationFrame(loop); else last = 0;
  }
  function request() { if (!frame) frame = requestAnimationFrame(loop); }
  media.addEventListener('change', request);
  new MutationObserver(request).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  scenes.forEach(scene => draw(scene, 0, 0));
  request();
})(typeof globalThis === 'undefined' ? this : globalThis);
