import { initializeImageMagick, ImageMagick, MagickFormat } from '@imagemagick/magick-wasm';

let initialized = false;
let loadPromise = null;

export async function loadMagick() {
  if (initialized) return;
  if (loadPromise) { await loadPromise; return; }

  loadPromise = (async () => {
    const res = await fetch('/magick.wasm');
    const wasmBytes = new Uint8Array(await res.arrayBuffer());
    await initializeImageMagick(wasmBytes);
    initialized = true;
  })().catch((e) => {
    loadPromise = null;
    throw e;
  });

  await loadPromise;
}

if (typeof window !== 'undefined') {
  setTimeout(() => loadMagick().catch(() => {}), 3000);
}

function getMagickFormat(ext) {
  if (ext.toLowerCase() === 'jpg') return MagickFormat.Jpeg;
  if (ext.toLowerCase() === 'tif') return MagickFormat.Tiff;
  const upper = ext.toUpperCase();
  if (Object.values(MagickFormat).includes(upper)) return upper;
  return MagickFormat.Png;
}

export async function convertWithMagick(fileBuffer, inputFormat, outputFormat) {
  await loadMagick();
  const data = new Uint8Array(fileBuffer);
  return ImageMagick.read(data, getMagickFormat(inputFormat), (img) => {
    return img.write(getMagickFormat(outputFormat), (out) => new Uint8Array(out));
  });
}

export function isMagickLoaded() {
  return initialized;
}
