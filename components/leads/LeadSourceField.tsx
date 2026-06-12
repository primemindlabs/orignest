'use client';

/**
 * Phase 98 — referral source + detail field for the lead create/edit forms.
 * Changing the source type clears the detail input.
 */
import { SOURCE_OPTIONS, DETAIL_PLACEHOLDERS } from '@/lib/analytics/sources';

type Props = {
  value: string | null;
  detail: string | null;
  onChange: (source: string | null, detail: string | null) => void;
};

export function LeadSourceField({ value, detail, onChange }: Props) {
  const field = 'w-full h-9 px-3 rounded-[10px] text-sm bg-white border border-[var(--c-border)] text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[#C9A95C]';
  return (
    <div className="space-y-2">
      <div>
        <label className="text-[12px] font-medium text-[var(--c-label2)] mb-1 block">Lead source</label>
        <select
          className={field}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null, null)} // clear detail on type change
        >
          <option value="">— Select source (optional) —</option>
          {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {value && (
        <input
          className={field}
          value={detail ?? ''}
          onChange={(e) => onChange(value, e.target.value || null)}
          placeholder={DETAIL_PLACEHOLDERS[value] ?? 'Additional detail (optional)'}
        />
      )}
    </div>
  );
}
