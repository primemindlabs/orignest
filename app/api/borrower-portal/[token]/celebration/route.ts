// Phase 123 — dismiss a celebration so it shows once (token-gated).
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePortalToken } from '@/lib/portal/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const id = await resolvePortalToken(sb, params.token);
  if (!id) return NextResponse.json({ error: 'Invalid portal link' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const type = (body?.celebrationType ?? '').toString();
  if (!['under_contract', 'funded'].includes(type)) return NextResponse.json({ error: 'Invalid celebration type' }, { status: 400 });

  await sb
    .from('loan_celebration_states')
    .upsert({ lead_id: id.leadId, org_id: id.orgId, celebration_type: type, shown_at: new Date().toISOString() }, { onConflict: 'lead_id,celebration_type' });

  return NextResponse.json({ ok: true });
}
