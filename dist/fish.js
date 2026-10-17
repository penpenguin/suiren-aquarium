/**
 * A procedural, translucent halfmoon betta, rendered in Canvas 2D.
 *
 * drawBetta(context, { x, y, size = 1, heading = 0, turn, tilt, speed = 18 }, seconds, detail = 1)
 * `turn` is a continuous side profile: -1 faces left, +1 faces right, 0 faces the viewer.
 * `tilt`, when supplied, is a screen-space angle in radians. Otherwise heading determines tilt.
 * At size 1 the complete fish occupies approximately x [-172, 64], y [-94, 106].
 * No external assets, timers, or animation loops. The small, static body texture is cached.
 */

const PI = Math.PI;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const TAIL_SEGMENTS = 42;
const tailX = new Float32Array(TAIL_SEGMENTS + 1);
const tailY = new Float32Array(TAIL_SEGMENTS + 1);
const analX = new Float32Array(29);
const analY = new Float32Array(29);
let bodyTexture;
let textureAttempted = false;

function bodyPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(62, 1.3);
  ctx.bezierCurveTo(61.5, -3.1, 57.2, -7.1, 52.5, -12.2);
  ctx.bezierCurveTo(44.1, -23.6, 15.1, -29.6, -8.8, -24.4);
  ctx.bezierCurveTo(-25.1, -21.5, -39.3, -12, -50.6, -7.1);
  ctx.bezierCurveTo(-56.9, -5, -57.1, 2, -52.2, 6.1);
  ctx.bezierCurveTo(-46.7, 10.4, -33.7, 10.6, -22.5, 16.4);
  ctx.bezierCurveTo(-5.6, 25, 20.4, 25.9, 39.4, 17.5);
  ctx.bezierCurveTo(51.5, 12.3, 60, 7.9, 62, 1.3);
  ctx.closePath();
}

