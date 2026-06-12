'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  IconX,
  IconCheck,
  IconChevronRight,
  IconAlertTriangle,
  IconMail,
  IconPhone,
  IconStar,
} from '@tabler/icons-react';
import { draftAEMessage } from '@/lib/rate-lock/aeMessage';
import { estimateExtensionCost } from '@/lib/rate-lock/costEstimator';
import { CostEstimatorInputs } from './CostEstimatorInputs';
import { AEMessageEditor } from './AEMessageEditor';
import { OutcomeLogger } from './OutcomeLogger';

interface AE {
  id: string;
  lender_name: string | null;
  ae_name: string | null;
  ae_email: string | null;
  ae_phone: string | null;
  ae_cell: string | null;
  ae_title: string | null;
  preferred: boolean;
}
interface StartData {
  lead: { id: string; display_name: string; loan_amount: number | null; loan_type: string | null; stage: string; closing_date_target: string | null };
  alert: { id: string; lock_expiry_date: string; lock_ref_number: string | null; extension_status: string; business_days_left: number };
  trid_conflicts: { event_type: string; deadline_date: string }[];
  ae_connections: AE[];
}

interface Props {
  leadId: string;
  alertId: string;
  onClose: () => void;
  onComplete: () => void;
}

const GOLD = '#C9A95C';

