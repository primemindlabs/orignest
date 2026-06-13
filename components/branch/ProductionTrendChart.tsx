'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { ProductionTrendPoint } from '@/types/branch-manager';

export function ProductionTrendChart({ trend, fullHeight = false }: { trend: ProductionTrendPoint[]; fullHeight?: boolean }) {
  const data = trend.map((p) => ({
    week: format(parseISO(p.week), 'MMM d'),
    funded: p.funded,
    pipeline: Math.round(p.pipeline_value / 1000),
  }));
  const height = fullHeight ? 360 : 220;

  return (
    <div className={fullHeight ? '' : 'bg-white rounded-2xl border border-gray-100 shadow-sm p-5'}>
      <h2 className="font-semibold text-gray-900 mb-4">12-Week Production Trend</h2>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center">No closings in the last 12 weeks yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={32} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={36}
              tickFormatter={(v) => `$${v}K`}
            />
            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 12, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
            <Line yAxisId="left" type="monotone" dataKey="funded" name="Loans Closed" stroke="#C9A95C" strokeWidth={2.5} dot={{ r: 3, fill: '#C9A95C' }} activeDot={{ r: 5 }} />
            <Line yAxisId="right" type="monotone" dataKey="pipeline" name="Closed Volume ($K)" stroke="#6b7280" strokeWidth={2} strokeDasharray="4 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
