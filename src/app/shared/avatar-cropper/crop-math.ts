/** Smallest scale at which the image still covers the whole square crop box. */
export function coverScale(imgW: number, imgH: number, box: number): number {
  return Math.max(box / imgW, box / imgH);
}

/** Keeps the image covering the box: its top-left corner can move between (box - size) and 0. */
export function clampOffset(offset: number, scaledSize: number, box: number): number {
  const min = Math.min(0, box - scaledSize);
  return Math.min(0, Math.max(min, offset));
}

/** New offset after a zoom, so the point at the middle of the box stays at the middle. */
export function zoomOffset(offset: number, oldScale: number, newScale: number, box: number): number {
  const centre = (box / 2 - offset) / oldScale;
  return box / 2 - centre * newScale;
}

/** The square region of the original image (in its own pixels) that the box currently shows. */
export function sourceRect(offX: number, offY: number, scale: number, box: number) {
  return { sx: -offX / scale, sy: -offY / scale, size: box / scale };
}
