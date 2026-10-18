export const scenes = [
  { name: 'desktop-day', width: 1440, height: 900, hour: 12 },
  { name: 'desktop-night', width: 1440, height: 900, hour: 22 },
  { name: 'mobile-day', width: 390, height: 844, hour: 12 },
  { name: 'mobile-night', width: 390, height: 844, hour: 22 },
];

export async function prepareScene(page, scene) {
  await page.setViewportSize({ width: scene.width, height: scene.height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ hour }) => {
    const RealDate = Date;
    const fixed = new RealDate(`2026-10-18T${hour}:00:00+09:00`).getTime();
    window.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [fixed])); }
      static now() { return fixed; }
    };
    let seed = 93217;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  }, scene);
}
