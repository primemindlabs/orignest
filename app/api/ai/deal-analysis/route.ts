import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface DealAnalysisRequest {
  leadId: string;
}

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as DealAnalysisRequest;
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    const sb = createAdminClient();

    // Get org UUID
    const { data: org } = await sb
      .from('organizations')
      .select('id')
      .eq('clerk_org_id', orgId)
      .single();

    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

    // Load full lead
    const { data: lead, error: leadError } = await sb
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('org_id', org.id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Build loan scenario for Claude
    const loanScenario = [
      `Borrower: ${lead.first_name} ${lead.last_name}`,
      `Loan purpose: ${lead.loan_purpose}`,
      `Loan type: ${lead.loan_type}`,
      `Loan amount: ${lead.loan_amount ? `$${lead.loan_amount.toLocaleString()}` : 'Not specified'}`,
      `Property type: ${lead.property_type ?? 'Not specified'}`,
      `Property state: ${lead.property_state ?? 'Not specified'}`,
      `Estimated credit score: ${lead.estimated_credit_score ?? 'Not specified'}`,
      `Employment status: ${lead.employment_status ?? 'Not specified'}`,
      `Annual income: ${lead.annual_income ? `$${lead.annual_income.toLocaleString()}` : 'Not specified'}`,
      `Current pipeline stage: ${lead.stage}`,
      `TRID status: ${lead.trid_status}`,
      `Lead source: ${lead.source}`,
      `Days in current stage: ${lead.days_in_stage}`,
    ].join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1200,
      system: `You are a senior mortgage underwriter and deal strategist. Analyze this loan scenario and respond with a JSON object containing exactly these keys:
{
  "approvalLikelihood": "High|Medium|Low",
  "approvalConfidence": <number 0-100>,
  "topIssues": ["issue1", "issue2", "issue3"],
  "recommendedProduct": "conventional|fha|va|usda|jumbo|non_qm",
  "productRationale": "brief explanation",
  "talkingPoints": ["point1", "point2", "point3"],
  "redFlags": ["flag1", "flag2"],
  "summary": "2-3 sentence overall assessment"
}
Respond ONLY with valid JSON. No markdown, no code blocks.`,
      messages: [{ role: 'user', content: loanScenario }],
    });

    const responseBlock = message.content[0];
    if (responseBlock.type !== 'text') {
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 });
    }

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(responseBlock.text) as Record<string, unknown>;
    } catch {
      // Try to extract JSON from response
      const match = responseBlock.text.match(/\{[\s\S]*\}/);
      if (!match) {
        return NextResponse.json({ error: 'Failed to parse AI analysis' }, { status: 500 });
      }
      analysis = JSON.parse(match[0]) as Record<string, unknown>;
    }

    // Log to lead_activities
    await sb.from('lead_activities').insert({
      lead_id: leadId,
      org_id: org.id,
      action: 'ai_deal_analysis',
      description: `AI deal analysis: ${analysis.approvalLikelihood} likelihood (${analysis.approvalConfidence}% confidence)`,
      metadata: { analysis, agent: 'deal_analysis' },
    });

    // Log agent run
    await sb.from('ai_agent_runs').insert({
      org_id: org.id,
      agent_type: 'deal_analysis',
      status: 'completed',
      leads_processed: 1,
      actions_taken: 1,
      summary: `Deal analysis for ${lead.first_name} ${lead.last_name}: ${analysis.approvalLikelihood} likelihood`,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ analysis, leadId });
  } catch (err) {
    console.error('[ai/deal-analysis]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI service error' },
      { status: 500 },
    );
  }
}
