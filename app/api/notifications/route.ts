import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { differenceInHours, differenceInDays, differenceInMinutes } from 'date-fns';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New Inquiry',
  pre_qual: 'Pre-Qual',
  application: 'Application',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Conditional Approval',
  clear_to_close: 'Clear to Close',
};

interface NotificationItem {
  id: string;
  section: 'urgent' | 'messages' | 'tasks' | 'documents' | 'info';
  iconType: string;
  title: string;
  subtitle: string;
  time: string;
  href: string;
  read: boolean;
}

function timeAgo(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const mins = differenceInMinutes(now, d);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = differenceInHours(now, d);
  if (hrs < 24) return `${hrs}h ago`;
  return `${differenceInDays(now, d)}d ago`;
}

export async function GET() {
  try {
    const { userId, orgId } = await getOrgContext();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!orgId) return NextResponse.json({ items: [], totalUnread: 0 });

    const sb = createAdminClient();
    const now = new Date();

    const [
      { data: leads },
      { data: tasks },
      { data: inboundMessages },
      { data: documents },
      { data: readRecords },
      { data: slaConfig },
    ] = await Promise.all([
      sb
        .from('leads')
        .select('id, first_name, last_name, stage, stage_changed_at, le_deadline, cd_deadline, first_contacted_at, created_at')
        .eq('org_id', orgId)
        .is('archived_at', null)
        .not('stage', 'in', '(closed,declined,withdrawn)'),
      sb
        .from('lead_tasks')
        .select('id, lead_id, title, due_date, priority')
        .eq('org_id', orgId)
        .eq('completed', false)
        .lte('due_date', now.toISOString()),
      sb
        .from('communications')
        .select('id, lead_id, channel, subject, body, created_at, direction')
        .eq('org_id', orgId)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(10),
      sb
        .from('documents')
        .select('id, lead_id, document_type, file_name, created_at, uploaded_by')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5),
      sb
        .from('notification_reads')
        .select('notification_type, reference_id')
        .eq('user_id', userId),
      sb
        .from('stage_sla_config')
        .select('stage, warning_days, critical_days, org_id')
        .or(`org_id.is.null,org_id.eq.${orgId}`),
    ]);

    // SLA per stage — org override wins over platform default.
    const slaByStage = new Map<string, { warning: number; critical: number }>();
    for (const s of slaConfig ?? []) {
      const existing = slaByStage.get(s.stage);
      if (!existing || s.org_id) {
        slaByStage.set(s.stage, { warning: s.warning_days, critical: s.critical_days });
      }
    }

    const readSet = new Set(
      (readRecords ?? []).map((r) => `${r.notification_type}:${r.reference_id}`)
    );

    const items: NotificationItem[] = [];

    // ── Urgent: TRID deadlines ≤24h ───────────────────────────────────────
    for (const lead of leads ?? []) {
      if (lead.le_deadline) {
        const diff = differenceInHours(new Date(lead.le_deadline), now);
        if (diff >= 0 && diff <= 24) {
          const id = `trid-le-${lead.id}`;
          items.push({
            id,
            section: 'urgent',
            iconType: 'alert',
            title: `LE deadline in ${diff}h — ${lead.first_name} ${lead.last_name}`,
            subtitle: 'TRID compliance · Loan Estimate due',
            time: timeAgo(lead.le_deadline),
            href: `/leads/${lead.id}`,
            read: readSet.has(`trid:${id}`),
          });
        }
      }
      if (lead.cd_deadline) {
        const diff = differenceInHours(new Date(lead.cd_deadline), now);
        if (diff >= 0 && diff <= 24) {
          const id = `trid-cd-${lead.id}`;
          items.push({
            id,
            section: 'urgent',
            iconType: 'alert',
            title: `CD deadline in ${diff}h — ${lead.first_name} ${lead.last_name}`,
            subtitle: 'TRID compliance · Closing Disclosure due',
            time: timeAgo(lead.cd_deadline),
            href: `/leads/${lead.id}`,
            read: readSet.has(`trid:${id}`),
          });
        }
      }

      // Uncontacted leads > 1h
      if (
        lead.stage === 'new_inquiry' &&
        !lead.first_contacted_at
      ) {
        const hrs = differenceInHours(now, new Date(lead.created_at));
        if (hrs >= 1) {
          const id = `uncontacted-${lead.id}`;
          items.push({
            id,
            section: 'urgent',
            iconType: 'zap',
            title: `${lead.first_name} ${lead.last_name} still uncontacted`,
            subtitle: `New lead · ${hrs}h old`,
            time: timeAgo(lead.created_at),
            href: `/leads/${lead.id}`,
            read: readSet.has(`uncontacted:${id}`),
          });
        }
      }
    }

    // ── Pipeline velocity: leads stalled in a stage past SLA (Phase 1.4) ────
    for (const lead of leads ?? []) {
      const sla = slaByStage.get(lead.stage);
      if (!sla || !lead.stage_changed_at) continue;
      const daysInStage = differenceInDays(now, new Date(lead.stage_changed_at));
      if (daysInStage < sla.warning) continue;

      const critical = daysInStage >= sla.critical;
      const id = `velocity-${lead.id}`;
      const stageLabel = STAGE_LABELS[lead.stage] ?? lead.stage;
      items.push({
        id,
        section: critical ? 'urgent' : 'info',
        iconType: 'clock',
        title: `${lead.first_name} ${lead.last_name} stalled in ${stageLabel}`,
        subtitle: `${daysInStage} days in stage · SLA ${critical ? 'critical' : 'warning'}`,
        time: timeAgo(lead.stage_changed_at),
        href: `/leads/${lead.id}`,
        read: readSet.has(`velocity:${id}`),
      });
    }

    // ── Messages: inbound SMS/email ────────────────────────────────────────
    for (const msg of inboundMessages ?? []) {
      const id = msg.id;
      const leadData = (leads ?? []).find((l) => l.id === msg.lead_id);
      const name = leadData ? `${leadData.first_name} ${leadData.last_name}` : 'A lead';
      const preview = (msg.body ?? '').slice(0, 60);
      items.push({
        id: `msg-${id}`,
        section: 'messages',
        iconType: msg.channel === 'sms' ? 'sms' : 'email',
        title: `${name} replied via ${msg.channel.toUpperCase()}`,
        subtitle: preview + (preview.length === 60 ? '...' : ''),
        time: timeAgo(msg.created_at),
        href: `/leads/${msg.lead_id}?tab=inbox`,
        read: readSet.has(`msg:msg-${id}`),
      });
    }

    // ── Tasks: overdue ─────────────────────────────────────────────────────
    for (const task of tasks ?? []) {
      const id = task.id;
      const leadData = (leads ?? []).find((l) => l.id === task.lead_id);
      const name = leadData ? `${leadData.first_name} ${leadData.last_name}` : '';
      items.push({
        id: `task-${id}`,
        section: 'tasks',
        iconType: 'task',
        title: task.title,
        subtitle: `${task.priority} priority${name ? ` · ${name}` : ''}`,
        time: task.due_date ? timeAgo(task.due_date) : 'now',
        href: task.lead_id ? `/leads/${task.lead_id}?tab=tasks` : '/tasks',
        read: readSet.has(`task:task-${id}`),
      });
    }

    // ── Documents: recently uploaded ──────────────────────────────────────
    for (const doc of documents ?? []) {
      const id = doc.id;
      const leadData = (leads ?? []).find((l) => l.id === doc.lead_id);
      const name = leadData ? `${leadData.first_name} ${leadData.last_name}` : 'A borrower';
      items.push({
        id: `doc-${id}`,
        section: 'documents',
        iconType: 'doc',
        title: `${name} uploaded ${doc.document_type.replace(/_/g, ' ')}`,
        subtitle: doc.file_name,
        time: timeAgo(doc.created_at),
        href: `/leads/${doc.lead_id}?tab=documents`,
        read: readSet.has(`doc:doc-${id}`),
      });
    }

    // Cap total at 20
    const capped = items.slice(0, 20);
    const totalUnread = capped.filter((n) => !n.read).length;

    return NextResponse.json({ items: capped, totalUnread });
  } catch (err) {
    console.error('[notifications] error:', err);
    return NextResponse.json({ items: [], totalUnread: 0 });
  }
}
