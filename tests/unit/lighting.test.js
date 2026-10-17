import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLightCycle } from '../../src/scripts/lighting.js';

describe('getLightCycle', () => {
  afterEach(() => vi.useRealTimers());

  it('uses daylight at noon in local time', () => {
    expect(getLightCycle(new Date(2026, 9, 18, 12))).toEqual({
      daylight: 1,
      twilight: 0,
    });
  });

  it.each([
    [0, 0, 0, 0],
    [5, 59, 0, 0],
    [6, 0, 0, 0],
    [7, 0, 0.5, 0.8],
    [8, 0, 1, 0],
    [17, 0, 1, 0],
    [18, 30, 0.5, 0.8],
    [20, 0, 0, 0],
    [23, 59, 0, 0],
  ])('returns the expected light at %i:%i local time', (hour, minute, daylight, twilight) => {
    const light = getLightCycle(new Date(2026, 9, 18, hour, minute));
    expect(light.daylight).toBeCloseTo(daylight);
    expect(light.twilight).toBeCloseTo(twilight);
  });

  it('reads the current local clock when no date is provided', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 18, 18, 30));
    expect(getLightCycle()).toEqual({ daylight: 0.5, twilight: 0.8 });
    vi.setSystemTime(new Date(2026, 9, 18, 21));
    expect(getLightCycle()).toEqual({ daylight: 0, twilight: 0 });
  });
});
