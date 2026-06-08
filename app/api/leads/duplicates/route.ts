import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { findDuplicateLeads } from '@/lib/leads/duplicates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/leads/duplicates?email=&phone=&first=&last=&excludeId=
 * Phase 1.3 — returns up to 5 possible duplicate leads for a side-by-side modal.
 */
export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const matches = await findDuplicateLeads({
    orgId,
    email: searchParams.get('email'),
    phone: searchParams.get('phone'),
    firstName: searchParams.get('first'),
    lastName: searchParams.get('last'),
    excludeId: searchParams.get('excludeId') ?? undefined,
  });

  return NextResponse.json({ duplicates: matches });
}
