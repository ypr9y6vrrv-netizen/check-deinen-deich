// Verarbeitet hochgeladene Bilder: prüft Format & Größe, dreht Handyfotos richtig,
// verkleinert und speichert alles als WebP. Dabei werden ALLE Metadaten (EXIF, GPS-Standort!) entfernt.
import sharp from 'sharp';

sharp.cache(false);
sharp.concurrency(2);

export class ImageError extends Error {}

const FORMATS = new Set(['jpeg', 'png', 'gif', 'webp', 'avif']);
const MAX_FRAME_PIXELS = 40_000_000; // z. B. 8000 × 5000
const MAX_TOTAL_PIXELS = 80_000_000; // alle Frames eines GIFs zusammen
const MAX_SIZE = { background: 2560, banner: 1600 };

/**
 * @param {Buffer} buffer
 * @param {'background'|'banner'} kind
 * @returns {Promise<{data: Buffer, width: number, height: number, animated: boolean}>}
 */
export async function processImage(buffer, kind = 'background') {
  let meta;
  try {
    meta = await sharp(buffer, { animated: true, limitInputPixels: MAX_TOTAL_PIXELS }).metadata();
  } catch {
    throw new ImageError('Das ist kein gültiges Bild (oder es ist zu groß).');
  }
  if (!FORMATS.has(meta.format)) throw new ImageError('Erlaubt sind PNG, JPG, GIF, WebP und AVIF.');

  const pages = meta.pages ?? 1;
  const frameHeight = meta.pageHeight ?? meta.height;
  if (!meta.width || !frameHeight) throw new ImageError('Das Bild konnte nicht gelesen werden.');
  if (meta.width * frameHeight > MAX_FRAME_PIXELS) throw new ImageError('Das Bild hat zu viele Pixel (max. ca. 40 Megapixel).');
  if (meta.width * frameHeight * pages > MAX_TOTAL_PIXELS) throw new ImageError('Das GIF ist zu lang oder zu groß.');

  const animated = pages > 1;
  const max = animated ? Math.min(1280, MAX_SIZE[kind]) : MAX_SIZE[kind];
  let img = sharp(buffer, { animated, limitInputPixels: MAX_TOTAL_PIXELS }).timeout({ seconds: 30 });
  if (!animated) img = img.autoOrient();
  img = img
    .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: animated ? 72 : 82, effort: 4 });

  try {
    const { data, info } = await img.toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.pageHeight ?? info.height, animated };
  } catch (err) {
    if (/timeout/i.test(err.message)) throw new ImageError('Das Bild zu verarbeiten hat zu lange gedauert.');
    throw new ImageError('Das Bild konnte nicht verarbeitet werden.');
  }
}

// Bildverarbeitung nacheinander abarbeiten, damit kleine Server nicht in die Knie gehen.
let chain = Promise.resolve();
export function enqueue(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}
