/**
 * Phase 33.2 — daily Meta/Google ad-stats sync (cron-callable, Bearer CRON_SECRET).
 *
 * GATED: Meta Marketing API / Google Ads API OAuth is not configured
 * (META_APP_ID/SECRET, GOOGLE_ADS_* absent). With no active connections this
 * returns 501 — no fake stats are written. When OAuth is wired, iterate active
 * ad_platform_connections, fetch insights, and upsert ad_campaign_stats.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function configured(): boolean {
  return Boolean((process.env.META_APP_ID && process.env.META_APP_SECRET) || (process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_DEVELOPER_TOKEN));
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!configured()) {
    return NextResponse.json(
      { error: 'ad_sync_unavailable', message: 'Meta/Google Ads OAuth is not configured. Set META_APP_ID/SECRET or GOOGLE_ADS_* to enable daily stats sync.' },
      { status: 501 }
    );
  }

  const sb = createAdminClient();
  const { data: connections } = await sb.from('ad_platform_connections').select('id, org_id, platform, account_id').eq('is_active', true);
  if (!connections || connections.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, message: 'No active ad platform connections.' });
  }

  // TODO(oauth): per connection, call the Meta Insights / Google Ads API and
  // upsert rows into ad_campaign_stats. Requires partner-approved API access.
  return NextResponse.json({ ok: true, synced: 0, note: 'Connections present; live API fetch pending OAuth partner approval.' });
}
