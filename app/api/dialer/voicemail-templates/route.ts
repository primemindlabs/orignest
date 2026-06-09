/**
 * Phase 33.5 — voicemail templates (LO-only). Script-based; the MP3 upload +
 * AMD-triggered drop are gated on Twilio WebRTC config.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('voicemail_templates').select('*').eq('org_id', orgId).eq('is_active', true).order('created_at', { ascending: false });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { name?: string; script?: string };
  if (!body.name || !body.script) return NextResponse.json({ error: 'name and script are required' }, { status: 400 });
  const sb = createAdminClient();
  const { data, error } = await sb.from('voicemail_templates').insert({ org_id: orgId, created_by: userId, name: body.name, script: body.script }).select('*').single();
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  return NextResponse.json({ template: data });
}
