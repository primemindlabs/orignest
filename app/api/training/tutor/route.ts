/**
 * Phase 138 — friendly AI tutor for the education suite. Answers a learner's
 * question about the current lesson in a warm, encouraging, plain-English voice
 * (Claude Haiku). Makes lessons an interactive experience, not just text to read.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SYSTEM = `You are Ashley, a warm, encouraging mortgage-training tutor. A loan officer is working through a lesson and asked a question.
- Answer in plain, friendly English — like a great coach, not a textbook.
- Ground your answer in the lesson content provided; you may add helpful real-world context.
- Keep it tight (under 180 words), use a short example if it helps, and end with a one-line encouragement.
- If the question is outside the lesson, gently steer back and still help.`;

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { lessonTitle?: string; lessonContent?: string; question?: string };
  const question = (b.question ?? '').trim();
  if (!question) return NextResponse.json({ error: 'Ask a question.' }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ answer: 'The AI tutor isn’t configured yet — but here’s a tip: re-read the lesson’s key points and jot down what’s unclear, then ask your trainer. You’ve got this!' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Lesson: ${b.lessonTitle ?? 'Untitled'}\n\nLesson content:\n${(b.lessonContent ?? '').slice(0, 4000)}\n\nLearner's question: ${question}`,
      }],
    });
    const block = msg.content.find((x) => x.type === 'text');
    return NextResponse.json({ answer: block && block.type === 'text' ? block.text : 'Let’s try that again in a moment.' });
  } catch (e) {
    console.error('[training/tutor]', e);
    return NextResponse.json({ error: 'The tutor is taking a breather — try again in a moment.' }, { status: 502 });
  }
}
