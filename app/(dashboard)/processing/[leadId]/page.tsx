import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import { ConditionsChecklist } from '@/components/processing/ConditionsChecklist';
import { UWSubmissionChecklist } from '@/components/processor/UWSubmissionChecklist';
import { MilestoneTimeline } from '@/components/processing/MilestoneTimeline';
import { ClosingChecklist } from '@/components/processing/ClosingChecklist';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Processing File' };

const STAGE_LABELS: Record<string, string> = {
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Conditional Approval',
  clear_to_close: 'Clear to Close',
  closed: 'Closed',
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  conventional: 'Conventional',
  fha: 'FHA',
  va: 'VA',
  usda: 'USDA',
  jumbo: 'Jumbo',
  non_qm: 'Non-QM',
  heloc: 'HELOC',
  construction: 'Construction',
  reverse: 'Reverse',
  dscr: 'DSCR',
  commercial: 'Commercial',
};

export default async function ProcessingFilePage({
  params,
}: {
  params: { leadId: string };
}) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();

  const { data: lead } = await sb
    .from('leads')
    .select(
      `*, profiles:assigned_to ( first_name, last_name, email, phone )`
    )
    .eq('id', params.leadId)
    .eq('org_id', orgId)
    .single();

  if (!lead) notFound();

  // Documents
  const { data: documents } = await sb
    .from('documents')
    .select('id, document_type, file_name, file_size, created_at, ai_summary, verified')
    .eq('lead_id', params.leadId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Communications
  const { data: communications } = await sb
    .from('communications')
    .select('id, channel, direction, subject, body, sent_at, created_at')
    .eq('lead_id', params.leadId)
    .order('created_at', { ascending: false })
    .limit(15);

  // Lead notes
  const { data: notes } = await sb
    .from('lead_notes')
    .select('id, content, is_private, created_at, profiles:author_id ( first_name, last_name )')
    .eq('lead_id', params.leadId)
    .order('created_at', { ascending: false })
    .limit(15);

  const borrowerName = `${lead.first_name} ${lead.last_name}`;
  const lo = lead.profiles as { first_name: string; last_name: string } | null;

  return (
    <div className="max-w-[1400px] space-y-4 animate-fade-in">
      {/* ── Back + Title ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link
          href="/processing"
          className="inline-flex items-center gap-1.5 text-sm text-label-2 hover:text-black transition-colors"
        >
          <ArrowLeft size={14} />
          Processing
        </Link>
        <span className="text-label-3">/</span>
        <span className="text-sm font-medium text-black">{borrowerName}</span>
      </div>

      {/* ── Lead Summary Bar ─────────────────────────────────────────── */}
      <div className="bg-surface rounded-card shadow-card border border-border px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue/10 flex items-center justify-center">
            <span className="text-sm font-semibold text-blue">
              {lead.first_name[0]}{lead.last_name[0]}
            </span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-black tracking-tight">{borrowerName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="info" size="sm">
                {LOAN_TYPE_LABELS[lead.loan_type ?? ''] ?? lead.loan_type ?? 'No type'}
              </Badge>
              <Badge variant="warning" size="sm" dot>
                {STAGE_LABELS[lead.stage] ?? lead.stage}
              </Badge>
              {lead.loan_amount && (
                <span className="text-sm font-mono text-label-2">
                  ${lead.loan_amount.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-label-2">
          {lo && (
            <div>
              <span className="text-[11px] uppercase tracking-wide text-label-3">LO</span>
              <p className="font-medium text-black">{lo.first_name} {lo.last_name}</p>
            </div>
          )}
          {lead.closing_date && (
            <div>
              <span className="text-[11px] uppercase tracking-wide text-label-3">Closing</span>
              <p className="font-medium text-black">
                {format(new Date(lead.closing_date), 'MMM d, yyyy')}
              </p>
            </div>
          )}
          <Link
            href={`/leads/${lead.id}`}
            className="inline-flex items-center gap-1 text-blue hover:underline text-sm"
          >
            Full Lead <ExternalLink size={12} />
          </Link>
        </div>
      </div>

      {/* ── Two-Column Layout ─────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_400px] gap-4">
        {/* Left: Conditions + Milestones */}
        <div className="space-y-4">
          {/* Conditions */}
          <div className="bg-surface rounded-card shadow-card border border-border p-5">
            <ConditionsChecklist leadId={params.leadId} />
          </div>

          {/* UW submission checklist (Phase 16.4) */}
          <UWSubmissionChecklist leadId={params.leadId} />

          {/* Milestones */}
          <div className="bg-surface rounded-card shadow-card border border-border p-5">
            <MilestoneTimeline leadId={params.leadId} loanType={lead.loan_type} />
          </div>

          {/* Closing Checklist */}
          <div className="bg-surface rounded-card shadow-card border border-border p-5">
            <ClosingChecklist leadId={params.leadId} loanAmount={lead.loan_amount} />
          </div>
        </div>

        {/* Right: Documents + Comms + Notes */}
        <div className="space-y-4">
          {/* Documents */}
          <div className="bg-surface rounded-card shadow-card border border-border p-4">
            <h3 className="text-sm font-semibold text-black mb-3">Documents</h3>
            {documents && documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-start gap-2.5 py-2 border-b border-border/60 last:border-0">
                    <div className="w-8 h-8 rounded-[6px] bg-fill flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-mono text-label-2 uppercase">
                        {doc.file_name.split('.').pop()?.slice(0, 3) ?? 'DOC'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-black truncate">{doc.file_name}</p>
                      <p className="text-[11px] text-label-3">{doc.document_type}</p>
                      {doc.ai_summary && (
                        <p className="text-[11px] text-label-2 mt-0.5 line-clamp-2">{doc.ai_summary}</p>
                      )}
                    </div>
                    {doc.verified && (
                      <span className="text-[10px] font-medium text-green bg-green/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        Verified
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-label-3 text-center py-4">No documents uploaded</p>
            )}
          </div>

          {/* Communications Log */}
          <div className="bg-surface rounded-card shadow-card border border-border p-4">
            <h3 className="text-sm font-semibold text-black mb-3">Communications</h3>
            {communications && communications.length > 0 ? (
              <div className="space-y-2">
                {communications.map((comm) => {
                  const channelColors: Record<string, string> = {
                    sms: 'bg-green/10 text-green',
                    email: 'bg-blue/10 text-blue',
                    call: 'bg-orange/10 text-orange',
                    note: 'bg-fill text-label-2',
                  };
                  return (
                    <div key={comm.id} className="py-2 border-b border-border/60 last:border-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase ${channelColors[comm.channel] ?? 'bg-fill text-label-2'}`}>
                          {comm.channel}
                        </span>
                        <span className="text-[10px] text-label-3">{comm.direction}</span>
                        <span className="text-[10px] text-label-3 ml-auto">
                          {comm.sent_at
                            ? format(new Date(comm.sent_at), 'MMM d, h:mm a')
                            : format(new Date(comm.created_at), 'MMM d')}
                        </span>
                      </div>
                      {comm.subject && (
                        <p className="text-xs font-medium text-black">{comm.subject}</p>
                      )}
                      <p className="text-xs text-label-2 line-clamp-2">{comm.body}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-label-3 text-center py-4">No communications yet</p>
            )}
          </div>

          {/* Notes */}
          <div className="bg-surface rounded-card shadow-card border border-border p-4">
            <h3 className="text-sm font-semibold text-black mb-3">Notes</h3>
            {notes && notes.length > 0 ? (
              <div className="space-y-2">
                {notes.map((note) => {
                  const author = note.profiles as unknown as { first_name: string; last_name: string } | null;
                  return (
                    <div key={note.id} className="py-2 border-b border-border/60 last:border-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[11px] font-medium text-black">
                          {author ? `${author.first_name} ${author.last_name}` : 'Unknown'}
                        </span>
                        {note.is_private && (
                          <span className="text-[10px] text-label-3 bg-fill px-1 rounded">private</span>
                        )}
                        <span className="text-[10px] text-label-3 ml-auto">
                          {format(new Date(note.created_at), 'MMM d')}
                        </span>
                      </div>
                      <p className="text-xs text-label-2 line-clamp-3">{note.content}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-label-3 text-center py-4">No notes yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}