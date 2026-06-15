/**
 * Phase 138 — contact lookup for the dialpad. Lets the LO search any lead/contact
 * by name or phone and call them directly (logging the call against that lead),
 * instead of only typing a raw number.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ contacts: [] });

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();

  const sb = createAdminClient();
  let query = sb
    .from('leads')
    .select('id, first_name, last_name, phone, stage')
    .eq('org_id', orgId)
    .not('phone', 'is', null)
    .is('archived_at', null);

  if (q) {
    const safe = q.replace(/[%,()]/g, ' ');
    query = query.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }

  const { data } = await query.order('last_contacted_at', { ascending: false, nullsFirst: false }).limit(25);

  const contacts = (data ?? []).map((l) => ({
    id: l.id as string,
    name: `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || 'Lead',
    phone: l.phone as string,
    stage: l.stage as string,
  }));
  return NextResponse.json({ contacts });
}
