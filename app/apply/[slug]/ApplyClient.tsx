'use client';

import { IconArrowRight, IconShieldCheck } from '@tabler/icons-react';

interface Props {
  fullName: string;
  avatarUrl: string | null;
  nmlsId: string | null;
  orgName: string | null;
  ctaHref: string;
}

const GOLD = '#C9A95C';

/**
 * Phase 90 — public, branded borrower landing for a single LO's application link.
 * No org brand-color column exists yet, so the accent is always Ashley IQ gold.
 * Styled inline (globals.css is frozen).
 */
export default function ApplyClient({ fullName, avatarUrl, nmlsId, orgName, ctaHref }: Props) {
  const initial = fullName.charAt(0).toUpperCase() || 'L';

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f9f9f8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: '2.5rem 2rem',
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={fullName}
            style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 1rem', display: 'block' }}
          />
        ) : (
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: '#F5EFE0',
              color: '#876830',
              fontSize: '2rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            {initial}
          </div>
        )}

        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1D1D1F', lineHeight: 1.3, margin: 0 }}>
          Start your application with {fullName}
        </h1>

        {orgName && <p style={{ fontSize: '0.9rem', color: '#6E6E73', margin: '0.5rem 0 0' }}>{orgName}</p>}

        {nmlsId && (
          <p
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.8rem',
              color: '#6E6E73',
              margin: '0.75rem 0 1.5rem',
            }}
          >
            <IconShieldCheck size={14} />
            NMLS #{nmlsId}
          </p>
        )}

        <div style={{ marginTop: nmlsId ? 0 : '1.5rem' }}>
          <a
            href={ctaHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: '#ffffff',
              background: GOLD,
              padding: '0.75rem 1.5rem',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '1rem',
              textDecoration: 'none',
            }}
          >
            Get started <IconArrowRight size={16} />
          </a>
        </div>

        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '1.5rem' }}>
          Powered by Ashley IQ · Secure &amp; confidential
        </p>
      </div>
    </main>
  );
}
