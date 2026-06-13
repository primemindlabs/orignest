/**
 * Phase 123 — borrower-portal token resolver. SERVER-ONLY.
 * The borrower portal authenticates by unguessable token (borrower_portal_tokens),
 * not Supabase auth. Every Phase 123 token API resolves the token to {leadId, orgId}
 * with this helper and then reads/writes via the service-role admin client.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PortalIdentity { leadId: string; orgId: string }

export async function resolvePortalToken(
  sb: SupabaseClient<any, any, any>,
  token: string,
): Promise<PortalIdentity | null> {
  if (!token) return null;
  const { data } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at as string) < new Date()) return null;
  return { leadId: data.lead_id as string, orgId: data.org_id as string };
}

// Real lead.stage → the 6 canonical tracker stages (loan_tracker_stages.stage_order).
const STAGE_TO_ORDER: Record<string, number> = {
  new_inquiry: 1, pre_qualified: 1, application_started: 1,
  application_complete: 2, processing: 2,
  underwriting: 3,
  conditional_approval: 4,
  clear_to_close: 5,
  closing_scheduled: 6, closed: 6,
  dead: 1,
};
export const trackerOrderForStage = (stage: string | null | undefined): number =>
  (stage && STAGE_TO_ORDER[stage]) || 1;

// Celebration eligibility derived from the real stage.
export function eligibleCelebrations(stage: string | null | undefined): ('under_contract' | 'funded')[] {
  const out: ('under_contract' | 'funded')[] = [];
  if (stage && ['conditional_approval', 'clear_to_close', 'closing_scheduled', 'closed'].includes(stage)) out.push('under_contract');
  if (stage === 'closed') out.push('funded');
  return out;
}
