import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CROA_DISCLOSURE } from '@/lib/credit-repair/croa';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { token: string } }): Promise<NextResponse> {
  const sb = createAdminClient();
  const { enrollmentId } = (await req.json()) as { enrollmentId: string };

  const { data: pt } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id')
    .eq('token', params.token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: 'Invalid token' }, { status: 403 });

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';

  const { error } = await sb
    .from('credit_repair_enrollments')
    .update({
      croa_disclosure_signed_at: new Date().toISOString(),
      croa_disclosure_ip: ip,
      croa_contract_text: CROA_DISCLOSURE,
    })
    .eq('id', enrollmentId)
    .eq('lead_id', pt.lead_id)
    .eq('org_id', pt.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signed: true });
}
