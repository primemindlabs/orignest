import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  channel: z.enum(['wholesale', 'correspondent', 'direct', 'hard_money', 'private']).optional(),
  website: z.string().url().nullable().optional(),
  ae_name: z.string().max(100).nullable().optional(),
  ae_phone: z.string().max(30).nullable().optional(),
  ae_email: z.string().email().nullable().optional(),
  products: z.array(z.string()).optional(),
  licensed_states: z.array(z.string().length(2)).optional(),
  min_fico: z.number().int().min(300).max(850).nullable().optional(),
  max_ltv: z.number().min(0).max(110).nullable().optional(),
  specialty_tags: z.array(z.string()).optional(),
  avg_turnaround_days: z.number().int().min(1).max(365).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  is_preferred: z.boolean().optional(),
  loans_submitted: z.number().int().min(0).optional(),
  loans_closed: z.number().int().min(0).optional(),
  avg_days_to_close: z.number().int().min(0).nullable().optional(),
}).strict();

async function getOrgId(orgClerkId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', orgClerkId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dbOrgId = await getOrgId(orgId);
  if (!dbOrgId) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('lenders')
    .select('*, lender_products(*)')
    .eq('id', params.id)
    .eq('org_id', dbOrgId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  }

  const dbOrgId = await getOrgId(orgId);
  if (!dbOrgId) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('lenders')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('org_id', dbOrgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dbOrgId = await getOrgId(orgId);
  if (!dbOrgId) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

  const supabase = createClient();
  const { error } = await supabase
    .from('lenders')
    .delete()
    .eq('id', params.id)
    .eq('org_id', dbOrgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
