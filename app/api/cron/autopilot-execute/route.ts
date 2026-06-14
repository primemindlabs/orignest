// Phase 128 — executor sweep. Sends every approved Autopilot action whose 5-minute
// undo window has passed. Runs frequently so sends stay timely.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { executeApprovedDue } from '@/lib/autopilot/executeAction';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();
  const executed = await executeApprovedDue(sb);
  return NextResponse.json({ executed });
}

export const GET = POST;
