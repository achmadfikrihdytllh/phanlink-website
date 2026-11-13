/** Size an image so its longer side is at most `max`, keeping the proportions. Never enlarges. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Photos from a phone are several MB; chat needs far less. GIFs and SVGs are left alone. */
const SKIP = new Set(['image/gif', 'image/svg+xml']);

/**
 * Shrinks a big photo before it is uploaded (longer side <= `max`, JPEG). Returns the original file when it is
 * not a photo, is already small, or the browser cannot do it, so sending never fails because of this step.
 */
export async function shrinkImage(file: File, max = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || SKIP.has(file.type)) return file;
  if (file.size < 300 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, max);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#fff'; // transparent PNGs become white, not black
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
