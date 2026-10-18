import { getSceneLight, getSurfaceLight } from './lighting.js';
import { createRandom, leafProfile, createCausticMesh, causticMotion } from './materials.js';

/**
 * A small, deterministic botanical foreground for a Canvas 2D aquarium.
 * All coordinates are CSS pixels; the caller owns the device-pixel transform.
 * Hardscape and textured foliage are cached; a bounded set of plants moves.
 */
export function createAquascape(width, height, dpr = 1, daylight = 1) {
  const W = Math.max(1, width);
  const H = Math.max(1, height);
  const scale = Math.min(W / 1500, H / 750);
  const ratio = Math.min(1.5, Math.max(1, dpr));
  const light = getSceneLight(daylight);
  const random = createRandom(872314);
  const between = (lo, hi) => lo + (hi - lo) * random();
  const surface = document.createElement('canvas');
  surface.width = Math.ceil(W * ratio);
  surface.height = Math.ceil(H * ratio);
  const paint = surface.getContext('2d', { alpha: true });
  paint.scale(ratio, ratio);

  // Asymmetric planted banks fall into a quiet, open central clearing.
  const ground = x => H * (0.947 - 0.148 * Math.exp(-Math.pow((x / W - 0.065) / 0.195, 2))
    - 0.115 * Math.exp(-Math.pow((x / W - 0.95) / 0.172, 2))
    + 0.006 * Math.sin(x / W * 19) + 0.003 * Math.sin(x / W * 47));

  function roundedPath(ctx, points, close = true) {
    const n = points.length;
    ctx.moveTo((points[0][0] + points[n - 1][0]) / 2, (points[0][1] + points[n - 1][1]) / 2);
    for (let i = 0; i < n; i++) {
      const next = points[(i + 1) % n];
      ctx.quadraticCurveTo(points[i][0], points[i][1], (points[i][0] + next[0]) / 2,
        (points[i][1] + next[1]) / 2);
    }
    if (close) ctx.closePath();
  }

  function stone(ctx, x, y, radius, aspect, tone, details = true) {
    const outline = [];
    const count = details ? 10 : 7;
    for (let j = 0; j < count; j++) {
      const angle = j / count * Math.PI * 2;
      const rough = between(0.86, 1.12);
      outline.push([x + Math.cos(angle) * radius * rough,
        y + Math.sin(angle) * radius * aspect * rough]);
    }
    const warmth = details ? 3 : between(-5, 13);
    // Broad penumbra beneath large rocks, tight contact beneath small gravel.
    if (details) {
      ctx.save();
      ctx.translate(x - light.x * radius * 0.2, y + radius * aspect * 0.6);
      ctx.scale(1, aspect * 0.45);
      const shadow = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 1.45);
      shadow.addColorStop(0, 'rgba(3,16,15,.65)');
      shadow.addColorStop(0.65, 'rgba(3,16,15,.27)');
      shadow.addColorStop(1, 'rgba(3,16,15,0)');
      ctx.fillStyle = shadow;
      ctx.fillRect(-radius * 1.5, -radius * 1.5, radius * 3, radius * 3);
      ctx.restore();
    }
    ctx.fillStyle = details ? 'rgba(4,17,15,.48)' : 'rgba(8,16,13,.34)';
    ctx.beginPath();
    ctx.ellipse(x + radius * 0.12, y + radius * aspect * 0.61,
      radius * 1.07, radius * aspect * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    const gradient = ctx.createLinearGradient(x + light.x * radius, y - radius * aspect,
      x - light.x * radius, y + radius * aspect);
    gradient.addColorStop(0, `rgb(${tone + 43 + warmth},${tone + 43},${tone + 34 - warmth * 0.3})`);
    gradient.addColorStop(0.32, `rgb(${tone + 21 + warmth},${tone + 22},${tone + 13})`);
    gradient.addColorStop(0.66, `rgb(${tone + 1 + warmth * 0.4},${tone + 5},${tone - 2})`);
    gradient.addColorStop(1, `rgb(${Math.max(10, tone - 29)},${Math.max(15, tone - 22)},${Math.max(13, tone - 24)})`);
    ctx.beginPath();
    roundedPath(ctx, outline);
    ctx.fillStyle = gradient;
    ctx.fill();
    if (!details) return;
    ctx.save();
    ctx.clip();
    const topLight = ctx.createRadialGradient(x + radius * light.x * 0.8, y - radius * aspect * 0.6,
      0, x + radius * light.x * 0.45, y - radius * aspect * 0.4, radius * 1.15);
    topLight.addColorStop(0, 'rgba(169,173,146,.23)');
    topLight.addColorStop(0.7, 'rgba(111,125,105,.03)');
    topLight.addColorStop(1, 'rgba(3,16,13,.13)');
    ctx.fillStyle = topLight;
    ctx.fillRect(x - radius * 1.2, y - radius * aspect * 1.2, radius * 2.4, radius * aspect * 2.4);
    // A broad, softly irregular change in plane, then fine mineral grain.
    ctx.beginPath();
    ctx.moveTo(x - radius * 1.2, y - radius * aspect * 0.05);
    ctx.bezierCurveTo(x - radius * 0.35, y - radius * aspect * 0.44,
      x + radius * 0.11, y - radius * aspect * 0.06, x + radius * 1.15, y - radius * aspect * 0.26);
    ctx.lineTo(x + radius * 1.2, y + radius * aspect * 1.2);
    ctx.lineTo(x - radius * 1.2, y + radius * aspect * 1.2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(13,29,24,.13)';
    ctx.fill();
    for (let j = 0; j < 190; j++) {
      const rx = between(-1, 1) * radius;
      const ry = between(-1, 1) * radius * aspect;
      ctx.fillStyle = j % 3 === 0 ? 'rgba(201,202,172,.16)' : 'rgba(0,15,12,.13)';
      ctx.beginPath();
      ctx.ellipse(x + rx, y + ry, between(0.3, 1.4) * scale, between(0.2, 0.85) * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fine mineral seams follow the rock face, with no polygonal cartoon outline.
    ctx.strokeStyle = 'rgba(182,183,148,.14)';
    ctx.lineWidth = Math.max(0.5, 0.75 * scale);
    ctx.beginPath();
    ctx.moveTo(x - radius * 0.8, y - radius * aspect * 0.25);
    ctx.bezierCurveTo(x - radius * 0.1, y - radius * aspect * 0.6,
      x + radius * 0.05, y + radius * aspect * 0.2, x + radius * 0.9, y - radius * aspect * 0.2);
    ctx.stroke();
    ctx.restore();
  }

  function cubic(p, t) {
    const u = 1 - t;
    return [u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6],
      u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7]];
  }

  function branch(coords, thickness, endWidth = 0.7) {
    const p = coords.map((value, index) => value * (index % 2 ? H : W));
    const left = [], right = [];
    for (let j = 0; j <= 25; j++) {
      const t = j / 25;
      const point = cubic(p, t);
      const before = cubic(p, Math.max(0, t - 0.005));
      const after = cubic(p, Math.min(1, t + 0.005));
      const dx = after[0] - before[0], dy = after[1] - before[1];
      const length = Math.max(0.01, Math.hypot(dx, dy));
      const r = (thickness * (1 - t) ** 1.25 + endWidth) * scale;
      left.push([point[0] - dy / length * r, point[1] + dx / length * r]);
      right.push([point[0] + dy / length * r, point[1] - dx / length * r]);
    }
    const shade = paint.createLinearGradient(p[0] - 20 * scale, p[1], p[6] + 20 * scale, p[7]);
    shade.addColorStop(0, '#112421');
    shade.addColorStop(0.28, '#384537');
    shade.addColorStop(0.6, '#756d4d');
    shade.addColorStop(1, '#384434');
    paint.beginPath();
    roundedPath(paint, left.concat(right.reverse()));
    paint.fillStyle = shade;
    paint.fill();
    paint.save();
    paint.clip();
    for (let strand = 0; strand < 14; strand++) {
      const offset = between(-thickness * 0.7, thickness * 0.7) * scale;
      paint.beginPath();
      for (let j = 0; j <= 24; j++) {
        const t = j / 24;
        const point = cubic(p, t);
        const wiggle = Math.sin(t * 18 + strand * 3.2) * thickness * 0.065 * scale;
        const x = point[0] + offset * (1 - t) + wiggle;
        const y = point[1] + 0.2 * offset;
        if (j === 0) paint.moveTo(x, y); else paint.lineTo(x, y);
      }
      paint.strokeStyle = strand % 2 ? 'rgba(161,147,99,.19)' : 'rgba(8,24,20,.4)';
      paint.lineWidth = between(0.6, 2.8) * scale;
      paint.stroke();
    }
    paint.restore();
  }

  const blades = [];
  const stems = [];
  const front = [];
  const rosettes = [];

  function addBlades(target, count, x1, x2, h1, h2, leafWidth, layer = 1) {
    for (let i = 0; i < count; i++) {
      const x = between(x1, x2) * W;
      const base = ground(x) + between(0.003, 0.012) * H;
      target.push({ type: 'blade', x, y: base, height: between(h1, h2) * H,
        width: between(0.6, 1.2) * leafWidth * scale,
        lean: between(-0.065, 0.07) * W,
        wave: between(-0.024, 0.026) * W,
        phase: between(0, 6.28), speed: between(0.3, 0.48), layer,
        color: Math.floor(between(0, 3)) });
    }
  }

  // Tall rear ribbons define the silhouette without filling the swimming space.
  addBlades(blades, 16, -0.01, 0.2, 0.31, 0.69, 10, 0);
  addBlades(blades, 15, 0.827, 1.016, 0.3, 0.66, 11, 0);
  addBlades(front, 4, -0.015, 0.063, 0.19, 0.35, 15, 2);
  addBlades(front, 4, 0.951, 1.035, 0.18, 0.35, 16, 2);

  function addStem(x, heightFactor, lean, side) {
    const leaves = [];
    const count = 7;
    const stemHeight = heightFactor * H;
    for (let j = 0; j < count; j++) {
      const t = 0.11 + j * 0.124 + between(-0.025, 0.025);
      const direction = (j % 2 ? -1 : 1) * side;
      leaves.push({ t, direction, length: between(52, 92) * scale * (1 - t * 0.38),
        width: between(8, 19) * scale * (1 - t * 0.3), angle: between(-0.79, 0.05),
        color: Math.floor(between(0, 3)) });
    }
    stems.push({ type: 'stem', x: x * W, y: ground(x * W) + 0.006 * H,
      height: stemHeight, lean: lean * W, phase: between(0, 6.28), leaves });
  }
  // A few forked leafy stems form a deliberately asymmetric planted composition.
  for (const spec of [
    [0.039, 0.31, 0.018, 1], [0.097, 0.44, -0.018, 1], [0.163, 0.32, 0.02, 1],
    [0.209, 0.33, 0.032, 1], [0.265, 0.21, -0.033, 1],
    [0.772, 0.18, 0.022, -1], [0.831, 0.33, -0.027, -1],
    [0.892, 0.37, 0.013, -1], [0.951, 0.42, -0.018, -1],
  ]) addStem(...spec);

  function drawBlade(ctx, leaf, time, opacity = 1) {
    const sway = Math.sin(time * leaf.speed + leaf.phase) * leaf.height * 0.023;
    const tipX = leaf.x + leaf.lean + sway;
    const tipY = leaf.y - leaf.height;
    const bendX = leaf.x + leaf.lean * 0.15 + leaf.wave * 0.4;
    const bendY = leaf.y - leaf.height * 0.43;
    const upperX = leaf.x + leaf.lean * 0.5 + leaf.wave + sway * 0.4;
    const upperY = leaf.y - leaf.height * 0.85;
    const half = leaf.width / 2;
    const palettes = leaf.layer === 0
      ? [['#143e39', '#366648', '#71906a'], ['#103931', '#315d3c', '#6a8860'], ['#153c39', '#426846', '#84956c']]
      : [['#152f25', '#365638', '#7b9160'], ['#0d342b', '#38603c', '#759c63'], ['#173830', '#466444', '#8c9e6c']];
    const colors = palettes[leaf.color];
    const gradient = ctx.createLinearGradient(leaf.x, leaf.y, tipX, tipY);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.52, colors[1]);
    gradient.addColorStop(1, colors[2]);
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha *= opacity * light.ambient;
    ctx.beginPath();
    ctx.moveTo(leaf.x, leaf.y);
    ctx.bezierCurveTo(bendX - half, bendY, upperX - half * 0.5, upperY, tipX, tipY);
    ctx.bezierCurveTo(upperX + half * 0.65, upperY + leaf.height * 0.04,
      bendX + half * 1.12, bendY, leaf.x + half * 0.3, leaf.y);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = leaf.layer === 0 ? 'rgba(139,178,121,.17)' : 'rgba(155,189,123,.23)';
    ctx.lineWidth = Math.max(0.45, scale * 0.75);
    ctx.beginPath();
    ctx.moveTo(leaf.x, leaf.y);
    ctx.bezierCurveTo(bendX + half * 0.22, bendY, upperX, upperY, tipX, tipY);
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }

  function leafShape(ctx, x, y, length, breadth, direction, angle, color, kind = 'lance') {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(direction, 1);
    ctx.rotate(angle);
    const palette = [
      ['#173b2f', '#426e49', '#91aa71'],
      ['#123a31', '#35634b', '#7c9e78'],
      ['#253e2c', '#62794b', '#a0ad75'],
    ][color];
    const curl = between(-0.32, 0.21) * breadth;
    const phase = between(0, 6.28);
    const spine = t => leafProfile(t, breadth, curl, phase, kind).spine;
    const halfWidth = t => leafProfile(t, breadth, curl, phase, kind).halfWidth;
    const edges = [];
    for (let j = 0; j <= 18; j++) {
      const t = j / 18;
      edges.push([length * t, spine(t) - halfWidth(t) * (0.87 + t * 0.11)]);
    }
    for (let j = 18; j >= 0; j--) {
      const t = j / 18;
      edges.push([length * t, spine(t) + halfWidth(t) * (0.9 - t * 0.14)]);
    }
    const localLight = getSurfaceLight(daylight, angle * direction, direction);
    const gradient = ctx.createLinearGradient(length * (0.5 - localLight.x * 0.35), -localLight.y * breadth,
      length * (0.5 + localLight.x * 0.35), localLight.y * breadth);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(0.42, palette[1]);
    gradient.addColorStop(0.82, palette[2]);
    gradient.addColorStop(1, palette[1]);
    ctx.beginPath();
    roundedPath(ctx, edges);
    ctx.fillStyle = gradient;
    ctx.shadowColor = 'rgba(3,22,17,.26)';
    ctx.shadowBlur = Math.max(1, 3.5 * scale);
    ctx.shadowOffsetX = -localLight.x * 2 * scale;
    ctx.shadowOffsetY = -localLight.y * 3 * scale;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save();
    ctx.clip();
    const transmitted = ctx.createRadialGradient(length * (0.5 + localLight.x * 0.17), localLight.y * breadth * 0.4, 0,
      length * 0.5, 0, length * 0.62);
    transmitted.addColorStop(0, 'rgba(148,175,95,.13)');
    transmitted.addColorStop(0.65, 'rgba(43,91,49,.03)');
    transmitted.addColorStop(1, 'rgba(0,20,15,.18)');
    ctx.fillStyle = transmitted;
    ctx.fillRect(0, -breadth * 1.5, length, breadth * 3);
    // Very small uneven pigment marks make the cached surface painterly.
    for (let j = 0; j < (kind === 'oval' ? 54 : 22); j++) {
      const lx = between(0.08, 0.96) * length;
      const ly = between(-0.95, 0.95) * breadth;
      ctx.fillStyle = j % 3 ? 'rgba(5,38,24,.055)' : 'rgba(184,204,132,.065)';
      ctx.beginPath();
      ctx.ellipse(lx, ly, between(0.6, 2.8) * scale, between(0.3, 1.4) * scale,
        between(-0.4, 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    // Veins curve at slightly different intervals and never form a rigid grid.
    const veinCount = kind === 'oval' ? 7 : 5;
    for (let j = 1; j <= veinCount; j++) {
      const t = j / (veinCount + 2) + between(-0.018, 0.018);
      const reach = Math.min(0.97, t + between(0.11, 0.19));
      for (const side of [-1, 1]) {
        const lx = length * t;
        ctx.beginPath();
        ctx.moveTo(lx, spine(t));
        ctx.bezierCurveTo(lx + length * 0.035, spine(t) + side * halfWidth(t) * 0.13,
          length * reach - length * 0.025, spine(reach) + side * halfWidth(reach) * 0.45,
          length * reach, spine(reach) + side * halfWidth(reach) * 0.79);
        ctx.strokeStyle = side === -1 ? 'rgba(160,187,112,.17)' : 'rgba(8,40,26,.24)';
        ctx.lineWidth = Math.max(0.4, scale * (kind === 'oval' ? 0.84 : 0.62));
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(length * 0.5, curl * 1.85 - breadth * 0.09, length, spine(1));
    ctx.strokeStyle = 'rgba(171,192,133,.19)';
    ctx.lineWidth = Math.max(0.45, scale * 0.85);
    ctx.stroke();
    ctx.restore();
  }

  function addRosette(x, lift, size, kind = 'oval', foreground = false, dim = false) {
    const unit = scale * size;
    const bw = Math.ceil(500 * unit);
    const bh = Math.ceil(325 * unit);
    const sprite = document.createElement('canvas');
    sprite.width = Math.ceil(bw * ratio);
    sprite.height = Math.ceil(bh * ratio);
    const ctx = sprite.getContext('2d');
    ctx.scale(ratio, ratio);
    const rootX = bw * 0.5, rootY = bh - 23 * unit;
    const leaves = [];
    for (let j = 0; j < (kind === 'fern' ? 9 : 8); j++) {
      const direction = -2.94 + j / (kind === 'fern' ? 8 : 7) * 2.78 + between(-0.22, 0.22);
      leaves.push({ direction, stalk: between(17, 46) * unit,
        length: between(kind === 'fern' ? 108 : 68, kind === 'fern' ? 186 : 117) * unit,
        breadth: between(kind === 'fern' ? 10 : 21, kind === 'fern' ? 18 : 36) * unit,
        color: Math.floor(between(0, 3)), curl: between(-0.19, 0.19) });
    }
    // Rear-facing leaves are painted first; low frontal leaves overlap their stems.
    leaves.sort((a, b) => Math.sin(a.direction) - Math.sin(b.direction));
    for (const leaf of leaves) {
      const lx = rootX + Math.cos(leaf.direction) * leaf.stalk;
      const ly = rootY + Math.sin(leaf.direction) * leaf.stalk;
      ctx.strokeStyle = dim ? '#264b3c' : '#3f6442';
      ctx.lineWidth = Math.max(0.8, 2.1 * unit);
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.quadraticCurveTo(rootX + (lx - rootX) * 0.43, rootY - leaf.stalk * 0.44, lx, ly);
      ctx.stroke();
      leafShape(ctx, lx, ly, leaf.length, leaf.breadth, 1,
        leaf.direction + leaf.curl, leaf.color, kind);
    }
    rosettes.push({ x: x * W, y: ground(x * W) + lift * H, bw, bh, rootX, rootY,
      sprite, foreground, dim, phase: between(0, 6.28), sway: kind === 'fern' ? 0.013 : 0.007 });
  }

  // Broad Anubias-like leaves overlap Java-fern silhouettes in low thickets.
  for (const plant of [
    [-0.012, 0.025, 1.08, 'fern', false, true],
    [0.068, -0.022, 0.96, 'fern', false, true],
    [0.151, -0.012, 1.03, 'fern', false, false],
    [0.207, 0.012, 1.1, 'oval', false, false],
    [0.267, 0.011, 0.74, 'fern', false, false],
    [0.073, 0.028, 1.15, 'oval', false, false],
    [0.142, 0.044, 0.87, 'oval', false, false],
    [0.782, 0.014, 0.82, 'fern', false, false],
    [0.843, -0.015, 1.04, 'fern', false, true],
    [0.897, 0.0, 1.16, 'oval', false, false],
    [0.963, -0.019, 1.17, 'fern', false, true],
    [0.985, 0.044, 1.02, 'oval', false, false],
    [0.025, 0.13, 0.87, 'oval', true, true],
    [0.962, 0.12, 0.93, 'oval', true, true],
  ]) addRosette(...plant);

  // Cache complete leafy sprigs. Gentle rotation about their root avoids redrawing
  // dozens of veins for every animation frame.
  for (const stem of stems) {
    const padding = 0.072 * W;
    const bw = Math.ceil(padding * 2 + Math.abs(stem.lean));
    const bh = Math.ceil(stem.height + 0.17 * H);
    const sprig = document.createElement('canvas');
    sprig.width = Math.ceil(bw * ratio);
    sprig.height = Math.ceil(bh * ratio);
    const ctx = sprig.getContext('2d');
    ctx.scale(ratio, ratio);
    const rootX = padding + Math.max(0, -stem.lean);
    const rootY = bh - 0.022 * H;
    ctx.strokeStyle = '#476d47';
    ctx.lineWidth = Math.max(0.6, 1.45 * scale);
    ctx.beginPath();
    ctx.moveTo(rootX, rootY);
    ctx.bezierCurveTo(rootX + stem.lean * 0.2, rootY - stem.height * 0.4,
      rootX + stem.lean * 0.8, rootY - stem.height * 0.7,
      rootX + stem.lean, rootY - stem.height);
    ctx.stroke();
    for (const leaf of stem.leaves) {
      const x = rootX + stem.lean * leaf.t ** 1.35;
      const y = rootY - stem.height * leaf.t;
      leafShape(ctx, x, y, leaf.length, leaf.width, leaf.direction, leaf.angle, leaf.color);
    }
    leafShape(ctx, rootX + stem.lean * 0.97, rootY - stem.height * 0.96,
      stem.height * 0.22, 8 * scale, 1, -1.2, 1);
    stem.sprite = sprig;
    stem.bw = bw; stem.bh = bh; stem.rootX = rootX; stem.rootY = rootY;
  }

  // Hazy distant foliage is fixed and deliberately less saturated than the live
  // foreground, creating apparent depth through the blue-green water.
  paint.globalAlpha = 0.25;
  for (let j = 0; j < 48; j++) {
    const x = (j < 24 ? between(-0.035, 0.262) : between(0.762, 1.035)) * W;
    const y = ground(x);
    const h = between(0.17, 0.49) * H;
    paint.fillStyle = '#527666';
    paint.beginPath();
    paint.moveTo(x, y);
    paint.bezierCurveTo(x - 15 * scale, y - h * 0.55, x - 37 * scale, y - h * 0.9, x - 28 * scale, y - h);
    paint.bezierCurveTo(x - 16 * scale, y - h * 0.85, x + 3 * scale, y - h * 0.4, x + 3 * scale, y);
    paint.fill();
  }
  paint.globalAlpha = 1;

  // Long water-worn roots grow out of the planted banks; their exposed forks
  // remain thick enough to read as aged wood, not thin diagrammatic twigs.
  branch([0.078, 0.918, 0.163, 0.77, 0.214, 0.55, 0.337, 0.465], 34, 1.1);
  branch([0.185, 0.701, 0.193, 0.565, 0.148, 0.499, 0.185, 0.36], 15, 0.8);
  branch([0.257, 0.561, 0.269, 0.46, 0.249, 0.419, 0.292, 0.369], 10, 0.7);
  branch([0.12, 0.836, 0.073, 0.714, 0.099, 0.615, 0.042, 0.547], 17, 1.0);
  branch([0.121, 0.868, 0.206, 0.818, 0.265, 0.857, 0.335, 0.752], 20, 1.2);
  branch([0.937, 0.948, 0.871, 0.817, 0.913, 0.649, 0.846, 0.494], 31, 1.2);
  branch([0.9, 0.791, 0.848, 0.736, 0.804, 0.786, 0.75, 0.674], 15, 0.9);
  branch([0.897, 0.693, 0.932, 0.615, 0.955, 0.646, 0.988, 0.515], 13, 0.8);

  // Underwater gravel bed with a lighter central channel and an irregular ridge.
  paint.beginPath();
  paint.moveTo(0, H);
  paint.lineTo(0, ground(0));
  for (let x = 0; x <= W + 8; x += Math.max(4, 9 * scale)) {
    paint.lineTo(x, ground(x) + between(-1.5, 1.4) * scale);
  }
  paint.lineTo(W, H);
  paint.closePath();
  const bed = paint.createLinearGradient(0, H * 0.78, 0, H);
  bed.addColorStop(0, '#273e34');
  bed.addColorStop(0.29, '#454e3c');
  bed.addColorStop(0.73, '#525143');
  bed.addColorStop(1, '#222f28');
  paint.fillStyle = bed;
  paint.fill();
  paint.save();
  paint.clip();
  const clearing = paint.createRadialGradient(W * 0.47, H * 0.96, 0,
    W * 0.48, H * 0.93, W * 0.52);
  clearing.addColorStop(0, 'rgba(193,184,145,.18)');
  clearing.addColorStop(1, 'rgba(3,24,22,.2)');
  paint.fillStyle = clearing;
  paint.fillRect(0, H * 0.77, W, H * 0.23);
  const gravel = [];
  for (let j = 0; j < 15600; j++) {
    const x = random() * W, y = between(0.773, 1.025) * H;
    const distance = Math.max(0, Math.min(1.15, (y - ground(x)) / (H - ground(x))));
    // Mostly fine grains, with occasional larger, partly buried pebbles.
    const size = random();
    const r = (0.65 + distance * 0.65 + size ** 2.3 * (2.8 + distance * 5.8)) * scale;
    if (y < ground(x) - r) continue;
    const bankShade = (1 - Math.min(1, Math.abs(x / W - 0.48) / 0.48)) * 10;
    gravel.push({ x, y, r, tone: Math.floor(between(29, 80) + bankShade), aspect: between(0.32, 0.8) });
  }
  // Draw rear pebbles first, making the overlapping near edge read as depth.
  gravel.sort((a, b) => a.y - b.y);
  for (const pebble of gravel) {
    stone(paint, pebble.x, pebble.y, pebble.r, pebble.aspect, pebble.tone, false);
  }
  paint.restore();

  // Rounded, weathered stone masses ground the two planting islands.
  for (const rock of [
    [0.034, 0.014, 53, 0.57, 45], [0.106, 0.01, 82, 0.66, 44],
    [0.169, 0.019, 71, 0.46, 54], [0.224, 0.018, 36, 0.51, 57],
    [0.291, 0.016, 28, 0.4, 65], [0.733, 0.014, 24, 0.46, 60],
    [0.798, 0.022, 52, 0.49, 47], [0.866, 0.022, 76, 0.62, 42],
    [0.935, 0.018, 62, 0.5, 53], [0.992, 0.022, 44, 0.54, 45],
  ]) stone(paint, rock[0] * W, ground(rock[0] * W) + rock[1] * H,
    rock[2] * scale, rock[3], rock[4]);

  // Fine, irregular moss fibres settle into crevices around the planting islands.
  // Their tiny branching tips avoid the repeated U-shaped grass silhouette.
  for (const cluster of [0.046, 0.094, 0.149, 0.196, 0.827, 0.874, 0.931, 0.975]) {
    const cx = cluster * W;
    const cy = ground(cx) + between(0.005, 0.028) * H;
    const span = between(9, 22) * scale;
    for (let j = 0; j < 24; j++) {
      const x = cx + between(-span, span);
      const y = cy + between(-3.5, 4.5) * scale;
      const h = between(2.5, 9.5) * scale;
      const lean = between(-0.7, 0.7) * h;
      paint.strokeStyle = j % 4 ? 'rgba(69,98,61,.55)' : 'rgba(124,145,88,.58)';
      paint.lineWidth = between(0.38, 0.8) * scale;
      paint.beginPath();
      paint.moveTo(x, y);
      paint.quadraticCurveTo(x + lean * 0.18, y - h * 0.54, x + lean, y - h);
      if (j % 3 === 0) {
        paint.moveTo(x + lean * 0.35, y - h * 0.55);
        paint.lineTo(x + lean * 0.35 - h * 0.22, y - h * 0.74);
      }
      paint.stroke();
    }
  }

  // Cool the cached pigment once, without a full-screen veil over the fish.
  if (daylight < 1) {
    for (const canvas of [surface, ...stems.map(stem => stem.sprite), ...rosettes.map(plant => plant.sprite)]) {
      const c = canvas.getContext('2d');
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = `rgba(7,25,42,${1 - light.ambient})`;
      c.fillRect(0, 0, canvas.width, canvas.height);
      c.restore();
    }
  }

  const floorClip = new Path2D();
  floorClip.moveTo(0, H);
  for (let x = 0; x <= W; x += W / 80) floorClip.lineTo(x, ground(x));
  floorClip.lineTo(W, ground(W));
  floorClip.lineTo(W, H);
  floorClip.closePath();

  function makeCaustics(seed) {
    const canvas = document.createElement('canvas');
    const w = W + 24, h = H * 0.25;
    const density = 0.65;
    canvas.width = Math.ceil(w * density);
    canvas.height = Math.ceil(h * density);
    const c = canvas.getContext('2d');
    c.scale(density, density);
    const mesh = createCausticMesh(18, 5, seed);
    c.lineWidth = Math.max(0.8, W / 1300);
    c.lineCap = 'round';
    c.shadowColor = 'rgba(165,217,188,.5)';
    c.shadowBlur = 2;
    for (const [index, [a, b]] of mesh.edges.entries()) {
      const [ax, ay] = mesh.points[a], [bx, by] = mesh.points[b];
      const bend = Math.sin(index * 7.3) * 0.24;
      c.strokeStyle = `rgba(180,225,195,${0.28 + (index % 4) * 0.08})`;
      c.beginPath();
      c.moveTo(ax * w, ay * h);
      c.quadraticCurveTo(((ax + bx) / 2 + (by - ay) * bend * 0.2) * w,
        ((ay + by) / 2 - (bx - ax) * bend * 3) * h, bx * w, by * h);
      c.stroke();
    }
    c.shadowColor = 'transparent';
    c.globalCompositeOperation = 'destination-in';
    const fade = c.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, '#0000'); fade.addColorStop(0.45, '#0009'); fade.addColorStop(1, '#0004');
    c.fillStyle = fade;
    c.fillRect(0, 0, w, h);
    return canvas;
  }
  const caustics = [makeCaustics(761), makeCaustics(762)];

  function drawCaustics(ctx, time) {
    const motion = causticMotion(time);
    ctx.save();
    ctx.clip(floorClip);
    ctx.globalCompositeOperation = 'screen';
    const alpha = ctx.globalAlpha * (0.12 + daylight * 0.22);
    ctx.globalAlpha = alpha * (1 - motion.mix);
    ctx.drawImage(caustics[0], -12 + motion.x * 8, H * 0.76 + motion.y * 3, W + 24, H * 0.25);
    ctx.globalAlpha = alpha * motion.mix;
    ctx.drawImage(caustics[1], -12 - motion.x * 7, H * 0.76 - motion.y * 3, W + 24, H * 0.25);
    ctx.restore();
  }

  let destroyed = false;
  function drawRosette(ctx, plant, time, opacity = 1) {
    ctx.save();
    ctx.globalAlpha *= opacity;
    ctx.translate(plant.x, plant.y);
    ctx.rotate(Math.sin(time * 0.29 + plant.phase) * plant.sway);
    ctx.drawImage(plant.sprite, -plant.rootX, -plant.rootY, plant.bw, plant.bh);
    ctx.restore();
  }
  return {
    drawBack(ctx, time = 0, quality = 1) {
      if (destroyed) return;
      ctx.save();
      for (const plant of rosettes) {
        if (!plant.foreground && plant.dim) drawRosette(ctx, plant, time, 0.62);
      }
      for (let i = 0; i < blades.length; i++) {
        if (quality < 0.5 && i % 3 === 0) continue;
        drawBlade(ctx, blades[i], time, 0.83);
      }
      ctx.drawImage(surface, 0, 0, W, H);
      drawCaustics(ctx, time);
      for (const stem of stems) {
        ctx.save();
        ctx.translate(stem.x, stem.y);
        ctx.rotate(Math.sin(time * 0.36 + stem.phase) * 0.013);
        ctx.drawImage(stem.sprite, -stem.rootX, -stem.rootY, stem.bw, stem.bh);
        ctx.restore();
      }
      for (const plant of rosettes) {
        if (!plant.foreground && !plant.dim) drawRosette(ctx, plant, time, 0.96);
      }
      ctx.restore();
    },
    drawFront(ctx, time = 0, quality = 1) {
      if (destroyed) return;
      ctx.save();
      for (let i = 0; i < front.length; i++) {
        if (quality < 0.5 && i % 4 === 0) continue;
        drawBlade(ctx, front[i], time, 0.95);
      }
      for (const plant of rosettes) {
        if (plant.foreground) drawRosette(ctx, plant, time, 0.89);
      }
      ctx.restore();
    },
    destroy() {
      destroyed = true;
      surface.width = surface.height = 1;
      for (const canvas of caustics) canvas.width = canvas.height = 1;
      for (const stem of stems) stem.sprite.width = stem.sprite.height = 1;
      for (const plant of rosettes) plant.sprite.width = plant.sprite.height = 1;
      rosettes.length = 0;
      blades.length = stems.length = front.length = 0;
    },
  };
}
