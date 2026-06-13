'use client';

// Phase 121 — Referral Partner Network dashboard: table w/ heat + copy-link + send-update,
// add-partner form, and a per-partner activity drawer.
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus, IconX, IconCopy, IconCheck, IconScale, IconCalculator, IconBriefcase, IconShield, IconHome, IconUser, IconSend } from '@tabler/icons-react';

interface Partner {
  id: string; type: string; first_name: string; last_name: string; company_name: string; email: string; phone: string | null;
  referral_code: string; referral_count: number; closed_count: number; total_volume: number; last_outreach_at: string | null;
  referrals_90d: number; heat_band: string; heat_score: number;
}

const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  attorney: { label: 'Attorney', icon: <IconScale size={15} /> },
  cpa: { label: 'CPA', icon: <IconCalculator size={15} /> },
  financial_advisor: { label: 'Financial Advisor', icon: <IconBriefcase size={15} /> },
  insurance_agent: { label: 'Insurance', icon: <IconShield size={15} /> },
  realtor: { label: 'Realtor', icon: <IconHome size={15} /> },
  builder: { label: 'Builder', icon: <IconHome size={15} /> },
  other: { label: 'Other', icon: <IconUser size={15} /> },
};
const HEAT: Record<string, { label: string; cls: string }> = {
  hot: { label: 'Hot', cls: 'bg-red-50 text-red-500' },
  warm: { label: 'Warm', cls: 'bg-amber-50 text-amber-600' },
  cooling: { label: 'Cooling', cls: 'bg-blue-50 text-blue-500' },
  cold: { label: 'Cold', cls: 'bg-gray-100 text-gray-400' },
};
const money = (n: number) => (n > 0 ? `$${(n / 1_000_000).toFixed(1)}M` : '—');

