'use client';

import { IconMail, IconBadge, IconTrendingUp } from '@tabler/icons-react';
import type { LOProfileSummary } from '@/types/branch-manager';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(v);

export function LOProfileCard({ lo }: { lo: LOProfileSummary }) {
  const stats = [
    { label: 'Active Leads', value: lo.metrics.leads_active.toLocaleString() },
    { label: 'Pipeline', value: fmt(lo.metrics.pipeline_value) },
    { label: 'Funded 30d', value: lo.metrics.loans_funded_30d.toLocaleString() },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden">
          {lo.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lo.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-gray-400">{lo.name.charAt(0)}</span>
          )}
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">{lo.name}</h2>
          {lo.nmls_id && (
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
              <IconBadge size={12} />
              NMLS #{lo.nmls_id}
            </div>
          )}
          {lo.email && (
            <a href={`mailto:${lo.email}`} className="flex items-center gap-1 text-xs text-[#C9A95C] hover:underline mt-1">
              <IconMail size={11} /> {lo.email}
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-gray-50 rounded-xl px-3 py-3 text-center">
            <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
            <p className="font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {lo.metrics.avg_days_to_close != null && (
        <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
          <IconTrendingUp size={12} className="text-[#C9A95C]" />
          Avg days to close (90d): {lo.metrics.avg_days_to_close.toFixed(1)} days
        </div>
      )}
      {lo.metrics.conversion_rate != null && (
        <div className="text-xs text-gray-400 mt-1.5">Conversion (90d): {(lo.metrics.conversion_rate * 100).toFixed(0)}%</div>
      )}
    </div>
  );
}
