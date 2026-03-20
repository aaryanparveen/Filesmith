let Vips = null;
let loaded = false;
let loadPromise = null;

export async function loadVips() {
  if (loaded) return Vips;
  if (loadPromise) {
    await loadPromise;
    return Vips;
  }

  loadPromise = (async () => {
    try {
      const vipsModule = await import('wasm-vips');
      Vips = await vipsModule.default({
        dynamicLibraries: [],
      });
      loaded = true;
    } catch (e) {
      loadPromise = null;
      console.error('wasm-vips load error:', e);
      throw new Error(`Failed to load wasm-vips: ${e.message}`);
    }
  })();

  await loadPromise;
  return Vips;
}

if (typeof window !== 'undefined') {
  setTimeout(() => loadVips().catch(() => {}), 2000);
}

export async function resizeImage(fileBuffer, width, height, options = {}) {
  const vips = await loadVips();
  let img;
  try {
    img = vips.Image.newFromBuffer(fileBuffer);

    let resized;
    if (width && height) {
      resized = img.thumbnailImage(width, { height, size: 'force' });
    } else if (width) {
      resized = img.thumbnailImage(width);
    } else if (height) {
      const scale = height / img.height;
      const w = Math.round(img.width * scale);
      resized = img.thumbnailImage(w, { height });
    } else {
      resized = img;
    }

    const format = options.format || '.png';
    const outBuf = resized.writeToBuffer(format, options.params || {});
    if (resized !== img) resized.delete();
    img.delete();
    return outBuf;
  } catch (e) {
    if (img) try { img.delete(); } catch (_) {}
    throw new Error(`vips resize failed: ${e.message}`);
  }
}

export async function compressImage(fileBuffer, quality, outputFormat) {
  const vips = await loadVips();
  let img;
  try {
    img = vips.Image.newFromBuffer(fileBuffer);

    let params = {};
    let fmt = outputFormat || '.jpg';

    if (fmt === '.jpg' || fmt === '.jpeg') {
      params = { Q: quality };
      fmt = '.jpg';
    } else if (fmt === '.webp') {
      params = { Q: quality };
    } else if (fmt === '.png') {
      params = { compression: Math.round(9 - (quality / 100) * 9) };
    } else if (fmt === '.avif') {
      params = { Q: quality };
    }

    const outBuf = img.writeToBuffer(fmt, params);
    img.delete();
    return outBuf;
  } catch (e) {
    if (img) try { img.delete(); } catch (_) {}
    throw new Error(`vips compress failed: ${e.message}`);
  }
}

export async function convertImage(fileBuffer, targetFormat) {
  const vips = await loadVips();
  let img;
  try {
    img = vips.Image.newFromBuffer(fileBuffer);
    const outBuf = img.writeToBuffer(targetFormat);
    img.delete();
    return outBuf;
  } catch (e) {
    if (img) try { img.delete(); } catch (_) {}
    throw new Error(`vips convert failed: ${e.message}`);
  }
}

export function isVipsLoaded() {
  return loaded;
}