export function ReferralPartnerDashboard({ initialPartners, origin }: { initialPartners: Partner[]; origin: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [updateFor, setUpdateFor] = useState<Partner | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const open = initialPartners.find((p) => p.id === openId) ?? null;

  async function copyLink(p: Partner) {
    try { await navigator.clipboard.writeText(`${origin}/refer/${p.referral_code}`); setCopied(p.id); setTimeout(() => setCopied(null), 1500); } catch { /* noop */ }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#C9A95C] px-4 py-2 text-sm font-semibold text-white hover:brightness-95"><IconPlus size={16} /> Add partner</button>
      </div>

      {initialPartners.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">No partners yet</p>
          <p className="text-xs text-gray-400 mb-4">Add attorneys, CPAs, advisors and insurance agents to track referrals and share your link.</p>
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#C9A95C] px-4 py-2 text-sm font-semibold text-white hover:brightness-95"><IconPlus size={14} /> Add your first partner</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-400">
                <th className="text-left px-5 py-3 font-semibold">Partner</th>
                <th className="text-left px-3 py-3 font-semibold">Type</th>
                <th className="text-center px-3 py-3 font-semibold">Heat</th>
                <th className="text-right px-3 py-3 font-semibold">Refs (90d)</th>
                <th className="text-right px-3 py-3 font-semibold">Funded</th>
                <th className="text-right px-3 py-3 font-semibold">Volume</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {initialPartners.map((p) => {
                const t = TYPE_META[p.type] ?? TYPE_META.other;
                const heat = HEAT[p.heat_band] ?? HEAT.cold;
                return (
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3 cursor-pointer" onClick={() => setOpenId(p.id)}>
                      <p className="text-sm font-medium text-gray-900">{p.first_name} {p.last_name}</p>
                      <p className="text-xs text-gray-400">{p.company_name}</p>
                    </td>
                    <td className="px-3 py-3"><span className="inline-flex items-center gap-1 text-xs text-gray-600"><span className="text-[#C9A95C]">{t.icon}</span>{t.label}</span></td>
                    <td className="px-3 py-3 text-center"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${heat.cls}`}>{heat.label}</span></td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-gray-900">{p.referrals_90d}</td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-green-600">{p.closed_count}</td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-gray-900">{money(p.total_volume)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => copyLink(p)} title="Copy referral link" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50">{copied === p.id ? <IconCheck size={13} /> : <IconCopy size={13} />}{copied === p.id ? 'Copied' : 'Link'}</button>
                        <button onClick={() => setUpdateFor(p)} title="Send milestone update" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"><IconSend size={13} /> Update</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding && <AddPartnerModal onClose={() => setAdding(false)} onAdded={() => { setAdding(false); router.refresh(); }} />}
      {updateFor && <SendUpdateModal partner={updateFor} onClose={() => setUpdateFor(null)} onSent={() => { setUpdateFor(null); router.refresh(); }} />}
      {open && <ActivityDrawer partner={open} origin={origin} onClose={() => setOpenId(null)} />}
    </div>
  );
}

const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30';

function AddPartnerModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [f, setF] = useState({ type: 'attorney', first_name: '', last_name: '', company_name: '', email: '', phone: '', specialty: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit() {
    setErr(null);
    if (!f.first_name.trim() || !f.last_name.trim() || !f.email.trim()) { setErr('First name, last name and email are required.'); return; }
    setBusy(true);
    const res = await fetch('/api/referral-partners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    setBusy(false);
    if (res.ok) { onAdded(); return; }
    const j = await res.json().catch(() => ({}));
    setErr(j.error ?? 'Could not add partner.');
  }

  return (
    <Overlay onClose={onClose}>
      <Header title="Add referral partner" onClose={onClose} />
      <div className="space-y-3">
        <label className="block"><span className="text-xs text-gray-400">Type</span>
          <select value={f.type} onChange={set('type')} className={`${inputCls} mt-1`}>
            <option value="attorney">Attorney</option>
            <option value="cpa">CPA</option>
            <option value="financial_advisor">Financial Advisor</option>
            <option value="insurance_agent">Insurance Agent</option>
            <option value="realtor">Realtor</option>
            <option value="builder">Builder</option>
            <option value="other">Other</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <input value={f.first_name} onChange={set('first_name')} placeholder="First name" className={inputCls} />
          <input value={f.last_name} onChange={set('last_name')} placeholder="Last name" className={inputCls} />
        </div>
        <input value={f.company_name} onChange={set('company_name')} placeholder="Company" className={inputCls} />
        <input value={f.email} onChange={set('email')} type="email" placeholder="Email" className={inputCls} />
        <input value={f.phone} onChange={set('phone')} placeholder="Phone (optional)" className={inputCls} />
        <input value={f.specialty} onChange={set('specialty')} placeholder="Specialty (optional)" className={inputCls} />
        {err && <p className="text-xs text-red-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={busy} className="rounded-xl bg-[#C9A95C] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">{busy ? 'Adding…' : 'Add partner'}</button>
        </div>
      </div>
    </Overlay>
  );
}

const UPDATE_TYPES = [
  { v: 'referral_received', l: 'Thank for referral' },
  { v: 'pre_approval', l: 'Pre-approved' },
  { v: 'under_contract', l: 'Under contract' },
  { v: 'funded', l: 'Funded / closed' },
];

function SendUpdateModal({ partner, onClose, onSent }: { partner: Partner; onClose: () => void; onSent: () => void }) {
  const [type, setType] = useState('funded');
  const [borrower, setBorrower] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/referral-partners/${partner.id}/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ update_type: type, borrower_name: borrower }) });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (res.ok) { setMsg(j.sent ? 'Sent.' : 'Logged (email delivery not configured).'); setTimeout(onSent, 900); }
    else setMsg(j.error ?? 'Could not send.');
  }

  return (
    <Overlay onClose={onClose}>
      <Header title={`Update ${partner.first_name} ${partner.last_name}`} onClose={onClose} />
      <div className="space-y-3">
        <label className="block"><span className="text-xs text-gray-400">Milestone</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className={`${inputCls} mt-1`}>
            {UPDATE_TYPES.map((u) => <option key={u.v} value={u.v}>{u.l}</option>)}
          </select>
        </label>
        <label className="block"><span className="text-xs text-gray-400">Client name (optional)</span>
          <input value={borrower} onChange={(e) => setBorrower(e.target.value)} placeholder="e.g. John Smith" className={`${inputCls} mt-1`} />
        </label>
        <p className="text-[11px] text-gray-400">A professional, NMLS-compliant note is sent to {partner.email}. No rates or terms are included.</p>
        {msg && <p className="text-xs text-gray-600">{msg}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={busy} className="rounded-xl bg-[#C9A95C] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">{busy ? 'Sending…' : 'Send update'}</button>
        </div>
      </div>
    </Overlay>
  );
}

interface RefRow { id: string; borrower_first_name: string; borrower_last_name: string; status: string; created_at: string; buying_timeline: string | null }
function ActivityDrawer({ partner, origin, onClose }: { partner: Partner; origin: string; onClose: () => void }) {
  const [refs, setRefs] = useState<RefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const res = await fetch(`/api/referral-partners/${partner.id}/activity`);
    if (res.ok) { const j = await res.json(); setRefs(j.referrals ?? []); }
    setLoading(false);
  }, [partner.id]);
  useEffect(() => { load(); }, [load]);

  return (
    <Overlay onClose={onClose} wide>
      <Header title={`${partner.first_name} ${partner.last_name}`} onClose={onClose} />
      <p className="text-xs text-gray-400 -mt-2 mb-3">{partner.company_name}</p>
      <div className="rounded-xl bg-gray-50 p-3 mb-4">
        <p className="text-xs text-gray-400 mb-1">Referral link</p>
        <p className="text-xs text-gray-700 break-all">{origin}/refer/{partner.referral_code}</p>
      </div>
      <p className="text-xs font-semibold text-gray-500 mb-2">Referrals</p>
      {loading ? <p className="text-xs text-gray-300">Loading…</p> : refs.length === 0 ? <p className="text-xs text-gray-300">No referrals yet.</p> : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {refs.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm border border-gray-100 rounded-xl px-3 py-2">
              <div><p className="text-gray-900 font-medium">{r.borrower_first_name} {r.borrower_last_name}</p>{r.buying_timeline && <p className="text-xs text-gray-400">{r.buying_timeline}</p>}</div>
              <span className="text-xs text-gray-500 capitalize">{r.status.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      )}
    </Overlay>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return <div className="flex items-center justify-between mb-4"><h2 className="text-base font-semibold text-gray-900">{title}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><IconX size={18} /></button></div>;
}
function Overlay({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 overflow-y-auto" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-lg' : 'max-w-md'} my-8 p-5`} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
