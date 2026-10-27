import type { CSSProperties } from 'react';

export const MIN_PHOTO_ZOOM = 0.6;

/**
 * The photo's place in the frame: a circle 85% of the frame, inset 7.5% so
 * the flag shows around it. Zooming out shrinks the circle but keeps its top
 * where it is, so the face moves up and away from overlays on the bottom of
 * the frame (the member name tag), with more flag showing below it.
 */
export const photoStyle = (zoom: number): CSSProperties => {
  const size = 85 * zoom;
  return {
    position: 'absolute',
    width: `${size}%`,
    height: `${size}%`,
    left: `${(100 - size) / 2}%`,
    top: '7.5%',
  };
};
