/**
 * Facebook Login callback. Exchanges the code for a long-lived user token, lists the
 * Pages the customer manages, and stores each as a connection (encrypted Page token).
 * New Pages are stored inactive (the customer enables the one(s) they want, which
 * subscribes them to leadgen); already-connected Pages get their token refreshed and
 * re-subscribed. Then redirects back to Settings → Integrations.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt } from '@/lib/crypto/encrypt';
import { exchangeCodeForLongLivedToken, listManagedPages, subscribePageToLeadgen, verifyState } from '@/lib/facebook/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const settings = new URL('/settings/integrations', req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const fbError = url.searchParams.get('error');

  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.redirect(new URL('/sign-in', req.url));
  if (!orgId) return NextResponse.redirect(new URL('/onboarding', req.url));

  if (fbError || !code) { settings.searchParams.set('facebook', 'denied'); return NextResponse.redirect(settings); }
  if (verifyState(state) !== orgId) { settings.searchParams.set('facebook', 'error'); return NextResponse.redirect(settings); }

  try {
    const userToken = await exchangeCodeForLongLivedToken(code);
    const pages = await listManagedPages(userToken);
    if (pages.length === 0) { settings.searchParams.set('facebook', 'no_pages'); return NextResponse.redirect(settings); }

    const sb = createAdminClient();
    const { data: existingRows } = await sb.from('facebook_lead_connections').select('page_id, is_active').eq('org_id', orgId);
    const activeByPage = new Map((existingRows ?? []).map((r: any) => [r.page_id, !!r.is_active]));
    const now = new Date().toISOString();

    for (const p of pages) {
      const keepActive = activeByPage.get(p.id) ?? false;
      await sb.from('facebook_lead_connections').upsert({
        org_id: orgId,
        page_id: p.id,
        page_name: p.name || null,
        page_access_token_enc: encrypt(p.access_token),
        is_active: keepActive,
        updated_at: now,
      }, { onConflict: 'org_id,page_id' });
      // Refresh the subscription for Pages that were already enabled.
      if (keepActive) await subscribePageToLeadgen(p.id, p.access_token);
    }

    settings.searchParams.set('facebook', 'pages_found');
    settings.searchParams.set('count', String(pages.length));
    return NextResponse.redirect(settings);
  } catch (e) {
    console.error('[facebook] oauth callback failed', e);
    settings.searchParams.set('facebook', 'error');
    return NextResponse.redirect(settings);
  }
}
