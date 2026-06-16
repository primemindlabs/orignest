import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { parseZillowHtml, isUsableListing, ZILLOW_FETCH_HEADERS } from '@/lib/listings/parseZillow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/listings/import — parse a Zillow listing URL server-side (no CORS).
 * Tries JSON-LD then __NEXT_DATA__ (see lib/listings/parseZillow). Zillow bot-
 * blocks scrapers, so when the fetch is refused or the page can't be parsed we
 * degrade gracefully to manual entry — never throw to the user (Phase 28.5).
 */
export async function POST(req: NextRequest) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  let body: { zillow_url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ fallback: true, reason: 'Invalid request.' }); }
  const url = (body.zillow_url ?? '').trim();
  if (!/^https?:\/\/(www\.)?zillow\.com\//i.test(url)) {
    return NextResponse.json({ fallback: true, reason: 'Enter a valid Zillow listing URL.' });
  }

  try {
    const res = await fetch(url, { headers: ZILLOW_FETCH_HEADERS, redirect: 'follow' });
    if (!res.ok) {
      const blocked = res.status === 403 || res.status === 429;
      return NextResponse.json({
        fallback: true,
        reason: blocked
          ? 'Zillow blocked the automatic lookup — please enter listing details manually.'
          : 'Auto-import unavailable — please enter listing details manually.',
      });
    }

    const html = await res.text();
    const listing = parseZillowHtml(html, url);
    if (!isUsableListing(listing)) {
      return NextResponse.json({ fallback: true, reason: 'Auto-import unavailable — please enter listing details manually.' });
    }

    return NextResponse.json({ fallback: false, listing });
  } catch {
    return NextResponse.json({ fallback: true, reason: 'Auto-import unavailable — please enter listing details manually.' });
  }
}
