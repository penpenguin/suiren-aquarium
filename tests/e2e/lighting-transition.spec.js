import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Asia/Tokyo', viewport: { width: 600, height: 400 }, reducedMotion: 'reduce' });

test('opaque substrate hides the backdrop throughout the dawn crossfade', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-18T06:40:00+09:00'));
  await page.addInitScript(() => {
    // Change only the two water backdrops, keeping the real plants, substrate,
    // lighting and app composition. Opaque gravel must hide either backdrop.
    const prototype = CanvasRenderingContext2D.prototype;
    const setTransform = prototype.setTransform;
    const drawImage = prototype.drawImage;
    window.testBackdrop = '#000';
    prototype.setTransform = function (...args) {
      if (this.canvas.id === 'water') this.backdropDraws = 0;
      return setTransform.apply(this, args);
    };
    prototype.drawImage = function (...args) {
      if (this.canvas.id === 'water' && this.backdropDraws++ < 2) {
        this.save();
        this.fillStyle = window.testBackdrop;
        this.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.restore();
        return;
      }
      return drawImage.apply(this, args);
    };
    Math.random = () => 0.5;
  });
  await page.goto('./');
  await expect.poll(() => page.evaluate(() => window.suiren?.state.width)).toBe(600);
  await page.waitForTimeout(300);

  for (const time of ['06:40:00', '07:00:00', '07:20:00']) {
    await page.clock.setFixedTime(new Date(`2026-10-18T${time}+09:00`));
    const change = await page.evaluate(() => {
      const ctx = document.getElementById('water').getContext('2d');
      const sample = color => {
        window.testBackdrop = color;
        document.dispatchEvent(new Event('visibilitychange'));
        return { floor: ctx.getImageData(290, 390, 20, 4).data,
          water: ctx.getImageData(300, 240, 1, 1).data };
      };
      const black = sample('#000'), white = sample('#fff');
      const delta = (a, b) => Math.max(...a.map((channel, i) => Math.abs(channel - b[i])));
      return { floor: delta(black.floor, white.floor), water: delta(black.water, white.water),
        daylight: window.suiren.state.daylight };
    });
    expect(change.daylight).toBeGreaterThan(0);
    expect(change.daylight).toBeLessThan(1);
    expect(change.water, 'The injected backdrop visibly changes the open water').toBeGreaterThan(100);
    expect(change.floor, `Gravel must remain opaque at ${time}`).toBeLessThanOrEqual(1);
  }
});

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
