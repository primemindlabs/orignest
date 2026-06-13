// Phase 121 — referral partners: list (with heat) + add. Org-scoped.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { computePartnerHeat } from '@/lib/referralPartners/heat';

export const dynamic = 'force-dynamic';

const TYPES = ['realtor', 'builder', 'cpa', 'attorney', 'financial_advisor', 'insurance_agent', 'other'];

export async function GET(_req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ partners: [] });

  const sb = createAdminClient();
  const { data: partners } = await sb
    .from('referral_partners')
    .select('*')
    .eq('org_id', orgId)
    .order('total_volume', { ascending: false });

  // Referral momentum: counts in the last 180 days, split at 90.
  const ids = (partners ?? []).map((p) => p.id);
  const counts = new Map<string, { d90: number; d180: number }>();
  if (ids.length) {
    const since = new Date(Date.now() - 180 * 86_400_000).toISOString();
    const { data: refs } = await sb
      .from('partner_referrals')
      .select('partner_id, created_at')
      .eq('org_id', orgId)
      .in('partner_id', ids)
      .gte('created_at', since);
    const cut90 = Date.now() - 90 * 86_400_000;
    for (const r of refs ?? []) {
      const e = counts.get(r.partner_id as string) ?? { d90: 0, d180: 0 };
      e.d180 += 1;
      if (new Date(r.created_at as string).getTime() >= cut90) e.d90 += 1;
      counts.set(r.partner_id as string, e);
    }
  }

  const withHeat = (partners ?? []).map((p) => {
    const c = counts.get(p.id as string) ?? { d90: 0, d180: 0 };
    const heat = computePartnerHeat({ referrals_90d: c.d90, referrals_180d: c.d180, last_outreach_at: (p.last_outreach_at as string) ?? null });
    return { ...p, referrals_90d: c.d90, heat_score: heat.score, heat_band: heat.band };
  });

  return NextResponse.json({ partners: withHeat });
}

export async function POST(request: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const type = (b.type ?? 'other').toString();
  if (!TYPES.includes(type)) return NextResponse.json({ error: 'Invalid partner type' }, { status: 400 });
  const first = (b.first_name ?? '').toString().trim();
  const last = (b.last_name ?? '').toString().trim();
  const email = (b.email ?? '').toString().trim();
  if (!first || !last || !email) return NextResponse.json({ error: 'first_name, last_name and email are required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data, error } = await sb
    .from('referral_partners')
    .insert({
      org_id: orgId,
      added_by: profile.id,
      type,
      company_name: (b.company_name ?? '').toString().trim() || '—',
      first_name: first,
      last_name: last,
      email,
      phone: b.phone ? b.phone.toString().trim() : null,
      specialty: b.specialty ? b.specialty.toString().trim() : null,
      license_number: b.license_number ? b.license_number.toString().trim() : null,
      website: b.website ? b.website.toString().trim() : null,
      notes: b.notes ? b.notes.toString().slice(0, 2000) : null,
    })
    .select('id, referral_code')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id, referral_code: data.referral_code }, { status: 201 });
}
