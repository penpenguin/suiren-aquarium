// Geometry is generated at resize time; animation only transforms cached pixels.
export function createRandom(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function leafProfile(t, breadth, curl, phase, kind) {
  const wave = Math.sin(Math.PI * t);
  return {
    spine: curl * wave - breadth * 0.18 * t + breadth * 0.06 * Math.sin(t * Math.PI * 2 + phase) * wave,
    halfWidth: breadth * wave ** (kind === 'oval' ? 0.54 : 0.84)
      * (1 + Math.sin(t * Math.PI * (kind === 'fern' ? 13 : 5) + phase) * (kind === 'fern' ? 0.065 : 0.029)),
  };
}

export function createCausticMesh(columns, rows, seed) {
  const random = createRandom(seed);
  const points = [], edges = [];
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const x = column === 0 || column === columns ? column : column + (random() - 0.5) * 0.8;
      const y = row === 0 || row === rows ? row : row + (random() - 0.5) * 0.8;
      const index = points.length;
      points.push([x / columns, y / rows]);
      if (column > 0) edges.push([index - 1, index]);
      if (row > 0) edges.push([index - columns - 1, index]);
    }
  }
  return { points, edges };
}

export function causticMotion(time) {
  return { x: Math.sin(time * 0.14), y: Math.cos(time * 0.11), mix: 0.5 + Math.sin(time * 0.23) * 0.5 };
}
