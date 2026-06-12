'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import type { ApprovalStatus } from '@/types/automation';

const STATUS_STYLES: Record<ApprovalStatus, string> = {
  pending: 'bg-amber-50 text-amber-600',
  approved: 'bg-blue-50 text-blue-600',
  auto_sent: 'bg-green-50 text-green-600',
  skipped: 'bg-gray-100 text-gray-400',
  failed: 'bg-red-50 text-red-500',
};

interface LogRow {
  id: string;
  action_type: string;
  approval_status: ApprovalStatus;
  triggered_at: string;
  sent_at: string | null;
  lead: { first_name: string | null; last_name: string | null } | null;
  rule: { rule_name: string | null } | null;
}

export function AutomationLogTable() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/automations/log')
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.log ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="font-semibold text-gray-900 text-sm">Automation History</h2>
        <p className="text-xs text-gray-400 mt-0.5">All sends are permanently logged</p>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">No automations have fired yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                {['Borrower', 'Rule', 'Type', 'Status', 'Triggered', 'Sent'].map((h) => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/50">
                  <td className="py-3 px-4 text-sm text-gray-900">
                    {log.lead?.first_name ?? '—'} {log.lead?.last_name ?? ''}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{log.rule?.rule_name ?? '—'}</td>
                  <td className="py-3 px-4 text-xs text-gray-500">{log.action_type}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[log.approval_status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {log.approval_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">{format(new Date(log.triggered_at), 'MMM d, h:mma')}</td>
                  <td className="py-3 px-4 text-xs text-gray-500">{log.sent_at ? format(new Date(log.sent_at), 'MMM d, h:mma') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
