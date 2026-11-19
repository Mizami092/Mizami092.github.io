/* Christmas letter. All scene geometry is drawn with printable ASCII glyphs. */
(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { alpha: true });
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
  const state = { rotating: true, snow: true, glow: true, music: false, angle: .15, time: 0, rotationTime: 0, zoom: 1, targetZoom: 1, drag: 0, targetDrag: 0 };
  let width = innerWidth, height = innerHeight, dpr = 1, scale = 100, centerX = 0, centerY = 0;
  let mobile = width <= 760, lastFrame = 0, frameId, lastBurstCycle = -1, message = '刘博雅全世界最可爱';
  let pointId = 0, pointer = null, previousSecretOpacity = 0;
  // One clock controls bottom-up growth, the personal message, and their fade.
  const growthSpeed = 2;
  const cycleTiming = Object.freeze({ duration: 24, growStart: .5 / growthSpeed, growEnd: 12.5 / growthSpeed, fadeStart: 18, fadeEnd: 22 });
  function getLifecycle(time) {
    const phase = time % cycleTiming.duration;
    const growth = clamp((phase - cycleTiming.growStart) / (cycleTiming.growEnd - cycleTiming.growStart));
    const fade = smooth((phase - cycleTiming.fadeStart) / (cycleTiming.fadeEnd - cycleTiming.fadeStart));
    return { phase, cycle: Math.floor(time / cycleTiming.duration), growth, fade, opacity: 1 - fade, revealHeight: -.28 + growth * 5.95 };
  }
  function revealAt(y, life, variation = 0) {
    return smooth((life.revealHeight - y + variation) / .28);
  }
  let lifecycle = getLifecycle(state.rotationTime);
  let rngState = 251225;
  function random() { rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0; return rngState / 4294967296; }
  const pick = a => a[Math.floor(random() * a.length)];
  const glyphs = 'AVYvxywX+*.:;|/\\#@oO=-<>~';
  const colors = [
    '#66c998', '#39ae82', '#86d7ad', '#309d81', '#61bcac', '#b0d8a1', '#258e74', '#a6b978',
    '#ffe3a1', '#efc46d', '#c08e49', '#fff4cf', '#f394a5', '#c35d79', '#82b7e5', '#b5a1e0',
    '#b47e4f', '#e1b575', '#9d734b', '#839a9a', '#f0ded0', '#e0b665', '#74b9bd', '#d2736a'
  ];
  const points = [], projected = [], snowflakes = [], sparks = [], stars = [];
  const tileW = 28, tileH = 34, atlasCols = glyphs.length;
  const atlas = document.createElement('canvas');
  atlas.width = tileW * atlasCols; atlas.height = tileH * colors.length;
  const atlasCtx = atlas.getContext('2d');
  atlasCtx.textAlign = 'center'; atlasCtx.textBaseline = 'middle';
  atlasCtx.font = '600 25px Consolas, "Courier New", monospace';
  colors.forEach((color, row) => {
    atlasCtx.fillStyle = color;
    [...glyphs].forEach((char, col) => atlasCtx.fillText(char, col * tileW + tileW / 2, row * tileH + tileH / 2 + 1));
  });
  const glowSprite = document.createElement('canvas');
  glowSprite.width = glowSprite.height = 96;
  const glowCtx = glowSprite.getContext('2d');
  const glowGradient = glowCtx.createRadialGradient(48, 48, 0, 48, 48, 48);
  glowGradient.addColorStop(0, 'rgba(255,225,150,.9)');
  glowGradient.addColorStop(.12, 'rgba(255,203,99,.48)');
  glowGradient.addColorStop(.36, 'rgba(242,172,61,.12)');
  glowGradient.addColorStop(1, 'rgba(241,167,57,0)');
  glowCtx.fillStyle = glowGradient; glowCtx.fillRect(0, 0, 96, 96);

  function add(x, y, z, color, chars, kind = 'leaf', size = 1, glow = 0) {
    const char = pick(chars);
    points.push({ x, y, z, color, char: Math.max(0, glyphs.indexOf(char)), kind, size, glow, phase: random() * TAU, id: pointId++ });
  }
  const tiers = [
    { base: .94, height: 1.53, radius: 1.49 }, { base: 1.58, height: 1.51, radius: 1.26 },
    { base: 2.22, height: 1.47, radius: 1.04 }, { base: 2.86, height: 1.39, radius: .81 },
    { base: 3.5, height: 1.2, radius: .57 }, { base: 4.08, height: .66, radius: .31 }
  ];
  function radiusAt(y) {
    let r = .022;
    for (const tier of tiers) if (y >= tier.base && y <= tier.base + tier.height) r = Math.max(r, tier.radius * (1 - (y - tier.base) / tier.height));
    return r;
  }
  // Ring sampling gives each tier volume, rather than a flat triangle silhouette.
  for (let y = .95, row = 0; y <= 4.72; y += .047, row++) {
    const r = radiusAt(y);
    const count = Math.max(6, Math.round(TAU * r / .068));
    for (let j = 0; j < count; j++) {
      const a = j / count * TAU + row * .42;
      const rr = r * (1 + .018 * Math.sin(a * 9 + y * 16)) + (random() - .5) * .027;
      const palette = [0, 0, 1, 1, 2, 3, 4, 5, 6, 7];
      add(Math.cos(a) * rr, y + (random() - .5) * .018, Math.sin(a) * rr, pick(palette), 'AVYvyx+/:;', 'leaf', .83 + random() * .25);
      if (j % 9 === 0) add(Math.cos(a) * rr * .76, y - .013, Math.sin(a) * rr * .76, 6, 'xv:;', 'inner', .85);
    }
  }
  // The gold garland is a real helix; its back arcs pass behind the foliage.
  for (let i = 0; i < 490; i++) {
    const t = i / 489, y = 1.01 + t * 3.65, a = t * TAU * 4.45 + .65, r = radiusAt(y) + .052;
    add(Math.cos(a) * r, y, Math.sin(a) * r, i % 7 === 0 ? 11 : 8 + (i % 3 === 0 ? 1 : 0), '+*o:.', 'light', .93, i % 3 === 0 ? .8 : .2);
  }
  for (let i = 0; i < 30; i++) {
    const y = 1.12 + random() * 3.3, a = i * 2.39996, r = radiusAt(y) + .05;
    const ox = Math.cos(a) * r, oz = Math.sin(a) * r, color = [12, 13, 14, 15, 21, 22, 23][i % 7];
    const radius = .055 + random() * .037;
    for (let ring = 0; ring < 5; ring++) {
      const v = ring / 4 * Math.PI;
      for (let k = 0; k < 8; k++) {
        const u = k / 8 * TAU;
        add(ox + Math.cos(u) * Math.sin(v) * radius, y + Math.cos(v) * radius, oz + Math.sin(u) * Math.sin(v) * radius, k % 5 === 0 ? 11 : color, 'o*+@', 'ornament', 1.06, k === 0 && ring === 2 ? .55 : 0);
      }
    }
  }
  // A visible cylindrical trunk and eight branching, thick roots.
  for (let y = .13; y <= 1.16; y += .044) for (let j = 0; j < 23; j++) {
    const a = j / 23 * TAU, r = .16 + .025 * Math.sin(y * 8 + a * 3);
    add(Math.cos(a) * r, y, Math.sin(a) * r, j % 4 === 0 ? 17 : 16 + j % 3, '|H#x', 'trunk', 1.04);
  }
  for (let branch = 0; branch < 8; branch++) for (let i = 0; i < 26; i++) {
    const t = i / 25, a = branch / 8 * TAU + .2 * Math.sin(t * 4 + branch), r = .12 + .68 * t;
    for (let thick = -1; thick <= 1; thick++) add(Math.cos(a) * r + thick * .023, .07 + .17 * (1 - t) ** 1.8, Math.sin(a) * r, thick === 0 ? 17 : 18, '#x/\\-', 'root', 1.02);
  }
  // Extruded five-point star: front face, rear face, and sampled side walls.
  const starVertices = Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI / 2 + i / 10 * TAU, r = i % 2 === 0 ? .345 : .15;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  function insideStar(x, y) {
    let inside = false;
    for (let i = 0, j = 9; i < 10; j = i++) {
      const [xi, yi] = starVertices[i], [xj, yj] = starVertices[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  for (let x = -.34; x <= .34; x += .029) for (let y = -.3; y <= .345; y += .032) if (insideStar(x, y)) {
    add(x, 5.03 + y, .093, 8, '*+x', 'star', .95, .17);
    add(x, 5.03 + y, -.093, 9, '*+x', 'star', .92, .12);
  }
  for (let i = 0; i < 10; i++) {
    const a = starVertices[i], b = starVertices[(i + 1) % 10];
    for (let s = 0; s < 13; s++) for (let z = -.09; z <= .091; z += .06) {
      const t = s / 12;
      add(a[0] + (b[0] - a[0]) * t, 5.03 + a[1] + (b[1] - a[1]) * t, z, 11, '*+:', 'star', 1.02, s % 4 === 0 ? .55 : .1);
    }
  }
  // Gift boxes are sampled on all six faces, including ribbon bands and 3D bows.
  function gift(cx, cz, w, h, d, color, turn) {
    const co = Math.cos(turn), si = Math.sin(turn);
    function put(x, y, z, top = false) {
      const ribbon = Math.abs(x) < .049 || Math.abs(z) < .045;
      const edge = Math.abs(Math.abs(x) - w / 2) < .02 || Math.abs(Math.abs(z) - d / 2) < .02;
      const c = ribbon ? 8 : top ? (color === 13 ? 12 : color) : color;
      add(cx + x * co + z * si, y + .07, cz + z * co - x * si, c, ribbon ? '+x#' : edge ? '+#x' : 'x:;o', 'gift', .97, ribbon && random() > .72 ? .45 : 0);
    }
    for (let x = -w / 2; x <= w / 2 + .005; x += .057) for (let y = 0; y <= h; y += .055) { put(x, y, -d / 2); put(x, y, d / 2); }
    for (let z = -d / 2; z <= d / 2 + .005; z += .057) for (let y = 0; y <= h; y += .055) { put(-w / 2, y, z); put(w / 2, y, z); }
    for (let x = -w / 2; x <= w / 2 + .005; x += .055) for (let z = -d / 2; z <= d / 2 + .005; z += .055) put(x, h, z, true);
    for (const side of [-1, 1]) for (let i = 0; i < 38; i++) {
      const a = i / 38 * TAU, x = side * .12 * (1 - Math.cos(a)), y = h + .065 + .08 * Math.sin(a), z = .055 * Math.sin(a * 2);
      add(cx + x * co + z * si, y + .07, cz + z * co - x * si, 8, '*+ox', 'bow', .95, i % 8 === 0 ? .55 : 0);
    }
  }
  gift(-1.27, .34, .57, .48, .5, 13, -.26);
  gift(.99, .83, .48, .54, .47, 14, .33);
  gift(1.4, -.22, .61, .38, .47, 21, -.2);
  gift(-.64, -1.09, .43, .54, .43, 15, .5);
  gift(.3, 1.37, .37, .32, .35, 23, .1);
  gift(.56, -1.3, .52, .4, .47, 22, -.3);
  // Ground is also a field of ASCII dots; no solid model or polygon is drawn.
  for (let i = 0; i < 630; i++) {
    const a = random() * TAU, r = .6 + Math.sqrt(random()) * 1.48;
    add(Math.cos(a) * r, .015, Math.sin(a) * r, 19, '.:=-', 'ground', .62 + random() * .25);
  }
  for (let i = 0; i < 100; i++) stars.push({ x: random(), y: random(), phase: random() * TAU, size: .5 + random() * 1.2 });
  // The snow alone is a 12 fps, nearest-neighbor pixel layer. Tree motion stays smooth.
  const SNOW_FPS = 12, SNOW_PIXEL_SIZE = 2;
  const snowLayer = document.createElement('canvas');
  const snowCtx = snowLayer.getContext('2d');
  const snowColors = ['#b4ceda', '#d9e2e8', '#b6bbdf', '#e3d1d9', '#d4e3da'];
  const snowPatterns = [
    ['1'],
    ['010', '111', '010'],
    ['10101', '01110', '11111', '01110', '10101']
  ];
  let snowAccumulator = 0, snowTime = 0, snowFrame = 0;
  function paintSnow() {
    snowCtx.clearRect(0, 0, snowLayer.width, snowLayer.height);
    for (const snow of snowflakes) {
      const pattern = snowPatterns[snow.kind];
      const x = Math.round(snow.x / SNOW_PIXEL_SIZE), y = Math.round(snow.y / SNOW_PIXEL_SIZE);
      const flicker = ((snowFrame + snow.id * 7) % 23 < 3) ? .5 : 1;
      snowCtx.globalAlpha = (.19 + snow.z * .51) * flicker;
      snowCtx.fillStyle = snowColors[snow.color];
      const half = Math.floor(pattern.length / 2);
      for (let row = 0; row < pattern.length; row++) for (let col = 0; col < pattern[row].length; col++) {
        if (pattern[row][col] === '1') snowCtx.fillRect(x + col - half, y + row - half, 1, 1);
      }
    }
  }
  function seedSnow() {
    snowflakes.length = 0;
    snowLayer.width = Math.ceil(width / SNOW_PIXEL_SIZE);
    snowLayer.height = Math.ceil(height / SNOW_PIXEL_SIZE);
    snowAccumulator = 0; snowTime = 0; snowFrame = 0;
    const count = clamp(Math.round(width * height / 1250), 320, 1600);
    for (let i = 0; i < count; i++) {
      const z = random(), shape = random();
      snowflakes.push({ id: i, x: random() * width, y: random() * height, z, phase: random() * TAU, kind: shape > .96 ? 2 : shape > .76 ? 1 : 0, color: i % snowColors.length, speed: 15 + z * 29 });
    }
    paintSnow();
  }
  function drawSnow(dt) {
    snowAccumulator += dt;
    const step = 1 / SNOW_FPS;
    const frames = Math.floor((snowAccumulator + 1e-9) / step);
    if (frames > 0) {
      const elapsed = frames * step;
      snowAccumulator -= elapsed; snowTime += elapsed; snowFrame += frames;
      for (const snow of snowflakes) {
        snow.y += elapsed * snow.speed;
        snow.x += elapsed * (5 + Math.sin(snowTime * .65 + snow.phase) * (6 + snow.z * 8));
        if (snow.y > height + 12) { snow.y = -12; snow.x = random() * width; }
        if (snow.x > width + 12) snow.x = -12;
        if (snow.x < -12) snow.x = width + 12;
      }
      paintSnow();
    }
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(snowLayer, 0, 0, snowLayer.width * SNOW_PIXEL_SIZE, snowLayer.height * SNOW_PIXEL_SIZE);
    ctx.restore();
  }
  // Fit the full model above the greeting, including foreground gift perspective
  // at every yaw angle, so rotation never pushes boxes over the blessing.
  const modelExtents = { top: 0, bottom: 0 };
  const tiltSin = Math.sin(.105), tiltCos = Math.cos(.105);
  for (const point of points) {
    if (point.kind === 'ground') continue;
    const dy = point.y - 2.6, radius = Math.hypot(point.x, point.z);
    for (const z of [-radius, radius]) {
      const perspective = 9.3 / (9.3 - dy * tiltSin - z * tiltCos);
      const vertical = (dy * tiltCos - z * tiltSin) * perspective;
      const padding = .056 * point.size * perspective;
      modelExtents.top = Math.max(modelExtents.top, vertical + padding);
      modelExtents.bottom = Math.max(modelExtents.bottom, -vertical + padding);
    }
  }
  function resize() {
    width = innerWidth; height = innerHeight; mobile = width <= 760;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    centerX = width * .5;
    const stageTop = Math.max(28, height * .055);
    const stageBottom = document.querySelector('.greeting').getBoundingClientRect().top - 18;
    const stageHeight = Math.max(180, stageBottom - stageTop);
    const modelHeight = modelExtents.top + modelExtents.bottom;
    scale = Math.min(stageHeight / modelHeight, width * (mobile ? .25 : .21));
    centerY = stageTop + (stageHeight - modelHeight * scale) / 2 + modelExtents.top * scale;
    seedSnow();
    fitMessage();
  }
  function project(x, y, z, angle) {
    const co = Math.cos(angle), si = Math.sin(angle), rx = x * co + z * si, rz = z * co - x * si;
    const dy = y - 2.6, tilt = .105, py = dy * Math.cos(tilt) - rz * Math.sin(tilt), depth = dy * Math.sin(tilt) + rz * Math.cos(tilt);
    const perspective = 9.3 / (9.3 - depth), s = scale * state.zoom * perspective;
    return { x: centerX + rx * s, y: centerY - py * s, depth, p: perspective, rz, rx, dy };
  }
  function drawGlyph(charIndex, colorIndex, x, y, size, alpha) {
    if (alpha < .025 || x < -size || x > width + size || y < -size || y > height + size) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(atlas, charIndex * tileW, colorIndex * tileH, tileW, tileH, x - size * .5, y - size * .607, size, size * 1.214);
  }
  function drawGlow(x, y, size, alpha) {
    if (!state.glow) return;
    ctx.globalAlpha = clamp(alpha);
    ctx.drawImage(glowSprite, x - size / 2, y - size / 2, size, size);
  }
  function drawBackground(dt) {
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#adbdba';
    for (const s of stars) {
      ctx.globalAlpha = .1 + .16 * (.5 + .5 * Math.sin(Math.floor(state.time * SNOW_FPS) / SNOW_FPS * .45 + s.phase));
      ctx.fillRect(s.x * width, s.y * height, s.size, s.size);
    }
    if (state.glow) {
      const floor = project(0, .03, 0, state.angle);
      ctx.save(); ctx.translate(centerX, floor.y); ctx.scale(1, .2);
      const rad = scale * 2.3;
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
      gradient.addColorStop(0, 'rgba(136,114,57,.105)'); gradient.addColorStop(.5, 'rgba(74,103,76,.045)'); gradient.addColorStop(1, 'rgba(30,55,42,0)');
      ctx.globalAlpha = lifecycle.opacity * revealAt(.02, lifecycle); ctx.fillStyle = gradient; ctx.fillRect(-rad, -rad, rad * 2, rad * 2); ctx.restore();
      const star = project(0, 5.03, 0, state.angle);
      drawGlow(star.x, star.y, scale * 1.9, (.3 + .06 * Math.sin(state.time * 1.8)) * revealAt(5.1, lifecycle) * lifecycle.opacity);
    }
    drawSnow(dt);
  }
  function drawTree() {
    projected.length = 0;
    for (const point of points) {
      // Mobile thins interior needles, while preserving the star, roots, and gifts.
      if (mobile && (point.kind === 'inner' || (point.kind === 'leaf' && point.id % 5 === 0))) continue;
      const reveal = revealAt(point.y, lifecycle, Math.sin(point.phase) * .045);
      const visibility = reveal * lifecycle.opacity;
      if (visibility < .008) continue;
      // New characters lift into place at the advancing height frontier.
      const spread = 1 + lifecycle.fade * .065;
      const pos = project(point.x * spread, point.y - (1 - reveal) * .11 + lifecycle.fade * .16, point.z * spread, state.angle);
      const face = clamp(.5 + pos.rz / (Math.hypot(point.x, point.z) * 2 + .03));
      let alpha = .24 + face * .69;
      if (point.kind === 'leaf') alpha *= .78 + .2 * Math.sin(point.phase + state.time * .5);
      if (point.kind === 'inner') alpha *= .38;
      if (point.kind === 'light') alpha = .2 + face * .8;
      if (point.kind === 'star') alpha = .66 + .28 * Math.sin(state.time * 2 + point.phase) ** 2;
      if (point.kind === 'trunk' || point.kind === 'root') alpha = .57 + face * .4;
      if (point.kind === 'ground') alpha *= .26;
      if (point.kind === 'gift' || point.kind === 'bow') alpha = .4 + face * .6;
      alpha *= visibility;
      const twinkle = .72 + .28 * Math.sin(state.time * 2.3 + point.phase) ** 4;
      const size = Math.max(3, scale * .092 * state.zoom * pos.p * point.size);
      projected.push({ point, pos, alpha, size, twinkle });
    }
    projected.sort((a, b) => a.pos.depth - b.pos.depth);
    for (const { point, pos, alpha, size, twinkle } of projected) {
      if (point.glow && state.glow) drawGlow(pos.x, pos.y, size * (point.kind === 'star' ? 3.2 : 3.8), point.glow * alpha * twinkle * .45);
      drawGlyph(point.char, point.color, pos.x, pos.y, size, alpha * (point.glow ? twinkle : 1));
    }
    ctx.globalAlpha = 1;
  }
  function spawnBurst(x, y, count = 45, broad = false) {
    for (let i = 0; i < count; i++) {
      const a = random() * TAU, velocity = 13 + random() * 55;
      sparks.push({ x: x + (broad ? (random() - .5) * Math.min(width * .45, 480) : 0), y: y + (random() - .5) * 20, vx: Math.cos(a) * velocity, vy: -12 - random() * 38, life: 1.5 + random() * 1.6, max: 3.1, char: glyphs.indexOf(pick('*+x.')), size: 5 + random() * 6 });
    }
  }
  function drawSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += dt * 5; s.life -= dt;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      drawGlow(s.x, s.y, s.size * 4, s.life / s.max * .4);
      drawGlyph(s.char, 8, s.x, s.y, s.size, Math.min(1, s.life / .7));
    }
  }
  const secret = document.getElementById('secret'), messageNode = document.getElementById('secret-message');
  let letterNodes = [];
  function fitMessage() {
    if (!messageNode) return;
    const max = mobile ? width * .9 : Math.min(760, width * .72);
    const count = Math.max(1, [...message].reduce((n, char) => n + (char.codePointAt(0) > 255 ? 1 : .57), 0));
    const size = Math.min(mobile ? 29 : width * .0265, max / (count * 1.18), 42);
    messageNode.style.fontSize = `${size}px`;
  }
  function setMessage() {
    messageNode.replaceChildren();
    letterNodes = [...message].map(char => {
      const span = document.createElement('span');
      span.textContent = char;
      messageNode.append(span);
      return span;
    });
    document.getElementById('accessible-wish').textContent = message;
    fitMessage();
  }
  function updateMessage() {
    const { phase, cycle, fade, opacity: sceneOpacity } = lifecycle;
    const revealPhase = phase * growthSpeed;
    const opacity = smooth((revealPhase - 2.7) / 1.3) * sceneOpacity;
    secret.style.opacity = opacity.toFixed(3);
    if (opacity > .001 || previousSecretOpacity > .001) {
      const drift = Math.sin((phase - 5) * .16) * 7;
      secret.style.transform = `translate(-50%, calc(-50% + ${drift}px)) perspective(900px) rotateY(${Math.sin((phase - 8) * .16) * 7}deg)`;
      const stagger = Math.min(1.05, 8 / Math.max(1, letterNodes.length - 1));
      letterNodes.forEach((letter, i) => {
        const reveal = smooth((revealPhase - 3.1 - i * stagger) / 1.35);
        const dissolve = smooth((phase - cycleTiming.fadeStart - i * .045) / 3.2);
        letter.style.opacity = (reveal * (1 - dissolve)).toFixed(3);
        letter.style.transform = `translate3d(${dissolve * (i - letterNodes.length / 2) * 3}px,${(1 - reveal) * 13 - dissolve * 20}px,0) rotateY(${(1 - reveal) * 45}deg)`;
        letter.style.filter = `blur(${((1 - reveal) * 3 + dissolve * 2).toFixed(1)}px)`;
      });
    }
    if (fade > .15 && fade < .8 && lastBurstCycle !== cycle) {
      lastBurstCycle = cycle;
      spawnBurst(centerX, height * (mobile ? .53 : .54), mobile ? 32 : 60, true);
    }
    previousSecretOpacity = opacity;
  }
  let previousTimestamp = 0;
  function animate(timestamp) {
    const dt = previousTimestamp ? Math.min((timestamp - previousTimestamp) / 1000, .06) : 0;
    previousTimestamp = timestamp;
    state.time += dt;
    state.rotationTime += dt;
    state.drag += (state.targetDrag - state.drag) * Math.min(1, dt * 9);
    state.zoom += (state.targetZoom - state.zoom) * Math.min(1, dt * 7);
    state.angle = .15 + state.rotationTime * TAU / 38 + state.drag;
    lifecycle = getLifecycle(state.rotationTime);
    drawBackground(dt); drawTree(); drawSparks(dt); updateMessage();
    lastFrame = timestamp;
    frameId = requestAnimationFrame(animate);
  }
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    pointer = { id: e.pointerId, start: e.clientX, x: e.clientX, y: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    const dx = e.clientX - pointer.x;
    if (Math.abs(e.clientX - pointer.start) > 4) pointer.moved = true;
    state.targetDrag += dx * .007; pointer.x = e.clientX;
  });
  canvas.addEventListener('pointerup', e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    if (!pointer.moved) spawnBurst(e.clientX, e.clientY, 26);
    pointer = null;
  });
  canvas.addEventListener('pointercancel', () => { pointer = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); state.targetZoom = clamp(state.targetZoom - e.deltaY * .0005, .78, 1.22); }, { passive: false });

  // Play the supplied MP3 as-is, from its beginning, using one native loop.
  const backgroundMusic = document.getElementById('background-music');
  let musicStarts = 0, audioError = null;
  backgroundMusic.volume = .6;
  backgroundMusic.addEventListener('playing', () => {
    if (!state.music) musicStarts++;
    state.music = true;
    audioError = null;
  });
  backgroundMusic.addEventListener('pause', () => { state.music = false; });
  backgroundMusic.addEventListener('error', () => {
    state.music = false;
    audioError = backgroundMusic.error?.message || 'Background music could not be loaded';
  });
  function startBackgroundMusic() {
    if (!backgroundMusic.paused && !backgroundMusic.ended) return;
    const attempt = backgroundMusic.play();
    if (attempt) attempt.catch(error => {
      // A blocked automatic attempt is retried by the first page interaction.
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') audioError = error.message;
    });
  }
  // No buttons or overlays: first contact unlocks sound if autoplay is blocked.
  document.addEventListener('pointerdown', startBackgroundMusic, { capture: true, passive: true });
  document.addEventListener('click', startBackgroundMusic, { capture: true, passive: true });
  document.addEventListener('touchend', startBackgroundMusic, { capture: true, passive: true });
  document.addEventListener('keydown', startBackgroundMusic, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(frameId);
    else {
      previousTimestamp = 0;
      frameId = requestAnimationFrame(animate);
      startBackgroundMusic();
    }
    // The supplied track intentionally keeps playing while the page is hidden.
  });
  window.addEventListener('resize', resize);
  setMessage(); resize(); frameId = requestAnimationFrame(animate);
  startBackgroundMusic();
  // Read-only diagnostics for checking the local display and autoplay fallback.
  Object.defineProperty(window, 'christmasScene', { value: Object.freeze({ getState: () => ({
    ...state, width, height, mobile, centerX, centerY,
    lifecycle: { ...lifecycle },
    snow: { count: snowflakes.length, fps: SNOW_FPS, pixelSize: SNOW_PIXEL_SIZE, frame: snowFrame },
    audio: { state: backgroundMusic.paused ? 'paused' : 'playing', source: backgroundMusic.getAttribute('src'), loop: backgroundMusic.loop, durationSeconds: Number.isFinite(backgroundMusic.duration) ? backgroundMusic.duration : 0, currentTime: backgroundMusic.currentTime, starts: musicStarts, error: audioError },
    visibleTop: projected.reduce((top, p) => Math.max(top, p.point.y), 0),
    sceneBottom: projected.reduce((bottom, p) => p.point.kind === 'ground' ? bottom : Math.max(bottom, p.pos.y + p.size * .607), 0),
    pointCount: points.length, visiblePoints: projected.length, message, frameTimestamp: lastFrame,
    asciiOnly: points.every(p => glyphs.charCodeAt(p.char) >= 32 && glyphs.charCodeAt(p.char) <= 126)
  }) }) });
})();
