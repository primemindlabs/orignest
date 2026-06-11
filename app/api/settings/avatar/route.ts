import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// POST /api/settings/avatar — multipart upload. Goes through the service-role
// client (the RLS-bound anon client carries no Clerk token), into the public
// `avatars` bucket at {clerkUserId}.jpg, then stores the public URL.
export async function POST(req: NextRequest) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image.' }, { status: 422 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image must be under 5 MB.' }, { status: 422 });

  const sb = createAdminClient();
  const path = `${userId}.jpg`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await sb.storage
    .from('avatars')
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Cache-bust so the new image shows immediately.
  const { data } = sb.storage.from('avatars').getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: dbErr } = await sb
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('clerk_user_id', userId)
    .eq('org_id', orgId);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  revalidatePath('/dashboard');
  revalidatePath('/settings/profile');
  return NextResponse.json({ avatar_url: publicUrl });
}
