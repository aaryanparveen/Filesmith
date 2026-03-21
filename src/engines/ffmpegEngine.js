import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg = null;
let loaded = false;
let loadPromise = null;

export async function loadFFmpeg(onLog) {
  if (loaded && ffmpeg) {
    if (onLog) ffmpeg.on('log', ({ message }) => onLog(message));
    return ffmpeg;
  }
  if (loadPromise) {
    await loadPromise;
    if (onLog && ffmpeg) ffmpeg.on('log', ({ message }) => onLog(message));
    return ffmpeg;
  }

  loadPromise = (async () => {
    ffmpeg = new FFmpeg();
    if (onLog) ffmpeg.on('log', ({ message }) => onLog(message));

    if (typeof SharedArrayBuffer !== 'undefined') {
      const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.10/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${base}/ffmpeg-core.worker.js`, 'text/javascript'),
      });
    } else {
      const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    }
    loaded = true;
  })();

  await loadPromise;
  return ffmpeg;
}

if (typeof window !== 'undefined') {
  setTimeout(() => loadFFmpeg().catch(() => {}), 3000);
}

export async function execFFmpeg(args, inputFile, inputName, outputName, onLog) {
  const ff = await loadFFmpeg(onLog);

  if (inputFile) {
    await ff.writeFile(inputName, await fetchFile(inputFile));
  }

  if (onLog) onLog(`Executing: ffmpeg ${args.join(' ')}`);
  await ff.exec(args);

  const output = await ff.readFile(outputName);
  const blob = new Blob([output.buffer], { type: 'application/octet-stream' });
  try { await ff.deleteFile(inputName); } catch (_) {}
  try { await ff.deleteFile(outputName); } catch (_) {}
  return blob;
}

export async function compressWithFFmpeg(file, quality, outputFormat, onLog) {
  const ext = file.name.split('.').pop().toLowerCase();
  const outExt = outputFormat || ext;
  const inputName = `input.${ext}`;
  const outputName = `output.${outExt}`;
  const crf = Math.max(1, Math.min(51, Math.round(51 - (quality / 100) * 50)));

  let args;
  if (['mp4', 'webm', 'mkv', 'avi', 'mov', 'mpg', 'mpeg', 'flv', 'm4v', 'wmv'].includes(ext)) {
    if (outExt === 'webm') {
      args = ['-i', inputName, '-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k', outputName];
    } else {
      args = ['-i', inputName, '-c:v', 'libx264', '-crf', String(crf), '-preset', 'fast', '-c:a', 'aac', '-b:a', '128k', outputName];
    }
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
  const args = ['-i', inputName];

  const videoExts = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'mpg', 'mpeg', 'flv', 'm4v', 'wmv', '3gp', 'ogv', 'ts', 'mts', 'vob'];
  const audioExts = ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a', 'opus', 'wma', 'aiff', 'aif', 'weba', 'ac3', 'amr', 'au', 'mp2', 'voc'];

  if (videoExts.includes(ext) && outputFormat === 'gif') {
    args.push('-vf', 'fps=12,scale=480:-1', '-loop', '0');
  } else if ((videoExts.includes(ext) || audioExts.includes(ext)) && audioExts.includes(outputFormat)) {
    args.push('-vn');
    if (outputFormat === 'mp3') args.push('-c:a', 'libmp3lame', '-q:a', '2');
    else if (outputFormat === 'ogg') args.push('-c:a', 'libvorbis', '-q:a', '5');
    else if (outputFormat === 'opus') args.push('-c:a', 'libopus', '-b:a', '128k');
    else if (outputFormat === 'flac') args.push('-c:a', 'flac');
    else if (outputFormat === 'aac' || outputFormat === 'm4a') args.push('-c:a', 'aac', '-b:a', '192k');
    else if (outputFormat === 'wav') args.push('-c:a', 'pcm_s16le');
  } else if (videoExts.includes(ext) && (videoExts.includes(outputFormat) || outputFormat === 'gif')) {
    if (outputFormat === 'webm') {
      args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k');
    } else {
      args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k');
    }
  }

  args.push(outputName);
  return execFFmpeg(args, file, inputName, outputName, onLog);
}

export function isLoaded() {
  return loaded;
}
