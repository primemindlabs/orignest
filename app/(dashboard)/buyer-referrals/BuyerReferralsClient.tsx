'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, Gift, X } from 'lucide-react';

export interface Referral {
  id: string;
  referral_code: string;
  referred_name: string | null;
  referred_email: string | null;
  referred_phone: string | null;
  status: 'invited' | 'contacted' | 'application' | 'closed' | 'declined';
  reward_amount: number;
  reward_status: 'pending' | 'earned' | 'paid' | 'void';
  created_at: string;
  referrer_name: string | null;
}
export interface ReferrerOption { id: string; name: string }

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const STATUS_FLOW: Referral['status'][] = ['invited', 'contacted', 'application', 'closed', 'declined'];
const STATUS_STYLE: Record<Referral['status'], string> = {
  invited: 'bg-black/[0.05] text-label-2',
  contacted: 'bg-gold-50 text-gold-700',
  application: 'bg-gold-100 text-gold-800',
  closed: 'bg-success/10 text-success',
  declined: 'bg-danger/10 text-danger',
};

export default function BuyerReferralsClient({ referrals, referrers }: { referrals: Referral[]; referrers: ReferrerOption[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const totalEarned = referrals.filter((r) => r.reward_status === 'earned' || r.reward_status === 'paid').reduce((s, r) => s + r.reward_amount, 0);
  const converted = referrals.filter((r) => r.status === 'closed').length;

  async function updateStatus(id: string, status: Referral['status']) {
    setBusy(id);
    try {
      const res = await fetch(`/api/buyer-referrals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(status === 'closed' ? { reward_status: 'earned' } : {}) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Update failed');
      toast.success('Referral updated');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-label tracking-tight">Buyer Referrals</h1>
          <p className="text-[13px] text-label-2 mt-0.5">Track borrower-driven referrals and reward payouts</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2">
          <UserPlus className="w-4 h-4" /> Log referral
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          ['Total referrals', String(referrals.length)],
          ['Converted', String(converted)],
          ['Rewards earned', usd(totalEarned)],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface rounded-2xl border border-border p-5 card-shadow">
            <div className="flex items-center gap-2 text-label-2 text-[12px] font-medium mb-2"><Gift className="w-4 h-4 text-gold-600" strokeWidth={1.75} /> {label}</div>
            <div className="font-mono text-[26px] font-semibold text-label tracking-tight">{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface rounded-2xl border border-border card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/[0.02] border-b border-black/[0.05]">
                {['Referred', 'From', 'Code', 'Reward', 'Status', 'Advance'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {referrals.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-label-3">No referrals yet. Log one when a borrower sends a friend your way.</td></tr>
              ) : (
                referrals.map((r) => {
                  const idx = STATUS_FLOW.indexOf(r.status);
                  const next = idx >= 0 && idx < 3 ? STATUS_FLOW[idx + 1] : null;
                  return (
                    <tr key={r.id} className="hover:bg-black/[0.01] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-label text-[13px]">{r.referred_name ?? '—'}</p>
                        <p className="text-[11px] text-label-3">{r.referred_email ?? r.referred_phone ?? ''}</p>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-label-2">{r.referrer_name ?? '—'}</td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-label-2">{r.referral_code}</td>
                      <td className="px-5 py-3.5 font-mono text-[13px] text-label">{r.reward_amount > 0 ? `${usd(r.reward_amount)} · ${r.reward_status}` : '—'}</td>
                      <td className="px-5 py-3.5"><span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${STATUS_STYLE[r.status]}`}>{r.status}</span></td>
                      <td className="px-5 py-3.5">
                        {next ? (
                          <button onClick={() => updateStatus(r.id, next)} disabled={busy === r.id} className="text-[12px] font-medium text-gold-700 hover:text-gold-600 disabled:opacity-50 capitalize">→ {next}</button>
                        ) : <span className="text-[11px] text-label-3">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <ReferralForm referrers={referrers} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); router.refresh(); }} />}
    </div>
  );
}

function ReferralForm({ referrers, onClose, onSaved }: { referrers: ReferrerOption[]; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ referrer_lead_id: '', referred_name: '', referred_email: '', referred_phone: '', reward_amount: '' });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const inputCls = 'w-full text-[13px] rounded-lg border border-border px-3 py-2 bg-surface text-label focus:outline-none';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.referred_name && !form.referred_email && !form.referred_phone) return toast.error('Add a name, email, or phone');
    setSaving(true);
    try {
      const res = await fetch('/api/buyer-referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrer_lead_id: form.referrer_lead_id || null,
          referrer_name: referrers.find((r) => r.id === form.referrer_lead_id)?.name,
          referred_name: form.referred_name || null,
          referred_email: form.referred_email || null,
          referred_phone: form.referred_phone || null,
          reward_amount: form.reward_amount ? Number(form.reward_amount) : 0,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed');
      toast.success('Referral logged');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 card-shadow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[17px] font-semibold text-label">Log a referral</h2>
          <button onClick={onClose} className="text-label-3 hover:text-label"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <select className={inputCls} value={form.referrer_lead_id} onChange={(e) => set('referrer_lead_id', e.target.value)}>
            <option value="">Referred by (closed borrower, optional)</option>
            {referrers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input className={inputCls} placeholder="Referred person's name" value={form.referred_name} onChange={(e) => set('referred_name', e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} type="email" placeholder="Email" value={form.referred_email} onChange={(e) => set('referred_email', e.target.value)} />
            <input className={inputCls} placeholder="Phone" value={form.referred_phone} onChange={(e) => set('referred_phone', e.target.value)} />
          </div>
          <input className={inputCls} type="number" placeholder="Reward amount $ (optional)" value={form.reward_amount} onChange={(e) => set('reward_amount', e.target.value)} />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-[13px] font-medium text-label-2 px-4 py-2">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-[13px] font-semibold px-4 py-2 disabled:opacity-50">{saving ? 'Saving…' : 'Log referral'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
