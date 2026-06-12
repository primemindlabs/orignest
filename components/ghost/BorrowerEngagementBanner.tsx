'use client';

// Phase 85 — shown on the loan detail when the ghost score ≥ 5 (at_risk / ghost).
// Self-fetches the assessment; "Draft re-engagement message" generates an AI draft and
// opens the TCPA-gated modal.

import { useEffect, useState } from 'react';
import { IconGhost2, IconPencil, IconLoader2 } from '@tabler/icons-react';
import type { GhostBand } from '@/lib/ghost/score';
import { GhostScoreBadge } from './GhostScoreBadge';
import { GhostInterventionModal, type GhostIntervention } from './GhostInterventionModal';

type Assessment = {
  score: number;
  band: GhostBand;
  components: Record<string, number>;
  days_since_contact: number | null;
};

const SIGNAL_LABEL: Record<string, string> = {
  email_open: 'No recent email opens',
  reply: 'No recent reply',
  portal_login: 'No recent portal login',
  missed_calls: '2+ missed calls',
  last_contact: 'No contact in 10+ days',
};

export function BorrowerEngagementBanner({ leadId, borrowerFirstName }: { leadId: string; borrowerFirstName: string }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [modal, setModal] = useState<{ intervention: GhostIntervention; ai: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/loans/${leadId}/ghost-intervention`)
      .then((r) => r.json())
      .then((d) => { if (alive && d.assessment) setAssessment(d.assessment); })
      .catch(() => {});
    return () => { alive = false; };
  }, [leadId]);

  // Only surface for at-risk / ghost borrowers.
  if (!assessment || assessment.score < 5) return null;

  const draft = async () => {
    setDrafting(true);
    try {
      const res = await fetch(`/api/loans/${leadId}/ghost-intervention`, { method: 'POST' });
      const d = await res.json();
      if (d.intervention) setModal({ intervention: d.intervention, ai: d.ai ?? false });
    } catch {
      /* ignore */
    } finally {
      setDrafting(false);
    }
  };

  const signals = Object.keys(assessment.components);

  return (
    <div className="rounded-[12px] border border-[#D85A30]/30 bg-[#D85A30]/[0.06] p-4">
      <div className="flex items-center gap-2 mb-2">
        <IconGhost2 size={16} className="text-[#D85A30]" />
        <span className="text-[13px] font-semibold text-[var(--c-text)]">Borrower going quiet</span>
        <GhostScoreBadge score={assessment.score} band={assessment.band} />
        {assessment.days_since_contact !== null && (
          <span className="text-[11px] text-[var(--c-label2)]">· {assessment.days_since_contact}d since contact</span>
        )}
      </div>

      {signals.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {signals.map((s) => (
            <span key={s} className="text-[11px] text-[var(--c-label2)] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-full px-2 py-0.5">
              {SIGNAL_LABEL[s] ?? s}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={draft}
        disabled={drafting}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-50"
      >
        {drafting ? <IconLoader2 size={14} className="animate-spin" /> : <IconPencil size={14} />}
        Draft re-engagement message
      </button>

      {modal && (
        <GhostInterventionModal
          borrowerFirstName={borrowerFirstName}
          intervention={modal.intervention}
          aiDrafted={modal.ai}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
