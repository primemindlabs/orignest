'use client';

import { useState, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ConditionalField, FormSuggestions } from '@/components/forms/ConditionalField';
import { useConditionalForm } from '@/hooks/useConditionalForm';
import { getFormSuggestions, type SmartFormValues } from '@/lib/forms/suggestions';
import { Check, X, Sparkles } from 'lucide-react';

type FieldKind = 'text' | 'number' | 'select' | 'checkbox';
interface FieldDef {
  key: string;
  label: string;
  section: SectionKey;
  kind: FieldKind;
  options?: { value: string; label: string }[];
  placeholder?: string;
  prefix?: string;
}
type SectionKey = 'loan_data' | 'property_data' | 'borrower_data' | 'employment_data' | 'declarations_data';

const SECTIONS: { key: SectionKey; title: string }[] = [
  { key: 'loan_data', title: 'Loan & Property' },
  { key: 'borrower_data', title: 'Borrower' },
  { key: 'employment_data', title: 'Employment & Income' },
  { key: 'declarations_data', title: 'Declarations' },
];

// Field registry. Conditional fields (those named in conditionalRules' `show`)
// stay hidden until their trigger fires — useConditionalForm handles that.
const FIELDS: FieldDef[] = [
  // ── Loan & Property (base) ──
  {
    key: 'loan_purpose', label: 'Loan purpose', section: 'loan_data', kind: 'select',
    options: [
      { value: 'purchase', label: 'Purchase' },
      { value: 'rate_term_refinance', label: 'Rate/Term Refinance' },
      { value: 'cash_out_refinance', label: 'Cash-Out Refinance' },
    ],
  },
  {
    key: 'loan_type', label: 'Loan type', section: 'loan_data', kind: 'select',
    options: [
      { value: 'conventional', label: 'Conventional' },
      { value: 'fha', label: 'FHA' },
      { value: 'va', label: 'VA' },
      { value: 'usda', label: 'USDA' },
      { value: 'jumbo', label: 'Jumbo' },
      { value: 'dscr', label: 'DSCR' },
    ],
  },
  { key: 'loan_amount', label: 'Loan amount', section: 'loan_data', kind: 'number', prefix: '$' },
  {
    key: 'property_type', label: 'Property type', section: 'loan_data', kind: 'select',
    options: [
      { value: 'single_family', label: 'Single Family' },
      { value: 'condo', label: 'Condo' },
      { value: 'townhouse', label: 'Townhouse' },
      { value: '2_4_unit', label: '2–4 Unit' },
    ],
  },
  {
    key: 'occupancy_type', label: 'Occupancy', section: 'loan_data', kind: 'select',
    options: [
      { value: 'primary_residence', label: 'Primary Residence' },
      { value: 'second_home', label: 'Second Home' },
      { value: 'investment', label: 'Investment Property' },
    ],
  },
  { key: 'property_address', label: 'Property address', section: 'loan_data', kind: 'text' },
  { key: 'purchase_price', label: 'Purchase price', section: 'loan_data', kind: 'number', prefix: '$' },
  // Loan-purpose conditionals
  { key: 'purchase_contract_signed', label: 'Purchase contract signed?', section: 'loan_data', kind: 'checkbox' },
  { key: 'listing_agent_name', label: 'Listing agent', section: 'loan_data', kind: 'text' },
  { key: 'current_loan_balance', label: 'Current loan balance', section: 'loan_data', kind: 'number', prefix: '$' },
  { key: 'current_rate', label: 'Current rate (%)', section: 'loan_data', kind: 'number' },
  { key: 'reason_for_refinance', label: 'Reason for refinance', section: 'loan_data', kind: 'text' },
  { key: 'requested_cash_out', label: 'Requested cash out', section: 'loan_data', kind: 'number', prefix: '$' },
  { key: 'cash_out_purpose', label: 'Cash-out purpose', section: 'loan_data', kind: 'text' },
  // Occupancy / property conditionals
  { key: 'rental_income_monthly', label: 'Monthly rental income', section: 'loan_data', kind: 'number', prefix: '$' },
  { key: 'property_manager_name', label: 'Property manager', section: 'loan_data', kind: 'text' },
  { key: 'lease_expiration_date', label: 'Lease expiration', section: 'loan_data', kind: 'text', placeholder: 'YYYY-MM-DD' },
  { key: 'entity_name', label: 'Holding entity name', section: 'loan_data', kind: 'text' },
  { key: 'rental_income_per_unit', label: 'Rental income / unit', section: 'loan_data', kind: 'number', prefix: '$' },
  { key: 'units_occupied', label: 'Units occupied', section: 'loan_data', kind: 'number' },
  // Loan-type conditionals
  { key: 'va_service_dates', label: 'VA service dates', section: 'loan_data', kind: 'text' },
  { key: 'va_certificate_type', label: 'VA certificate type', section: 'loan_data', kind: 'text' },
  { key: 'va_disability_status', label: 'VA disability status', section: 'loan_data', kind: 'text' },
  { key: 'va_funding_fee_exempt', label: 'Funding fee exempt?', section: 'loan_data', kind: 'checkbox' },
  { key: 'fha_case_number', label: 'FHA case number', section: 'loan_data', kind: 'text' },
  { key: 'fha_connection_id', label: 'FHA connection ID', section: 'loan_data', kind: 'text' },
  { key: 'energy_efficient_mortgage', label: 'Energy-efficient mortgage?', section: 'loan_data', kind: 'checkbox' },
  { key: 'dscr_entity_name', label: 'DSCR entity name', section: 'loan_data', kind: 'text' },
  { key: 'dscr_entity_type', label: 'DSCR entity type', section: 'loan_data', kind: 'text' },
  { key: 'rental_income_verified', label: 'Rental income verified?', section: 'loan_data', kind: 'checkbox' },
  { key: 'dscr_no_income_verification', label: 'No income verification (DSCR)?', section: 'loan_data', kind: 'checkbox' },

  // ── Borrower ──
  {
    key: 'citizenship', label: 'Citizenship', section: 'borrower_data', kind: 'select',
    options: [
      { value: 'us_citizen', label: 'U.S. Citizen' },
      { value: 'permanent_resident', label: 'Permanent Resident' },
      { value: 'non_permanent_resident', label: 'Non-Permanent Resident' },
    ],
  },
  { key: 'credit_score', label: 'Credit score', section: 'borrower_data', kind: 'number' },
  { key: 'has_co_borrower', label: 'Has co-borrower?', section: 'borrower_data', kind: 'checkbox' },
  // Conditionals
  { key: 'visa_type', label: 'Visa type', section: 'borrower_data', kind: 'text' },
  { key: 'visa_expiration', label: 'Visa expiration', section: 'borrower_data', kind: 'text', placeholder: 'YYYY-MM-DD' },
  { key: 'employment_authorization_card', label: 'EAD card on file?', section: 'borrower_data', kind: 'checkbox' },
  { key: 'co_borrower_section', label: 'Co-borrower name', section: 'borrower_data', kind: 'text' },

  // ── Employment & Income ──
  {
    key: 'employment_type', label: 'Employment type', section: 'employment_data', kind: 'select',
    options: [
      { value: 'w2', label: 'W-2 Employee' },
      { value: 'self_employed', label: 'Self-Employed' },
      { value: 'retired', label: 'Retired' },
    ],
  },
  { key: 'employment_gap_months', label: 'Employment gap (months)', section: 'employment_data', kind: 'number' },
  // Self-employed conditionals
  { key: 'business_name', label: 'Business name', section: 'employment_data', kind: 'text' },
  { key: 'business_start_date', label: 'Business start date', section: 'employment_data', kind: 'text', placeholder: 'YYYY-MM-DD' },
  { key: 'business_ownership_percentage', label: 'Ownership %', section: 'employment_data', kind: 'number' },
  { key: 'business_type', label: 'Business type', section: 'employment_data', kind: 'text' },
  { key: 'years_self_employed', label: 'Years self-employed', section: 'employment_data', kind: 'number' },
  { key: 'business_shows_loss', label: 'Business shows a loss?', section: 'employment_data', kind: 'checkbox' },
  // Retired conditionals
  { key: 'retirement_income_source', label: 'Retirement income source', section: 'employment_data', kind: 'text' },
  { key: 'pension_start_date', label: 'Pension start date', section: 'employment_data', kind: 'text', placeholder: 'YYYY-MM-DD' },
  { key: 'ss_income_monthly', label: 'Social Security income / mo', section: 'employment_data', kind: 'number', prefix: '$' },

  // ── Declarations ──
  { key: 'has_bankruptcy', label: 'Bankruptcy in last 7 years?', section: 'declarations_data', kind: 'checkbox' },
  { key: 'bankruptcy_type', label: 'Bankruptcy type', section: 'declarations_data', kind: 'text' },
  { key: 'bankruptcy_discharge_date', label: 'Discharge date', section: 'declarations_data', kind: 'text', placeholder: 'YYYY-MM-DD' },
  { key: 'bankruptcy_dismissal_date', label: 'Dismissal date', section: 'declarations_data', kind: 'text', placeholder: 'YYYY-MM-DD' },
  { key: 'has_foreclosure', label: 'Foreclosure in last 7 years?', section: 'declarations_data', kind: 'checkbox' },
  { key: 'foreclosure_date', label: 'Foreclosure date', section: 'declarations_data', kind: 'text', placeholder: 'YYYY-MM-DD' },
  { key: 'foreclosure_property_address', label: 'Foreclosed property address', section: 'declarations_data', kind: 'text' },
];

