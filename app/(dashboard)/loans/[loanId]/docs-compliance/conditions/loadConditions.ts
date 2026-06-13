import { createAdminClient } from '@/lib/supabase/admin';
import type { Condition } from '@/components/loan/ConditionsManager';

export async function loadConditions(loanId: string, orgId: string): Promise<Condition[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from('loan_conditions')
    .select('id, condition_text, category, priority, status, due_date')
    .eq('lead_id', loanId).eq('org_id', orgId)
    .order('created_at', { ascending: true });
  return (data ?? []) as Condition[];
}
