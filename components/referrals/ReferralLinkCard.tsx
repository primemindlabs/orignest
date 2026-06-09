'use client';

/** Phase 61.1 — the LO's shareable referral link + lifetime stats. */
import { useState, useEffect } from 'react';
import { Link2, Copy, Check } from 'lucide-react';

export function ReferralLinkCard() {
  const [data, setData] = useState<{ code: string; url: string; stats: { leads_created: number; closed: number } } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { fetch('/api/referrals/code').then((r) => (r.ok ? r.json() : null)).then((d) => d && setData(d)).catch(() => undefined); }, []);
  if (!data) return null;

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 flex flex-wrap items-center gap-4 mb-4">
      <div className="flex items-center gap-2"><Link2 size={16} className="text-[var(--c-gold-deep)]" /><div><p className="text-[11px] uppercase tracking-wide text-[var(--c-label2)]">Your referral link</p><p className="text-[13px] font-mono text-[var(--c-text)]">{data.url}</p></div></div>
      <button onClick={() => { navigator.clipboard.writeText(data.url); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-[12px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)]">{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy link'}</button>
      <div className="ml-auto flex gap-5 text-center">
        <div><p className="text-[18px] font-bold text-[var(--c-text)]">{data.stats.leads_created}</p><p className="text-[10px] uppercase text-[var(--c-label2)]">Leads</p></div>
        <div><p className="text-[18px] font-bold text-[var(--c-gold-deep)]">{data.stats.closed}</p><p className="text-[10px] uppercase text-[var(--c-label2)]">Closed</p></div>
      </div>
    </div>
  );
}
