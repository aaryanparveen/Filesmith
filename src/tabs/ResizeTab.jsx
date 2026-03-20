import React, { useState } from 'react';
import { Maximize, Download, Loader, Lock, Unlock, Trash2, Image, Package, Paintbrush } from 'lucide-react';
import FileDropZone from '../components/FileDropZone';
import { formatFileSize, getFileExtension, downloadBlob, readFileAsArrayBuffer } from '../utils';
import { resizeImage, compressImage } from '../engines/vipsEngine';
import JSZip from 'jszip';

const PRESETS = [
  { label: 'Instagram Post', w: 1080, h: 1080 },
  { label: 'Instagram Story', w: 1080, h: 1920 },
  { label: 'Twitter/X Post', w: 1200, h: 675 },
  { label: 'Facebook Cover', w: 820, h: 312 },
  { label: 'YouTube Thumbnail', w: 1280, h: 720 },
  { label: 'LinkedIn Banner', w: 1584, h: 396 },
  { label: 'Web Thumbnail', w: 300, h: 200 },
  { label: 'HD 1080p', w: 1920, h: 1080 },
  { label: 'HD 720p', w: 1280, h: 720 },
  { label: '4K', w: 3840, h: 2160 },
  { label: 'Favicon', w: 32, h: 32 },
  { label: 'App Icon', w: 512, h: 512 },
];

