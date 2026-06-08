import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface HmdaPrefillRequest {
  leadId: string;
}

interface HmdaField {
  value: string | null;
  confidence: 'High' | 'Medium' | 'Needs Review';
  source: string;
}

interface HmdaAnalysis {
  action_taken: HmdaField;
  lien_status: HmdaField;
  hoepa_status: HmdaField;
  purchaser_type: HmdaField;
  denial_reason_1: HmdaField | null;
  income: HmdaField;
  age_applicant: HmdaField;
  sex: HmdaField;
  ethnicity_1: HmdaField;
  race_1: HmdaField;
  rate_spread: HmdaField | null;
}

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as HmdaPrefillRequest;
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    const sb = createAdminClient();

    const { data: org } = await sb
      .from('organizations')
      .select('id')
      .eq('clerk_org_id', orgId)
      .single();

    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

    const { data: lead } = await sb
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('org_id', org.id)
      .single();

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const loanContext = [
      `Loan purpose: ${lead.loan_purpose}`,
      `Loan type: ${lead.loan_type}`,
      `Loan amount: ${lead.loan_amount ?? 'unknown'}`,
      `Stage: ${lead.stage}`,
      `TRID status: ${lead.trid_status}`,
      `Rate locked: ${lead.rate_locked}`,
      `Locked rate: ${lead.locked_rate ?? 'N/A'}`,
      `Application date: ${lead.application_date ?? 'N/A'}`,
      `Closing date: ${lead.closing_date ?? 'N/A'}`,
      `Annual income: ${lead.annual_income ?? 'unknown'}`,
      `Property type: ${lead.property_type ?? 'unknown'}`,
      `Property state: ${lead.property_state ?? 'unknown'}`,
    ].join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1000,
      system: `You are an HMDA compliance specialist. Based on loan data, pre-fill HMDA LAR fields with your best inference.
For each field provide: value (string or null), confidence ("High", "Medium", or "Needs Review"), source (how you derived it).
IMPORTANT: For demographic fields (sex, ethnicity, race), always set confidence to "Needs Review" and value to null — these must be self-reported.
Respond ONLY with a valid JSON object. No markdown.`,
      messages: [
        {
          role: 'user',
          content: `Loan data:\n${loanContext}\n\nPre-fill these HMDA fields: action_taken, lien_status, hoepa_status, purchaser_type, denial_reason_1 (null if not denied), income, age_applicant, sex, ethnicity_1, race_1, rate_spread (null if N/A)`,
        },
      ],
    });

    const responseBlock = message.content[0];
    if (responseBlock.type !== 'text') {
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 });
    }

    let analysis: HmdaAnalysis;
    try {
      const raw = responseBlock.text.match(/\{[\s\S]*\}/)?.[0] ?? responseBlock.text;
      analysis = JSON.parse(raw) as HmdaAnalysis;
    } catch {
      return NextResponse.json({ error: 'Failed to parse HMDA analysis' }, { status: 500 });
    }

    // Build HMDA record
    const hmdaRecord = {
      lead_id: leadId,
      org_id: org.id,
      action_taken: analysis.action_taken?.value ?? null,
      action_taken_date: lead.closing_date ?? lead.application_date ?? null,
      lien_status: analysis.lien_status?.value ?? null,
      hoepa_status: analysis.hoepa_status?.value ?? null,
      purchaser_type: analysis.purchaser_type?.value ?? null,
      denial_reason_1: analysis.denial_reason_1?.value ?? null,
      income: analysis.income?.value ?? (lead.annual_income ? String(Math.round(lead.annual_income / 1000)) : null),
      age_applicant: analysis.age_applicant?.value ?? null,
      // Demographic fields — never AI-prefilled
      sex: null,
      ethnicity_1: null,
      race_1: null,
      rate_spread: analysis.rate_spread?.value ? parseFloat(analysis.rate_spread.value) : null,
      ai_prefilled: true,
      ai_prefilled_at: new Date().toISOString(),
      ai_confidence: analysis,
      manually_reviewed: false,
    };

    // Upsert HMDA data
    const { data: hmda } = await sb
      .from('hmda_data')
      .upsert(hmdaRecord, { onConflict: 'lead_id' })
      .select()
      .single();

    await sb.from('lead_activities').insert({
      lead_id: leadId,
      org_id: org.id,
      action: 'hmda_prefilled',
      description: 'AI pre-filled HMDA LAR fields',
      metadata: { agent: 'hmda_prefill', fieldsPopulated: Object.keys(analysis).length },
    });

    return NextResponse.json({ hmda, analysis });
  } catch (err) {
    console.error('[ai/hmda-prefill]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'HMDA prefill error' },
      { status: 500 },
    );
  }
}
