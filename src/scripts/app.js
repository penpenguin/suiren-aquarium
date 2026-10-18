import { drawBetta } from './fish.js';
import { createAquascape } from './aquascape.js';
import { getLightCycle, getSceneLight } from './lighting.js';

const $ = (id) => document.getElementById(id);
const canvas = $('water');
const ctx = canvas.getContext('2d', { alpha: false });
const tank = $('aquarium');
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let width = 0, height = 0, dpr = 1, dayAquascape, nightAquascape;
let dayBackdrop, nightBackdrop, dayBeams, moonBeams, moteGlow;
let elapsed = 0, lastFrame = 0, lastDrawCost = 0;
let running = false, frameRequest = 0, resizeTimer, controlsTimer;
let paused = reducedMotion.matches;
let clockLight = getLightCycle();
let daylight = clockLight.daylight, twilight = clockLight.twilight;
let foodSequence = 0, feedCooldownUntil = 0, eaten = 0;
const pellets = [], bubbles = [], specks = [], ripples = [], eatSparkles = [];
const pointer = { x: -1000, y: -1000, inside: false, entered: 0, lastCurious: 0 };
const fish = { x: 0, y: 0, vx: 20, vy: 0, size: 1, heading: 0, tilt: 0, turn: 1, speed: 20, mood: 'calm', light: daylight };
let goal = { x: 0, y: 0 }, goalUntil = 0, foodTargetId = null, feedSide = 1, mode = 'wander', restUntil = 0, resting = false, nextBreath = 40;

function makeLayer(w, h, ratio = Math.min(dpr, 1)) {
  const layer = document.createElement('canvas');
  layer.width = Math.max(1, Math.round(w * ratio));
  layer.height = Math.max(1, Math.round(h * ratio));
  const c = layer.getContext('2d');
  c.scale(ratio, ratio);
  return [layer, c];
}