function paintBody(ctx) {
  ctx.save();
  bodyPath(ctx);
  const body = ctx.createLinearGradient(-5, -27, 12, 27);
  body.addColorStop(0, '#123e49');
  body.addColorStop(0.23, '#176879');
  body.addColorStop(0.43, '#469c9c');
  body.addColorStop(0.59, '#287985');
  body.addColorStop(0.8, '#174b64');
  body.addColorStop(1, '#123049');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.clip();

  const shimmer = ctx.createRadialGradient(9, -12, 1, 3, -10, 53);
  shimmer.addColorStop(0, 'rgba(150,222,190,0.44)');
  shimmer.addColorStop(0.38, 'rgba(91,196,184,0.14)');
  shimmer.addColorStop(1, 'rgba(38,94,129,0)');
  ctx.fillStyle = shimmer;
  ctx.fillRect(-59, -33, 126, 64);

  // Small overlapping crescents catch the light without looking like a pattern of dots.
  for (let row = 0; row < 11; row++) {
    const y = -23 + row * 4.25;
    for (let column = 0; column < 14; column++) {
      const x = -45 + column * 6.05 + (row % 2) * 3.025;
      if (x > 36) continue;
      const noise = Math.sin(row * 31.731 + column * 17.127) * 0.5 + 0.5;
      const light = (1 - Math.abs(y + 6) / 41) * (0.12 + noise * 0.18);
      ctx.beginPath();
      ctx.moveTo(x + 1.4, y - 1.65);
      ctx.bezierCurveTo(x + 5.6, y - 1.4, x + 5.5, y + 1.35, x + 1.4, y + 2.25);
      ctx.strokeStyle = `rgba(2,39,62,${0.13 + noise * 0.12})`;
      ctx.lineWidth = 0.63;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 1.15, y - 1.95);
      ctx.quadraticCurveTo(x + 4.7, y - 1.5, x + 4.05, y + 0.2);
      ctx.strokeStyle = `rgba(155,224,191,${light})`;
      ctx.lineWidth = 0.58;
      ctx.stroke();
      if (noise > 0.66 && y < 11) {
        ctx.beginPath();
        ctx.ellipse(x + 2.1, y - 0.6, 1.65, 0.78, -0.2, 0, PI * 2);
        ctx.fillStyle = `rgba(89,179,184,${0.09 + noise * 0.1})`;
        ctx.fill();
      }
    }
  }

  // The relatively dark head is important to the natural metallic coloration.
  const head = ctx.createRadialGradient(57, -4, 4, 51, -4, 36);
  head.addColorStop(0, 'rgba(8,28,42,0.93)');
  head.addColorStop(0.48, 'rgba(10,42,54,0.87)');
  head.addColorStop(0.79, 'rgba(16,60,72,0.49)');
  head.addColorStop(1, 'rgba(12,67,78,0)');
  ctx.fillStyle = head;
  ctx.fillRect(11, -31, 54, 57);

  const gillLight = ctx.createLinearGradient(19, 0, 35, 0);
  gillLight.addColorStop(0, 'rgba(67,164,164,0)');
  gillLight.addColorStop(0.59, 'rgba(75,177,169,0.48)');
  gillLight.addColorStop(1, 'rgba(25,78,94,0)');
  ctx.fillStyle = gillLight;
  ctx.beginPath();
  ctx.moveTo(31, -16.5);
  ctx.bezierCurveTo(20, -15, 14, 10, 29.5, 18.3);
  ctx.bezierCurveTo(34, 8, 36, -5, 31, -16.5);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(31, -17.2);
  ctx.bezierCurveTo(20.5, -7.7, 20.2, 9.7, 30.4, 17.3);
  ctx.strokeStyle = 'rgba(5,34,48,0.66)';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(30.4, -14.8);
  ctx.bezierCurveTo(23.8, -6.8, 23.7, 9, 29.3, 13.2);
  ctx.strokeStyle = 'rgba(112,198,183,0.36)';
  ctx.lineWidth = 0.55;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-35, -15.5);
  ctx.bezierCurveTo(-8, -30.4, 24, -25.4, 43, -17.6);
  ctx.strokeStyle = 'rgba(127,216,183,0.31)';
  ctx.lineWidth = 0.72;
  ctx.stroke();

  // Modest eye size, with a muted iris and a single wet highlight.
  const eye = ctx.createRadialGradient(48.4, -9.25, 0.3, 47.9, -8.4, 3.9);
  eye.addColorStop(0, '#89998d');
  eye.addColorStop(0.55, '#748b81');
  eye.addColorStop(0.76, '#38575c');
  eye.addColorStop(1, '#0b2533');
  ctx.beginPath();
  ctx.ellipse(47.9, -8.4, 3.85, 3.5, -0.16, 0, PI * 2);
  ctx.fillStyle = eye;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(48.3, -8.5, 2.32, 2.56, 0.04, 0, PI * 2);
  ctx.fillStyle = '#040e19';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(49.05, -9.75, 0.65, 0, PI * 2);
  ctx.fillStyle = 'rgba(222,236,222,0.8)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(61.4, 1.1);
  ctx.quadraticCurveTo(59.5, 2.55, 55.6, 2.75);
  ctx.strokeStyle = 'rgba(3,22,34,0.83)';
  ctx.lineWidth = 0.85;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(59.5, 3.7);
  ctx.quadraticCurveTo(57.9, 4.5, 55.8, 4.35);
  ctx.strokeStyle = 'rgba(116,162,155,0.36)';
  ctx.lineWidth = 0.52;
  ctx.stroke();
  ctx.restore();
}

function getBodyTexture() {
  if (textureAttempted) return bodyTexture;
  textureAttempted = true;
  const resolution = 3;
  const width = 130 * resolution;
  const height = 68 * resolution;
  let canvas;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(width, height);
  } else if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
  }
  if (!canvas) return undefined;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.scale(resolution, resolution);
  context.translate(61, 34);
  paintBody(context);
  bodyTexture = canvas;
  return canvas;
}

