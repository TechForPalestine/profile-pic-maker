'use client';
import { useId } from 'react';

import type { BrandText } from './brands';
import { MARKER_TEXT_PATH } from './member-tag-marker';

/*
 * Membership-launch name tag: a red "HELLO, I'M A / T4P member" sticker over
 * the bottom of the photo, with the join link curved along the flag ring.
 * Like BrandingRing it's a pure overlay on the node the download rasterises,
 * and it takes the ring's bottom arc, so the two are never shown together.
 *
 * Geometry, in the same 300-unit viewBox as BrandingRing (photo inset 7.5%,
 * ring r 127.5 to r 150):
 *   - the sticker is 85% size, tilted 3deg, low enough to leave the face clear
 *     and high enough to stay off the link;
 *   - the link's arc is turned 12deg anticlockwise from 6 o'clock, which moves
 *     the start of "join" away from the sticker's lower-left corner;
 *   - baseline at r 143 keeps the "j" descenders inside the circle.
 */
const SIZE = 300;
const CENTER = SIZE / 2;
const BASELINE_RADIUS = 143;
const ARC_TURN = 12;

const at = (deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return `${CENTER + BASELINE_RADIUS * Math.cos(rad)} ${CENTER + BASELINE_RADIUS * Math.sin(rad)}`;
};

export default function MemberTag({ text }: { text: BrandText }) {
  // Rendered on the page and the story card at once; keep the ids apart.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const arcId = `ppm-member-arc-${uid}`;
  const shadowId = `ppm-member-shadow-${uid}`;

  // Bottom half-circle, left to right, rotated anticlockwise by ARC_TURN.
  const arc =
    `M ${at(180 - ARC_TURN)} ` +
    `A ${BASELINE_RADIUS} ${BASELINE_RADIUS} 0 0 0 ${at(-ARC_TURN)}`;

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
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity="0.35" />
        </filter>
      </defs>
      <text
        fill="#ffffff"
        stroke="rgba(0, 0, 0, 0.35)"
        strokeWidth={2}
        paintOrder="stroke"
        fontFamily="inherit"
        fontSize={16}
        fontWeight={700}
        letterSpacing={1.5}
        textAnchor="middle"
      >
        <textPath href={`#${arcId}`} xlinkHref={`#${arcId}`} startOffset="50%">
          {text.link}
        </textPath>
      </text>
      <g
        transform="translate(150 231) scale(0.85) rotate(-3) translate(-150 -231)"
        filter={`url(#${shadowId})`}
      >
        <rect x={72} y={196} width={156} height={72} rx={9} fill="#ce1126" />
        <rect x={77} y={218} width={146} height={44} rx={3} fill="#ffffff" />
        <text
          x={150}
          y={212}
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="inherit"
          fontSize={11.5}
          fontWeight={800}
          letterSpacing={1.6}
        >
          HELLO, I&rsquo;M A
        </text>
        {/* "T4P member", handwritten; outlines, not text (see the import). */}
        <path d={MARKER_TEXT_PATH} fill="#111111" />
      </g>
    </svg>
  );
}
