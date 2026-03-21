import React, { useState, useRef } from 'react';
import { Wand2, Play, Download, Loader, Sparkles, Terminal, Eye, Copy, Check } from 'lucide-react';
import FileDropZone from '../components/FileDropZone';
import { execFFmpeg } from '../engines/ffmpegEngine';
import { FFMPEG_PRESETS, getFileExtension, downloadBlob, formatFileSize } from '../utils';

const NVIDIA_NIM_URL = '/ai';

export default function FFmpegTab() {
  const [file, setFile] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [command, setCommand] = useState('');
  const [outputName, setOutputName] = useState('output.mp4');
  const [log, setLog] = useState('');
  const [processing, setProcessing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const logRef = useRef(null);

  const appendLog = (msg) => {
    setLog(prev => prev + msg + '\n');
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
  };

  const handlePreset = (preset) => {
    if (!file) return;
    const ext = getFileExtension(file.name);
    const inName = `input.${ext}`;
    const outExt = preset.outExt || ext;
    const outName = `output.${outExt}`;
    setOutputName(outName);
    const args = preset.cmd(inName, outName);
    setCommand(args.join(' '));
    setShowPreview(true);
  };

  const copyCommand = () => {
    navigator.clipboard.writeText(`ffmpeg ${command}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getApiKey = () => {
    const lsKey = localStorage.getItem('conversoin_nvidia_key');
    if (lsKey && lsKey.trim()) return lsKey.trim();
    const envKey = import.meta.env.VITE_NVIDIA_NIM_API_KEY;
    if (envKey && envKey !== 'your-nvidia-nim-api-key-here') return envKey;
    return null;
  };

  const askAI = async () => {
    if (!prompt.trim()) return;
    setAiLoading(true);
    setLog('');

    const apiKey = getApiKey();
    if (!apiKey) {
      appendLog('No NVIDIA NIM API key found.');
      appendLog('Add one in Settings or set VITE_NVIDIA_NIM_API_KEY in .env');
      appendLog('\nTrying to match a preset instead...');

      const lower = prompt.toLowerCase();
      const match = FFMPEG_PRESETS.find(p =>
        lower.includes(p.label.toLowerCase()) ||
        p.label.toLowerCase().split(' ').some(w => lower.includes(w))
      );
      if (match && file) {
        handlePreset(match);
        appendLog(`Matched preset: "${match.label}"`);
      } else {
        appendLog('Could not auto-match. Try one of the quick commands below.');
      }
      setAiLoading(false);
      return;
    }

    try {
      const ext = file ? getFileExtension(file.name) : 'mp4';
      const systemPrompt = `You are an FFmpeg command argument generator. Given a user's description of what they want to do with a media file, you output ONLY the ffmpeg command-line arguments (NOT "ffmpeg" itself).

Rules:
- Use "input.${ext}" as the input filename
- Choose an appropriate output filename like "output.EXT"
- Output ONLY the arguments, one per line or space-separated
- NO explanations, NO markdown, NO code blocks
- Must be valid ffmpeg arguments

Example input: "Convert this video to a GIF at 12fps"
Example output: -i input.mp4 -vf "fps=12,scale=480:-1" -loop 0 output.gif

Example input: "Extract audio as MP3"
Example output: -i input.mp4 -vn -acodec libmp3lame -q:a 2 output.mp3`;

      const response = await fetch(NVIDIA_NIM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'meta/llama-3.1-8b-instruct',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          max_tokens: 256,
          temperature: 0.1,
        }),
      });

      const data = await response.json();
      let aiCommand = data.choices?.[0]?.message?.content?.trim() || '';

      aiCommand = aiCommand.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      aiCommand = aiCommand.replace(/^ffmpeg\s+/, '');

      if (aiCommand) {
        setCommand(aiCommand);
        setShowPreview(true);
        const outMatch = aiCommand.match(/output\.(\w+)/);
        if (outMatch) setOutputName(`output.${outMatch[1]}`);
        appendLog('AI generated command successfully');
      } else {
        appendLog('AI returned empty response. Try rephrasing.');
      }
    } catch (e) {
      appendLog(`AI error: ${e.message}`);
    }
    setAiLoading(false);
  };

  const runCommand = async () => {
    if (!file || !command.trim()) return;
    setProcessing(true);
    setResult(null);
    setLog('');
    appendLog('RUNNING FFMPEG COMMAND');
    appendLog(`  $ ffmpeg ${command}\n`);
    appendLog('Loading FFmpeg WASM core...');

    try {
      const args = parseCommand(command);
      const ext = getFileExtension(file.name);
      const inName = `input.${ext}`;

      let outName = outputName;
      for (let i = args.length - 1; i >= 0; i--) {
        if (args[i].match(/^output\.\w+$/)) { outName = args[i]; break; }
      }

      const blob = await execFFmpeg(args, file, inName, outName, appendLog);
      setResult({ blob, name: outName });
      appendLog(`\nCOMPLETE: ${outName} (${formatFileSize(blob.size)})`);
    } catch (e) {
      appendLog(`\nFAILED: ${e.message}`);
    }
    setProcessing(false);
  };

  const parseCommand = (cmd) => {
    const args = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';
    for (const ch of cmd) {
      if (!inQuote && (ch === '"' || ch === "'")) {
        inQuote = true; quoteChar = ch;
      } else if (inQuote && ch === quoteChar) {
        inQuote = false;
      } else if (!inQuote && ch === ' ') {
        if (current) { args.push(current); current = ''; }
      } else {
        current += ch;
      }
    }
    if (current) args.push(current);
    return args;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--pencil)',
            background: 'var(--postit)',
          }}>
            <Wand2 size={24} strokeWidth={2.5} />
          </span>
          FFmpeg Media Editor
        </h2>
        <p style={{ opacity: 0.6, marginTop: 4 }}>
          Describe what you want, AI writes the command, review it, run in browser
        </p>
      </div>

      <FileDropZone onFiles={(f) => { setFile(f[0] || null); setResult(null); }} label="Drop your media file here" />
      <div className="card" style={{ borderRadius: 'var(--wobbly)' }}>
        <label style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem', display: 'block', marginBottom: 8 }}>
          <Sparkles size={18} style={{ display: 'inline', verticalAlign: -3 }} /> What do you want to do?
        </label>
        <textarea
          className="input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={'Describe in plain English, e.g.\n"Convert this video to a 12fps GIF, max width 480px"\n"Extract the audio track as high-quality MP3"\n"Speed up this clip 2x and remove audio"'}
          rows={4}
        />
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={askAI} disabled={aiLoading || !prompt.trim()}>
            {aiLoading ? <><Loader size={18} className="animate-spin" /> Generating...</> : <><Sparkles size={18} /> Generate Command</>}
          </button>
        </div>
      </div>
      <div>
        <h3 className="section-title" style={{ marginBottom: 12 }}>Quick Commands</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {FFMPEG_PRESETS.map((p, i) => (
            <button
              key={i}
              className="btn btn-sm btn-secondary"
              onClick={() => handlePreset(p)}
              disabled={!file}
              style={{ transform: `rotate(${(i % 3 - 1) * 0.5}deg)` }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {(command || showPreview) && (
        <div className="card" style={{
          borderRadius: 'var(--wobbly)',
          border: '3px solid var(--blue)',
          background: 'var(--white)',
        }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={20} /> Review Command Before Running
            </h3>
            <button className="btn btn-sm btn-secondary" onClick={copyCommand}>
              {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>

          <div style={{
            background: 'var(--pencil)',
            color: '#ffffff',
            padding: 20,
            borderRadius: 'var(--wobbly-sm)',
            fontFamily: "'Courier New', monospace",
            fontSize: '0.95rem',
            lineHeight: 1.8,
            overflowX: 'auto',
          }}>
            <span style={{ color: '#98fb98' }}>$</span>{' '}
            <span style={{ color: '#87ceeb' }}>ffmpeg</span>{' '}
            {command.split(/\s+/).map((token, i) => {
              let color = '#ffffff';
              if (token.startsWith('-')) color = '#ffb86c';
              else if (token.startsWith('input')) color = '#8be9fd';
              else if (token.startsWith('output')) color = '#50fa7b';
              else if (token.match(/^\d+$/)) color = '#bd93f9';
              else if (token.includes(':') || token.includes('=')) color = '#f1fa8c';
              return <span key={i} style={{ color }}>{token} </span>;
            })}
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: '0.85rem', opacity: 0.5, display: 'block', marginBottom: 4 }}>
              Edit command (if needed):
            </label>
            <input
              className="input"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
            />
          </div>

          <div className="flex items-center gap-3" style={{ marginTop: 8 }}>
            <label style={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Output filename:</label>
            <input
              className="input"
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              style={{ width: 200, fontFamily: 'monospace', fontSize: '0.9rem' }}
            />
          </div>

          <div className="card card-postit" style={{ marginTop: 12, padding: 12, borderRadius: 'var(--wobbly-sm)' }}>
            <p style={{ fontSize: '0.9rem' }}>
              This will: read <strong>{file?.name || 'your file'}</strong> ({file ? formatFileSize(file.size) : '?'}),
              process it in-browser using FFmpeg WASM, and produce <strong>{outputName}</strong>.
              No data leaves your machine.
            </p>
          </div>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button className="btn btn-accent" onClick={runCommand} disabled={processing || !file} style={{ fontSize: '1.15rem', padding: '14px 36px' }}>
              {processing ? <><Loader size={20} className="animate-spin" /> Processing...</> : <><Play size={20} /> Run This Command</>}
            </button>
          </div>
        </div>
      )}

      {log && (
        <div>
          <h3 className="section-title" style={{ marginBottom: 8 }}>
            <Terminal size={18} style={{ display: 'inline', verticalAlign: -3 }} /> Console Output
          </h3>
          <div className="log-output" ref={logRef}>{log}</div>
        </div>
      )}

      {result && (
        <div className="result-bar">
          <div className="result-info">
            Done: {result.name} ({formatFileSize(result.blob.size)})
          </div>
          <button className="btn btn-accent" onClick={() => downloadBlob(result.blob, result.name)}>
            <Download size={18} /> Download {result.name}
          </button>
        </div>
      )}
    </div>
  );
}
