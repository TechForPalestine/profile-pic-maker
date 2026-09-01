import { describe, expect, it } from 'vitest';

import { getRectangleFrameSize } from '@/lib/frame';

describe('getRectangleFrameSize', () => {
  it('preserves a landscape image aspect ratio inside the border', () => {
    expect(getRectangleFrameSize(2)).toEqual({
      width: 360,
      height: 198,
      imageWidth: 324,
      imageHeight: 162,
    });
  });

  it('preserves a portrait image aspect ratio inside the border', () => {
    expect(getRectangleFrameSize(0.5)).toEqual({
      width: 198,
      height: 360,
      imageWidth: 162,
      imageHeight: 324,
    });
  });

  it('falls back to a square for an invalid aspect ratio', () => {
    expect(getRectangleFrameSize(0)).toEqual({
      width: 360,
      height: 360,
      imageWidth: 324,
      imageHeight: 324,
    });
  });
});