function makeTail(phase, activity) {
  for (let i = 0; i <= TAIL_SEGMENTS; i++) {
    const u = i / TAIL_SEGMENTS;
    const angle = -1.28 + u * 2.59 + Math.sin(u * 21.2 + phase * 0.4) * Math.sin(u * PI) * 0.014;
    const scallop = Math.sin(u * 25.8 + phase * 0.45) * 2.2
      + Math.sin(u * 63.3 - phase * 0.78) * 1.1;
    const flutter = Math.sin(phase * 1.2 - u * 7.2) * (3.1 + activity * 1.35);
    const radius = 106 + Math.sin(u * PI) * 4.5 + scallop;
    tailX[i] = -49 - Math.cos(angle) * radius + flutter * (0.3 + Math.sin(u * PI) * 0.7);
    tailY[i] = Math.sin(angle) * radius * 0.81 + Math.sin(phase - u * 3.8) * 4.7 + 2;
  }
}

function tailPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-46, -7);
  ctx.bezierCurveTo(-62, -19, -57, -49, tailX[0] + 8, tailY[0] + 9);
  ctx.quadraticCurveTo(tailX[0] + 3, tailY[0] - 1, (tailX[0] + tailX[1]) * 0.5, (tailY[0] + tailY[1]) * 0.5);
  for (let i = 1; i < TAIL_SEGMENTS; i++) {
    ctx.quadraticCurveTo(tailX[i], tailY[i], (tailX[i] + tailX[i + 1]) * 0.5, (tailY[i] + tailY[i + 1]) * 0.5);
  }
  ctx.quadraticCurveTo(tailX[TAIL_SEGMENTS], tailY[TAIL_SEGMENTS], tailX[TAIL_SEGMENTS] + 5, tailY[TAIL_SEGMENTS] - 7);
  ctx.bezierCurveTo(-56, 47, -60, 17, -45, 8);
  ctx.closePath();
}

function drawTail(ctx, phase, activity, detail) {
  makeTail(phase, activity);
  tailPath(ctx);
  const membrane = ctx.createLinearGradient(-47, 0, -169, 0);
  membrane.addColorStop(0, 'rgba(11,70,96,0.91)');
  membrane.addColorStop(0.3, 'rgba(21,117,146,0.77)');
  membrane.addColorStop(0.73, 'rgba(38,148,172,0.66)');
  membrane.addColorStop(1, 'rgba(70,147,182,0.38)');
  ctx.fillStyle = membrane;
  ctx.fill();

  ctx.save();
  ctx.clip();
  const wine = ctx.createRadialGradient(-85, 43, 4, -92, 35, 83);
  wine.addColorStop(0, 'rgba(129,31,61,0.79)');
  wine.addColorStop(0.45, 'rgba(116,38,82,0.53)');
  wine.addColorStop(0.79, 'rgba(48,75,135,0.15)');
  wine.addColorStop(1, 'rgba(25,111,147,0)');
  ctx.fillStyle = wine;
  ctx.fillRect(-174, -99, 135, 203);

  const step = detail < 0.7 ? 2 : 1;
  for (let i = 1; i < TAIL_SEGMENTS; i += step) {
    const u = i / TAIL_SEGMENTS;
    const x = tailX[i];
    const y = tailY[i];
    const rootY = (u - 0.5) * 12 + 1;
    const fold = Math.sin(i * 2.17 + 0.5) * 0.5 + 0.5;
    const bend = Math.sin(phase * 1.1 - u * 6.1) * 4
      + Math.sin(u * 23.5 - phase * 0.66) * 1.4;
    // Broad shadows between rays give the very thin membrane a little folded volume.
    ctx.beginPath();
    ctx.moveTo(-49, rootY);
    ctx.bezierCurveTo(-79, rootY + y * 0.15 + bend, x + 26, y * 0.81 + bend, x, y);
    ctx.strokeStyle = `rgba(4,48,77,${0.12 + fold * 0.12})`;
    ctx.lineWidth = 1.45 + fold * 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-50, rootY - 0.4);
    ctx.bezierCurveTo(-81, rootY + y * 0.16 + bend - 0.6, x + 25, y * 0.82 + bend - 0.5, x - 0.15, y - 0.4);
    ctx.strokeStyle = u > 0.57 && u < 0.87
      ? `rgba(211,121,147,${0.22 + fold * 0.15})`
      : `rgba(128,212,218,${0.24 + fold * 0.16})`;
    ctx.lineWidth = 0.4 + fold * 0.22;
    ctx.stroke();
    if (detail > 0.8 && i % 2 === 0) {
      ctx.beginPath();
      ctx.moveTo(x + 31, y * 0.72);
      ctx.quadraticCurveTo(x + 15, y * 0.94 + bend, x, y);
      ctx.strokeStyle = 'rgba(156,213,221,0.21)';
      ctx.lineWidth = 0.4;
      ctx.stroke();
    }
  }
  ctx.restore();
  tailPath(ctx);
  ctx.strokeStyle = 'rgba(128,204,211,0.29)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

