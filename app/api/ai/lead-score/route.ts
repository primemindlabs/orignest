import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

interface LeadScoreRequest {
  leadId: string;
}

function calculateScore(lead: {
  loan_amount?: number | null;
  estimated_credit_score?: number | null;
  phone?: string | null;
  email?: string | null;
  sms_consent?: boolean;
  source?: string | null;
  stage?: string;
  last_contact_at?: string | null;
  created_at?: string;
}): { score: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let score = 0;

  // Loan amount (max 40 pts)
  const amount = lead.loan_amount ?? 0;
  if (amount >= 400_000) {
    breakdown.loanAmount = 40;
  } else if (amount >= 300_000) {
    breakdown.loanAmount = 30;
  } else if (amount >= 200_000) {
    breakdown.loanAmount = 20;
  } else if (amount >= 100_000) {
    breakdown.loanAmount = 10;
  } else {
    breakdown.loanAmount = 5;
  }
  score += breakdown.loanAmount;

  // Credit score (max 20 pts)
  const credit = lead.estimated_credit_score ?? 0;
  if (credit >= 720) {
    breakdown.creditScore = 20;
  } else if (credit >= 680) {
    breakdown.creditScore = 15;
  } else if (credit >= 640) {
    breakdown.creditScore = 10;
  } else {
    breakdown.creditScore = 5;
  }
  score += breakdown.creditScore;

  // Complete contact info (10 pts)
  if (lead.phone && lead.email) {
    breakdown.contactInfo = 10;
    score += 10;
  } else {
    breakdown.contactInfo = 0;
  }

  // SMS consent (5 pts)
  if (lead.sms_consent) {
    breakdown.smsConsent = 5;
    score += 5;
  } else {
    breakdown.smsConsent = 0;
  }

  // Lead source (max 15 pts)
  const sourceMap: Record<string, number> = {
    referral: 15,
    past_client: 15,
    website: 10,
    open_house: 10,
    cold_outreach: 7,
    paid_ad: 7,
    zillow: 7,
    realtor_com: 7,
    social_media: 5,
    other: 3,
  };
  breakdown.leadSource = sourceMap[lead.source ?? 'other'] ?? 3;
  score += breakdown.leadSource;

  // Application submitted (15 pts)
  const appStages = ['application_started', 'application_complete', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close', 'closing_scheduled', 'closed'];
  if (appStages.includes(lead.stage ?? '')) {
    breakdown.applicationSubmitted = 15;
    score += 15;
  } else {
    breakdown.applicationSubmitted = 0;
  }

  // Speed of response bonus (5 pts)
  if (lead.last_contact_at && lead.created_at) {
    const responseMs = new Date(lead.last_contact_at).getTime() - new Date(lead.created_at).getTime();
    const responseMinutes = responseMs / 60000;
    if (responseMinutes <= 5) {
      breakdown.speedBonus = 5;
      score += 5;
    } else {
      breakdown.speedBonus = 0;
    }
  } else {
    breakdown.speedBonus = 0;
  }

  // Days since created without contact (penalty, max -20 pts)
  if (!lead.last_contact_at && lead.created_at) {
    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(lead.created_at).getTime()) / (24 * 60 * 60 * 1000),
    );
    const penalty = Math.min(20, daysSinceCreated * 2);
    breakdown.noContactPenalty = -penalty;
    score = Math.max(0, score - penalty);
  } else {
    breakdown.noContactPenalty = 0;
  }

  return { score: Math.min(100, Math.max(0, score)), breakdown };
}

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as LeadScoreRequest;
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

    const { data: lead, error: leadError } = await sb
      .from('leads')
      .select('id,loan_amount,estimated_credit_score,phone,email,sms_consent,source,stage,last_contact_at,created_at,first_name,last_name,ai_score')
      .eq('id', leadId)
      .eq('org_id', org.id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const { score, breakdown } = calculateScore(lead);

    // Update lead with new score
    await sb
      .from('leads')
      .update({ ai_score: score })
      .eq('id', leadId);

    // Log to activities if score changed significantly
    const previousScore = lead.ai_score ?? 0;
    if (Math.abs(score - previousScore) >= 5) {
      await sb.from('lead_activities').insert({
        lead_id: leadId,
        org_id: org.id,
        action: 'ai_score_updated',
        description: `AI score updated: ${previousScore} → ${score}`,
        metadata: { previousScore, newScore: score, breakdown, agent: 'lead_score' },
      });
    }

    await sb.from('ai_agent_runs').insert({
      org_id: org.id,
      agent_type: 'lead_score',
      status: 'completed',
      leads_processed: 1,
      actions_taken: 1,
      summary: `Scored ${lead.first_name} ${lead.last_name}: ${score}/100`,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ score, breakdown, leadId });
  } catch (err) {
    console.error('[ai/lead-score]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Scoring error' },
      { status: 500 },
    );
  }
}