// Broad pigment-like veils are cached at a modest resolution. Fine detail is
// reserved for the fish and plants, giving the open water a softer depth.
function makeBackdrop(isNight) {
  const light = getSceneLight(isNight ? 0 : 1);
  const [layer, c] = makeLayer(width, height, Math.min(dpr, .65));
  let seed = 4317;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const base = c.createLinearGradient(0, 0, width * .16, height);
  const colors = isNight ? ['#173448', '#102e3c', '#0b2632', '#0c252b'] : ['#427575', '#285a5c', '#19484b', '#173a38'];
  colors.forEach((color, i) => base.addColorStop(i / 3, color));
  c.fillStyle = base; c.fillRect(0, 0, width, height);
  const glow = c.createRadialGradient(width * light.sourceX, -height * .08, 0, width * light.sourceX, height * .12, Math.max(width * .66, height * .8));
  glow.addColorStop(0, isNight ? '#a7b7e24b' : '#e1e8be68');
  glow.addColorStop(.4, isNight ? '#647faf16' : '#a5d4b72d');
  glow.addColorStop(1, '#76bcb000');
  c.fillStyle = glow; c.fillRect(0, 0, width, height);
  for (let i = 0; i < 46; i++) {
    const x = random() * width, y = random() * height;
    const radius = Math.max(32, width * (.045 + random() * .14));
    const cloud = c.createRadialGradient(x, y, 0, x, y, radius);
    const pigment = isNight ? (i % 3 ? '39,101,111' : '106,87,139') : (i % 3 ? '140,171,122' : '23,61,69');
    cloud.addColorStop(0, `rgba(${pigment},${.025 + random() * .055})`);
    cloud.addColorStop(1, `rgba(${pigment},0)`);
    c.fillStyle = cloud; c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  // Distant foliage: soft silhouettes behind the sharper planted banks.
  c.filter = `blur(${Math.max(3, width * .006)}px)`;
  for (let i = 0; i < 36; i++) {
    const side = i % 2, x = width * (side ? .76 + random() * .3 : -.07 + random() * .32);
    const top = height * (.24 + random() * .5), lean = (random() - .5) * width * .07;
    const stem = c.createLinearGradient(0, top, 0, height);
    stem.addColorStop(0, isNight ? '#326b681e' : '#799a6330');
    stem.addColorStop(1, isNight ? '#143c475c' : '#254c416b');
    c.strokeStyle = stem; c.lineWidth = 3 + random() * 7;
    c.beginPath(); c.moveTo(x, height * .94); c.bezierCurveTo(x - lean, height * .65, x + lean * 2, top + height * .16, x + lean, top); c.stroke();
    for (let j = 0; j < 5; j++) {
      const y = top + (height * .91 - top) * (j / 6 + .07);
      const reach = (14 + random() * 40) * Math.max(.6, width / 1600);
      c.fillStyle = stem; c.beginPath(); c.ellipse(x + (j % 2 ? reach * .45 : -reach * .45), y, reach, reach * .19, j % 2 ? -.55 : .55, 0, TAU); c.fill();
    }
  }
  c.filter = 'none';
  const edge = c.createLinearGradient(0, 0, width, 0);
  edge.addColorStop(0, '#031c2a77'); edge.addColorStop(.28, '#031c2a00');
  edge.addColorStop(.71, '#031c2a00'); edge.addColorStop(1, '#051b2980');
  c.fillStyle = edge; c.fillRect(0, 0, width, height);
  return layer;
}

function makeLightLayer(isNight) {
  const [layer, c] = makeLayer(width, height, Math.min(dpr, .5));
  c.filter = `blur(${Math.max(8, width * .013)}px)`;
  const beams = isNight ? [[.57, .025, .17], [.65, .06, .23], [.73, .025, .2], [.79, .045, .15]] : [[.24, .05, .25], [.37, .024, .19], [.44, .072, .28], [.56, .02, .21], [.63, .049, .17]];
  for (const [x, spread, strength] of beams) {
    const gradient = c.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `rgba(${isNight ? '177,198,242' : '229,240,197'},${strength})`);
    gradient.addColorStop(.52, `rgba(${isNight ? '139,181,219' : '162,219,191'},${strength * .38})`);
    gradient.addColorStop(1, 'rgba(126,191,185,0)');
    c.fillStyle = gradient;
    const light = getSceneLight(isNight ? 0 : 1);
    const lean = -light.x * .3;
    c.beginPath(); c.moveTo(width * x, -30); c.lineTo(width * (x + spread * .45), -30);
    c.lineTo(width * (x + spread + lean), height); c.lineTo(width * (x - spread * .8 + lean), height); c.closePath(); c.fill();
  }
  c.filter = 'none';
  return layer;
}

function makeMoteGlow() {
  const [layer, c] = makeLayer(40, 40, 1);
  const glow = c.createRadialGradient(20, 20, 0, 20, 20, 20);
  glow.addColorStop(0, '#ddfffabd'); glow.addColorStop(.09, '#b8f2e978');
  glow.addColorStop(.28, '#84c6dc24'); glow.addColorStop(1, '#7dafdf00');
  c.fillStyle = glow; c.fillRect(0, 0, 40, 40);
  return layer;
}

