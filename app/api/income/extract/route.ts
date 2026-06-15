/**
 * Phase 138 — upload an income document → AI-extracted figures for the calculators.
 * Multipart: { file }. Optional ?type=paystub|w2|1099|bank_statement|tax_return.
 * Claude-based (no Textract); returns 501 only when no ANTHROPIC_API_KEY.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { extractIncomeFromDoc, isIncomeExtractionConfigured, type IncomeDocType } from '@/lib/income/extractFromDoc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!isIncomeExtractionConfigured()) {
    return NextResponse.json({ error: 'AI document reading is not configured (ANTHROPIC_API_KEY).' }, { status: 501 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'Upload a PDF or image (PNG/JPG).' }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 12 MB).' }, { status: 413 });

  const hint = (new URL(req.url).searchParams.get('type') ?? undefined) as IncomeDocType | undefined;
  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');

  try {
    const result = await extractIncomeFromDoc(base64, file.type, hint);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[income/extract]', e);
    return NextResponse.json({ error: 'Could not read the document.' }, { status: 502 });
  }
}
