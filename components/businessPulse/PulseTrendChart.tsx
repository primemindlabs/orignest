'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';

type Point = { score_date: string; pulse_score: number };

function shortDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

export function PulseTrendChart({ history }: { history: Point[] }) {
  if (!history || history.length < 2) {
    return (
      <div className="bg-white rounded-xl border border-[#E8E4DE] px-5 py-8 text-center text-sm text-[#6B7B8D]">
        Trend appears once Business Pulse has a few days of history.
      </div>
    );
  }

  const data = history.map((h) => ({ date: shortDate(h.score_date), score: h.pulse_score }));

  return (
    <div className="bg-white rounded-xl border border-[#E8E4DE] px-4 py-4">
      <p className="text-xs font-medium text-[#6B7B8D] uppercase tracking-wide mb-3 px-1">30-Day Pulse Trend</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" vertical={false} />
          <ReferenceLine y={85} stroke="#1A7A45" strokeDasharray="2 4" strokeOpacity={0.4} />
          <ReferenceLine y={65} stroke="#C9A95C" strokeDasharray="2 4" strokeOpacity={0.4} />
          <ReferenceLine y={40} stroke="#C4724A" strokeDasharray="2 4" strokeOpacity={0.4} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7B8D' }} tickLine={false} axisLine={{ stroke: '#E8E4DE' }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6B7B8D' }} tickLine={false} axisLine={false} width={36} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #E8E4DE', fontSize: 12 }}
            labelStyle={{ color: '#6B7B8D' }}
            formatter={(v: number) => [`${v}`, 'Pulse']}
          />
          <Line type="monotone" dataKey="score" stroke="#C9A95C" strokeWidth={2.5} dot={{ r: 2.5, fill: '#C9A95C' }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
