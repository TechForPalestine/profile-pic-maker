'use client';
import { SHORT_URL_LABEL } from '@/lib/share';
import { useId } from 'react';

/*
 * The short URL, curved along the bottom of the flag ring, so a picture that
 * ends up on someone's timeline says where it was made. Purely an overlay:
 * it's drawn on top of the same node the download rasterises, so whatever the
 * user sees in the preview is exactly what lands in the PNG.
 *
 * Geometry, in the 300-unit viewBox this is drawn in (the frame is square, so
 * the SVG scales to any rendered size — 300px on the page, 250px on the story
 * card):
 *   - the photo sits at a 7.5% inset, leaving a 22.5-unit flag ring (r 127.5
 *     to r 150);
 *   - text on the bottom arc grows *inward* from its baseline, so the baseline
 *     goes near the outer edge and the glyph bodies fall inside the ring;
 *   - the label's descenders (three "p"s) hang *outward*, so the baseline stays
 *     far enough in that they don't spill past the circle's edge.
 */
const SIZE = 300;
const CENTER = SIZE / 2;
const BASELINE_RADIUS = 145;
const FONT_SIZE = 16;

export default function BrandingRing() {
  // Both the on-page frame and the off-screen story card render this at the
  // same time; React ids keep the two textPath references apart. The id lands
  // in a URL fragment, so strip React's punctuation (":r0:" / "«r0»").
  const arcId = `ppm-ring-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  // Bottom half of the circle, left to right: sweep-flag 0 travels
  // anti-clockwise on screen, which puts the text upright at 6 o'clock.
  const arc =
    `M ${CENTER - BASELINE_RADIUS} ${CENTER} ` +
    `A ${BASELINE_RADIUS} ${BASELINE_RADIUS} 0 0 0 ${CENTER + BASELINE_RADIUS} ${CENTER}`;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <defs>
        <path id={arcId} d={arc} fill="none" />
      </defs>
      <text
        fill="#ffffff"
        // A thin dark outline under the fill keeps the label readable wherever
        // the ring's red, white and green stripes land behind it.
        stroke="rgba(0, 0, 0, 0.35)"
        strokeWidth={2}
        paintOrder="stroke"
        fontFamily="inherit"
        fontSize={FONT_SIZE}
        fontWeight={700}
        letterSpacing={2}
        textAnchor="middle"
      >
        <textPath href={`#${arcId}`} xlinkHref={`#${arcId}`} startOffset="50%">
          {SHORT_URL_LABEL}
        </textPath>
      </text>
    </svg>
  );
}
