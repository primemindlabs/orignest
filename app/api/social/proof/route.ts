import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const VALID_STATUS = ['pending_review', 'approved', 'scheduled', 'published', 'rejected'];

// GET — pending-review social-proof posts for the org.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'pending_review';

  const { data, error } = await sb
    .from('social_proof_posts')
    .select('*, leads(first_name)')
    .eq('org_id', org.id)
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}

// POST — update status and/or edit captions.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    id: string;
    status?: string;
    instagram_caption?: string;
    facebook_caption?: string;
    linkedin_caption?: string;
  };

  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (body.status && !VALID_STATUS.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (body.status) patch.status = body.status;
  if (body.instagram_caption !== undefined) patch.instagram_caption = body.instagram_caption;
  if (body.facebook_caption !== undefined) patch.facebook_caption = body.facebook_caption;
  if (body.linkedin_caption !== undefined) patch.linkedin_caption = body.linkedin_caption;
  if (body.status === 'published') patch.published_at = new Date().toISOString();

  const { error } = await sb
    .from('social_proof_posts')
    .update(patch)
    .eq('id', body.id)
    .eq('org_id', org.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
