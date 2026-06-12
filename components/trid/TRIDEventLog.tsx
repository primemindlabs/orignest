// Phase 84 — immutable chronological TRID event log. No edit/delete controls.
// Sorted ascending by event_date. Server-rendered from trid_events rows.

import { IconCheck, IconAlertTriangle, IconFileText } from '@tabler/icons-react';

export type TridEventRow = {
  id: string;
  event_type: string;
  event_date: string;
  deadline_date: string | null;
  is_compliant: boolean | null;
  notes: string | null;
};

const LABELS: Record<string, string> = {
  le_issued: 'LE Issued', le_received: 'LE Received', le_revised: 'LE Revised',
  cd_issued: 'CD Issued', cd_received: 'CD Received', cd_revised: 'CD Revised',
  rate_lock_set: 'Rate Lock Set', rate_lock_extended: 'Rate Lock Extended', closing_date_set: 'Closing Date Set',
};

export function TRIDEventLog({ events }: { events: TridEventRow[] }) {
  const sorted = [...events].sort((a, b) => a.event_date.localeCompare(b.event_date));

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--c-border)]">
        <IconFileText size={15} className="text-[var(--c-gold-deep)]" />
        <span className="text-[12px] font-semibold text-[var(--c-text)]">TRID event log</span>
        <span className="text-[11px] text-[var(--c-label3)]">immutable · {sorted.length}</span>
      </div>
      {sorted.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-[var(--c-label3)]">No TRID events recorded yet.</p>
      ) : (
        <ul>
          {sorted.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--c-border)] last:border-b-0">
              <span className="text-[11px] font-mono tabular-nums text-[var(--c-label2)] w-[84px] flex-shrink-0">{e.event_date}</span>
              <span className="text-[11px] font-medium text-[var(--c-text)] bg-[rgba(60,60,67,0.05)] rounded-full px-2 py-0.5">{LABELS[e.event_type] ?? e.event_type}</span>
              <div className="min-w-0 flex-1">
                {e.deadline_date && (
                  <span className="text-[11px] text-[var(--c-label3)]">deadline {e.deadline_date}</span>
                )}
                {e.notes && <p className="text-[11px] text-[var(--c-label2)] truncate">{e.notes}</p>}
              </div>
              {e.is_compliant !== null && (
                e.is_compliant ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--c-green)] flex-shrink-0"><IconCheck size={13} /> On time</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--c-danger)] flex-shrink-0"><IconAlertTriangle size={13} /> Late</span>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