export default function ResizeTab() {
  const [files, setFiles] = useState([]);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [lockAspect, setLockAspect] = useState(true);
  const [outputFormat, setOutputFormat] = useState('png');
  const [quality, setQuality] = useState(85);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [log, setLog] = useState('');

  const [removeBg, setRemoveBg] = useState(false);
  const [vectorize, setVectorize] = useState(false);

  const addLog = (msg) => setLog(prev => prev + msg + '\n');

  const applyPreset = (p) => {
    setWidth(p.w);
    setHeight(p.h);
  };

  const removeBackground = (imageData) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new window.Image();

    return new Promise((resolve) => {
      const blob = new Blob([imageData]);
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = data.data;

        const samples = [
          [0, 0], [canvas.width - 1, 0],
          [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1],
        ];
        let bgR = 0, bgG = 0, bgB = 0;
        for (const [x, y] of samples) {
          const i = (y * canvas.width + x) * 4;
          bgR += pixels[i]; bgG += pixels[i + 1]; bgB += pixels[i + 2];
        }
        bgR /= 4; bgG /= 4; bgB /= 4;

        const threshold = 60;
        for (let i = 0; i < pixels.length; i += 4) {
          const dr = Math.abs(pixels[i] - bgR);
          const dg = Math.abs(pixels[i + 1] - bgG);
          const db = Math.abs(pixels[i + 2] - bgB);
          if (dr < threshold && dg < threshold && db < threshold) {
            pixels[i + 3] = 0;
          }
        }

        ctx.putImageData(data, 0, 0);
        canvas.toBlob((b) => {
          b.arrayBuffer().then(buf => {
            URL.revokeObjectURL(url);
            resolve(new Uint8Array(buf));
          });
        }, 'image/png');
      };
      img.src = url;
    });
  };

  const vectorizeImage = (imageData) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new window.Image();

    return new Promise((resolve) => {
      const blob = new Blob([imageData]);
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const scale = Math.min(1, 500 / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = data.data;
        const w = canvas.width;
        const h = canvas.height;

        let svgPaths = '';
        const threshold = 128;
        const visited = new Set();

        for (let y = 0; y < h; y++) {
          let inPath = false;
          let startX = 0;
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const gray = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
            const isDark = gray < threshold;

            if (isDark && !inPath) {
              startX = x;
              inPath = true;
            } else if (!isDark && inPath) {
              const rx = startX / scale;
              const ry = y / scale;
              const rw = (x - startX) / scale;
              const rh = 1 / scale;
              svgPaths += `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="#2d2d2d"/>`;
              inPath = false;
            }
          }
          if (inPath) {
            const rx = startX / scale;
            const ry = y / scale;
            const rw = (w - startX) / scale;
            svgPaths += `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${(1/scale).toFixed(1)}" fill="#2d2d2d"/>`;
          }
        }

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${img.width} ${img.height}" width="${img.width}" height="${img.height}">${svgPaths}</svg>`;
        URL.revokeObjectURL(url);
        resolve(svg);
      };
      img.src = url;
    });
  };

  const processAll = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setResults([]);
    setLog('');
    setProgress({ current: 0, total: files.length });

    const outputs = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress({ current: i + 1, total: files.length });
      addLog(`[${i + 1}/${files.length}] Processing ${file.name}...`);

      try {
        const buf = await readFileAsArrayBuffer(file);
        let data = new Uint8Array(buf);

        if (removeBg) {
          addLog('  Removing background...');
          data = await removeBackground(data);
        }

        if (vectorize) {
          addLog('  Vectorizing to SVG...');
          const svg = await vectorizeImage(data);
          const blob = new Blob([svg], { type: 'image/svg+xml' });
          const baseName = file.name.replace(/\.[^.]+$/, '');
          outputs.push({ blob, name: `${baseName}.svg` });
          addLog(`  Vectorized: ${baseName}.svg`);
          continue;
        }

        addLog(`  Resizing to ${width}x${height}...`);
        const resized = await resizeImage(data, width, height, {
          format: `.${outputFormat}`,
          params: outputFormat === 'jpg' || outputFormat === 'jpeg' ? { Q: quality } : outputFormat === 'webp' ? { Q: quality } : {},
        });

        const baseName = file.name.replace(/\.[^.]+$/, '');
        const blob = new Blob([resized], { type: 'application/octet-stream' });
        outputs.push({ blob, name: `${baseName}_${width}x${height}.${outputFormat}` });
        addLog(`  Done: ${formatFileSize(blob.size)}`);
      } catch (e) {
        addLog(`  Error: ${e.message}`);
      }
    }

    setResults(outputs);
    addLog(`\nProcessed ${outputs.length}/${files.length} files`);
    setProcessing(false);
  };

  const downloadAll = async () => {
    if (results.length === 1) {
      downloadBlob(results[0].blob, results[0].name);
      return;
    }
    const zip = new JSZip();
    for (const r of results) {
      const buf = await r.blob.arrayBuffer();
      zip.file(r.name, buf);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, 'resized_images.zip');
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--pencil)',
            background: '#e8f5e9',
          }}>
            <Maximize size={24} strokeWidth={2.5} />
          </span>
          Batch Image Processor
        </h2>
        <p style={{ opacity: 0.6, marginTop: 4 }}>
          Drop 50 photos: resize, compress, remove backgrounds, or vectorize. All at once.
        </p>
      </div>

      <FileDropZone
        onFiles={(f) => { setFiles(f); setResults([]); setLog(''); }}
        multiple={true}
        accept="image/*"
        label="Drop your images here (batch supported!)"
      />

      {files.length > 0 && (
        <div className="card" style={{ borderRadius: 'var(--wobbly)' }}>
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="section-title" style={{ marginBottom: 10, fontSize: '1.1rem' }}>Size Presets</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PRESETS.map((p, i) => (
                  <button
                    key={i}
                    className="btn btn-sm btn-secondary"
                    onClick={() => applyPreset(p)}
                    style={{ fontSize: '0.85rem', transform: `rotate(${(i % 5 - 2) * 0.3}deg)` }}
                  >
                    {p.label} ({p.w}×{p.h})
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: '0.9rem', opacity: 0.6, display: 'block' }}>Width</label>
                <input
                  className="input"
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  style={{ width: 120 }}
                />
              </div>
              <button
                onClick={() => setLockAspect(!lockAspect)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 18 }}
                title={lockAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
              >
                {lockAspect ? <Lock size={20} /> : <Unlock size={20} />}
              </button>
              <div>
                <label style={{ fontSize: '0.9rem', opacity: 0.6, display: 'block' }}>Height</label>
                <input
                  className="input"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  style={{ width: 120 }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.9rem', opacity: 0.6, display: 'block' }}>Format</label>
                <select className="input" value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)} style={{ width: 120 }}>
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                  <option value="webp">WebP</option>
                  <option value="avif">AVIF</option>
                  <option value="gif">GIF</option>
                  <option value="tiff">TIFF</option>
                </select>
              </div>
            </div>
            {['jpg', 'jpeg', 'webp', 'avif'].includes(outputFormat) && (
              <div className="slider-container">
                <div className="slider-label">
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>Output Quality</span>
                  <span className="badge">{quality}%</span>
                </div>
                <input type="range" min="1" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
              </div>
            )}
            <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
              <div className="toggle-container" onClick={() => { setRemoveBg(!removeBg); if (!removeBg) setVectorize(false); }}>
                <div className={`toggle-track ${removeBg ? 'on' : ''}`}>
                  <div className="toggle-thumb" />
                </div>
                <span><Trash2 size={16} style={{ display: 'inline', verticalAlign: -3 }} /> Remove Background</span>
              </div>

              <div className="toggle-container" onClick={() => { setVectorize(!vectorize); if (!vectorize) setRemoveBg(false); }}>
                <div className={`toggle-track ${vectorize ? 'on' : ''}`}>
                  <div className="toggle-thumb" />
                </div>
                <span><Paintbrush size={16} style={{ display: 'inline', verticalAlign: -3 }} /> Vectorize to SVG</span>
              </div>
            </div>
            {processing && (
              <div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                </div>
                <p style={{ textAlign: 'center', marginTop: 6, opacity: 0.6 }}>
                  {progress.current} / {progress.total} files processed
                </p>
              </div>
            )}

            <button className="btn btn-accent" onClick={processAll} disabled={processing} style={{ fontSize: '1.1rem' }}>
              {processing
                ? <><Loader size={20} className="animate-spin" /> Processing {progress.current}/{progress.total}...</>
                : <><Maximize size={20} /> Process {files.length} image{files.length > 1 ? 's' : ''}</>}
            </button>
          </div>
        </div>
      )}

      {log && (
        <div>
          <h3 className="section-title" style={{ marginBottom: 8 }}>Processing Log</h3>
          <div className="log-output">{log}</div>
        </div>
      )}

      {results.length > 0 && (
        <div className="result-bar">
          <div className="result-info">
            Done: {results.length} file{results.length > 1 ? 's' : ''} ready
          </div>
          {results.length === 1 ? (
            <button className="btn btn-accent" onClick={() => downloadBlob(results[0].blob, results[0].name)}>
              <Download size={18} /> Download {results[0].name}
            </button>
          ) : (
            <button className="btn btn-accent" onClick={downloadAll}>
              <Package size={18} /> Download All as ZIP
            </button>
          )}
        </div>
      )}
    </div>
  );
}
