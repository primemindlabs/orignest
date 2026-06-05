import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LeaderboardClient } from './LeaderboardClient';

export default async function LeaderboardPage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect('/sign-in');

  const sb = createClient();

  const { data: profile } = await sb
    .from('profiles')
    .select('id,role')
    .eq('clerk_user_id', userId)
    .single();

  // RBAC: only admin and branch_manager
  if (!profile || !['admin', 'branch_manager'].includes(profile.role)) {
    redirect('/dashboard');
  }

  const { data: org } = await sb
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', orgId)
    .single();

  if (!org) redirect('/dashboard');

  // Get today's snapshots for all LOs
  const today = new Date().toISOString().split('T')[0];
  const { data: snapshots } = await sb
    .from('lo_performance_snapshots')
    .select(`
      *,
      profiles:lo_id (
        id, first_name, last_name, full_name, avatar_url, nmls_id, email
      )
    `)
    .eq('org_id', org.id)
    .eq('snapshot_date', today)
    .order('volume_closed_mtd', { ascending: false });

  // Fallback: get all active LOs if no snapshots yet
  let los: Array<{
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    avatar_url: string | null;
    nmls_id: string | null;
  }> = [];

  if (!snapshots?.length) {
    const { data: profiles } = await sb
      .from('profiles')
      .select('id,first_name,last_name,full_name,avatar_url,nmls_id')
      .eq('org_id', org.id)
      .eq('is_active', true)
      .in('role', ['loan_officer', 'branch_manager', 'admin']);
    los = profiles ?? [];
  }

  return (
    <LeaderboardClient
      snapshots={snapshots ?? []}
      fallbackLOs={los}
    />
  );
}
