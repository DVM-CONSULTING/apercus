/*
 * Pied de page : le grand « CLT// » dessiné en milliers de points (WebGL).
 * Ordinateur : la souris (un cercle) écarte les points, qui reviennent doucement à leur place.
 * Téléphone : le doigt les disperse (toucher ou glisser sur le côté) ; le défilement vertical reste libre.
 * À l'arrivée en bas de page, un passage automatique anime le logo. Animations réduites : points immobiles.
 * Sans WebGL, le texte « CLT// » d'origine reste affiché.
 */
(function (root) {
  'use strict';
  const SPRING = .0026, DAMPING = .915, REST = .04;

  /** Points d'une grille régulière posés là où le texte est dessiné (rgba : pixels du texte). */
  function dotGrid(rgba, width, height, step) {
    const xs = [], ys = [], red = [];
    for (let y = step / 2; y < height; y += step) {
      for (let x = step / 2; x < width; x += step) {
        const i = (Math.floor(y) * width + Math.floor(x)) * 4;
        if (rgba[i + 3] < 128) continue;
        xs.push(x); ys.push(y); red.push(rgba[i] > 150 && rgba[i + 1] < 110 ? 1 : 0);
      }
    }
    return { xs, ys, red };
  }

  /** État de la simulation : position, vitesse et place d'origine de chaque point. */
  function createState(grid, offsetX = 0, offsetY = 0) {
    const n = grid.xs.length, home = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { home[i * 2] = grid.xs[i] + offsetX; home[i * 2 + 1] = grid.ys[i] + offsetY; }
    return { n, home, pos: Float32Array.from(home), vel: new Float32Array(n * 2), seed: 1 };
  }

  /** Hasard reproductible (les tests rejouent la même dispersion). */
  function random(state) { state.seed = (state.seed * 16807) % 2147483647; return state.seed / 2147483647; }

  /**
   * Une image de simulation (dt = 1 à 60 images/s).
   * pushers : [{ x, y, vx, vy, radius, strength }] — souris, doigt ou passage automatique.
   * Renvoie le plus grand écart restant, pour arrêter la boucle quand tout est revenu en place.
   */
  function stepDots(state, pushers, dt = 1) {
    const { n, home, pos, vel } = state, damping = Math.pow(DAMPING, dt);
    let restless = 0;
    for (let i = 0; i < n; i++) {
      const ix = i * 2, iy = ix + 1;
      let vx = vel[ix], vy = vel[iy];
      for (const p of pushers) {
        const dx = pos[ix] - p.x, dy = pos[iy] - p.y, d2 = dx * dx + dy * dy, r = p.radius;
        if (d2 >= r * r) continue;
        const d = Math.sqrt(d2) + .001, f = (1 - d / r) * (1 - d / r) * p.strength * dt;
        // Poussée vers l'extérieur, entraînée par le mouvement, avec un peu de hasard : les points s'éparpillent comme de la poussière.
        vx += (dx / d) * f + p.vx * .05 * f + (random(state) - .5) * f * 1.6;
        vy += (dy / d) * f + p.vy * .05 * f + (random(state) - .5) * f * 1.6;
      }
      vx = (vx + (home[ix] - pos[ix]) * SPRING * dt) * damping;
      vy = (vy + (home[iy] - pos[iy]) * SPRING * dt) * damping;
      pos[ix] += vx * dt; pos[iy] += vy * dt;
      vel[ix] = vx; vel[iy] = vy;
      const off = Math.abs(home[ix] - pos[ix]) + Math.abs(home[iy] - pos[iy]) + Math.abs(vx) + Math.abs(vy);
      if (off > restless) restless = off;
    }
    return restless;
  }

  /** Remet chaque point exactement à sa place (fin d'animation, animations réduites). */
  function settle(state) { state.pos.set(state.home); state.vel.fill(0); }

  /** Passage automatique : un balayage de gauche à droite qui ondule (t de 0 à 1). */
  function sweepPoint(t, width, top, height) {
    return { x: -.08 * width + 1.16 * width * t, y: top + height * (.5 + .28 * Math.sin(t * Math.PI * 3)) };
  }

  const api = { dotGrid, createState, stepDots, settle, sweepPoint, SPRING, DAMPING, REST };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.CLTFooterDots = api;

  const footer = document.querySelector('.footer');
  const mark = footer && footer.querySelector('.footer-wordmark');
  if (!mark) return;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine)');
  const reduced = () => media.matches || document.body.classList.contains('motion-reduced');

  let canvas = document.createElement('canvas');
  canvas.className = 'footer-dots';
  canvas.setAttribute('aria-hidden', 'true');

  /* Deux façons de dessiner les points : WebGL d'abord ; si le téléphone n'affiche rien (vérifié en lisant un point),
     un dessin 2D prend le relais. Les points sont les mêmes, l'animation aussi. */
  function webglRenderer(target) {
    const gl = target.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false });
    if (!gl) return null;
    const vertex = 'attribute vec2 p;attribute float c;uniform vec2 r;uniform float s;varying float v;' +
      'void main(){gl_Position=vec4(p.x/r.x*2.-1.,1.-p.y/r.y*2.,0.,1.);gl_PointSize=s;v=c;}';
    const fragment = 'precision mediump float;varying float v;uniform vec3 w;uniform vec3 k;' +
      'void main(){gl_FragColor=vec4(mix(w,k,v),1.);}';
    const shader = (type, source) => { const sh = gl.createShader(type); gl.shaderSource(sh, source); gl.compileShader(sh); return sh; };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);
    const loc = { p: gl.getAttribLocation(program, 'p'), c: gl.getAttribLocation(program, 'c'), r: gl.getUniformLocation(program, 'r'), s: gl.getUniformLocation(program, 's'), w: gl.getUniformLocation(program, 'w'), k: gl.getUniformLocation(program, 'k') };
    const posBuffer = gl.createBuffer(), colorBuffer = gl.createBuffer();
    let n = 0, dpr = 1, height = 0;
    return {
      kind: 'webgl',
      setup(grid, w, h, ratio, dot) {
        n = grid.xs.length; dpr = ratio; height = h;
        gl.viewport(0, 0, target.width, target.height);
        gl.uniform3f(loc.w, .949, .945, .937); // #f2f1ef, comme le logo
        gl.uniform3f(loc.k, .89, .153, .208); // #e32735, les deux barres
        gl.uniform2f(loc.r, w, h);
        gl.uniform1f(loc.s, Math.max(1, dot * ratio));
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(grid.red), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc.c); gl.vertexAttribPointer(loc.c, 1, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(n * 2), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 2, gl.FLOAT, false, 0, 0);
      },
      draw(pos) {
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
        gl.drawArrays(gl.POINTS, 0, n);
      },
      /** Le point (x, y) est-il vraiment dessiné ? Lu juste après le dessin, dans la même image. */
      visible(x, y) {
        const px = new Uint8Array(4);
        gl.readPixels(Math.round(x * dpr), Math.round((height - y) * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return px[3] > 0;
      },
      lost: () => gl.isContextLost()
    };
  }
  function canvasRenderer(target) {
    const ctx = target.getContext('2d');
    if (!ctx) return null;
    let red = [], dot = 2, dpr = 1, w = 0, h = 0;
    return {
      kind: '2d',
      setup(grid, width, height, ratio, size) { red = grid.red; dot = size; dpr = ratio; w = width; h = height; },
      draw(pos) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        for (const pass of [0, 1]) {
          ctx.fillStyle = pass ? '#e32735' : '#f2f1ef';
          for (let i = 0; i < red.length; i++) if (red[i] === pass) ctx.fillRect(pos[i * 2] - dot / 2, pos[i * 2 + 1] - dot / 2, dot, dot);
        }
      },
      visible: () => true,
      lost: () => false
    };
  }
  let renderer = webglRenderer(canvas) || canvasRenderer(canvas);
  if (!renderer) return;
  function useCanvasFallback() {
    const fresh = document.createElement('canvas');
    fresh.className = canvas.className; fresh.setAttribute('aria-hidden', 'true');
    fresh.style.cssText = canvas.style.cssText; fresh.width = canvas.width; fresh.height = canvas.height;
    canvas.replaceWith(fresh); canvas = fresh;
    renderer = canvasRenderer(canvas);
    return renderer;
  }

  const cursor = document.createElement('span');
  cursor.className = 'footer-dots-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  footer.append(canvas, cursor);

  let state = null, size = { w: 0, h: 0, top: 0, markTop: 0, markH: 0, radius: 60, dot: 2 }, frame = 0, last = 0, visible = false;
  let pointer = null, sweep = null, burst = null, lastSweep = -1e9, builtWidth = 0;

  async function build() {
    try { await document.fonts.load('900 100px Archivo'); } catch (_) {}
    const fontSize = parseFloat(getComputedStyle(mark).fontSize);
    const lineHeight = parseFloat(getComputedStyle(mark).lineHeight) || fontSize * 1.1;
    const pad = Math.round(fontSize * .45);
    const w = footer.clientWidth, h = Math.round(mark.offsetHeight + pad * 2);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    size = { w, h, top: mark.offsetTop - pad, markTop: pad, markH: mark.offsetHeight, radius: Math.max(46, fontSize * .2), dot: 0 };
    canvas.style.top = `${size.top}px`; canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    // Le texte est redessiné comme en CSS : Archivo 900 penché, lettres serrées, « // » rouges plus petits.
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    const ctx = off.getContext('2d', { willReadFrequently: true });
    const family = getComputedStyle(mark).fontFamily;
    ctx.font = `900 ${fontSize}px ${family}`;
    const m = ctx.measureText('C');
    const ascent = m.fontBoundingBoxAscent || fontSize * .9, descent = m.fontBoundingBoxDescent || fontSize * .22;
    const baseline = pad + (lineHeight - (ascent + descent)) / 2 + ascent;
    ctx.setTransform(1, 0, -.2, 1, .2 * baseline, 0);
    let x = mark.offsetLeft;
    const draw = (text, px, spacing, color) => {
      ctx.font = `900 ${px}px ${family}`; ctx.fillStyle = color;
      for (const ch of text) { ctx.fillText(ch, x, baseline); x += ctx.measureText(ch).width + spacing * px; }
    };
    draw('CLT', fontSize, -.08, '#fff');
    x += .02 * fontSize * .72;
    draw('//', fontSize * .72, -.18, '#e32735');
    const step = Math.max(3.4, fontSize / 72);
    const grid = dotGrid(ctx.getImageData(0, 0, w, h).data, w, h, step);
    if (grid.xs.length < 40) { mark.classList.remove('footer-dots-ready'); return; } // rien à dessiner : on garde le texte
    state = createState(grid);
    size.dot = step * .56;
    renderer.setup(grid, w, h, dpr, size.dot);
    renderer.draw(state.pos);
    if (!renderer.visible(grid.xs[0], grid.ys[0])) {
      if (!useCanvasFallback()) { mark.classList.remove('footer-dots-ready'); return; }
      renderer.setup(grid, w, h, dpr, size.dot);
    }
    builtWidth = w;
    mark.classList.add('footer-dots-ready');
    paint();
  }

  function paint() { if (state && renderer) renderer.draw(state.pos); }

  function loop(time) {
    frame = 0;
    if (!state) return;
    const dt = last ? Math.min(3, (time - last) / 16.67) : 1;
    last = time;
    const pushers = [];
    if (pointer && pointer.active) pushers.push({ x: pointer.x, y: pointer.y, vx: pointer.vx, vy: pointer.vy, radius: size.radius, strength: 2.6 });
    if (pointer) { pointer.vx *= .7; pointer.vy *= .7; }
    if (sweep) {
      const t = (time - sweep.start) / 1900;
      if (t >= 1) sweep = null;
      else { const p = sweepPoint(t, size.w, size.markTop, size.markH); pushers.push({ x: p.x, y: p.y, vx: 9, vy: 0, radius: size.radius * 1.15, strength: 2.2 }); }
    }
    if (burst) { pushers.push({ ...burst, vx: 0, vy: 0 }); burst = null; }
    const restless = stepDots(state, pushers, dt);
    paint();
    if (restless > REST || pushers.length || sweep) frame = requestAnimationFrame(loop);
    else { settle(state); paint(); last = 0; }
  }
  function wake() { if (!frame && state && !reduced() && visible) { last = 0; frame = requestAnimationFrame(loop); } }

  function local(event) { const r = canvas.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
  mark.addEventListener('pointermove', event => {
    if (reduced() || !state) return;
    const p = local(event);
    pointer = { x: p.x, y: p.y, vx: pointer ? p.x - pointer.x : 0, vy: pointer ? p.y - pointer.y : 0, active: true };
    if (event.pointerType === 'mouse') { cursor.style.transform = `translate3d(${event.clientX - footer.getBoundingClientRect().left}px,${event.clientY - footer.getBoundingClientRect().top}px,0)`; footer.classList.add('footer-dots-hover'); }
    wake();
  }, { passive: true });
  mark.addEventListener('pointerdown', event => {
    if (reduced() || !state) return;
    const p = local(event);
    burst = { x: p.x, y: p.y, radius: size.radius * 1.7, strength: 4.2 };
    wake();
  }, { passive: true });
  const leave = () => { if (pointer) pointer.active = false; footer.classList.remove('footer-dots-hover'); };
  mark.addEventListener('pointerleave', leave);
  mark.addEventListener('pointercancel', leave);
  mark.addEventListener('pointerup', event => { if (event.pointerType !== 'mouse') leave(); });

  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    const now = performance.now();
    if (visible && !reduced() && state && now - lastSweep > 6000) { lastSweep = now; sweep = { start: now + 250 }; wake(); }
  }, { threshold: .45 }).observe(mark);

  function sync() { if (!state) return; if (reduced()) { cancelAnimationFrame(frame); frame = 0; settle(state); paint(); leave(); } }
  media.addEventListener('change', sync);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  canvas.addEventListener('webglcontextlost', () => { cancelAnimationFrame(frame); frame = 0; state = null; canvas.remove(); cursor.remove(); mark.classList.remove('footer-dots-ready'); });
  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (footer.clientWidth !== builtWidth) build(); }, 180); }, { passive: true });
  if (fine.matches) footer.classList.add('footer-dots-fine');
  build();
})(typeof globalThis === 'undefined' ? this : globalThis);
