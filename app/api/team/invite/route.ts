/**
 * Phase 36.4 — invite a team member (admin/manager only).
 *   GET  → pending invitations
 *   POST → create an invitation (seat-limit enforced); returns a shareable link.
 * Token: random 32 bytes; only its SHA-256 hash is stored. Email is best-effort.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLANS } from '@/lib/stripe/plans';
import { randomBytes, createHash } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROLES = ['loan_officer', 'lo', 'loa', 'processor', 'manager', 'branch_manager', 'admin'];
const ADMIN_ROLES = ['admin', 'branch_manager'];

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex');
}

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('invitations').select('id, email, role, expires_at, accepted_at, revoked_at, created_at').eq('org_id', orgId).is('accepted_at', null).is('revoked_at', null).order('created_at', { ascending: false });
  return NextResponse.json({ invitations: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!ADMIN_ROLES.includes(role)) return NextResponse.json({ error: 'Only admins can invite team members.' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { email?: string; role?: string; assigned_lo_id?: string | null };
  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  const inviteRole = ROLES.includes(body.role ?? '') ? (body.role as string) : 'loan_officer';
  // An LOA invite must name the LO they will assist.
  const assignedLoId = inviteRole === 'loa' ? (body.assigned_lo_id ?? null) : null;
  if (inviteRole === 'loa' && !assignedLoId) return NextResponse.json({ error: 'Select which loan officer this assistant will support.' }, { status: 400 });

  const sb = createAdminClient();

  // Seat-limit check (active profiles + open invites vs plan seats).
  const { data: org } = await sb.from('organizations').select('subscription_plan').eq('id', orgId).maybeSingle();
  const planSeats = PLANS[(org?.subscription_plan ?? 'starter') as keyof typeof PLANS]?.seats ?? 1;
  if (planSeats > 0) {
    const [{ count: activeUsers }, { count: openInvites }] = await Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      sb.from('invitations').select('id', { count: 'exact', head: true }).eq('org_id', orgId).is('accepted_at', null).is('revoked_at', null),
    ]);
    if ((activeUsers ?? 0) + (openInvites ?? 0) >= planSeats) {
      return NextResponse.json({ error: `Your plan allows ${planSeats} seat${planSeats === 1 ? '' : 's'}. Upgrade to add more team members.`, code: 'SEAT_LIMIT', upgrade_url: '/settings/billing' }, { status: 403 });
    }
  }

  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const token = randomBytes(32).toString('hex');

  const { error } = await sb.from('invitations').upsert({
    org_id: orgId, email, role: inviteRole, invited_by: profile?.id ?? null, assigned_lo_id: assignedLoId,
    token_hash: sha256(token), expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    accepted_at: null, revoked_at: null,
  }, { onConflict: 'org_id,email' });
  if (error) return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/invite/${token}`;

  // Best-effort email (Resend). The shareable link is always returned so the
  // admin can send it manually even if email isn't wired.
  try {
    const mod = (await import('@/lib/resend')) as Record<string, unknown>;
    const send = (mod.sendEmail ?? mod.sendTransactionalEmail ?? mod.default) as ((a: { to: string; subject: string; html: string }) => Promise<unknown>) | undefined;
    if (typeof send === 'function') {
      await send({ to: email, subject: "You're invited to Ashley IQ", html: `<p>You've been invited to join a team on Ashley IQ. <a href="${inviteUrl}">Accept your invitation</a> (expires in 7 days).</p>` });
    }
  } catch {
    /* email is best-effort — the invite_url is returned regardless */
  }

  return NextResponse.json({ ok: true, invite_url: inviteUrl, email });
}
