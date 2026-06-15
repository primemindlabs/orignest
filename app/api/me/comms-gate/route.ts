import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCommsGateStatus, type CommsExemptReason } from '@/lib/communications/nmlsGate';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REASONS: CommsExemptReason[] = ['depository_registered', 'commercial_only', 'other'];

// GET /api/me/comms-gate — the signed-in LO's outbound-communication gate status.
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();
  const status = await getCommsGateStatus(sb, { clerkUserId: userId, orgId });
  return NextResponse.json(status);
}

// POST /api/me/comms-gate — self-attest an NMLS exemption (or clear it).
// Body: { exempt: boolean, reason?: CommsExemptReason }
export async function POST(req: NextRequest) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  let body: { exempt?: boolean; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const exempt = !!body.exempt;
  if (exempt && !REASONS.includes(body.reason as CommsExemptReason)) {
    return NextResponse.json({ error: 'A valid exemption reason is required.' }, { status: 422 });
  }

  const sb = createAdminClient();
  const { error } = await sb
    .from('profiles')
    .update({
      comms_exempt: exempt,
      comms_exempt_reason: exempt ? body.reason : null,
      comms_exempt_at: exempt ? new Date().toISOString() : null,
    })
    .eq('clerk_user_id', userId)
    .eq('org_id', orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath('/settings/profile');
  const status = await getCommsGateStatus(sb, { clerkUserId: userId, orgId });
  return NextResponse.json(status);
}
