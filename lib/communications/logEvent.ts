/**
 * Phase 66 — append a row to the INSERT-only communication_events audit log.
 * Best-effort: never throws into the caller. Strips PII from the preview.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { stripPII } from '@/lib/communications/tcpaWindow';

export async function logCommunicationEvent(params: { orgId: string; userId?: string; loanId?: string; channel: string; direction: 'inbound' | 'outbound'; contactIdentifier?: string; preview?: string; metadata?: Record<string, unknown> }): Promise<void> {
  try {
    const sb = createAdminClient();
    await sb.from('communication_events').insert({
      org_id: params.orgId, user_id: params.userId ?? null, loan_id: params.loanId ?? null,
      channel: params.channel, direction: params.direction, contact_identifier: params.contactIdentifier ?? null,
      message_preview: params.preview ? stripPII(params.preview).slice(0, 200) : null, metadata: params.metadata ?? {},
    });
  } catch (e) { console.error('[logCommunicationEvent]', e); }
}
