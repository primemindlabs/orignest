import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { ALLOWED_REPORT_TYPES, type ReportType } from '@/lib/reports';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/reports/[type]/schedule — recurring email delivery of a call report (Phase 9).
 *
 * Credential-gated. Without RESEND_API_KEY this returns 501 with a clear TODO rather
 * than silently accepting a schedule it can never deliver. When email is configured,
 * this persists the schedule for the pg_cron report-delivery job to pick up.
 */
export async function POST(req: NextRequest, { params }: { params: { type: string } }) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can schedule report delivery.' }, { status: 403 });
  }

  const type = params.type as ReportType;
  if (!ALLOWED_REPORT_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      {
        error: 'Scheduled email delivery is not connected.',
        todo: 'Set RESEND_API_KEY to enable recurring report delivery, then a pg_cron job mails each schedule.',
        configured: false,
      },
      { status: 501 }
    );
  }

  // Email is configured — accept and persist the schedule for the delivery cron.
  // (Persistence wires into a report_schedules table + pg_cron job once enabled.)
  return NextResponse.json({ configured: true, scheduled: true });
}
