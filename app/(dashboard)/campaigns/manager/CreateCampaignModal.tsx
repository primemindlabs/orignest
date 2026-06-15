'use client';

/**
 * Create a custom campaign with AI assistance. Two phases:
 *  1. "goal"   — describe the goal in plain language → AI drafts a multi-step plan
 *  2. "review" — edit the name/steps inline, then create (lands paused for review)
 */
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Sparkles, Plus, Trash2, Mail, MessageSquare } from 'lucide-react';

interface StepPlan {
  step_number: number;
  delay_days: number;
  channel: 'email' | 'sms';
  subject: string | null;
  body: string;
  ai_personalize: boolean;
}
interface Plan {
  name: string;
  type: string;
  category: string;
  description: string;
  steps: StepPlan[];
}

export function CreateCampaignModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (campaignId: string) => void;
}) {
  const [phase, setPhase] = useState<'goal' | 'review'>('goal');
  const [goal, setGoal] = useState('');
  const [audience, setAudience] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [aiUsed, setAiUsed] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPhase('goal'); setGoal(''); setAudience(''); setPlan(null); setError(null);
    setDrafting(false); setCreating(false);
  }
  function close() { reset(); onClose(); }

  async function draft() {
    if (!goal.trim()) return;
    setDrafting(true); setError(null);
    try {
      const res = await fetch('/api/campaign-manager/draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, audience }),
      });
      if (!res.ok) { setError('Could not draft the campaign. Try again.'); return; }
      const d = await res.json();
      setPlan(d.plan); setAiUsed(d.aiUsed !== false); setPhase('review');
    } catch { setError('Network error. Try again.'); }
    finally { setDrafting(false); }
  }

  async function create() {
    if (!plan) return;
    setCreating(true); setError(null);
    try {
      const res = await fetch('/api/campaign-manager/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.campaign_id) { setError(d.error ?? 'Could not create the campaign.'); return; }
      onCreated(d.campaign_id); reset();
    } catch { setError('Network error. Try again.'); }
    finally { setCreating(false); }
  }

  function patchStep(i: number, patch: Partial<StepPlan>) {
    if (!plan) return;
    setPlan({ ...plan, steps: plan.steps.map((s, idx) => idx === i ? { ...s, ...patch } : s) });
  }
  function removeStep(i: number) {
    if (!plan) return;
    setPlan({ ...plan, steps: plan.steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, step_number: idx + 1 })) });
  }
  function addStep() {
    if (!plan) return;
    const last = plan.steps[plan.steps.length - 1];
    setPlan({ ...plan, steps: [...plan.steps, {
      step_number: plan.steps.length + 1,
      delay_days: (last?.delay_days ?? 0) + 3,
      channel: 'email', subject: '', body: '', ai_personalize: true,
    }] });
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Create campaign"
      description={phase === 'goal' ? 'Describe your goal — Ashley drafts the sequence for you.' : 'Review and tweak the steps, then create.'}
      size="xl"
      footer={
        phase === 'goal' ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] text-label-3">{error}</p>
            <Button variant="primary" onClick={draft} loading={drafting} disabled={!goal.trim()}>
              <Sparkles size={14} /> Draft with AI
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setPhase('goal')} className="text-[13px] text-label-2 hover:text-black">← Back</button>
            <div className="flex items-center gap-2">
              <p className="text-[12px] text-red-600">{error}</p>
              <Button variant="primary" onClick={create} loading={creating} disabled={!plan?.name.trim() || !plan?.steps.length}>
                Create campaign
              </Button>
            </div>
          </div>
        )
      }
    >
      {phase === 'goal' ? (
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-label-2 mb-1.5">What should this campaign do?</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              autoFocus
              placeholder="e.g. Re-engage pre-approved buyers who went quiet, nudge them back without being pushy"
              className="w-full rounded-[10px] border border-[rgba(60,60,67,0.15)] px-3 py-2.5 text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-blue/40"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-label-2 mb-1.5">Audience <span className="text-label-3">(optional)</span></label>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. First-time homebuyers in pre-approval stage"
              className="w-full rounded-[10px] border border-[rgba(60,60,67,0.15)] px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue/40"
            />
          </div>
          <p className="text-[12px] text-label-3">Steps are TCPA/RESPA-aware — no rates, payments, or guarantees. You can edit everything before it&apos;s saved.</p>
        </div>
      ) : plan ? (
        <div className="space-y-4">
          {!aiUsed && (
            <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2">
              AI key not configured — drafted from a template. Edit the steps below as needed.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-label-2 mb-1">Name</label>
              <input value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })}
                className="w-full rounded-[8px] border border-[rgba(60,60,67,0.15)] px-3 py-2 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-label-2 mb-1">Type</label>
              <input value={plan.type} onChange={(e) => setPlan({ ...plan, type: e.target.value })}
                className="w-full rounded-[8px] border border-[rgba(60,60,67,0.15)] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-label-2 mb-1">Category</label>
              <input value={plan.category} onChange={(e) => setPlan({ ...plan, category: e.target.value })}
                className="w-full rounded-[8px] border border-[rgba(60,60,67,0.15)] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue/40" />
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold text-label-2 uppercase tracking-wide">{plan.steps.length} steps</p>
              <button onClick={addStep} className="inline-flex items-center gap-1 text-[12px] text-blue hover:underline"><Plus size={13} /> Add step</button>
            </div>
            {plan.steps.map((s, i) => (
              <div key={i} className="border border-[rgba(60,60,67,0.12)] rounded-[10px] p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-label-3">Step {i + 1}</span>
                  <label className="inline-flex items-center gap-1 text-[12px]">
                    Day
                    <input type="number" min={0} value={s.delay_days}
                      onChange={(e) => patchStep(i, { delay_days: Math.max(0, Number(e.target.value)) })}
                      className="w-14 rounded-[6px] border border-[rgba(60,60,67,0.15)] px-1.5 py-1 text-[12px] tabular-nums" />
                  </label>
                  <div className="inline-flex rounded-[6px] border border-[rgba(60,60,67,0.15)] overflow-hidden">
                    <button onClick={() => patchStep(i, { channel: 'email' })}
                      className={`px-2 py-1 text-[11px] inline-flex items-center gap-1 ${s.channel === 'email' ? 'bg-blue text-white' : 'text-label-2'}`}><Mail size={11} /> Email</button>
                    <button onClick={() => patchStep(i, { channel: 'sms', subject: null })}
                      className={`px-2 py-1 text-[11px] inline-flex items-center gap-1 ${s.channel === 'sms' ? 'bg-blue text-white' : 'text-label-2'}`}><MessageSquare size={11} /> SMS</button>
                  </div>
                  <label className="inline-flex items-center gap-1 text-[11px] text-label-2 ml-auto">
                    <input type="checkbox" checked={s.ai_personalize} onChange={(e) => patchStep(i, { ai_personalize: e.target.checked })} />
                    <Sparkles size={11} className="text-[var(--c-gold-deep)]" /> Personalize
                  </label>
                  <button onClick={() => removeStep(i)} className="text-label-3 hover:text-red-600" aria-label="Remove step"><Trash2 size={13} /></button>
                </div>
                {s.channel === 'email' && (
                  <input value={s.subject ?? ''} onChange={(e) => patchStep(i, { subject: e.target.value })}
                    placeholder="Subject"
                    className="w-full rounded-[6px] border border-[rgba(60,60,67,0.15)] px-2.5 py-1.5 text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-blue/40" />
                )}
                <textarea value={s.body} onChange={(e) => patchStep(i, { body: e.target.value })} rows={2}
                  placeholder="Message body"
                  className="w-full rounded-[6px] border border-[rgba(60,60,67,0.15)] px-2.5 py-1.5 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue/40" />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
