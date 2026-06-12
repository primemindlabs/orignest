'use client';

import { useEffect, useState } from 'react';
import { estimateExtensionCost, type ExtensionCostResult } from '@/lib/rate-lock/costEstimator';

interface Props {
  loanBalance: number;
  defaultBps?: number;
  defaultDays?: number;
  onChange: (result: { bpsPerDay: number; daysRequested: number } & ExtensionCostResult) => void;
}

export function CostEstimatorInputs({ loanBalance, defaultBps = 4, defaultDays = 10, onChange }: Props) {
  const [bps, setBps] = useState(defaultBps);
  const [days, setDays] = useState(defaultDays);

  const bpsValid = bps > 0;
  const { totalCostDollars, bpsTotal } = estimateExtensionCost({
    bpsPerDay: bps,
    daysRequested: days,
    loanBalance,
  });

  useEffect(() => {
    onChange({ bpsPerDay: bps, daysRequested: days, totalCostDollars, bpsTotal });
  }, [bps, days, totalCostDollars, bpsTotal, onChange]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-500">BPS / day</span>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={bps}
            onChange={(e) => setBps(parseFloat(e.target.value) || 0)}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Days needed</span>
          <input
            type="number"
            min="1"
            max="30"
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10) || 0)}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30"
          />
        </label>
      </div>

      <div>
        <span className="text-xs font-medium text-gray-500">Loan balance</span>
        <p className="text-sm text-gray-700 mt-0.5">${Math.round(loanBalance).toLocaleString()}</p>
      </div>

      <div className="rounded-xl bg-gray-50 p-4 text-center">
        <p className="text-2xl font-bold text-[#C9A95C]">${totalCostDollars.toLocaleString()}</p>
        <p className="text-xs text-gray-400 mt-0.5">({bpsTotal} BPS total estimate)</p>
        {!bpsValid && <p className="text-xs text-red-600 mt-1">BPS per day must be greater than 0</p>}
      </div>

      <p className="text-xs text-gray-400 italic">Actual cost confirmed by AE. This is an estimate only.</p>
    </div>
  );
}
