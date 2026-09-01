export const RECTANGLE_BORDER_SIZE = 18;
export const RECTANGLE_MAX_IMAGE_SIZE = 324;

export function getRectangleFrameSize(
  aspectRatio: number,
  maxImageSize = RECTANGLE_MAX_IMAGE_SIZE,
  borderSize = RECTANGLE_BORDER_SIZE,
) {
  const safeAspectRatio =
    Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
  const imageWidth =
    safeAspectRatio >= 1 ? maxImageSize : maxImageSize * safeAspectRatio;
  const imageHeight =
    safeAspectRatio >= 1 ? maxImageSize / safeAspectRatio : maxImageSize;

  return {
    width: imageWidth + borderSize * 2,
    height: imageHeight + borderSize * 2,
    imageWidth,
    imageHeight,
  };
}
