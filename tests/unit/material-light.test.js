import { describe, expect, it } from 'vitest';
import { getSceneLight, getSurfaceLight } from '../../src/scripts/lighting.js';

describe('directional material light', () => {
  it('lights from the upper left by day and the upper right by night', () => {
    const day = getSceneLight(1), night = getSceneLight(0);
    expect(day.x).toBeLessThan(0);
    expect(night.x).toBeGreaterThan(0);
    expect(day.y).toBeLessThan(0);
    expect(night.y).toBeLessThan(0);
    expect(day.sourceX).toBeCloseTo(0.26);
    expect(night.sourceX).toBeCloseTo(0.74);
    expect(Math.hypot(day.x, day.y)).toBeCloseTo(1);
  });

  it('keeps night materials visible and clamps daylight to its endpoints', () => {
    expect(getSceneLight(0).ambient).toBeGreaterThanOrEqual(0.7);
    expect(getSceneLight(1).ambient).toBe(1);
    expect(getSceneLight(-1)).toEqual(getSceneLight(0));
    expect(getSceneLight(2)).toEqual(getSceneLight(1));
  });

  it('moves the highlight continuously through dusk', () => {
    for (let daylight = 0; daylight < 1; daylight += 0.01) {
      const before = getSceneLight(daylight), after = getSceneLight(daylight + 0.001);
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(0.002);
      expect(Math.hypot(before.x, before.y)).toBeCloseTo(1);
    }
  });

  it('keeps the light in world space when a fish turns or a leaf rotates', () => {
    const right = getSurfaceLight(1, 0, 1), left = getSurfaceLight(1, 0, -1);
    expect(left.x).toBeCloseTo(-right.x);
    expect(left.y).toBeCloseTo(right.y);
    const rotated = getSurfaceLight(1, Math.PI / 2);
    expect(rotated.x).toBeCloseTo(right.y);
    expect(rotated.y).toBeCloseTo(-right.x);
  });

  it('remains finite and continuous when the fish faces the viewer', () => {
    const front = getSurfaceLight(0.5, 0.3, 0);
    expect(front.x).toBeCloseTo(0);
    expect(Number.isFinite(front.y)).toBe(true);
    const a = getSurfaceLight(1, 0, -0.001), b = getSurfaceLight(1, 0, 0.001);
    expect(Math.abs(a.x - b.x)).toBeLessThan(0.002);
  });
});
