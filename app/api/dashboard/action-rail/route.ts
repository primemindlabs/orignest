/**
 * Phase 39.4 — Action Rail: the ≤8 things the LO must act on today.
 * Rate locks expiring, closings, stalled loans, open conditions — for the LO's
 * own assigned loans, urgency-sorted.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];

interface Item { id: string; type: string; label: string; href: string; urgency: 'high' | 'normal'; sort: number }

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}
function name(l: { first_name?: string | null; last_name?: string | null }) {
  return `${l.first_name ?? ''} ${l.last_name ? l.last_name[0] + '.' : ''}`.trim() || 'Lead';
}

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ items: [] });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ items: [] });

  const { data: leads } = await sb
    .from('leads')
    .select('id, first_name, last_name, stage, closing_date, last_contacted_at, created_at')
    .eq('org_id', orgId)
    .eq('assigned_to', profile.id)
    .in('stage', ACTIVE)
    .is('archived_at', null)
    .limit(300);
  const myLeadIds = new Set((leads ?? []).map((l) => l.id));
  const items: Item[] = [];

  // Rate locks expiring ≤7d.
  const { data: locks } = await sb.from('rate_lock_expirations').select('lead_id, lock_expires_at, status').eq('org_id', orgId).not('lock_expires_at', 'is', null);
  for (const lk of locks ?? []) {
    if (!myLeadIds.has(lk.lead_id) || (lk.status && lk.status === 'floating')) continue;
    const d = daysUntil(lk.lock_expires_at);
    if (d === null || d < 0 || d > 7) continue;
    const lead = (leads ?? []).find((l) => l.id === lk.lead_id);
    items.push({ id: `lock-${lk.lead_id}`, type: 'rate_lock', label: `${name(lead ?? {})} lock — ${d}d`, href: `/loans/${lk.lead_id}/pricing/rate-lock`, urgency: d <= 3 ? 'high' : 'normal', sort: d });
  }

  // Closings today/tomorrow + stalled.
  for (const l of leads ?? []) {
    const cd = daysUntil(l.closing_date);
    if (cd !== null && cd >= 0 && cd <= 2) {
      items.push({ id: `close-${l.id}`, type: 'closing', label: `${name(l)} closing ${cd === 0 ? 'today' : cd === 1 ? 'tomorrow' : `in ${cd}d`}`, href: `/loans/${l.id}`, urgency: cd <= 1 ? 'high' : 'normal', sort: cd - 10 });
    }
    const since = l.last_contacted_at ?? l.created_at;
    const stale = Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000);
    if (stale >= 5) items.push({ id: `stale-${l.id}`, type: 'follow_up', label: `${name(l)} — ${stale}d no activity`, href: `/leads/${l.id}`, urgency: 'normal', sort: 50 - Math.min(stale, 49) });
  }

  // Open conditions (missing docs proxy).
  if (myLeadIds.size) {
    const { data: conds } = await sb.from('loan_conditions').select('lead_id').eq('org_id', orgId).neq('status', 'cleared').in('lead_id', Array.from(myLeadIds));
    const byLead = new Map<string, number>();
    for (const c of conds ?? []) byLead.set(c.lead_id, (byLead.get(c.lead_id) ?? 0) + 1);
    for (const [lid, n] of byLead) {
      const lead = (leads ?? []).find((l) => l.id === lid);
      items.push({ id: `cond-${lid}`, type: 'missing_doc', label: `${name(lead ?? {})} — ${n} open condition${n > 1 ? 's' : ''}`, href: `/loans/${lid}/underwriting/conditions`, urgency: 'normal', sort: 30 });
    }
  }

  // Phase 40 — dormant realtor partners needing re-engagement.
  const { data: dormant } = await sb.from('realtors').select('id, first_name, last_name').eq('org_id', orgId).eq('partnership_tier', 'dormant').eq('is_archived', false).limit(3);
  for (const d of dormant ?? []) {
    items.push({ id: `dormant-${d.id}`, type: 'follow_up', label: `${name(d)} — dormant partner`, href: `/realtors/${d.id}`, urgency: 'normal', sort: 60 });
  }

  items.sort((a, b) => (a.urgency === b.urgency ? a.sort - b.sort : a.urgency === 'high' ? -1 : 1));
  return NextResponse.json({ items: items.slice(0, 8) });
}
