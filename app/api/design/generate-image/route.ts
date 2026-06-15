/**
 * Phase 138 — Design Studio AI image generation. POST { prompt, aspect } → { url }.
 * fal.ai (FAL_KEY) or Replicate (REPLICATE_API_TOKEN); 501 if neither is set.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { generateImage, isImageGenConfigured, ImageGenNotConfigured } from '@/lib/ai/generateImage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!isImageGenConfigured()) {
    return NextResponse.json({ error: 'AI image generation isn’t configured yet (add FAL_KEY or REPLICATE_API_TOKEN).' }, { status: 501 });
  }

  const b = (await req.json().catch(() => ({}))) as { prompt?: string; aspect?: 'square' | 'story' | 'landscape' | 'portrait' };
  const prompt = (b.prompt ?? '').trim();
  if (!prompt) return NextResponse.json({ error: 'Describe the image you want.' }, { status: 400 });

  try {
    const url = await generateImage(prompt, b.aspect ?? 'square');
    // Inline as a data URL so the canvas PNG export isn't CORS-tainted.
    try {
      const img = await fetch(url);
      const buf = Buffer.from(await img.arrayBuffer());
      const mime = img.headers.get('content-type') || 'image/png';
      return NextResponse.json({ url: `data:${mime};base64,${buf.toString('base64')}` });
    } catch {
      return NextResponse.json({ url }); // fall back to the hosted URL
    }
  } catch (e) {
    if (e instanceof ImageGenNotConfigured) return NextResponse.json({ error: e.message }, { status: 501 });
    console.error('[design/generate-image]', e);
    return NextResponse.json({ error: 'Image generation failed. Try a simpler prompt.' }, { status: 502 });
  }
}
