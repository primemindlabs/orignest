// Phase 131 — weekly Freddie Mac PMMS refresh (Thursdays, when PMMS publishes).
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { updateMarketRates } from '@/lib/goldmine/marketRates';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = createAdminClient();
  const result = await updateMarketRates(sb);
  return NextResponse.json(result);
}

export const GET = POST;
