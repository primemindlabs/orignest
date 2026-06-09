import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeRefiOpportunity } from '@/lib/relationships/refiWatch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const money = (n: number | null) => (n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n));

// Warm, deterministic anniversary narrative computed from the numbers. (A Claude
// Haiku call can replace buildNarrative without changing the surrounding flow.)
function buildNarrative(p: {
  firstName: string; years: number; city: string; purchase: number | null; avm: number | null;
  valueIncrease: number | null; equity: number | null; principalPaid: number | null; rateDelta: number | null;
}): string {
  const parts: string[] = [];
  parts.push(`${p.firstName}, I wanted to reach out on your ${p.years}-year homeownership anniversary. Owning a home is one of the most powerful ways to build lasting wealth, and you've done exactly that.`);
  if (p.avm != null && p.purchase != null) {
    parts.push(`Since you bought your home in ${p.city}, its estimated value has grown from ${money(p.purchase)} to ${money(p.avm)}${p.valueIncrease ? ` — about ${money(p.valueIncrease)} in appreciation` : ''}. Combined with the ${money(p.principalPaid)} you've paid down, you've built roughly ${money(p.equity)} in equity that's truly yours.`);
  } else {
    parts.push(`You've been steadily building equity in your home in ${p.city}, and that equity is one of your strongest financial assets.`);
  }
  if (p.rateDelta != null && p.rateDelta >= 0.5) {
    parts.push(`Rates have moved since you closed, so there may be an opportunity worth a quick look. Whenever you'd like, I'm always a call away to walk through your options — no pressure at all.`);
  } else {
    parts.push(`I'm proud to have been part of your journey, and I'm always here if you ever have questions. Congratulations again.`);
  }
  return parts.join('\n\n');
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  let body: { action?: string; reviewId?: string; narrative?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const sb = createAdminClient();

  if (body.action === 'generate') {
    const { data: rel } = await sb.from('borrower_relationships').select('id, full_name').eq('id', params.id).eq('org_id', orgId).maybeSingle();
    if (!rel) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { data: prop } = await sb.from('portfolio_properties').select('*').eq('relationship_id', params.id).eq('org_id', orgId).eq('is_active', true).order('is_primary_residence', { ascending: false }).limit(1).maybeSingle();
    if (!prop) return NextResponse.json({ error: 'No portfolio property to review yet.' }, { status: 422 });

    const year = new Date().getFullYear();
    const years = prop.purchase_date ? Math.max(1, year - new Date(prop.purchase_date).getFullYear()) : 1;
    const valueIncrease = prop.current_avm != null && prop.purchase_price != null ? Number(prop.current_avm) - Number(prop.purchase_price) : null;
    const principalPaid = prop.original_loan_amount != null && prop.current_balance != null ? Number(prop.original_loan_amount) - Number(prop.current_balance) : null;
    const currentRate = Number(process.env.CURRENT_MARKET_RATE) || 6.5;
    const refi = computeRefiOpportunity({ original_loan_amount: prop.original_loan_amount, original_rate: prop.original_rate, current_balance: prop.current_balance, purchase_date: prop.purchase_date }, currentRate);

    const narrative = buildNarrative({
      firstName: rel.full_name.split(' ')[0] || rel.full_name, years, city: prop.address_city,
      purchase: prop.purchase_price, avm: prop.current_avm, valueIncrease,
      equity: prop.estimated_equity, principalPaid, rateDelta: refi.rate_delta,
    });

    const { data, error } = await sb.from('annual_reviews').upsert({
      relationship_id: params.id, org_id: orgId, review_year: year, property_id: prop.id,
      original_purchase_price: prop.purchase_price, current_avm: prop.current_avm, value_increase: valueIncrease,
      original_balance: prop.original_loan_amount, current_balance: prop.current_balance, principal_paid: principalPaid,
      total_equity: prop.estimated_equity, original_rate: prop.original_rate, current_market_rate: currentRate,
      monthly_savings_if_refi: refi.monthly_savings || null, ai_narrative: narrative, status: 'ready',
    }, { onConflict: 'relationship_id,review_year,property_id' }).select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reviewId: data.id });
  }

  if (body.action === 'save_narrative' && body.reviewId) {
    await sb.from('annual_reviews').update({ ai_narrative: body.narrative ?? '' }).eq('id', body.reviewId).eq('org_id', orgId);
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'send' && body.reviewId) {
    const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
    await sb.from('annual_reviews').update({ status: 'sent' }).eq('id', body.reviewId).eq('org_id', orgId);
    await sb.from('annual_review_sends').insert({ review_id: body.reviewId, org_id: orgId, sent_by: profile?.id ?? null, channel: 'email' });
    await sb.from('retention_events').insert({ relationship_id: params.id, org_id: orgId, event_type: 'annual_review_sent' });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
