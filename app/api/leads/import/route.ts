// Pipeline import ("bring your book") — bulk-create leads from a parsed CSV. Org-scoped,
// assigned to the importing LO, deduped by email. Activation + switching-cost remover.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAGES = ['new_inquiry', 'pre_qualified', 'application_started', 'application_complete', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close', 'closing_scheduled', 'closed', 'dead'];
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
};

interface Row { first_name?: string; last_name?: string; email?: string; phone?: string; loan_type?: string; loan_amount?: string | number; property_address?: string; stage?: string }

export async function POST(request: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const rows: Row[] = Array.isArray(body.rows) ? body.rows.slice(0, 2000) : [];
  if (rows.length === 0) return NextResponse.json({ error: 'No rows to import' }, { status: 400 });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // Dedupe against existing leads (by email, within the org).
  const { data: existing } = await sb.from('leads').select('email').eq('org_id', orgId).not('email', 'is', null);
  const seen = new Set((existing ?? []).map((e) => (e.email as string)?.toLowerCase()).filter(Boolean));

  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;
  const errors: string[] = [];
  const batchSeen = new Set<string>();

  rows.forEach((r, i) => {
    const first = (r.first_name ?? '').toString().trim();
    const last = (r.last_name ?? '').toString().trim();
    const email = (r.email ?? '').toString().trim().toLowerCase();
    if (!first || !last || !email) { errors.push(`Row ${i + 1}: missing name or email`); return; }
    if (seen.has(email) || batchSeen.has(email)) { skipped++; return; }
    batchSeen.add(email);
    const stage = r.stage && STAGES.includes(r.stage.toString()) ? r.stage.toString() : 'new_inquiry';
    toInsert.push({
      org_id: orgId,
      assigned_to: profile.id,
      first_name: first.slice(0, 120),
      last_name: last.slice(0, 120),
      email,
      phone: r.phone ? r.phone.toString().trim().slice(0, 40) : null,
      loan_type: r.loan_type ? r.loan_type.toString().trim().slice(0, 60) : null,
      loan_amount: num(r.loan_amount),
      property_address: r.property_address ? r.property_address.toString().trim().slice(0, 300) : null,
      stage,
    });
  });

  let inserted = 0;
  if (toInsert.length) {
    // Insert in chunks to stay well under payload limits.
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const { error, count } = await sb.from('leads').insert(chunk, { count: 'exact' });
      if (error) { errors.push(error.message); break; }
      inserted += count ?? chunk.length;
    }
  }

  return NextResponse.json({ inserted, skipped, errors: errors.slice(0, 10), total: rows.length });
}
