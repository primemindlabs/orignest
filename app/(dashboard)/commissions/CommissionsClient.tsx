'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign, Plus, Filter, Search, ChevronDown,
  CheckCircle2, Clock, AlertCircle, X, Loader2,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import { cn, formatCurrency, timeAgo } from '@/lib/utils';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────

export interface Commission {
  id: string;
  lead_id: string;
  lo_id: string;
  loan_amount: number;
  close_date: string;
  loan_type: string;
  compensation_type: 'lender_paid' | 'borrower_paid';
  compensation_bps: number | null;
  compensation_amount: number;
  referral_fee_amount: number;
  net_revenue: number | null;
  status: 'pending' | 'paid' | 'clawed_back';
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  // joined
  lead_name?: string;
  lo_name?: string;
}

export interface Lead {
  id: string;
  full_name: string;
  loan_amount: number | null;
  loan_type: string | null;
  stage: string;
}

export interface Profile {
  id: string;
  full_name: string;
}

interface Props {
  commissions: Commission[];
  leads: Lead[];
  profiles: Profile[];
}

// ── Status config ──────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-warning/[0.08] text-[#FF9500]', icon: Clock },
  paid: { label: 'Paid', color: 'bg-success/[0.08] text-success', icon: CheckCircle2 },
  clawed_back: { label: 'Clawed Back', color: 'bg-danger/[0.08] text-danger', icon: AlertCircle },
};

const LOAN_TYPES = [
  'Conventional', 'FHA', 'VA', 'USDA', 'Jumbo', 'Non-QM',
  'DSCR', 'Bank Statement', 'Bridge', 'Commercial', 'SBA', 'Construction',
];

