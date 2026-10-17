/**
 * A procedural, translucent halfmoon betta, rendered in Canvas 2D.
 *
 * drawBetta(context, { x, y, size = 1, heading = 0, turn, tilt, speed = 18, light = 1 }, seconds, detail = 1)
 * `turn` is a continuous side profile: -1 faces left, +1 faces right, 0 faces the viewer.
 * `tilt`, when supplied, is a screen-space angle in radians. Otherwise heading determines tilt.
 * At size 1 the complete fish occupies approximately x [-172, 64], y [-94, 106].
 * `light` is daylight strength from 0 to 1. Cached pigment and body textures need no assets.
 * No external assets, timers, or animation loops.
 */

const PI = Math.PI;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const TAIL_SEGMENTS = 42;
const tailX = new Float32Array(TAIL_SEGMENTS + 1);
const tailY = new Float32Array(TAIL_SEGMENTS + 1);
const analX = new Float32Array(29);
const analY = new Float32Array(29);
const tailFolds = [3, 9, 15, 22, 28, 35, 40];
const analFolds = [0.11, 0.26, 0.43, 0.59, 0.75, 0.92];
let bodyTexture;
let nightBodyTexture;
let pigmentTexture;
let textureAttempted = false;

function randomAt(index) {
  const value = Math.sin(index * 127.173 + 51.379) * 43758.5453;
  return value - Math.floor(value);
}

function smallCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// All pigment granulation is made once; no noise images or per-pixel animation.
function getPigmentTexture() {
  if (pigmentTexture) return pigmentTexture;
  const canvas = smallCanvas(384, 384);
  const ctx = canvas?.getContext('2d');
  if (!ctx) return undefined;
  for (let i = 0; i < 7600; i++) {
    const x = randomAt(i * 3 + 1) * 384;
    const y = randomAt(i * 3 + 2) * 384;
    const value = randomAt(i * 3 + 3);
    ctx.fillStyle = value > 0.48
      ? `rgba(151,210,202,${0.035 + value * 0.07})`
      : `rgba(3,24,53,${0.065 + value * 0.09})`;
    ctx.fillRect(x, y, 0.7 + value * 1.1, 0.45 + value * 0.7);
  }
  pigmentTexture = canvas;
  return canvas;
}

function paintFinGrain(ctx, x, y, width, height) {
  const texture = getPigmentTexture();
  if (!texture) return;
  ctx.save();
  ctx.globalAlpha *= 0.68;
  ctx.drawImage(texture, x, y, width, height);
  ctx.restore();
}

