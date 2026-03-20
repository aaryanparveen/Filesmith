import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { formatFileSize } from '../utils';

export default function FileDropZone({ onFiles, multiple = false, accept, label }) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const inputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    const selected = multiple ? dropped : [dropped[0]];
    setFiles(selected);
    if (onFiles) onFiles(selected);
  }, [multiple, onFiles]);

  const handleChange = useCallback((e) => {
    const selected = Array.from(e.target.files);
    setFiles(selected);
    if (onFiles) onFiles(selected);
  }, [onFiles]);

  const removeFile = (index) => {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    if (onFiles) onFiles(next);
  };

  const clearAll = () => {
    setFiles([]);
    if (onFiles) onFiles([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <div
        className={`dropzone ${dragOver ? 'active' : ''} ${files.length > 0 ? 'has-file' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        <Upload size={40} strokeWidth={2.5} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
        <p style={{ fontSize: '1.2rem', marginBottom: 4 }}>
          {label || (multiple ? 'Drop files here or click to browse' : 'Drop a file here or click to browse')}
        </p>
        <p style={{ fontSize: '0.9rem', opacity: 0.45 }}>
          {accept ? `Accepts: ${accept}` : 'Any file type'}
        </p>
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
              {files.length} file{files.length > 1 ? 's' : ''} selected
            </span>
            <button className="btn btn-sm btn-secondary" onClick={clearAll}>
              <X size={14} /> Clear
            </button>
          </div>
          {files.map((f, i) => (
            <div key={i} className="file-item">
              <FileText size={18} />
              <span className="file-name">{f.name}</span>
              <span className="file-size">{formatFileSize(f.size)}</span>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
