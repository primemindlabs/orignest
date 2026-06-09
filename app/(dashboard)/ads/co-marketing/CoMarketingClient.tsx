'use client';

/** Phase 33.3 — RESPA-gated co-marketing campaign builder. */
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { ShieldAlert, ShieldCheck, Check } from 'lucide-react';
import { validateCoopBudgetSplit } from '@/lib/compliance/respaCoopAdCheck';

interface Partner { id: string; label: string }

export function CoMarketingClient({ partners }: { partners: Partner[] }) {
  const [realtorId, setRealtorId] = useState(partners[0]?.id ?? '');
  const [loPct, setLoPct] = useState(50);
  const [totalBudget, setTotalBudget] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const realtorPct = 100 - loPct;
  const split = validateCoopBudgetSplit({ lo_percentage: loPct, realtor_percentage: realtorPct });

  async function create() {
    if (!realtorId) { setErr('Select a realtor partner.'); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/ad-center/coop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realtor_id: realtorId,
          lo_budget_pct: loPct,
          realtor_budget_pct: realtorPct,
          total_budget_cents: totalBudget ? Math.round(parseFloat(totalBudget) * 100) : undefined,
          respa_acknowledged: acknowledged,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create campaign');
      setDone(true);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed to create campaign'); } finally { setBusy(false); }
  }

  if (partners.length === 0) {
    return <p className="text-[13px] text-[var(--c-label2)]">Add a realtor partner first (Partners) to build a co-marketing campaign.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-4">
        <Select
          label="Realtor partner"
          value={realtorId}
          onChange={(e) => setRealtorId(e.target.value)}
          options={partners.map((p) => ({ value: p.id, label: p.label }))}
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-medium text-[var(--c-text)]">Budget split</span>
            <span className="text-[12px] font-mono tabular-nums text-[var(--c-label2)]">LO {loPct}% · Realtor {realtorPct}%</span>
          </div>
          <input type="range" min={0} max={100} step={5} value={loPct} onChange={(e) => setLoPct(parseInt(e.target.value, 10))} className="w-full accent-[var(--c-gold)]" />
        </div>

        <Input label="Total monthly budget ($, optional)" value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} placeholder="1000" />

        {/* RESPA status — surfaced prominently */}
        <div className={`rounded-[10px] px-3 py-2.5 flex items-start gap-2 ${split.compliant ? 'bg-[rgba(52,199,89,0.06)]' : 'bg-[rgba(255,59,48,0.06)]'}`}>
          {split.compliant ? <ShieldCheck size={15} className="text-green flex-shrink-0 mt-0.5" /> : <ShieldAlert size={15} className="text-[var(--c-danger)] flex-shrink-0 mt-0.5" />}
          <p className="text-[12px] text-[var(--c-text)] leading-snug">
            {split.compliant
              ? 'This split is within the RESPA safe range. Each party should pay proportional to the marketing benefit they receive.'
              : split.warning}
          </p>
        </div>

        <label className="flex items-start gap-2 text-[12px] text-[var(--c-text)] cursor-pointer">
          <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 accent-[var(--c-gold)]" />
          I acknowledge the RESPA Section 8 disclosure: co-marketing costs must be split in proportion to the benefit each party receives, and this ad is not a referral fee.
        </label>

        {err && <p className="text-[12px] text-[var(--c-danger)]">{err}</p>}
        {done ? (
          <p className="text-[13px] text-green flex items-center gap-1.5"><Check size={14} /> Co-marketing campaign created.</p>
        ) : (
          <Button onClick={create} disabled={busy || !split.compliant || !acknowledged}>
            {busy ? 'Creating…' : 'Create Co-Marketing Campaign'}
          </Button>
        )}
        {!acknowledged && split.compliant && <p className="text-[11px] text-[var(--c-label2)]">Acknowledge the RESPA disclosure to activate the campaign.</p>}
      </div>
    </div>
  );
}
