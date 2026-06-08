'use client';

/**
 * Phase 16.4 — UW Submission Checklist.
 *
 * System-enforced pre-underwriting gates. Submission is blocked until every
 * item is green, unless the processor records a justification (logged to the
 * lead timeline). Submitting fires `loan_submitted_to_uw`, which auto-advances
 * the stage to Underwriting via the stage-automation rules (Phase 1.1).
 */
import { useEffect, useState } from 'react';
import { Check, X, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ChecklistItem {
  key: string;
  label: string;
  ready: boolean;
  detail: string;
}

export function UWSubmissionChecklist({ leadId }: { leadId: string }) {
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [override, setOverride] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/processor/uw-readiness/${leadId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!active) return;
        setItems(json.items ?? []);
        setReady(!!json.ready);
        setLoading(false);
      })
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [leadId]);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'loan_submitted_to_uw',
          metadata: ready ? {} : { override: true, justification: override },
        }),
      });
      if (res.ok) setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="py-6 flex items-center justify-center gap-2 text-label-3">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Checking readiness…</span>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="bg-green/5 rounded-card border border-green/20 px-4 py-4 flex items-center gap-3">
        <ShieldCheck size={18} className="text-green" />
        <p className="text-sm text-black">Submitted to underwriting — stage advanced.</p>
      </div>
    );
  }

  const blocked = !ready && override.trim().length < 5;

  return (
    <div className="bg-surface rounded-card shadow-card border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-black">Underwriting submission checklist</h3>
        <span className="text-xs font-mono text-label-2">
          {(items ?? []).filter((i) => i.ready).length}/{items?.length ?? 0} ready
        </span>
      </div>

      <div className="space-y-1.5">
        {(items ?? []).map((item) => (
          <div key={item.key} className="flex items-start gap-2.5">
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                item.ready ? 'bg-green' : 'bg-red'
              }`}
            >
              {item.ready ? (
                <Check size={10} className="text-white" strokeWidth={3} />
              ) : (
                <X size={10} className="text-white" strokeWidth={3} />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-black leading-snug">{item.label}</p>
              <p className="text-xs text-label-3">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {!ready && (
        <div className="space-y-1.5">
          <p className="text-xs text-label-2">
            Some items are incomplete. To submit anyway, record a justification (logged to the file):
          </p>
          <textarea
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            rows={2}
            placeholder="Reason for submitting with outstanding items…"
            className="w-full px-3 py-2 rounded-[8px] bg-fill border border-border text-sm text-black placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-gold/30 resize-none"
          />
        </div>
      )}

      <Button variant="primary" size="sm" loading={submitting} disabled={blocked} onClick={submit}>
        {ready ? 'Submit to Underwriting' : 'Submit with override'}
      </Button>
    </div>
  );
}
