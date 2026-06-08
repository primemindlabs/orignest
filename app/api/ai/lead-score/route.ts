import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface LeadScoreRequest {
  leadId: string;
}

export interface ScoreFactor {
  factor: string;
  label: string;
  contribution: number;
}

// Deterministic 0–100 lead score. Deterministic (not LLM) on purpose: scoring must
// be consistent, explainable, and free to recompute nightly. Column names match the
// real `leads` schema (credit_score / lead_source / last_contacted_at).
function calculateScore(lead: {
  loan_amount?: number | null;
  credit_score?: number | null;
  phone?: string | null;
  email?: string | null;
  sms_consent?: boolean | null;
  lead_source?: string | null;
  stage?: string | null;
  last_contacted_at?: string | null;
  created_at?: string;
}): { score: number; factors: ScoreFactor[] } {
  const factors: ScoreFactor[] = [];
  let score = 0;
  const add = (factor: string, label: string, contribution: number) => {
    factors.push({ factor, label, contribution });
    score += contribution;
  };

  // Loan amount (max 40)
  const amount = lead.loan_amount ?? 0;
  const loanPts = amount >= 400_000 ? 40 : amount >= 300_000 ? 30 : amount >= 200_000 ? 20 : amount >= 100_000 ? 10 : 5;
  add('loan_amount', 'Loan amount', loanPts);

  // Credit score (max 20)
  const credit = lead.credit_score ?? 0;
  const creditPts = credit >= 720 ? 20 : credit >= 680 ? 15 : credit >= 640 ? 10 : credit > 0 ? 5 : 0;
  add('credit_score', 'Credit tier', creditPts);

  // Complete contact info (10)
  add('contact_info', 'Phone + email on file', lead.phone && lead.email ? 10 : 0);

  // SMS consent (5)
  add('sms_consent', 'SMS consent', lead.sms_consent ? 5 : 0);

  // Lead source (max 15)
  const sourceMap: Record<string, number> = {
    referral: 15, past_client: 15, website: 10, open_house: 10,
    cold_outreach: 7, paid_ad: 7, zillow: 7, realtor_com: 7, social_media: 5, other: 3,
  };
  add('lead_source', 'Lead source', sourceMap[lead.lead_source ?? 'other'] ?? 3);

  // Application submitted (15) — real lead stages
  const appStages = ['application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close', 'closed'];
  add('application', 'Application submitted', appStages.includes(lead.stage ?? '') ? 15 : 0);

  // Speed-to-contact bonus (5)
  if (lead.last_contacted_at && lead.created_at) {
    const minutes = (new Date(lead.last_contacted_at).getTime() - new Date(lead.created_at).getTime()) / 60000;
    add('speed_bonus', 'Fast first contact', minutes <= 5 ? 5 : 0);
  } else {
    add('speed_bonus', 'Fast first contact', 0);
  }

  // No-contact decay penalty (max -20)
  if (!lead.last_contacted_at && lead.created_at) {
    const days = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86_400_000);
    add('no_contact_penalty', 'No contact yet', -Math.min(20, days * 2));
  }

  return { score: Math.min(100, Math.max(0, score)), factors };
}

const LEAD_COLUMNS =
  'id,loan_amount,credit_score,phone,email,sms_consent,lead_source,stage,last_contacted_at,created_at,first_name,last_name,ai_score';

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await getOrgContext();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

    const { leadId } = (await req.json()) as LeadScoreRequest;
    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });

    const sb = createAdminClient();

    const { data: lead, error: leadError } = await sb
      .from('leads')
      .select(LEAD_COLUMNS)
      .eq('id', leadId)
      .eq('org_id', orgId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const { score, factors } = calculateScore(lead);
    const now = new Date().toISOString();

    await sb
      .from('leads')
      .update({ ai_score: score, ai_score_updated_at: now, ai_score_factors: factors })
      .eq('id', leadId)
      .eq('org_id', orgId);

    const previousScore = (lead.ai_score as number | null) ?? 0;
    if (Math.abs(score - previousScore) >= 5) {
      await sb.from('lead_activities').insert({
        lead_id: leadId,
        org_id: orgId,
        action: 'ai_score_updated',
        description: `AI score updated: ${previousScore} → ${score}`,
        metadata: { previousScore, newScore: score, factors, agent: 'lead_score' },
      });
    }

    await sb.from('ai_agent_runs').insert({
      org_id: orgId,
      agent_type: 'lead_score',
      status: 'completed',
      leads_processed: 1,
      actions_taken: 1,
      summary: `Scored ${lead.first_name} ${lead.last_name}: ${score}/100`,
      completed_at: now,
    });

    return NextResponse.json({ score, factors, leadId });
  } catch (err) {
    console.error('[ai/lead-score]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Scoring error' },
      { status: 500 },
    );
  }
}
