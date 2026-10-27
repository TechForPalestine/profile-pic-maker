'use client';
import Image from 'next/image';
import { useRef, useState } from 'react';

/**
 * The photo inside the frame's circle (85% of the frame, inset 7.5%, so the
 * flag ring around it stays even). `fit` moves and zooms the photo within
 * that circle, so a tight crop or a tall photo can be placed clear of an
 * overlay like the member name tag:
 *   - zoom 1 fills the circle (like object-fit: cover), below 1 shows more of
 *     the photo, above 1 crops in;
 *   - x / y move the photo's centre, in % of the circle.
 * Wherever a zoomed-out photo leaves the circle uncovered, a blurred copy of
 * it shows instead of the flag.
 */
export interface PhotoFit {
  zoom: number;
  x: number;
  y: number;
}

export const DEFAULT_FIT: PhotoFit = { zoom: 1, x: 0, y: 0 };
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;

// The photo's centre can go as far as the circle's edge, no further.
const clamp = (n: number) => Math.max(-50, Math.min(50, n));

// The photo shrunk to 10px, then stretched back up to 200px with the
// canvas's bilinear smoothing: a soft blur that, unlike CSS
// `filter: blur()`, rasterises the same in every engine. (Stretching the
// 10px image with CSS instead comes out blocky in WebKit.) Undefined if the
// canvas can't read the photo (a cross-origin source), which leaves the flag
// showing instead.
function blurOf(img: HTMLImageElement): string | undefined {
  const tiny = document.createElement('canvas');
  tiny.width = tiny.height = 10;
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  tiny
    .getContext('2d')
    ?.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      10,
      10,
    );
  const blur = document.createElement('canvas');
  blur.width = blur.height = 200;
  const ctx = blur.getContext('2d');
  if (!ctx) return undefined;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tiny, 0, 0, 200, 200);
  try {
    return blur.toDataURL();
  } catch {
    return undefined;
  }
}

export default function FramedPhoto({
  src,
  fit,
  onFitChange,
  id,
  onLoad,
}: {
  src: string;
  fit: PhotoFit;
  /** Makes the photo draggable, reporting where it was dragged to. */
  onFitChange?: (fit: PhotoFit) => void;
  id?: string;
  onLoad?: () => void;
}) {
  const [aspect, setAspect] = useState(1);
  const [blur, setBlur] = useState<string>();
  const drag = useRef<{ x: number; y: number }>(undefined);

  // Sized to cover the circle at zoom 1, keeping the photo's proportions.
  const width = 100 * Math.max(aspect, 1) * fit.zoom;
  const height = (100 / Math.min(aspect, 1)) * fit.zoom;

  return (
    <div
      style={{
        position: 'absolute',
        width: '85%',
        height: '85%',
        left: '7.5%',
        top: '7.5%',
        overflow: 'hidden',
        touchAction: onFitChange ? 'none' : undefined,
      }}
      className={`rounded-full ${onFitChange ? 'cursor-move' : ''}`}
      onPointerDown={(e) => {
        if (!onFitChange) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!onFitChange || !drag.current) return;
        const unit = 100 / e.currentTarget.clientWidth;
        onFitChange({
          ...fit,
          x: clamp(fit.x + (e.clientX - drag.current.x) * unit),
          y: clamp(fit.y + (e.clientY - drag.current.y) * unit),
        });
        drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => (drag.current = undefined)}
      onPointerCancel={() => (drag.current = undefined)}
    >
      {blur && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          src={blur}
          style={{ position: 'absolute', width: '100%', height: '100%' }}
        />
      )}
      <Image
        id={id}
        alt="profile-image"
        src={src}
        width={100}
        height={100}
        draggable={false}
        onLoad={(e) => {
          const img = e.currentTarget;
          setAspect(img.naturalWidth / img.naturalHeight || 1);
          setBlur(blurOf(img));
          onLoad?.();
        }}
        style={{
          position: 'absolute',
          maxWidth: 'none',
          width: `${width}%`,
          height: `${height}%`,
          left: `${50 + fit.x - width / 2}%`,
          top: `${50 + fit.y - height / 2}%`,
        }}
      />
    </div>
  );
}
