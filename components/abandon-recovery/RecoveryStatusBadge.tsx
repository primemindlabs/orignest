import type { ApplicationSession } from '@/types/abandonRecovery';

export function RecoveryStatusBadge({ session }: { session: Pick<ApplicationSession, 'completed_at' | 'abandoned_at' | 'recovery_attempts_sent'> }) {
  if (session.completed_at) {
    return <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-600">Submitted</span>;
  }
  if (session.abandoned_at) {
    return <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Expired</span>;
  }
  if (session.recovery_attempts_sent === 0) {
    return <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">Awaiting Recovery SMS</span>;
  }
  return (
    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#C9A95C]/15 text-[#8A6310]">
      Recovery SMS Sent ({session.recovery_attempts_sent}/3)
    </span>
  );
}
