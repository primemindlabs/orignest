import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function genCode(name: string): string {
  const base = (name || 'REF').replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'REF';
  // Deterministic-ish suffix without Math.random (varies by time of insert).
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  return `${base}-${suffix}`;
}

/** GET /api/buyer-referrals — list referrals for the org with referrer names. */
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('buyer_referrals')
    .select('*, referrer:referrer_lead_id(first_name, last_name)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ referrals: data ?? [] });
}

/** POST /api/buyer-referrals — record a new borrower referral. */
export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || (!body.referred_name && !body.referred_email && !body.referred_phone)) {
    return NextResponse.json({ error: 'Provide at least a name, email, or phone for the referral' }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('buyer_referrals')
    .insert({
      org_id: orgId,
      referrer_lead_id: body.referrer_lead_id || null,
      referral_code: body.referral_code?.trim() || genCode(body.referrer_name ?? body.referred_name ?? 'REF'),
      referred_name: body.referred_name || null,
      referred_email: body.referred_email || null,
      referred_phone: body.referred_phone || null,
      reward_amount: Number.isFinite(Number(body.reward_amount)) ? Number(body.reward_amount) : 0,
      notes: body.notes || null,
    })
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ referral: data }, { status: 201 });
}
