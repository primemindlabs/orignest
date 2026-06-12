'use client';

import { IconClockHour4, IconMessage } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import { RecoveryStatusBadge } from './RecoveryStatusBadge';
import type { AbandonedSessionDashboard } from '@/types/abandonRecovery';

function formatPhone(p: string | null): string {
  if (!p) return 'No phone on file';
  const d = p.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
}

export function AbandonedApplicationCard({ session }: { session: AbandonedSessionDashboard }) {
  const lead = session.lead;
  const name = `${lead?.first_name ?? ''} ${lead?.last_name ?? ''}`.trim() || 'Unnamed applicant';
  const when = formatDistanceToNow(new Date(session.last_activity_at), { addSuffix: true });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{name}</p>
          <p className="text-sm text-gray-500 mt-0.5">{formatPhone(session.borrower_phone ?? lead?.phone ?? null)}</p>
        </div>
        <RecoveryStatusBadge session={session} />
      </div>

      <div className="mt-4 space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>{session.last_section_completed ? session.last_section_completed.replace(/_/g, ' ') : 'Not started'}</span>
          <span>{session.completion_pct}% complete</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-[#C9A95C] transition-all" style={{ width: `${session.completion_pct}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1">
          <IconClockHour4 size={13} /> {session.completed_at ? 'Submitted' : 'Last active'} {when}
        </span>
        <span className="inline-flex items-center gap-1">
          <IconMessage size={13} /> {session.recovery_attempts_sent}/3 recovery SMS
        </span>
      </div>
    </div>
  );
}
