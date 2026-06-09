'use client';

/** Phase 61.1 — referral reward queue (RESPA: rewards created only after the
 * referred loan closes). Approve → Issue. */
import { useState, useEffect, useCallback } from 'react';
import { Gift, Check } from 'lucide-react';

interface Reward { id: string; reward_type: string; reward_amount: number; status: string; referred_name: string | null; created_at: string }
const NEXT: Record<string, { label: string; status: string } | null> = { pending: { label: 'Approve', status: 'approved' }, approved: { label: 'Issue', status: 'issued' }, issued: null, redeemed: null, cancelled: null };
const usd = (n: number) => Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function RewardsPanel() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const load = useCallback(async () => { const r = await fetch('/api/referrals/rewards'); if (r.ok) setRewards((await r.json()).rewards ?? []); }, []);
  useEffect(() => { load(); }, [load]);

  async function act(id: string, status: string) { await fetch('/api/referrals/rewards', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) }); load(); }

  const open = rewards.filter((r) => r.status === 'pending' || r.status === 'approved');
  if (rewards.length === 0) return null;

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 mb-4">
      <div className="flex items-center gap-2 mb-2"><Gift size={15} className="text-[var(--c-gold-deep)]" /><p className="text-[13px] font-semibold text-[var(--c-text)]">Referral rewards{open.length > 0 ? ` · ${open.length} to action` : ''}</p></div>
      <div className="space-y-1.5">
        {rewards.slice(0, 8).map((r) => { const next = NEXT[r.status]; return (
          <div key={r.id} className="flex items-center justify-between text-[12px]">
            <span className="text-[var(--c-text)]">{r.referred_name ?? 'Referral'} · <span className="text-[var(--c-label2)]">{usd(r.reward_amount)} {r.reward_type.replace(/_/g, ' ')}</span></span>
            {next ? <button onClick={() => act(r.id, next.status)} className="inline-flex items-center gap-1 h-6 px-2 rounded-btn text-[11px] font-medium bg-[var(--c-gold-light)] text-[var(--c-gold-deep)] hover:opacity-90">{next.label}</button> : <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#27AE60]"><Check size={11} /> {r.status}</span>}
          </div>
        ); })}
      </div>
      <p className="text-[10px] text-[var(--c-label2)] mt-2 italic">Rewards are issued only after the referred loan closes (RESPA Section 8 — de-minimis, not tied to settlement-service referrals).</p>
    </div>
  );
}
