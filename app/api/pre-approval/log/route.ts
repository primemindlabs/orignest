import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// POST /api/pre-approval/log — record that a pre-approval letter was generated.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { lead_id, loan_amount, loan_program } = (await req.json()) as {
    lead_id: string;
    loan_amount: number;
    loan_program: string;
  };

  if (!lead_id) {
    return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
  }

  const sb = createAdminClient();

  const { data: org } = await sb
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', orgId)
    .maybeSingle();
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .eq('org_id', org.id)
    .maybeSingle();

  const amountFmt = loan_amount
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(loan_amount)
    : '';

  const { error } = await sb.from('lead_activities').insert({
    lead_id,
    org_id: org.id,
    actor_id: profile?.id ?? null,
    action: 'pre_approval_generated',
    description: `Pre-approval letter generated${loan_program ? ` (${loan_program}` : ''}${amountFmt ? `${loan_program ? ', ' : ' ('}${amountFmt})` : loan_program ? ')' : ''}`,
    metadata: { loan_amount, loan_program },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
