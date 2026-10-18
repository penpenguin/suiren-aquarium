import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

// Exercise the actual Canvas renderer without publishing a test-only application API.
test.beforeEach(async ({ page }) => {
  await page.route('**/__materials__/*', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    if (name === 'fixture') {
      return route.fulfill({ contentType: 'text/html', body: '<canvas width="600" height="400"></canvas>' });
    }
    const files = ['fish.js', 'aquascape.js', 'lighting.js', 'materials.js'];
    if (!files.includes(name)) return route.abort();
    await route.fulfill({ contentType: 'text/javascript',
      body: await readFile(new URL(`../../src/scripts/${name}`, import.meta.url), 'utf8') });
  });
  await page.goto('./__materials__/fixture');
});

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
