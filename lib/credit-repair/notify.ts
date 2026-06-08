// LO notification helper (append-only audit log).
import type { SupabaseClient } from '@supabase/supabase-js';

export async function notifyLO(
  sb: SupabaseClient<any, any, any>,
  args: {
    orgId: string;
    enrollmentId: string;
    leadId: string | null;
    type: 'score_milestone' | 'item_removed' | 'dispute_sent' | 'bureau_response' | 'mortgage_ready' | 'cycle_complete';
    payload?: Record<string, unknown>;
    via?: string[];
  }
): Promise<void> {
  await sb.from('credit_repair_notifications').insert({
    org_id: args.orgId,
    enrollment_id: args.enrollmentId,
    lead_id: args.leadId,
    type: args.type,
    payload: args.payload ?? {},
    sent_via: args.via ?? ['in_app'],
  });
}
