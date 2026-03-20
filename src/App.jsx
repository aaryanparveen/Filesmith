import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Shrink, Wand2, Maximize, Settings, Pencil } from 'lucide-react';
import ConvertTab from './tabs/ConvertTab';
import CompressTab from './tabs/CompressTab';
import FFmpegTab from './tabs/FFmpegTab';
import ResizeTab from './tabs/ResizeTab';
import SettingsTab from './tabs/SettingsTab';

const TABS = [
  { id: 'convert', label: 'Convert', icon: ArrowRightLeft, component: ConvertTab },
  { id: 'compress', label: 'Compress', icon: Shrink, component: CompressTab },
  { id: 'ffmpeg', label: 'FFmpeg AI', icon: Wand2, component: FFmpegTab },
  { id: 'resize', label: 'Resize', icon: Maximize, component: ResizeTab },
  { id: 'settings', label: 'Settings', icon: Settings, component: SettingsTab },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('convert');

  useEffect(() => {
    const dm = localStorage.getItem('conversoin_dark_mode') === 'true';
    if (dm) document.documentElement.classList.add('dark');
  }, []);

  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component || ConvertTab;

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{
        padding: '20px 0 0',
        textAlign: 'center',
        position: 'relative',
      }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 52, height: 52,
              border: '3px solid var(--pencil)',
              borderRadius: '50% 40% 50% 40%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--postit)',
              boxShadow: 'var(--shadow)',
              transform: 'rotate(-3deg)',
            }}>
              <Pencil size={26} strokeWidth={2.5} />
            </div>
            <h1 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              transform: 'rotate(-1deg)',
            }}>
              filesm<span style={{ color: 'var(--accent)' }}>it</span>h
            </h1>
          </div>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.1rem',
            opacity: 0.5,
            maxWidth: 500,
            margin: '0 auto 16px',
            transform: 'rotate(0.3deg)',
          }}>
            Convert, compress, and process any file right in your browser via WebAssembly
          </p>

          <div style={{
            borderTop: '2px dashed var(--muted)',
            margin: '0 auto',
            maxWidth: 300,
            transform: 'rotate(-0.5deg)',
          }} />
        </div>
      </header>
      <nav className="container" style={{ marginTop: 20 }}>
        <div className="tab-nav">
          {TABS.map((tab, i) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  transform: activeTab === tab.id ? 'rotate(0deg)' : `rotate(${(i % 2 === 0 ? -0.5 : 0.5)}deg)`,
                }}
              >
                <Icon size={18} strokeWidth={2.5} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>
      <main className="container tab-content">
        <ActiveComponent />
      </main>
      <footer style={{
        textAlign: 'center',
        padding: '40px 24px 24px',
        opacity: 0.4,
        borderTop: '2px dashed var(--muted)',
        marginTop: 40,
      }}>
        <p style={{ fontSize: '0.9rem' }}>
          Powered by FFmpeg, libvips, ImageMagick, and SVGO, all running in WebAssembly
        </p>
        <p style={{ fontSize: '0.8rem', marginTop: 4 }}>
          No files leave your browser. Everything is processed locally.
        </p>
        <svg width="120" height="12" viewBox="0 0 120 12" style={{ margin: '12px auto 0', display: 'block' }}>
          <path
            d="M0 6 Q10 0, 20 6 Q30 12, 40 6 Q50 0, 60 6 Q70 12, 80 6 Q90 0, 100 6 Q110 12, 120 6"
            fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"
          />
        </svg>
      </footer>
    </div>
  );
}
