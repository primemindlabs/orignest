'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import type { RealtorMarketUpdate } from '@/types/marketUpdate';

export function SendHistoryTable() {
  const [updates, setUpdates] = useState<RealtorMarketUpdate[]>([]);

  useEffect(() => {
    fetch('/api/marketing/market-update').then((r) => r.json()).then((d) => setUpdates(d.updates ?? []));
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50"><h2 className="font-semibold text-gray-900">Send History</h2></div>
      {updates.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-400">No market updates yet. Generate one to get started.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="py-3 px-5 text-left text-xs font-medium text-gray-400 uppercase">Week Of</th>
              <th className="py-3 px-2 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
              <th className="py-3 px-2 text-left text-xs font-medium text-gray-400 uppercase">Recipients</th>
              <th className="py-3 px-2 text-left text-xs font-medium text-gray-400 uppercase">Sent At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {updates.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50/50">
                <td className="py-3 px-5 text-sm text-gray-900">{format(new Date(u.week_of), 'MMM d, yyyy')}</td>
                <td className="py-3 px-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${u.status === 'sent' ? 'bg-green-50 text-green-600' : u.status === 'draft' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>{u.status}</span>
                </td>
                <td className="py-3 px-2 text-sm text-gray-700">{u.total_recipients ?? '—'}</td>
                <td className="py-3 px-2 text-sm text-gray-500">{u.sent_at ? format(new Date(u.sent_at), 'MMM d, h:mmaaa') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
