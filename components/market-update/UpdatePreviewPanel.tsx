'use client';

import type { RealtorMarketUpdate } from '@/types/marketUpdate';

export function UpdatePreviewPanel({ update, onUpdate }: { update: RealtorMarketUpdate; onUpdate: (u: RealtorMarketUpdate) => void }) {
  const field = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30';
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <p className="font-semibold text-gray-900">Email Preview</p>
      <div>
        <p className="text-xs text-gray-500 mb-1">Market Summary</p>
        <textarea rows={5} value={update.market_summary} onChange={(e) => onUpdate({ ...update, market_summary: e.target.value })} className={`${field} resize-none`} />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-2">Talking Points</p>
        <div className="space-y-2">
          {update.talking_points.map((tp, i) => (
            <input
              key={i}
              value={tp}
              onChange={(e) => { const u = [...update.talking_points]; u[i] = e.target.value; onUpdate({ ...update, talking_points: u }); }}
              className={field}
            />
          ))}
        </div>
      </div>
      <div className="px-3 py-2.5 bg-gray-50 rounded-xl">
        <p className="text-xs text-gray-400 leading-relaxed">{update.source_disclosure}</p>
      </div>
    </div>
  );
}
