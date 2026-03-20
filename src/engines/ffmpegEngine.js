import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg = null;
let loaded = false;
let loadPromise = null;

export async function loadFFmpeg(onLog) {
  if (loaded) {
    if (onLog) ffmpeg.on('log', ({ message }) => onLog(message));
    return ffmpeg;
  }
  if (loadPromise) {
    await loadPromise;
    if (onLog) ffmpeg.on('log', ({ message }) => onLog(message));
    return ffmpeg;
  }

  loadPromise = (async () => {
    ffmpeg = new FFmpeg();

    if (onLog) {
      ffmpeg.on('log', ({ message }) => onLog(message));
    }

    try {
      const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
      
      if (hasSharedArrayBuffer) {
        await ffmpeg.load({
          coreURL: 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd/ffmpeg-core.js',
          wasmURL: 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd/ffmpeg-core.wasm',
          workerURL: 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd/ffmpeg-core.worker.js',
        });
      } else {
        await ffmpeg.load({
          coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
          wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
        });
      }
      loaded = true;
    } catch (e) {
      try {
        await ffmpeg.load({
          coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
          wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
        });
        loaded = true;
      } catch (e2) {
        loadPromise = null;
        throw new Error('Failed to load FFmpeg: ' + e2.message);
      }
    }
  })();

  await loadPromise;
  return ffmpeg;
}

if (typeof window !== 'undefined') {
  setTimeout(() => loadFFmpeg().catch(() => {}), 1000);
}

export async function execFFmpeg(args, inputFile, inputName, outputName, onLog) {
  const ff = await loadFFmpeg(onLog);

  if (inputFile) {
    if (onLog) onLog('Writing input file to virtual filesystem...');
    const data = await fetchFile(inputFile);
    await ff.writeFile(inputName, data);
  }

  if (onLog) onLog(`Executing: ffmpeg ${args.join(' ')}`);
  await ff.exec(args);

  try {
    const output = await ff.readFile(outputName);
    const blob = new Blob([output.buffer], { type: 'application/octet-stream' });
    try { await ff.deleteFile(inputName); } catch (_) {}
    try { await ff.deleteFile(outputName); } catch (_) {}
    return blob;
  } catch (e) {
    throw new Error(`Output file "${outputName}" not found. FFmpeg may have failed. Check the log.`);
  }
}

export async function compressWithFFmpeg(file, quality, outputFormat, onLog) {
  const ext = file.name.split('.').pop().toLowerCase();
  const inputName = `input.${ext}`;
  const outputName = `output.${outputFormat}`;

  const q = Math.max(1, Math.min(51, Math.round(51 - (quality / 100) * 50)));

  let args;
  if (['mp4', 'webm', 'mkv', 'avi', 'mov', 'mpg', 'mpeg', 'flv', 'm4v', 'wmv'].includes(ext)) {
    args = ['-i', inputName, '-c:v', 'libx264', '-crf', String(q), '-preset', 'fast', '-c:a', 'aac', '-b:a', '128k', outputName];
  } else if (['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a', 'opus', 'wma', 'aiff', 'aif'].includes(ext)) {
    const br = Math.round(32 + (quality / 100) * 288);
    args = ['-i', inputName, '-c:a', 'libmp3lame', '-b:a', `${br}k`, outputName];
  } else {
    args = ['-i', inputName, outputName];
  }

  return execFFmpeg(args, file, inputName, outputName, onLog);
}

export async function convertWithFFmpeg(file, outputFormat, onLog) {
  const ext = file.name.split('.').pop().toLowerCase();
  const inputName = `input.${ext}`;
  const outputName = `output.${outputFormat}`;

  return execFFmpeg(['-i', inputName, outputName], file, inputName, outputName, onLog);
}

export function isLoaded() {
  return loaded;
}
