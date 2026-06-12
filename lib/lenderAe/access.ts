// Phase 89 — shared owner/visibility resolution for the AE directory. LOs see only
// their own AE connections; admins and branch managers see the whole org's.
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeRole } from '@/lib/navigation/roles';

export async function resolveOwner(
  sb: SupabaseClient<any, any, any>,
  clerkUserId: string,
  role: string,
): Promise<{ me: string | null; seesAll: boolean }> {
  const { data } = await sb.from('profiles').select('id').eq('clerk_user_id', clerkUserId).maybeSingle();
  const norm = normalizeRole(role);
  return { me: (data?.id as string | undefined) ?? null, seesAll: norm === 'admin' || norm === 'branch_manager' };
}
