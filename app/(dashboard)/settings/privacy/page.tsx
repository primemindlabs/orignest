'use client';

/**
 * Phase 38 follow-up — Privacy & Data settings (CCPA self-service).
 * Download My Data (JSON export), Delete My Account (soft-delete w/ confirm),
 * and the analytics opt-out toggle.
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Trash2, ShieldCheck, Loader2 } from 'lucide-react';

const GOLD = '#C9A95C';

export default function PrivacySettingsPage() {
  const [busy, setBusy] = useState<null | 'download' | 'delete'>(null);
  const [msg, setMsg] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [optOut, setOptOut] = useState(false);
  const [deletionRequestedAt, setDeletionRequestedAt] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/compliance/preferences');
    if (res.ok) {
      const d = await res.json();
      setOptOut(!!d.analytics_opt_out);
      setDeletionRequestedAt(d.deletion_requested_at ?? null);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function downloadData() {
    setBusy('download');
    setMsg(null);
    try {
      const res = await fetch('/api/compliance/data-export');
      if (res.status === 429) {
        const d = await res.json();
        setMsg({ kind: 'error', text: d.message ?? 'You can request one export every 24 hours.' });
        return;
      }
      if (!res.ok) {
        setMsg({ kind: 'error', text: 'Export failed. Please try again.' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ashleyiq-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg({ kind: 'info', text: 'Your data export has downloaded.' });
    } finally {
      setBusy(null);
    }
  }

  async function toggleOptOut(next: boolean) {
    setOptOut(next); // optimistic
    const res = await fetch('/api/compliance/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analytics_opt_out: next }),
    });
    if (!res.ok) setOptOut(!next); // revert on failure
  }

  async function deleteAccount() {
    setBusy('delete');
    setMsg(null);
    try {
      const res = await fetch('/api/compliance/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setDeletionRequestedAt(d.deletion_requested_at ?? new Date().toISOString());
        setConfirmDelete(false);
        setMsg({ kind: 'info', text: d.message ?? 'Your account deletion request has been recorded.' });
      } else {
        setMsg({ kind: 'error', text: d.error ?? 'Could not submit deletion request.' });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3">
          <ArrowLeft size={14} /> Settings
        </Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight flex items-center gap-2">
          <ShieldCheck size={20} style={{ color: GOLD }} /> Privacy &amp; Data
        </h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Manage your data under CCPA. Download a copy of your data, opt out of product analytics, or request account deletion.
        </p>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-[12px] text-sm border ${msg.kind === 'error' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-[#F5EFE0] border-[#C9A95C]/40 text-[#8A6310]'}`}>
          {msg.text}
        </div>
      )}

      {/* Download my data */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold text-[var(--c-text)]">Download my data</p>
          <p className="text-[12px] text-[var(--c-label2)] mt-0.5">A JSON bundle of your leads, communications, consent records, and AI memory. One export per 24 hours.</p>
        </div>
        <button onClick={downloadData} disabled={busy !== null} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[10px] text-sm font-medium text-white disabled:opacity-50 flex-shrink-0" style={{ background: GOLD }}>
          {busy === 'download' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download
        </button>
      </div>

      {/* Analytics opt-out */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold text-[var(--c-text)]">Opt out of product analytics</p>
          <p className="text-[12px] text-[var(--c-label2)] mt-0.5">Stop sharing anonymized usage analytics that help improve the product.</p>
        </div>
        <button
          role="switch"
          aria-checked={optOut}
          onClick={() => toggleOptOut(!optOut)}
          className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
          style={{ background: optOut ? GOLD : '#D6D6D6' }}
        >
          <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: optOut ? 'translateX(20px)' : 'none' }} />
        </button>
      </div>

      {/* Delete account */}
      <div className="bg-[var(--c-surface)] border border-red-200 rounded-[14px] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold text-red-600">Delete my account</p>
            <p className="text-[12px] text-[var(--c-label2)] mt-0.5">Request permanent deletion of your account and data. Processed within 30 days.</p>
          </div>
          {deletionRequestedAt ? (
            <span className="text-[12px] text-[var(--c-label2)] flex-shrink-0">Requested {new Date(deletionRequestedAt).toLocaleDateString()}</span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} disabled={busy !== null} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[10px] text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 flex-shrink-0">
              <Trash2 size={15} /> Delete account
            </button>
          )}
        </div>
      </div>

      {/* Confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[17px] font-bold text-[var(--c-text)]">Delete your account?</h2>
            <p className="text-[13px] text-[var(--c-label2)] mt-2">
              This requests permanent deletion of your account and associated data. Your data is removed within 30 days per our retention policy. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmDelete(false)} className="h-9 px-4 rounded-[10px] text-sm font-medium border border-[var(--c-border)] text-[var(--c-text)]">Cancel</button>
              <button onClick={deleteAccount} disabled={busy === 'delete'} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[10px] text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                {busy === 'delete' ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Yes, delete my account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
