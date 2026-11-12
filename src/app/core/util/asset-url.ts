import { environment } from '../../../environments/environment';

/**
 * Turns a stored file path into something an <img> or a download link can open.
 *
 * - Local previews (blob:, data:) and any real remote address (Supabase Storage, a CDN, the API's own
 *   public host) are used exactly as they are.
 * - An address that points at localhost (a file saved while developing, or an APP_URL that was never
 *   set) is rebuilt on the API's own origin so it still opens.
 * - A bare path becomes `<api origin>/storage/<path>`.
 */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;

  if (/^(blob:|data:)/i.test(path)) return path;

  const origin = new URL(environment.apiUrl, window.location.origin).origin;

  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
      return local ? origin + url.pathname : path;
    } catch {
      return path;
    }
  }

  return origin + (path.startsWith('/') ? path : `/storage/${path}`);
}