// ── AddCommissionModal ─────────────────────────────────────────────────
function AddCommissionModal({
  leads,
  profiles,
  onClose,
}: {
  leads: Lead[];
  profiles: Profile[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    lead_id: '',
    lo_id: '',
    loan_amount: '',
    close_date: new Date().toISOString().slice(0, 10),
    loan_type: 'Conventional',
    compensation_type: 'lender_paid',
    compensation_bps: '',
    compensation_amount: '',
    referral_fee_amount: '0',
    status: 'pending',
    payment_date: '',
    notes: '',
  });

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((prev) => {
      const next = { ...prev, [k]: v };
      // Auto-compute compensation_amount from bps + loan_amount
      if ((k === 'compensation_bps' || k === 'loan_amount') && next.compensation_bps && next.loan_amount) {
        const computed = (Number(next.loan_amount) * Number(next.compensation_bps)) / 10000;
        next.compensation_amount = computed.toFixed(2);
      }
      // Auto-fill loan_amount from selected lead
      if (k === 'lead_id' && v) {
        const lead = leads.find((l) => l.id === v);
        if (lead?.loan_amount) next.loan_amount = lead.loan_amount.toString();
        if (lead?.loan_type) next.loan_type = lead.loan_type;
      }
      return next;
    });
  }

  // Compute net_revenue = comp_amount - referral_fee
  const netRevenue =
    form.compensation_amount && form.referral_fee_amount
      ? Number(form.compensation_amount) - Number(form.referral_fee_amount)
      : Number(form.compensation_amount) || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.lo_id) { toast.error('Select a loan officer'); return; }
    if (!form.loan_amount || Number(form.loan_amount) <= 0) { toast.error('Loan amount required'); return; }
    if (!form.compensation_amount || Number(form.compensation_amount) <= 0) { toast.error('Compensation amount required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: form.lead_id || null,
          lo_id: form.lo_id,
          loan_amount: Number(form.loan_amount),
          close_date: form.close_date,
          loan_type: form.loan_type,
          compensation_type: form.compensation_type,
          compensation_bps: form.compensation_bps ? Number(form.compensation_bps) : null,
          compensation_amount: Number(form.compensation_amount),
          referral_fee_amount: Number(form.referral_fee_amount) || 0,
          net_revenue: netRevenue,
          status: form.status,
          payment_date: form.payment_date || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Commission entry added');
      router.refresh();
      onClose();
    } catch {
      toast.error('Failed to save commission entry');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] flex-shrink-0">
          <h2 className="text-[17px] font-semibold text-navy">Add Commission Entry</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/[0.05] transition-colors">
            <X className="w-4 h-4 text-label2" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Link to lead */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Link to Lead (optional)</label>
              <select
                value={form.lead_id}
                onChange={(e) => update('lead_id', e.target.value)}
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30 bg-white"
              >
                <option value="">No lead linked</option>
                {leads.filter((l) => l.stage === 'closed').map((l) => (
                  <option key={l.id} value={l.id}>{l.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Loan Officer *</label>
              <select
                value={form.lo_id}
                onChange={(e) => update('lo_id', e.target.value)}
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30 bg-white"
              >
                <option value="">Select LO...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Loan Amount *</label>
              <input
                type="number"
                value={form.loan_amount}
                onChange={(e) => update('loan_amount', e.target.value)}
                placeholder="450000"
                min={1}
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Close Date *</label>
              <input
                type="date"
                value={form.close_date}
                onChange={(e) => update('close_date', e.target.value)}
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Loan Type</label>
              <select
                value={form.loan_type}
                onChange={(e) => update('loan_type', e.target.value)}
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30 bg-white"
              >
                {LOAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Compensation Type</label>
              <select
                value={form.compensation_type}
                onChange={(e) => update('compensation_type', e.target.value)}
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30 bg-white"
              >
                <option value="lender_paid">Lender Paid</option>
                <option value="borrower_paid">Borrower Paid</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">BPS (optional)</label>
              <input
                type="number"
                value={form.compensation_bps}
                onChange={(e) => update('compensation_bps', e.target.value)}
                placeholder="100"
                step="0.01"
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Comp Amount ($) *</label>
              <input
                type="number"
                value={form.compensation_amount}
                onChange={(e) => update('compensation_amount', e.target.value)}
                placeholder="4500"
                step="0.01"
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Referral Fee ($)</label>
              <input
                type="number"
                value={form.referral_fee_amount}
                onChange={(e) => update('referral_fee_amount', e.target.value)}
                placeholder="0"
                step="0.01"
                min={0}
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30"
              />
            </div>
          </div>

          {/* Net revenue display */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/[0.02] rounded-xl">
            <span className="text-xs font-semibold text-label2">Calculated Net Revenue</span>
            <span className="text-sm font-semibold text-navy font-mono">{formatCurrency(netRevenue)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30 bg-white"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="clawed_back">Clawed Back</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Payment Date</label>
              <input
                type="date"
                value={form.payment_date}
                onChange={(e) => update('payment_date', e.target.value)}
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-label2 mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Any details about this commission..."
              rows={2}
              className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30 resize-none"
            />
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/[0.06] flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-label2 hover:text-label hover:bg-black/[0.04] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0066D6] disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Saving...' : 'Add Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────
export default function CommissionsClient({ commissions, leads, profiles }: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<'MTD' | 'QTD' | 'YTD'>('MTD');

  const filtered = useMemo(() => {
    return commissions.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(c.lead_name ?? '').toLowerCase().includes(q) &&
          !(c.lo_name ?? '').toLowerCase().includes(q) &&
          !c.loan_type.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [commissions, statusFilter, search]);

  // KPI calculations
  const now = new Date();
  const periodStart = useMemo(() => {
    if (period === 'MTD') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === 'QTD') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    return new Date(now.getFullYear(), 0, 1);
  }, [period]);

  const inPeriod = useMemo(() =>
    commissions.filter((c) => new Date(c.close_date) >= periodStart),
    [commissions, periodStart]
  );

  const totalComp = inPeriod.reduce((s, c) => s + c.compensation_amount, 0);
  const totalNet = inPeriod.reduce((s, c) => s + (c.net_revenue ?? c.compensation_amount), 0);
  const totalPending = commissions.filter((c) => c.status === 'pending').reduce((s, c) => s + (c.net_revenue ?? c.compensation_amount), 0);
  const totalPaid = inPeriod.filter((c) => c.status === 'paid').reduce((s, c) => s + (c.net_revenue ?? c.compensation_amount), 0);

  // Per-LO breakdown
  const loBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; comp: number; units: number }>();
    for (const c of inPeriod) {
      const key = c.lo_id;
      const existing = map.get(key) ?? { name: c.lo_name ?? 'Unknown', comp: 0, units: 0 };
      existing.comp += c.net_revenue ?? c.compensation_amount;
      existing.units += 1;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.comp - a.comp);
  }, [inPeriod]);

  const isSample = commissions.length === 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold text-navy tracking-tight">Commissions</h1>
          <p className="text-sm text-label2 mt-0.5">
            {isSample
              ? 'Track broker compensation and referral fees per closed loan'
              : `${commissions.length} commission entries`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-black/[0.04] rounded-xl p-1">
            {(['MTD', 'QTD', 'YTD'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all',
                  period === p ? 'bg-white text-label shadow-sm' : 'text-label2 hover:text-label'
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0066D6] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-black/[0.06] rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-label2 uppercase tracking-wide mb-2">{period} Gross Comp</p>
          <p className="text-[24px] font-semibold text-navy font-mono">{formatCurrency(isSample ? 0 : totalComp)}</p>
          <p className="text-xs text-label3 mt-1">{inPeriod.length} loans</p>
        </div>
        <div className="bg-white border border-black/[0.06] rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-label2 uppercase tracking-wide mb-2">{period} Net Revenue</p>
          <p className="text-[24px] font-semibold text-navy font-mono">{formatCurrency(isSample ? 0 : totalNet)}</p>
          <p className="text-xs text-label3 mt-1">After referral fees</p>
        </div>
        <div className="bg-white border border-black/[0.06] rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-label2 uppercase tracking-wide mb-2">Pending Payment</p>
          <p className={cn('text-[24px] font-semibold font-mono', totalPending > 0 ? 'text-warning' : 'text-navy')}>
            {formatCurrency(isSample ? 0 : totalPending)}
          </p>
          <p className="text-xs text-label3 mt-1">{commissions.filter((c) => c.status === 'pending').length} entries pending</p>
        </div>
        <div className="bg-white border border-black/[0.06] rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-label2 uppercase tracking-wide mb-2">{period} Paid</p>
          <p className="text-[24px] font-semibold text-success font-mono">{formatCurrency(isSample ? 0 : totalPaid)}</p>
          <p className="text-xs text-label3 mt-1">{inPeriod.filter((c) => c.status === 'paid').length} loans paid</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Commission log — 2/3 */}
        <div className="col-span-2 space-y-3">
          {/* Search + status filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-label3" />
              <input
                type="text"
                placeholder="Search borrower, LO, loan type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-black/[0.08] rounded-xl text-sm placeholder:text-label3 focus:outline-none focus:ring-2 focus:ring-blue/30"
              />
            </div>
            <div className="flex gap-1 bg-black/[0.04] rounded-xl p-1">
              {(['all', 'pending', 'paid', 'clawed_back'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'px-3 py-1.5 rounded-[10px] text-xs font-medium transition-all capitalize',
                    statusFilter === s ? 'bg-white text-label shadow-sm' : 'text-label2 hover:text-label'
                  )}
                >
                  {s === 'all' ? 'All' : s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 && !isSample ? (
            <div className="bg-white border border-black/[0.06] rounded-2xl p-10 text-center shadow-sm">
              <DollarSign className="w-8 h-8 text-label3 mx-auto mb-3" />
              <p className="text-sm font-medium text-label">No commission entries yet</p>
              <p className="text-xs text-label2 mt-1">Add your first closed loan commission to start tracking revenue.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#007AFF] text-white text-sm font-medium mx-auto hover:bg-[#0066D6] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add First Entry
              </button>
            </div>
          ) : (
            <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm overflow-hidden">
              {isSample && (
                <div className="px-5 py-2.5 bg-gold/[0.06] border-b border-gold/[0.15]">
                  <p className="text-xs text-label2">
                    <span className="font-semibold text-label">No entries yet.</span> Add your first commission entry to track broker compensation and referral fees.
                  </p>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-black/[0.02] border-b border-black/[0.04]">
                      <th className="text-left px-5 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Borrower</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Loan Amt</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Close Date</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Type</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Gross Comp</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Referral Fee</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Net Revenue</th>
                      <th className="text-left px-5 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {filtered.map((c) => {
                      const cfg = STATUS_CONFIG[c.status];
                      const Icon = cfg.icon;
                      return (
                        <tr key={c.id} className="hover:bg-black/[0.01] transition-colors">
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-navy text-[13px]">{c.lead_name ?? '—'}</p>
                            <p className="text-[11px] text-label3">{c.lo_name ?? '—'}</p>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-[13px] text-label font-semibold">
                            {formatCurrency(c.loan_amount)}
                          </td>
                          <td className="px-4 py-3.5 text-[12px] text-label2">
                            {new Date(c.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-[11px] font-medium bg-black/[0.04] text-label2 px-2 py-0.5 rounded-md">
                              {c.loan_type}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-[13px] text-label">
                            {formatCurrency(c.compensation_amount)}
                            {c.compensation_bps && (
                              <span className="text-[10px] text-label3 ml-1">({c.compensation_bps}bps)</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-[13px] text-label">
                            {c.referral_fee_amount > 0 ? formatCurrency(c.referral_fee_amount) : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-[13px] font-semibold text-navy">
                            {formatCurrency(c.net_revenue ?? c.compensation_amount)}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold w-fit', cfg.color)}>
                              <Icon className="w-3 h-3" />
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar — per-LO breakdown */}
        <div className="space-y-4">
          <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-navy mb-4">Per-LO Revenue ({period})</h3>
            {loBreakdown.length === 0 ? (
              <div className="text-center py-6">
                <Users className="w-6 h-6 text-label3 mx-auto mb-2" />
                <p className="text-xs text-label2">No data for this period</p>
              </div>
            ) : (
              <div className="space-y-3">
                {loBreakdown.map((lo, i) => (
                  <div key={lo.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-label3 w-4">#{i + 1}</span>
                        <span className="text-xs font-medium text-label truncate max-w-[120px]">{lo.name}</span>
                      </div>
                      <span className="text-xs font-mono font-semibold text-navy">{formatCurrency(lo.comp)}</span>
                    </div>
                    <div className="h-1.5 bg-black/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue rounded-full"
                        style={{ width: `${loBreakdown[0].comp > 0 ? (lo.comp / loBreakdown[0].comp) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-label3 mt-0.5">{lo.units} loan{lo.units !== 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status summary */}
          <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-navy mb-4">Status Summary</h3>
            <div className="space-y-3">
              {(['pending', 'paid', 'clawed_back'] as const).map((s) => {
                const count = commissions.filter((c) => c.status === s).length;
                const total = commissions.filter((c) => c.status === s).reduce((sum, c) => sum + (c.net_revenue ?? c.compensation_amount), 0);
                const cfg = STATUS_CONFIG[s];
                const Icon = cfg.icon;
                return (
                  <div key={s} className={cn('flex items-center justify-between p-3 rounded-xl', cfg.color.split(' ')[0])}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{cfg.label}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono font-semibold">{formatCurrency(total)}</p>
                      <p className="text-[10px] opacity-70">{count} entries</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddCommissionModal
          leads={leads}
          profiles={profiles}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

// ── Users icon ─────────────────────────────────────────────────────────
function Users({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}
