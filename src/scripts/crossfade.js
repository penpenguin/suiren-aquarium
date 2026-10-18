/** Cache a premultiplied crossfade of two complete, immutable material images. */
export function createImageCrossfade(day, night) {
  let canvas, ctx, previousWeight;
  return {
    get(daylight) {
      const weight = Math.max(0, Math.min(1, daylight));
      if (weight === 1) return day;
      if (weight === 0) return night;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = day.width; canvas.height = day.height;
        ctx = canvas.getContext('2d');
      }
      if (weight !== previousWeight) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.globalAlpha = weight;
        ctx.drawImage(day, 0, 0);
        // Add weighted RGBA in isolation, preserving coverage over any backdrop.
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - weight;
        ctx.drawImage(night, 0, 0);
        ctx.restore();
        previousWeight = weight;
      }
      return canvas;
    },
    destroy() {
      if (canvas) canvas.width = canvas.height = 1;
      canvas = ctx = previousWeight = undefined;
    },
  };
}