function resize() {
  const rect = tank.getBoundingClientRect();
  const previousWidth = width || rect.width, previousHeight = height || rect.height;
  width = Math.max(1, rect.width); height = Math.max(1, rect.height);
  // A fixed pixel budget keeps high-density and very wide displays economical.
  dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(5000000 / (width * height)));
  canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.max(1, Math.round(height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (fish.x) { fish.x *= width / previousWidth; fish.y *= height / previousHeight; }
  else { fish.x = width * .61; fish.y = height * .43; }
  fish.size = clamp(Math.min(width / 1320, height / 620), .4, 1.7);
  goal = { x: width * .75, y: height * .46 };
  goalUntil = elapsed + 8;
  pellets.forEach(p => { p.x *= width / previousWidth; p.y *= height / previousHeight; });
  ripples.length = 0;
  dayAquascape?.destroy(); nightAquascape?.destroy();
  dayAquascape = createAquascape(width, height, dpr, 1);
  nightAquascape = createAquascape(width, height, dpr, 0);
  dayBackdrop = makeBackdrop(false); nightBackdrop = makeBackdrop(true);
  dayBeams = makeLightLayer(false); moonBeams = makeLightLayer(true);
  moteGlow = makeMoteGlow();
  bubbles.length = 0; specks.length = 0;
  for (let i = 0; i < 27; i++) bubbles.push(makeBubble(true));
  for (let i = 0; i < 64; i++) specks.push({ x: rand(0, width), y: rand(height * .045, height * .94), radius: rand(.35, 1.25), phase: rand(0, TAU), speed: rand(.65, 2.6), alpha: rand(.1, .3), glow: i % 4 === 0 });
  render();
}

function makeBubble(scatter = false) {
  const side = Math.random() > .27 ? .118 : .884;
  return { x: width * side + rand(-12, 12), y: scatter ? rand(25, height * .85) : height * rand(.8, .89), baseX: width * side + rand(-8, 8), radius: rand(1.1, 3.4) * Math.max(.7, fish.size), speed: rand(17, 34), phase: rand(0, TAU), alpha: rand(.17, .4) };
}

function wanderGoal() {
  const margin = 115 * fish.size;
  const crossTank = Math.random() < .45;
  const x = crossTank ? (fish.x > width * .52 ? width * rand(.24, .39) : width * rand(.61, .79)) : fish.x + rand(-width * .22, width * .22);
  goal = { x: clamp(x, margin, width - margin), y: height * rand(.25, .68) };
  goalUntil = elapsed + rand(7, 14);
  mode = 'wander';
  resting = false;
}

function updateFish(dt) {
  const s = fish.size;
  let targetFood = pellets.find(p => p.id === foodTargetId);
  if (!targetFood && pellets.length) {
    let nearest = Infinity;
    for (const p of pellets) { const d = Math.hypot(p.x - fish.x, p.y - fish.y); if (d < nearest) { nearest = d; targetFood = p; } }
    foodTargetId = targetFood.id;
    feedSide = targetFood.x - fish.x > 40 * s ? 1 : targetFood.x - fish.x < -40 * s ? -1 : (fish.turn >= 0 ? 1 : -1);
    const approachX = targetFood.x - feedSide * 56 * s;
    if (approachX < 55 * s || approachX > width - 55 * s) feedSide *= -1;
  }
  let targetSpeed = 35 * s, activeGoal = goal, facingOverride = 0;
  if (targetFood) {
    mode = 'feeding';
    activeGoal = { x: targetFood.x - feedSide * 56 * s, y: targetFood.y + 9 * s };
    const dist = Math.hypot(activeGoal.x - fish.x, activeGoal.y - fish.y);
    targetSpeed = Math.min(116 * s, 18 * s + dist * .8);
    facingOverride = feedSide;
    fish.mood = 'feeding';
  } else {
    foodTargetId = null;
    fish.mood = 'calm';
    if (mode === 'feeding') wanderGoal();
    if (elapsed > nextBreath && mode !== 'surface') {
      mode = 'surface'; goal = { x: clamp(fish.x + 90 * s * Math.sign(fish.turn || 1), 120 * s, width - 120 * s), y: height * .115 };
      goalUntil = elapsed + 12; nextBreath = elapsed + rand(48, 75);
      resting = false;
    }
    if (resting && elapsed >= restUntil) wanderGoal();
    const dist = Math.hypot(goal.x - fish.x, goal.y - fish.y);
    if (dist < 28 * s && !resting) {
      restUntil = elapsed + rand(2.1, 4.2);
      resting = true;
      if (mode === 'surface') { ripples.push({ x: fish.x + fish.turn * 40 * s, y: height * .035, age: 0, size: 10 }); goalUntil = restUntil; }
    }
    if (resting) { targetSpeed = 0; fish.mood = 'rest'; }
    else if (elapsed > goalUntil) { wanderGoal(); activeGoal = goal; }
    else activeGoal = goal;
    if (pointer.inside && elapsed - pointer.entered > 1.8 && elapsed - pointer.lastCurious > 14 && mode === 'wander' && Math.hypot(pointer.x - fish.x, pointer.y - fish.y) < width * .36) {
      goal = { x: clamp(pointer.x - Math.sign(pointer.x - fish.x || 1) * 80 * s, 130 * s, width - 130 * s), y: clamp(pointer.y, height * .2, height * .67) };
      goalUntil = elapsed + 5; pointer.lastCurious = elapsed; activeGoal = goal; restUntil = 0; resting = false;
    }
    targetSpeed *= .86 + Math.sin(elapsed * .48) * .14;
  }

  const dx = activeGoal.x - fish.x, dy = activeGoal.y - fish.y;
  const distance = Math.max(.001, Math.hypot(dx, dy));
  if (!targetFood && distance < 90 * s) targetSpeed *= clamp(distance / (90 * s), .12, 1);
  const response = 1 - Math.exp(-dt * (targetFood ? 2.15 : .9));
  fish.vx = lerp(fish.vx, dx / distance * targetSpeed, response);
  fish.vy = lerp(fish.vy, dy / distance * targetSpeed, response);
  fish.x += fish.vx * dt;
  fish.y += fish.vy * dt + Math.sin(elapsed * 1.25) * .5 * s * dt;
  fish.x = clamp(fish.x, 55 * s, width - 55 * s);
  fish.y = clamp(fish.y, height * .055, height * .78);

  const face = facingOverride || (Math.abs(fish.vx) > 4 * s ? Math.sign(fish.vx) : Math.sign(fish.turn) || 1);
  fish.turn = lerp(fish.turn, face, 1 - Math.exp(-dt * 3.9));
  const tilt = clamp(Math.atan2(fish.vy, Math.max(Math.abs(fish.vx), 23 * s)), -.4, .4);
  fish.tilt = lerp(fish.tilt, tilt * face, 1 - Math.exp(-dt * 2));
  fish.heading = face > 0 ? tilt : Math.PI - tilt;
  fish.speed = lerp(fish.speed, Math.hypot(fish.vx, fish.vy) / s, 1 - Math.exp(-dt * 2));

  if (targetFood) {
    const noseX = fish.x + fish.turn * 59 * s * Math.cos(fish.tilt);
    const noseY = fish.y - 5 * s + fish.turn * 59 * s * Math.sin(fish.tilt);
    const settled = Math.hypot(activeGoal.x - fish.x, activeGoal.y - fish.y) < 22 * s && fish.turn * feedSide > .82;
    if (Math.hypot(targetFood.x - noseX, targetFood.y - noseY) < 24 * s || settled) {
      const idx = pellets.indexOf(targetFood);
      if (idx >= 0) pellets.splice(idx, 1);
      for (let i = 0; i < 5; i++) eatSparkles.push({ x: targetFood.x, y: targetFood.y, vx: rand(-14, 14), vy: rand(-14, 7), age: 0, r: rand(.6, 1.4) });
      eaten++; foodTargetId = null;
    }
  }
}

function update(dt) {
  elapsed += dt;
  const lightResponse = 1 - Math.exp(-dt * .7);
  daylight = lerp(daylight, clockLight.daylight, lightResponse);
  twilight = lerp(twilight, clockLight.twilight, lightResponse);
  fish.light = daylight;
  for (const b of bubbles) {
    b.y -= b.speed * dt;
    b.x = b.baseX + Math.sin(elapsed * 1.2 + b.phase + b.y * .018) * (3 + b.radius);
    if (b.y < height * .023) { if (Math.random() < .18) ripples.push({ x: b.x, y: height * .023, age: 0, size: 2 }); Object.assign(b, makeBubble()); }
  }
  for (const p of specks) { p.x += (p.speed + Math.sin(elapsed * .27 + p.phase)) * dt; p.y -= .5 * dt; if (p.x > width + 20) p.x = -20; if (p.y < 8) p.y = height * .85; }
  for (let i = pellets.length - 1; i >= 0; i--) {
    const p = pellets[i]; p.age += dt;
    p.y += (p.age < 2.5 ? 10 : 6) * fish.size * dt;
    p.x += Math.sin(elapsed * .9 + p.phase) * 1.9 * dt;
    if (p.age > 70 || p.y > height * .86) pellets.splice(i, 1);
  }
  for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].age += dt; if (ripples[i].age > 2.5) ripples.splice(i, 1); }
  for (let i = eatSparkles.length - 1; i >= 0; i--) { const p = eatSparkles[i]; p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.age > .6) eatSparkles.splice(i, 1); }
  updateFish(dt);
}

