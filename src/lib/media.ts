/**
 * Convierte URLs de medios (Firebase Storage o ucu.org.ar) a una URL servible por la app.
 */
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;

  if (url.startsWith('/api/media/')) {
    return url;
  }

  if (url.includes('firebasestorage.googleapis.com')) {
    const match = url.match(/\/o\/([^?]+)/);
    if (match) {
      const storagePath = decodeURIComponent(match[1]);
      return `/api/media/${storagePath.split('/').map(encodeURIComponent).join('/')}`;
    }
  }

  if (url.includes('ucu.org.ar/wp-content/uploads/')) {
    const match = url.match(/wp-content\/uploads\/(.+)$/);
    if (match) {
      return `/api/media/media/${match[1].split('/').map(encodeURIComponent).join('/')}`;
    }
  }

  return url;
}

export function rewriteContentMediaUrls(html: string): string {
  return html
    .replace(
      /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^"?]+)(?:\?[^"'\s>]*)?/g,
      (_, encodedPath) => {
        const path = decodeURIComponent(encodedPath);
        return `/api/media/${path.split('/').map(encodeURIComponent).join('/')}`;
      }
    )
    .replace(
      /https:\/\/ucu\.org\.ar\/wp-content\/uploads\/([^"'\s>]+)/g,
      (_, uploadPath) =>
        `/api/media/media/${uploadPath.split('/').map(encodeURIComponent).join('/')}`
    );
}
