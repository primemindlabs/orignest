import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

interface AcceptPayload {
  orgId: string;
}

/**
 * POST /api/processor/accept
 * Accepts a pending processor invite for the calling user.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as AcceptPayload | null;
  if (!body?.orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  const sb = createAdminClient();

  const { data: assignment } = await sb
    .from('processor_assignments')
    .select('id, status')
    .eq('processor_clerk_id', userId)
    .eq('org_id', body.orgId)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: 'No pending invitation found.' }, { status: 404 });
  }

  if (assignment.status === 'active') {
    return NextResponse.json({ ok: true, message: 'Already active.' });
  }

  if (assignment.status === 'suspended') {
    return NextResponse.json({ error: 'This invitation has been revoked.' }, { status: 403 });
  }

  await sb
    .from('processor_assignments')
    .update({ status: 'active', accepted_at: new Date().toISOString() })
    .eq('id', assignment.id);

  return NextResponse.json({ ok: true });
}
