'use client';

import { useState, useEffect } from 'react';
import { Check, Clock, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import { format, isAfter } from 'date-fns';
import { createClient } from '@/lib/supabase/client';

type ResponsibleParty = 'lo' | 'processor' | 'borrower' | 'title' | 'lender' | 'appraiser';

interface Milestone {
  id: string;
  lead_id: string;
  milestone_key: string;
  milestone_label: string;
  responsible_party: ResponsibleParty;
  completed: boolean;
  completed_at: string | null;
  due_date: string | null;
  sequence_order: number;
  notes: string | null;
}

interface Props {
  leadId: string;
  loanType: string | null;
}

const PARTY_LABELS: Record<ResponsibleParty, string> = {
  lo: 'LO',
  processor: 'Processor',
  borrower: 'Borrower',
  title: 'Title',
  lender: 'Lender',
  appraiser: 'Appraiser',
};

const PARTY_COLOR: Record<ResponsibleParty, string> = {
  lo: 'bg-blue/10 text-blue',
  processor: 'bg-purple-500/10 text-purple-700',
  borrower: 'bg-green/10 text-green',
  title: 'bg-orange/10 text-orange',
  lender: 'bg-navy/10 text-navy',
  appraiser: 'bg-gold/10 text-gold',
};

// Milestone templates by loan type
const MILESTONE_TEMPLATES: Record<string, Array<{ key: string; label: string; party: ResponsibleParty }>> = {
  default: [
    { key: 'application_received', label: 'Application Received', party: 'lo' },
    { key: 'credit_pulled', label: 'Credit Pulled', party: 'lo' },
    { key: 'aus_run', label: 'AUS Run', party: 'lo' },
    { key: 'submitted_to_uw', label: 'Submitted to Underwriting', party: 'processor' },
    { key: 'conditional_approval', label: 'Conditional Approval', party: 'lender' },
    { key: 'conditions_submitted', label: 'Conditions Submitted', party: 'processor' },
    { key: 'clear_to_close', label: 'Clear to Close', party: 'lender' },
    { key: 'initial_cd_sent', label: 'Initial CD Sent (3-day clock starts)', party: 'processor' },
    { key: 'final_cd_verified', label: 'Final CD Verified', party: 'lo' },
    { key: 'closing_day', label: 'Closing Day', party: 'title' },
    { key: 'funded', label: 'Funded', party: 'lender' },
    { key: 'recorded', label: 'Recorded', party: 'title' },
  ],
  fha: [
    { key: 'application_received', label: 'Application Received', party: 'lo' },
    { key: 'case_number_ordered', label: 'Case Number Ordered', party: 'lo' },
    { key: 'credit_pulled', label: 'Credit Pulled', party: 'lo' },
    { key: 'aus_run', label: 'AUS Run', party: 'lo' },
    { key: 'appraisal_ordered', label: 'Appraisal Ordered', party: 'processor' },
    { key: 'appraisal_received', label: 'Appraisal Received', party: 'appraiser' },
    { key: 'value_confirmed', label: 'Value Confirmed', party: 'lender' },
    { key: 'submitted_to_uw', label: 'Submitted to Underwriting', party: 'processor' },
    { key: 'conditional_approval', label: 'Conditional Approval', party: 'lender' },
    { key: 'conditions_submitted', label: 'Conditions Submitted', party: 'processor' },
    { key: 'clear_to_close', label: 'Clear to Close', party: 'lender' },
    { key: 'initial_cd_sent', label: 'Initial CD Sent', party: 'processor' },
    { key: 'final_cd_verified', label: 'Final CD Verified', party: 'lo' },
    { key: 'closing_day', label: 'Closing Day', party: 'title' },
    { key: 'funded', label: 'Funded', party: 'lender' },
    { key: 'recorded', label: 'Recorded', party: 'title' },
  ],
  dscr: [
    { key: 'application_received', label: 'Application Received', party: 'lo' },
    { key: 'rent_schedule_verified', label: 'Rent Schedule / DSCR Verified', party: 'lo' },
    { key: 'file_submission', label: 'File Submission', party: 'processor' },
    { key: 'lender_review', label: 'Lender Review', party: 'lender' },
    { key: 'approval', label: 'Approval', party: 'lender' },
    { key: 'cd_issued', label: 'CD Issued', party: 'processor' },
    { key: 'closing_day', label: 'Closing Day', party: 'title' },
    { key: 'funded', label: 'Funded', party: 'lender' },
  ],
};

function getTemplate(loanType: string | null) {
  if (!loanType) return MILESTONE_TEMPLATES.default;
  if (loanType === 'fha' || loanType === 'va') return MILESTONE_TEMPLATES.fha;
  if (loanType === 'dscr' || loanType === 'non_qm') return MILESTONE_TEMPLATES.dscr;
  return MILESTONE_TEMPLATES.default;
}

export function MilestoneTimeline({ leadId, loanType }: Props) {
  const sb = createClient();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [noteTexts, setNoteTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    loadMilestones();
  }, [leadId]);

  async function loadMilestones() {
    const { data } = await sb
      .from('loan_milestones')
      .select('*')
      .eq('lead_id', leadId)
      .order('sequence_order', { ascending: true });

    if (!data || data.length === 0) {
      await seedMilestones();
    } else {
      const notesMap: Record<string, string> = {};
      data.forEach((m) => { notesMap[m.id] = m.notes ?? ''; });
      setNoteTexts(notesMap);
      setMilestones(data);
    }
    setLoading(false);
  }

  async function seedMilestones() {
    const { data: org } = await sb.from('organizations').select('id').single();
    if (!org) return;

    const template = getTemplate(loanType);
    const rows = template.map((t, idx) => ({
      lead_id: leadId,
      org_id: org.id,
      milestone_key: t.key,
      milestone_label: t.label,
      responsible_party: t.party,
      completed: false,
      sequence_order: idx + 1,
    }));

    const { data } = await sb.from('loan_milestones').insert(rows).select();
    if (data) {
      const notesMap: Record<string, string> = {};
      data.forEach((m) => { notesMap[m.id] = ''; });
      setNoteTexts(notesMap);
      setMilestones(data);
    }
  }

  async function toggleMilestone(id: string, completed: boolean) {
    setToggling(id);
    // Optimistic
    setMilestones((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, completed, completed_at: completed ? new Date().toISOString() : null }
          : m
      )
    );

    await sb
      .from('loan_milestones')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', id);

    setToggling(null);
  }

  async function saveNote(id: string) {
    await sb
      .from('loan_milestones')
      .update({ notes: noteTexts[id] ?? '' })
      .eq('id', id);
    setExpandedNote(null);
  }

  if (loading) {
    return (
      <div className="py-6 flex items-center justify-center gap-2 text-label-3">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-sm">Loading milestones…</span>
      </div>
    );
  }

  const completedCount = milestones.filter((m) => m.completed).length;

  return (
    <div className="space-y-3">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-black">Loan Milestones</span>
        <span className="text-xs text-label-2">
          {completedCount} of {milestones.length} complete
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-fill overflow-hidden">
          <div
            className="h-full rounded-full bg-blue transition-all duration-500"
            style={{ width: `${milestones.length > 0 ? (completedCount / milestones.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[17px] top-3 bottom-3 w-px bg-border" />

        <div className="space-y-1">
          {milestones.map((m, idx) => {
            const isOverdue = m.due_date && !m.completed && isAfter(new Date(), new Date(m.due_date));
            const noteOpen = expandedNote === m.id;

            return (
              <div key={m.id} className="relative flex gap-4 group">
                {/* Node */}
                <div className="flex-shrink-0 z-10">
                  <button
                    onClick={() => toggleMilestone(m.id, !m.completed)}
                    disabled={toggling === m.id}
                    className={`w-[34px] h-[34px] rounded-full border-2 flex items-center justify-center transition-all ${
                      m.completed
                        ? 'bg-blue border-blue'
                        : isOverdue
                        ? 'bg-surface border-red'
                        : 'bg-surface border-border hover:border-blue'
                    }`}
                  >
                    {toggling === m.id ? (
                      <Loader2 size={12} className="animate-spin text-blue" />
                    ) : m.completed ? (
                      <Check size={14} className="text-white" strokeWidth={2.5} />
                    ) : isOverdue ? (
                      <AlertCircle size={12} className="text-red" />
                    ) : (
                      <span className="text-[10px] font-mono text-label-3">{idx + 1}</span>
                    )}
                  </button>
                </div>

                {/* Content */}
                <div className={`flex-1 pb-3 ${idx === milestones.length - 1 ? 'pb-0' : ''}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-medium ${
                        m.completed
                          ? 'text-label-3 line-through'
                          : isOverdue
                          ? 'text-red'
                          : 'text-black'
                      }`}
                    >
                      {m.milestone_label}
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PARTY_COLOR[m.responsible_party]}`}>
                      {PARTY_LABELS[m.responsible_party]}
                    </span>
                    {m.completed && m.completed_at && (
                      <span className="text-[11px] text-label-3">
                        {format(new Date(m.completed_at), 'MMM d')}
                      </span>
                    )}
                    {m.due_date && !m.completed && (
                      <span className={`text-[11px] ${isOverdue ? 'text-red font-medium' : 'text-label-3'}`}>
                        Due {format(new Date(m.due_date), 'MMM d')}
                      </span>
                    )}
                    {m.notes && (
                      <Clock size={11} className="text-label-3" />
                    )}
                  </div>

                  {/* Note toggle */}
                  <button
                    onClick={() => setExpandedNote(noteOpen ? null : m.id)}
                    className="text-[11px] text-label-3 hover:text-blue transition-colors mt-0.5 opacity-0 group-hover:opacity-100"
                  >
                    {noteOpen ? 'Hide note' : 'Add note'}
                  </button>

                  {noteOpen && (
                    <div className="mt-1.5 space-y-1.5 animate-fade-in">
                      <textarea
                        value={noteTexts[m.id] ?? ''}
                        onChange={(e) => setNoteTexts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        rows={2}
                        placeholder="Note…"
                        className="w-full px-2.5 py-1.5 rounded-[6px] bg-fill border border-border text-xs text-black placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-blue/30 resize-none"
                      />
                      <button
                        onClick={() => saveNote(m.id)}
                        className="text-xs text-blue hover:underline"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
