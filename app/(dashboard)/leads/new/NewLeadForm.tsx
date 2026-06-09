'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, Users } from 'lucide-react';
import { OwnershipSelector } from '@/components/leads/OwnershipSelector';

interface DuplicateLead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  stage: string;
  loan_type: string | null;
  created_at: string;
}

const LOAN_TYPE_OPTIONS = [
  { value: 'conventional', label: 'Conventional' },
  { value: 'fha', label: 'FHA' },
  { value: 'va', label: 'VA' },
  { value: 'usda', label: 'USDA' },
  { value: 'jumbo', label: 'Jumbo' },
  { value: 'non_qm', label: 'Non-QM' },
  { value: 'heloc', label: 'HELOC' },
  { value: 'construction', label: 'Construction' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'dscr', label: 'DSCR' },
];

const LOAN_PURPOSE_OPTIONS = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'rate_term_refinance', label: 'Rate/Term Refinance' },
  { value: 'cash_out_refinance', label: 'Cash-Out Refinance' },
  { value: 'heloc', label: 'HELOC' },
  { value: 'construction', label: 'Construction' },
];

const STAGE_OPTIONS = [
  { value: 'new_inquiry', label: 'New Inquiry' },
  { value: 'pre_qual', label: 'Pre-Qual' },
  { value: 'application', label: 'Application' },
];

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New Inquiry',
  pre_qual: 'Pre-Qual',
  application: 'Application',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Cond. Approval',
  clear_to_close: 'Clear to Close',
  closed: 'Closed',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};

