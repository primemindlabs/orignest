// PATCH /api/import/[id] — review-queue action. { action: 'promote' | 'dismiss' }
// promote → creates a real lead (pipeline) from the staged row and links it.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  const sb = createAdminClient();

  const { data: row } = await sb.from('imported_loans').select('*').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (row.status !== 'pending') return NextResponse.json({ error: 'Already reviewed' }, { status: 409 });

  if (action === 'dismiss') {
    await sb.from('imported_loans').update({ status: 'dismissed', reviewed_at: new Date().toISOString(), reviewed_by: userId }).eq('id', params.id);
    return NextResponse.json({ ok: true, status: 'dismissed' });
  }

  if (action === 'promote') {
    const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
    const { data: lead, error } = await sb
      .from('leads')
      .insert({
        org_id: orgId,
        assigned_to: profile?.id ?? null,
        first_name: row.borrower_first_name ?? 'Imported',
        last_name: row.borrower_last_name ?? 'Lead',
        email: row.borrower_email,
        phone: row.borrower_phone,
        loan_amount: row.loan_amount,
        loan_type: row.loan_type,
        loan_purpose: row.loan_purpose,
        property_address: row.property_address,
        stage: 'new_inquiry',
        lead_source: `import_${row.source}`,
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await sb.from('imported_loans').update({ status: 'imported', imported_lead_id: lead.id, reviewed_at: new Date().toISOString(), reviewed_by: userId }).eq('id', params.id);
    return NextResponse.json({ ok: true, status: 'imported', lead_id: lead.id });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
