/*
 * Scène VRD : une maison raccordée aux réseaux de la rue, en coupe isométrique.
 * Ouverture de la tranchée → pose des 4 branchements (eau, électricité, télécom, eaux usées)
 * → mise en service → remblaiement en couches (sable, grillage avertisseur, remblai, enrobé)
 * → voirie, accès et jardin terminés. Tout est piloté par le défilement : aucun minuteur ici.
 * La géométrie est calculée ; sceneMarkup() écrit le dessin fixe dans index.html
 * (node tools/vrd-scene.mjs), render() ne fait que changer quelques attributs.
 */
(function (root) {
  'use strict';
  const clamp = n => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  const ease = n => { const t = clamp(n); return t * t * t * (10 + t * (-15 + 6 * t)); };
  const span = (p, a, b) => ease((p - a) / (b - a));
  const mix = (a, b, t) => a + (b - a) * t;
  const C = Math.sqrt(3) / 2;
  const project = (x, y, z = 0) => ({ x: 640 + (x - y) * C, y: 120 + (x + y) / 2 - z });
  const fmt = n => Number(n.toFixed(2));
  const P = (x, y, z) => { const p = project(x, y, z); return `${fmt(p.x)} ${fmt(p.y)}`; };

  /* Monde (unités ≈ 1 cm × 2) : parcelle, trottoir, rue ; coupe sur les faces avant (y=650) et droite (x=760). */
  const world = { x: 760, plot: 440, sidewalk: 490, y: 650, bottom: -260 };
  const terrain = { elevation: 0, depth: -world.bottom };
  const house = { x0: 150, x1: 450, y0: 40, y1: 250, eave: 225, ridge: 315 };
  const garage = { x0: 450, x1: 590, y0: 100, y1: 250, h: 108 };
  const houseBase = [[house.x0, house.y0], [house.x1, house.y0], [house.x1, house.y1], [house.x0, house.y1]].map(([x, y]) => project(x, y, terrain.elevation));
  /* Tranchée de branchement (A, privée) et tranchée sous chaussée (B, ouverte sur la coupe avant). */
  const trenchA = { x0: 270, x1: 500, y0: 250, y1: 520, floor: -125 };
  const trenchB = { x0: 120, x1: 700, y0: 520, y1: 650, floor: -230 };
  const colors = { water: '#3f9fe0', power: '#e2493b', telecom: '#4fb36b', drain: '#a5734a' };
  /* Réseaux publics existants, sous la rue (le long de x). */
  const mains = [
    { id: 'water', y: 560, z: -150, r: 11, label: 'CONDUITE D’EAU POTABLE' },
    { id: 'power', y: 578, z: -104, r: 7, label: 'RÉSEAU ÉLECTRIQUE' },
    { id: 'telecom', y: 604, z: -96, r: 6, label: 'FOURREAUX TÉLÉCOM' },
    { id: 'drain', y: 592, z: -192, r: 20, label: 'COLLECTEUR EAUX USÉES' }
  ];
  const manhole = { x: 615, y: 592, r: 26 };

  function roundedRoute(coordinates, radius = 22) {
    const points = coordinates.map(([x, y, z]) => project(x, y, z));
    const flat = [points[0]];
    let d = `M${fmt(points[0].x)} ${fmt(points[0].y)}`;
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[i - 1], b = points[i], c = points[i + 1];
      const before = Math.hypot(b.x - a.x, b.y - a.y);
      const after = Math.hypot(c.x - b.x, c.y - b.y);
      const r = Math.min(radius, before / 2, after / 2);
      const entry = { x: b.x + (a.x - b.x) * r / before, y: b.y + (a.y - b.y) * r / before };
      const exit = { x: b.x + (c.x - b.x) * r / after, y: b.y + (c.y - b.y) * r / after };
      d += `L${fmt(entry.x)} ${fmt(entry.y)}Q${fmt(b.x)} ${fmt(b.y)} ${fmt(exit.x)} ${fmt(exit.y)}`;
      flat.push(entry);
      for (let j = 1; j <= 24; j++) {
        const t = j / 24, u = 1 - t;
        flat.push({ x: u * u * entry.x + 2 * u * t * b.x + t * t * exit.x, y: u * u * entry.y + 2 * u * t * b.y + t * t * exit.y });
      }
    }
    const last = points[points.length - 1];
    d += `L${fmt(last.x)} ${fmt(last.y)}`;
    flat.push(last);
    const lengths = [0];
    for (let i = 1; i < flat.length; i++) lengths.push(lengths[i - 1] + Math.hypot(flat[i].x - flat[i - 1].x, flat[i].y - flat[i - 1].y));
    return { d, points, flat, lengths, length: lengths[lengths.length - 1] };
  }
  /* Branchements : eau, électricité et télécom arrivent de la rue ; les eaux usées repartent vers le collecteur. */
  const routeDefinitions = [
    { id: 'water', color: colors.water, label: 'Eau', start: .11, end: .22,
      coordinates: [[300, 560, -139], [300, 505, -112], [300, 250, -112], [300, 250, 34]] },
    { id: 'power', color: colors.power, label: 'Électricité', start: .17, end: .28,
      coordinates: [[322, 578, -97], [322, 505, -95], [322, 250, -95], [322, 250, 52]] },
    { id: 'telecom', color: colors.telecom, label: 'Télécom', start: .23, end: .34,
      coordinates: [[344, 604, -90], [344, 505, -88], [344, 250, -88], [344, 250, 70]] },
    { id: 'drain', color: colors.drain, label: 'Eaux usées', start: .29, end: .40,
      coordinates: [[372, 250, 22], [372, 250, -100], [372, 505, -120], [372, 592, -172]] }
  ];
  const routes = routeDefinitions.map(route => ({ ...route, ...roundedRoute(route.coordinates) }));
  function pointAlong(route, fraction) {
    const t = clamp(fraction), distance = t * route.length;
    let index = route.lengths.findIndex(length => length >= distance);
    if (index < 1) index = 1;
    const a = route.flat[index - 1], b = route.flat[index];
    const segment = route.lengths[index] - route.lengths[index - 1];
    const f = segment ? (distance - route.lengths[index - 1]) / segment : 0;
    return { x: mix(a.x, b.x, f), y: mix(a.y, b.y, f), angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
  }

  /* Couches du remblai (de bas en haut) et terrain naturel, pour la tranchée sous chaussée (B) et privée (A). */
  const fillLayers = {
    B: [['sand', trenchB.floor, -65], ['backfill', -65, -32], ['gravel', -32, -8], ['asphalt', -8, 0]],
    A: [['sand', trenchA.floor, -65], ['backfill', -65, -30], ['topsoil', -30, 0]]
  };
  const naturalLayers = {
    B: [['deep', trenchB.floor, -140], ['soil', -140, -40], ['gravel', -40, -8], ['asphalt', -8, 0]],
    A: [['soil', trenchA.floor, -30], ['topsoil', -30, 0]]
  };
  const grillageLevel = -62;

  function sample(progress) {
    const p = clamp(progress);
    const activity = span(p, .445, .49) * (1 - span(p, .72, .78));
    const backfill = span(p, .785, .945);
    return {
      progress: p, phase: p < .43 ? 0 : p < .78 ? 1 : 2,
      houseBase: houseBase.map(point => ({ ...point })), terrainElevation: terrain.elevation,
      dig: span(p, .015, .105), backfill,
      fillLevel: mix(trenchB.floor, 0, backfill),
      grillage: span(backfill, .45, .56),
      glow: span(p, .46, .67), road: span(p, .94, 1), access: span(p, .945, 1), planting: span(p, .945, 1),
      ghost: span(p, .94, 1) * .6,
      networks: routes.map((route, routeIndex) => {
        const draw = span(p, route.start, route.end);
        const join = span(p, route.end - .015, route.end + .035);
        const end = pointAlong(route, 1);
        const radians = end.angle * Math.PI / 180;
        const gap = 20 * (1 - join);
        return {
          id: route.id, draw, join,
          coupler: { x: end.x - Math.cos(radians) * gap, y: end.y - Math.sin(radians) * gap, angle: end.angle, opacity: span(p, route.end - .055, route.end - .005) },
          particles: Array.from({ length: 3 }, (_, i) => {
            const raw = (p - .43) * 6.8 + i / 3 + routeIndex * .11;
            const fraction = ((raw % 1) + 1) % 1;
            const point = pointAlong(route, fraction);
            const edge = ease(fraction / .065) * ease((1 - fraction) / .065);
            return { ...point, fraction, opacity: activity * edge, icon: i === 0 };
          })
        };
      })
    };
  }
  /* État fixe des étapes quand les animations sont réduites : jamais de flux en mouvement. */
  function still(progress) {
    const state = sample(progress);
    state.networks.forEach(network => network.particles.forEach(particle => { particle.opacity = 0; }));
    return state;
  }

  /* --- Dessin fixe ------------------------------------------------------------------------------ */
  const path = (points, attrs = '') => `<path d="M${points.map(([x, y, z]) => P(x, y, z)).join('L')}Z"${attrs ? ' ' + attrs : ''}/>`;
  const top = (x0, x1, y0, y1, z) => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
  const faceY = (x0, x1, y, z0, z1) => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  const faceX = (x, y0, y1, z0, z1) => [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]];
  const fill = c => `fill="${c}"`;
  const material = {
    asphalt: ['#2f2e31', '#262528'], gravel: ['#8d877c', '#77716a'], sand: ['#cfa970', '#b48f58'],
    backfill: ['#7a5c47', '#664b3a'], topsoil: ['#6b4e3b', '#5a412f'], soil: ['#58402f', '#4b3527'], deep: ['#46332a', '#3b2b22'],
    concrete: ['#a9a49b', '#928d84']
  };
  function box(x0, x1, y0, y1, z0, z1, c, extra = '') {
    return path(top(x0, x1, y0, y1, z1), `${fill(c[0])} ${extra}`) + path(faceY(x0, x1, y1, z0, z1), `${fill(c[1])} ${extra}`) + path(faceX(x1, y0, y1, z0, z1), `${fill(shade(c[1], -12))} ${extra}`);
  }
  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const ch = s => Math.max(0, Math.min(255, ((n >> s) & 255) + amount));
    return `#${[16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('')}`;
  }
  /* Cylindre couché le long de x (réseau public), cylindre vertical (regard), cercle en coupe sur la face x. */
  function pipeX(x0, x1, y, z, r, color, cls = '') {
    return `<path class="networks-main ${cls}" d="M${P(x0, y, z)}L${P(x1, y, z)}" stroke="${color}" stroke-width="${fmt(r * 2.1)}"/>` +
      `<path class="networks-main-shine" d="M${P(x0, y, z + r * .55)}L${P(x1, y, z + r * .55)}" stroke-width="${fmt(Math.max(1.5, r * .35))}"/>`;
  }
  function ringX(x, y, z, r) {
    const pts = Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2; return P(x, y + Math.cos(a) * r, z + Math.sin(a) * r); });
    return `M${pts.join('L')}Z`;
  }
  function cylinderZ(x, y, z0, z1, r, body, topColor, extra = '') {
    const rx = r * Math.SQRT2 * C, ry = r * Math.SQRT1_2;
    const a = project(x, y, z0), b = project(x, y, z1);
    return `<path d="M${fmt(a.x - rx)} ${fmt(a.y)}A${fmt(rx)} ${fmt(ry)} 0 0 0 ${fmt(a.x + rx)} ${fmt(a.y)}L${fmt(b.x + rx)} ${fmt(b.y)}A${fmt(rx)} ${fmt(ry)} 0 0 1 ${fmt(b.x - rx)} ${fmt(b.y)}Z" fill="${body}" ${extra}/>` +
      `<ellipse cx="${fmt(b.x)}" cy="${fmt(b.y)}" rx="${fmt(rx)}" ry="${fmt(ry)}" fill="${topColor}" ${extra}/>`;
  }
  const lid = (x, y, r, color, extra = '') => { const c = project(x, y, .5); return `<ellipse cx="${fmt(c.x)}" cy="${fmt(c.y)}" rx="${fmt(r * Math.SQRT2 * C)}" ry="${fmt(r * Math.SQRT1_2)}" fill="${color}" stroke="#1d1b1c" stroke-width="1.2" ${extra}/>`; };
  function bands(region, layers, face) {
    return layers.map(([name, z0, z1]) => path(face(region, z0, z1), fill(material[name][1]))).join('');
  }
  /* Clip : la partie visible de la fouille (ouvertures A et B + entaille de la coupe avant). */
  const pitOutline = [[trenchA.x0, trenchA.y0, 0], [trenchA.x1, trenchA.y0, 0], [trenchA.x1, trenchB.y0, 0], [trenchB.x1, trenchB.y0, 0],
    [trenchB.x1, trenchB.y1, 0], [trenchB.x1, trenchB.y1, trenchB.floor], [trenchB.x0, trenchB.y1, trenchB.floor], [trenchB.x0, trenchB.y1, 0],
    [trenchB.x0, trenchB.y0, 0], [trenchA.x0, trenchB.y0, 0]];

  function tree(scale = 1, kind = 'cone') {
    const s = v => fmt(v * scale);
    if (kind === 'round') return `<ellipse rx="${s(30)}" ry="${s(15)}" fill="#1f2a1c" opacity=".55"/><path d="M0 0V${s(-28)}" stroke="#6b4d33" stroke-width="${s(5)}"/><ellipse cy="${s(-52)}" rx="${s(38)}" ry="${s(32)}" fill="#4f6d42"/><ellipse cx="${s(-10)}" cy="${s(-62)}" rx="${s(24)}" ry="${s(19)}" fill="#678a55"/><ellipse cx="${s(12)}" cy="${s(-44)}" rx="${s(20)}" ry="${s(14)}" fill="#3f5a35"/>`;
    if (kind === 'bush') return `<ellipse rx="${s(30)}" ry="${s(14)}" fill="#1f2a1c" opacity=".5"/><ellipse cy="${s(-12)}" rx="${s(30)}" ry="${s(20)}" fill="#557548"/><ellipse cx="${s(-9)}" cy="${s(-19)}" rx="${s(17)}" ry="${s(12)}" fill="#6b8f5a"/>`;
    return `<ellipse rx="${s(26)}" ry="${s(13)}" fill="#1f2a1c" opacity=".55"/><path d="M0 0V${s(-36)}" stroke="#6b4d33" stroke-width="${s(5)}"/><path d="M${s(-30)} ${s(-40)}L0 ${s(-122)}L${s(30)} ${s(-40)}L0 ${s(-26)}Z" fill="#5d7a4d"/><path d="M0 ${s(-122)}L${s(30)} ${s(-40)}L0 ${s(-26)}Z" fill="#46603b"/><path d="M${s(-21)} ${s(-74)}L0 ${s(-122)}L${s(21)} ${s(-74)}L0 ${s(-64)}Z" fill="#6f9160"/>`;
  }
  const plants = [
    { x: 30, y: 205, kind: 'cone', scale: 1.15 }, { x: 95, y: 330, kind: 'round', scale: 1 }, { x: 690, y: 70, kind: 'cone', scale: 1.05 },
    { x: 220, y: 330, kind: 'bush', scale: .9 }, { x: 650, y: 330, kind: 'bush', scale: 1 }, { x: 730, y: 250, kind: 'round', scale: .85 }
  ];

  function houseMarkup() {
    const h = house, g = garage, wall = '#ece5d6', side = '#d2c9b8', trim = '#f7f2e8';
    let s = '<g class="networks-house" aria-hidden="true">';
    s += path(top(h.x0 - 8, g.x1 + 8, h.y0 - 8, h.y1 + 10, 0), 'fill="#000" opacity=".22" filter="url(#networks-soft-shadow)"');
    /* Corps de la maison (R+1) */
    s += path(faceY(h.x0, h.x1, h.y1, 0, h.eave), fill(wall)) + path(faceX(h.x1, h.y0, h.y1, 0, h.eave), fill(side));
    s += path(faceY(h.x0, h.x1, h.y1, 0, 10), 'fill="#9f988b"') + path(faceX(h.x1, h.y0, h.y1, 0, 10), 'fill="#8c8578"');
    s += path([[h.x1, h.y0, h.eave], [h.x1, h.y1, h.eave], [h.x1, (h.y0 + h.y1) / 2, h.ridge]], fill(side));
    /* Fenêtres (rez-de-chaussée et étage), porte d'entrée */
    const win = (x0, x1, z0, z1) => path(faceY(x0 - 4, x1 + 4, h.y1 + .5, z0 - 4, z1 + 4), fill(trim)) + path(faceY(x0, x1, h.y1 + 1, z0, z1), 'fill="#28323a" data-networks-window=""') + `<path d="M${P((x0 + x1) / 2, h.y1 + 1.5, z0)}L${P((x0 + x1) / 2, h.y1 + 1.5, z1)}" stroke="${trim}" stroke-width="2.5"/>` + path(faceY(x0 - 6, x1 + 6, h.y1 + 2, z0 - 9, z0 - 4), 'fill="#c9c1b1"');
    s += win(172, 228, 48, 118) + win(398, 438, 48, 118) + win(172, 228, 148, 200) + win(262, 318, 148, 200) + win(380, 436, 148, 200);
    s += path(faceY(244, 286, h.y1 + .5, 0, 128), fill(trim)) + path(faceY(248, 282, h.y1 + 1, 0, 124), 'fill="#5b3e2b"') + path(faceY(253, 277, h.y1 + 1.5, 70, 116), 'fill="#28323a" data-networks-window=""');
    s += `<circle cx="${fmt(project(276, h.y1 + 2, 58).x)}" cy="${fmt(project(276, h.y1 + 2, 58).y)}" r="2.2" fill="#d8c48a"/>`;
    s += path(faceX(h.x1 + .5, 80, 130, 150, 200), fill(trim)) + path(faceX(h.x1 + 1, 85, 125, 154, 196), 'fill="#28323a" data-networks-window=""');
    /* Garage, porte sectionnelle */
    s += path(faceY(g.x0, g.x1, g.y1, 0, g.h), fill(wall)) + path(faceX(g.x1, g.y0, g.y1, 0, g.h), fill(side)) + path(top(g.x0, g.x1, g.y0, g.y1, g.h), 'fill="#56504c"');
    s += path(top(g.x0 - 3, g.x1 + 3, g.y0 - 3, g.y1 + 3, g.h + 6), 'fill="none" stroke="#3c3735" stroke-width="5"');
    s += path(faceY(g.x0 + 18, g.x1 - 18, g.y1 + .6, 0, 82), 'fill="#bdb6a9"');
    for (let z = 12; z < 82; z += 12) s += `<path d="M${P(g.x0 + 18, g.y1 + 1, z)}L${P(g.x1 - 18, g.y1 + 1, z)}" stroke="#a39c8f" stroke-width="1.4"/>`;
    s += path(faceY(g.x0 + 18, g.x1 - 18, g.y1 + 1, 0, 3), 'fill="#77706a"');
    /* Toiture à deux pans, tuiles */
    const ox = 16, oy = 16;
    const front = [[h.x0 - ox, h.y1 + oy, h.eave - 12], [h.x1 + ox, h.y1 + oy, h.eave - 12], [h.x1 + ox, (h.y0 + h.y1) / 2, h.ridge], [h.x0 - ox, (h.y0 + h.y1) / 2, h.ridge]];
    s += path(front, 'fill="#4a3f3c"');
    const rows = 9;
    for (let i = 1; i < rows; i++) {
      const t = i / rows, y = mix(h.y1 + oy, (h.y0 + h.y1) / 2, t), z = mix(h.eave - 12, h.ridge, t);
      s += `<path d="M${P(h.x0 - ox, y, z)}L${P(h.x1 + ox, y, z)}" stroke="#3a312f" stroke-width="2"/>`;
    }
    for (let x = h.x0 - ox + 14; x < h.x1 + ox; x += 14) s += `<path d="M${P(x, h.y1 + oy, h.eave - 12)}L${P(x, (h.y0 + h.y1) / 2, h.ridge)}" stroke="#40363380" stroke-width="1"/>`;
    s += path([[h.x1 + ox, h.y1 + oy, h.eave - 12], [h.x1 + ox, (h.y0 + h.y1) / 2, h.ridge], [h.x1 + ox, (h.y0 + h.y1) / 2, h.ridge - 9], [h.x1 + ox, h.y1 + oy, h.eave - 21]], 'fill="#2d2624"');
    s += path([[h.x1 + ox, h.y0 - oy, h.eave - 12], [h.x1 + ox, (h.y0 + h.y1) / 2, h.ridge], [h.x1 + ox, (h.y0 + h.y1) / 2, h.ridge - 9], [h.x1 + ox, h.y0 - oy, h.eave - 21]], 'fill="#2d2624"');
    s += `<path d="M${P(h.x0 - ox, (h.y0 + h.y1) / 2, h.ridge + 2)}L${P(h.x1 + ox, (h.y0 + h.y1) / 2, h.ridge + 2)}" stroke="#2a2321" stroke-width="5" stroke-linecap="round"/>`;
    s += path(faceY(h.x0 - ox, h.x1 + ox, h.y1 + oy, h.eave - 20, h.eave - 12), 'fill="#e9e2d4"');
    /* Cheminée */
    s += box(205, 230, 120, 145, h.ridge - 40, h.ridge + 30, ['#9e958a', '#857d72']);
    return s + '</g>';
  }

  function sceneMarkup() {
    let s = '';
    s += '<defs>' +
      '<filter id="networks-soft-shadow" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>' +
      '<filter id="networks-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>' +
      '<pattern id="networks-grain" width="23" height="17" patternUnits="userSpaceOnUse"><circle cx="4" cy="5" r="1.1" fill="#fff" opacity=".07"/><circle cx="15" cy="12" r=".9" fill="#000" opacity=".22"/><circle cx="19" cy="3" r=".7" fill="#fff" opacity=".05"/></pattern>' +
      '<pattern id="networks-compact" width="40" height="11" patternUnits="userSpaceOnUse"><path d="M0 10.5H26" stroke="#000" stroke-width="1" opacity=".16"/><circle cx="33" cy="5" r="1" fill="#fff" opacity=".12"/></pattern>' +
      '<pattern id="networks-mesh" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0L6 6M6 0L0 6" stroke="#fff" stroke-width=".8" opacity=".55"/></pattern>' +
      `<clipPath id="networks-pit-clip"><path d="M${pitOutline.map(([x, y, z]) => P(x, y, z)).join('L')}Z"/></clipPath>` +
      '<radialGradient id="networks-lamp-light"><stop stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="networks-pool-light"><stop stop-color="#f6c45e" stop-opacity=".5"/><stop offset="1" stop-color="#f6c45e" stop-opacity="0"/></radialGradient>' +
      '</defs>';
    const W = world;
    /* Ombre portée du bloc */
    s += path(top(-20, W.x + 30, -20, W.y + 40, W.bottom - 30), 'fill="#000" opacity=".45" filter="url(#networks-soft-shadow)"');
    /* Coupe avant (sous la rue) et coupe droite (parcelle, trottoir, rue) */
    const streetLayers = [['asphalt', -8, 0], ['gravel', -40, -8], ['soil', -140, -40], ['deep', W.bottom, -140]];
    const plotLayers = [['topsoil', -30, 0], ['soil', -140, -30], ['deep', W.bottom, -140]];
    const walkLayers = [['concrete', -10, 0], ['gravel', -40, -10], ['soil', -140, -40], ['deep', W.bottom, -140]];
    s += '<g class="networks-section-faces" aria-hidden="true">';
    s += bands([0, W.x], streetLayers, ([x0, x1], z0, z1) => faceY(x0, x1, W.y, z0, z1));
    s += bands([0, W.plot], plotLayers, ([y0, y1], z0, z1) => faceX(W.x, y0, y1, z0, z1)).replace(/fill="(#[0-9a-f]{6})"/g, (m, c) => `fill="${shade(c, -10)}"`);
    s += bands([W.plot, W.sidewalk], walkLayers, ([y0, y1], z0, z1) => faceX(W.x, y0, y1, z0, z1)).replace(/fill="(#[0-9a-f]{6})"/g, (m, c) => `fill="${shade(c, -10)}"`);
    s += bands([W.sidewalk, W.y], streetLayers, ([y0, y1], z0, z1) => faceX(W.x, y0, y1, z0, z1)).replace(/fill="(#[0-9a-f]{6})"/g, (m, c) => `fill="${shade(c, -10)}"`);
    s += path(faceY(0, W.x, W.y, W.bottom, 0), 'fill="url(#networks-grain)"') + path(faceX(W.x, 0, W.y, W.bottom, 0), 'fill="url(#networks-grain)"');
    /* Réseaux publics vus en coupe sur la face droite, dans leur lit de sable */
    mains.forEach(m => {
      s += `<path d="${ringX(W.x + .5, m.y, m.z, m.r + 9)}" fill="#c9a46b" opacity=".55"/>`;
      s += `<path d="${ringX(W.x + 1, m.y, m.z, m.r)}" fill="${colors[m.id]}" stroke="#141112" stroke-width="1.5"/>`;
      s += `<path d="${ringX(W.x + 1.5, m.y, m.z, m.r * .55)}" fill="#141112" opacity=".55"/>`;
    });
    s += `<path d="M${P(W.x, W.y, 0)}L${P(W.x, W.y, W.bottom)}" stroke="#ffffff22" stroke-width="1.5"/>`;
    s += '</g>';

    /* Surfaces : parcelle en terre de chantier, trottoir, bordure, chaussée */
    s += '<g class="networks-ground" aria-hidden="true">';
    s += path(top(0, W.x, 0, W.plot, 0), 'fill="#735643"') + path(top(0, W.x, 0, W.plot, 0), 'fill="url(#networks-grain)"');
    s += path(top(0, W.x, W.plot, W.sidewalk, 0), 'fill="#a39d93"');
    for (let x = 40; x < W.x; x += 40) s += `<path d="M${P(x, W.plot, 0)}L${P(x, W.sidewalk, 0)}" stroke="#8c867c" stroke-width="1"/>`;
    s += path(top(0, W.x, W.sidewalk - 6, W.sidewalk, .5), 'fill="#c6c0b5"');
    s += path(top(0, W.x, W.sidewalk, W.y, 0), 'fill="#303033"') + path(top(0, W.x, W.sidewalk, W.y, 0), 'fill="url(#networks-grain)"');
    s += `<path d="M${P(0, W.y - 14, .3)}L${P(W.x, W.y - 14, .3)}" stroke="#d9d4c8" stroke-width="2.5" opacity=".7"/>`;
    s += `<path d="M${P(0, W.sidewalk + 12, .3)}L${P(W.x, W.sidewalk + 12, .3)}" stroke="#d9d4c8" stroke-width="2.5" opacity=".55"/>`;
    s += '</g>';

    /* Fouille : parois en strates, fonds, réseaux, regard, branchements, remblai — limitée à l'ouverture */
    s += '<g class="networks-pit" clip-path="url(#networks-pit-clip)" aria-hidden="true">';
    const wallBands = (layers, face) => layers.map(([name, z0, z1]) => path(face(z0, z1), fill(shade(material[name][1], -18)))).join('');
    const A = trenchA, B = trenchB;
    s += path(top(A.x0, A.x1, A.y0, A.y1, A.floor), 'fill="#3a2a20"');
    s += wallBands([['soil', A.floor, -30], ['topsoil', -30, 0]], (z0, z1) => faceY(A.x0, A.x1, A.y0, z0, z1));
    s += wallBands([['soil', A.floor, -30], ['topsoil', -30, 0]], (z0, z1) => faceX(A.x0, A.y0, A.y1, z0, z1)).replace(/fill="(#[0-9a-f]{6})"/g, (m, c) => `fill="${shade(c, 10)}"`);
    s += wallBands([['deep', B.floor, -140], ['soil', -140, -40], ['gravel', -40, -8], ['asphalt', -8, 0]], (z0, z1) => faceY(B.x0, A.x0, B.y0, z0, z1));
    s += wallBands([['deep', B.floor, -140], ['soil', -140, A.floor]], (z0, z1) => faceY(A.x0, A.x1, B.y0, z0, z1));
    s += wallBands([['deep', B.floor, -140], ['soil', -140, -40], ['gravel', -40, -8], ['asphalt', -8, 0]], (z0, z1) => faceY(A.x1, B.x1, B.y0, z0, z1));
    s += wallBands([['deep', B.floor, -140], ['soil', -140, -40], ['gravel', -40, -8], ['asphalt', -8, 0]], (z0, z1) => faceX(B.x0, B.y0, B.y1, z0, z1)).replace(/fill="(#[0-9a-f]{6})"/g, (m, c) => `fill="${shade(c, 10)}"`);
    s += path(top(B.x0, B.x1, B.y0, B.y1, B.floor), 'fill="#30231b"');
    s += path(faceY(B.x0, B.x1, B.y0, B.floor, 0), 'fill="url(#networks-grain)"');
    /* Étais de blindage dans la tranchée profonde */
    [200, 520, 660].forEach(x => { s += path(faceY(x, x + 14, B.y0 + 1, B.floor, -6), 'fill="#2b5d8a"') + path(faceY(x + 3, x + 11, B.y0 + 2, B.floor, -6), 'fill="#3b77ab"'); });
    /* Lits de pose et réseaux publics */
    mains.forEach(m => { s += path(top(B.x0, B.x1, m.y - m.r - 6, m.y + m.r + 6, m.z - m.r - 2), 'fill="#c9a46b" opacity=".75"'); });
    mains.slice().sort((a, b) => a.y - b.y || b.z - a.z).forEach(m => { s += pipeX(B.x0, B.x1, m.y, m.z, m.r, colors[m.id], `networks-main-${m.id}`); });
    for (let x = B.x0 + 60; x < B.x1; x += 110) { const m = mains[3]; s += `<path d="M${P(x, m.y - m.r, m.z)}L${P(x, m.y + m.r, m.z)}" stroke="#7a522f" stroke-width="5"/>`; }
    /* Regard de visite sur le collecteur */
    s += cylinderZ(manhole.x, manhole.y, mains[3].z - 10, -6, manhole.r, '#9b968d', '#6f6a62');
    for (let z = -170; z < -10; z += 34) { const c = project(manhole.x, manhole.y, z); s += `<path d="M${fmt(c.x - manhole.r * 1.22)} ${fmt(c.y)}A${fmt(manhole.r * 1.22)} ${fmt(manhole.r * .71)} 0 0 0 ${fmt(c.x + manhole.r * 1.22)} ${fmt(c.y)}" fill="none" stroke="#7e796f" stroke-width="1.6"/>`; }
    /* Colliers de prise en charge aux départs des branchements */
    routes.forEach(route => { if (route.id === 'drain') return; const [x, y, z] = route.coordinates[0]; const c = project(x, y, z); s += `<circle cx="${fmt(c.x)}" cy="${fmt(c.y)}" r="9" fill="#2a2a2c" stroke="${route.color}" stroke-width="3"/>`; });
    { const [x, y, z] = routes[3].coordinates.at(-1); const c = project(x, y, z); s += `<circle cx="${fmt(c.x)}" cy="${fmt(c.y)}" r="12" fill="#5c3e26" stroke="#2a1d14" stroke-width="2"/>`; }
    /* Branchements (tracés au défilement) et flux */
    routes.forEach(route => {
      s += `<g class="networks-route networks-${route.id}" aria-hidden="true">` +
        `<path class="networks-route-guide" data-networks-path="${route.id}" d="${route.d}"/>` +
        `<path class="networks-pipe-shadow" data-networks-path="${route.id}" data-networks-trace="${route.id}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" d="${route.d}"/>` +
        `<path class="networks-pipe" data-networks-path="${route.id}" data-networks-trace="${route.id}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" d="${route.d}"/>` +
        `<path class="networks-pipe-shine" data-networks-path="${route.id}" data-networks-trace="${route.id}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" d="${route.d}"/>` +
        `<g data-networks-flow="${route.id}"></g></g>`;
    });
    /* Terrain naturel (creusé au début) puis remblai en couches (à la fin) */
    s += '<g data-networks-natural="">' + ['A', 'B'].map(k => naturalLayers[k].map(([name], i) => `<g data-networks-layer="natural-${k}-${i}" data-material="${name}"><path data-face="top" fill="${material[name][0]}"/><path data-face="front" fill="${material[name][1]}"/><path data-face="grain" fill="url(#networks-grain)"/></g>`).join('')).join('') + '</g>';
    s += '<g data-networks-backfill="">';
    const fillGroup = (k, i) => { const [name] = fillLayers[k][i]; return `<g data-networks-layer="fill-${k}-${i}" data-material="${name}"><path data-face="top" fill="${material[name][0]}"/><path data-face="front" fill="${material[name][1]}"/><path data-face="grain" fill="url(#networks-compact)"/></g>`; };
    s += fillGroup('A', 0) + fillGroup('B', 0);
    /* Grillages avertisseurs posés sur le sable, à la couleur de chaque réseau */
    s += '<g class="networks-grillage" data-networks-grillage="" opacity="0">';
    routes.forEach(route => { const x = route.coordinates[1][0]; s += path(top(x - 9, x + 9, A.y0 + 6, B.y0, grillageLevel), `fill="${route.color}" opacity=".85"`) + path(top(x - 9, x + 9, A.y0 + 6, B.y0, grillageLevel + .2), 'fill="url(#networks-mesh)"'); });
    mains.forEach(m => { s += path(top(B.x0, B.x1, m.y - 9, m.y + 9, grillageLevel), `fill="${colors[m.id]}" opacity=".85"`) + path(top(B.x0, B.x1, m.y - 9, m.y + 9, grillageLevel + .2), 'fill="url(#networks-mesh)"'); });
    s += '</g>';
    for (let i = 1; i < fillLayers.B.length; i++) { if (fillLayers.A[i]) s += fillGroup('A', i); s += fillGroup('B', i); }
    /* Le grillage avertisseur vu en coupe : quatre bandes de couleur posées sur le sable, sous le remblai */
    s += '<g class="networks-grillage-cut" data-networks-grillage-cut="" opacity="0">';
    mains.forEach((m, i) => { const z = grillageLevel - 1 - i * 3.2; s += `<path d="M${P(B.x0, B.y1 + .5, z)}L${P(B.x1, B.y1 + .5, z)}" stroke="${colors[m.id]}" stroke-width="2.6" stroke-dasharray="9 3"/>`; });
    s += '</g>';
    s += '</g></g>';

    /* Finitions de la rue : reprise d'enrobé, marquage, plaques de regards (phase 3) */
    s += '<g class="networks-road-finish" opacity="0" aria-hidden="true">';
    s += path(top(A.x0, A.x1, W.plot, W.sidewalk - 6, .4), 'fill="#a39d93"') + path(top(A.x0, A.x1, W.sidewalk - 6, W.sidewalk, .6), 'fill="#c6c0b5"');
    s += path(top(A.x0, A.x1, W.sidewalk, B.y0, .4), 'fill="#2c2b2e"');
    s += path(top(B.x0, B.x1, B.y0, B.y1, .4), 'fill="none" stroke="#4a4a4e" stroke-width="2"');
    s += `<path data-networks-road-line="" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" d="M${P(0, 570, .6)}L${P(W.x, 570, .6)}" fill="none" stroke="#f2efe6" stroke-width="3"/>`;
    s += `<path d="M${P(0, 570, .7)}L${P(W.x, 570, .7)}" fill="none" stroke="#303033" stroke-width="4" stroke-dasharray="26 22"/>`;
    s += lid(manhole.x, manhole.y, 24, '#3d3b3a') + lid(300, 462, 12, '#2f5f8a') + lid(372, 462, 14, '#4c4844') + lid(344, 470, 10, '#2f6d45');
    s += '</g>';

    /* Jardin (phase 3) */
    s += `<path class="networks-lawn" data-networks-lawn="" opacity="0" d="M${top(0, W.x, 0, W.plot, .3).map(([x, y, z]) => P(x, y, z)).join('L')}Z" fill="#4c6b3a"/>`;
    /* Réseaux enterrés en transparence, une fois tout refermé */
    s += '<g class="networks-ghost" data-networks-ghost="" opacity="0" aria-hidden="true">';
    routes.forEach(route => { s += `<path d="${route.d}" stroke="${route.color}"/>`; });
    mains.forEach(m => { s += `<path d="M${P(0, m.y, m.z)}L${P(W.x, m.y, m.z)}" stroke="${colors[m.id]}"/>`; });
    s += '</g>';
    /* Accès : allée de garage, chemin, clôture et portillon */
    s += '<g class="networks-access" opacity="0" aria-hidden="true">';
    s += path(top(470, 580, garage.y1, W.plot, .8), 'fill="#8e877c"');
    for (let y = garage.y1 + 22; y < W.plot; y += 22) s += `<path d="M${P(470, y, .9)}L${P(580, y, .9)}" stroke="#7b746a" stroke-width="1.2"/>`;
    s += path(top(246, 284, house.y1, W.plot, .8), 'fill="#b3ab9f"');
    for (let x = 6; x < W.x; x += 34) {
      if ((x > 240 && x < 290) || (x > 462 && x < 590)) continue;
      s += `<path d="M${P(x, W.plot - 4, 0)}L${P(x, W.plot - 4, 52)}" stroke="#2c2725" stroke-width="3"/>`;
    }
    [[0, 240], [290, 462], [590, W.x]].forEach(([x0, x1]) => { [22, 46].forEach(z => { s += `<path d="M${P(x0 + 6, W.plot - 4, z)}L${P(x1 - 6, W.plot - 4, z)}" stroke="#2c2725" stroke-width="2.5"/>`; }); });
    s += box(229, 240, W.plot - 10, W.plot, 0, 64, ['#3a3432', '#2c2725']) + box(290, 301, W.plot - 10, W.plot, 0, 64, ['#3a3432', '#2c2725']);
    s += box(304, 324, W.plot - 14, W.plot - 2, 30, 62, ['#d9d2c4', '#b8b0a2']);
    s += '</g>';
    /* Coffret électrique en limite de propriété */
    s += '<g class="networks-cabinet" aria-hidden="true">' + box(196, 224, W.plot - 16, W.plot - 2, 0, 92, ['#e6e0d3', '#c8c1b3']) + path(faceY(201, 219, W.plot - 1.5, 40, 84), 'fill="#b9b1a2"') + `<path d="M${P(204, W.plot - 1, 76)}L${P(216, W.plot - 1, 76)}" stroke="#e2493b" stroke-width="3"/>` + '</g>';

    /* Maison et garage, lueur intérieure */
    s += `<ellipse class="networks-house-glow" cx="${fmt(project(300, 300, 0).x)}" cy="${fmt(project(300, 300, 0).y)}" rx="230" ry="95" fill="url(#networks-pool-light)" opacity="0"/>`;
    /* Les arbres derrière la maison sont dessinés avant elle, pour qu'elle les cache */
    const plantMarkup = pl => { const c = project(pl.x, pl.y, 0); return `<g data-networks-plant="" data-plant-x="${fmt(c.x)}" data-plant-y="${fmt(c.y)}" transform="translate(${fmt(c.x)} ${fmt(c.y)}) scale(0)" opacity="0">${tree(pl.scale, pl.kind)}</g>`; };
    plants.filter(pl => pl.behind).forEach(pl => { s += plantMarkup(pl); });
    s += houseMarkup();
    /* Arrivées en façade : manchons, raccords */
    routes.forEach(route => {
      const end = route.id === 'drain' ? route.coordinates[0] : route.coordinates.at(-1);
      const c = project(end[0], end[1] + 1, end[2]);
      s += `<g class="networks-port networks-${route.id}" data-networks-port="${route.id}" transform="translate(${fmt(c.x)} ${fmt(c.y)})" opacity=".22"><circle r="11"/><circle class="networks-port-core" r="4.5"/></g>`;
      s += `<g class="networks-coupler networks-${route.id}" data-networks-coupler="${route.id}" opacity="0"><rect x="-9" y="-9" width="18" height="18" rx="2"/><path d="M-3-9v18M3-9v18"/></g>`;
    });
    /* Arbres et massifs (poussent en phase 3) */
    plants.filter(pl => !pl.behind).forEach(pl => { s += plantMarkup(pl); });
    /* Lampadaire */
    const lampBase = project(700, 468, 0), lampTop = project(700, 468, 205), lampHead = project(700, 520, 200);
    s += '<g class="networks-lamp" aria-hidden="true">' +
      `<ellipse data-networks-lamp="" cx="${fmt(project(700, 545, 0).x)}" cy="${fmt(project(700, 545, 0).y)}" rx="120" ry="58" fill="url(#networks-lamp-light)" opacity="0"/>` +
      `<path d="M${fmt(lampBase.x)} ${fmt(lampBase.y)}L${fmt(lampTop.x)} ${fmt(lampTop.y)}L${fmt(lampHead.x)} ${fmt(lampHead.y)}" fill="none" stroke="#3a3a3d" stroke-width="5" stroke-linejoin="round"/>` +
      `<ellipse cx="${fmt(lampHead.x)}" cy="${fmt(lampHead.y + 3)}" rx="15" ry="6" fill="#2a2a2c"/>` +
      `<ellipse data-networks-lamp-bulb="" cx="${fmt(lampHead.x)}" cy="${fmt(lampHead.y + 6)}" rx="10" ry="3.5" fill="#ffe2a0" opacity=".25"/>` +
      `<ellipse cx="${fmt(lampBase.x)}" cy="${fmt(lampBase.y)}" rx="9" ry="4" fill="#2a2a2c"/>` + '</g>';

    /* Légendes techniques (ordinateur) */
    const label = (x, y, z, dx, dy, text, cls) => { const a = project(x, y, z); const bx = a.x + dx, by = a.y + dy; const anchor = dx < 0 ? 'end' : 'start'; return `<g class="networks-label ${cls}"><path d="M${fmt(a.x)} ${fmt(a.y)}L${fmt(bx)} ${fmt(by)}H${fmt(bx + (dx < 0 ? -14 : 14))}"/><circle cx="${fmt(a.x)}" cy="${fmt(a.y)}" r="2.5"/><text x="${fmt(bx + (dx < 0 ? -20 : 20))}" y="${fmt(by + 4)}" text-anchor="${anchor}">${text}</text></g>`; };
    s += '<g class="networks-annotations" aria-hidden="true">';
    s += label(160, 560, -150, -150, 40, 'CONDUITE D’EAU POTABLE', 'networks-label-open');
    s += label(150, 592, -192, -130, 70, 'COLLECTEUR EAUX USÉES', 'networks-label-open');
    s += label(170, 578, -104, -180, 0, 'RÉSEAU ÉLECTRIQUE', 'networks-label-open');
    s += label(180, 604, -96, -150, 28, 'FOURREAUX TÉLÉCOM', 'networks-label-open');
    s += label(manhole.x, manhole.y, -40, 90, 70, 'REGARD DE VISITE', 'networks-label-open');
    s += label(210, W.plot - 8, 92, -110, -40, 'COFFRET ÉLECTRIQUE', '');
    s += label(trenchA.x0 + 10, 400, -60, -150, -90, 'BRANCHEMENTS', 'networks-label-open');
    s += label(trenchB.x0 + 30, W.y, grillageLevel - 5, -140, 20, 'GRILLAGE AVERTISSEUR', 'networks-label-fill');
    s += label(trenchB.x0 + 60, W.y, -150, -120, 60, 'LIT DE SABLE', 'networks-label-fill');
    s += label(W.x, 300, -90, 70, 40, 'TERRAIN NATUREL', '');
    s += '</g>';
    return s;
  }

  /* Faces d'une couche de remblai ou de terrain naturel entre z0 et z1 (vides si z1 ≤ z0). */
  function layerFaces(key, z0, z1) {
    if (!(z1 > z0 + .01)) return { top: '', front: '' };
    const t = key === 'A' ? trenchA : trenchB;
    const frontY = t.y1;
    return {
      top: `M${top(t.x0, t.x1, t.y0, t.y1, z1).map(([x, y, z]) => P(x, y, z)).join('L')}Z`,
      front: `M${faceY(t.x0, t.x1, frontY, z0, z1).map(([x, y, z]) => P(x, y, z)).join('L')}Z`
    };
  }
  function layerState(state) {
    const out = {};
    const natural = { A: mix(0, trenchA.floor, state.dig), B: mix(0, trenchB.floor, state.dig) };
    for (const k of ['A', 'B']) {
      naturalLayers[k].forEach(([, z0, z1], i) => { out[`natural-${k}-${i}`] = layerFaces(k, z0, Math.min(z1, natural[k])); });
      const level = k === 'A' ? Math.max(state.fillLevel, trenchA.floor) : state.fillLevel;
      fillLayers[k].forEach(([, z0, z1], i) => { out[`fill-${k}-${i}`] = state.backfill > 0 ? layerFaces(k, z0, Math.min(z1, level)) : { top: '', front: '' }; });
    }
    return out;
  }

  const copy = [
    ['RACCORDER', 'La tranchée s’ouvre, les réseaux de la rue apparaissent. Eau, électricité, télécom, eaux usées : chaque branchement trouve son chemin jusqu’à la maison.'],
    ['FAIRE CIRCULER', 'L’eau arrive, le courant passe, la fibre s’allume, les eaux usées repartent vers le collecteur. Chaque réseau à sa place, à sa profondeur.'],
    ['AMÉNAGER', 'Lit de sable, puis grillage avertisseur : un filet de couleur qui signale chaque réseau aux futurs terrassiers. Remblai, enrobé : la tranchée se referme, l’allée, la clôture et le jardin terminent le chantier.']
  ];
  const mounted = new WeakMap();
  const put = (element, name, value) => { if (element) element.setAttribute(name, String(value)); };
  function mount(section) {
    if (!section || typeof section.querySelector !== 'function') return null;
    if (mounted.has(section)) return mounted.get(section);
    const one = selector => section.querySelector(selector);
    const many = selector => Array.from(section.querySelectorAll(selector));
    const refs = {
      world: one('.networks-world'), heading: one('[data-networks-heading]'), description: one('[data-networks-description]'),
      number: one('[data-networks-number]'), stops: many('[data-network-step]'), progress: one('.networks-progress > span'),
      windows: many('[data-networks-window]'), glow: one('.networks-house-glow'), access: one('.networks-access'),
      road: one('.networks-road-finish'), markings: many('[data-networks-road-line]'), plants: many('[data-networks-plant]'),
      lawn: one('[data-networks-lawn]'), ghost: one('[data-networks-ghost]'), grillage: one('[data-networks-grillage]'),
      lamp: one('[data-networks-lamp]'), bulb: one('[data-networks-lamp-bulb]'), grillageCut: one('[data-networks-grillage-cut]'),
      layers: many('[data-networks-layer]').map(element => ({ element, id: element.getAttribute('data-networks-layer'),
        top: element.querySelector ? element.querySelector('[data-face="top"]') : null, front: element.querySelector ? element.querySelector('[data-face="front"]') : null,
        grain: element.querySelector ? element.querySelector('[data-face="grain"]') : null })),
      routes: routes.map(route => ({
        id: route.id, traces: many(`[data-networks-trace="${route.id}"]`),
        port: one(`[data-networks-port="${route.id}"]`), coupler: one(`[data-networks-coupler="${route.id}"]`),
        flows: one(`[data-networks-flow="${route.id}"]`)
      })), stage: -1, compact: null, reduced: null
    };
    mounted.set(section, refs);
    routes.forEach(route => {
      many(`[data-networks-path="${route.id}"]`).forEach(element => put(element, 'd', route.d));
      const flow = one(`[data-networks-flow="${route.id}"]`);
      if (flow) {
        const symbol = route.id === 'water' ? '<path d="M0-10C-2-6-7-1-7 3a7 7 0 0 0 14 0C7-1 2-6 0-10Z"/>' :
          route.id === 'power' ? '<path d="M2-11-7 2H-1L-3 11 8-3H2Z"/>' :
          route.id === 'telecom' ? '<path d="M0-9 9 0 0 9-9 0Z"/>' : '<circle cx="-4" cy="1" r="4.5"/><circle cx="5" cy="-4" r="3"/><circle cx="5" cy="6" r="2"/>';
        flow.innerHTML = [0, 1, 2].map(i => `<g class="networks-flow-token" opacity="0"><circle class="networks-flow-halo" r="${i === 0 ? 18 : 10}"/>${i === 0 ? `<g class="networks-flow-symbol">${symbol}</g>` : '<circle class="networks-flow-dot" r="4"/>'}</g>`).join('');
      }
    });
    refs.routes.forEach(route => { route.tokens = route.flows ? Array.from(route.flows.children) : []; });
    render(section, 0, false, false);
    return refs;
  }
  function render(section, progress, compact = false, reduced = false) {
    const refs = mounted.get(section) || mount(section);
    if (!refs) return null;
    const state = reduced ? still(progress) : sample(progress);
    refs.routes.forEach((route, index) => {
      const network = state.networks[index];
      route.traces.forEach(element => put(element, 'stroke-dashoffset', 1 - network.draw));
      put(route.port, 'opacity', .22 + .78 * network.join);
      put(route.coupler, 'transform', `translate(${network.coupler.x} ${network.coupler.y}) rotate(${network.coupler.angle})`);
      put(route.coupler, 'opacity', network.coupler.opacity);
      route.tokens.forEach((element, i) => {
        const particle = network.particles[i];
        put(element, 'transform', `translate(${particle.x} ${particle.y}) rotate(${route.id === 'water' ? particle.angle + 90 : 0})`);
        put(element, 'opacity', particle.opacity);
      });
    });
    const faces = layerState(state);
    refs.layers.forEach(layer => {
      const f = faces[layer.id] || { top: '', front: '' };
      put(layer.top, 'd', f.top);
      put(layer.front, 'd', f.front);
      put(layer.grain, 'd', f.front);
    });
    put(refs.grillage, 'opacity', state.grillage);
    put(refs.grillageCut, 'opacity', state.grillage);
    refs.windows.forEach(element => put(element, 'fill', state.glow > .5 ? '#f3c66a' : '#28323a'));
    refs.windows.forEach(element => put(element, 'opacity', 1));
    put(refs.glow, 'opacity', .55 * state.glow);
    put(refs.lamp, 'opacity', state.glow);
    put(refs.bulb, 'opacity', .25 + .75 * state.glow);
    put(refs.access, 'opacity', state.access);
    put(refs.road, 'opacity', state.road);
    put(refs.lawn, 'opacity', .92 * state.planting);
    put(refs.ghost, 'opacity', state.ghost);
    refs.markings.forEach(element => put(element, 'stroke-dashoffset', 1 - state.road));
    refs.plants.forEach((element, i) => {
      const amount = span(state.planting, i * .06, .62 + i * .06);
      const x = Number(element.getAttribute('data-plant-x')), y = Number(element.getAttribute('data-plant-y'));
      put(element, 'transform', `translate(${x} ${y}) scale(${amount})`);
      put(element, 'opacity', amount);
    });
    // La préférence du corps de page fixe la hauteur ; cette classe ne fait qu'apaiser les indices visuels.
    if (refs.reduced !== Boolean(reduced)) {
      section.classList.toggle('networks-static', Boolean(reduced));
      refs.reduced = Boolean(reduced);
    }
    if (refs.compact !== Boolean(compact)) {
      put(refs.world, 'viewBox', compact ? viewBoxes.compact : viewBoxes.wide);
      refs.compact = Boolean(compact);
    }
    if (refs.progress) refs.progress.style.transform = `scaleX(${clamp(progress)})`;
    if (refs.stage !== state.phase) {
      const phase = state.phase;
      if (refs.heading) refs.heading.textContent = copy[phase][0];
      if (refs.description) refs.description.textContent = copy[phase][1];
      if (refs.number) refs.number.textContent = String(phase + 1).padStart(2, '0');
      refs.stops.forEach((element, i) => {
        element.classList.toggle('active', i === phase);
        put(element, 'aria-pressed', String(i === phase));
      });
      put(section, 'data-network-phase', phase);
      refs.stage = phase;
    }
    return state;
  }
  const viewBoxes = { wide: '40 -95 1290 1100', compact: '300 -95 860 1090' };
  const api = { mount, render, sample, still, sceneMarkup, layerState, pointAlong, project, terrain, houseBase, house, garage, trenchA, trenchB, mains, routes, colors, viewBoxes, copy,
    stepPositions: [.36, .62, .99], stillPositions: [.42, .72, 1] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CLTNetworks = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
