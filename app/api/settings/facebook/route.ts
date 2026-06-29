/**
 * Facebook Lead Ads connections (admin only).
 *   GET → connected Pages (token masked) + the webhook URL / config status to paste into Meta.
 *   POST → connect/update a Page { page_id, page_name, page_access_token, lo_id?, is_active? }
 *   DELETE ?id= → disconnect a Page.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt, maskTail } from '@/lib/crypto/encrypt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN = ['admin', 'branch_manager'];

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data } = await sb
    .from('facebook_lead_connections')
    .select('id, page_id, page_name, lo_id, is_active, last_lead_at, last_error, page_access_token_enc, created_at')
    .eq('org_id', orgId).order('created_at', { ascending: false });
  const connections = (data ?? []).map((c) => {
    const { page_access_token_enc, ...rest } = c as Record<string, any>;
    return { ...rest, has_token: !!page_access_token_enc, token_hint: page_access_token_enc ? maskTail(page_access_token_enc) : null };
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return NextResponse.json({
    connections,
    webhook_url: `${base}/api/webhooks/facebook`,
    verify_token_configured: !!process.env.FACEBOOK_VERIFY_TOKEN,
    app_secret_configured: !!process.env.FACEBOOK_APP_SECRET,
  });
}

export async function POST(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!ADMIN.includes(role)) return NextResponse.json({ error: 'Only admins can connect a Facebook Page.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, any>;
  const page_id = String(b.page_id ?? '').trim();
  if (!page_id) return NextResponse.json({ error: 'page_id is required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: existing } = await sb.from('facebook_lead_connections').select('id, page_access_token_enc').eq('org_id', orgId).eq('page_id', page_id).maybeSingle();

  const tokenEnc = b.page_access_token ? encrypt(String(b.page_access_token)) : (existing?.page_access_token_enc ?? null);
  if (!tokenEnc) return NextResponse.json({ error: 'page_access_token is required' }, { status: 400 });

  const { error } = await sb.from('facebook_lead_connections').upsert({
    org_id: orgId,
    page_id,
    page_name: b.page_name ? String(b.page_name) : null,
    lo_id: b.lo_id ? String(b.lo_id) : null,
    page_access_token_enc: tokenEnc,
    is_active: b.is_active === false ? false : true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'org_id,page_id' });

  if (error) { console.error('[facebook] connection save failed', error); return NextResponse.json({ error: 'Could not save the connection.' }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!ADMIN.includes(role)) return NextResponse.json({ error: 'Only admins can disconnect a Page.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const sb = createAdminClient();
  await sb.from('facebook_lead_connections').delete().eq('id', id).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}
