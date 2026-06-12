// Phase 107 — shared: resolve the caller's profile id (the LO) from Clerk userId.
import type { SupabaseClient } from '@supabase/supabase-js';

export async function resolveLoId(sb: SupabaseClient<any, any, any>, clerkUserId: string): Promise<string | null> {
  const { data } = await sb.from('profiles').select('id').eq('clerk_user_id', clerkUserId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
