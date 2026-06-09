/**
 * Phase 30.2 — Competitor LE Analyzer (LO-only).
 *   GET  → latest analysis for the loan
 *   POST → analyze. Manual fee entry works today; a PDF storage_path triggers
 *          Textract auto-extract, which is GATED (501) until AWS is configured.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateComparison, extractCompetitorFeesFromText, type CompetitorFees, type OurLeSnapshot } from '@/lib/ai/competitorLe';
import { runTextract, isTextractConfigured, TextractNotConfiguredError } from '@/lib/ai/textract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb
    .from('competitor_le_uploads')
    .select('*')
    .eq('lead_id', params.loanId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ analysis: data ?? null, textractConfigured: isTextractConfigured() });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    competitorName?: string;
    competitor?: CompetitorFees;
    ourLe?: OurLeSnapshot;
    storage_path?: string;
  };

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

  let competitor: CompetitorFees = body.competitor ?? {};
  let source: 'manual' | 'pdf_extract' = 'manual';

  // PDF auto-extract path — gated on AWS Textract.
  if (body.storage_path) {
    try {
      const { rawText } = await runTextract(body.storage_path);
      competitor = await extractCompetitorFeesFromText(rawText);
      source = 'pdf_extract';
    } catch (err) {
      if (err instanceof TextractNotConfiguredError) {
        return NextResponse.json(
          { error: 'pdf_extract_unavailable', message: 'PDF auto-extraction needs AWS Textract. Enter the competitor figures manually for now.' },
          { status: 501 }
        );
      }
      console.error('[competitor-le] textract failed', err);
      return NextResponse.json({ error: 'extraction_failed' }, { status: 502 });
    }
  }

  const ourLe: OurLeSnapshot = body.ourLe ?? {};

  let analysis;
  try {
    analysis = await generateComparison({ ourLe, competitor, competitorName: body.competitorName ?? competitor.lender_name ?? 'Competitor' });
  } catch (err) {
    console.error('[competitor-le] comparison failed', err);
    return NextResponse.json({ error: 'comparison_failed' }, { status: 502 });
  }

  const { data: inserted, error } = await sb
    .from('competitor_le_uploads')
    .insert({
      lead_id: params.loanId,
      org_id: orgId,
      uploaded_by: profile?.id ?? null,
      storage_path: body.storage_path ?? null,
      source,
      competitor_name: body.competitorName ?? competitor.lender_name ?? null,
      competitor_fees: competitor,
      competitor_rate: competitor.interest_rate ?? null,
      competitor_apr: competitor.apr ?? null,
      competitor_points: competitor.points ?? null,
      competitor_total_closing_costs: competitor.total_closing_costs ?? null,
      our_le_snapshot: ourLe,
      analysis,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[competitor-le] insert failed', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  return NextResponse.json({ analysis: inserted });
}
