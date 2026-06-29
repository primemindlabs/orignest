/**
 * Begin Facebook Login for self-serve Lead Ads setup. Admin-only. Redirects the
 * customer to Facebook's OAuth dialog with a signed CSRF state carrying their org.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { isOAuthConfigured, getLoginUrl, signState } from '@/lib/facebook/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN = ['admin', 'branch_manager'];

export async function GET(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  const settings = new URL('/settings/integrations', req.url);
  if (!userId) return NextResponse.redirect(new URL('/sign-in', req.url));
  if (!orgId || !ADMIN.includes(role)) { settings.searchParams.set('facebook', 'forbidden'); return NextResponse.redirect(settings); }
  if (!isOAuthConfigured()) { settings.searchParams.set('facebook', 'not_configured'); return NextResponse.redirect(settings); }

  return NextResponse.redirect(getLoginUrl(signState(orgId)));
}
