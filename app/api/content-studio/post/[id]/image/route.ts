// Phase 139 — Generate a real AI image for a single Content Studio post.
// POST → uses the post's image_prompt (Flux via fal.ai/Replicate), stores the
// result in the public `content-images` bucket, and saves image_url on the post.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { resolveLoProfile } from '@/lib/autopilot/loContext';
import { generateImage, isImageGenConfigured, ImageGenNotConfigured } from '@/lib/ai/generateImage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CONTENT_TYPE_HINT: Record<string, string> = {
  market_insight: 'modern housing market and finance, abstract data visualization',
  quick_tip: 'friendly home-buying education, cozy home interior',
  community_education: 'welcoming neighborhood and community homes',
  anonymized_win: 'happy new homeowners celebrating outside a home, sold sign',
  behind_the_scenes: 'professional mortgage advisor at a clean modern desk',
  rate_environment: 'finance and interest rates, sleek minimal economic theme',
  aspirational: 'beautiful dream home at golden hour, warm and inviting',
};

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!isImageGenConfigured()) {
    return NextResponse.json({ error: 'AI image generation isn’t configured yet (add FAL_KEY or REPLICATE_API_TOKEN).' }, { status: 501 });
  }

  const sb = createAdminClient();
  const profile = await resolveLoProfile(sb, userId);
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: post } = await sb
    .from('content_posts')
    .select('id, content_type, image_prompt, post_text')
    .eq('id', params.id)
    .eq('lo_id', profile.id)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  const hint = CONTENT_TYPE_HINT[post.content_type as string] ?? 'professional real estate and home financing';
  const prompt = (post.image_prompt as string | null)?.trim() || hint;

  try {
    const hostedUrl = await generateImage(prompt, 'square');
    const img = await fetch(hostedUrl);
    if (!img.ok) throw new Error(`fetch image ${img.status}`);
    const bytes = new Uint8Array(await img.arrayBuffer());
    const mime = img.headers.get('content-type') || 'image/webp';
    const ext = mime.includes('png') ? 'png' : mime.includes('jpeg') ? 'jpg' : 'webp';
    const path = `${orgId}/${params.id}.${ext}`;

    const { error: upErr } = await sb.storage
      .from('content-images')
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (upErr) throw upErr;

    const { data: pub } = sb.storage.from('content-images').getPublicUrl(path);
    const imageUrl = `${pub.publicUrl}?v=${post.id.slice(0, 8)}-${bytes.length}`;

    const { data: updated, error: dbErr } = await sb
      .from('content_posts')
      .update({ image_url: imageUrl })
      .eq('id', params.id)
      .eq('lo_id', profile.id)
      .select()
      .maybeSingle();
    if (dbErr) throw dbErr;

    return NextResponse.json({ ok: true, post: updated });
  } catch (e) {
    if (e instanceof ImageGenNotConfigured) return NextResponse.json({ error: e.message }, { status: 501 });
    console.error('[content-studio/post/image]', e);
    return NextResponse.json({ error: 'Image generation failed. Try regenerating.' }, { status: 502 });
  }
}
