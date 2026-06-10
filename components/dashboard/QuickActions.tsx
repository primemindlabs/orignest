'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconFilePlus, IconUserPlus, IconLink, IconCheck } from '@tabler/icons-react';

/**
 * Phase 90 — dashboard quick actions. "New Loan Application" presets the lead form
 * to the application stage; when an applyUrl is passed, a "Copy application link"
 * button surfaces the LO's shareable borrower link front-and-center. Inline-styled
 * (globals frozen); gold-only accent.
 */
export function QuickActions({ applyUrl }: { applyUrl?: string | null }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (!applyUrl) return;
    try {
      await navigator.clipboard.writeText(applyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <Link
        href="/leads/new?type=application"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          background: '#C9A95C',
          color: '#ffffff',
          fontSize: 13,
          fontWeight: 600,
          padding: '8px 14px',
          borderRadius: 8,
          textDecoration: 'none',
        }}
      >
        <IconFilePlus size={15} />
        New Loan Application
      </Link>

      <Link
        href="/leads/new"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          background: '#ffffff',
          color: '#1D1D1F',
          fontSize: 13,
          fontWeight: 500,
          padding: '8px 14px',
          borderRadius: 8,
          border: '0.5px solid rgba(0,0,0,0.14)',
          textDecoration: 'none',
        }}
      >
        <IconUserPlus size={15} />
        Add Lead
      </Link>

      {applyUrl && (
        <button
          type="button"
          onClick={copyLink}
          title={applyUrl}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            background: '#fdf8ee',
            color: '#876830',
            fontSize: 13,
            fontWeight: 500,
            padding: '8px 14px',
            borderRadius: 8,
            border: '0.5px solid rgba(201,169,92,0.4)',
            cursor: 'pointer',
          }}
        >
          {copied ? <IconCheck size={15} /> : <IconLink size={15} />}
          {copied ? 'Link copied!' : 'Copy application link'}
        </button>
      )}
    </div>
  );
}