function dorsalTop(u, phase) {
  return -24 - Math.sin(u * PI * 0.79) * 48
    + Math.sin(u * 10 - phase * 1.15) * 4 * u
    + Math.sin(u * 33.1 - phase * 0.93) * 1.2 * Math.sin(u * PI);
}

function dorsalPath(ctx, phase) {
  ctx.beginPath();
  ctx.moveTo(20, -22);
  for (let i = 0; i < 23; i++) {
    const u = i / 23;
    const next = (i + 1) / 23;
    ctx.quadraticCurveTo(20 - 104 * u, dorsalTop(u, phase), 20 - 104 * (u + next) * 0.5,
      (dorsalTop(u, phase) + dorsalTop(next, phase)) * 0.5);
  }
  ctx.quadraticCurveTo(-84, dorsalTop(1, phase), -81, dorsalTop(1, phase) + 7);
  ctx.bezierCurveTo(-72, -32, -59, -21, -45, -7);
  ctx.bezierCurveTo(-29, -22, -5, -29, 20, -22);
  ctx.closePath();
}

function drawDorsal(ctx, phase, detail) {
  dorsalPath(ctx, phase);
  const fin = ctx.createLinearGradient(-16, -18, -51, -77);
  fin.addColorStop(0, 'rgba(10,63,83,0.91)');
  fin.addColorStop(0.44, 'rgba(24,124,137,0.78)');
  fin.addColorStop(0.84, 'rgba(70,154,166,0.57)');
  fin.addColorStop(1, 'rgba(64,135,157,0.24)');
  ctx.fillStyle = fin;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const count = detail < 0.7 ? 11 : 19;
  for (let i = 1; i < count; i++) {
    const u = i / count;
    const endX = 20 - 104 * u;
    const endY = dorsalTop(u, phase);
    const startX = 20 - 63 * u;
    const startY = -22 + Math.max(0, u - 0.3) * 19;
    const fold = Math.sin(i * 1.73) * 0.5 + 0.5;
    const bend = Math.sin(u * 16.4 - phase) * 1.9;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(startX - 10, startY - 17, endX + 15 + bend, endY + 15, endX, endY);
    ctx.strokeStyle = `rgba(2,47,65,${0.15 + fold * 0.11})`;
    ctx.lineWidth = 1.7 + fold * 0.8;
    ctx.stroke();
    ctx.strokeStyle = `rgba(141,211,200,${0.24 + fold * 0.15})`;
    ctx.lineWidth = 0.43 + fold * 0.17;
    ctx.stroke();
  }
  ctx.restore();
  dorsalPath(ctx, phase);
  ctx.strokeStyle = 'rgba(136,206,195,0.28)';
  ctx.lineWidth = 0.65;
  ctx.stroke();
}

function makeAnal(phase) {
  for (let i = 0; i < 29; i++) {
    const u = i / 28;
    analX[i] = 35 - 134 * u + Math.sin(phase - u * 5) * 2.3 * u;
    analY[i] = 17 + Math.sin(u * PI * 0.86) * 70
      + Math.sin(u * 13.8 - phase * 1.3) * 3.2 * Math.sin(u * PI)
      + Math.sin(u * 35.6 + phase * 0.88) * 1.15 * Math.sin(u * PI);
  }
}

function analPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(35, 17);
  for (let i = 0; i < 28; i++) {
    ctx.quadraticCurveTo(analX[i], analY[i], (analX[i] + analX[i + 1]) * 0.5, (analY[i] + analY[i + 1]) * 0.5);
  }
  ctx.quadraticCurveTo(analX[28], analY[28], analX[28] + 5, analY[28] - 7);
  ctx.bezierCurveTo(-80, 33, -58, 18, -47, 8);
  ctx.bezierCurveTo(-20, 24, 13, 24, 35, 17);
  ctx.closePath();
}

