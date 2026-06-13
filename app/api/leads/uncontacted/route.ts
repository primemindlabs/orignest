// The LO's "respond now" queue: new leads never contacted, oldest first. Powers the
// SpeedTicker + the Speed-to-Lead board. (Fixed: was querying the Clerk org id against
// the Supabase uuid column via the anon client under RLS — returned nothing. Now uses
// getOrgContext + admin client, scoped to the LO's own assigned leads.)
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface UncontactedLead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ leads: [] });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let q = sb
    .from('leads')
    .select('id, first_name, last_name, email, phone, created_at')
    .eq('org_id', orgId)
    .in('stage', ['new_inquiry', 'pre_qualified'])
    .is('first_contacted_at', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(100);
  if (profile?.id) q = q.eq('assigned_to', profile.id);

  const { data } = await q;
  return NextResponse.json({ leads: (data ?? []) as UncontactedLead[] });
}
