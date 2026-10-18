import { test, expect } from '@playwright/test';
import { scenes, prepareScene } from '../support/scene.js';

test.use({ timezoneId: 'Asia/Tokyo', deviceScaleFactor: 1 });

for (const scene of scenes) {
  test(`materials: ${scene.name}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await prepareScene(page, scene);
    await page.goto('./');
    await expect.poll(() => page.evaluate(() => window.suiren?.state.width)).toBe(scene.width);
    // Let the initial ResizeObserver's debounced resize finish while motion is paused.
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.suiren.state)).toMatchObject({
      paused: true, elapsed: 0, daylight: scene.hour === 12 ? 1 : 0,
    });
    await expect(page.locator('#water')).toHaveScreenshot(`${scene.name}.png`, {
      threshold: 0.08,
      maxDiffPixelRatio: 0.002,
    });
    expect(errors).toEqual([]);
  });
}
