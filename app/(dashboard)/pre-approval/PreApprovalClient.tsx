'use client';

import { useEffect, useRef, useState } from 'react';
import { FileCheck, Download, Search, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  stage: string;
}

const LOAN_PROGRAMS = [
  'Conventional 30yr', 'Conventional 15yr', 'FHA', 'VA', 'DSCR', 'Jumbo', 'Bank Statement', 'Commercial',
];
const LOAN_PURPOSES = ['Purchase', 'Refinance', 'Cash Out Refinance'];
const PROPERTY_TYPES = ['Single Family', 'Condo', 'Multi-Family 2-4', 'Investment Property'];

function plus30(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export default function PreApprovalClient() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LeadOption[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);

  const [loanAmount, setLoanAmount] = useState('');
  const [loanProgram, setLoanProgram] = useState(LOAN_PROGRAMS[0]);
  const [loanPurpose, setLoanPurpose] = useState(LOAN_PURPOSES[0]);
  const [propertyType, setPropertyType] = useState(PROPERTY_TYPES[0]);
  const [validThrough, setValidThrough] = useState(plus30());

  const [downloading, setDownloading] = useState(false);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selectedLead && query === `${selectedLead.first_name} ${selectedLead.last_name}`) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/leads?search=${encodeURIComponent(query)}`);
        if (res.ok) {
          const json = (await res.json()) as { leads: LeadOption[] };
          setResults(json.leads ?? []);
        }
      } catch {
        /* ignore */
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selectedLead]);

  const amountNum = Number(loanAmount.replace(/[^0-9.]/g, '')) || 0;
  const canGenerate = !!selectedLead && amountNum > 0;

  function selectLead(lead: LeadOption) {
    setSelectedLead(lead);
    setQuery(`${lead.first_name} ${lead.last_name}`);
    setShowResults(false);
  }

  function payload() {
    return {
      lead_id: selectedLead!.id,
      loan_amount: amountNum,
      loan_program: loanProgram,
      loan_purpose: loanPurpose,
      property_type: propertyType,
      expiration_date: validThrough,
    };
  }

  async function handleDownload() {
    if (!canGenerate) return;
    setDownloading(true);
    setError('');
    try {
      const res = await fetch('/api/pre-approval/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? 'Failed to generate PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pre-approval-${selectedLead!.first_name}-${selectedLead!.last_name}.pdf`.toLowerCase();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  }

  async function handleLog() {
    if (!canGenerate) return;
    setLogging(true);
    setError('');
    try {
      const res = await fetch('/api/pre-approval/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: selectedLead!.id, loan_amount: amountNum, loan_program: loanProgram }),
      });
      if (!res.ok) throw new Error('Failed to log to lead');
      setLogged(true);
      setTimeout(() => setLogged(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log to lead');
    } finally {
      setLogging(false);
    }
  }

  const todayFmt = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const validFmt = new Date(validThrough).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const borrowerName = selectedLead ? `${selectedLead.first_name} ${selectedLead.last_name}` : 'Borrower Name';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <FileCheck size={22} className="text-blue" />
        <h1 className="text-[24px] font-bold text-label tracking-tight">Pre-Approval Letter</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-5">
        {/* Left — form */}
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-label">Letter Details</h2>

          {/* Lead selector */}
          <div className="relative">
            <label className="block text-xs font-medium text-label-2 mb-1">Borrower (Lead)*</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-label-3" />
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedLead(null); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
                placeholder="Search leads by name or email…"
                className="w-full pl-9 pr-3 py-2 rounded-[8px] border border-border bg-bg text-sm"
              />
            </div>
            {showResults && results.length > 0 && !selectedLead && (
              <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-[10px] border border-border bg-white shadow-lg">
                {results.map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => selectLead(lead)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-bg transition-colors"
                  >
                    <span className="text-sm text-label">{lead.first_name} {lead.last_name}</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue/10 text-blue">{lead.stage}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Loan amount */}
          <div>
            <label className="block text-xs font-medium text-label-2 mb-1">Maximum Loan Amount*</label>
            <input
              type="text"
              inputMode="numeric"
              value={loanAmount ? fmtCurrency(amountNum) : ''}
              onChange={(e) => setLoanAmount(e.target.value)}
              placeholder="$500,000"
              className="w-full px-3 py-2 rounded-[8px] border border-border bg-bg text-sm"
            />
          </div>

          {/* Selects */}
          <div>
            <label className="block text-xs font-medium text-label-2 mb-1">Loan Program*</label>
            <select value={loanProgram} onChange={(e) => setLoanProgram(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-border bg-bg text-sm">
              {LOAN_PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-label-2 mb-1">Loan Purpose*</label>
              <select value={loanPurpose} onChange={(e) => setLoanPurpose(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-border bg-bg text-sm">
                {LOAN_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-label-2 mb-1">Property Type*</label>
              <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-border bg-bg text-sm">
                {PROPERTY_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-label-2 mb-1">Valid Through*</label>
            <input type="date" value={validThrough} onChange={(e) => setValidThrough(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-border bg-bg text-sm" />
          </div>

          {error && <p className="text-xs text-red">{error}</p>}
        </div>

        {/* Right — preview */}
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card overflow-hidden">
            {/* Letter preview */}
            <div className="bg-[#1D4ED8] px-6 py-5">
              <p className="text-white text-[13px] font-bold tracking-wide">MORTGAGE PRE-APPROVAL LETTER</p>
              <p className="text-[#BFD6FB] text-[10px] mt-0.5">Ashley AI Mortgage</p>
            </div>
            <div className="px-6 py-5 text-[13px] text-label leading-relaxed">
              <p className="text-label-3 text-right text-[11px]">{todayFmt}</p>
              <p className="font-bold mt-2">Re: Pre-Approval — {borrowerName}</p>
              <p className="mt-3">Dear {selectedLead?.first_name ?? 'Borrower'},</p>
              <p className="mt-2">
                This letter confirms that <span className="font-semibold">{borrowerName}</span> has been pre-approved for a{' '}
                <span className="font-semibold">{loanProgram}</span> home loan up to a maximum loan amount of{' '}
                <span className="font-semibold">{amountNum > 0 ? fmtCurrency(amountNum) : '$—'}</span>.
              </p>
              <p className="mt-2 text-label-2 text-[11px]">
                This pre-approval is based on a preliminary review of credit, income, and assets and is subject to final
                underwriting approval, appraisal, title search, and verification of all information.
              </p>

              <div className="mt-4 rounded-[8px] bg-[#EFF6FF] border border-[#1D4ED8]/40 px-4 py-3 grid grid-cols-2 gap-3">
                {[
                  ['PROPERTY TYPE', propertyType],
                  ['LOAN PURPOSE', loanPurpose],
                  ['LOAN PROGRAM', loanProgram],
                  ['VALID THROUGH', validFmt],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-[8px] font-bold text-[#1D4ED8]">{l}</p>
                    <p className="text-[12px] font-bold text-label">{v}</p>
                  </div>
                ))}
              </div>

              <p className="mt-4">Sincerely,</p>
              <div className="mt-4 border-t border-label-3 w-48 pt-1">
                <p className="font-bold">Your Loan Officer</p>
              </div>
              <p className="text-label-3 text-[9px] mt-5 border-t border-black/[0.06] pt-2">
                This pre-approval does not constitute a commitment to lend. All loans subject to credit and property approval.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              disabled={!canGenerate || downloading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue text-white text-sm font-semibold rounded-xl hover:bg-blue/90 transition-colors disabled:opacity-40"
            >
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {downloading ? 'Generating…' : 'Download PDF'}
            </button>
            <button
              onClick={handleLog}
              disabled={!canGenerate || logging}
              className={cn(
                'flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border transition-colors disabled:opacity-40',
                logged ? 'border-green/30 bg-green/10 text-green' : 'border-black/[0.10] bg-white text-label-2 hover:bg-bg'
              )}
            >
              {logged ? <Check size={15} /> : null}
              {logged ? 'Logged' : 'Log to Lead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
