let initialized = false;
let loadPromise = null;
let MagickModule = null;

export async function loadMagick() {
  if (initialized) return MagickModule;
  if (loadPromise) {
    await loadPromise;
    return MagickModule;
  }

  loadPromise = (async () => {
    try {
      const mod = await import('@imagemagick/magick-wasm');
      
      const wasmResponse = await fetch(
        'https://unpkg.com/@imagemagick/magick-wasm/dist/magick.wasm'
      );
      if (!wasmResponse.ok) throw new Error(`Failed to fetch magick.wasm: ${wasmResponse.status}`);
      const wasmBytes = new Uint8Array(await wasmResponse.arrayBuffer());
      
      await mod.initializeImageMagick(wasmBytes);
      MagickModule = mod;
      initialized = true;
    } catch (e) {
      loadPromise = null;
      console.error('ImageMagick WASM load error:', e);
      throw new Error(`Failed to load ImageMagick: ${e.message}`);
    }
  })();

  await loadPromise;
  return MagickModule;
}

if (typeof window !== 'undefined') {
  setTimeout(() => loadMagick().catch(() => {}), 3000);
}

export async function convertWithMagick(fileBuffer, inputFormat, outputFormat) {
  const mod = await loadMagick();
  const { ImageMagick, MagickFormat } = mod;

  return new Promise((resolve, reject) => {
    try {
      const data = new Uint8Array(fileBuffer);
      const fmt = getMagickFormat(outputFormat, mod);
      
      ImageMagick.read(data, (img) => {
        img.write(fmt, (outData) => {
          resolve(new Uint8Array(outData));
        });
      });
    } catch (e) {
      reject(new Error(`ImageMagick convert failed: ${e.message}`));
    }
  });
}

function getMagickFormat(ext, mod) {
  const { MagickFormat } = mod;
  const map = {
    'png': MagickFormat.Png,
    'jpg': MagickFormat.Jpeg,
    'jpeg': MagickFormat.Jpeg,
    'gif': MagickFormat.Gif,
    'bmp': MagickFormat.Bmp,
    'webp': MagickFormat.WebP,
    'tiff': MagickFormat.Tiff,
    'tif': MagickFormat.Tiff,
    'ico': MagickFormat.Ico,
    'tga': MagickFormat.Tga,
    'ppm': MagickFormat.Ppm,
    'pgm': MagickFormat.Pgm,
    'pbm': MagickFormat.Pbm,
    'avif': MagickFormat.Avif,
    'psd': MagickFormat.Psd,
    'pcx': MagickFormat.Pcx,
  };
  return map[ext.toLowerCase()] || MagickFormat.Png;
}

export function isMagickLoaded() {
  return initialized;
}
