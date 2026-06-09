'use client';

/** Phase 46.2/46.3 — what the borrower sees at this stage: a plain-language
 * explainer (+ FAQ) and, near closing, the closing-day prep checklist. Reusable
 * in the LO's portal preview and (later) the borrower portal itself. */
import { useState } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { buildStageExplainer } from '@/lib/portal/stageExplainers';
import { CLOSING_DAY_CHECKLIST } from '@/lib/portal/closingChecklist';

export function BorrowerJourneyGuide({ stage, loFirstName }: { stage: string; loFirstName: string }) {
  const [expanded, setExpanded] = useState(false);
  const e = buildStageExplainer(stage, loFirstName);
  const showClosing = stage === 'clear_to_close' || stage === 'closed';
  if (!e) return null;

  return (
    <div className="space-y-4">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
        <p className="text-[15px] font-semibold text-[var(--c-text)]">{e.headline}</p>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">{e.what_it_means}</p>
        <p className="text-[12px] text-[var(--c-label2)] mt-1.5 inline-flex items-center gap-1"><Clock size={12} /> {e.typical_time}</p>

        {e.you_need_to && (
          <div className="mt-3 bg-[var(--c-gold-light)] rounded-[10px] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-gold-deep)]">What you need to do</p>
            <p className="text-[13px] text-[var(--c-text)] mt-0.5">{e.you_need_to}</p>
          </div>
        )}

        {e.faq.length > 0 && (
          <>
            <button onClick={() => setExpanded((x) => !x)} className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--c-gold-deep)]">
              <ChevronDown size={13} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} /> Common questions
            </button>
            {expanded && (
              <div className="mt-2 space-y-2">
                {e.faq.map((f, i) => (
                  <details key={i} className="group">
                    <summary className="text-[13px] font-medium text-[var(--c-text)] cursor-pointer list-none flex justify-between items-center">{f.q}<ChevronDown size={13} className="text-[var(--c-label2)] group-open:rotate-180 transition-transform" /></summary>
                    <p className="text-[13px] text-[var(--c-label2)] mt-1">{f.a}</p>
                  </details>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showClosing && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
          <p className="text-[14px] font-semibold text-[var(--c-text)] mb-2">Closing day checklist</p>
          <div className="space-y-3">
            {CLOSING_DAY_CHECKLIST.map((cat) => (
              <div key={cat.category}>
                <p className="text-[12px] font-semibold text-[var(--c-text)] mb-1">{cat.category}</p>
                <ul className="space-y-1.5">
                  {cat.items.map((it, i) => (
                    <li key={i} className="text-[12px] text-[var(--c-label2)]">
                      <span className="text-[var(--c-text)]">• {it.label}</span>
                      {it.detail && <span className="block pl-3 text-[11px] text-[var(--c-label3)]">{it.detail}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
