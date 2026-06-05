import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const noteSchema = z.object({
  note: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  }

  const supabase = createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', orgId)
    .maybeSingle();
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  // Verify lender belongs to this org
  const { data: lender } = await supabase
    .from('lenders')
    .select('id')
    .eq('id', params.id)
    .eq('org_id', org.id)
    .maybeSingle();
  if (!lender) return NextResponse.json({ error: 'Lender not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('lender_comm_log')
    .insert({
      lender_id: params.id,
      org_id: org.id,
      author_id: profile?.id ?? null,
      note: parsed.data.note,
    })
    .select('*, profiles(full_name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
