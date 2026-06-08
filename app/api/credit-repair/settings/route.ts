import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

async function resolveOrg(orgId: string) {
  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle();
  return { sb, orgId: org?.id as string | undefined };
}

export async function GET(): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { sb, orgId: id } = await resolveOrg(orgId);
  if (!id) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

  const { data } = await sb.from('credit_repair_org_settings').select('*').eq('org_id', id).maybeSingle();
  return NextResponse.json({ settings: data ?? null });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { sb, orgId: id } = await resolveOrg(orgId);
  if (!id) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  const allowed = ['notify_on_item_removed', 'notify_on_dispute_sent', 'notify_on_bureau_response', 'notify_sms_default', 'lo_email_override'];
  const patch: Record<string, unknown> = { org_id: id };
  for (const k of allowed) if (k in body) patch[k] = body[k];

  const { error } = await sb.from('credit_repair_org_settings').upsert(patch, { onConflict: 'org_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
