/* Coordinates shared by both transport scenes: source truck pixels, ground y=628. */
(function (root) {
  'use strict';
  const clamp = n => Math.max(0, Math.min(1, n));
  const ease = n => { const t = clamp(n); return t * t * t * (10 + t * (-15 + 6 * t)); };
  const span = (p, a, b) => ease((p - a) / (b - a));
  const ground = 628, deck = 448, tireRadius = 78, cargoScale = .65, trackHalf = 234;
  const ramp = { x: 45, y: 497, foot: -440 };
  const rampLength = Math.hypot(ramp.x - ramp.foot, ground - ramp.y);
  const rampOpen = -Math.atan2(ground - ramp.y, ramp.x - ramp.foot) * 180 / Math.PI;
  function surface(x) {
    if (x <= ramp.foot) return ground;
    if (x < ramp.x) return ground + (ramp.y - ground) * (x - ramp.foot) / (ramp.x - ramp.foot);
    if (x < 235) return ramp.y + (deck - ramp.y) * (x - ramp.x) / (235 - ramp.x);
    return deck;
  }
  function trackPose(x) {
    const half = trackHalf;
    let angle = 0;
    for (let i = 0; i < 6; i++) {
      const reach = half * Math.cos(angle);
      angle = Math.atan2(surface(x + reach) - surface(x - reach), 2 * reach);
    }
    let y = Infinity;
    for (let i = 0; i <= 32; i++) {
      const u = -half + 2 * half * i / 32;
      y = Math.min(y, surface(x + u * Math.cos(angle)) - u * Math.sin(angle));
    }
    return { x, y, angle: angle * 180 / Math.PI };
  }
  const PHONE_EXIT_SHIFT = 2600;
  function sampleDeparture(progress, compact = false) {
    const p = clamp(progress);
    const loading = span(p, .07, .43);
    const journey = 2000 * span(p, .54, .84);
    const exit = 3500 * span(p, .84, 1);
    const truckX = journey + exit;
    const cargo = trackPose(-730 + 1490 * loading);
    cargo.x += truckX;
    const wide = span(p, .46, .58);
    const cameraZoom = compact ? 2 - .58 * wide : 1 + .18 * wide;
    const baseCameraX = compact ? (100 - (cargo.x - truckX) * 2) * (1 - wide) - 1000 * wide : -400 * wide;
    // Téléphone : la caméra accompagne la sortie, juste assez pour que le camion quitte l'écran à la toute fin
    // de la scène (pas d'écran vide qui traîne, pas de camion qui reste à moitié).
    const follow = compact ? (3500 - PHONE_EXIT_SHIFT) * span(p, .84, 1) : 0;
    return {
      progress: p, truckX, cargo, distance: truckX, mirror: false,
      armAngle: Math.abs(cargo.angle) * 1.18,
      wheelAngle: truckX / tireRadius * 180 / Math.PI,
      rampAngle: 90 + (rampOpen - 90) * (span(p, 0, .06) - span(p, .45, .52)),
      cameraZoom, cameraX: baseCameraX - (journey + follow) * cameraZoom,
      trackDistance: 1490 * loading, phase: p < .54 ? 0 : 1
    };
  }
  function sampleArrival(progress, compact = false) {
    const p = clamp(progress);
    const approach = span(p, 0, .35);
    const distance = 3500 * approach;
    const truckX = -3500 + distance;
    const unloading = span(p, .49, .94);
    const cargo = trackPose(760 - 1490 * unloading);
    cargo.x += truckX;
    const close = span(p, .46, .60);
    const cameraZoom = compact ? 1.42 + .58 * close : 1;
    const worldCargoX = 1250 - cargo.x;
    return {
      progress: p, truckX, cargo, distance, mirror: true,
      armAngle: Math.abs(cargo.angle) * 1.18,
      wheelAngle: distance / tireRadius * 180 / Math.PI,
      rampAngle: 90 + (rampOpen - 90) * span(p, .385, .465),
      cameraZoom, cameraX: compact ? 250 * (1 - close) + (900 - worldCargoX * 2) * close : 0,
      trackDistance: -1490 * unloading, phase: p < .385 ? 0 : 1
    };
  }
  /* Suivi du défilement : réactif (55 ms) ; vitesse plafonnée pour qu'un défilement très rapide
     montre encore le chargement, sans retard sensible (toute la scène en 0,7 s au plus). */
  const FOLLOW_SPAN = 700;
  function follow(current, target, elapsed) {
    const dt = Math.max(0, Math.min(32, elapsed));
    const delta = (target - current) * (1 - Math.exp(-dt / 55));
    const limit = dt / FOLLOW_SPAN;
    return current + Math.max(-limit, Math.min(limit, delta));
  }
  /* Effets de route, pilotés par la distance parcourue et la vitesse (aucun minuteur) :
     gyrophare qui tourne avec le trajet, poussière derrière les roues arrière, légère suspension du châssis.
     Les roues ne bougent jamais : seule la caisse suit `bob`, pour garder le contact au sol. */
  const beaconPoint = { x: 2002, y: 100 }, headlightPoint = { x: 2112, y: 522 };
  const dustEmitters = [297.75, 513.27];
  function roadEffects(distance, speed) {
    const d = Number.isFinite(distance) ? distance : 0;
    const moving = clamp(Math.abs(Number.isFinite(speed) ? speed : 0) / 1.2);
    const turn = d / 46;
    const beacon = .35 + .65 * Math.pow(Math.abs(Math.sin(turn)), 3) * (.4 + .6 * moving);
    const dust = [];
    dustEmitters.forEach((x, e) => {
      for (let i = 0; i < 5; i++) {
        const age = (((Math.abs(d) / 170 + i / 5 + e * .37) % 1) + 1) % 1;
        dust.push({ x: x - 70 - age * 300, y: ground - 10 - age * 62, r: 14 + age * 52, opacity: moving * .42 * Math.sin(Math.PI * age) * (1 - age * .35) });
      }
    });
    return { beacon, headlight: .55 + .45 * moving, dust, bob: Math.sin(d / 58) * 2.2 * moving, moving };
  }
  const api = { roadEffects, beaconPoint, headlightPoint, sampleDeparture, sampleArrival, follow, FOLLOW_SPAN, surface, trackPose, ground, deck, tireRadius, cargoScale, trackHalf, ramp, rampLength, rampOpen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CLTMotion = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