function drawAnal(ctx, phase, detail) {
  makeAnal(phase);
  analPath(ctx);
  const fin = ctx.createLinearGradient(5, 15, -29, 94);
  fin.addColorStop(0, 'rgba(12,70,93,0.94)');
  fin.addColorStop(0.32, 'rgba(24,106,143,0.87)');
  fin.addColorStop(0.58, 'rgba(85,57,111,0.78)');
  fin.addColorStop(0.83, 'rgba(130,42,73,0.71)');
  fin.addColorStop(1, 'rgba(60,115,160,0.48)');
  ctx.fillStyle = fin;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const step = detail < 0.7 ? 2 : 1;
  for (let i = 1; i < 28; i += step) {
    const u = i / 28;
    const startX = 34 - 81 * u;
    const startY = 18 - u * 9 + Math.sin(u * PI) * 4;
    const fold = Math.sin(i * 2.49 + 0.4) * 0.5 + 0.5;
    const bend = Math.sin(phase - u * 5) * 3 + Math.sin(u * 19.7 + phase * 0.8) * 1.6;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(startX - 10, startY + 22, analX[i] + 19 + bend, analY[i] - 13, analX[i], analY[i]);
    ctx.strokeStyle = `rgba(7,41,73,${0.15 + fold * 0.11})`;
    ctx.lineWidth = 1.8 + fold * 0.85;
    ctx.stroke();
    ctx.strokeStyle = u < 0.62
      ? `rgba(195,137,163,${0.24 + fold * 0.14})`
      : `rgba(127,198,209,${0.23 + fold * 0.14})`;
    ctx.lineWidth = 0.4 + fold * 0.2;
    ctx.stroke();
  }
  ctx.restore();
  analPath(ctx);
  ctx.strokeStyle = 'rgba(125,187,201,0.31)';
  ctx.lineWidth = 0.57;
  ctx.stroke();
}

function drawVentral(ctx, phase, far) {
  const originX = far ? 31 : 26;
  const originY = far ? 15 : 19;
  const length = far ? 66 : 84;
  const flutter = Math.sin(phase * 1.45 + (far ? 1.3 : 0)) * 5;
  const endX = originX - 32 + flutter;
  const endY = originY + length;
  const fin = ctx.createLinearGradient(originX, originY, endX, endY);
  fin.addColorStop(0, 'rgba(24,82,100,0.9)');
  fin.addColorStop(0.25, 'rgba(138,45,66,0.8)');
  fin.addColorStop(0.72, 'rgba(167,72,92,0.71)');
  fin.addColorStop(0.91, 'rgba(156,171,184,0.61)');
  fin.addColorStop(1, 'rgba(196,219,217,0.27)');
  ctx.beginPath();
  ctx.moveTo(originX + 2, originY - 2);
  ctx.bezierCurveTo(originX + 1, originY + 30, endX + 12, endY - 8, endX, endY);
  ctx.bezierCurveTo(endX + 5, endY - 20, originX - 13, originY + 22, originX - 5, originY);
  ctx.closePath();
  ctx.fillStyle = fin;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(originX, originY + 4);
  ctx.bezierCurveTo(originX - 5, originY + 34, endX + 9, endY - 13, endX, endY);
  ctx.strokeStyle = 'rgba(198,179,182,0.41)';
  ctx.lineWidth = 0.65;
  ctx.stroke();
}

