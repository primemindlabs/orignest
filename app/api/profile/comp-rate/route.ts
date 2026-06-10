/** Phase 74 — persist the LO's commission rate (on their profile). */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request) {
  const { userId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { rate?: number };
  const rate = Number(b.rate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 5) return NextResponse.json({ error: 'rate must be 0–5' }, { status: 400 });
  const sb = createAdminClient();
  await sb.from('profiles').update({ comp_rate: rate }).eq('clerk_user_id', userId);
  return NextResponse.json({ ok: true });
}
