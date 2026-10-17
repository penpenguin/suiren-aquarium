const smoothstep = (value) => value * value * (3 - 2 * value);

/**
 * A quiet daily lighting cycle, read from the device's local clock.
 * Dawn: 06:00–08:00. Day: 08:00–17:00. Dusk: 17:00–20:00.
 * No timers or retained state; callers can sample it whenever they draw.
 */
export function getLightCycle(date = new Date()) {
  const hour = date.getHours() + date.getMinutes() / 60
    + date.getSeconds() / 3600 + date.getMilliseconds() / 3600000;

  if (hour >= 8 && hour < 17) return { daylight: 1, twilight: 0 };

  const dawn = hour >= 6 && hour < 8;
  const dusk = hour >= 17 && hour < 20;
  if (!dawn && !dusk) return { daylight: 0, twilight: 0 };

  const progress = dawn ? (hour - 6) / 2 : (hour - 17) / 3;
  const transition = smoothstep(progress);
  return {
    daylight: dawn ? transition : 1 - transition,
    twilight: Math.sin(Math.PI * transition) * 0.8,
  };
}