interface Props {
  leadId: string;
  initialValues: Record<string, unknown>;
  initialStatus: string;
}

export function Smart1003Form({ leadId, initialValues, initialStatus }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  const { isVisible, conditionalFields, hiddenCount } = useConditionalForm(values);

  function set(key: string, value: unknown) {
    setValues((v) => ({ ...v, [key]: value }));
    setSavedMsg(null);
  }

  const num = (k: string): number | null => {
    const n = Number(values[k]);
    return Number.isFinite(n) && values[k] !== '' && values[k] != null ? n : null;
  };

  // Live underwriting suggestions (deterministic engine).
  const suggestions = useMemo(() => {
    const loanAmount = num('loan_amount');
    const purchasePrice = num('purchase_price');
    const ltv =
      loanAmount && purchasePrice && purchasePrice > 0
        ? Math.round((loanAmount / purchasePrice) * 100)
        : null;
    const sv: SmartFormValues = {
      credit_score: num('credit_score'),
      ltv,
      loan_type: (values.loan_type as string) ?? null,
      loan_amount: loanAmount,
      employment_type: (values.employment_type as string) ?? null,
      business_shows_loss: !!values.business_shows_loss,
      employment_gap_months: num('employment_gap_months'),
    };
    return getFormSuggestions(sv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const save = useCallback(
    async (newStatus?: 'draft' | 'submitted') => {
      setSaving(true);
      setSavedMsg(null);
      // Split flat values back into section blobs.
      const sections: Record<string, Record<string, unknown>> = {
        loan_data: {}, property_data: {}, borrower_data: {}, employment_data: {}, declarations_data: {},
      };
      for (const f of FIELDS) {
        const v = values[f.key];
        if (v === '' || v == null) continue;
        sections[f.section][f.key] = f.kind === 'number' ? Number(v) : v;
      }
      try {
        const res = await fetch(`/api/leads/${leadId}/application`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sections, status: newStatus }),
        });
        const json = await res.json();
        if (!res.ok) {
          setSavedMsg({ ok: false, msg: json.error ?? 'Could not save.' });
        } else {
          if (newStatus) setStatus(json.application.status);
          setSavedMsg({ ok: true, msg: newStatus === 'submitted' ? 'Submitted.' : 'Saved.' });
        }
      } catch {
        setSavedMsg({ ok: false, msg: 'Network error.' });
      } finally {
        setSaving(false);
      }
    },
    [values, leadId]
  );

  // Count visible fields for the progress hint.
  const totalConditional = conditionalFields.size;

  return (
    <div className="space-y-5">
      {/* Live suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-label-2">
            <Sparkles size={13} className="text-gold-600" />
            Underwriting guidance
          </div>
          <FormSuggestions suggestions={suggestions} />
        </div>
      )}

      {SECTIONS.map((section) => {
        const sectionFields = FIELDS.filter((f) => f.section === section.key && isVisible(f.key));
        return (
          <div key={section.key} className="bg-surface rounded-card shadow-card border border-border p-5">
            <h3 className="text-sm font-semibold text-black mb-4">{section.title}</h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              {sectionFields.map((f) => (
                <ConditionalField key={f.key} visible={isVisible(f.key)}>
                  <FieldInput field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
                </ConditionalField>
              ))}
            </div>
          </div>
        );
      })}

      {totalConditional > 0 && (
        <p className="text-[12px] text-label-3">
          {totalConditional - hiddenCount} of {totalConditional} conditional fields shown — the form
          reveals only what this loan needs.
        </p>
      )}

      <div className="flex items-center gap-3 justify-end sticky bottom-0 bg-bg/80 backdrop-blur py-3">
        {savedMsg && (
          <span
            className={`inline-flex items-center gap-1.5 text-[13px] ${
              savedMsg.ok ? 'text-green' : 'text-red'
            }`}
          >
            {savedMsg.ok ? <Check size={14} /> : <X size={14} />}
            {savedMsg.msg}
          </span>
        )}
        {status === 'submitted' && (
          <span className="text-[12px] font-medium text-green bg-green/10 px-2.5 py-1 rounded-full">
            Submitted
          </span>
        )}
        <Button variant="outline" onClick={() => save('draft')} loading={saving}>
          Save draft
        </Button>
        <Button onClick={() => save('submitted')} loading={saving}>
          Submit application
        </Button>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.kind === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-[13px] text-black cursor-pointer h-9 col-span-2">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-border accent-gold-600"
        />
        {field.label}
      </label>
    );
  }
  if (field.kind === 'select') {
    return (
      <Select
        label={field.label}
        placeholder="Select…"
        options={field.options ?? []}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <Input
      label={field.label}
      type={field.kind === 'number' ? 'number' : 'text'}
      placeholder={field.placeholder}
      leftAddon={field.prefix ? <span className="text-[13px]">{field.prefix}</span> : undefined}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
