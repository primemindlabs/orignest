'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const LOAN_TYPES = [
  'Conventional', 'FHA', 'VA', 'USDA', 'Jumbo', 'Non-QM',
  'DSCR', 'Bank Statement', 'Bridge', 'Commercial', 'SBA',
  'Construction', 'ITIN', 'Foreign National', 'Fix & Flip',
];

const SPECIALTY_TAGS = [
  'Non-QM specialist', 'DSCR specialist', 'Foreign national',
  'ITIN', 'Recent credit events', 'Self-employed',
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

interface Props {
  onClose: () => void;
}

export default function AddLenderModal({ onClose }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    channel: 'wholesale',
    website: '',
    ae_name: '',
    ae_phone: '',
    ae_email: '',
    products: [] as string[],
    licensed_states: [] as string[],
    min_fico: '',
    max_ltv: '',
    specialty_tags: [] as string[],
    avg_turnaround_days: '',
    notes: '',
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function toggleArr(field: 'products' | 'licensed_states' | 'specialty_tags', val: string) {
    setForm((prev) => {
      const arr = prev[field] as string[];
      return {
        ...prev,
        [field]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Lender name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/lenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          min_fico: form.min_fico ? Number(form.min_fico) : null,
          max_ltv: form.max_ltv ? Number(form.max_ltv) : null,
          avg_turnaround_days: form.avg_turnaround_days ? Number(form.avg_turnaround_days) : null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save lender');
      toast.success('Lender added to your network');
      router.refresh();
      onClose();
    } catch {
      toast.error('Failed to save lender');
    } finally {
      setSaving(false);
    }
  }

  function toggleAllStates() {
    if (form.licensed_states.length === US_STATES.length) {
      update('licensed_states', []);
    } else {
      update('licensed_states', [...US_STATES]);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] flex-shrink-0">
          <h2 className="text-[17px] font-semibold text-navy">Add Lender</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/[0.05] transition-colors">
            <X className="w-4 h-4 text-label2" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-label2 mb-1.5">Lender Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. Summit Wholesale Lending"
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Channel</label>
              <select
                value={form.channel}
                onChange={(e) => update('channel', e.target.value)}
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30 bg-white"
              >
                <option value="wholesale">Wholesale</option>
                <option value="correspondent">Correspondent</option>
                <option value="direct">Direct</option>
                <option value="hard_money">Hard Money</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Website</label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => update('website', e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue/40"
              />
            </div>
          </div>

          {/* AE Contact */}
          <div className="border-t border-black/[0.04] pt-4">
            <p className="text-xs font-semibold text-label2 uppercase tracking-wide mb-3">Account Executive Contact</p>
            <div className="grid grid-cols-3 gap-3">
              <input type="text" placeholder="AE Name" value={form.ae_name} onChange={(e) => update('ae_name', e.target.value)} className="px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30" />
              <input type="tel" placeholder="(555) 000-0000" value={form.ae_phone} onChange={(e) => update('ae_phone', e.target.value)} className="px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30" />
              <input type="email" placeholder="ae@lender.com" value={form.ae_email} onChange={(e) => update('ae_email', e.target.value)} className="px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30" />
            </div>
          </div>

          {/* Products */}
          <div>
            <p className="text-xs font-semibold text-label2 uppercase tracking-wide mb-3">Products Offered</p>
            <div className="flex flex-wrap gap-2">
              {LOAN_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleArr('products', t)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                    form.products.includes(t)
                      ? 'bg-blue text-white border-blue'
                      : 'text-label2 border-black/[0.1] hover:border-blue/40'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Specialty Tags */}
          <div>
            <p className="text-xs font-semibold text-label2 uppercase tracking-wide mb-3">Specialty</p>
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_TAGS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleArr('specialty_tags', s)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                    form.specialty_tags.includes(s)
                      ? 'bg-purple text-white border-purple'
                      : 'text-label2 border-black/[0.1] hover:border-purple/40'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Guidelines */}
          <div className="grid grid-cols-3 gap-4 border-t border-black/[0.04] pt-4">
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Min FICO</label>
              <input type="number" min={500} max={850} value={form.min_fico} onChange={(e) => update('min_fico', e.target.value)} placeholder="620" className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Max LTV (%)</label>
              <input type="number" min={50} max={100} step={0.5} value={form.max_ltv} onChange={(e) => update('max_ltv', e.target.value)} placeholder="97.0" className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Avg Turnaround (days)</label>
              <input type="number" min={1} max={90} value={form.avg_turnaround_days} onChange={(e) => update('avg_turnaround_days', e.target.value)} placeholder="18" className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30" />
            </div>
          </div>

          {/* Licensed States */}
          <div className="border-t border-black/[0.04] pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-label2 uppercase tracking-wide">Licensed States ({form.licensed_states.length})</p>
              <button type="button" onClick={toggleAllStates} className="text-xs text-blue font-medium">
                {form.licensed_states.length === US_STATES.length ? 'Deselect All' : 'Select All 50'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {US_STATES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleArr('licensed_states', s)}
                  className={cn(
                    'w-9 h-7 rounded-md text-[11px] font-medium border transition-colors',
                    form.licensed_states.includes(s)
                      ? 'bg-navy text-white border-navy'
                      : 'text-label2 border-black/[0.1] hover:border-navy/30'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="border-t border-black/[0.04] pt-4">
            <label className="block text-xs font-semibold text-label2 mb-1.5">Internal Notes (org-specific)</label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="e.g. Great on DSCR, slow on FHA. Call Marcus for pricing exceptions."
              rows={3}
              className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30 resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/[0.06] flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-label2 hover:text-label hover:bg-black/[0.04] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.name.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0066D6] disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Saving...' : 'Add Lender'}
          </button>
        </div>
      </div>
    </div>
  );
}
