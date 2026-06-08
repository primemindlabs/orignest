import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';
import { callSoftPullSolutions, type SoftPullResponse, type BorrowerPullInfo } from '@/lib/credit-repair/softpull';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PII: SSN and DOB are passed to the SPS API only — never persisted to the DB.
// Do NOT log the request body.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ANALYZE_PROMPT = `You are an expert credit analyst and mortgage advisor. Analyze this structured credit report data and identify all disputable items.

Credit report data: {REPORT_DATA}

Return a JSON object:
{
  "tradelines": [
    {
      "creditor_name": string,
      "account_number_last4": string | null,
      "account_type": "credit_card" | "auto_loan" | "mortgage" | "collection" | "medical" | "student_loan" | "personal_loan" | "other",
      "bureau": "experian" | "equifax" | "transunion" | "all_three",
      "balance": number | null,
      "credit_limit": number | null,
      "open_date": "YYYY-MM-DD" | null,
      "close_date": "YYYY-MM-DD" | null,
      "status": "open" | "closed" | "charged_off" | "in_collections" | "settled",
      "payment_status": "current" | "30_days_late" | "60_days_late" | "90_days_late" | "120_plus_days_late" | "charge_off" | "collection",
      "negative_remarks": string[],
      "is_disputable": boolean,
      "dispute_reason": string | null,
      "estimated_score_gain": number | null,
      "dispute_priority": number
    }
  ],
  "summary": {
    "total_negative_items": number,
    "disputable_items": number,
    "estimated_total_score_gain": number,
    "mortgage_blocking_items": string[],
    "priority_actions": string[]
  }
}

