import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOrgContext } from '@/lib/auth/orgContext';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ROLES = new Set(['admin', 'branch_manager']);

const CATEGORIES = [
  'conventional', 'fha', 'va', 'usda', 'jumbo', 'dscr', 'bank_statement', '1099', 'non_qm',
  'sales', 'compliance', 'tcpa', 'respa', 'trid', 'onboarding', 'general',
];

interface GeneratedCourse {
  title: string;
  description: string;
  category: string;
  lessons: { title: string; content: string }[];
  questions: { q: string; options: string[]; correct: number }[];
}

/**
 * POST /api/training/generate — AI-author a full Udemy/Thinkific-style course
 * (modules + quiz) from a topic. Returns a DRAFT for review; the client saves it
 * through the existing /api/training/courses endpoint. Admin only.
 */
export async function POST(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  if (!ADMIN_ROLES.has(role)) return NextResponse.json({ error: 'Only admins can generate courses' }, { status: 403 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI course generation is not configured (missing ANTHROPIC_API_KEY).' }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { topic?: string; audience?: string; lessonCount?: number };
  const topic = (body.topic ?? '').trim();
  if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 });
  const lessonCount = Math.min(Math.max(Number(body.lessonCount) || 5, 3), 8);
  const audience = (body.audience ?? 'loan officers').trim();

  const system = `You are an expert mortgage-industry curriculum designer building a professional online course (Udemy/Thinkific style) for ${audience}.
Produce a complete, accurate, engaging course on the requested topic.
Rules:
- ${lessonCount} lessons, each 150-280 words of substantive teaching content (not bullet fragments). Use clear plain language.
- Lessons should build logically from fundamentals to application.
- Then 6 multiple-choice quiz questions (4 options each) testing real understanding, each with exactly one correct answer.
- Be factually correct about mortgage rules. Do NOT invent specific current rates, APRs, or guarantee outcomes.
- Pick the single best category from: ${CATEGORIES.join(', ')}.
Return ONLY valid JSON, no markdown fences, in exactly this shape:
{"title":"...","description":"one-sentence summary","category":"one_of_the_categories","lessons":[{"title":"...","content":"..."}],"questions":[{"q":"...","options":["a","b","c","d"],"correct":0}]}`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: `Create the course. Topic: "${topic}". Audience: ${audience}.` }],
    });

    const text = msg.content.find((b) => b.type === 'text');
    const raw = text && 'text' in text ? text.text : '';
    const jsonStr = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    const parsed = JSON.parse(jsonStr) as GeneratedCourse;

    // Validate + sanitize.
    const lessons = (parsed.lessons ?? [])
      .filter((l) => l?.title && l?.content)
      .map((l) => ({ title: String(l.title).slice(0, 200), content: String(l.content) }));
    const questions = (parsed.questions ?? [])
      .filter((q) => q?.q && Array.isArray(q.options) && q.options.length >= 2)
      .map((q) => ({
        q: String(q.q),
        options: q.options.map((o) => String(o)).slice(0, 6),
        correct: Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length ? q.correct : 0,
      }));

    if (!lessons.length) return NextResponse.json({ error: 'Generation returned no usable lessons. Try again.' }, { status: 502 });

    const course: GeneratedCourse = {
      title: String(parsed.title || topic).slice(0, 200),
      description: String(parsed.description || '').slice(0, 500),
      category: CATEGORIES.includes(parsed.category) ? parsed.category : 'general',
      lessons,
      questions,
    };
    return NextResponse.json({ course });
  } catch (err) {
    console.error('[training/generate] failed', err);
    return NextResponse.json({ error: 'Course generation failed. Please try again.' }, { status: 502 });
  }
}
