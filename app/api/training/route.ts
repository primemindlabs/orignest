import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyProfileId } from '@/lib/teamChat/access';
import { normalizeRole } from '@/lib/navigation/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'training-content';
const DEFAULT_CATEGORIES = ['Recorded Calls', 'Product Training', 'Compliance', 'Lender Guidelines', 'Onboarding'];

function canManage(role: string) {
  const r = normalizeRole(role);
  return r === 'admin' || r === 'branch_manager';
}

// GET — published library for the org grouped data: categories + items + my completions.
export async function GET() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // Lazy-seed default categories on first load.
  const { data: existingCats } = await sb.from('training_categories').select('id').eq('org_id', orgId).limit(1);
  if (!existingCats || existingCats.length === 0) {
    await sb.from('training_categories').insert(DEFAULT_CATEGORIES.map((name, i) => ({ org_id: orgId, name, sort_order: i })));
  }

  const [{ data: categories }, { data: items }, { data: completions }] = await Promise.all([
    sb.from('training_categories').select('id, name, icon, sort_order').eq('org_id', orgId).order('sort_order'),
    sb.from('training_items').select('id, category_id, title, description, content_type, storage_path, external_url, duration_seconds, tags, is_required, created_at, uploaded_by').eq('org_id', orgId).eq('is_published', true).order('created_at', { ascending: false }),
    sb.from('training_item_completions').select('training_item_id').eq('user_id', me),
  ]);

  return NextResponse.json({
    categories: categories ?? [],
    items: items ?? [],
    completed: (completions ?? []).map((c) => c.training_item_id as string),
    can_manage: canManage(role),
  });
}

// POST — create a training item (manager only). multipart with optional file upload, or
// an external_url (YouTube/Loom/Vimeo).
export async function POST(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!canManage(role)) return NextResponse.json({ error: 'Managers only' }, { status: 403 });

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'invalid form' }, { status: 400 });

  const title = String(form.get('title') ?? '').trim();
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
  const contentType = String(form.get('content_type') ?? 'link');
  const allowed = ['video', 'audio', 'pdf', 'link', 'recording'];
  if (!allowed.includes(contentType)) return NextResponse.json({ error: 'bad content_type' }, { status: 400 });

  // Category: existing id, or create from a typed name.
  let categoryId = (form.get('category_id') as string) || null;
  const categoryName = String(form.get('category_name') ?? '').trim();
  if (!categoryId && categoryName) {
    const { data: cat } = await sb.from('training_categories').insert({ org_id: orgId, name: categoryName }).select('id').single();
    categoryId = cat?.id ?? null;
  }

  // File upload (optional) → training-content bucket.
  let storagePath: string | null = null;
  let fileSize: number | null = null;
  const file = form.get('file');
  if (file instanceof File && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${orgId}/${Date.now()}_${safe}`;
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (upErr) { console.error('[training upload]', upErr); return NextResponse.json({ error: 'upload_failed' }, { status: 500 }); }
    storagePath = path;
    fileSize = buf.length;
  }

  const externalUrl = String(form.get('external_url') ?? '').trim() || null;
  if (!storagePath && !externalUrl) return NextResponse.json({ error: 'Provide a file or an external URL' }, { status: 400 });

  const tags = String(form.get('tags') ?? '').split(',').map((t) => t.trim()).filter(Boolean);

  const { data: item, error } = await sb
    .from('training_items')
    .insert({
      org_id: orgId,
      category_id: categoryId,
      uploaded_by: me,
      title,
      description: String(form.get('description') ?? '') || null,
      content_type: contentType,
      storage_path: storagePath,
      external_url: externalUrl,
      duration_seconds: form.get('duration_seconds') ? Number(form.get('duration_seconds')) : null,
      file_size_bytes: fileSize,
      tags,
      is_required: form.get('is_required') === 'true',
    })
    .select('id')
    .single();
  if (error || !item) {
    console.error('[training POST]', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  return NextResponse.json({ item }, { status: 201 });
}
