import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getResend, FROM } from '@/lib/resend';

export const runtime = 'nodejs';

interface InvitePayload {
  processorEmail: string;
  permissions: {
    view_leads?: boolean;
    edit_conditions?: boolean;
    upload_docs?: boolean;
    view_financials?: boolean;
  };
}

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as InvitePayload | null;
  if (!body?.processorEmail) {
    return NextResponse.json({ error: 'processorEmail is required' }, { status: 400 });
  }

  const sb = createAdminClient();

  // ── Authorization check: only admin or branch_manager ────────────────────
  const { data: profile } = await sb
    .from('profiles')
    .select('role, id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (profile?.role !== 'admin' && profile?.role !== 'branch_manager') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // ── Look up org ───────────────────────────────────────────────────────────
  const { data: org } = await sb
    .from('organizations')
    .select('id, name')
    .eq('clerk_org_id', orgId)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  // ── Find processor's Clerk account ────────────────────────────────────────
  let processorClerkId: string | null = null;
  try {
    const clerk = await clerkClient();
    const users = await clerk.users.getUserList({
      emailAddress: [body.processorEmail],
    });
    if (users.data.length > 0) {
      processorClerkId = users.data[0].id;
    }
  } catch (err) {
    console.error('[processor/invite] Clerk lookup failed:', err);
  }

  if (!processorClerkId) {
    return NextResponse.json(
      { error: 'No Orignest account found for that email. The processor must sign up first.' },
      { status: 404 }
    );
  }

  // ── Create or update processor_assignments record ─────────────────────────
  const permissions = {
    view_leads: body.permissions.view_leads ?? true,
    edit_conditions: body.permissions.edit_conditions ?? true,
    upload_docs: body.permissions.upload_docs ?? true,
    view_financials: body.permissions.view_financials ?? false,
  };

  const { data: existing } = await sb
    .from('processor_assignments')
    .select('id, status')
    .eq('processor_clerk_id', processorClerkId)
    .eq('org_id', org.id)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'active') {
      return NextResponse.json(
        { error: 'This processor is already active for your organization.' },
        { status: 409 }
      );
    }
    // Re-invite suspended/pending
    await sb
      .from('processor_assignments')
      .update({ status: 'pending', permissions, accepted_at: null })
      .eq('id', existing.id);
  } else {
    await sb.from('processor_assignments').insert({
      processor_clerk_id: processorClerkId,
      org_id: org.id,
      invited_by: profile.id,
      status: 'pending',
      permissions,
    });
  }

  // ── Send invite email ─────────────────────────────────────────────────────
  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.orignest.com'}/processor/organizations`;
  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM,
      to: body.processorEmail,
      subject: `${org.name} has invited you to process loans on Orignest`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="margin-bottom: 32px;">
            <div style="display: inline-flex; align-items: center; gap: 8px; margin-bottom: 24px;">
              <div style="width: 28px; height: 28px; background: #0F1D2E; border-radius: 8px;"></div>
              <span style="font-size: 17px; font-weight: 600; color: #0F1D2E;">Orignest</span>
            </div>
            <h2 style="color: #0F1D2E; font-size: 22px; margin: 0 0 12px;">You've been invited to process loans</h2>
            <p style="color: #6C6C70; margin: 0 0 8px;">
              <strong>${org.name}</strong> has invited you to work on their loan files through Orignest.
            </p>
            <p style="color: #6C6C70; margin: 0 0 24px;">
              You'll be able to manage conditions, update milestones, and upload documents for their pipeline —
              all from your unified Orignest processor dashboard.
            </p>
          </div>
          <a href="${acceptUrl}"
             style="display: inline-block; background: #007AFF; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Accept Invitation
          </a>
          <p style="color: #AEAEB2; font-size: 12px; margin-top: 32px;">
            If you weren't expecting this, you can safely ignore this email.
          </p>
        </div>
      `,
    });
  } catch (emailErr) {
    // Email failure is non-blocking — the assignment record is created
    console.error('[processor/invite] Email send failed:', emailErr);
  }

  return NextResponse.json({ ok: true, message: 'Invitation sent.' });
}
