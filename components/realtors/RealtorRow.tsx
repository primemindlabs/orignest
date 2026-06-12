'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { differenceInCalendarDays } from 'date-fns';
import { IconAlertCircle, IconMessage, IconPhone, IconCheck } from '@tabler/icons-react';
import { HeatBandBadge } from './HeatBandBadge';

export interface Realtor {
  id: string;
  first_name: string | null;
  last_name: string | null;
  brokerage_name: string | null;
  primary_city: string | null;
  phone: string | null;
  email: string | null;
  volume_12m: number | null;
  transactions_12m: number | null;
  deals_referred_12m: number | null;
  last_contact_at: string | null;
  partnership_tier: string | null;
  // Phase 95 — heat (momentum) score, merged in by the realtors page.
  heat_score?: number | null;
  heat_band?: string | null;
  heat_deals_90d?: number | null;
}

function initials(first: string | null, last: string | null) {
  return `${(first ?? '')[0] ?? ''}${(last ?? '')[0] ?? ''}`.toUpperCase() || '?';
}

function fmtDollars(n: number | null): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v}`;
}

export function RealtorRow({ realtor }: { realtor: Realtor }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [justLogged, setJustLogged] = useState(false);

  const name = `${realtor.first_name ?? ''} ${realtor.last_name ?? ''}`.trim() || 'Unnamed agent';
  const daysSince = realtor.last_contact_at
    ? differenceInCalendarDays(new Date(), new Date(realtor.last_contact_at))
    : null;
  const isStale = daysSince !== null && daysSince > 21;
  const isWarm = daysSince !== null && daysSince <= 7;

  const avatarStyle: React.CSSProperties = isWarm
    ? { background: '#edf7f0', border: '1.5px solid #1a7a3c', color: '#1a7a3c' }
    : isStale
    ? { background: '#fdf0ea', border: '1.5px solid #C4724A', color: '#b85c20' }
    : { background: '#F5EFE0', border: '1.5px solid #C9A95C', color: '#8A6310' };

  async function logTouch(touch_type: string) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/realtors/${realtor.id}/touch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ touch_type }),
      });
      if (r.ok) {
        setJustLogged(true);
        setTimeout(() => setJustLogged(false), 1500);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const actBtn: React.CSSProperties = {
    width: 24,
    height: 24,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    border: '0.5px solid rgba(0,0,0,0.12)',
    background: '#fff',
    color: '#6E6E73',
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    // role=link div instead of an <a> so the action buttons aren't nested in an anchor.
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/realtors/${realtor.id}`)}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/realtors/${realtor.id}`); }}
      className="flex items-center gap-3 px-4 py-3 hover:bg-fill transition-colors border-b border-border cursor-pointer"
    >
      {/* Identity */}
      <div className="flex items-center gap-3" style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            ...avatarStyle,
            width: 34,
            height: 34,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {initials(realtor.first_name, realtor.last_name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: '#1D1D1F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </span>
            {realtor.heat_band && <HeatBandBadge band={realtor.heat_band} className="flex-shrink-0" />}
          </div>
          <div style={{ fontSize: 11.5, color: '#6E6E73', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {realtor.brokerage_name || realtor.primary_city || '—'}
          </div>
        </div>
      </div>

      {/* Volume (12-mo) */}
      <div style={{ width: 92, textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1D1D1F', fontFamily: "'DM Mono', monospace" }}>
          {fmtDollars(realtor.volume_12m)}
        </div>
        <div style={{ fontSize: 10.5, color: '#86868B' }}>{realtor.transactions_12m ?? 0} txns/12mo</div>
      </div>

      {/* Last contact */}
      <div style={{ width: 84, textAlign: 'right', flexShrink: 0 }}>
        {isStale ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#b85c20', fontWeight: 500 }}>
            <IconAlertCircle size={11} /> {daysSince}d ago
          </span>
        ) : daysSince !== null ? (
          <span style={{ fontSize: 11.5, color: isWarm ? '#1a7a3c' : '#6E6E73' }}>{daysSince === 0 ? 'Today' : `${daysSince}d ago`}</span>
        ) : (
          <span style={{ fontSize: 11.5, color: '#86868B' }}>Never</span>
        )}
      </div>

      {/* Referrals to you (12-mo) */}
      <div style={{ width: 64, textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: (realtor.deals_referred_12m ?? 0) > 0 ? '#8A6310' : '#86868B', fontFamily: "'DM Mono', monospace" }}>
          {realtor.deals_referred_12m ?? 0}
        </div>
        <div style={{ fontSize: 10, color: '#86868B' }}>referred</div>
      </div>

      {/* Actions — 80px fixed */}
      <div style={{ width: 80, display: 'flex', gap: 4, justifyContent: 'flex-end', flexShrink: 0 }}>
        <button
          type="button"
          title={realtor.phone ? 'Text' : 'No phone'}
          disabled={!realtor.phone || busy}
          onClick={(e) => { stop(e); if (realtor.phone) { logTouch('sms'); window.location.href = `sms:${realtor.phone}`; } }}
          style={{ ...actBtn, opacity: realtor.phone ? 1 : 0.35, cursor: realtor.phone ? 'pointer' : 'not-allowed' }}
        >
          <IconMessage size={13} />
        </button>
        <button
          type="button"
          title={realtor.phone ? 'Call' : 'No phone'}
          disabled={!realtor.phone || busy}
          onClick={(e) => { stop(e); if (realtor.phone) { logTouch('call'); window.location.href = `tel:${realtor.phone}`; } }}
          style={{ ...actBtn, opacity: realtor.phone ? 1 : 0.35, cursor: realtor.phone ? 'pointer' : 'not-allowed' }}
        >
          <IconPhone size={13} />
        </button>
        <button
          type="button"
          title="Log contact"
          onClick={(e) => { stop(e); logTouch('note'); }}
          disabled={busy}
          style={{ ...actBtn, cursor: 'pointer', color: justLogged ? '#1a7a3c' : '#6E6E73', borderColor: justLogged ? '#1a7a3c' : 'rgba(0,0,0,0.12)' }}
        >
          <IconCheck size={13} />
        </button>
      </div>
    </div>
  );
}
