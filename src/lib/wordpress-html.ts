import { rewriteContentMediaUrls } from '@/lib/media';

/** Elimina shortcodes de Divi/WordPress y deja solo el HTML embebido. */
export function stripWordPressShortcodes(html: string): string {
  return html
    .replace(/\[et_pb[^\]]*\]/g, '')
    .replace(/\[\/et_pb[^\]]*\]/g, '')
    .replace(/\[embed[^\]]*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Extrae URLs de imágenes de fondo definidas en shortcodes Divi. */
export function extractBackgroundImages(html: string): string[] {
  return [...html.matchAll(/background_image="([^"]+)"/g)].map((m) => m[1]);
}

/** Devuelve HTML limpio listo para renderizar con prose-ucu. */
export function cleanWordPressHtml(html: string): string {
  return rewriteContentMediaUrls(stripWordPressShortcodes(html));
}
