import React, { useState, useEffect } from 'react';
import { Settings, Key, Moon, Sun, Save, Check } from 'lucide-react';

export default function SettingsTab() {
  const [apiKey, setApiKey] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('conversoin_nvidia_key') || '';
    setApiKey(stored);
    const dm = localStorage.getItem('conversoin_dark_mode') === 'true';
    setDarkMode(dm);
    if (dm) document.documentElement.classList.add('dark');
  }, []);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('conversoin_dark_mode', String(next));
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const saveKey = () => {
    localStorage.setItem('conversoin_nvidia_key', apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--pencil)',
            background: 'var(--muted)',
          }}>
            <Settings size={24} strokeWidth={2.5} />
          </span>
          Settings
        </h2>
        <p style={{ opacity: 0.6, marginTop: 4 }}>
          Configure API keys and appearance
        </p>
      </div>
      <div className="card" style={{ borderRadius: 'var(--wobbly)' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.2rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          {darkMode ? <Moon size={20} /> : <Sun size={20} />} Appearance
        </h3>
        <div className="toggle-container" onClick={toggleDark}>
          <div className={`toggle-track ${darkMode ? 'on' : ''}`}>
            <div className="toggle-thumb" />
          </div>
          <span style={{ fontSize: '1.1rem' }}>Dark Mode</span>
        </div>
      </div>
      <div className="card" style={{ borderRadius: 'var(--wobbly)' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.2rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Key size={20} /> NVIDIA NIM API Key
        </h3>
        <p style={{ opacity: 0.5, marginBottom: 16, fontSize: '1rem' }}>
          Used for AI-powered FFmpeg command generation. Get a key from
          {' '}<a href="https://build.nvidia.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>build.nvidia.com</a>
        </p>
        <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
          <input
            className="input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="nvapi-..."
            style={{ flex: 1, minWidth: 200, fontFamily: 'monospace' }}
          />
          <button className="btn" onClick={saveKey}>
            {saved ? <><Check size={18} /> Saved!</> : <><Save size={18} /> Save</>}
          </button>
        </div>
        {apiKey && (
          <p style={{ marginTop: 12, fontSize: '0.9rem', opacity: 0.5 }}>
            Key stored in browser localStorage (never sent to any server except NVIDIA).
          </p>
        )}
      </div>
      <div className="card card-postit" style={{ borderRadius: 'var(--wobbly)' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>
          About Filesmith
        </h3>
        <p style={{ fontSize: '1rem', lineHeight: 1.6 }}>
          All processing happens in your browser via WebAssembly.
          No files are uploaded anywhere. Powered by FFmpeg, libvips,
          ImageMagick, and SVGO.
        </p>
      </div>
    </div>
  );
}
