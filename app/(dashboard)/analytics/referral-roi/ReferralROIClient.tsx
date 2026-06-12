'use client';

/** Phase 98 — Referral Source ROI page client (period state + data fetch). */
import { useState, useEffect, useCallback } from 'react';
import { IconCurrencyDollar } from '@tabler/icons-react';
import { PeriodSelector } from '@/components/analytics/PeriodSelector';
import { TopPerformerCard } from '@/components/analytics/TopPerformerCard';
import { ROITable } from '@/components/analytics/ROITable';
import { ReferralROIBarChart } from '@/components/analytics/ReferralROIBarChart';
import { AddCostModal } from '@/components/analytics/AddCostModal';
import type { ReferralROIRow } from '@/types/analytics';

type Period = 30 | 60 | 90 | 180;

export function ReferralROIClient() {
  const [period, setPeriod] = useState<Period>(90);
  const [rows, setRows] = useState<ReferralROIRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/referral-roi?period=${period}`);
      if (res.ok) setRows((await res.json()).data ?? []);
    } finally { setLoading(false); }
  }, [period]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Referral Source ROI</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track which sources drive closed loans and what they cost.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-sm font-medium border border-gray-200 text-gray-700 hover:border-gray-300 flex-shrink-0">
          <IconCurrencyDollar size={15} /> Manage Costs
        </button>
      </div>

      <PeriodSelector value={period} onChange={setPeriod} />

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
      ) : (
        <>
          <TopPerformerCard rows={rows} />
          <ROITable rows={rows} />
          <ReferralROIBarChart rows={rows} />
        </>
      )}

      {showModal && <AddCostModal onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}
