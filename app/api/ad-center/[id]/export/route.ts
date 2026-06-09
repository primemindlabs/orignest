/**
 * Phase 33.1 — export a creative as clipboard-ready text.
 * HARD GATE: export fails if NMLS# is missing. Appends Equal Housing + required
 * disclosures (VA disclaimer for VA ads).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: c } = await sb.from('ad_creatives').select('*').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!c) return NextResponse.json({ error: 'Creative not found' }, { status: 404 });

  if (!c.nmls_number) {
    return NextResponse.json({ error: 'NMLS# is required to export a mortgage ad.', code: 'nmls_required' }, { status: 400 });
  }

  const disclosures: string[] = [`NMLS# ${c.nmls_number}`];
  if (c.equal_housing_included) disclosures.push('Equal Housing Lender');
  if (c.ad_type === 'va') disclosures.push('Not endorsed by the Department of Veterans Affairs.');
  if (c.apr_disclosure) disclosures.push(c.apr_disclosure);
  disclosures.push('Not a commitment to lend. Subject to credit approval.');

  const text = [c.headline, '', c.primary_text ?? '', c.description ?? '', '', disclosures.join(' · ')].filter((l) => l !== undefined).join('\n').trim();

  await sb.from('ad_creatives').update({ export_count: (c.export_count ?? 0) + 1, updated_at: new Date().toISOString() }).eq('id', c.id);

  return NextResponse.json({ export_text: text, cta: c.cta_type, platform: c.platform });
}
