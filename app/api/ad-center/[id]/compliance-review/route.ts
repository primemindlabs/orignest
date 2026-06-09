/**
 * Phase 33.1 — run a compliance review on a creative (Claude Sonnet).
 * Writes an INSERT-only audit row + updates the creative's compliance_status.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { reviewAdCompliance } from '@/lib/ai/adCreative';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: creative } = await sb.from('ad_creatives').select('*').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!creative) return NextResponse.json({ error: 'Creative not found' }, { status: 404 });

  let result;
  try {
    result = await reviewAdCompliance({
      headline: creative.headline,
      primary_text: creative.primary_text,
      description: creative.description,
      ad_type: creative.ad_type,
      platform: creative.platform,
      nmls: creative.nmls_number ?? '',
    });
  } catch (err) {
    console.error('[compliance-review] failed', err);
    return NextResponse.json({ error: 'review_failed' }, { status: 502 });
  }

  // Deterministic guard: a missing NMLS# is always a critical failure.
  if (!creative.nmls_number) {
    result.passed = false;
    if (!result.issues.some((i) => i.field === 'overall' && /nmls/i.test(i.issue))) {
      result.issues.unshift({ severity: 'critical', field: 'overall', issue: 'No NMLS# present on this creative.', suggestion: 'Add the LO NMLS# before publishing.' });
    }
  }

  await sb.from('creative_compliance_reviews').insert({
    creative_id: creative.id,
    org_id: orgId,
    passed: result.passed,
    issues: result.issues,
    raw_response: result.summary,
  });
  await sb.from('ad_creatives').update({ compliance_status: result.passed ? 'approved' : 'rejected', updated_at: new Date().toISOString() }).eq('id', creative.id);

  return NextResponse.json(result);
}
