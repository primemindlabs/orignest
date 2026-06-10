'use client';

import { useState } from 'react';
import { IconCopy, IconQrcode, IconShare, IconCheck } from '@tabler/icons-react';

/**
 * Phase 90 — LO application-link card for Settings. Copy / QR / Share.
 * URL is built from the configured app domain (apex ashleyiq.com). QR image is
 * fetched from api.qrserver.com at click time (not bundled).
 */
export function ApplicationLink({ slug }: { slug: string }) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ashleyiq.com';
  const url = `${base.replace(/\/$/, '')}/apply/${slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: 'My application link', url });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    handleCopy();
  };

  const btn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12.5,
    fontWeight: 500,
    color: '#1D1D1F',
    background: '#ffffff',
    border: '0.5px solid rgba(0,0,0,0.14)',
    borderRadius: 8,
    padding: '6px 11px',
    cursor: 'pointer',
    textDecoration: 'none',
  };

  return (
    <div className="bg-surface rounded-card shadow-card border border-border p-5">
      <h3 className="text-[15px] font-semibold text-black">Your application link</h3>
      <p className="text-sm text-label-2 mt-0.5">
        Share this with borrowers so they can start an application directly with you.
      </p>

      <div
        className="mt-4 flex flex-wrap items-center gap-2 justify-between"
        style={{ background: '#f7f7f5', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '10px 12px' }}
      >
        <span style={{ fontSize: 13, color: '#1D1D1F', fontFamily: "'DM Mono', monospace", wordBreak: 'break-all' }}>
          {url}
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={handleCopy} style={btn} title="Copy link">
            {copied ? <IconCheck size={15} color="#1a7a3c" /> : <IconCopy size={15} />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <a href={qrUrl} target="_blank" rel="noopener noreferrer" style={btn} title="View QR code">
            <IconQrcode size={15} />
            QR code
          </a>
          <button type="button" onClick={handleShare} style={btn} title="Share">
            <IconShare size={15} />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
