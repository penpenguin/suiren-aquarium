/**
 * A small, deterministic botanical foreground for a Canvas 2D aquarium.
 * All coordinates are CSS pixels; the caller owns the device-pixel transform.
 * Hardscape is rendered once. Only 46 plant stems move on subsequent frames.
 */
export function createAquascape(width, height, dpr = 1) {
  const W = Math.max(1, width);
  const H = Math.max(1, height);
  const scale = Math.min(W / 1500, H / 750);
  const ratio = Math.min(1.5, Math.max(1, dpr));
  let seed = 872314;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const between = (lo, hi) => lo + (hi - lo) * random();
  const surface = document.createElement('canvas');
  surface.width = Math.ceil(W * ratio);
  surface.height = Math.ceil(H * ratio);
  const paint = surface.getContext('2d', { alpha: true });
  paint.scale(ratio, ratio);

  // A shallow, imperfect bank; the central clearing stays low and open.
  const ground = x => H * (0.902 - 0.027 * Math.exp(-Math.pow((x / W - 0.13) / 0.19, 2))
    - 0.037 * Math.exp(-Math.pow((x / W - 0.9) / 0.16, 2)) + 0.006 * Math.sin(x / W * 11));

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
    // A small offset contact shadow seats each pebble in its neighbours.
    ctx.fillStyle = details ? 'rgba(4,17,15,.38)' : 'rgba(8,16,13,.34)';
    ctx.beginPath();
    ctx.ellipse(x + radius * 0.12, y + radius * aspect * 0.61,
      radius * 1.07, radius * aspect * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    const gradient = ctx.createLinearGradient(x - radius * 0.36, y - radius * aspect,
      x + radius * 0.52, y + radius * aspect);
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
    const topLight = ctx.createRadialGradient(x - radius * 0.38, y - radius * aspect * 0.6,
      0, x - radius * 0.22, y - radius * aspect * 0.4, radius * 1.15);
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
    shade.addColorStop(0, '#162322');
    shade.addColorStop(0.28, '#3b3b2e');
    shade.addColorStop(0.6, '#514733');
    shade.addColorStop(1, '#282f26');
    paint.beginPath();
    roundedPath(paint, left.concat(right.reverse()));
    paint.fillStyle = shade;
    paint.fill();
    paint.save();
    paint.clip();
    for (let strand = 0; strand < 6; strand++) {
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
      paint.strokeStyle = strand % 2 ? 'rgba(124,116,77,.16)' : 'rgba(8,24,20,.35)';
      paint.lineWidth = between(0.7, 2) * scale;
      paint.stroke();
    }
    paint.restore();
  }

  const blades = [];
  const stems = [];
  const front = [];

  function addBlades(target, count, x1, x2, h1, h2, leafWidth, layer = 1) {
    for (let i = 0; i < count; i++) {
      const x = between(x1, x2) * W;
      const base = ground(x) + between(0.003, 0.012) * H;
      target.push({ type: 'blade', x, y: base, height: between(h1, h2) * H,
        width: between(0.6, 1.2) * leafWidth * scale,
        lean: between(-0.1, 0.095) * W,
        wave: between(-0.03, 0.03) * W,
        phase: between(0, 6.28), speed: between(0.3, 0.48), layer,
        color: Math.floor(between(0, 3)) });
    }
  }

  // Tall rear ribbons define the silhouette without filling the swimming space.
  addBlades(blades, 12, 0.025, 0.185, 0.39, 0.7, 9, 0);
  addBlades(blades, 10, 0.835, 0.986, 0.36, 0.66, 10, 0);
  addBlades(front, 5, -0.015, 0.08, 0.22, 0.4, 14, 2);
  addBlades(front, 5, 0.915, 1.035, 0.18, 0.39, 14, 2);

  function addStem(x, heightFactor, lean, side) {
    const leaves = [];
    const count = 5;
    const stemHeight = heightFactor * H;
    for (let j = 0; j < count; j++) {
      const t = 0.19 + j * 0.157;
      const direction = (j % 2 ? -1 : 1) * side;
      leaves.push({ t, direction, length: between(0.035, 0.060) * W * (1 - t * 0.35),
        width: between(7, 14) * scale * (1 - t * 0.22), angle: between(-0.58, -0.18),
        color: Math.floor(between(0, 3)) });
    }
    stems.push({ type: 'stem', x: x * W, y: ground(x * W) + 0.006 * H,
      height: stemHeight, lean: lean * W, phase: between(0, 6.28), leaves });
  }
  // A few forked leafy stems form a deliberately asymmetric planted composition.
  for (const spec of [
    [0.069, 0.26, 0.023, 1], [0.107, 0.35, -0.018, 1], [0.146, 0.27, 0.02, 1],
    [0.181, 0.30, 0.032, 1], [0.211, 0.22, -0.01, 1], [0.245, 0.15, -0.029, 1],
    [0.756, 0.13, 0.005, -1], [0.798, 0.23, 0.007, -1], [0.843, 0.30, -0.03, -1],
    [0.881, 0.23, 0.026, -1], [0.923, 0.30, 0.003, -1], [0.957, 0.19, -0.018, -1],
    [0.12, 0.14, -0.016, 1], [0.881, 0.13, -0.018, -1],
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
    ctx.globalAlpha = opacity;
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
    ctx.globalAlpha = 1;
  }

  function leafShape(ctx, x, y, length, breadth, direction, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(direction, 1);
    ctx.rotate(angle);
    const palette = [
      ['#1b3b2a', '#547848', '#92a86c'],
      ['#133b30', '#3d714d', '#79a073'],
      ['#263f2a', '#657c48', '#a3ad70'],
    ][color];
    const gradient = ctx.createLinearGradient(length * 0.3, breadth, length * 0.55, -breadth);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(0.48, palette[1]);
    gradient.addColorStop(1, palette[2]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(length * 0.27, -breadth * 0.9, length * 0.61, -breadth * 1.2, length, -breadth * 0.21);
    ctx.bezierCurveTo(length * 0.58, breadth * 0.76, length * 0.2, breadth * 0.93, 0, 0);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(length * 0.53, -breadth * 0.09, length * 0.97, -breadth * 0.22);
    ctx.strokeStyle = 'rgba(182,199,130,.28)';
    ctx.lineWidth = Math.max(0.45, scale * 0.72);
    ctx.stroke();
    // Restrained venation creates depth at desktop sizes without texture assets.
    ctx.strokeStyle = 'rgba(17,48,28,.17)';
    ctx.lineWidth = Math.max(0.35, scale * 0.55);
    for (let j = 1; j <= 3; j++) {
      const t = j * 0.19;
      const lx = length * t;
      ctx.beginPath();
      ctx.moveTo(lx, -breadth * t * 0.2);
      ctx.quadraticCurveTo(lx + length * 0.06, -breadth * 0.25, lx + length * 0.12, -breadth * (0.62 - t * 0.2));
      ctx.moveTo(lx, -breadth * t * 0.2);
      ctx.quadraticCurveTo(lx + length * 0.055, breadth * 0.28, lx + length * 0.09, breadth * (0.52 - t * 0.2));
      ctx.stroke();
    }
    ctx.restore();
  }

  // Cache complete leafy sprigs. Gentle rotation about their root avoids redrawing
  // dozens of veins for every animation frame.
  for (const stem of stems) {
    const padding = 0.072 * W;
    const bw = Math.ceil(padding * 2 + Math.abs(stem.lean));
    const bh = Math.ceil(stem.height + 0.08 * H);
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
  paint.globalAlpha = 0.22;
  for (let j = 0; j < 24; j++) {
    const x = (j < 12 ? between(-0.035, 0.255) : between(0.76, 1.035)) * W;
    const y = ground(x);
    const h = between(0.11, 0.34) * H;
    paint.fillStyle = '#365e48';
    paint.beginPath();
    paint.moveTo(x, y);
    paint.bezierCurveTo(x - 15 * scale, y - h * 0.55, x - 37 * scale, y - h * 0.9, x - 28 * scale, y - h);
    paint.bezierCurveTo(x - 16 * scale, y - h * 0.85, x + 3 * scale, y - h * 0.4, x + 3 * scale, y);
    paint.fill();
  }
  paint.globalAlpha = 1;

  // Submerged driftwood: a long, low left hand branch and a smaller upright right.
  branch([0.126, 0.912, 0.179, 0.76, 0.212, 0.594, 0.33, 0.522], 19);
  branch([0.192, 0.743, 0.191, 0.627, 0.158, 0.575, 0.179, 0.475], 8);
  branch([0.246, 0.616, 0.268, 0.527, 0.251, 0.48, 0.281, 0.438], 5);
  branch([0.143, 0.858, 0.107, 0.767, 0.112, 0.658, 0.065, 0.597], 8);
  branch([0.137, 0.884, 0.221, 0.875, 0.264, 0.867, 0.309, 0.804], 10);
  branch([0.892, 0.917, 0.863, 0.813, 0.882, 0.68, 0.839, 0.573], 17);
  branch([0.87, 0.824, 0.83, 0.774, 0.794, 0.803, 0.745, 0.741], 7);
  branch([0.877, 0.746, 0.906, 0.665, 0.948, 0.655, 0.963, 0.606], 6);

  // Underwater gravel bed with a lighter central channel and an irregular ridge.
  paint.beginPath();
  paint.moveTo(0, H);
  paint.lineTo(0, ground(0));
  for (let x = 0; x <= W + 8; x += Math.max(4, 9 * scale)) {
    paint.lineTo(x, ground(x) + between(-1.5, 1.4) * scale);
  }
  paint.lineTo(W, H);
  paint.closePath();
  const bed = paint.createLinearGradient(0, H * 0.87, 0, H);
  bed.addColorStop(0, '#454940');
  bed.addColorStop(0.19, '#525447');
  bed.addColorStop(0.52, '#484a3e');
  bed.addColorStop(1, '#2a322b');
  paint.fillStyle = bed;
  paint.fill();
  paint.save();
  paint.clip();
  const clearing = paint.createRadialGradient(W * 0.48, H * 0.91, 0,
    W * 0.48, H * 0.91, W * 0.5);
  clearing.addColorStop(0, 'rgba(187,178,136,.14)');
  clearing.addColorStop(1, 'rgba(3,24,22,.13)');
  paint.fillStyle = clearing;
  paint.fillRect(0, H * 0.86, W, H * 0.14);
  const gravel = [];
  for (let j = 0; j < 10500; j++) {
    const x = random() * W, y = between(0.865, 1.02) * H;
    const distance = Math.max(0, (y / H - 0.86) / 0.14);
    const r = between(0.9 + distance * 0.5, 2.2 + distance * 4.2) * scale;
    if (y < ground(x) - r) continue;
    gravel.push({ x, y, r, tone: Math.floor(between(39, 96)), aspect: between(0.49, 0.83) });
  }
  // Draw rear pebbles first, making the overlapping near edge read as depth.
  gravel.sort((a, b) => a.y - b.y);
  for (const pebble of gravel) {
    stone(paint, pebble.x, pebble.y, pebble.r, pebble.aspect, pebble.tone, false);
  }
  paint.restore();

  // Rounded, weathered stone masses ground the two planting islands.
  for (const rock of [
    [0.052, 0.902, 40, 0.53, 57], [0.117, 0.898, 59, 0.61, 54],
    [0.173, 0.904, 45, 0.42, 67], [0.206, 0.909, 23, 0.43, 66],
    [0.248, 0.923, 20, 0.37, 77], [0.745, 0.923, 21, 0.42, 69],
    [0.823, 0.904, 42, 0.47, 57], [0.88, 0.9, 66, 0.61, 52],
    [0.944, 0.904, 43, 0.47, 66], [0.985, 0.929, 27, 0.48, 61],
  ]) stone(paint, rock[0] * W, rock[1] * H, rock[2] * scale, rock[3], rock[4]);

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

  let destroyed = false;
  return {
    drawBack(ctx, time = 0, quality = 1) {
      if (destroyed) return;
      ctx.save();
      for (let i = 0; i < blades.length; i++) {
        if (quality < 0.5 && i % 3 === 0) continue;
        drawBlade(ctx, blades[i], time, 0.83);
      }
      ctx.drawImage(surface, 0, 0, W, H);
      for (const stem of stems) {
        ctx.save();
        ctx.translate(stem.x, stem.y);
        ctx.rotate(Math.sin(time * 0.36 + stem.phase) * 0.013);
        ctx.drawImage(stem.sprite, -stem.rootX, -stem.rootY, stem.bw, stem.bh);
        ctx.restore();
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
      ctx.restore();
    },
    destroy() {
      destroyed = true;
      surface.width = surface.height = 1;
      for (const stem of stems) stem.sprite.width = stem.sprite.height = 1;
      blades.length = stems.length = front.length = 0;
    },
  };
}
