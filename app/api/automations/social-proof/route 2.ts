import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';
import twilio from 'twilio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Internal server-to-server pipeline (no Clerk auth). Triggered when an NPS
// promoter score (9-10) is recorded. Generates social captions for LO review
// and sends the borrower a Google review request via SMS.
//
// org_id and lead_id are DB UUIDs (as stored on the leads row).

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface CaptionResult {
  instagram: string;
  facebook: string;
  linkedin: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { lead_id, org_id, score, response_text } = (await req.json()) as {
    lead_id: string;
    org_id: string;
    score: number;
    response_text?: string | null;
  };

  if (!lead_id || !org_id) {
    return NextResponse.json({ error: 'lead_id and org_id are required' }, { status: 400 });
  }

  const sb = createAdminClient();

  const { data: lead } = await sb
    .from('leads')
    .select('first_name, loan_purpose, phone, org_id')
    .eq('id', lead_id)
    .eq('org_id', org_id)
    .maybeSingle();

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  // Generate captions (first name only — anonymized).
  let captions: CaptionResult = { instagram: '', facebook: '', linkedin: '' };
  try {
    const aiResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Generate 3 social media captions celebrating a client's successful home closing. First name only — never full name. Warm, genuine, professional. Include 3-5 relevant hashtags per post.

Client first name: ${lead.first_name}
Loan purpose: ${lead.loan_purpose ?? 'home purchase'}
${response_text ? `Client's own words: "${response_text}"` : ''}

Return ONLY valid JSON, no markdown:
{
  "instagram": "caption text with hashtags",
  "facebook": "caption text with hashtags",
  "linkedin": "caption text with hashtags"
}`,
      }],
    });
    const block = aiResponse.content[0];
    if (block.type === 'text') captions = JSON.parse(block.text) as CaptionResult;
  } catch {
    // Proceed even if generation/parse fails — save the (empty) record rather than crash.
  }

  await sb.from('social_proof_posts').insert({
    org_id,
    lead_id,
    status: 'pending_review',
    instagram_caption: captions.instagram,
    facebook_caption: captions.facebook,
    linkedin_caption: captions.linkedin,
    trigger_source: 'nps_automation',
    nps_score: score ?? null,
  });

  // Send Google review request SMS if the org has a review URL configured.
  const { data: org } = await sb
    .from('organizations')
    .select('google_review_url')
    .eq('id', org_id)
    .maybeSingle();

  const reviewUrl = (org?.google_review_url as string | null) ?? process.env.GOOGLE_REVIEW_LINK ?? null;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (reviewUrl && lead.phone && accountSid && authToken && fromNumber) {
    try {
      const client = twilio(accountSid, authToken);
      await client.messages.create({
        body: `Hi ${lead.first_name}! Thank you so much for your kind words — it means the world to us. If you have a moment, we'd be incredibly grateful for a quick Google review: ${reviewUrl}`,
        from: fromNumber,
        to: lead.phone as string,
      });
    } catch (err) {
      console.error('[social-proof] review SMS failed:', err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ success: true });
}