// A few softly shaded folds describe tissue volume; the fine rays are secondary.
function softFold(ctx, x, y, ax, ay, bx, by, ex, ey, width, strength, pearl = false) {
  const shade = ctx.createLinearGradient(x, y, ex, ey);
  shade.addColorStop(0, 'rgba(3,28,53,0)');
  shade.addColorStop(0.4, `rgba(4,27,58,${strength * 0.58})`);
  shade.addColorStop(0.79, `rgba(8,31,59,${strength})`);
  shade.addColorStop(1, 'rgba(8,36,66,0)');
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(ax, ay, bx, by, ex, ey);
  ctx.strokeStyle = shade;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.lineWidth = width * 0.47;
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * 0.53;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  if (pearl) {
    ctx.beginPath();
    ctx.moveTo(x - 1.1, y);
    ctx.bezierCurveTo(ax - 1.5, ay - 1.2, bx - 2.8, by - 1.3, ex, ey);
    const ridge = ctx.createLinearGradient(x, y, ex, ey);
    ridge.addColorStop(0, 'rgba(116,199,188,0)');
    ridge.addColorStop(0.58, `rgba(125,196,197,${strength * 0.66})`);
    ridge.addColorStop(0.86, `rgba(163,209,202,${strength * 0.35})`);
    ridge.addColorStop(1, 'rgba(181,217,213,0)');
    ctx.strokeStyle = ridge;
    ctx.lineWidth = width * 0.43;
    ctx.stroke();
  }
}

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
  body.addColorStop(0, '#112c44');
  body.addColorStop(0.18, '#185872');
  body.addColorStop(0.37, '#388c91');
  body.addColorStop(0.53, '#307e96');
  body.addColorStop(0.72, '#194b77');
  body.addColorStop(0.89, '#132d50');
  body.addColorStop(1, '#111f39');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.clip();

  const shimmer = ctx.createRadialGradient(9, -12, 1, 3, -10, 53);
  shimmer.addColorStop(0, 'rgba(160,213,186,0.38)');
  shimmer.addColorStop(0.38, 'rgba(100,188,179,0.15)');
  shimmer.addColorStop(1, 'rgba(38,94,129,0)');
  ctx.fillStyle = shimmer;
  ctx.fillRect(-59, -33, 126, 64);

  // Irregular scales follow the round flank instead of reading as a stamped grid.
  for (let row = 0; row < 15; row++) {
    const baseY = -24 + row * 3.32;
    for (let column = 0; column < 21; column++) {
      const index = row * 43 + column;
      const noise = randomAt(index);
      const x = -49 + column * 4.25 + (row % 2) * 2.125 + (noise - 0.5) * 1.1;
      if (x > 37) continue;
      const y = baseY + Math.sin((x + 49) * 0.022) * (baseY + 4) * 0.08 + (randomAt(index + 1817) - 0.5) * 0.8;
      const light = Math.max(0, 1 - Math.abs(y + 8) / 31) * (0.055 + noise * 0.16);
      const width = 2.7 + noise * 0.9;
      const height = 1.35 + randomAt(index + 431) * 0.6;
      ctx.beginPath();
      ctx.moveTo(x + 0.6, y - height);
      ctx.bezierCurveTo(x + width + 0.8, y - height, x + width + 1.2, y + height * 0.52, x + 0.5, y + height);
      ctx.strokeStyle = `rgba(3,33,57,${0.065 + noise * 0.17})`;
      ctx.lineWidth = 0.34 + noise * 0.16;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 0.8, y - height - 0.12);
      ctx.quadraticCurveTo(x + width + 0.9, y - height + 0.1, x + width + 0.4, y + height * 0.21);
      ctx.strokeStyle = noise > 0.55 ? `rgba(161,214,187,${light})` : `rgba(112,193,218,${light})`;
      ctx.lineWidth = 0.29 + noise * 0.16;
      ctx.stroke();
      if (noise > 0.37 && y < 16) {
        ctx.beginPath();
        ctx.ellipse(x + width * 0.6, y - 0.4, width * 0.66, height * 0.47, -0.16 + noise * 0.22, 0, PI * 2);
        ctx.fillStyle = noise > 0.8 ? `rgba(181,195,179,${light * 0.71})` : `rgba(80,159,181,${light * 0.9})`;
        ctx.fill();
      }
    }
  }

  for (let i = 0; i < 950; i++) {
    const x = -55 + randomAt(i * 7 + 191) * 112;
    const y = -26 + randomAt(i * 7 + 192) * 53;
    const value = randomAt(i * 7 + 193);
    ctx.fillStyle = value > 0.55 ? 'rgba(150,201,190,0.09)' : 'rgba(5,25,48,0.11)';
    ctx.fillRect(x, y, 0.16 + value * 0.48, 0.12 + value * 0.3);
  }

  const belly = ctx.createLinearGradient(0, 6, 1, 26);
  belly.addColorStop(0, 'rgba(5,25,51,0)');
  belly.addColorStop(0.58, 'rgba(7,24,48,0.1)');
  belly.addColorStop(1, 'rgba(5,18,39,0.48)');
  ctx.fillStyle = belly;
  ctx.fillRect(-59, 6, 124, 24);
  const pearl = ctx.createRadialGradient(5, -15, 0, 3, -12, 34);
  pearl.addColorStop(0, 'rgba(169,211,180,0.11)');
  pearl.addColorStop(0.55, 'rgba(113,182,179,0.045)');
  pearl.addColorStop(1, 'rgba(71,142,161,0)');
  ctx.fillStyle = pearl;
  ctx.fillRect(-42, -30, 85, 50);

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
  gillLight.addColorStop(0.59, 'rgba(92,170,167,0.36)');
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
  ctx.strokeStyle = 'rgba(119,183,172,0.28)';
  ctx.lineWidth = 0.45;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-35, -15.5);
  ctx.bezierCurveTo(-8, -30.4, 24, -25.4, 43, -17.6);
  ctx.strokeStyle = 'rgba(152,207,182,0.23)';
  ctx.lineWidth = 0.5;
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
  const canvas = smallCanvas(width, height);
  if (!canvas) return undefined;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.scale(resolution, resolution);
  context.translate(61, 34);
  paintBody(context);
  bodyTexture = canvas;
  const night = smallCanvas(width, height);
  const nightContext = night?.getContext('2d');
  if (nightContext) {
    nightContext.drawImage(canvas, 0, 0);
    nightContext.globalCompositeOperation = 'source-atop';
    nightContext.fillStyle = 'rgba(5,16,42,0.28)';
    nightContext.fillRect(0, 0, width, height);
    nightBodyTexture = night;
  }
  return canvas;
}

