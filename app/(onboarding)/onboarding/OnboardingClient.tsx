'use client';

import { useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/brand/Logo';

const ROLES = [
  { v: 'admin', l: 'Owner / Admin' },
  { v: 'branch_manager', l: 'Branch Manager' },
  { v: 'loan_officer', l: 'Loan Officer' },
  { v: 'loa', l: 'Loan Officer Assistant' },
  { v: 'processor', l: 'Processor' },
];

export function OnboardingClient({ email }: { email: string | null }) {
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('admin');
  const [busy, setBusy] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) { toast.error('Company name is required'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/onboarding/create-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: companyName.trim(), role }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? 'Could not create your workspace'); setBusy(false); return; }
      window.location.assign('/dashboard');
    } catch {
      toast.error('Could not create your workspace');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="mb-8"><Logo size={44} /></div>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1 tracking-tight">Create your workspace</h2>
        <p className="text-gray-500 text-sm mb-6">Set up your mortgage company to get started with Ashley.</p>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-900 block mb-1.5">Company name <span className="text-red-500">*</span></label>
            <input
              type="text" required autoFocus value={companyName} onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Mortgage, LLC"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-900 block mb-1.5">Your role</label>
            <select
              value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500"
            >
              {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">Tailors your dashboard. You can invite teammates and set their roles later.</p>
          </div>
          <button
            type="submit" disabled={busy}
            className="w-full h-10 rounded-lg bg-gold-600 text-white text-sm font-semibold hover:bg-gold-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : <>Continue to dashboard <ChevronRight size={16} /></>}
          </button>
        </form>
        {email && <p className="text-center text-xs text-gray-400 mt-4">Signed in as {email}</p>}
      </div>
    </div>
  );
}
