'use client';

// Phase 119 — borrower identity verification form (token-gated). SSN last-4 + DOB +
// gov ID photo. Sensitive steps are lock-framed. SSN is never persisted.
import { useState } from 'react';
import { IconLock, IconShieldCheck, IconClock } from '@tabler/icons-react';

const ID_TYPES = [
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'state_id', label: 'State ID' },
  { value: 'passport', label: 'Passport' },
];

export function BorrowerIdentityVerify({ token, alreadyVerified }: { token: string; alreadyVerified: boolean }) {
  const [idType, setIdType] = useState('drivers_license');
  const [ssn4, setSsn4] = useState('');
  const [dob, setDob] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(alreadyVerified ? 'verified' : null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!/^\d{4}$/.test(ssn4)) return setError('Enter the last 4 digits of your SSN.');
    if (!file) return setError('Upload a photo of your ID.');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('idDocument', file);
      fd.append('idType', idType);
      fd.append('ssnLast4', ssn4);
      fd.append('dateOfBirth', dob);
      const res = await fetch(`/api/borrower-portal/${token}/identity`, { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) setError(d.error ?? 'Verification failed');
      else setResult(d.status);
    } finally {
      setBusy(false);
    }
  }

  if (result === 'verified') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <IconShieldCheck size={40} className="text-green-500 mx-auto" />
        <p className="mt-3 font-semibold text-gray-900">Identity verified</p>
        <p className="mt-1 text-sm text-gray-500">You now have full access to your loan portal.</p>
      </div>
    );
  }
  if (result === 'manual_review') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <IconClock size={36} className="text-[#C9A95C] mx-auto" />
        <p className="mt-3 font-semibold text-gray-900">Under review</p>
        <p className="mt-1 text-sm text-gray-500">Thanks! Your loan officer will confirm your details and follow up shortly.</p>
      </div>
    );
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-900">Verify your identity</p>
        <p className="text-xs text-gray-400">Required by federal law before accessing sensitive loan information.</p>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">ID type</span>
          <select value={idType} onChange={(e) => setIdType(e.target.value)} className={`${inputCls} bg-white mt-1`}>
            {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-[#C9A95C]/30 p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><IconLock size={14} className="text-[#C9A95C]" /> Secure verification</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-500">SSN (last 4)</span>
            <input value={ssn4} onChange={(e) => setSsn4(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" className={`${inputCls} mt-1`} placeholder="••••" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Date of birth</span>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Photo of your ID</span>
          <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#C9A95C]/10 file:px-3 file:py-1.5 file:text-[#C9A95C] file:text-sm" />
        </label>
        <p className="text-[11px] text-gray-400">Your SSN is used only to verify your identity and is never stored. Your ID is encrypted and visible only to your loan officer.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={submit} disabled={busy} className="w-full rounded-2xl bg-[#C9A95C] py-3 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">
        {busy ? 'Verifying…' : 'Verify my identity'}
      </button>
    </div>
  );
}
