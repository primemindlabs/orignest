'use client';

import Link from 'next/link';
import { IconFilePlus, IconUserPlus } from '@tabler/icons-react';

/**
 * Phase 90 — dashboard quick actions. "New Loan Application" presets the lead form
 * to the application stage (/leads/new?type=application). Inline-styled (globals
 * frozen); gold-only accent.
 */
export function QuickActions() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
    </div>
  );
}
