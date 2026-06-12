// Phase 82 — GET the last 10 AI queries for this loan (current user's history).

import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  try {
    const { userId, orgId } = await getOrgContext();
    if (!userId || !orgId) return NextResponse.json({ queries: [] });

    const sb = createAdminClient();
    const { data: profile } = await sb
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .maybeSingle();
    const profileId = profile?.id as string | undefined;
    if (!profileId) return NextResponse.json({ queries: [] });

    const { data } = await sb
      .from('loan_ai_queries')
      .select('id, question, answer, sources, created_at')
      .eq('org_id', orgId)
      .eq('lead_id', params.loanId)
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({ queries: data ?? [] });
  } catch (err) {
    console.error('[loans ai-query history]', err);
    return NextResponse.json({ queries: [] });
  }
}
