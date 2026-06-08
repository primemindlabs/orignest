'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TrendingUp, Target, FileSpreadsheet, Plus, ShieldCheck, X } from 'lucide-react';

export interface CompPlanRow {
  id: string;
  name: string;
  basis: 'bps' | 'flat';
  comp_bps: number | null;
  comp_flat: number | null;
  min_loan_amount: number;
  max_loan_amount: number | null;
  max_comp_amount: number | null;
  effective_date: string;
  is_active: boolean;
  lo_name: string | null;
}

interface Projection {
  expectedComp: number;
  potentialComp: number;
  loanCount: number;
  byStage: Record<string, { count: number; expectedComp: number; potentialComp: number }>;
}

interface Props {
  projection: Projection;
  plans: CompPlanRow[];
  profiles: { id: string; full_name: string }[];
  isAdmin: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New Inquiry',
  pre_qual: 'Pre-Qual',
  application: 'Application',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Cond. Approval',
  clear_to_close: 'Clear to Close',
};

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const currentYear = new Date().getFullYear();

export default function CommissionEnginePanel({ projection, plans, profiles, isAdmin }: Props) {
  const router = useRouter();
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [year, setYear] = useState(currentYear);

  const stageRows = Object.entries(projection.byStage).sort(
    (a, b) => b[1].expectedComp - a[1].expectedComp,
  );

  function downloadExport(form: '1099' | 'w2') {
    window.location.href = `/api/commissions/export?form=${form}&year=${year}`;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-label tracking-tight">Commissions</h1>
          <p className="text-[13px] text-label-2 mt-0.5">
            Comp plans, pipeline projections, splits &amp; clawbacks
          </p>
        </div>
      </div>

      {/* Projection summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface rounded-2xl border border-border p-5 card-shadow">
          <div className="flex items-center gap-2 text-label-2 text-[12px] font-medium mb-2">
            <Target className="w-4 h-4 text-gold-600" strokeWidth={1.75} />
            Expected (weighted)
          </div>
          <div className="font-mono text-[28px] font-semibold text-label tracking-tight">
            {usd(projection.expectedComp)}
          </div>
          <div className="text-[11px] text-label-3 mt-1">
            Probability-weighted across {projection.loanCount} open loan{projection.loanCount === 1 ? '' : 's'}
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-5 card-shadow">
          <div className="flex items-center gap-2 text-label-2 text-[12px] font-medium mb-2">
            <TrendingUp className="w-4 h-4 text-gold-600" strokeWidth={1.75} />
            Full potential
          </div>
          <div className="font-mono text-[28px] font-semibold text-label tracking-tight">
            {usd(projection.potentialComp)}
          </div>
          <div className="text-[11px] text-label-3 mt-1">If every open loan closes</div>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-5 card-shadow">
          <div className="flex items-center gap-2 text-label-2 text-[12px] font-medium mb-2">
            <ShieldCheck className="w-4 h-4 text-gold-600" strokeWidth={1.75} />
            Active comp plans
          </div>
          <div className="font-mono text-[28px] font-semibold text-label tracking-tight">
            {plans.filter((p) => p.is_active).length}
          </div>
          <div className="text-[11px] text-label-3 mt-1">Reg Z 1026.36 — loan-amount basis only</div>
        </div>
      </div>

      {/* Projection by stage */}
      {stageRows.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border p-5 card-shadow">
          <h2 className="text-[15px] font-semibold text-label mb-3">Projected comp by stage</h2>
          <div className="space-y-2">
            {stageRows.map(([stage, v]) => (
              <div key={stage} className="flex items-center justify-between text-[13px]">
                <span className="text-label-2">
                  {STAGE_LABELS[stage] ?? stage}
                  <span className="text-label-3 ml-1.5">· {v.count}</span>
                </span>
                <span className="font-mono text-label">
                  {usd(v.expectedComp)}
                  <span className="text-label-3 ml-2">/ {usd(v.potentialComp)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comp plans + export */}
      <div className="bg-surface rounded-2xl border border-border p-5 card-shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-label">Compensation plans</h2>
          <div className="flex items-center gap-2">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="text-[12px] rounded-lg border border-border px-2 py-1.5 bg-surface text-label"
            >
              {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {isAdmin && (
              <>
                <button
                  onClick={() => downloadExport('1099')}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-label-2 hover:text-label border border-border rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> 1099
                </button>
                <button
                  onClick={() => downloadExport('w2')}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-label-2 hover:text-label border border-border rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> W-2
                </button>
                <button
                  onClick={() => setShowPlanForm(true)}
                  className="btn-primary flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> New plan
                </button>
              </>
            )}
          </div>
        </div>

        {plans.length === 0 ? (
          <p className="text-[13px] text-label-3 py-4 text-center">
            No comp plans yet.{isAdmin ? ' Create one to drive projections and payouts.' : ''}
          </p>
        ) : (
          <div className="space-y-1.5">
            {plans.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-fill transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-label truncate">{p.name}</span>
                    {!p.is_active && (
                      <span className="text-[10px] text-label-3 border border-border rounded px-1.5 py-0.5">inactive</span>
                    )}
                  </div>
                  <div className="text-[11px] text-label-3">
                    {p.lo_name ? p.lo_name : 'Org default'} · loans{' '}
                    {usd(p.min_loan_amount)}
                    {p.max_loan_amount ? `–${usd(p.max_loan_amount)}` : '+'}
                  </div>
                </div>
                <div className="font-mono text-[13px] text-label whitespace-nowrap">
                  {p.basis === 'bps' ? `${p.comp_bps} bps` : usd(p.comp_flat ?? 0)}
                  {p.max_comp_amount ? (
                    <span className="text-label-3 ml-1.5">cap {usd(p.max_comp_amount)}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPlanForm && (
        <NewPlanModal profiles={profiles} onClose={() => setShowPlanForm(false)} onSaved={() => { setShowPlanForm(false); router.refresh(); }} />
      )}
    </div>
  );
}

function NewPlanModal({
  profiles,
  onClose,
  onSaved,
}: {
  profiles: { id: string; full_name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    lo_id: '',
    basis: 'bps' as 'bps' | 'flat',
    comp_bps: '',
    comp_flat: '',
    min_loan_amount: '0',
    max_loan_amount: '',
    max_comp_amount: '',
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Plan name is required');
    if (form.basis === 'bps' && !form.comp_bps) return toast.error('Enter basis points');
    if (form.basis === 'flat' && !form.comp_flat) return toast.error('Enter a flat amount');

    setSaving(true);
    try {
      const res = await fetch('/api/commissions/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          lo_id: form.lo_id || null,
          basis: form.basis,
          comp_bps: form.basis === 'bps' ? Number(form.comp_bps) : undefined,
          comp_flat: form.basis === 'flat' ? Number(form.comp_flat) : undefined,
          min_loan_amount: Number(form.min_loan_amount) || 0,
          max_loan_amount: form.max_loan_amount ? Number(form.max_loan_amount) : null,
          max_comp_amount: form.max_comp_amount ? Number(form.max_comp_amount) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to create plan');
      toast.success('Comp plan created');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create plan');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full text-[13px] rounded-lg border border-border px-3 py-2 bg-surface text-label focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 card-shadow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[17px] font-semibold text-label">New comp plan</h2>
          <button onClick={onClose} className="text-label-3 hover:text-label"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-[11px] text-label-3 mb-4 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-gold-600" /> Reg Z 1026.36 — comp is keyed on loan amount only
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input className={inputCls} placeholder="Plan name (e.g. Senior LO — Tier 1)" value={form.name} onChange={(e) => set('name', e.target.value)} />

          <select className={inputCls} value={form.lo_id} onChange={(e) => set('lo_id', e.target.value)}>
            <option value="">Org default (all LOs)</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <select className={inputCls} value={form.basis} onChange={(e) => set('basis', e.target.value)}>
              <option value="bps">Basis points of loan amount</option>
              <option value="flat">Flat $ per loan</option>
            </select>
            {form.basis === 'bps' ? (
              <input className={inputCls} type="number" step="0.01" placeholder="bps" value={form.comp_bps} onChange={(e) => set('comp_bps', e.target.value)} />
            ) : (
              <input className={inputCls} type="number" step="0.01" placeholder="$ flat" value={form.comp_flat} onChange={(e) => set('comp_flat', e.target.value)} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} type="number" placeholder="Min loan $" value={form.min_loan_amount} onChange={(e) => set('min_loan_amount', e.target.value)} />
            <input className={inputCls} type="number" placeholder="Max loan $ (optional)" value={form.max_loan_amount} onChange={(e) => set('max_loan_amount', e.target.value)} />
          </div>
          <input className={inputCls} type="number" placeholder="Per-loan comp cap $ (optional)" value={form.max_comp_amount} onChange={(e) => set('max_comp_amount', e.target.value)} />

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-[13px] font-medium text-label-2 px-4 py-2">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-[13px] font-semibold px-4 py-2 disabled:opacity-50">
              {saving ? 'Saving…' : 'Create plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
