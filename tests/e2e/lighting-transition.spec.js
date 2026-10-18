import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Asia/Tokyo', viewport: { width: 600, height: 400 }, reducedMotion: 'reduce' });

// These five-second intervals straddle daylight = 0.001, where the day plants
// previously switched between full opacity and invisible.
for (const [name, before, after] of [
  ['dawn', '06:02:10', '06:02:15'],
  ['dusk', '19:56:40', '19:56:45'],
]) {
  test(`foliage fades continuously at ${name}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(`2026-10-18T${before}+09:00`));
    await page.addInitScript(() => {
      let seed = 93217;
      Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    });
    await page.goto('./');
    await expect.poll(() => page.evaluate(() => window.suiren?.state.width)).toBe(600);
    // Settle the initial debounced resize before comparing the same frozen scene.
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const canvas = document.getElementById('water');
      window.beforeFoliage = canvas.getContext('2d').getImageData(0, 140, 210, 260).data;
    });

    await page.clock.setFixedTime(new Date(`2026-10-18T${after}+09:00`));
    const largestChange = await page.evaluate(() => {
      // Returning to the tab refreshes the existing clock even while paused.
      document.dispatchEvent(new Event('visibilitychange'));
      const pixels = document.getElementById('water').getContext('2d').getImageData(0, 140, 210, 260).data;
      let delta = 0;
      for (let i = 0; i < pixels.length; i++) {
        delta = Math.max(delta, Math.abs(pixels[i] - window.beforeFoliage[i]));
      }
      return delta;
    });
    expect(await page.evaluate(() => window.suiren.state)).toMatchObject({ paused: true, elapsed: 0 });
    expect(largestChange, 'No abrupt change in any foliage color channel over five seconds').toBeLessThanOrEqual(2);
  });
}
