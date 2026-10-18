const smoothstep = (value) => value * value * (3 - 2 * value);

/** Direction toward the source, in canvas coordinates; shared by all materials. */
export function getSceneLight(daylight) {
  const day = Math.max(0, Math.min(1, daylight));
  const x = 0.52 * (1 - 2 * day);
  const y = -0.86;
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length, sourceX: 0.74 - day * 0.48,
    ambient: 0.74 + day * 0.26 };
}

/** Project world light into a rotating surface without dividing by its facing. */
export function getSurfaceLight(daylight, angle = 0, facing = 1) {
  const light = getSceneLight(daylight);
  return {
    x: (light.x * Math.cos(angle) + light.y * Math.sin(angle)) * Math.max(-1, Math.min(1, facing)),
    y: -light.x * Math.sin(angle) + light.y * Math.cos(angle),
    ambient: light.ambient,
  };
}

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