Rules:
- dispute_priority: 1 = highest mortgage impact (recent collections, charge-offs), 10 = lowest
- estimated_score_gain: be conservative (10-50 points per item)
- is_disputable: true for inaccurate, unverifiable, or outdated (7-year) items only
- Do NOT flag accurate, current negative items as disputable
Return only valid JSON, no markdown.`;

export async function POST(req: NextRequest, { params }: { params: { token: string } }): Promise<NextResponse> {
  const sb = createAdminClient();

  const { data: pt } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id')
    .eq('token', params.token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: 'Invalid token' }, { status: 403 });

  const { data: enrollment } = await sb
    .from('credit_repair_enrollments')
    .select('id, croa_disclosure_signed_at')
    .eq('lead_id', pt.lead_id)
    .eq('org_id', pt.org_id)
    .maybeSingle();
  if (!enrollment) return NextResponse.json({ error: 'Not enrolled' }, { status: 404 });
  if (!enrollment.croa_disclosure_signed_at) return NextResponse.json({ error: 'CROA disclosure not signed' }, { status: 403 });

  const body = (await req.json()) as BorrowerPullInfo;

  // Determine cycle number from existing pulls
  const { count: priorPulls } = await sb
    .from('credit_report_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('enrollment_id', enrollment.id);
  const cycleNumber = (priorPulls ?? 0) + 1;

  await sb.from('credit_repair_enrollments').update({ status: 'analyzing' }).eq('id', enrollment.id);

  const { data: uploadRecord } = await sb
    .from('credit_report_uploads')
    .insert({
      enrollment_id: enrollment.id,
      org_id: pt.org_id,
      lead_id: pt.lead_id,
      storage_path: `soft-pull/${enrollment.id}/${Date.now()}`,
      source_bureau: 'tri_merge',
      cycle_number: cycleNumber,
      parse_status: 'parsing',
    })
    .select('id')
    .single();

  const uploadId = uploadRecord!.id as string;

  // Soft pull (mock unless SOFT_PULL_API_KEY is a real key)
  let spsData: SoftPullResponse;
  try {
    spsData = await callSoftPullSolutions(body);
    if (spsData.ErrorCode) {
      await sb.from('credit_report_uploads').update({ parse_status: 'failed', parse_error: spsData.ErrorMessage }).eq('id', uploadId);
      await sb.from('credit_repair_enrollments').update({ status: cycleNumber === 1 ? 'pending_upload' : 'active' }).eq('id', enrollment.id);
      return NextResponse.json({ error: spsData.ErrorMessage ?? 'Credit pull failed' }, { status: 400 });
    }
  } catch {
    await sb.from('credit_report_uploads').update({ parse_status: 'failed', parse_error: 'SPS request failed' }).eq('id', uploadId);
    await sb.from('credit_repair_enrollments').update({ status: cycleNumber === 1 ? 'pending_upload' : 'active' }).eq('id', enrollment.id);
    return NextResponse.json({ error: 'Credit pull service unavailable' }, { status: 503 });
  }

  // Analyze with Claude
  interface Analysis { tradelines: Record<string, any>[]; summary: Record<string, unknown> }
  let analysis: Analysis;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: ANALYZE_PROMPT.replace('{REPORT_DATA}', JSON.stringify(spsData.Tradelines)) }],
    });
    const block = response.content[0];
    analysis = JSON.parse(block.type === 'text' ? block.text : '{}') as Analysis;
  } catch {
    await sb.from('credit_report_uploads').update({ parse_status: 'failed', parse_error: 'analysis failed' }).eq('id', uploadId);
    await sb.from('credit_repair_enrollments').update({ status: cycleNumber === 1 ? 'pending_upload' : 'active' }).eq('id', enrollment.id);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }

  const scores = spsData.Scores;
  await sb.from('credit_report_uploads').update({
    parse_status: 'parsed',
    score_exp: scores.Experian ?? null,
    score_eqx: scores.Equifax ?? null,
    score_tu: scores.TransUnion ?? null,
    report_date: spsData.ReportDate ?? null,
    ai_analysis: analysis,
  }).eq('id', uploadId);

  const present = [scores.Experian, scores.Equifax, scores.TransUnion].filter((s): s is number => typeof s === 'number');
  const avgScore = present.length ? Math.round(present.reduce((a, b) => a + b, 0) / present.length) : null;

  // Pull existing history to append (don't clobber on re-pulls)
  const { data: enr } = await sb.from('credit_repair_enrollments').select('score_history, starting_score_exp').eq('id', enrollment.id).single();
  const history: unknown[] = Array.isArray(enr?.score_history) ? (enr!.score_history as unknown[]) : [];
  history.push({ date: new Date().toISOString().split('T')[0], exp: scores.Experian, eqx: scores.Equifax, tu: scores.TransUnion, avg: avgScore, source: 'soft_pull' });

  const isFirstPull = cycleNumber === 1 || enr?.starting_score_exp == null;
  await sb.from('credit_repair_enrollments').update({
    ...(isFirstPull ? {
      starting_score_exp: scores.Experian ?? null,
      starting_score_eqx: scores.Equifax ?? null,
      starting_score_tu: scores.TransUnion ?? null,
    } : {}),
    current_score_exp: scores.Experian ?? null,
    current_score_eqx: scores.Equifax ?? null,
    current_score_tu: scores.TransUnion ?? null,
    score_history: history,
    status: 'active',
  }).eq('id', enrollment.id);

  // Insert tradelines for this cycle
  if (Array.isArray(analysis.tradelines) && analysis.tradelines.length > 0) {
    await sb.from('credit_tradelines').insert(
      analysis.tradelines.map((t) => ({
        enrollment_id: enrollment.id,
        report_upload_id: uploadId,
        org_id: pt.org_id,
        creditor_name: t.creditor_name,
        account_number: t.account_number_last4 ?? null,
        account_type: t.account_type ?? null,
        bureau: t.bureau,
        balance: t.balance ?? null,
        credit_limit: t.credit_limit ?? null,
        open_date: t.open_date ?? null,
        close_date: t.close_date ?? null,
        status: t.status ?? null,
        payment_status: t.payment_status ?? null,
        negative_remarks: t.negative_remarks ?? [],
        is_disputable: !!t.is_disputable,
        dispute_reason: t.dispute_reason ?? null,
        dispute_priority: t.dispute_priority ?? 5,
        estimated_score_gain: t.estimated_score_gain ?? null,
        dispute_status: 'identified',
      }))
    );
  }

  return NextResponse.json({ success: true, uploadId, cycleNumber, summary: analysis.summary, scores: spsData.Scores });
}
