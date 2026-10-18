import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

// Exercise the actual Canvas renderer without publishing a test-only application API.
test.beforeEach(async ({ page }) => {
  await page.route('**/__materials__/*', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    if (name === 'fixture') {
      return route.fulfill({ contentType: 'text/html', body: '<canvas width="600" height="400"></canvas>' });
    }
    const files = ['fish.js', 'aquascape.js', 'lighting.js', 'materials.js', 'crossfade.js'];
    if (!files.includes(name)) return route.abort();
    await route.fulfill({ contentType: 'text/javascript',
      body: await readFile(new URL(`../../src/scripts/${name}`, import.meta.url), 'utf8') });
  });
  await page.goto('./__materials__/fixture');
});

for (const ratio of [1, 1.5]) {
  test(`crossfade preserves opaque and translucent coverage at DPR ${ratio}`, async ({ page }) => {
    const samples = await page.evaluate(async ratio => {
      const { createImageCrossfade } = await import('./crossfade.js');
      const ctx = document.querySelector('canvas').getContext('2d');
      ctx.scale(ratio, ratio);
      const paint = (c, day) => {
        const color = day ? '255,0,0' : '0,0,255';
        for (const [x, alpha] of [[0, 1], [4, 0.5], [8, day ? 0.25 : 1], [12, 0.5], [day ? 16 : 20, 1]]) {
          c.fillStyle = `rgba(${color},${alpha})`;
          c.fillRect(x, 0, 4, 4);
        }
        // Overlapping leaves must be composed before applying their scene weight.
        c.fillStyle = `rgba(${color},0.5)`;
        c.fillRect(12, 0, 4, 4);
      };
      const texture = day => {
        const canvas = document.createElement('canvas');
        canvas.width = 24 * ratio; canvas.height = 4 * ratio;
        const c = canvas.getContext('2d');
        c.scale(ratio, ratio);
        paint(c, day);
        return canvas;
      };
      const blend = createImageCrossfade(texture(true), texture(false));
      const frames = [];
      for (let frame = 0; frame < 2; frame++) {
        ctx.clearRect(0, 0, 600, 400);
        blend.get(0.25);
        ctx.drawImage(blend.get(0.5), 0, 0, 24, 4);
        frames.push([0, 4, 8, 12, 16, 20].map(x =>
          Array.from(ctx.getImageData(Math.floor((x + 2) * ratio), Math.floor(2 * ratio), 1, 1).data)));
      }
      blend.destroy();
      return frames;
    }, ratio);
    const expected = [
      [128, 0, 128, 255], [128, 0, 128, 128], [51, 0, 204, 160],
      [128, 0, 128, 192], [255, 0, 0, 128], [0, 0, 255, 128],
    ];
    for (const frame of samples) {
      frame.forEach((pixel, i) => pixel.forEach((channel, j) => {
        expect(Math.abs(channel - expected[i][j]), `patch ${i}, channel ${j}`).toBeLessThanOrEqual(2);
      }));
    }
  });
}

test('metallic reflection changes with facing while night scales remain readable', async ({ page }) => {
  const samples = await page.evaluate(async () => {
    const { drawBetta } = await import('./fish.js');
    const ctx = document.querySelector('canvas').getContext('2d');
    const sample = (turn, light) => {
      ctx.clearRect(0, 0, 600, 400);
      drawBetta(ctx, { x: 300, y: 200, size: 1, turn, tilt: 0, light }, 0);
      const pixels = ctx.getImageData(turn === 1 ? 275 : 324, 187, 1, 1).data;
      const flank = ctx.getImageData(280, 180, 40, 35).data;
      let body = 0;
      for (let i = 0; i < flank.length; i += 4) {
        body += flank[i] * 0.2126 + flank[i + 1] * 0.7152 + flank[i + 2] * 0.0722;
      }
      return { reflection: pixels[0] * 0.2126 + pixels[1] * 0.7152 + pixels[2] * 0.0722, body };
    };
    return { right: sample(1, 1), left: sample(-1, 1), night: sample(1, 0) };
  });
  expect(Math.abs(samples.right.reflection - samples.left.reflection)).toBeGreaterThan(3);
  expect(samples.night.body / samples.right.body).toBeGreaterThan(0.8);
});

test('hardscape and foliage receive their own softer night lighting', async ({ page }) => {
  const samples = await page.evaluate(async () => {
    const { createAquascape } = await import('./aquascape.js');
    const ctx = document.querySelector('canvas').getContext('2d');
    const sample = daylight => {
      ctx.clearRect(0, 0, 600, 400);
      const scape = createAquascape(600, 400, 1, daylight);
      scape.drawBack(ctx, 0);
      scape.drawFront(ctx, 0);
      const data = ctx.getImageData(0, 280, 180, 120).data;
      let light = 0;
      for (let i = 0; i < data.length; i += 4) {
        light += (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) * data[i + 3] / 255;
      }
      scape.destroy();
      return light;
    };
    return { day: sample(1), night: sample(0) };
  });
  expect(samples.night / samples.day).toBeLessThan(0.9);
  expect(samples.night / samples.day).toBeGreaterThan(0.5);
});
