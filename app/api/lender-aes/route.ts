import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOwner } from '@/lib/lenderAe/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELECT =
  'id, org_id, lo_id, lender_name, lender_website, lender_type, ae_name, ae_email, ae_phone, ae_cell, ae_linkedin, ae_title, loan_types, preferred, notes, last_submission_at, response_time_avg_hours, is_active, created_at';

// GET — active AE connections. LOs see their own; admins/BMs see the whole org's.
export async function GET() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { me, seesAll } = await resolveOwner(sb, userId, role);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  let q = sb.from('lender_ae_connections').select(SELECT).eq('is_active', true);
  q = seesAll ? q.eq('org_id', orgId) : q.eq('lo_id', me);
  const { data: aes } = await q.order('preferred', { ascending: false }).order('lender_name');

  return NextResponse.json({ aes: aes ?? [], me, seesAll });
}

// POST — add an AE connection (owned by the current LO).
export async function POST(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const lenderName = String(b.lender_name ?? '').trim();
  const aeName = String(b.ae_name ?? '').trim();
  const aeEmail = String(b.ae_email ?? '').trim();
  if (!lenderName || !aeName || !aeEmail) {
    return NextResponse.json({ error: 'lender_name, ae_name and ae_email are required' }, { status: 400 });
  }

  const sb = createAdminClient();
  const { me } = await resolveOwner(sb, userId, role);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const lenderTypes = ['wholesale', 'correspondent', 'retail', 'bank', 'credit_union'];
  const { data: ae, error } = await sb
    .from('lender_ae_connections')
    .insert({
      org_id: orgId,
      lo_id: me,
      lender_name: lenderName,
      lender_website: b.lender_website ? String(b.lender_website) : null,
      lender_type: lenderTypes.includes(String(b.lender_type)) ? String(b.lender_type) : 'wholesale',
      ae_name: aeName,
      ae_email: aeEmail,
      ae_phone: b.ae_phone ? String(b.ae_phone) : null,
      ae_cell: b.ae_cell ? String(b.ae_cell) : null,
      ae_linkedin: b.ae_linkedin ? String(b.ae_linkedin) : null,
      ae_title: b.ae_title ? String(b.ae_title) : null,
      loan_types: Array.isArray(b.loan_types) ? b.loan_types.filter((x) => typeof x === 'string') : [],
      preferred: b.preferred === true,
      notes: b.notes ? String(b.notes) : null,
    })
    .select(SELECT)
    .single();
  if (error || !ae) {
    console.error('[lender-aes POST]', error);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
  return NextResponse.json({ ae }, { status: 201 });
}
