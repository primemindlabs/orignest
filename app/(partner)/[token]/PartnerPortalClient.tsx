'use client';

import { useState } from 'react';
import { Users, TrendingUp, CheckCircle, DollarSign, Plus, Phone, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New',
  pre_qualified: 'Pre-Qualified',
  application_started: 'Application',
  application_complete: 'App Complete',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Cond. Approval',
  clear_to_close: 'Clear to Close',
  closing_scheduled: 'Closing Scheduled',
  closed: 'Closed',
  dead: 'On Hold',
};

const STAGE_COLORS: Record<string, string> = {
  new_inquiry: 'bg-black/[0.06] text-label-2',
  pre_qualified: 'bg-blue/10 text-blue',
  application_started: 'bg-blue/10 text-blue',
  application_complete: 'bg-green/10 text-green',
  processing: 'bg-green/10 text-green',
  underwriting: 'bg-orange/10 text-orange',
  conditional_approval: 'bg-orange/10 text-orange',
  clear_to_close: 'bg-gold/20 text-amber-700',
  closing_scheduled: 'bg-gold/20 text-amber-700',
  closed: 'bg-navy/10 text-navy',
  dead: 'bg-red/10 text-red',
};

interface Props {
  data: {
    partner: { name: string; company: string; type: string };
    lo: {
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
      nmls_id: string | null;
      avatar_url: string | null;
      title: string | null;
    } | null;
    stats: { total: number; inPipeline: number; closed: number; totalVolume: string };
    leads: Array<{
      id: string;
      borrower: string;
      stage: string;
      daysInStage: number;
      closingDate: string | null;
      loanAmount: string | null;
      createdAt: string;
    }>;
  };
  token: string;
}

