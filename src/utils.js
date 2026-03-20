export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export const IMAGE_FORMATS = [
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico', 'tiff', 'tif', 'avif', 'svg',
  'tga', 'ppm', 'pgm', 'pbm', 'pnm', 'hdr', 'exr', 'psd', 'jfif', 'jpe',
  'pcx', 'qoi', 'dds', 'dpx', 'fits', 'pam', 'xbm', 'xpm',
];

export const AUDIO_FORMATS = [
  'mp3', 'wav', 'flac', 'ogg', 'opus', 'aac', 'm4a', 'wma', 'amr', 'ac3',
  'aiff', 'aif', 'au', 'weba', 'mp2', 'voc',
];

export const VIDEO_FORMATS = [
  'mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'gif', 'mpg', 'mpeg', 'flv',
  'f4v', 'vob', 'm4v', '3gp', '3g2', 'mxf', 'ogv', 'ts', 'mts', 'm2ts',
];

export const DOC_FORMATS = ['md', 'html', 'rtf', 'csv', 'tsv', 'json', 'rst'];

export function detectFileCategory(ext) {
  if (IMAGE_FORMATS.includes(ext) || ext === 'svg') return 'image';
  if (AUDIO_FORMATS.includes(ext)) return 'audio';
  if (VIDEO_FORMATS.includes(ext)) return 'video';
  if (DOC_FORMATS.includes(ext)) return 'document';
  if (ext === 'pdf') return 'pdf';
  return 'unknown';
}

export const FFMPEG_PRESETS = [
  { label: 'Convert video to GIF', cmd: (i, o) => ['-i', i, '-vf', 'fps=12,scale=480:-1', '-loop', '0', o], outExt: 'gif' },
  { label: 'Extract audio from video', cmd: (i, o) => ['-i', i, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', o], outExt: 'mp3' },
  { label: 'Convert to MP4 (H.264)', cmd: (i, o) => ['-i', i, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', o], outExt: 'mp4' },
  { label: 'Convert to WebM (VP9)', cmd: (i, o) => ['-i', i, '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', o], outExt: 'webm' },
  { label: 'Trim first 10 seconds', cmd: (i, o) => ['-i', i, '-t', '10', '-c', 'copy', o], outExt: null },
  { label: 'Remove audio from video', cmd: (i, o) => ['-i', i, '-an', '-c:v', 'copy', o], outExt: null },
  { label: 'Convert audio to MP3', cmd: (i, o) => ['-i', i, '-acodec', 'libmp3lame', '-q:a', '2', o], outExt: 'mp3' },
  { label: 'Convert audio to WAV', cmd: (i, o) => ['-i', i, o], outExt: 'wav' },
  { label: 'Convert to FLAC', cmd: (i, o) => ['-i', i, o], outExt: 'flac' },
  { label: 'Resize video to 720p', cmd: (i, o) => ['-i', i, '-vf', 'scale=-2:720', '-c:a', 'copy', o], outExt: null },
  { label: 'Compress video (CRF 28)', cmd: (i, o) => ['-i', i, '-crf', '28', '-preset', 'fast', o], outExt: null },
  { label: 'Speed up 2x', cmd: (i, o) => ['-i', i, '-filter:v', 'setpts=0.5*PTS', '-filter:a', 'atempo=2.0', o], outExt: null },
];
