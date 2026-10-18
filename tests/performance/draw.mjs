// Run against a built preview: node tests/performance/draw.mjs [baseURL]
// This measures the same render() interval as suiren.state.drawMs, before smoothing.
import { chromium } from 'playwright';
import { scenes, prepareScene } from '../support/scene.js';

const baseURL = process.argv[2] ?? 'http://127.0.0.1:4321/suiren-aquarium/';
const browser = await chromium.launch({ headless: true });
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const results = [];
try {
  for (const scene of scenes) {
    const context = await browser.newContext({ timezoneId: 'Asia/Tokyo', deviceScaleFactor: 1 });
    const page = await context.newPage();
    await prepareScene(page, scene);
    await page.addInitScript(() => {
      const now = performance.now.bind(performance);
      const raf = window.requestAnimationFrame.bind(window);
      let timestamps = null;
      window.drawSamples = [];
      performance.now = () => {
        const value = now();
        timestamps?.push(value);
        return value;
      };
      window.requestAnimationFrame = callback => raf(time => {
        timestamps = [];
        callback(time);
        if (timestamps.length === 2) window.drawSamples.push(timestamps[1] - timestamps[0]);
        timestamps = null;
      });
    });
    await page.goto(baseURL);
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '泳ぎを再開' }).click();
    await page.waitForFunction(() => window.drawSamples.length >= 300, undefined, { timeout: 30000 });
    const samples = await page.evaluate(() => window.drawSamples.slice(60, 300));
    results.push({ scene: scene.name, samples: samples.length, medianMs: +median(samples).toFixed(3) });
    await context.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
