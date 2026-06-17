// Phase 141 — Generate a real AI image for an ad creative. POST with the draft
// (ad_type/headline/key_message) returns a hosted URL for live preview; pass a
// creative_id to also persist it to that saved creative.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateImage, isImageGenConfigured, ImageGenNotConfigured } from '@/lib/ai/generateImage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const AD_TYPE_HINT: Record<string, string> = {
  purchase: 'happy family in front of a beautiful new home they just bought, warm and inviting',
  refinance: 'comfortable modern home interior, sense of financial relief and savings',
  fha: 'first-time homebuyers with keys to their starter home, hopeful',
  va: 'veteran family at their new home, american flag, proud and welcoming',
  heloc: 'beautiful renovated kitchen or backyard, home improvement, equity at work',
  coop: 'real estate agent and homebuyers shaking hands outside a home, partnership',
};

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!isImageGenConfigured()) {
    return NextResponse.json({ error: 'AI image generation isn’t configured yet (add FAL_KEY or REPLICATE_API_TOKEN).' }, { status: 501 });
  }

  const b = (await req.json().catch(() => ({}))) as { ad_type?: string; headline?: string; key_message?: string; creative_id?: string };
  const hint = AD_TYPE_HINT[b.ad_type ?? ''] ?? 'professional real estate and home financing marketing photo';
  const prompt = [hint, b.headline?.trim(), b.key_message?.trim()].filter(Boolean).join('. ');

  try {
    const hostedUrl = await generateImage(prompt, 'landscape');
    const img = await fetch(hostedUrl);
    if (!img.ok) throw new Error(`fetch image ${img.status}`);
    const bytes = new Uint8Array(await img.arrayBuffer());
    const mime = img.headers.get('content-type') || 'image/webp';
    const ext = mime.includes('png') ? 'png' : mime.includes('jpeg') ? 'jpg' : 'webp';
    const sb = createAdminClient();

    // Stable key per creative when saved; otherwise a per-user scratch key.
    const key = b.creative_id ? `ad-${b.creative_id}` : `ad-draft-${userId}`;
    const path = `${orgId}/${key}.${ext}`;
    const { error: upErr } = await sb.storage
      .from('content-images')
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (upErr) throw upErr;

    const { data: pub } = sb.storage.from('content-images').getPublicUrl(path);
    const url = `${pub.publicUrl}?v=${bytes.length}`;

    if (b.creative_id) {
      const { data: creative, error: dbErr } = await sb
        .from('ad_creatives')
        .update({ image_url: url })
        .eq('id', b.creative_id)
        .eq('org_id', orgId)
        .select('*')
        .maybeSingle();
      if (dbErr) throw dbErr;
      return NextResponse.json({ url, creative });
    }

    return NextResponse.json({ url });
  } catch (e) {
    if (e instanceof ImageGenNotConfigured) return NextResponse.json({ error: e.message }, { status: 501 });
    console.error('[ad-center/generate-image]', e);
    return NextResponse.json({ error: 'Image generation failed. Try regenerating.' }, { status: 502 });
  }
}
