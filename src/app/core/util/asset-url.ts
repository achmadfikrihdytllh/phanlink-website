import { environment } from '../../../environments/environment';

/**
 * Backend files are stored with an absolute URL built from the server's APP_URL, which often
 * differs from the address the app actually talks to (another port, a proxy). Rebuild the URL
 * from the API origin so images and downloads always point at the right host.
 */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;

  const origin = new URL(environment.apiUrl, window.location.origin).origin;

  if (/^https?:\/\//i.test(path)) {
    try {
      return origin + new URL(path).pathname;
    } catch {
      return path;
    }
  }

  return origin + (path.startsWith('/') ? path : `/storage/${path}`);
}
