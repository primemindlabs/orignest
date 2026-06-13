// Phase 114 — list the LO's active rate sheets (with product counts).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ sheets: [] });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ sheets: [] });

  const { data: sheets } = await sb
    .from('rate_sheets')
    .select('id, lender_name, effective_date, expiration_date, loan_types, parsed_at, is_active')
    .eq('org_id', orgId)
    .eq('lo_id', profile.id)
    .eq('is_active', true)
    .order('effective_date', { ascending: false })
    .limit(50);

  const ids = (sheets ?? []).map((s) => s.id as string);
  const countBySheet = new Map<string, number>();
  if (ids.length) {
    const { data: products } = await sb.from('rate_sheet_products').select('rate_sheet_id').in('rate_sheet_id', ids);
    for (const p of products ?? []) countBySheet.set(p.rate_sheet_id as string, (countBySheet.get(p.rate_sheet_id as string) ?? 0) + 1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const out = (sheets ?? []).map((s) => ({
    id: s.id,
    lender_name: s.lender_name,
    effective_date: s.effective_date,
    expiration_date: s.expiration_date,
    loan_types: s.loan_types ?? [],
    product_count: countBySheet.get(s.id as string) ?? 0,
    expired: !!s.expiration_date && (s.expiration_date as string) < today,
  }));

  return NextResponse.json({ sheets: out });
}