export function RateLockExtensionModal({ leadId, onClose, onComplete }: Props) {
  const router = useRouter();
  const [data, setData] = useState<StartData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [selectedAE, setSelectedAE] = useState<AE | null>(null);
  const [cost, setCost] = useState({ bpsPerDay: 4, daysRequested: 10, totalCostDollars: 0, bpsTotal: 0 });
  const [message, setMessage] = useState('');
  const [aeSentAt, setAeSentAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch(`/api/rate-locks/${leadId}/extension/start`, { method: 'POST' });
      const json = await res.json();
      if (!active) return;
      if (!res.ok) setLoadError(json.error ?? 'Could not start extension');
      else setData(json);
    })();
    return () => {
      active = false;
    };
  }, [leadId]);

  const loanBalance = data?.lead.loan_amount ?? 0;

  // Draft seed regenerates when AE or days change.
  const draftSeed = useMemo(() => {
    if (!data) return '';
    const base = draftAEMessage({
      lockRef: data.alert.lock_ref_number,
      borrowerName: data.lead.display_name,
      daysNeeded: cost.daysRequested,
      closingTarget: data.lead.closing_date_target,
      currentStage: data.lead.stage,
    });
    return selectedAE?.ae_name ? base.replace('[AE Name]', selectedAE.ae_name.split(' ')[0]) : base;
  }, [data, cost.daysRequested, selectedAE]);

  const sendAe = useCallback(
    async (channel: 'email' | 'sms') => {
      if (!selectedAE) return;
      const sentAt = new Date().toISOString();
      setAeSentAt(sentAt);
      await fetch(`/api/rate-locks/${leadId}/extension/send-ae-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ae_connection_id: selectedAE.id, message_text: message, channel }),
      });
      setStep(4);
    },
    [selectedAE, message, leadId]
  );

  const saveOutcome = useCallback(
    async (outcome: 'approved' | 'denied' | 'pending' | 'cancelled', notes: string) => {
      if (!data) return;
      setSaving(true);
      setSaveError(null);
      const { totalCostDollars } = estimateExtensionCost({
        bpsPerDay: cost.bpsPerDay,
        daysRequested: cost.daysRequested,
        loanBalance,
      });
      const res = await fetch(`/api/rate-locks/${leadId}/extension/log-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ae_connection_id: selectedAE?.id ?? null,
          lock_expiry_date: data.alert.lock_expiry_date,
          extension_days_requested: cost.daysRequested,
          bps_per_day: cost.bpsPerDay,
          loan_balance: loanBalance,
          ae_message_text: aeSentAt ? message : null,
          ae_message_sent_at: aeSentAt,
          outcome,
          outcome_notes: notes || null,
          total_cost_est: totalCostDollars,
        }),
      });
      const json = await res.json();
      setSaving(false);
      if (!res.ok) {
        setSaveError(json.error ?? 'Could not save');
        return;
      }
      onComplete();
      onClose();
    },
    [data, cost, loanBalance, selectedAE, aeSentAt, message, leadId, onComplete, onClose]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Rate Lock Extension</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <IconX size={18} />
          </button>
        </div>

        {/* Step bar */}
        <div className="flex items-center justify-center gap-1 px-5 py-3 border-b border-gray-50">
          {[1, 2, 3, 4].map((n, i) => (
            <div key={n} className="flex items-center">
              <div
                aria-label={`Step ${n}`}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold"
                style={
                  n < step
                    ? { background: '#22c55e', color: '#fff' }
                    : n === step
                      ? { background: GOLD, color: '#fff' }
                      : { border: '1px solid #e5e7eb', color: '#9ca3af' }
                }
              >
                {n < step ? <IconCheck size={12} /> : n}
              </div>
              {i < 3 && <IconChevronRight size={14} className="text-gray-300 mx-0.5" />}
            </div>
          ))}
        </div>

        <div className="p-5">
          {loadError ? (
            <p className="text-sm text-red-600 py-6 text-center">{loadError}</p>
          ) : !data ? (
            <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
          ) : step === 1 ? (
            <Step1 data={data} onNext={() => setStep(2)} />
          ) : step === 2 ? (
            <Step2
              aes={data.ae_connections}
              onSelect={(ae) => {
                setSelectedAE(ae);
                setStep(3);
              }}
              onAddAE={() => router.push('/ae-connect')}
            />
          ) : step === 3 ? (
            <Step3
              ae={selectedAE}
              loanBalance={loanBalance}
              draftSeed={draftSeed}
              onCost={setCost}
              onMessage={setMessage}
              onSendEmail={() => sendAe('email')}
              onSendText={() => sendAe('sms')}
              onSkip={() => setStep(4)}
              message={message}
            />
          ) : (
            <div className="space-y-3">
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              <OutcomeLogger onSave={saveOutcome} saving={saving} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Step1({ data, onNext }: { data: StartData; onNext: () => void }) {
  const bdl = data.alert.business_days_left;
  const badgeCls =
    bdl <= 2 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200';
  const expiry = new Date(data.alert.lock_expiry_date);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-gray-900">{data.lead.display_name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{format(expiry, 'EEEE, MMMM d')}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full border text-xs font-medium ${badgeCls}`}>
          {bdl <= 0 ? 'Expired' : `${bdl} business day${bdl === 1 ? '' : 's'} left`}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Stage" value={(data.lead.stage ?? '').replace(/_/g, ' ')} />
        <Field
          label="Loan amount"
          value={data.lead.loan_amount != null ? `$${Math.round(data.lead.loan_amount).toLocaleString()}` : '—'}
        />
        <Field
          label="Target closing"
          value={data.lead.closing_date_target ? format(new Date(data.lead.closing_date_target), 'MMM d') : '—'}
        />
        <Field label="Lock ref" value={data.alert.lock_ref_number ?? '—'} />
      </dl>

      {data.trid_conflicts.length > 0 && (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <IconAlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            <span className="font-semibold">TRID deadline conflict — </span>A disclosure deadline falls within
            the lock window. Confirm all timelines with your processor before requesting extension.
          </p>
        </div>
      )}

      <button
        onClick={onNext}
        className="w-full py-2.5 rounded-xl bg-[#C9A95C] text-white text-sm font-semibold hover:brightness-95 transition-colors"
      >
        Start Extension Request →
      </button>
    </div>
  );
}

function Step2({ aes, onSelect, onAddAE }: { aes: AE[]; onSelect: (ae: AE) => void; onAddAE: () => void }) {
  if (aes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500">No AE contacts on file.</p>
        <button onClick={onAddAE} className="mt-2 text-sm font-medium text-[#C9A95C] hover:underline">
          Add AE Contact →
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-1">Choose the AE to contact:</p>
      {aes.map((ae) => (
        <button
          key={ae.id}
          onClick={() => onSelect(ae)}
          className="w-full text-left rounded-xl border border-gray-100 p-3 hover:border-[#C9A95C]/30 transition-colors"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">{ae.ae_name ?? 'AE'}</p>
            {ae.preferred && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-[#C9A95C]">
                <IconStar size={11} /> Preferred
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">{ae.lender_name ?? ''}{ae.ae_title ? ` · ${ae.ae_title}` : ''}</p>
          <div className="flex gap-3 mt-1 text-[11px] text-gray-500">
            {ae.ae_email && (
              <span className="inline-flex items-center gap-1">
                <IconMail size={12} /> {ae.ae_email}
              </span>
            )}
            {(ae.ae_cell || ae.ae_phone) && (
              <span className="inline-flex items-center gap-1">
                <IconPhone size={12} /> {ae.ae_cell ?? ae.ae_phone}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function Step3({
  ae,
  loanBalance,
  draftSeed,
  message,
  onCost,
  onMessage,
  onSendEmail,
  onSendText,
  onSkip,
}: {
  ae: AE | null;
  loanBalance: number;
  draftSeed: string;
  message: string;
  onCost: (c: { bpsPerDay: number; daysRequested: number; totalCostDollars: number; bpsTotal: number }) => void;
  onMessage: (t: string) => void;
  onSendEmail: () => void;
  onSendText: () => void;
  onSkip: () => void;
}) {
  const subject = 'Rate Lock Extension Request';
  const mailto = ae?.ae_email
    ? `mailto:${ae.ae_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
    : null;
  const smsHref = ae?.ae_cell ? `sms:${ae.ae_cell}` : null;

  return (
    <div className="space-y-4">
      <CostEstimatorInputs loanBalance={loanBalance} onChange={onCost} />

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">Message to AE</p>
        <AEMessageEditor initialMessage={draftSeed} onMessageChange={onMessage} />
      </div>

      <div className="flex flex-wrap gap-2">
        {mailto && (
          <a
            href={mailto}
            onClick={onSendEmail}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#C9A95C] px-3 py-2 text-xs font-medium text-white hover:brightness-95"
          >
            <IconMail size={14} /> Email AE
          </a>
        )}
        {smsHref && (
          <a
            href={smsHref}
            onClick={onSendText}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <IconPhone size={14} /> Text AE
          </a>
        )}
        <button
          onClick={onSkip}
          className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50"
        >
          Skip Send / Log Call →
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-gray-800 capitalize">{value}</dd>
    </div>
  );
}
