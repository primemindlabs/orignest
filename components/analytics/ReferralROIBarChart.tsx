'use client';

/** Phase 98 — close rate by source (horizontal bars). Best source = gold. */
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SOURCE_SELECT_LABELS } from '@/lib/analytics/sources';
import type { ReferralROIRow } from '@/types/analytics';

const trunc = (s: string) => (s.length > 20 ? `${s.slice(0, 19)}…` : s);

export function ReferralROIBarChart({ rows }: { rows: ReferralROIRow[] }) {
  const data = rows
    .filter((r) => r.leads_count > 0)
    .map((r) => ({
      name: trunc(`${SOURCE_SELECT_LABELS[r.source_type] ?? r.source_type}${r.source_detail ? ` · ${r.source_detail}` : ''}`),
      close_rate: r.close_rate ?? 0,
      leads: r.leads_count,
      closed: r.closed_count,
    }));
  if (data.length === 0) return null;

  const best = Math.max(...data.map((d) => d.close_rate));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm font-medium text-gray-900 mb-3">Close rate by source</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 120 }}>
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#6B7280' }} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#374151' }} />
          <Tooltip
            formatter={(value: number, _n, p) => [`${Math.round(value)}% · ${p.payload.closed}/${p.payload.leads} closed`, 'Close rate']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
          />
          <Bar dataKey="close_rate" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.close_rate === best && best > 0 ? '#C9A95C' : '#D1D5DB'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
