import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  channel: z.enum(['wholesale', 'correspondent', 'direct', 'hard_money', 'private']),
  website: z.string().url().nullable().optional(),
  ae_name: z.string().max(100).nullable().optional(),
  ae_phone: z.string().max(30).nullable().optional(),
  ae_email: z.string().email().nullable().optional(),
  products: z.array(z.string()).default([]),
  licensed_states: z.array(z.string().length(2)).default([]),
  min_fico: z.number().int().min(300).max(850).nullable().optional(),
  max_ltv: z.number().min(0).max(110).nullable().optional(),
  specialty_tags: z.array(z.string()).default([]),
  avg_turnaround_days: z.number().int().min(1).max(365).nullable().optional(),
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
    .from('lenders')
    .select('*')
    .eq('org_id', org.id)
    .order('is_preferred', { ascending: false })
    .order('name');

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

  const { data, error } = await supabase
    .from('lenders')
    .insert({ ...parsed.data, org_id: org.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
