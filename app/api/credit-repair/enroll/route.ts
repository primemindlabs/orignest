import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import getStripe from '@/lib/stripe';

export const dynamic = 'force-dynamic';

// LO enrolls a borrower in consumer credit repair.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { leadId, targetScore = 640 } = (await req.json()) as { leadId?: string; targetScore?: number };
  if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

  const sb = createAdminClient();

  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name, email')
    .eq('id', leadId)
    .eq('org_id', org.id)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  // Idempotent
  const { data: existing } = await sb
    .from('credit_repair_enrollments')
    .select('id')
    .eq('lead_id', leadId)
    .eq('org_id', org.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ enrollmentId: existing.id, alreadyEnrolled: true });

  // Create a Stripe customer for the borrower (best-effort).
  let stripeCustomerId: string | null = null;
  try {
    const customer = await getStripe().customers.create({
      email: lead.email ?? undefined,
      name: `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || undefined,
      metadata: { lead_id: leadId, org_id: org.id as string },
    });
    stripeCustomerId = customer.id;
  } catch (err) {
    console.error('[credit-repair/enroll] Stripe customer create failed:', err instanceof Error ? err.message : err);
  }

  const { data: enrollment, error } = await sb
    .from('credit_repair_enrollments')
    .insert({
      org_id: org.id,
      lead_id: leadId,
      target_score: targetScore,
      stripe_customer_id: stripeCustomerId,
      subscription_status: 'trial',
      trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending_upload',
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from('credit_repair_org_settings').upsert({ org_id: org.id }, { onConflict: 'org_id', ignoreDuplicates: true });

  return NextResponse.json({ enrollmentId: enrollment.id });
}
