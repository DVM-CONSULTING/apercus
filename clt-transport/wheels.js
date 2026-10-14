/*
 * Mechanical wheel replacements for the 2172 × 724 truck-side.png.
 *
 * Insert defs({ id }) into the scene SVG and markup({ id }) after the truck.
 * Apply mask="url(#<id>-source-wheel-mask)" to the original truck image: the
 * generated photo contains asymmetric tyres that an overlay cannot erase.
 * Each scene needs its own id. The optional legacy href is no longer used.
 *
 * update(group, distance, elapsedMs = 16) takes signed SOURCE-image pixels.
 * A mirrored parent already reverses rotation; do not invert distance again.
 * Only apertures, bolts and hub screws rotate. Rubber, rim profile, contact
 * shadow and broad illumination stay fixed. elapsedMs=0 renders a sharp pose
 * and resets speed history, including reduced motion and layout changes.
 */
(function (root) {
  'use strict';

  const imageWidth = 2172;
  const imageHeight = 724;
  const ground = 628;
  const previousDistances = new WeakMap();
  const wheels = Object.freeze([
    { name: 'rear-1', x: 297.75, y: 550.44, coverOffset: 10, coverX: 100, sourceCutX: 110 },
    { name: 'rear-2', x: 513.27, y: 550.19, coverOffset: 8, coverX: 96, sourceCutX: 105 },
    { name: 'middle', x: 902.30, y: 550.53, coverOffset: 4, coverX: 90, sourceCutX: 95 },
    { name: 'drive', x: 1475.24, y: 550.74, coverOffset: 0, coverX: 89, sourceCutX: 87 },
    { name: 'front', x: 1925.05, y: 550.58, coverOffset: -10, coverX: 96, sourceCutX: 85 }
  ].map(wheel => Object.freeze(Object.assign({}, wheel, {
    radius: ground - wheel.y,
    tireX: 83.5,
    rimRadius: 49,
    coverY: ground - wheel.y + 7
  }))));

  function options(input) {
    const value = input || {};
    const id = value.id === undefined ? 'clt-wheels' : String(value.id);
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id)) {
      throw new TypeError('CLTWheels id must be a valid unique SVG identifier.');
    }
    return { id };
  }

  function defs(input) {
    const { id } = options(input);
    return `<defs data-clt-wheel-defs="${id}">
      <clipPath id="${id}-source-cut"><rect x="0" y="477" width="${imageWidth}" height="247"/></clipPath>
      <mask id="${id}-source-wheel-mask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="${imageWidth}" height="${imageHeight}" style="mask-type:luminance">
        <rect width="${imageWidth}" height="${imageHeight}" fill="white"/>
        <g fill="black" clip-path="url(#${id}-source-cut)">
          ${wheels.map(wheel => sourceContour(wheel)).join('\n')}
        </g>
      </mask>
      <radialGradient id="${id}-contact-shadow"><stop stop-color="#040708" stop-opacity=".54"/><stop offset="1" stop-color="#040708" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}-rubber" cx=".30" cy=".24" r=".78">
        <stop stop-color="#454a4c"/><stop offset=".36" stop-color="#2d3234"/><stop offset=".69" stop-color="#171b1d"/><stop offset=".9" stop-color="#0d1012"/><stop offset="1" stop-color="#060809"/>
      </radialGradient>
      <linearGradient id="${id}-rubber-edge" x1="0" y1="0" x2=".6" y2="1">
        <stop stop-color="#7c8180" stop-opacity=".55"/><stop offset=".48" stop-color="#24292b" stop-opacity=".15"/><stop offset="1" stop-color="#020405" stop-opacity=".6"/>
      </linearGradient>
      <linearGradient id="${id}-steel-lip" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#d3d8d2"/><stop offset=".25" stop-color="#7e8a8d"/><stop offset=".48" stop-color="#c5cdc8"/><stop offset=".73" stop-color="#6c787b"/><stop offset=".9" stop-color="#bec6bf"/><stop offset="1" stop-color="#5c696d"/>
      </linearGradient>
      <radialGradient id="${id}-steel-dish" cx=".43" cy=".34" r=".67">
        <stop stop-color="#677579"/><stop offset=".42" stop-color="#a6b1af"/><stop offset=".72" stop-color="#b2bcb7"/><stop offset=".89" stop-color="#6d7b7e"/><stop offset="1" stop-color="#39494f"/>
      </radialGradient>
      <radialGradient id="${id}-hub" cx=".35" cy=".28" r=".75">
        <stop stop-color="#7a8586"/><stop offset=".45" stop-color="#46545a"/><stop offset=".78" stop-color="#29363b"/><stop offset="1" stop-color="#182329"/>
      </radialGradient>
      <linearGradient id="${id}-fixed-light" x1="0" y1="0" x2=".65" y2="1">
        <stop stop-color="white" stop-opacity=".16"/><stop offset=".45" stop-color="white" stop-opacity="0"/><stop offset="1" stop-color="#02090d" stop-opacity=".24"/>
      </linearGradient>
    </defs>`;
  }

  function sourceContour(wheel) {
    // Follow the inner fender arch above the hub, then widen BELOW the fender
    // to remove the generated second-tyre shadow. A large shifted ellipse
    // would also erase the fender/chassis and expose a conspicuous dark oval.
    return `<path transform="translate(${wheel.x} ${wheel.y})" d="M-84 0C-84 -44 -48 -78 0 -78C45 -78 75 -47 80 -19C83 -3 94 11 ${wheel.sourceCutX} 18C${wheel.sourceCutX} 43 83 62 57 69C39 88 -34 87 -57 69C-76 53 -84 27 -84 0Z"/>`;
  }

  function mechanicalDetails() {
    const hexagon = Array.from({ length: 6 }, (_, index) => {
      const angle = (30 + index * 60) * Math.PI / 180;
      return `${(Math.cos(angle) * 3.2).toFixed(3)},${(Math.sin(angle) * 3.2).toFixed(3)}`;
    }).join(' ');
    return `${Array.from({ length: 10 }, (_, index) => `<g transform="rotate(${index * 36})">
      <ellipse cx="0" cy="-33.5" rx="4.4" ry="6.3" fill="#182327" stroke="#4c5a5d" stroke-width=".8"/>
      <path d="M-2.9 -37.8Q-4.2 -33.6 -2.9 -29.4" fill="none" stroke="#080f14" stroke-width=".85"/>
    </g>`).join('')}
    ${Array.from({ length: 10 }, (_, index) => `<g transform="rotate(${index * 36 + 18}) translate(0 -22.1)">
      <circle r="4.2" fill="#35444a"/><polygon points="${hexagon}" fill="#bac2bd" stroke="#53646a" stroke-width=".65"/><circle r=".8" fill="#59696d"/>
    </g>`).join('')}
    ${Array.from({ length: 6 }, (_, index) => `<g transform="rotate(${index * 60})"><circle cx="0" cy="-9.2" r="1.3" fill="#a8b4b2" stroke="#2a3b42" stroke-width=".55"/></g>`).join('')}
    <path d="M36 -25l3.2 -2" stroke="#202c31" stroke-width="1.8" stroke-linecap="round"/>`;
  }

  function wheelMarkup(id, wheel) {
    return `<g data-clt-wheel="${wheel.name}" transform="translate(${wheel.x} ${wheel.y})">
      <ellipse data-clt-wheel-shadow="" cx="0" cy="${wheel.radius + .8}" rx="80" ry="4.2" fill="url(#${id}-contact-shadow)"/>
      <g data-clt-wheel-tire="" transform="scale(${wheel.tireX} ${wheel.radius})">
        <circle r="1" fill="url(#${id}-rubber)"/>
        <circle r=".975" fill="none" stroke="url(#${id}-rubber-edge)" stroke-width=".023"/>
        <circle r=".918" fill="none" stroke="#05090c" stroke-width=".022" opacity=".56"/>
        <circle r=".895" fill="none" stroke="#616969" stroke-width=".008" opacity=".26"/>
        <circle r=".839" fill="none" stroke="#060a0d" stroke-width=".013" opacity=".47"/>
        <circle r=".795" fill="none" stroke="#717878" stroke-width=".006" opacity=".2"/>
        <circle r=".689" fill="none" stroke="#05090c" stroke-width=".04" opacity=".7"/>
        <circle r=".654" fill="none" stroke="#697575" stroke-width=".012" opacity=".2"/>
      </g>
      <g data-clt-wheel-rim="">
        <circle r="50.6" fill="#0a1014"/>
        <circle r="49" fill="url(#${id}-steel-lip)" stroke="#56666d" stroke-width=".85"/>
        <circle r="46.8" fill="none" stroke="#d6dbd3" stroke-width="1.15" opacity=".55"/>
        <circle r="44.2" fill="url(#${id}-steel-dish)" stroke="#42545c" stroke-width="1.15"/>
        <circle r="40.6" fill="none" stroke="#c3cdc7" stroke-width=".85" opacity=".5"/>
        <circle r="27.7" fill="none" stroke="#53666c" stroke-width="1.2" opacity=".6"/>
        <circle r="16.2" fill="#24353d" stroke="#b0bcb8" stroke-width=".8"/>
        <circle r="14.2" fill="url(#${id}-hub)" stroke="#1b2e36" stroke-width="1"/>
      </g>
      <g data-clt-wheel-rotor="mechanical" data-clt-wheel-radius="${wheel.radius}" transform="rotate(0)" opacity="1">${mechanicalDetails()}</g>
      <g data-clt-wheel-blur="mechanical" data-clt-wheel-radius="${wheel.radius}" opacity="0">
        <circle r="33.5" fill="none" stroke="#263339" stroke-width="7.5" opacity=".64"/>
        <circle r="22.1" fill="none" stroke="#a7b2af" stroke-width="3.8" opacity=".55"/>
        <circle r="9.2" fill="none" stroke="#8a9b9d" stroke-width="1.6" opacity=".28"/>
      </g>
      <circle data-clt-wheel-light="" r="49" fill="url(#${id}-fixed-light)"/>
    </g>`;
  }

  function markup(input) {
    const { id } = options(input);
    return `<g data-clt-wheels="${id}" aria-hidden="true" pointer-events="none">${wheels.map(wheel => wheelMarkup(id, wheel)).join('\n')}</g>`;
  }

  function angleForDistance(distance, radius) {
    if (!Number.isFinite(distance) || !Number.isFinite(radius) || radius <= 0) {
      throw new TypeError('CLTWheels requires a finite distance and a positive finite radius.');
    }
    const circumference = 2 * Math.PI * radius;
    const angle = distance % circumference / circumference * 360;
    return Object.is(angle, -0) ? 0 : angle;
  }

  function blurForTravel(distance, radius, elapsedMs) {
    const degrees = Math.abs(distance) / radius * 180 / Math.PI;
    // A fixed reference exposure handles normal speed, while the frame sweep
    // also suppresses repeated bolt patterns after dropped frames or jumps.
    const sweep = Math.max(degrees * 16 / Math.max(1, elapsedMs), degrees * .8);
    const amount = Math.max(0, Math.min(1, (sweep - 12) / 78));
    return amount * amount * (3 - 2 * amount);
  }

  function setAttributeIfChanged(node, name, value) {
    if (node.getAttribute(name) === value) return 0;
    node.setAttribute(name, value);
    return 1;
  }

  function update(element, distance, elapsedMs = 16) {
    if (!element || typeof element.querySelectorAll !== 'function') {
      throw new TypeError('CLTWheels.update requires an SVG scene or truck group.');
    }
    if (!Number.isFinite(distance)) throw new TypeError('CLTWheels distance must be finite.');
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
      throw new TypeError('CLTWheels elapsedMs must be finite and nonnegative.');
    }
    const previousDistance = previousDistances.get(element);
    const travelled = elapsedMs === 0 || previousDistance === undefined ? 0 : distance - previousDistance;
    let changed = 0;
    for (const rotor of element.querySelectorAll('[data-clt-wheel-rotor]')) {
      const radius = Number(rotor.getAttribute('data-clt-wheel-radius'));
      const angle = angleForDistance(distance, radius);
      const blur = blurForTravel(travelled, radius, elapsedMs);
      changed += setAttributeIfChanged(rotor, 'transform', `rotate(${angle})`);
      changed += setAttributeIfChanged(rotor, 'opacity', String(1 - .94 * blur));
    }
    for (const rings of element.querySelectorAll('[data-clt-wheel-blur]')) {
      const radius = Number(rings.getAttribute('data-clt-wheel-radius'));
      // Validate before blur computation, including a malformed SVG subtree.
      angleForDistance(0, radius);
      const blur = blurForTravel(travelled, radius, elapsedMs);
      changed += setAttributeIfChanged(rings, 'opacity', String(.9 * blur));
    }
    previousDistances.set(element, distance);
    return changed;
  }

  const api = Object.freeze({ defs, markup, update, angleForDistance, wheels, ground, imageWidth, imageHeight });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CLTWheels = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
