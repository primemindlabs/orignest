'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Building2, Phone, Mail, Globe, Star, StarOff,
  Plus, Trash2, ChevronDown, ChevronUp, MessageSquare, Upload,
  CheckCircle2, Circle, Edit2,
} from 'lucide-react';
import { cn, formatPhone, timeAgo } from '@/lib/utils';
import { toast } from 'sonner';

interface LenderProduct {
  id: string;
  loan_type: string;
  min_fico: number | null;
  max_ltv: number | null;
  max_dti: number | null;
  max_loan_amount: number | null;
  overlay_notes: string | null;
}

interface CommLogEntry {
  id: string;
  note: string;
  created_at: string;
  profiles: { full_name: string } | null;
}

interface Lender {
  id: string;
  name: string;
  channel: string;
  website: string | null;
  ae_name: string | null;
  ae_phone: string | null;
  ae_email: string | null;
  products: string[];
  licensed_states: string[];
  min_fico: number | null;
  max_ltv: number | null;
  specialty_tags: string[];
  avg_turnaround_days: number | null;
  is_preferred: boolean;
  notes: string | null;
  loans_submitted: number;
  loans_closed: number;
  avg_days_to_close: number | null;
}

interface Props {
  lender: Lender;
  products: LenderProduct[];
  commLog: CommLogEntry[];
  orgId: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  wholesale: 'Wholesale',
  correspondent: 'Correspondent',
  direct: 'Direct',
  hard_money: 'Hard Money',
  private: 'Private',
};

const SUBMISSION_CHECKLIST = [
  '1003 / Uniform Residential Loan Application',
  'Credit authorization signed',
  'Government-issued photo ID',
  'Most recent 2 years W-2s',
  'Most recent 2 years federal tax returns',
  '30-day pay stubs (most recent)',
  'Most recent 2 months bank statements (all pages)',
  'Signed purchase contract or refinance authorization',
  'Property address and legal description',
  'Appraisal ordered / report',
  'Title commitment',
  'Homeowners insurance declaration page',
];

