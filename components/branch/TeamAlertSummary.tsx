'use client';

import { IconAlertTriangle, IconChevronRight, IconCircleCheck } from '@tabler/icons-react';
import { format } from 'date-fns';
import type { TRIDAlertItem } from '@/types/branch-manager';

const ALERT_TYPE_LABELS: Record<string, string> = {
  le_issued: 'LE Issued',
  le_received: 'LE Received',
  le_revised: 'LE Revised',
  cd_issued: 'CD Issued',
  cd_received: 'CD Received',
  cd_revised: 'CD Revised',
  rate_lock_set: 'Rate Lock',
  rate_lock_extended: 'Rate Lock Ext.',
  closing_date_set: 'Closing Date',
};

export function TeamAlertSummary({ alerts, onViewLead }: { alerts: TRIDAlertItem[]; onViewLead: (leadId: string) => void }) {
  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
        <IconCircleCheck size={40} className="mx-auto mb-3 text-green-400" />
        <p className="font-medium text-gray-600">No open TRID alerts across the team</p>
        <p className="text-sm text-gray-400 mt-1">All loans are in compliance</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
        <IconAlertTriangle size={16} className="text-red-500" />
        <h2 className="font-semibold text-gray-900">TRID Alerts — Team ({alerts.length})</h2>
      </div>
      <div className="divide-y divide-gray-50">
        {alerts.map((alert) => (
          <button key={alert.id} onClick={() => onViewLead(alert.lead_id)} className="w-full text-left px-5 py-4 hover:bg-gray-50/50 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${alert.days_overdue > 0 ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'}`}>
                    {ALERT_TYPE_LABELS[alert.alert_type] ?? alert.alert_type}
                  </span>
                  {alert.days_overdue > 0 && <span className="text-xs text-red-400">{alert.days_overdue}d overdue</span>}
                </div>
                <p className="text-sm text-gray-700">
                  {alert.borrower_last_name} — <span className="text-gray-400">{alert.lo_name}</span>
                </p>
                {alert.due_date && <p className="text-xs text-gray-400 mt-0.5">Due {format(new Date(alert.due_date), 'MMM d, yyyy')}</p>}
              </div>
              <IconChevronRight size={14} className="text-gray-300 flex-shrink-0" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
