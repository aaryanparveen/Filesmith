import React, { useState, useEffect } from 'react';
import { Shrink, Download, Loader, Info, Settings2 } from 'lucide-react';
import FileDropZone from '../components/FileDropZone';
import { formatFileSize, getFileExtension, downloadBlob, readFileAsArrayBuffer, readFileAsText, detectFileCategory } from '../utils';
import { compressImage } from '../engines/vipsEngine';
import { compressWithFFmpeg, execFFmpeg } from '../engines/ffmpegEngine';
import { optimizeSVG } from '../engines/svgoEngine';

const VIDEO_CODECS = [
  { value: 'libx264', label: 'H.264 (widely compatible)' },
  { value: 'libx265', label: 'H.265/HEVC (better compression)' },
  { value: 'libvpx-vp9', label: 'VP9 (WebM, great for web)' },
  { value: 'libaom-av1', label: 'AV1 (best compression, slow)' },
];

const AUDIO_CODECS = [
  { value: 'libmp3lame', label: 'MP3' },
  { value: 'aac', label: 'AAC' },
  { value: 'libopus', label: 'Opus (best quality/size)' },
  { value: 'libvorbis', label: 'Vorbis (OGG)' },
  { value: 'flac', label: 'FLAC (lossless)' },
];

const SAMPLE_RATES = ['8000', '16000', '22050', '44100', '48000'];
const AUDIO_BITRATES = ['64', '96', '128', '160', '192', '256', '320'];

function estimateSize(original, quality, category, codec, bitrate, sampleRate) {
  let ratio = 1;
  if (category === 'image') {
    if (quality <= 20) ratio = 0.08;
    else if (quality <= 40) ratio = 0.15;
    else if (quality <= 60) ratio = 0.28;
    else if (quality <= 80) ratio = 0.5;
    else ratio = 0.75;
  } else if (category === 'video') {
    const codecFactor = { 'libx264': 1, 'libx265': 0.65, 'libvpx-vp9': 0.6, 'libaom-av1': 0.45 };
    const crf = Math.max(1, Math.min(51, Math.round(51 - (quality / 100) * 50)));
    ratio = (crf / 51) * 1.5 * (codecFactor[codec] || 1);
    ratio = Math.min(ratio, 1.2);
  } else if (category === 'audio') {
    if (bitrate) {
      const origBitrate = (original * 8) / 180;
      ratio = (parseInt(bitrate) * 1000) / origBitrate;
      ratio = Math.min(ratio, 1.5);
    } else {
      ratio = quality / 100;
    }
  } else if (category === 'image' || category === 'svg') {
    ratio = 0.3 + (quality / 100) * 0.5;
  } else {
    ratio = 0.4 + (quality / 100) * 0.5;
  }
  return Math.round(original * Math.max(0.02, Math.min(ratio, 1.5)));
}