export function NewLeadForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    loan_type: '',
    loan_purpose: '',
    loan_amount: '',
    lead_source: '',
    stage: 'new_inquiry',
    sms_consent: false,
    data_ownership: 'company_generated' as 'lo_personal' | 'company_generated' | 'company_referral',
  });
  const [dupes, setDupes] = useState<DuplicateLead[]>([]);
  const [checkingDupes, setCheckingDupes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgedDupes, setAcknowledgedDupes] = useState(false);
  const [activeElsewhere, setActiveElsewhere] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Live duplicate detection — debounced as identity fields change.
  const runDupeCheck = useCallback(async () => {
    const { email, phone, first_name, last_name } = form;
    if (!email && !phone && !(first_name && last_name)) {
      setDupes([]);
      return;
    }
    setCheckingDupes(true);
    try {
      const params = new URLSearchParams();
      if (email) params.set('email', email);
      if (phone) params.set('phone', phone);
      if (first_name) params.set('first', first_name);
      if (last_name) params.set('last', last_name);
      const res = await fetch(`/api/leads/duplicates?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setDupes(json.duplicates ?? []);
      }
    } catch {
      // Non-blocking — a failed dup check should never stop lead creation.
    } finally {
      setCheckingDupes(false);
    }
  }, [form]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runDupeCheck, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.email, form.phone, form.first_name, form.last_name]);

  // Re-arm the dup acknowledgement whenever new dupes surface.
  useEffect(() => {
    setAcknowledgedDupes(false);
  }, [dupes.length]);

  // Phase 31.2a — anonymous cross-tenant active-application check (email only).
  useEffect(() => {
    const email = form.email.trim();
    if (!email || !email.includes('@')) {
      setActiveElsewhere(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/leads/check-active', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (res.ok) {
          const json = await res.json();
          setActiveElsewhere(Boolean(json.has_active_elsewhere));
        }
      } catch {
        // Non-blocking.
      }
    }, 600);
    return () => clearTimeout(t);
  }, [form.email]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (dupes.length > 0 && !acknowledgedDupes) {
      setError('Possible duplicate found. Review below, then confirm to create anyway.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          loan_amount: form.loan_amount ? Number(form.loan_amount) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Could not create lead.');
        setSubmitting(false);
        return;
      }
      router.push(`/leads/${json.lead.id}`);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Borrower identity */}
      <div className="bg-surface rounded-card shadow-card border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide">Borrower</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First name"
            value={form.first_name}
            onChange={(e) => set('first_name', e.target.value)}
            required
          />
          <Input
            label="Last name"
            value={form.last_name}
            onChange={(e) => set('last_name', e.target.value)}
            required
          />
        </div>
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          required
        />
        <Input
          label="Phone"
          type="tel"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          hint="Required to record SMS consent."
        />
      </div>

      {/* Phase 31.2a — confidential cross-tenant active-application notice */}
      {activeElsewhere && (
        <div className="bg-orange/5 border border-orange/30 rounded-card p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="text-orange flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-black leading-snug">
              <span className="font-semibold">Note:</span> This borrower may have an active application in progress
              elsewhere. Dual-application disclosure may be required depending on your state. This notice is
              confidential — visible only to you, and it reveals nothing about the other file.
            </p>
          </div>
        </div>
      )}

      {/* Possible duplicates */}
      {dupes.length > 0 && (
        <div className="bg-orange/5 border border-orange/30 rounded-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-orange flex-shrink-0" />
            <p className="text-[13px] font-semibold text-black">
              {dupes.length} possible duplicate{dupes.length > 1 ? 's' : ''} in your pipeline
            </p>
          </div>
          <div className="space-y-2">
            {dupes.map((d) => (
              <Link
                key={d.id}
                href={`/leads/${d.id}`}
                className="flex items-center justify-between gap-3 bg-surface rounded-[10px] border border-border px-3 py-2 hover:shadow-card transition-shadow"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-black truncate">
                    {d.first_name} {d.last_name}
                  </p>
                  <p className="text-[11px] text-label-2 truncate">
                    {d.email}
                    {d.phone ? ` · ${d.phone}` : ''}
                  </p>
                </div>
                <span className="text-[10px] font-medium text-label-2 bg-fill px-2 py-0.5 rounded-full flex-shrink-0">
                  {STAGE_LABELS[d.stage] ?? d.stage}
                </span>
              </Link>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[12px] text-label-2 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledgedDupes}
              onChange={(e) => setAcknowledgedDupes(e.target.checked)}
              className="rounded border-border accent-gold-600"
            />
            This is a different person — create it anyway.
          </label>
        </div>
      )}
      {checkingDupes && dupes.length === 0 && (
        <p className="flex items-center gap-1.5 text-[12px] text-label-3">
          <Users size={12} /> Checking for duplicates…
        </p>
      )}

      {/* Loan details */}
      <div className="bg-surface rounded-card shadow-card border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide">Loan</h3>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Loan type"
            placeholder="Select type"
            options={LOAN_TYPE_OPTIONS}
            value={form.loan_type}
            onChange={(e) => set('loan_type', e.target.value)}
          />
          <Select
            label="Purpose"
            placeholder="Select purpose"
            options={LOAN_PURPOSE_OPTIONS}
            value={form.loan_purpose}
            onChange={(e) => set('loan_purpose', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Loan amount"
            type="number"
            min="0"
            leftAddon={<span className="text-[13px]">$</span>}
            value={form.loan_amount}
            onChange={(e) => set('loan_amount', e.target.value)}
          />
          <Input
            label="Lead source"
            value={form.lead_source}
            onChange={(e) => set('lead_source', e.target.value)}
            placeholder="Referral, website…"
          />
        </div>
        <Select
          label="Stage"
          options={STAGE_OPTIONS}
          value={form.stage}
          onChange={(e) => set('stage', e.target.value)}
        />
      </div>

      {/* Phase 39.1 — data ownership */}
      <OwnershipSelector value={form.data_ownership} onChange={(v) => set('data_ownership', v)} />

      {/* TCPA consent */}
      <label
        className={`flex items-start gap-2.5 text-[12px] rounded-card border p-4 cursor-pointer transition-colors ${
          form.sms_consent ? 'bg-gold-50 border-gold-300' : 'bg-surface border-border'
        } ${!form.phone ? 'opacity-50' : ''}`}
      >
        <input
          type="checkbox"
          checked={form.sms_consent}
          disabled={!form.phone}
          onChange={(e) => set('sms_consent', e.target.checked)}
          className="mt-0.5 rounded border-border accent-gold-600"
        />
        <span className="text-label-2 leading-snug">
          Borrower gave express written consent to receive SMS about their loan (TCPA). Consent
          timestamp and IP are recorded. Requires a phone number.
        </span>
      </label>

      {error && (
        <p className="text-[13px] text-red bg-red/5 border border-red/20 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 justify-end">
        <Link href="/leads">
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <Button type="submit" loading={submitting}>
          Create lead
        </Button>
      </div>
    </form>
  );
}
