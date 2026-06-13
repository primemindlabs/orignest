// Phase 111 — Borrower Multi-Loan Switcher (token-adapted).
//
// The portal is token-per-loan (no borrower login), so the spec's auth-based
// borrower_portal_sessions doesn't apply. Instead: from the current token's lead we
// find the borrower's OTHER active loans (matched by email within the org, the same
// way the portal already auto-links loan history), resolve/mint each one's portal
// token, and return links to /status/[token]. No new tables; the "active loan" is
// simply the current token.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const TERMINAL = ['declined', 'withdrawn'];

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const { token } = params;
  const sb = createAdminClient();

  const { data: portal } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!portal) return NextResponse.json({ error: 'Invalid portal link' }, { status: 401 });
  if (portal.expires_at && new Date(portal.expires_at as string) < new Date()) {
    return NextResponse.json({ error: 'Portal link has expired' }, { status: 401 });
  }

  const { data: current } = await sb
    .from('leads')
    .select('id, email, property_address, loan_type, stage')
    .eq('id', portal.lead_id)
    .eq('org_id', portal.org_id)
    .maybeSingle();
  if (!current) return NextResponse.json({ loans: [] });

  const email = (current.email as string | null)?.trim().toLowerCase() ?? '';

  // Sibling loans = same borrower email, same org, not archived, not terminal.
  let siblings: any[] = [current];
  if (email) {
    const { data: matches } = await sb
      .from('leads')
      .select('id, email, property_address, loan_type, stage, created_at')
      .eq('org_id', portal.org_id)
      .ilike('email', email)
      .is('archived_at', null)
      .not('stage', 'in', `(${TERMINAL.join(',')})`)
      .order('created_at', { ascending: false });
    if (matches && matches.length) siblings = matches;
  }

  // Only show the switcher's value when there is genuinely more than one loan.
  const uniq = new Map<string, any>();
  for (const s of siblings) uniq.set(s.id as string, s);
  const list = Array.from(uniq.values());

  // Resolve (or mint) a portal token per loan so each is reachable at /status/[token].
  const ids = list.map((l) => l.id as string);
  const tokenByLead = new Map<string, string>();
  if (ids.length) {
    const { data: toks } = await sb
      .from('borrower_portal_tokens')
      .select('lead_id, token')
      .eq('org_id', portal.org_id)
      .in('lead_id', ids);
    for (const t of toks ?? []) if (!tokenByLead.has(t.lead_id as string)) tokenByLead.set(t.lead_id as string, t.token as string);
  }
  // Mint any missing tokens (so a sibling loan that never had a link is still reachable).
  for (const l of list) {
    const id = l.id as string;
    if (tokenByLead.has(id)) continue;
    const { data: minted } = await sb
      .from('borrower_portal_tokens')
      .insert({ org_id: portal.org_id, lead_id: id })
      .select('token')
      .maybeSingle();
    if (minted?.token) tokenByLead.set(id, minted.token as string);
  }

  const loans = list
    .map((l) => ({
      lead_id: l.id,
      token: tokenByLead.get(l.id as string) ?? null,
      property_address: l.property_address ?? null,
      loan_type: l.loan_type ?? null,
      stage: l.stage ?? null,
      is_current: l.id === portal.lead_id,
    }))
    .filter((l) => l.token)
    .sort((a, b) => (a.is_current ? -1 : b.is_current ? 1 : 0));

  return NextResponse.json({ loans });
}
