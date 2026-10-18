import { describe, expect, it } from 'vitest';
import { createRandom, leafProfile, createCausticMesh, causticMotion } from '../../src/scripts/materials.js';

describe('cached organic materials', () => {
  it('reproduces a seeded texture without using the global random stream', () => {
    const a = createRandom(431), b = createRandom(431), c = createRandom(432);
    const first = Array.from({ length: 100 }, a);
    expect(Array.from({ length: 100 }, b)).toEqual(first);
    expect(Array.from({ length: 100 }, c)).not.toEqual(first);
    expect(first.every(value => value >= 0 && value < 1)).toBe(true);
  });

  it.each(['oval', 'fern', 'lance'])('closes both ends of a %s leaf and keeps its contour bounded', kind => {
    expect(leafProfile(0, 20, -4, 1, kind).halfWidth).toBeCloseTo(0);
    expect(leafProfile(1, 20, -4, 1, kind).halfWidth).toBeCloseTo(0);
    for (let i = 0; i <= 100; i++) {
      const profile = leafProfile(i / 100, 20, -4, 1, kind);
      expect(profile.halfWidth).toBeGreaterThanOrEqual(0);
      expect(profile.halfWidth).toBeLessThan(23);
      expect(Math.abs(profile.spine)).toBeLessThan(9);
    }
    expect(leafProfile(0.5, 20, -4, 1, kind).halfWidth).toBeGreaterThan(17);
  });

  it('makes a reproducible connected caustic mesh with no loose arc ends', () => {
    const mesh = createCausticMesh(7, 4, 19);
    expect(mesh).toEqual(createCausticMesh(7, 4, 19));
    expect(mesh).not.toEqual(createCausticMesh(7, 4, 20));
    expect(mesh.points).toHaveLength(40);
    expect(mesh.edges).toHaveLength(67);
    const degree = Array(mesh.points.length).fill(0);
    for (const [a, b] of mesh.edges) { degree[a]++; degree[b]++; }
    expect(degree.every(count => count >= 2 && count <= 4)).toBe(true);
    for (const [x, y] of mesh.points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });

  it('moves the cached caustics slowly without jumps or unbounded drift', () => {
    for (let t = 0; t < 600; t += 0.7) {
      const a = causticMotion(t), b = causticMotion(t + 1 / 60);
      expect(Math.abs(a.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.y)).toBeLessThanOrEqual(1);
      expect(a.mix).toBeGreaterThanOrEqual(0);
      expect(a.mix).toBeLessThanOrEqual(1);
      for (const key of ['x', 'y', 'mix']) expect(Math.abs(a[key] - b[key])).toBeLessThan(0.005);
    }
  });
});
