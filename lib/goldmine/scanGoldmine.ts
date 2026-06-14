/**
 * Phase 131 — weekly Goldmine scan for one LO. Computes candidates from all signals,
 * keeps one (highest-priority) per contact, then refreshes the queue WITHOUT clobbering
 * opportunities the LO has already acted on or dismissed.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GoldmineCandidate } from './types';
import { buildGoldmineContext } from './context';
import { preApprovalExpired } from './signals/preApprovalExpired';
import { rateImprovement } from './signals/rateImprovement';
import { equityMilestone } from './signals/equityMilestone';
import { loanAnniversary } from './signals/loanAnniversary';
import { longInactive } from './signals/longInactive';

const MAX_PER_LO = 50;
const ENGAGED = new Set(['outreached', 'responded', 'converted']);

export async function scanGoldmineForLO(
  sb: SupabaseClient,
  loId: string,
  orgId: string,
  loFirstName: string,
  compRate: number | null,
): Promise<number> {
  const ctx = await buildGoldmineContext(sb, loId, orgId, loFirstName, compRate);

  const candidates: GoldmineCandidate[] = [
    ...preApprovalExpired(ctx),
    ...rateImprovement(ctx),
    ...equityMilestone(ctx),
    ...loanAnniversary(ctx),
    ...longInactive(ctx),
  ];

  // One opportunity per contact — highest priority wins.
  const byContact = new Map<string, GoldmineCandidate>();
  for (const c of candidates) {
    const cur = byContact.get(c.contact_id);
    if (!cur || c.priority_score > cur.priority_score) byContact.set(c.contact_id, c);
  }

  // Existing state — don't resurface engaged or actively-dismissed opportunities.
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await sb
    .from('goldmine_opportunities')
    .select('contact_id, signal_type, status, dismissed_until')
    .eq('lo_id', loId);
  const engagedContacts = new Set<string>();
  const dismissedActive = new Set<string>();
  for (const e of (existing ?? []) as { contact_id: string; signal_type: string; status: string; dismissed_until: string | null }[]) {
    if (ENGAGED.has(e.status)) engagedContacts.add(e.contact_id);
    if (e.status === 'dismissed' && e.dismissed_until && e.dismissed_until >= today) {
      dismissedActive.add(`${e.contact_id}:${e.signal_type}`);
    }
  }

  const fresh = [...byContact.values()]
    .filter((c) => !engagedContacts.has(c.contact_id) && !dismissedActive.has(`${c.contact_id}:${c.signal_type}`))
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, MAX_PER_LO);

  if (!fresh.length) return 0;

  // surfaced_at omitted → default now() on insert, preserved on update.
  const rows = fresh.map((c) => ({
    org_id: orgId,
    lo_id: loId,
    contact_id: c.contact_id,
    contact_name: c.contact_name,
    loan_id: c.loan_id,
    signal_type: c.signal_type,
    signal_headline: c.signal_headline,
    signal_detail: c.signal_detail,
    priority_score: c.priority_score,
    estimated_loan_amount: c.estimated_loan_amount,
    estimated_comp_dollars: c.estimated_comp_dollars,
    draft_sms: c.draft_sms,
    draft_email_subject: c.draft_email_subject,
    draft_email_body: c.draft_email_body,
    status: 'surfaced' as const,
    dismissed_until: null,
    last_updated: new Date().toISOString(),
  }));

  const { error } = await sb.from('goldmine_opportunities').upsert(rows, { onConflict: 'lo_id,contact_id,signal_type', ignoreDuplicates: false });
  if (error) throw error;
  return rows.length;
}
