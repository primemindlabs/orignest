'use client';

/** Phase 48.3/48.7 — realtor Discover: match-scored prospects + add-to-network. */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Building2, MapPin, Plus, Check, Compass } from 'lucide-react';
import { TIER_STYLE, type MatchScoreResult } from '@/lib/realtors/matchScore';

interface Profile { id: string; first_name: string; last_name: string; brokerage: string | null; transactions_12m: number | null; avg_sale_price: number | null; buyer_side_pct: number | null; primary_zip_codes: string[] | null }
interface Prospect { profile: Profile; match: MatchScoreResult }

export function DiscoverClient() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [minTx, setMinTx] = useState(0);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/realtors/discover');
    if (res.ok) setProspects((await res.json()).prospects ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(id: string) {
    setBusy(id);
    try { const r = await fetch('/api/realtors/discover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ market_profile_id: id }) }); if (r.ok) setAdded((s) => new Set(s).add(id)); } finally { setBusy(null); }
  }

  const shown = prospects.filter((p) => (p.profile.transactions_12m ?? 0) >= minTx);

  if (loading) return <p className="text-[13px] text-[var(--c-label2)]">Loading…</p>;

  if (prospects.length === 0) {
    return (
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-8 text-center">
        <Compass size={24} className="text-[var(--c-gold-deep)] mx-auto mb-2" />
        <p className="text-[14px] font-semibold text-[var(--c-text)]">No market agents discovered yet</p>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5 max-w-md mx-auto">Discovery scans MLS production in your target markets to find top-producing agents you&apos;re not working with yet — ranked by how well they match your business. It activates once an ATTOM data connection is configured.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-[var(--c-label2)]">Min deals/yr:</span>
        {[0, 6, 12, 24].map((n) => (
          <button key={n} onClick={() => setMinTx(n)} className={`text-[12px] px-2.5 py-1 rounded-full border ${minTx === n ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]' : 'border-[var(--c-border)] text-[var(--c-label2)]'}`}>{n === 0 ? 'All' : `${n}+`}</button>
        ))}
      </div>

      <div className="space-y-2.5">
        {shown.map(({ profile: p, match }) => {
          const style = TIER_STYLE[match.tier];
          const isAdded = added.has(p.id);
          return (
            <div key={p.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[var(--c-text)]">{p.first_name} {p.last_name}</p>
                  <p className="text-[11px] text-[var(--c-label2)] inline-flex items-center gap-1"><Building2 size={11} /> {p.brokerage ?? '—'}</p>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0" style={{ background: style.color }}>{match.score} · {style.label}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] text-[var(--c-label2)] mb-2">
                <span>📊 {p.transactions_12m ?? 0} deals/yr</span>
                {p.avg_sale_price ? <span>💰 ${(Number(p.avg_sale_price) / 1000).toFixed(0)}K avg</span> : null}
                {p.buyer_side_pct != null ? <span>🏠 {Math.round(Number(p.buyer_side_pct) * 100)}% buyer</span> : null}
                {(p.primary_zip_codes ?? []).slice(0, 3).map((z) => <span key={z} className="inline-flex items-center gap-0.5"><MapPin size={10} /> {z}</span>)}
              </div>
              <p className="text-[12px] text-[var(--c-text)] italic mb-2">&ldquo;{match.opportunity}&rdquo;</p>
              <div className="space-y-1 mb-3">
                {match.factors.map((f) => (
                  <div key={f.name} className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--c-label2)] w-20 capitalize">{f.name.replace('_', ' ')}</span>
                    <div className="h-1.5 rounded-full bg-[var(--c-fill)] flex-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${f.score}%`, background: style.color }} /></div>
                  </div>
                ))}
              </div>
              <button onClick={() => add(p.id)} disabled={isAdded || busy === p.id} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-[12px] font-medium bg-[var(--c-gold)] text-white hover:opacity-90 disabled:opacity-60">
                {isAdded ? <><Check size={13} /> Added to network</> : <><Plus size={13} /> {busy === p.id ? 'Adding…' : 'Add to network'}</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