function drawSurface() {
  const waterline = height * .023;
  ctx.save();
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    for (let x = -10; x <= width + 18; x += 18) {
      const y = waterline + i * 3.2 + Math.sin(x / 120 + elapsed * .45 + i * .9) * 1.3 + Math.sin(x / 47 - elapsed * .23) * .6;
      if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineWidth = i === 0 ? 1 : .65;
    ctx.strokeStyle = `rgba(204,230,226,${(.1 - i * .022) * (.65 + daylight * .35)})`; ctx.stroke();
  }
  ctx.globalAlpha = .045 + daylight * .025;
  ctx.strokeStyle = '#d8e5cf'; ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const x = width * (.11 + i * .096) + Math.sin(elapsed * .14 + i) * 22;
    const y = waterline + 10 + Math.sin(elapsed * .31 + i) * 4;
    ctx.beginPath(); ctx.ellipse(x, y, width * .042, 4 + i % 3, -.04, .2, Math.PI * 1.3); ctx.stroke();
  }
  ctx.restore();
}

function drawBubbles() {
  for (const b of bubbles) {
    const a = b.alpha * clamp((b.y - 5) / 30, 0, 1) * (.7 + daylight * .3);
    ctx.lineWidth = .55; ctx.strokeStyle = `rgba(187,223,225,${a})`;
    ctx.beginPath(); ctx.ellipse(b.x, b.y, b.radius * .87, b.radius, -.12, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(235,244,233,${a * .9})`;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * .7, 3.65, 4.75); ctx.stroke();
    if (b.radius > 2.4) { ctx.fillStyle = `rgba(181,226,223,${a * .1})`; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * .65, 0, TAU); ctx.fill(); }
  }
}

function drawMotes(front) {
  ctx.save();
  for (const p of specks) {
    if (p.glow !== front) continue;
    const x = p.x + Math.sin(elapsed * .23 + p.phase) * 3;
    const shimmer = .63 + Math.sin(elapsed * .38 + p.phase) * .22;
    if (p.glow) {
      const radius = 10 + p.radius * 6;
      ctx.globalAlpha = p.alpha * shimmer * (.65 + (1 - daylight) * .6);
      ctx.drawImage(moteGlow, x - radius, p.y - radius, radius * 2, radius * 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(${p.glow ? '201,239,235' : '196,216,196'},${p.alpha * shimmer * (p.glow ? 1.1 : .65)})`;
    ctx.beginPath(); ctx.arc(x, p.y, p.radius * (p.glow ? .7 : 1), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawIllumination(front = false) {
  ctx.save();
  const drift = Math.sin(elapsed * .095) * width * .004;
  const strength = front ? .18 : .82;
  ctx.globalAlpha = daylight * strength * (.88 + Math.sin(elapsed * .17) * .07);
  ctx.drawImage(dayBeams, drift, 0, width, height);
  ctx.globalAlpha = (1 - daylight) * strength * (.86 + Math.sin(elapsed * .13 + 1) * .07);
  ctx.drawImage(moonBeams, -drift, 0, width, height);
  ctx.restore();
}

function drawAquascape(layer) {
  if (daylight > 0.001) dayAquascape[layer](ctx, elapsed, 1);
  if (daylight < 0.999) {
    ctx.save();
    ctx.globalAlpha = 1 - daylight;
    nightAquascape[layer](ctx, elapsed, 1);
    ctx.restore();
  }
}

function render() {
  if (!width || !dayBackdrop) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(dayBackdrop, 0, 0, width, height);
  if (daylight < .999) { ctx.globalAlpha = 1 - daylight; ctx.drawImage(nightBackdrop, 0, 0, width, height); ctx.globalAlpha = 1; }
  drawIllumination();
  drawAquascape('drawBack');
  drawMotes(false);
  drawBubbles();
  ctx.save();
  ctx.beginPath(); ctx.rect(0, height * .023, width, height); ctx.clip();
  drawBetta(ctx, fish, elapsed, 1);
  ctx.restore();
  for (const p of pellets) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.phase + elapsed * .1);
    const scale = Math.max(.8, fish.size);
    ctx.fillStyle = '#30271150'; ctx.beginPath(); ctx.ellipse(1.5, 2, 3.6 * scale, 2.1 * scale, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c2a26b'; ctx.beginPath(); ctx.ellipse(0, 0, 2.1 * scale, 1.5 * scale, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e4cd9d'; ctx.beginPath(); ctx.ellipse(-.4, -.5, scale, .5 * scale, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  for (const p of eatSparkles) { ctx.fillStyle = `rgba(211,205,163,${.58 * (1 - p.age / .6)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
  drawAquascape('drawFront');
  if (twilight > .001) {
    const warm = ctx.createLinearGradient(0, 0, 0, height * .65);
    warm.addColorStop(0, `rgba(215,155,112,${twilight * .17})`); warm.addColorStop(1, 'rgba(194,144,106,0)');
    ctx.fillStyle = warm; ctx.fillRect(0, 0, width, height * .65);
  }
  drawIllumination(true);
  drawMotes(true);
  for (const r of ripples) {
    for (let i = 0; i < 2; i++) {
      const radius = r.size + r.age * 22 + i * 9;
      ctx.strokeStyle = `rgba(219,234,215,${Math.max(0, (1 - r.age / 2.5) * (.2 - i * .06))})`; ctx.lineWidth = .65;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, radius, radius * .14, 0, 0, TAU); ctx.stroke();
    }
  }
  drawSurface();
}

function frame(timestamp) {
  if (!running) return;
  if (lastFrame && timestamp - lastFrame < 1000 / 60 - 1) { frameRequest = requestAnimationFrame(frame); return; }
  const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .065) : 1 / 60;
  lastFrame = timestamp;
  update(dt);
  const started = performance.now(); render();
  lastDrawCost = lerp(lastDrawCost, performance.now() - started, .025);
  frameRequest = requestAnimationFrame(frame);
}

function start() { if (running || paused || document.hidden) return; running = true; lastFrame = 0; frameRequest = requestAnimationFrame(frame); }
function stop() { running = false; cancelAnimationFrame(frameRequest); lastFrame = 0; }
function icon(button, id) { button.querySelector('use').setAttribute('href', `#i-${id}`); }

function syncClock(immediate = false) {
  clockLight = getLightCycle();
  if (immediate || paused) {
    daylight = clockLight.daylight; twilight = clockLight.twilight; fish.light = daylight;
    if (!document.hidden) render();
  }
}

function showControls() {
  tank.classList.add('controls-visible');
  clearTimeout(controlsTimer);
  controlsTimer = setTimeout(() => tank.classList.remove('controls-visible'), 2200);
}

function feed(x = width * .54) {
  if (performance.now() < feedCooldownUntil || pellets.length > 5) return;
  if (paused) setPaused(false);
  const dropX = clamp(x, 105 * fish.size, width - 105 * fish.size);
  for (let i = 0; i < 3; i++) pellets.push({ id: ++foodSequence, x: clamp(dropX + rand(-17, 17), 40, width - 40), y: height * .037 + rand(1, 10), age: 0, phase: rand(0, TAU) });
  ripples.push({ x: dropX, y: height * .023, age: 0, size: 5 });
  feedCooldownUntil = performance.now() + 900;
  restUntil = 0; resting = false;
}

function setPaused(value) {
  paused = value;
  icon($('pauseButton'), paused ? 'play' : 'pause');
  $('pauseButton').setAttribute('aria-label', paused ? '泳ぎを再開' : '動きを一時停止');
  $('pauseButton').setAttribute('aria-pressed', String(paused));
  tank.classList.toggle('is-paused', paused);
  if (paused) stop(); else start();
}

function updateFullscreenControl() {
  const full = !!document.fullscreenElement;
  icon($('fullscreenButton'), full ? 'contract' : 'expand');
  $('fullscreenButton').setAttribute('aria-label', full ? '全画面を終了' : '全画面で眺める');
  $('fullscreenButton').setAttribute('aria-pressed', String(full));
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (tank.requestFullscreen) await tank.requestFullscreen();
  } catch { /* The viewport already remains an edge-to-edge aquarium. */ }
}

canvas.addEventListener('click', (event) => { const rect = canvas.getBoundingClientRect(); feed(event.clientX - rect.left); });
canvas.addEventListener('pointermove', (event) => {
  const rect = canvas.getBoundingClientRect(); pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top;
});
canvas.addEventListener('pointerenter', (event) => { pointer.inside = event.pointerType !== 'touch'; pointer.entered = elapsed; });
canvas.addEventListener('pointerleave', () => { pointer.inside = false; });
canvas.addEventListener('keydown', (event) => { if (event.code === 'Enter' && !event.repeat) { event.preventDefault(); feed(); } });
tank.addEventListener('pointermove', showControls);
tank.addEventListener('pointerdown', showControls);
$('pauseButton').addEventListener('click', () => setPaused(!paused));
$('fullscreenButton').addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (event.code === 'KeyF') { event.preventDefault(); feed(clamp(fish.x + fish.turn * width * .12, width * .24, width * .76)); }
  else if (event.code === 'Space' && !event.target.closest('button, a')) { event.preventDefault(); setPaused(!paused); showControls(); }
  else if (event.code === 'KeyG') { event.preventDefault(); toggleFullscreen(); }
});
document.addEventListener('fullscreenchange', () => { updateFullscreenControl(); requestAnimationFrame(resize); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop();
  else { syncClock(true); start(); }
});
window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', () => { syncClock(true); start(); });
reducedMotion.addEventListener('change', (event) => { if (event.matches) setPaused(true); });
new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 90); }).observe(tank);
setInterval(() => { if (!document.hidden) syncClock(); }, 15000);

if (!tank.requestFullscreen || document.fullscreenEnabled === false) $('fullscreenButton').hidden = true;
resize();
setPaused(paused);

// Read-only diagnostics; no in-scene counters or messages.
window.suiren = Object.freeze({
  get state() { return { width: Math.round(width), height: Math.round(height), dpr, daylight: Math.round(daylight * 1000) / 1000, twilight: Math.round(twilight * 1000) / 1000, paused, visible: !document.hidden, running, elapsed: Math.round(elapsed * 10) / 10, pellets: pellets.length, eaten, mode, fishX: Math.round(fish.x), fishY: Math.round(fish.y), drawMs: Math.round(lastDrawCost * 100) / 100, bubbles: bubbles.length }; }
});
