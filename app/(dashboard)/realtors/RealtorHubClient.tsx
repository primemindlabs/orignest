'use client';

/** Phase 40.4/40.7 — Realtor Intelligence hub: stats + tiered partners + add + log touch. */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Plus, Phone, Mail, Gift, StickyNote, Building2 } from 'lucide-react';
import { TIER_LABELS, TIER_COLORS, type PartnershipTier } from '@/lib/realtors/partnershipScore';

interface Realtor {
  id: string; first_name: string; last_name: string; brokerage_name: string | null; primary_city: string | null;
  transactions_12m: number; volume_12m: number; buyer_side_pct: number | null;
  deals_referred_12m: number; partnership_score: number; partnership_tier: PartnershipTier;
}

type Tab = 'partners' | 'prospects' | 'dormant';

export function RealtorHubClient() {
  const [realtors, setRealtors] = useState<Realtor[]>([]);
  const [tab, setTab] = useState<Tab>('partners');
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ first_name: '', last_name: '', brokerage_name: '', primary_city: '', transactions_12m: '', buyer_side_pct: '', deals_referred_12m: '' });
  const [saving, setSaving] = useState(false);
  const [touchBusy, setTouchBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/realtors');
    if (res.ok) setRealtors((await res.json()).realtors ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const partners = realtors.filter((r) => ['active_partner', 'top_partner', 'developing'].includes(r.partnership_tier));
  const prospects = realtors.filter((r) => r.partnership_tier === 'prospect');
  const dormant = realtors.filter((r) => r.partnership_tier === 'dormant');
  const shown = tab === 'partners' ? partners : tab === 'prospects' ? prospects : dormant;
  const referrals = realtors.reduce((s, r) => s + (r.deals_referred_12m ?? 0), 0);

  async function add() {
    if (!form.first_name || !form.last_name) return;
    setSaving(true);
    try {
      const res = await fetch('/api/realtors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, transactions_12m: Number(form.transactions_12m) || 0, buyer_side_pct: form.buyer_side_pct ? Number(form.buyer_side_pct) : undefined, deals_referred_12m: Number(form.deals_referred_12m) || 0 }) });
      if (res.ok) { setForm({ first_name: '', last_name: '', brokerage_name: '', primary_city: '', transactions_12m: '', buyer_side_pct: '', deals_referred_12m: '' }); setAdding(false); await load(); }
    } finally { setSaving(false); }
  }

  async function touch(id: string, touch_type: string) {
    setTouchBusy(id);
    try {
      const res = await fetch(`/api/realtors/${id}/touch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ touch_type }) });
      if (res.ok) await load();
    } finally { setTouchBusy(null); }
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[['Active partners', partners.length], ['Referrals (12m)', referrals], ['Prospects', prospects.length], ['Dormant', dormant.length]].map(([l, v]) => (
          <div key={String(l)} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] px-4 py-3.5"><p className="text-[11px] uppercase tracking-wide text-[var(--c-label2)] mb-1">{l}</p><p className="text-[20px] font-bold font-mono tabular-nums text-[var(--c-text)]">{v}</p></div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {(['partners', 'prospects', 'dormant'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-[12px] px-3 py-1.5 rounded-full border capitalize ${tab === t ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]' : 'border-[var(--c-border)] text-[var(--c-label2)]'}`}>{t === 'partners' ? 'My Partners' : t}</button>
          ))}
        </div>
        <Button onClick={() => setAdding((a) => !a)} variant="secondary"><Plus size={13} /> Add realtor</Button>
      </div>

      {adding && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
            <Input label="Last name" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
            <Input label="Brokerage" value={form.brokerage_name} onChange={(e) => setForm((f) => ({ ...f, brokerage_name: e.target.value }))} />
            <Input label="Primary city" value={form.primary_city} onChange={(e) => setForm((f) => ({ ...f, primary_city: e.target.value }))} />
            <Input label="Transactions (12m)" value={form.transactions_12m} onChange={(e) => setForm((f) => ({ ...f, transactions_12m: e.target.value }))} placeholder="24" />
            <Input label="Buyer side %" value={form.buyer_side_pct} onChange={(e) => setForm((f) => ({ ...f, buyer_side_pct: e.target.value }))} placeholder="65" />
            <Input label="Deals referred to me (12m)" value={form.deals_referred_12m} onChange={(e) => setForm((f) => ({ ...f, deals_referred_12m: e.target.value }))} placeholder="0" />
          </div>
          <Button onClick={add} disabled={saving || !form.first_name || !form.last_name}>{saving ? 'Saving…' : 'Add to network'}</Button>
        </div>
      )}

      {loading ? <p className="text-[13px] text-[var(--c-label2)]">Loading…</p> : shown.length === 0 ? (
        <p className="text-[13px] text-[var(--c-label2)] bg-[var(--c-fill)] rounded-[12px] px-4 py-3">No realtors in this tab yet. Add your top referral partners to start scoring them.</p>
      ) : (
        <div className="space-y-2.5">
          {shown.map((r) => (
            <div key={r.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 flex items-center gap-4">
              <div className="text-center flex-shrink-0 w-12">
                <p className="text-[20px] font-bold font-mono tabular-nums" style={{ color: TIER_COLORS[r.partnership_tier] }}>{r.partnership_score}</p>
                <p className="text-[9px] uppercase tracking-wide text-[var(--c-label2)]">score</p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-semibold text-[var(--c-text)]">{r.first_name} {r.last_name}</p>
                  <span className="text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: TIER_COLORS[r.partnership_tier] }}>{TIER_LABELS[r.partnership_tier]}</span>
                </div>
                <p className="text-[11px] text-[var(--c-label2)] flex items-center gap-1.5"><Building2 size={11} /> {r.brokerage_name ?? '—'}{r.primary_city ? ` · ${r.primary_city}` : ''}</p>
                <p className="text-[11px] text-[var(--c-label2)] font-mono mt-0.5">{r.transactions_12m} txns · {r.buyer_side_pct != null ? `${r.buyer_side_pct}% buyer` : 'split n/a'} · {r.deals_referred_12m} referred to me</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {[['call', Phone], ['email', Mail], ['note', StickyNote], ['referral_received', Gift]].map(([t, Icon]) => {
                  const I = Icon as typeof Phone;
                  return <button key={t as string} onClick={() => touch(r.id, t as string)} disabled={touchBusy === r.id} title={t === 'referral_received' ? 'Log a referral received' : `Log ${t}`} className="w-7 h-7 rounded-[8px] border border-[var(--c-border)] flex items-center justify-center text-[var(--c-label2)] hover:bg-[var(--c-fill)] hover:text-[var(--c-text)] disabled:opacity-50"><I size={13} /></button>;
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
