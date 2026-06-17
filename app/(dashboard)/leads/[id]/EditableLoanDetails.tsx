'use client';

// Editable Loan Details for the lead file. Saves to the canonical leads columns
// via PATCH /api/leads/[id], so edits propagate to the pipeline, PPE, LTV and
// commission everywhere. Read-only rows until "Edit"; admins/LOs can edit.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { IconPencil, IconCheck, IconX } from '@tabler/icons-react';

type Lead = {
  id: string;
  loan_purpose: string | null;
  loan_type: string | null;
  loan_amount: number | null;
  estimated_value: number | null;
  down_payment: number | null;
  property_type: string | null;
  occupancy_type: string | null;
  closing_date: string | null;
  commission_rate: number | null;
};

const PURPOSE = [['purchase', 'Purchase'], ['rate_term_refinance', 'Rate/Term Refi'], ['cash_out_refinance', 'Cash-Out Refi'], ['heloc', 'HELOC']];
const TYPE = [['conventional', 'Conventional'], ['fha', 'FHA'], ['va', 'VA'], ['usda', 'USDA'], ['jumbo', 'Jumbo'], ['dscr', 'DSCR'], ['non_qm_bank_stmt', 'Bank Statement'], ['non_qm_1099', '1099']];
const PROP = [['single_family', 'Single Family'], ['condo', 'Condo'], ['townhouse', 'Townhouse'], ['multi_family_2_4', '2–4 Unit'], ['manufactured', 'Manufactured']];
const OCC = [['primary_residence', 'Primary'], ['second_home', 'Second Home'], ['investment_property', 'Investment']];

const usd = (n: number | null) => (n != null ? `$${Number(n).toLocaleString()}` : null);
const labelOf = (opts: string[][], v: string | null) => opts.find(([k]) => k === v)?.[1] ?? (v ? v : null);

export function EditableLoanDetails({ lead, canEdit }: { lead: Lead; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(() => ({
    loan_purpose: lead.loan_purpose ?? '',
    loan_type: lead.loan_type ?? '',
    loan_amount: lead.loan_amount ?? '',
    estimated_value: lead.estimated_value ?? '',
    down_payment: lead.down_payment ?? '',
    property_type: lead.property_type ?? '',
    occupancy_type: lead.occupancy_type ?? '',
    closing_date: lead.closing_date ? String(lead.closing_date).slice(0, 10) : '',
    commission_rate: lead.commission_rate ?? '',
  }));

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const ltv =
    Number(f.loan_amount) > 0 && Number(f.estimated_value) > 0
      ? `${((Number(f.loan_amount) / Number(f.estimated_value)) * 100).toFixed(1)}%`
      : null;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? 'Could not save'); return; }
      toast.success('Loan details updated');
      setEditing(false);
      router.refresh();
    } catch {
      toast.error('Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface rounded-card shadow-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide">Loan Details</h3>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs font-medium text-[#8A6310] hover:underline">
            <IconPencil size={13} /> Edit
          </button>
        )}
        {editing && (
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 text-xs font-medium text-white bg-[#C9A95C] px-2.5 py-1 rounded-lg disabled:opacity-50">
              <IconCheck size={13} /> {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 text-xs text-label-2 px-1.5 py-1">
              <IconX size={13} /> Cancel
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2.5">
          <SelectRow label="Loan Purpose" value={f.loan_purpose} opts={PURPOSE} onChange={(v) => set('loan_purpose', v)} />
          <SelectRow label="Loan Type" value={f.loan_type} opts={TYPE} onChange={(v) => set('loan_type', v)} />
          <NumRow label="Loan Amount" value={f.loan_amount} onChange={(v) => set('loan_amount', v)} prefix="$" />
          <NumRow label="Appraised Value" value={f.estimated_value} onChange={(v) => set('estimated_value', v)} prefix="$" />
          <NumRow label="Down Payment" value={f.down_payment} onChange={(v) => set('down_payment', v)} prefix="$" />
          <div className="flex items-center justify-between"><span className="text-sm text-label-2">LTV</span><span className="text-sm font-medium text-black">{ltv ?? '—'}</span></div>
          <SelectRow label="Property Type" value={f.property_type} opts={PROP} onChange={(v) => set('property_type', v)} />
          <SelectRow label="Occupancy" value={f.occupancy_type} opts={OCC} onChange={(v) => set('occupancy_type', v)} />
          <NumRow label="Commission Rate" value={f.commission_rate} onChange={(v) => set('commission_rate', v)} suffix="%" />
          <DateRow label="Closing Date" value={f.closing_date} onChange={(v) => set('closing_date', v)} />
        </div>
      ) : (
        <div className="space-y-3">
          <Row label="Loan Purpose" value={labelOf(PURPOSE, lead.loan_purpose)} />
          <Row label="Loan Type" value={labelOf(TYPE, lead.loan_type)} />
          <Row label="Loan Amount" value={usd(lead.loan_amount)} />
          <Row label="Appraised Value" value={usd(lead.estimated_value)} />
          <Row label="LTV" value={ltv} />
          <Row label="Property Type" value={labelOf(PROP, lead.property_type)} />
          <Row label="Occupancy" value={labelOf(OCC, lead.occupancy_type)} />
          <Row label="Commission Rate" value={lead.commission_rate != null ? `${lead.commission_rate}%` : null} />
          {lead.closing_date && <Row label="Closing Date" value={new Date(lead.closing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-label-2">{label}</span>
      <span className="text-sm font-medium text-black text-right">{value ?? '—'}</span>
    </div>
  );
}

const INP = 'w-40 h-8 px-2 rounded-lg border border-border bg-white text-sm text-black text-right focus:outline-none focus:ring-1 focus:ring-[#C9A95C]';

function NumRow({ label, value, onChange, prefix, suffix }: { label: string; value: string | number; onChange: (v: string) => void; prefix?: string; suffix?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-label-2">{label}</span>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-label-3">{prefix}</span>}
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={INP} />
        {suffix && <span className="text-sm text-label-3">{suffix}</span>}
      </div>
    </div>
  );
}

function SelectRow({ label, value, opts, onChange }: { label: string; value: string; opts: string[][]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-label-2">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={INP}>
        <option value="">—</option>
        {opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </div>
  );
}

function DateRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-label-2">{label}</span>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={INP} />
    </div>
  );
}
