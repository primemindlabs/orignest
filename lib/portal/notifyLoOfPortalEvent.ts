// Phase 106 — notify the assigned LO on a borrower-originated portal event (doc
// upload / message). Best-effort: the existing portal routes already log to
// lead_activities; this adds the notification-bell ping that was missing (the
// messages route literally carried a TODO for it). Reuses the canonical notify()
// store and the existing LO-facing portal page as the deep link.
import type { SupabaseClient } from '@supabase/supabase-js';
import { notify } from '@/lib/notifications/notify';

type Admin = SupabaseClient<any, any, any>;

export async function notifyLoOfPortalEvent(
  sb: Admin,
  input: { orgId: string; leadId: string; kind: 'doc_uploaded' | 'message_received'; detail?: string }
): Promise<void> {
  try {
    const { data: lead } = await sb
      .from('leads')
      .select('assigned_to, first_name')
      .eq('id', input.leadId)
      .eq('org_id', input.orgId)
      .maybeSingle();

    const loId = lead?.assigned_to as string | null;
    if (!loId) return; // unassigned lead — nothing to notify

    const name = (lead?.first_name as string | null) || 'A borrower';
    const title =
      input.kind === 'doc_uploaded'
        ? `${name} uploaded a document`
        : `New portal message from ${name}`;

    await notify(sb, {
      orgId: input.orgId,
      userId: loId,
      type: 'system',
      title,
      body: input.detail ?? null,
      link: `/loans/${input.leadId}/portal-comms/borrower-portal`,
    });
  } catch {
    // Never block the borrower's action on a notification failure.
  }
}
