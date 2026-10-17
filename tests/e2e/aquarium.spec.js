import { test as base, expect } from '@playwright/test';

const test = base.extend({
  page: async ({ page }, use) => {
    const failures = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) {
        failures.push(`${response.status()} ${response.url()}`);
      }
    });
    await use(page);
    expect(failures, 'Page errors and failed asset responses').toEqual([]);
  },
});

test('renders and animates the aquarium at the Pages subpath', async ({ page }) => {
  const response = await page.goto('./');
  expect(response.ok()).toBe(true);
  await expect(page).toHaveTitle('水縁 — SUIREN');
  const canvas = page.locator('#water');
  await expect(canvas).toBeVisible();
  expect(await canvas.boundingBox()).toEqual({ x: 0, y: 0, width: 960, height: 640 });
  await expect.poll(() => page.evaluate(() => window.suiren?.state.elapsed)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.suiren.state.running)).toBe(true);
  const pixel = await canvas.evaluate((element) => {
    return Array.from(element.getContext('2d').getImageData(480, 320, 1, 1).data);
  });
  expect(pixel.slice(0, 3).some((channel) => channel > 0)).toBe(true);
  const iconURL = await page.locator('link[rel="icon"]').evaluate((element) => element.href);
  expect(new URL(iconURL).pathname).toBe('/suiren-aquarium/favicon.svg');
  const icon = await page.request.get(iconURL);
  expect(icon.ok()).toBe(true);
  expect(icon.headers()['content-type']).toContain('image/svg+xml');
});

test('pauses with Space and resumes with the pause button', async ({ page }) => {
  await page.goto('./');
  await page.locator('#water').focus();
  await page.keyboard.press('Space');
  const button = page.getByRole('button', { name: '泳ぎを再開' });
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.suiren.state)).toMatchObject({ paused: true, running: false });
  await button.click();
  await expect(page.getByRole('button', { name: '動きを一時停止' })).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.suiren.state)).toMatchObject({ paused: false, running: true });
});

for (const input of ['click', 'F', 'Enter']) {
  test(`feeding with ${input} adds food and resumes a paused aquarium`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');
    await expect(page.getByRole('button', { name: '泳ぎを再開' })).toHaveAttribute('aria-pressed', 'true');
    const canvas = page.locator('#water');
    if (input === 'click') {
      await canvas.click({ position: { x: 480, y: 240 } });
    } else {
      await canvas.focus();
      await page.keyboard.press(input);
    }
    await expect.poll(() => page.evaluate(() => window.suiren.state.pellets)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.suiren.state)).toMatchObject({ paused: false, running: true });
  });
}

test('respects reduced motion until the user starts playback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  const button = page.getByRole('button', { name: '泳ぎを再開' });
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.suiren.state)).toMatchObject({ paused: true, running: false, elapsed: 0 });
  await button.click();
  await expect.poll(() => page.evaluate(() => window.suiren.state.elapsed)).toBeGreaterThan(0);
});
