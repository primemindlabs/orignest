'use client';

import { useState, useRef, useEffect } from 'react';
import { IconDownload, IconChevronDown, IconFileText, IconFileTypePdf } from '@tabler/icons-react';

export function DownloadMenu({ onCsv, onPdf }: { onCsv: () => void; onPdf: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const item: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '7px 12px',
    fontSize: 13, color: '#1D1D1F', background: 'transparent', cursor: 'pointer', textAlign: 'left',
  };

  return (
    <div ref={ref} style={{ position: 'relative' }} className="no-print">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-sm font-medium border border-border text-black bg-surface hover:bg-fill transition-colors"
      >
        <IconDownload size={14} /> Download <IconChevronDown size={12} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div
          style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', width: 160, zIndex: 40, background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.12)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden', padding: '4px 0' }}
        >
          <button style={item} onClick={() => { onCsv(); setOpen(false); }} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f3')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <IconFileText size={14} /> Export CSV
          </button>
          <button style={item} onClick={() => { onPdf(); setOpen(false); }} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f3')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <IconFileTypePdf size={14} /> Export PDF
          </button>
        </div>
      )}
    </div>
  );
}
