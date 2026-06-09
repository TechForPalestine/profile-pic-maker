import { PNG } from 'pngjs';

export type Rgba = { r: number; g: number; b: number; a: number };

export function solidPng(
  width: number,
  height: number,
  [r, g, b, a]: [number, number, number, number],
): Buffer {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = a;
  }
  return PNG.sync.write(png);
}

export function pixelAt(png: PNG, x: number, y: number): Rgba {
  const i = (png.width * y + x) << 2;
  return {
    r: png.data[i],
    g: png.data[i + 1],
    b: png.data[i + 2],
    a: png.data[i + 3],
  };
}

// Rough measure of visual content: how many distinct RGBA values appear on a
// sampled grid. A blank/transparent image yields ~1; a real photo yields many.
export function distinctColors(png: PNG, step = 8): number {
  const seen = new Set<string>();
  for (let y = 0; y < png.height; y += step) {
    for (let x = 0; x < png.width; x += step) {
      const p = pixelAt(png, x, y);
      seen.add(`${p.r},${p.g},${p.b},${p.a}`);
    }
  }
  return seen.size;
}
