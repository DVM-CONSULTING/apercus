/* Deterministic excavation: the page owns scrolling and animation scheduling. */
(function (root) {
  'use strict';
  const clamp = n => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  const smooth = n => { const t = clamp(n); return t * t * t * (10 + t * (-15 + 6 * t)); };
  const span = (p, a, b) => smooth((p - a) / (b - a));
  const mix = (a, b, t) => a + (b - a) * t;
  const ground = 610;
  const machine = { x: 1370, y: ground, scale: .54, sourceGround: 903 };
  const truck = { x: -90, y: ground - .55 * 785, scale: .55, sourceGround: 785 };
  truck.opening = { left: truck.x + 580 * truck.scale, right: truck.x + 1660 * truck.scale, top: truck.y + 240 * truck.scale };
  truck.rear = truck.x + 1774 * truck.scale;
  const joints = { boom: { x: 860, y: 568 }, stick: { x: 220, y: 284 }, bucket: { x: 258, y: 651 } };
  const cylinderAnchors = { base: { x: 620, y: 200 }, moving: { x: 154, y: 171 } };
  // Lift before extending: the complete bucket clears the truck rim before moving over it.
  const poses = [
    [0, 0, 0, 0], [.16, 0, 0, 0], [.32, -12, 6, 20], [.42, -12, 6, 20],
    [.48, -6, -6, 45], [.57, 45, -20, -45], [.62, 45, 0, -65],
    [.69, 24, 92, -136], [.79, 24, 92, -42], [1, 24, 92, -42]
  ];
  const copy = [
    ['PRÉPARER', 'Avant la maison, le terrain. Préparer l’implantation, les niveaux et l’accès au chantier.'],
    ['CREUSER', 'Ouvrir les terres et préparer l’assise de la future maison. Chaque mouvement donne forme au terrain.'],
    ['ÉVACUER', 'Charger les déblais dans la benne. Le terrain se dégage, le chantier avance.']
  ];
  const bucketOutline = [[170,720],[184,700],[226,650],[250,625],[285,620],[307,635],[315,565],[355,565],[385,595],[401,595],[426,629],[451,672],[486,731],[505,761],[533,795],[580,838],[555,867],[492,880],[430,885],[330,887],[252,877],[225,850],[206,819],[188,782],[184,746]].map(([x,y]) => ({x,y}));
  const pitProfile = [[915,0],[929,8],[938,23],[950,29],[960,47],[975,57],[986,75],[1003,83],[1016,91],[1031,88],[1044,95],[1059,91],[1072,92],[1084,86],[1092,66],[1099,49],[1105,25],[1110,0]];
  const grainCount = 28, fallDuration = .08;
  const grainStart = i => .772 + i * .00165;
  function rotate(point, pivot, degrees) {
    const r = degrees * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const x = point.x - pivot.x, y = point.y - pivot.y;
    return { x: pivot.x + x * c - y * s, y: pivot.y + x * s + y * c };
  }
  function machinePoint(point, pose) {
    let t = rotate(point, joints.bucket, pose.bucketAngle);
    t = rotate(t, joints.stick, pose.stickAngle);
    t = rotate(t, joints.boom, pose.boomAngle);
    return { x: machine.x + (t.x - 1020) * machine.scale, y: machine.y + (t.y - machine.sourceGround) * machine.scale };
  }
  function samplePose(progress) {
    const p = clamp(progress);
    let next = poses.findIndex(k => k[0] >= p);
    if (next < 1) next = 1;
    const a = poses[next - 1], b = poses[next], t = smooth((p - a[0]) / (b[0] - a[0]));
    return { boomAngle: mix(a[1], b[1], t), stickAngle: mix(a[2], b[2], t), bucketAngle: mix(a[3], b[3], t) };
  }
  function cylinderPose(stickAngle) {
    const base = cylinderAnchors.base, original = cylinderAnchors.moving;
    const end = rotate(original, joints.stick, stickAngle);
    const dx = end.x - base.x, dy = end.y - base.y;
    const sourceAngle = Math.atan2(original.y - base.y, original.x - base.x);
    let angle = (Math.atan2(dy, dx) - sourceAngle) * 180 / Math.PI;
    if (angle > 180) angle -= 360;
    if (angle < -180) angle += 360;
    return { angle, sourceAngle: sourceAngle * 180 / Math.PI, scale: Math.hypot(dx, dy) / Math.hypot(original.x - base.x, original.y - base.y), end };
  }
  function sample(progress) {
    const p = clamp(progress), pose = samplePose(p);
    const state = {
      progress: p, ...pose,
      plan: span(p, .015, .20), cut: span(p, .22, .34),
      load: span(p, .285, .475) * (1 - span(p, .765, .84)),
      phase: p < .24 ? 0 : p < .65 ? 1 : 2
    };
    state.bucketTip = machinePoint({ x: 550, y: 845 }, state);
    state.bucketMouth = machinePoint({ x: 480, y: 790 }, state);
    state.cylinder = cylinderPose(state.stickAngle);
    state.particles = Array.from({ length: grainCount }, (_, i) => {
      const start = grainStart(i), raw = (p - start) / fallDuration, f = clamp(raw);
      // Each grain keeps the bucket's position at release, then falls behind the side wall.
      const origin = machinePoint({ x: 480 + (i % 3 - 1) * 7, y: 790 }, samplePose(start));
      const landing = 746 + (i * 13) % 62, landingY = truck.opening.top + 44 + i % 4 * 3;
      const rimFraction = Math.sqrt((truck.opening.top - origin.y) / (landingY - origin.y));
      return {
        x: mix(origin.x, landing, f),
        y: mix(origin.y, landingY, f * f),
        angle: 24 * i + 160 * f, origin, landing, landingY,
        rimTime: start + fallDuration * rimFraction, landTime: start + fallDuration,
        opacity: raw > 0 && raw < 1 ? Math.min(1, raw * 18, (1 - raw) * 15) : 0
      };
    });
    // The mound grows only when soil reaches the bed, rather than before the first fall.
    state.bedFill = state.particles.reduce((sum, grain) => sum + span(p, grain.rimTime, grain.landTime), 0) / grainCount;
    state.fx = effects(p, state);
    return state;
  }
  /* Effets de chantier : niveau laser de référence, repère du fond de fouille, poussière quand le godet
     attaque le terrain puis quand il vide dans la benne. Tout dépend du défilement, rien du temps. */
  const dustCount = 12;
  function effects(p, state) {
    const bite = span(p, .2, .26) * (1 - span(p, .34, .4));
    const dump = span(p, .765, .79) * (1 - span(p, .86, .92));
    const tip = state.bucketTip;
    const dust = Array.from({ length: dustCount }, (_, i) => {
      const half = i < dustCount / 2, k = half ? i : i - dustCount / 2;
      const age = ((p * (half ? 46 : 38) + k / (dustCount / 2)) % 1 + 1) % 1;
      const amount = half ? bite : dump;
      const ox = half ? tip.x : 700 + k * 22, oy = half ? Math.min(tip.y, ground + 6) : truck.opening.top + 18;
      return { x: ox + (k - 2.5) * 9 + age * (half ? 60 : 30) * (k % 2 ? 1 : -1), y: oy - age * (half ? 70 : 85), r: 10 + age * 34, opacity: amount * .5 * Math.sin(Math.PI * age) };
    });
    return { dust, laser: span(p, .02, .15), laserLabel: span(p, .1, .16), depth: span(p, .3, .37) };
  }
  /** Cadre téléphone : hauteur fixe (camion, pelle et fouille en entier), centré entre le godet et la pelle. */
  function phoneCamera(state, aspect) {
    const a = Number.isFinite(aspect) && aspect > 0 ? aspect : .9;
    const h = 780, w = Math.max(560, Math.min(1810, h * a));
    const target = clamp(((state.bucketMouth ? state.bucketMouth.x : 1000) * .7 + 1300 * .3 - 520) / 900);
    const cx = 520 + 900 * target;
    const x = Math.max(-120, Math.min(1690 - w, cx - w / 2));
    return [x, 40, w, h];
  }
  function pitPath(amount) {
    const cut = clamp(amount);
    return `M915 ${ground}` + pitProfile.slice(1).map(([x,depth]) => `L${x} ${ground + depth * cut}`).join('') + 'Z';
  }
  function surfacePath(amount) {
    return 'M-1600 610L915 610' + pitProfile.slice(1).map(([x,depth]) => `L${x} ${ground + depth * clamp(amount)}`).join('') + 'H3200';
  }
  function bedPath(amount) {
    const h = 30 * clamp(amount), y = truck.opening.top + 5;
    return `M590 ${y}L622 ${y - h * .05}L648 ${y - h * .22}L673 ${y - h * .27}L699 ${y - h * .5}L719 ${y - h * .43}L742 ${y - h * .8}L763 ${y - h}L782 ${y - h * .8}L796 ${y - h * .66}L816 ${y}Z`;
  }

  const mounted = new WeakMap();
  function mount(section) {
    if (!section) return null;
    if (mounted.has(section)) return mounted.get(section);
    const one = selector => section.querySelector(selector), many = selector => Array.from(section.querySelectorAll(selector));
    const refs = {
      world: one('.earthworks-world'), boom: one('.earthworks-boom'), stick: one('.earthworks-stick'),
      bucket: one('.earthworks-bucket'), cylinder: one('.earthworks-cylinder'), cut: many('.earthworks-cut-shape'), surface: one('.earthworks-surface'),
      plan: one('.earthworks-house-plan'), planLines: many('[data-earthworks-plan]'), pitDetail: one('.earthworks-pit-detail'),
      bucketLoad: one('.earthworks-bucket-load'), bedFill: one('.earthworks-bed-fill'), particles: many('.earthworks-grain'),
      heading: one('[data-earthworks-heading]'), description: one('[data-earthworks-description]'), number: one('[data-earthworks-number]'),
      stops: many('[data-earth-step]'), progress: one('.earthworks-progress > span'), stage: -1, compact: null, reduced: null,
      dust: many('.earthworks-dust'), laser: one('[data-earthworks-laser]'), laserDot: one('[data-earthworks-laser-dot]'),
      laserLabel: one('[data-earthworks-laser-label]'), depth: one('[data-earthworks-depth]')
    };
    mounted.set(section, refs);
    render(section, 0, false, false);
    return refs;
  }
  function render(section, progress, compact = false, reduced = false) {
    const refs = mounted.get(section) || mount(section);
    if (!refs) return null;
    const requested = sample(progress), state = reduced ? sample(1) : requested;
    const put = (el, name, value) => { if (el) el.setAttribute(name, String(value)); };
    put(refs.boom, 'transform', `rotate(${state.boomAngle} 860 568)`);
    put(refs.stick, 'transform', `rotate(${state.stickAngle} 220 284)`);
    put(refs.bucket, 'transform', `rotate(${state.bucketAngle} 258 651)`);
    put(refs.cylinder, 'transform', `translate(620 200) rotate(${state.cylinder.sourceAngle + state.cylinder.angle}) scale(${state.cylinder.scale} 1) rotate(${-state.cylinder.sourceAngle}) translate(-620 -200)`);
    refs.cut.forEach(el => put(el, 'd', pitPath(state.cut)));
    put(refs.surface, 'd', surfacePath(state.cut));
    refs.planLines.forEach(el => put(el, 'stroke-dashoffset', 1 - state.plan));
    put(refs.plan, 'opacity', .9);
    put(refs.pitDetail, 'opacity', state.cut);
    put(refs.bucketLoad, 'opacity', state.load);
    put(refs.bedFill, 'd', bedPath(state.bedFill));
    put(refs.bedFill, 'opacity', state.bedFill);
    refs.particles.forEach((el, i) => {
      const part = state.particles[i % state.particles.length];
      put(el, 'transform', `translate(${part.x} ${part.y}) rotate(${part.angle})`);
      put(el, 'opacity', part.opacity);
    });
    (refs.dust || []).forEach((el, i) => {
      const d = state.fx.dust[i];
      if (!d) return;
      put(el, 'cx', d.x.toFixed(1)); put(el, 'cy', d.y.toFixed(1)); put(el, 'rx', d.r.toFixed(1)); put(el, 'ry', (d.r * .62).toFixed(1));
      put(el, 'opacity', reduced ? 0 : d.opacity.toFixed(3));
    });
    put(refs.laser, 'stroke-dashoffset', 1 - state.fx.laser);
    put(refs.laserDot, 'cx', (-120 + 1810 * state.fx.laser).toFixed(1));
    put(refs.laserDot, 'opacity', state.fx.laser > 0 && state.fx.laser < 1 ? 1 : 0);
    put(refs.laserLabel, 'opacity', state.fx.laserLabel);
    put(refs.depth, 'opacity', state.fx.depth);
    if (refs.progress) refs.progress.style.transform = `scaleX(${requested.progress})`;
    if (compact) {
      // Téléphone : la scène est épinglée en haut de l'écran, plus grande, et la caméra suit le godet.
      const box = refs.world && refs.world.getBoundingClientRect ? refs.world.getBoundingClientRect() : null;
      const aspect = box && box.width > 0 && box.height > 0 ? box.width / box.height : .9;
      put(refs.world, 'viewBox', phoneCamera(state, aspect).map(v => v.toFixed(1)).join(' '));
      refs.compact = true;
    } else if (refs.compact !== compact) {
      // The complete two-vehicle choreography remains in frame on a wide screen.
      put(refs.world, 'viewBox', '-120 55 1810 755');
      refs.compact = compact;
    }
    if (refs.reduced !== reduced) {
      section.classList.toggle('earthworks-static', reduced);
      refs.reduced = reduced;
    }
    if (refs.stage !== requested.phase) {
      const stage = requested.phase;
      if (refs.heading) refs.heading.textContent = copy[stage][0];
      if (refs.description) refs.description.textContent = copy[stage][1];
      if (refs.number) refs.number.textContent = String(stage + 1).padStart(2, '0');
      refs.stops.forEach((el, i) => {
        el.classList.toggle('active', i === stage);
        el.setAttribute('aria-pressed', String(i === stage));
      });
      section.setAttribute('data-earth-phase', String(stage));
      refs.stage = stage;
    }
    return state;
  }
  const api = { mount, render, sample, effects, dustCount, phoneCamera, samplePose, machinePoint, cylinderPose, cylinderAnchors, pitPath, pitProfile, surfacePath, bedPath, ground, machine, truck, joints, bucketOutline, grainCount, grainStart, fallDuration, poses, stepPositions: [.15, .42, .82] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CLTEarthworks = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