export function PartnerPortalClient({ data, token }: Props) {
  const { partner, lo, stats, leads } = data;

  const [showReferralForm, setShowReferralForm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('purchase');
  const [estPrice, setEstPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [totalReferred, setTotalReferred] = useState(stats.total);

  async function handleSubmitReferral(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/partner-portal/${token}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          property_address: propertyAddress || undefined,
          loan_purpose: loanPurpose,
          estimated_purchase_price: estPrice ? Number(estPrice.replace(/[^0-9.]/g, '')) : undefined,
          notes: notes || undefined,
        }),
      });

      const json = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? 'Failed to submit referral');
      }

      setSuccessMsg(json.message ?? 'Referral submitted! Your loan officer will be in touch shortly.');
      setSubmitted(true);
      setShowReferralForm(false);
      setTotalReferred((n) => n + 1);
      // reset fields for any subsequent referral
      setFirstName(''); setLastName(''); setEmail(''); setPhone('');
      setPropertyAddress(''); setLoanPurpose('purchase'); setEstPrice(''); setNotes('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit referral');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Co-branded header */}
      <header className="bg-[rgba(255,255,255,0.92)] backdrop-blur-[20px] border-b border-[rgba(60,60,67,0.12)] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[8px] bg-navy flex items-center justify-center">
              <span className="text-gold text-[11px] font-bold">C</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-label">Partner Portal</p>
              <p className="text-xs text-label-3">Powered by AshleyIQ</p>
            </div>
          </div>
          {lo && (
            <div className="flex items-center gap-2.5">
              {lo.avatar_url ? (
                <img src={lo.avatar_url} alt={`${lo.first_name} ${lo.last_name}`} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-xs font-bold text-white">
                  {lo.first_name.charAt(0)}{lo.last_name.charAt(0)}
                </div>
              )}
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-label">{lo.first_name} {lo.last_name}</p>
                <p className="text-xs text-label-3">{lo.title ?? 'Loan Officer'}{lo.nmls_id ? ` · NMLS #${lo.nmls_id}` : ''}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6 space-y-5">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-label tracking-tight">
            Welcome, {partner.name}
          </h1>
          <p className="text-sm text-label-2 mt-0.5">{partner.company} · Referral Pipeline</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Referred', value: String(totalReferred), icon: Users, color: 'text-blue' },
            { label: 'In Pipeline', value: String(stats.inPipeline), icon: TrendingUp, color: 'text-orange' },
            { label: 'Closed', value: String(stats.closed), icon: CheckCircle, color: 'text-green' },
            { label: 'Volume Closed', value: stats.totalVolume, icon: DollarSign, color: 'text-navy' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-4 shadow-card">
              <s.icon size={18} className={cn('mb-2', s.color)} />
              <div className="text-xl font-bold text-label">{s.value}</div>
              <div className="text-xs text-label-2 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Send referral */}
        {!showReferralForm && (
          <button
            onClick={() => { setShowReferralForm(true); setSubmitted(false); }}
            className="w-full py-3 bg-navy text-white text-sm font-semibold rounded-[12px] hover:bg-navy/90 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Submit New Referral
          </button>
        )}

        {submitted && !showReferralForm && (
          <div className="bg-green/10 border border-green/20 rounded-[10px] px-5 py-4 text-center">
            <CheckCircle size={20} className="text-green mx-auto mb-2" />
            <p className="text-sm font-semibold text-green">Referral received!</p>
            <p className="text-xs text-green/80 mt-1">{successMsg}</p>
          </div>
        )}

        {showReferralForm && (
          <form onSubmit={handleSubmitReferral} className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-5 shadow-card space-y-4 animate-fade-in">
            <h2 className="text-sm font-semibold text-label">New Referral</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-label-2 mb-1">First Name*</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full px-3 py-2 rounded-[8px] border border-[rgba(60,60,67,0.12)] bg-[#F2F2F7] text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-label-2 mb-1">Last Name*</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="w-full px-3 py-2 rounded-[8px] border border-[rgba(60,60,67,0.12)] bg-[#F2F2F7] text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-label-2 mb-1">Phone*</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full px-3 py-2 rounded-[8px] border border-[rgba(60,60,67,0.12)] bg-[#F2F2F7] text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-label-2 mb-1">Email*</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2 rounded-[8px] border border-[rgba(60,60,67,0.12)] bg-[#F2F2F7] text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-label-2 mb-1">Property Address <span className="text-label-3">(optional)</span></label>
              <input type="text" value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-[rgba(60,60,67,0.12)] bg-[#F2F2F7] text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-label-2 mb-1">Loan Purpose</label>
                <select value={loanPurpose} onChange={(e) => setLoanPurpose(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-[rgba(60,60,67,0.12)] bg-[#F2F2F7] text-sm">
                  <option value="purchase">Purchase</option>
                  <option value="rate_term_refinance">Refinance</option>
                  <option value="cash_out_refinance">Cash Out</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-label-2 mb-1">Est. Purchase Price <span className="text-label-3">(optional)</span></label>
                <input type="text" inputMode="numeric" value={estPrice} onChange={(e) => setEstPrice(e.target.value)} placeholder="$" className="w-full px-3 py-2 rounded-[8px] border border-[rgba(60,60,67,0.12)] bg-[#F2F2F7] text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-label-2 mb-1">Notes <span className="text-label-3">(optional)</span></label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-[8px] border border-[rgba(60,60,67,0.12)] bg-[#F2F2F7] text-sm resize-none" />
            </div>
            {errorMsg && <p className="text-xs text-red">{errorMsg}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-[10px] hover:bg-navy/90 transition-colors disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Submit Referral →'}
              </button>
              <button type="button" onClick={() => { setShowReferralForm(false); setErrorMsg(''); }} className="px-4 py-2 bg-black/[0.06] text-label-2 text-sm font-medium rounded-[10px] hover:bg-black/[0.10] transition-colors">Cancel</button>
            </div>
          </form>
        )}

        {/* Pipeline table */}
        <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(60,60,67,0.06)]">
            <h2 className="text-sm font-semibold text-label">Referred Pipeline</h2>
          </div>
          {leads.length === 0 ? (
            <div className="py-12 text-center text-label-3 text-sm">No referrals yet. Send your first referral above.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(60,60,67,0.06)] bg-[#F2F2F7]">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-label-3 uppercase">Borrower</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-label-3 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-label-3 uppercase">Days</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-label-3 uppercase hidden sm:table-cell">Est. Close</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(60,60,67,0.04)]">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-[#F2F2F7] transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-label">{lead.borrower}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STAGE_COLORS[lead.stage] ?? 'bg-black/[0.06] text-label-2')}>
                        {STAGE_LABELS[lead.stage] ?? lead.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm text-label-2">{lead.daysInStage}d</td>
                    <td className="px-4 py-3.5 text-right text-sm text-label-2 hidden sm:table-cell">
                      {lead.closingDate ? new Date(lead.closingDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* LO contact */}
        {lo && (
          <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-5 shadow-card">
            <h2 className="text-sm font-semibold text-label mb-3">Your Loan Officer</h2>
            <div className="flex items-center gap-4">
              {lo.avatar_url ? (
                <img src={lo.avatar_url} alt="" className="w-12 h-12 rounded-full" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-navy flex items-center justify-center text-white font-bold">
                  {lo.first_name.charAt(0)}{lo.last_name.charAt(0)}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-label">{lo.first_name} {lo.last_name}</p>
                {lo.title && <p className="text-xs text-label-3">{lo.title}</p>}
                {lo.nmls_id && <p className="text-xs text-label-3">NMLS #{lo.nmls_id}</p>}
              </div>
              <div className="ml-auto flex gap-2">
                {lo.phone && (
                  <a href={`tel:${lo.phone}`} className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center text-navy hover:bg-navy/20 transition-colors">
                    <Phone size={15} />
                  </a>
                )}
                <a href={`mailto:${lo.email}`} className="w-9 h-9 rounded-full bg-blue/10 flex items-center justify-center text-blue hover:bg-blue/20 transition-colors">
                  <Mail size={15} />
                </a>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
