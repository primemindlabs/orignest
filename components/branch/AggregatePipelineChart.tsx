'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { LOProfileSummary } from '@/types/branch-manager';

export function AggregatePipelineChart({ team }: { team: LOProfileSummary[] }) {
  const data = team.slice(0, 8).map((lo) => ({
    name: lo.name.split(' ')[0],
    pipeline: Math.round((lo.metrics.pipeline_value ?? 0) / 1000),
  }));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="font-semibold text-gray-900 mb-4">Pipeline by LO ($K)</h2>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center">No pipeline yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 12, fontSize: 12 }}
              formatter={(v: number) => [`$${v.toLocaleString()}K`, 'Pipeline']}
            />
            <Bar dataKey="pipeline" fill="#C9A95C" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
