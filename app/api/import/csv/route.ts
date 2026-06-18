// POST /api/import/csv — stage parsed CSV rows into the import review queue
// (imported_loans). The LO reviews them on /inbound and promotes the relevant
// ones into the pipeline. Body: { rows: [{ first_name, last_name, email, phone,
// loan_amount, loan_type, loan_purpose, property_address }] }
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null || v === '' ? null : String(v).trim());
const n = (v: unknown) => { const x = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(x) && x > 0 ? x : null; };

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { rows?: Row[] };
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 1000) : [];
  if (rows.length === 0) return NextResponse.json({ error: 'No rows to import' }, { status: 400 });

  // Tolerant header matching (csv columns vary by source).
  const pick = (r: Row, ...keys: string[]) => {
    for (const k of Object.keys(r)) {
      const norm = k.toLowerCase().replace(/[^a-z]/g, '');
      if (keys.some((want) => norm === want || norm.includes(want))) return r[k];
    }
    return null;
  };

  const staged = rows
    .map((r) => ({
      org_id: orgId,
      source: 'csv',
      borrower_first_name: s(pick(r, 'firstname', 'first', 'fname')),
      borrower_last_name: s(pick(r, 'lastname', 'last', 'lname')),
      borrower_email: s(pick(r, 'email')),
      borrower_phone: s(pick(r, 'phone', 'mobile', 'cell')),
      loan_amount: n(pick(r, 'loanamount', 'amount', 'loan')),
      loan_type: s(pick(r, 'loantype', 'program', 'producttype')),
      loan_purpose: s(pick(r, 'loanpurpose', 'purpose')),
      property_address: s(pick(r, 'propertyaddress', 'address', 'property')),
      raw: r,
      status: 'pending',
    }))
    .filter((x) => x.borrower_first_name || x.borrower_last_name || x.borrower_email);

  if (staged.length === 0) return NextResponse.json({ error: 'No usable rows (need at least a name or email per row).' }, { status: 400 });

  const sb = createAdminClient();
  const { error, count } = await sb.from('imported_loans').insert(staged, { count: 'exact' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, staged: count ?? staged.length });
}