function drawPectoral(ctx, phase, far = false) {
  ctx.save();
  ctx.translate(far ? 30 : 26, far ? 3 : 7);
  ctx.rotate(-0.08 + Math.sin(phase * 3.1 + (far ? PI : 0)) * 0.39);
  ctx.scale(0.59 + (Math.sin(phase * 3.1 + 1) + 1) * 0.19, 1);
  ctx.globalAlpha *= far ? 0.45 : 0.86;
  const fin = ctx.createLinearGradient(0, 0, -25, 23);
  fin.addColorStop(0, 'rgba(33,99,115,0.64)');
  fin.addColorStop(0.46, 'rgba(134,179,177,0.29)');
  fin.addColorStop(1, 'rgba(180,211,199,0.06)');
  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.bezierCurveTo(-10, -5, -24, 1, -27, 17);
  ctx.bezierCurveTo(-30, 31, -17, 33, -7, 19);
  ctx.quadraticCurveTo(-1, 10, 0, -1);
  ctx.fillStyle = fin;
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const u = i / 6;
    ctx.beginPath();
    ctx.moveTo(-1, 2);
    ctx.quadraticCurveTo(-10 - u * 10, 3 + u * 8, -24 + Math.sin(u * PI * 0.9) * 7, 7 + u * 22);
    ctx.strokeStyle = 'rgba(154,201,190,0.25)';
    ctx.lineWidth = 0.46;
    ctx.stroke();
  }
  ctx.restore();
}

function drawFrontalBody(ctx, turn) {
  const amount = clamp((0.57 - Math.abs(turn)) / 0.57, 0, 1);
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha *= amount;
  const center = 42 * turn;
  const width = 10.9 + amount * 2.9;
  const gradient = ctx.createLinearGradient(center - width, 0, center + width, 0);
  gradient.addColorStop(0, 'rgba(12,47,64,0.65)');
  gradient.addColorStop(0.3, '#246e79');
  gradient.addColorStop(0.57, '#315d65');
  gradient.addColorStop(1, '#102f43');
  ctx.beginPath();
  ctx.ellipse(center, -0.5, width, 21.3, 0, 0, PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.fillStyle = 'rgba(4,19,29,0.87)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(center + side * width * 0.75, -7.1, 1.7, 2.1, side * 0.2, 0, PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(center - 2.2, 4);
  ctx.quadraticCurveTo(center, 5, center + 2.2, 4);
  ctx.strokeStyle = 'rgba(3,26,36,0.73)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.restore();
}

export function drawBetta(ctx, fish, time, detail = 1) {
  const size = Math.max(0.01, fish.size ?? 1);
  const heading = fish.heading ?? 0;
  const turn = clamp(fish.turn ?? Math.cos(heading), -1, 1);
  let tilt = fish.tilt;
  if (tilt === undefined) {
    tilt = heading - (Math.cos(heading) < 0 ? PI : 0);
    tilt = Math.atan2(Math.sin(tilt), Math.cos(tilt));
    tilt = clamp(tilt, -0.36, 0.36);
  }
  const activity = clamp(Math.abs(fish.speed ?? 18) / 54, 0, 1.25);
  // Keep phase independent of instantaneous speed: acceleration must never jump the fins.
  const phase = time * 1.68;
  ctx.save();
  ctx.translate(fish.x, fish.y);
  ctx.rotate(tilt);
  ctx.scale(size, size);
  if (fish.opacity !== undefined) ctx.globalAlpha *= clamp(fish.opacity, 0, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.save();
  ctx.scale(turn, 1 - (1 - Math.abs(turn)) * 0.035);
  drawPectoral(ctx, phase, true);
  drawVentral(ctx, phase, true);
  drawTail(ctx, phase, activity, detail);
  drawDorsal(ctx, phase, detail);
  drawAnal(ctx, phase, detail);

  const texture = getBodyTexture();
  if (texture) ctx.drawImage(texture, -61, -34, 130, 68);
  else paintBody(ctx);

  // A quiet moving specular wash provides life to the cached metallic scale texture.
  ctx.save();
  bodyPath(ctx);
  ctx.clip();
  const glint = ctx.createLinearGradient(-43, -19, 44, 10);
  const brightness = 0.045 + (Math.sin(phase * 0.51) + 1) * 0.018;
  glint.addColorStop(0, 'rgba(98,191,205,0)');
  glint.addColorStop(0.44, `rgba(179,228,199,${brightness})`);
  glint.addColorStop(1, 'rgba(86,154,181,0)');
  ctx.fillStyle = glint;
  ctx.fillRect(-58, -31, 121, 60);
  ctx.restore();
  drawVentral(ctx, phase, false);
  drawPectoral(ctx, phase, false);
  ctx.restore();
  drawFrontalBody(ctx, turn);
  ctx.restore();
}

export default drawBetta;
