import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST /api/investors/[id]/properties — link a loan/lead to an investor entity. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.lead_id) return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });

  const sb = createAdminClient();
  const { error } = await sb
    .from('investor_properties')
    .upsert(
      { org_id: orgId, entity_id: params.id, lead_id: body.lead_id },
      { onConflict: 'org_id,entity_id,lead_id', ignoreDuplicates: true },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** DELETE /api/investors/[id]/properties?lead_id=... — unlink a loan. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const leadId = new URL(req.url).searchParams.get('lead_id');
  if (!leadId) return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });

  const sb = createAdminClient();
  const { error } = await sb
    .from('investor_properties')
    .delete()
    .eq('org_id', orgId)
    .eq('entity_id', params.id)
    .eq('lead_id', leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
