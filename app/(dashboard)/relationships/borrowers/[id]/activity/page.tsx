import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';

const EVENT_LABELS: Record<string, string> = {
  anniversary_alert: 'Anniversary alert', equity_milestone: 'Equity milestone reached',
  rate_drop_alert: 'Rate-drop alert', annual_review_sent: 'Annual review sent',
  annual_review_opened: 'Annual review opened', refi_inquiry: 'Refi inquiry',
  portfolio_viewed: 'Portfolio viewed', new_transaction_added: 'New transaction added',
};

export default async function ActivityPage({ params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: rel } = await sb.from('borrower_relationships').select('id').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!rel) notFound();
  const { data: events } = await sb.from('retention_events').select('event_type, created_at').eq('relationship_id', params.id).eq('org_id', orgId).order('created_at', { ascending: false }).limit(100);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Activity</h1>
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden divide-y divide-[var(--c-border)]">
        {(events ?? []).map((e, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Activity size={14} className="text-[var(--c-label3)]" />
            <span className="text-[13px] text-[var(--c-text)] flex-1">{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
            <span className="text-[11px] text-[var(--c-label3)]">{new Date(e.created_at).toLocaleDateString()}</span>
          </div>
        ))}
        {(events ?? []).length === 0 && <p className="text-[13px] text-[var(--c-label3)] text-center py-6">No activity yet. Touches appear here as they happen.</p>}
      </div>
    </div>
  );
}
