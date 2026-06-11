'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconCheck, IconShieldLock, IconExternalLink } from '@tabler/icons-react';
import { SettingsField } from './SettingsField';

const GOLD = '#C9A95C';
const GREEN = '#1a7a3c';

export interface CompPlan {
  id: string;
  name: string | null;
  comp_bps: number | null;
  comp_flat: number | null;
  basis: string | null;
  is_active: boolean | null;
  min_loan_amount: number | null;
  max_loan_amount: number | null;
}

function planRate(p: CompPlan): string {
  if (p.comp_bps != null) return `${(p.comp_bps / 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}%`;
  if (p.comp_flat != null) return `$${p.comp_flat.toLocaleString()}`;
  return '—';
}

export function CompSettings({ compRate, plans }: { compRate: number | null; plans: CompPlan[] }) {
  const [rate, setRate] = useState(compRate ?? 1.25);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comp_rate: rate }),
      });
      const j = await res.json();
      if (!res.ok) setError(j.error ?? 'Could not save.');
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* RESPA note */}
      <div className="flex items-start gap-2 text-[11px] text-label-2 rounded-xl px-4 py-3" style={{ background: 'rgba(201,169,92,0.08)' }}>
        <IconShieldLock size={15} style={{ color: GOLD }} className="flex-shrink-0 mt-px" />
        <span>
          Comp rates here are for internal dashboard math only — they never flow into loan disclosures. Per RESPA
          Section 8, do not record yield-spread premiums, lender credits, or other arrangements here.
        </span>
      </div>

      {/* Personal rate */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-5 space-y-4">
        <SettingsField label="My commission rate" hint="Applies to commission estimates on your loans + the pipeline page">
          <div className="relative w-40">
            <input
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full px-3 py-2 pr-7 rounded-lg border border-black/[0.10] bg-white text-sm tabular-nums focus:outline-none focus:border-[#C9A95C]"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-label-3">%</span>
          </div>
        </SettingsField>
        {error && <p className="text-xs text-red">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-50"
            style={{ background: saved ? GREEN : GOLD }}
          >
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save rate'}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: GREEN }}>
              <IconCheck size={14} /> Updated
            </span>
          )}
        </div>
      </div>

      {/* Company comp plans (read-only) */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-label">Company comp plans</h2>
          <Link
            href="/commissions"
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: '#876830' }}
          >
            Manage in Commissions <IconExternalLink size={12} />
          </Link>
        </div>

        {plans.length === 0 ? (
          <p className="text-xs text-label-3 mt-3">No comp plans defined yet. Create them in the Commissions area.</p>
        ) : (
          <table className="w-full mt-3 text-sm">
            <thead>
              <tr className="text-[11px] text-label-3 text-left border-b border-black/[0.06]">
                <th className="font-medium py-2">Plan</th>
                <th className="font-medium py-2">Rate</th>
                <th className="font-medium py-2">Loan range</th>
                <th className="font-medium py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-b border-black/[0.04]">
                  <td className="py-2 text-label font-medium">{p.name ?? 'Unnamed'}</td>
                  <td className="py-2 tabular-nums">{planRate(p)}</td>
                  <td className="py-2 text-label-2 tabular-nums text-xs">
                    {p.min_loan_amount || p.max_loan_amount
                      ? `${p.min_loan_amount ? `$${(p.min_loan_amount / 1000).toFixed(0)}k` : '$0'}–${p.max_loan_amount ? `$${(p.max_loan_amount / 1000).toFixed(0)}k` : '∞'}`
                      : 'All'}
                  </td>
                  <td className="py-2">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={
                        p.is_active
                          ? { background: 'rgba(26,122,60,0.12)', color: GREEN }
                          : { background: '#f0f0f2', color: '#6B7B8D' }
                      }
                    >
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
