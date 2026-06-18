// POST /api/import/arive — pull loans from the org's Arive (LOS) connection into
// the import review queue (/inbound). Admin/branch-manager only.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { pullAriveLoans } from '@/lib/los/arivePull';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ADMIN = ['admin', 'branch_manager'];

export async function POST() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!ADMIN.includes(role)) return NextResponse.json({ error: 'Only admins can sync the LOS.' }, { status: 403 });

  try {
    const result = await pullAriveLoans(orgId);
    if (result.gated) return NextResponse.json({ error: result.reason }, { status: 501 });
    return NextResponse.json({ ok: true, staged: result.staged, seen: result.seen });
  } catch (e) {
    return NextResponse.json({ error: `Arive sync error: ${(e as Error).message}` }, { status: 500 });
  }
}
