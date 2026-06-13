'use client';

// Phase 119 — LO identity panel: status, manual (in-person) verify, borrower link.
import { useState } from 'react';
import { IconShieldCheck, IconCopy, IconCheck } from '@tabler/icons-react';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  verified: { label: 'Verified', cls: 'bg-green-50 text-green-600' },
  manual_review: { label: 'Manual review', cls: 'bg-amber-50 text-amber-600' },
  in_review: { label: 'In review', cls: 'bg-blue-50 text-blue-600' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-500' },
  pending: { label: 'Not started', cls: 'bg-gray-100 text-gray-400' },
};

export function IdentityVerifyAdmin({ loanId, verifyUrl, initialStatus }: { loanId: string; verifyUrl: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function manualVerify() {
    setBusy(true);
    const res = await fetch(`/api/loans/${loanId}/identity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    if (res.ok) setStatus('verified');
    setBusy(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  const badge = STATUS_LABEL[status] ?? STATUS_LABEL.pending;

  return (
    <div className="max-w-xl space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2">
          <IconShieldCheck size={18} className="text-[#C9A95C]" />
          <p className="font-semibold text-gray-900">Identity verification</p>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">BSA/AML requires verifying the borrower&apos;s identity before facilitating a transaction.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
        <p className="text-sm font-semibold text-gray-900">Send to borrower</p>
        <div className="flex items-center gap-2">
          <input readOnly value={verifyUrl} className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600" />
          <button onClick={copyLink} className="inline-flex items-center gap-1 rounded-xl bg-[#C9A95C] px-3 py-2 text-xs font-medium text-white hover:brightness-95">
            {copied ? <IconCheck size={13} /> : <IconCopy size={13} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {status !== 'verified' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-900">Verified in person?</p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. Reviewed driver's license at closing table" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 resize-none" />
          <button onClick={manualVerify} disabled={busy} className="rounded-xl bg-[#C9A95C] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">
            {busy ? 'Saving…' : 'Mark identity verified'}
          </button>
        </div>
      )}
    </div>
  );
}