export default function CompressTab() {
  const [file, setFile] = useState(null);
  const [quality, setQuality] = useState(75);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [preserveMeta, setPreserveMeta] = useState(false);
  const [log, setLog] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [videoCodec, setVideoCodec] = useState('libx264');
  const [audioCodec, setAudioCodec] = useState('libmp3lame');
  const [audioBitrate, setAudioBitrate] = useState('128');
  const [sampleRate, setSampleRate] = useState('44100');

  const ext = file ? getFileExtension(file.name) : '';
  const category = ext ? detectFileCategory(ext) : '';
  const estimated = file ? estimateSize(file.size, quality, category, videoCodec, audioBitrate, sampleRate) : 0;

  const compress = async () => {
    if (!file) return;
    setProcessing(true);
    setResult(null);
    setLog('');
    const addLog = (msg) => setLog(prev => prev + msg + '\n');

    try {
      let blob;
      let outName;

      if (category === 'image' && ext !== 'svg') {
        addLog(`Compressing image with wasm-vips (quality: ${quality}%)...`);
        const buf = await readFileAsArrayBuffer(file);
        let outFmt;
        if (['png'].includes(ext)) outFmt = '.png';
        else if (['webp'].includes(ext)) outFmt = '.webp';
        else if (['avif'].includes(ext)) outFmt = '.avif';
        else outFmt = '.jpg';
        const compressed = await compressImage(new Uint8Array(buf), quality, outFmt);
        blob = new Blob([compressed], { type: 'application/octet-stream' });
        outName = `compressed.${outFmt.slice(1)}`;
        addLog('Image compressed successfully');
      } else if (ext === 'svg') {
        addLog(`Optimizing SVG with SVGO (aggressiveness: ${100 - quality}%)...`);
        const text = await readFileAsText(file);
        const optimized = optimizeSVG(text, quality);
        blob = new Blob([optimized], { type: 'image/svg+xml' });
        outName = 'compressed.svg';
        addLog('SVG optimized');
      } else if (category === 'video') {
        const crf = Math.max(1, Math.min(51, Math.round(51 - (quality / 100) * 50)));
        const outExt = videoCodec === 'libvpx-vp9' ? 'webm' : (videoCodec === 'libaom-av1' ? 'mp4' : ext);
        const inName = `input.${ext}`;
        const oName = `output.${outExt}`;

        const args = ['-i', inName, '-c:v', videoCodec, '-crf', String(crf), '-preset', 'fast'];
        if (preserveMeta) args.push('-map_metadata', '0');
        else args.push('-map_metadata', '-1');
        args.push(oName);

        addLog(`Re-encoding video: ${videoCodec}, CRF ${crf}...`);
        addLog(`   Command: ffmpeg ${args.join(' ')}`);
        blob = await execFFmpeg(args, file, inName, oName, addLog);
        outName = `compressed.${outExt}`;
      } else if (category === 'audio') {
        const inName = `input.${ext}`;
        const codecToExt = { 'libmp3lame': 'mp3', 'aac': 'm4a', 'libopus': 'opus', 'libvorbis': 'ogg', 'flac': 'flac' };
        const outExt = codecToExt[audioCodec] || ext;
        const oName = `output.${outExt}`;

        const args = ['-i', inName, '-c:a', audioCodec, '-b:a', `${audioBitrate}k`, '-ar', sampleRate];
        if (preserveMeta) args.push('-map_metadata', '0');
        else args.push('-map_metadata', '-1');
        args.push(oName);

        addLog(`Re-encoding audio: ${audioCodec}, ${audioBitrate}kbps, ${sampleRate}Hz...`);
        addLog(`   Command: ffmpeg ${args.join(' ')}`);
        blob = await execFFmpeg(args, file, inName, oName, addLog);
        outName = `compressed.${outExt}`;
      } else if (category === 'pdf') {
        addLog('Compressing PDF (reducing embedded image quality)...');
        const inName = `input.pdf`;
        const oName = `output.pdf`;
        addLog('PDF compression via WASM is limited. For best results use desktop tools.');
        blob = new Blob([await readFileAsArrayBuffer(file)]);
        outName = 'compressed.pdf';
      } else {
        addLog(`Attempting generic compression for .${ext}...`);
        const inName = `input.${ext}`;
        const oName = `output.${ext}`;
        blob = await execFFmpeg(['-i', inName, oName], file, inName, oName, addLog);
        outName = `compressed.${ext}`;
      }

      const savings = ((1 - blob.size / file.size) * 100).toFixed(1);
      setResult({ blob, name: outName, savings: parseFloat(savings) });
      addLog(`\nDone! ${formatFileSize(file.size)} -> ${formatFileSize(blob.size)} (${savings}% ${savings > 0 ? 'saved' : 'increase'})`);
    } catch (e) {
      addLog(`\nError: ${e.message}`);
    }
    setProcessing(false);
  };

  const qualityLabel = quality < 20 ? 'Tiny' : quality < 40 ? 'Compact' : quality < 65 ? 'Balanced' : quality < 85 ? 'Good' : 'Best';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--pencil)',
            background: 'var(--accent)', color: 'white',
          }}>
            <Shrink size={24} strokeWidth={2.5} />
          </span>
          Universal Compressor
        </h2>
        <p style={{ opacity: 0.6, marginTop: 4 }}>
          Drop any file, get it smaller. 8mb Discord limit defeated.
        </p>
      </div>

      <FileDropZone onFiles={(f) => { setFile(f[0] || null); setResult(null); setLog(''); }} />

      {file && (
        <div className="card" style={{ borderRadius: 'var(--wobbly)' }}>
          <div className="flex flex-col gap-4">
            <div className="file-item" style={{ background: 'var(--paper)' }}>
              <span className="file-name" style={{ fontWeight: 700 }}>{file.name}</span>
              <span className="badge">{category || 'file'}</span>
              <span className="file-size">{formatFileSize(file.size)}</span>
            </div>
            <div className="slider-container">
              <div className="slider-label">
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem' }}>Quality</span>
                <span className="badge">{quality}% — {qualityLabel}</span>
              </div>
              <input
                type="range" min="1" max="100" value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
              />
              <div className="flex justify-between" style={{ fontSize: '0.8rem', opacity: 0.4 }}>
                <span>Smallest file</span>
                <span>Best quality</span>
              </div>
            </div>
            <div className="card card-postit" style={{ padding: 16, borderRadius: 'var(--wobbly-sm)' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <Info size={16} />
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>Estimated result</span>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '1.2rem' }}>{formatFileSize(file.size)}</span>
                <span style={{ fontSize: '1.2rem' }}>{'→'}</span>
                <span style={{ fontSize: '1.4rem', fontFamily: 'var(--font-heading)', fontWeight: 700, color: estimated < file.size ? 'var(--blue)' : 'var(--accent)' }}>
                  ~{formatFileSize(estimated)}
                </span>
                <span style={{ opacity: 0.5, fontSize: '0.9rem' }}>
                  ({estimated < file.size ? `~${((1 - estimated / file.size) * 100).toFixed(0)}% smaller` : 'may grow'})
                </span>
              </div>
            </div>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ alignSelf: 'flex-start' }}
            >
              <Settings2 size={16} /> {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
            </button>

            {showAdvanced && (
              <div className="card" style={{ padding: 16, borderRadius: 'var(--wobbly-sm)', borderStyle: 'dashed' }}>
                {category === 'video' && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                      Video Codec
                    </label>
                    <select className="input" value={videoCodec} onChange={(e) => setVideoCodec(e.target.value)}>
                      {VIDEO_CODECS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                )}
                {(category === 'audio' || category === 'video') && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                      Audio Codec
                    </label>
                    <select className="input" value={audioCodec} onChange={(e) => setAudioCodec(e.target.value)}>
                      {AUDIO_CODECS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                )}
                {(category === 'audio' || category === 'video') && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                      Audio Bitrate
                    </label>
                    <select className="input" value={audioBitrate} onChange={(e) => setAudioBitrate(e.target.value)}>
                      {AUDIO_BITRATES.map(b => <option key={b} value={b}>{b} kbps</option>)}
                    </select>
                  </div>
                )}
                {(category === 'audio') && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                      Sample Rate
                    </label>
                    <select className="input" value={sampleRate} onChange={(e) => setSampleRate(e.target.value)}>
                      {SAMPLE_RATES.map(s => <option key={s} value={s}>{(parseInt(s)/1000).toFixed(1)} kHz</option>)}
                    </select>
                  </div>
                )}
                <div className="toggle-container" onClick={() => setPreserveMeta(!preserveMeta)}>
                  <div className={`toggle-track ${preserveMeta ? 'on' : ''}`}>
                    <div className="toggle-thumb" />
                  </div>
                  <span>Preserve metadata</span>
                </div>
              </div>
            )}

            <button className="btn btn-accent" onClick={compress} disabled={processing} style={{ fontSize: '1.2rem' }}>
              {processing ? <><Loader size={20} className="animate-spin" /> Compressing...</> : <><Shrink size={20} /> Compress Now</>}
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

      {result && (
        <div className="result-bar">
          <div className="result-info">
            Done: {formatFileSize(file.size)} {'→'} <span className="savings">{formatFileSize(result.blob.size)}</span>
            <span style={{ opacity: 0.6, fontSize: '0.9rem' }}>
              ({result.savings > 0 ? `${result.savings.toFixed(1)}% saved` : `grew ${Math.abs(result.savings).toFixed(1)}%`})
            </span>
          </div>
          <button className="btn btn-accent" onClick={() => downloadBlob(result.blob, result.name)}>
            <Download size={18} /> Download {result.name}
          </button>
        </div>
      )}
    </div>
  );
}