export default function LenderDetailClient({ lender, products, commLog, orgId }: Props) {
  const router = useRouter();
  const [preferred, setPreferred] = useState(lender.is_preferred);
  const [expandedProducts, setExpandedProducts] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [localCommLog, setLocalCommLog] = useState(commLog);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const pullThrough =
    lender.loans_submitted > 0
      ? Math.round((lender.loans_closed / lender.loans_submitted) * 100)
      : null;

  async function togglePreferred() {
    const next = !preferred;
    setPreferred(next);
    const res = await fetch(`/api/lenders/${lender.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_preferred: next }),
    });
    if (!res.ok) {
      setPreferred(!next);
      toast.error('Failed to update preference');
    } else {
      toast.success(next ? 'Marked as preferred' : 'Removed from preferred');
    }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/lenders/${lender.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote }),
      });
      if (!res.ok) throw new Error();
      const { data } = await res.json() as { data: CommLogEntry };
      setLocalCommLog((prev) => [data, ...prev]);
      setNewNote('');
      toast.success('Note added');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setSavingNote(false);
    }
  }

  function toggleCheckItem(i: number) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div>
        <button
          onClick={() => router.push('/lenders')}
          className="flex items-center gap-1.5 text-sm text-label2 hover:text-label mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Lender Marketplace
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-navy/[0.06] flex items-center justify-center flex-shrink-0">
              <Building2 className="w-7 h-7 text-navy/40" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[22px] font-semibold text-navy tracking-tight">{lender.name}</h1>
                {preferred && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-gold bg-gold/10 px-2 py-0.5 rounded-full">
                    <Star className="w-2.5 h-2.5 fill-gold" />
                    Preferred
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-label2">
                <span>{CHANNEL_LABELS[lender.channel] ?? lender.channel}</span>
                {lender.avg_turnaround_days && (
                  <span>~{lender.avg_turnaround_days} day turnaround</span>
                )}
                <span>{lender.licensed_states.length} states</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={togglePreferred}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors',
                preferred
                  ? 'border-gold/40 text-gold bg-gold/[0.05] hover:bg-gold/[0.1]'
                  : 'border-black/[0.1] text-label2 bg-white hover:bg-black/[0.02]'
              )}
            >
              {preferred ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />}
              {preferred ? 'Remove Preferred' : 'Mark Preferred'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Main content — 2/3 */}
        <div className="col-span-2 space-y-5">
          {/* Performance stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Submitted', value: lender.loans_submitted.toString() },
              { label: 'Closed', value: lender.loans_closed.toString() },
              { label: 'Pull-Through', value: pullThrough !== null ? `${pullThrough}%` : '—' },
              { label: 'Avg Days to Close', value: lender.avg_days_to_close ? `${lender.avg_days_to_close}d` : '—' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white border border-black/[0.06] rounded-2xl p-4 shadow-sm text-center">
                <p className="text-[22px] font-semibold text-navy font-mono tracking-tight">{stat.value}</p>
                <p className="text-[11px] text-label2 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Product matrix */}
          <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => setExpandedProducts((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 border-b border-black/[0.06] hover:bg-black/[0.01]"
            >
              <h3 className="text-sm font-semibold text-navy">Product Matrix</h3>
              {expandedProducts ? <ChevronUp className="w-4 h-4 text-label3" /> : <ChevronDown className="w-4 h-4 text-label3" />}
            </button>
            {expandedProducts && (
              products.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-label2">No product guidelines added yet.</p>
                  <p className="text-xs text-label3 mt-1">Add loan type guidelines to enable per-product matching.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-black/[0.02] border-b border-black/[0.04]">
                        <th className="text-left px-5 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Loan Type</th>
                        <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Min FICO</th>
                        <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Max LTV</th>
                        <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Max DTI</th>
                        <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Max Loan</th>
                        <th className="text-left px-5 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Overlay Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {products.map((p) => (
                        <tr key={p.id} className="hover:bg-black/[0.01] transition-colors">
                          <td className="px-5 py-3.5 font-medium text-navy">{p.loan_type}</td>
                          <td className="px-4 py-3.5 text-right font-mono text-label">{p.min_fico ?? '—'}</td>
                          <td className="px-4 py-3.5 text-right font-mono text-label">{p.max_ltv != null ? `${p.max_ltv}%` : '—'}</td>
                          <td className="px-4 py-3.5 text-right font-mono text-label">{p.max_dti != null ? `${p.max_dti}%` : '—'}</td>
                          <td className="px-4 py-3.5 text-right font-mono text-label">
                            {p.max_loan_amount != null
                              ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(p.max_loan_amount)
                              : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-label2 max-w-[280px]">{p.overlay_notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          {/* Submission checklist */}
          <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-navy">Submission Checklist</h3>
              <span className="text-xs text-label3">{checkedItems.size} / {SUBMISSION_CHECKLIST.length} items</span>
            </div>
            <div className="space-y-2">
              {SUBMISSION_CHECKLIST.map((item, i) => (
                <button
                  key={i}
                  onClick={() => toggleCheckItem(i)}
                  className="w-full flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-black/[0.02] transition-colors text-left"
                >
                  {checkedItems.has(i)
                    ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                    : <Circle className="w-4 h-4 text-label3 flex-shrink-0" />}
                  <span className={cn('text-sm', checkedItems.has(i) ? 'text-label2 line-through' : 'text-label')}>
                    {item}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Communication log */}
          <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-navy mb-4">Communication Log</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }}
                placeholder="Add a note about this lender relationship..."
                className="flex-1 px-3 py-2 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30"
              />
              <button
                onClick={addNote}
                disabled={savingNote || !newNote.trim()}
                className="px-4 py-2 rounded-xl bg-[#C9A95C] text-white text-sm font-medium hover:bg-[#B08D3C] disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>
            {localCommLog.length === 0 ? (
              <div className="text-center py-6">
                <MessageSquare className="w-7 h-7 text-label3 mx-auto mb-2" />
                <p className="text-sm text-label2">No notes yet</p>
                <p className="text-xs text-label3 mt-0.5">Track AE conversations, pricing calls, and relationship notes here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {localCommLog.map((entry) => (
                  <div key={entry.id} className="flex gap-3 p-3 rounded-xl bg-black/[0.02]">
                    <MessageSquare className="w-4 h-4 text-label3 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-label">{entry.note}</p>
                      <p className="text-xs text-label3 mt-1">
                        {entry.profiles?.full_name ?? 'Unknown'} · {timeAgo(entry.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar — 1/3 */}
        <div className="space-y-4">
          {/* AE Contact */}
          <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-navy mb-4">Account Executive</h3>
            {lender.ae_name || lender.ae_phone || lender.ae_email ? (
              <div className="space-y-3">
                {lender.ae_name && (
                  <p className="text-sm font-medium text-label">{lender.ae_name}</p>
                )}
                {lender.ae_phone && (
                  <a href={`tel:${lender.ae_phone}`} className="flex items-center gap-2 text-sm text-label2 hover:text-blue transition-colors">
                    <Phone className="w-4 h-4" />
                    {formatPhone(lender.ae_phone)}
                  </a>
                )}
                {lender.ae_email && (
                  <a href={`mailto:${lender.ae_email}`} className="flex items-center gap-2 text-sm text-label2 hover:text-blue transition-colors break-all">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    {lender.ae_email}
                  </a>
                )}
                {lender.website && (
                  <a href={lender.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-label2 hover:text-blue transition-colors">
                    <Globe className="w-4 h-4" />
                    Website
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-label3">No contact info added.</p>
            )}
          </div>

          {/* Products */}
          <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-navy mb-3">Products</h3>
            <div className="flex flex-wrap gap-1.5">
              {lender.products.map((p) => (
                <span key={p} className="text-[11px] font-medium bg-black/[0.04] text-label2 px-2 py-1 rounded-md">
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Specialty tags */}
          {lender.specialty_tags.length > 0 && (
            <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-navy mb-3">Specialties</h3>
              <div className="flex flex-wrap gap-1.5">
                {lender.specialty_tags.map((s) => (
                  <span key={s} className="text-[11px] font-medium bg-purple/10 text-purple px-2 py-1 rounded-md">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {lender.notes && (
            <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-navy mb-2">Internal Notes</h3>
              <p className="text-sm text-label2 leading-relaxed italic">{lender.notes}</p>
            </div>
          )}

          {/* Rate sheet upload placeholder */}
          <div className="bg-white border border-dashed border-black/[0.12] rounded-2xl p-5 text-center">
            <Upload className="w-6 h-6 text-label3 mx-auto mb-2" />
            <p className="text-xs font-medium text-label2">Rate Sheet Upload</p>
            <p className="text-[11px] text-label3 mt-0.5">Upload PDF rate sheets from this lender</p>
            <p className="text-[10px] text-label3 mt-2 italic">TODO: configure Supabase Storage bucket</p>
          </div>

          {/* Licensed states */}
          <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-navy mb-3">Licensed States ({lender.licensed_states.length})</h3>
            <div className="flex flex-wrap gap-1">
              {lender.licensed_states.sort().map((s) => (
                <span key={s} className="text-[10px] font-medium bg-navy/[0.06] text-navy px-1.5 py-0.5 rounded-md font-mono">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
