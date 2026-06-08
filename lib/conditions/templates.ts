/**
 * Phase 5.2 — Loan-program condition checklists (server-only)
 *
 * When a lead's loan type is set, seed its conditions from condition_templates.
 * Org-specific templates take precedence over the platform defaults.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

// leads.loan_type (lowercase) → condition_templates.loan_program (canonical)
const PROGRAM_MAP: Record<string, string> = {
  fha: 'FHA',
  conventional: 'Conventional',
  va: 'VA',
  dscr: 'DSCR',
};

export async function applyConditionTemplates(params: {
  orgId: string;
  leadId: string;
  loanType: string | null | undefined;
}): Promise<{ added: number; program: string | null }> {
  const program = params.loanType ? PROGRAM_MAP[params.loanType] : undefined;
  if (!program) return { added: 0, program: null };

  const sb = createAdminClient();

  // Don't double-seed a lead that already has conditions.
  const { count } = await sb
    .from('loan_conditions')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', params.leadId)
    .eq('org_id', params.orgId);
  if ((count ?? 0) > 0) return { added: 0, program };

  // Org-specific first, else platform defaults (org_id IS NULL).
  const { data: orgTemplates } = await sb
    .from('condition_templates')
    .select('condition_text, category, priority, display_order')
    .eq('org_id', params.orgId)
    .eq('loan_program', program)
    .order('display_order');

  let templates = orgTemplates ?? [];
  if (templates.length === 0) {
    const { data: defaults } = await sb
      .from('condition_templates')
      .select('condition_text, category, priority, display_order')
      .is('org_id', null)
      .eq('loan_program', program)
      .order('display_order');
    templates = defaults ?? [];
  }
  if (templates.length === 0) return { added: 0, program };

  const rows = templates.map(
    (t: { condition_text: string; category: string; priority: string }) => ({
      lead_id: params.leadId,
      org_id: params.orgId,
      condition_text: t.condition_text,
      category: t.category,
      priority: t.priority,
      status: 'issued',
    }),
  );

  const { data } = await sb.from('loan_conditions').insert(rows).select('id');
  return { added: data?.length ?? 0, program };
}
