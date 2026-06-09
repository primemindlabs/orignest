/**
 * Phase 33.6 — real-time call coaching (Claude Haiku). The live media-stream
 * transcription pipeline (Twilio Media Streams → WS) is gated on Twilio config,
 * but the suggestion generator is functional: the UI posts the recent transcript
 * and gets one actionable suggestion. Coaching never surfaces financial or
 * compliance-specific advice.
 */
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOrgContext } from '@/lib/auth/orgContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'claude-haiku-4-5';
const TRIGGERS = ['rate', 'competitor', 'other lender', 'quicken', 'rocket', 'united wholesale', 'wait', 'think about it', 'not sure', 'expensive', 'closing costs', 'qualify', 'down payment'];

export async function POST(req: Request) {
  const { userId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { transcript?: string; trigger?: string };
  const transcript = (body.transcript ?? '').slice(-600);
  if (!transcript.trim()) return NextResponse.json({ suggestion: null });

  // Only coach when a trigger phrase is present (matches the live-stream behaviour).
  const trigger = body.trigger || TRIGGERS.find((t) => transcript.toLowerCase().includes(t));
  if (!trigger) return NextResponse.json({ suggestion: null });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `You are a real-time mortgage sales coach. A loan officer is on a live call.
Recent transcript: "${transcript}"
Trigger phrase: "${trigger}"
Give ONE brief, actionable suggestion (1-2 sentences) the LO can use right now — handling objections, building trust, moving to next steps. Do NOT mention compliance, legal, or specific financial figures. Direct advice only, no preamble.`,
      }],
    });
    const block = res.content[0];
    return NextResponse.json({ suggestion: block && block.type === 'text' ? block.text.trim() : null, trigger });
  } catch (err) {
    console.error('[coach] failed', err);
    return NextResponse.json({ suggestion: null });
  }
}
