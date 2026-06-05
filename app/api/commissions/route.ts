import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createSchema = z.object({
  lead_id: z.string().uuid().nullable().optional(),
  lo_id: z.string().uuid(),
  loan_amount: z.number().positive(),
  close_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  loan_type: z.string().min(1).max(100),
  compensation_type: z.enum(['lender_paid', 'borrower_paid']),
  compensation_bps: z.number().min(0).max(1000).nullable().optional(),
  compensation_amount: z.number().positive(),
  referral_fee_amount: z.number().min(0).default(0),
  net_revenue: z.number().nullable().optional(),
  status: z.enum(['pending', 'paid', 'clawed_back']).default('pending'),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', orgId)
    .maybeSingle();
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('commissions')
    .select('*, leads(full_name), profiles(full_name)')
    .eq('org_id', org.id)
    .order('close_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  }

  const supabase = createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', orgId)
    .maybeSingle();
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

  // Compute net_revenue if not provided
  const net_revenue =
    parsed.data.net_revenue ??
    parsed.data.compensation_amount - (parsed.data.referral_fee_amount ?? 0);

  const { data, error } = await supabase
    .from('commissions')
    .insert({
      ...parsed.data,
      org_id: org.id,
      net_revenue,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
