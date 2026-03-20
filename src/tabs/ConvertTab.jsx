import React, { useState, useMemo } from 'react';
import { ArrowRightLeft, Download, Loader, Search } from 'lucide-react';
import FileDropZone from '../components/FileDropZone';
import { getFileExtension, downloadBlob, readFileAsArrayBuffer, detectFileCategory,
  IMAGE_FORMATS, AUDIO_FORMATS, VIDEO_FORMATS } from '../utils';
import { convertImage } from '../engines/vipsEngine';
import { convertWithMagick } from '../engines/magickEngine';
import { convertWithFFmpeg } from '../engines/ffmpegEngine';

const ALL_TARGETS = {
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico', 'tiff', 'tif', 'avif', 'svg', 'tga',
    'ppm', 'pgm', 'pbm', 'pnm', 'hdr', 'exr', 'psd', 'jfif', 'jpe', 'pcx', 'qoi', 'dds',
    'dpx', 'fits', 'pam', 'xbm', 'xpm', 'j2k', 'jp2', 'jng', 'mng', 'palm', 'pcd',
    'sgi', 'wbmp', 'wpg', 'icb', 'vda', 'vst'],
  audio: ['mp3', 'wav', 'flac', 'ogg', 'opus', 'aac', 'm4a', 'wma', 'amr', 'ac3',
    'aiff', 'aif', 'au', 'weba', 'mp2', 'voc'],
  video: ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'gif', 'mpg', 'mpeg', 'flv',
    'f4v', 'vob', 'm4v', '3gp', '3g2', 'mxf', 'ogv', 'ts', 'mts', 'm2ts'],
};

export default function ConvertTab() {
  const [file, setFile] = useState(null);
  const [targetFormat, setTargetFormat] = useState('');
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [log, setLog] = useState('');

  const sourceExt = file ? getFileExtension(file.name) : '';
  const category = sourceExt ? detectFileCategory(sourceExt) : '';

  const targetFormats = useMemo(() => {
    if (!category) return [];
    const formats = ALL_TARGETS[category] || ALL_TARGETS.image;
    return formats.filter(f => f !== sourceExt);
  }, [category, sourceExt]);

  const filtered = useMemo(() => {
    if (!search) return targetFormats;
    return targetFormats.filter(f => f.includes(search.toLowerCase()));
  }, [targetFormats, search]);

  const convert = async () => {
    if (!file || !targetFormat) return;
    setProcessing(true);
    setResult(null);
    setLog('');
    const addLog = (msg) => setLog(prev => prev + msg + '\n');

    try {
      let blob;
      const baseName = file.name.replace(/\.[^.]+$/, '');

      if (category === 'image') {
        addLog(`Converting ${sourceExt} to ${targetFormat}...`);

        try {
          const buf = await readFileAsArrayBuffer(file);
          const converted = await convertImage(new Uint8Array(buf), `.${targetFormat}`);
          blob = new Blob([converted], { type: 'application/octet-stream' });
          addLog('Converted via wasm-vips');
        } catch (vipsErr) {
          addLog(`vips failed (${vipsErr.message}), trying ImageMagick...`);
          const buf = await readFileAsArrayBuffer(file);
          const converted = await convertWithMagick(new Uint8Array(buf), sourceExt, targetFormat);
          blob = new Blob([converted], { type: 'application/octet-stream' });
          addLog('Converted via ImageMagick WASM');
        }
      } else if (category === 'audio' || category === 'video') {
        addLog(`Converting ${sourceExt} to ${targetFormat} via FFmpeg...`);
        blob = await convertWithFFmpeg(file, targetFormat, addLog);
        addLog('Converted via FFmpeg WASM');
      } else {
        addLog(`Attempting conversion ${sourceExt} to ${targetFormat}...`);
        blob = await convertWithFFmpeg(file, targetFormat, addLog);
      }

      setResult({ blob, name: `${baseName}.${targetFormat}` });
      addLog(`\nDone!`);
    } catch (e) {
      addLog(`Error: ${e.message}`);
    }
    setProcessing(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--pencil)',
            background: 'var(--blue)', color: 'white',
          }}>
            <ArrowRightLeft size={24} strokeWidth={2.5} />
          </span>
          Universal Converter
        </h2>
        <p style={{ opacity: 0.6, marginTop: 4 }}>
          Convert between 200+ formats: images, audio, video. All in your browser.
        </p>
      </div>

      <FileDropZone
        onFiles={(f) => { setFile(f[0] || null); setResult(null); setLog(''); setTargetFormat(''); }}
      />

      {file && (
        <>
          <div className="card" style={{ borderRadius: 'var(--wobbly)' }}>
            <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
              <span className="badge" style={{ fontSize: '1rem', transform: 'none' }}>
                .{sourceExt}
              </span>
              <ArrowRightLeft size={20} />
              <span className="badge" style={{ 
                fontSize: '1rem', transform: 'none',
                background: targetFormat ? 'var(--blue)' : 'var(--muted)',
                color: targetFormat ? 'white' : 'var(--pencil)',
              }}>
                {targetFormat ? `.${targetFormat}` : '???'}
              </span>
              <span style={{ opacity: 0.5, marginLeft: 8 }}>
                {category ? `(${category})` : ''}
              </span>
            </div>

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search size={18} style={{ position: 'absolute', left: 12, top: 14, opacity: 0.4 }} />
              <input
                className="input"
                placeholder="Search formats..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 40 }}
              />
            </div>

            <div className="format-grid">
              {filtered.map(fmt => (
                <button
                  key={fmt}
                  className={`format-chip ${targetFormat === fmt ? 'selected' : ''}`}
                  onClick={() => setTargetFormat(fmt)}
                >
                  .{fmt}
                </button>
              ))}
            </div>

            {targetFormat && (
              <div style={{ marginTop: 16 }}>
                <button className="btn btn-accent" onClick={convert} disabled={processing}>
                  {processing ? <><Loader size={18} className="animate-spin" /> Converting...</> : <><ArrowRightLeft size={18} /> Convert to .{targetFormat}</>}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {log && <div className="log-output">{log}</div>}

      {result && (
        <div className="result-bar">
          <div className="result-info">
            Converted to .{targetFormat}
          </div>
          <button className="btn btn-accent" onClick={() => downloadBlob(result.blob, result.name)}>
            <Download size={18} /> Download {result.name}
          </button>
        </div>
      )}
    </div>
  );
}
