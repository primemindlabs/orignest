/**
 * Stage K — state disclosure library lookup.
 * GET /api/disclosures/state/[state] → active disclosures for a 2-letter state code.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { state: string } }) {
  const { userId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const state = (params.state ?? '').toUpperCase().slice(0, 2);
  if (state.length !== 2) return NextResponse.json({ disclosures: [] });

  const sb = createAdminClient();
  try {
    const { data } = await sb
      .from('state_disclosures')
      .select('id, state_code, disclosure_type, title, content, citation, effective_date')
      .eq('state_code', state)
      .eq('is_active', true)
      .order('disclosure_type');
    return NextResponse.json({ disclosures: data ?? [] });
  } catch {
    return NextResponse.json({ disclosures: [] }); // table may not be applied yet
  }
}