function makeTail(phase, activity) {
  for (let i = 0; i <= TAIL_SEGMENTS; i++) {
    const u = i / TAIL_SEGMENTS;
    const angle = -1.28 + u * 2.59 + Math.sin(u * 21.2 + phase * 0.4) * Math.sin(u * PI) * 0.014;
    const scallop = Math.sin(u * 25.8 + phase * 0.45) * 2.2
      + Math.sin(u * 63.3 - phase * 0.78) * 1.1;
    const flutter = Math.sin(phase * 1.2 - u * 7.2) * (3.1 + activity * 1.35);
    const radius = 103 + Math.sin(u * PI * 1.16) * 7 + scallop;
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
  membrane.addColorStop(0, 'rgba(10,52,79,0.93)');
  membrane.addColorStop(0.28, 'rgba(20,88,132,0.82)');
  membrane.addColorStop(0.59, 'rgba(30,116,147,0.73)');
  membrane.addColorStop(0.86, 'rgba(53,138,154,0.58)');
  membrane.addColorStop(1, 'rgba(96,168,181,0.26)');
  ctx.fillStyle = membrane;
  ctx.fill();

  ctx.save();
  ctx.clip();
  const wine = ctx.createRadialGradient(-85, 43, 4, -92, 35, 83);
  wine.addColorStop(0, 'rgba(114,26,65,0.76)');
  wine.addColorStop(0.45, 'rgba(112,41,91,0.52)');
  wine.addColorStop(0.79, 'rgba(63,69,128,0.19)');
  wine.addColorStop(1, 'rgba(25,111,147,0)');
  ctx.fillStyle = wine;
  ctx.fillRect(-174, -99, 135, 203);

  const transmitted = ctx.createRadialGradient(-119, -43, 2, -119, -39, 68);
  transmitted.addColorStop(0, 'rgba(123,187,184,0.24)');
  transmitted.addColorStop(0.48, 'rgba(86,170,182,0.11)');
  transmitted.addColorStop(1, 'rgba(61,126,167,0)');
  ctx.fillStyle = transmitted;
  ctx.fillRect(-177, -100, 139, 205);
  paintFinGrain(ctx, -177, -101, 139, 202);

  for (let n = 0; n < tailFolds.length; n++) {
    const i = tailFolds[n];
    const u = i / TAIL_SEGMENTS;
    const x = tailX[i];
    const y = tailY[i];
    const bend = Math.sin(phase * 0.91 - u * 6.3) * 4.8;
    const rootY = (u - 0.5) * 12;
    softFold(ctx, -49, rootY, -79, y * 0.21 + bend, x + 29, y * 0.82 + bend,
      x, y, 6 + randomAt(n + 41) * 6.4, 0.075 + randomAt(n + 93) * 0.07, n % 2 === 0);
  }

  const step = detail < 0.7 ? 2 : 1;
  for (let i = 1; i < TAIL_SEGMENTS; i += step) {
    const u = i / TAIL_SEGMENTS;
    const x = tailX[i];
    const y = tailY[i];
    const rootY = (u - 0.5) * 12 + 1;
    const fold = Math.sin(i * 2.17 + 0.5) * 0.5 + 0.5;
    const bend = Math.sin(phase * 1.1 - u * 6.1) * 4
      + Math.sin(u * 23.5 - phase * 0.66) * 1.4;
    ctx.beginPath();
    ctx.moveTo(-52 - fold * 3.8, rootY - 0.4);
    ctx.bezierCurveTo(-81, rootY + y * 0.16 + bend - 0.6, x + 25, y * 0.82 + bend - 0.5, x - 0.15, y - 0.4);
    ctx.strokeStyle = u > 0.57 && u < 0.87
      ? `rgba(192,123,157,${0.075 + fold * 0.13})`
      : `rgba(138,199,203,${0.085 + fold * 0.14})`;
    ctx.lineWidth = 0.24 + fold * 0.25;
    ctx.stroke();
    if (detail > 0.8 && i % 2 === 0) {
      ctx.beginPath();
      ctx.moveTo(x + 35 + fold * 5, y * (0.61 + fold * 0.07));
      ctx.quadraticCurveTo(x + 13, y * 0.91 + bend, x - 0.6, y + 0.65);
      ctx.strokeStyle = 'rgba(158,204,206,0.11)';
      ctx.lineWidth = 0.23;
      ctx.stroke();
    }
  }
  ctx.restore();
  // Only short pieces of the thin, wet edge catch pearl light.
  for (let band = 0; band < 2; band++) {
    const start = band === 0 ? 5 : 28;
    const finish = band === 0 ? 12 : 33;
    ctx.beginPath();
    ctx.moveTo((tailX[start] + tailX[start - 1]) * 0.5, (tailY[start] + tailY[start - 1]) * 0.5);
    for (let i = start; i < finish; i++) {
      ctx.quadraticCurveTo(tailX[i], tailY[i], (tailX[i] + tailX[i + 1]) * 0.5, (tailY[i] + tailY[i + 1]) * 0.5);
    }
    ctx.strokeStyle = band === 0 ? 'rgba(169,206,196,0.16)' : 'rgba(119,187,198,0.11)';
    ctx.lineWidth = 0.38;
    ctx.stroke();
  }
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
  fin.addColorStop(0, 'rgba(8,51,78,0.91)');
  fin.addColorStop(0.39, 'rgba(24,95,126,0.83)');
  fin.addColorStop(0.73, 'rgba(52,131,145,0.63)');
  fin.addColorStop(1, 'rgba(102,166,171,0.27)');
  ctx.fillStyle = fin;
  ctx.fill();
  ctx.save();
  ctx.clip();
  paintFinGrain(ctx, -91, -84, 118, 77);
  for (let i = 0; i < 5; i++) {
    const u = (i + 0.76) / 5.57;
    const endX = 20 - 104 * u;
    const endY = dorsalTop(u, phase);
    const startX = 20 - 63 * u;
    const startY = -22 + Math.max(0, u - 0.3) * 19;
    softFold(ctx, startX, startY, startX - 9, startY - 16, endX + 15, endY + 13,
      endX, endY, 5.7 + randomAt(i + 53) * 4.1, 0.08 + randomAt(i + 73) * 0.065, i % 2 === 0);
  }
  const count = detail < 0.7 ? 14 : 26;
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
    ctx.strokeStyle = `rgba(147,197,185,${0.085 + fold * 0.12})`;
    ctx.lineWidth = 0.22 + fold * 0.22;
    ctx.stroke();
  }
  ctx.restore();
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
  fin.addColorStop(0, 'rgba(9,48,77,0.95)');
  fin.addColorStop(0.31, 'rgba(24,84,130,0.85)');
  fin.addColorStop(0.57, 'rgba(70,51,103,0.79)');
  fin.addColorStop(0.82, 'rgba(116,36,72,0.71)');
  fin.addColorStop(1, 'rgba(86,123,157,0.41)');
  ctx.fillStyle = fin;
  ctx.fill();
  ctx.save();
  ctx.clip();
  paintFinGrain(ctx, -110, 10, 155, 92);
  const transmitted = ctx.createRadialGradient(-57, 63, 1, -52, 65, 46);
  transmitted.addColorStop(0, 'rgba(117,135,170,0.12)');
  transmitted.addColorStop(1, 'rgba(100,103,153,0)');
  ctx.fillStyle = transmitted;
  ctx.fillRect(-113, 14, 155, 88);
  for (let i = 0; i < analFolds.length; i++) {
    const u = analFolds[i];
    const index = Math.round(u * 28);
    const startX = 34 - 81 * u;
    const startY = 18 - u * 9 + Math.sin(u * PI) * 4;
    const bend = Math.sin(phase - u * 5) * 4;
    softFold(ctx, startX, startY, startX - 9, startY + 22, analX[index] + 20 + bend,
      analY[index] - 13, analX[index], analY[index], 6.6 + randomAt(i + 98) * 4.9,
      0.095 + randomAt(i + 127) * 0.06, i % 2 === 0);
  }
  const step = detail < 0.7 ? 2 : 1;
  for (let i = 1; i < 35; i += step) {
    const u = i / 35;
    const index = u * 28;
    const lower = Math.floor(index);
    const fraction = index - lower;
    const endX = analX[lower] + (analX[lower + 1] - analX[lower]) * fraction;
    const endY = analY[lower] + (analY[lower + 1] - analY[lower]) * fraction;
    const startX = 34 - 81 * u;
    const startY = 18 - u * 9 + Math.sin(u * PI) * 4;
    const fold = Math.sin(i * 2.49 + 0.4) * 0.5 + 0.5;
    const bend = Math.sin(phase - u * 5) * 3 + Math.sin(u * 19.7 + phase * 0.8) * 1.6;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(startX - 10, startY + 22, endX + 19 + bend, endY - 13, endX, endY);
    ctx.strokeStyle = u < 0.62
      ? `rgba(188,131,162,${0.075 + fold * 0.13})`
      : `rgba(137,188,200,${0.08 + fold * 0.12})`;
    ctx.lineWidth = 0.23 + fold * 0.23;
    ctx.stroke();
  }
  ctx.restore();
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
  ctx.strokeStyle = 'rgba(181,178,184,0.27)';
  ctx.lineWidth = 0.44;
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

function drawFrontalBody(ctx, turn, light) {
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
  if (light < 1) {
    ctx.fillStyle = `rgba(5,16,42,${(1 - light) * 0.28})`;
    ctx.fill();
  }
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
  const light = clamp(fish.light ?? 1, 0, 1);
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
  ctx.save();
  ctx.globalAlpha *= 0.72 + light * 0.28;
  drawPectoral(ctx, phase, true);
  drawVentral(ctx, phase, true);
  drawTail(ctx, phase, activity, detail);
  drawDorsal(ctx, phase, detail);
  drawAnal(ctx, phase, detail);
  ctx.restore();

  const texture = getBodyTexture();
  if (texture) {
    if (light >= 0.999 || !nightBodyTexture) {
      ctx.drawImage(texture, -61, -34, 130, 68);
    } else {
      ctx.drawImage(nightBodyTexture, -61, -34, 130, 68);
      if (light > 0.001) {
        ctx.save();
        ctx.globalAlpha *= light;
        ctx.drawImage(texture, -61, -34, 130, 68);
        ctx.restore();
      }
    }
  } else paintBody(ctx);

  // A quiet moving specular wash provides life to the cached metallic scale texture.
  ctx.save();
  bodyPath(ctx);
  ctx.clip();
  const glint = ctx.createLinearGradient(-43, -19, 44, 10);
  const brightness = (0.038 + (Math.sin(phase * 0.51) + 1) * 0.016) * (0.52 + light * 0.48);
  glint.addColorStop(0, 'rgba(98,191,205,0)');
  glint.addColorStop(0.44, `rgba(179,228,199,${brightness})`);
  glint.addColorStop(1, 'rgba(86,154,181,0)');
  ctx.fillStyle = glint;
  ctx.fillRect(-58, -31, 121, 60);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha *= 0.72 + light * 0.28;
  drawVentral(ctx, phase, false);
  drawPectoral(ctx, phase, false);
  ctx.restore();
  ctx.restore();
  drawFrontalBody(ctx, turn, light);
  ctx.restore();
}

export default drawBetta;
