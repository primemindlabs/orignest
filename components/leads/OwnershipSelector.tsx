'use client';

/** Phase 39.1 — lead ownership selector (personal book vs company). */
import { User, Building2, Handshake } from 'lucide-react';

export type Ownership = 'lo_personal' | 'company_generated' | 'company_referral';

const OPTIONS: { key: Ownership; label: string; desc: string; Icon: typeof User }[] = [
  { key: 'lo_personal', label: 'My contact', desc: 'Personal referral or past client I brought in', Icon: User },
  { key: 'company_generated', label: 'Company lead', desc: 'Came through company marketing or website', Icon: Building2 },
  { key: 'company_referral', label: 'Branch referral', desc: 'Referred by a colleague', Icon: Handshake },
];

export function OwnershipSelector({ value, onChange }: { value: Ownership; onChange: (v: Ownership) => void }) {
  return (
    <div>
      <label className="text-[13px] font-medium text-black">Who owns this lead?</label>
      <div className="grid grid-cols-3 gap-2 mt-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`text-left rounded-[10px] border px-3 py-2 transition-colors ${value === o.key ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)]' : 'border-[var(--c-border)] hover:bg-[var(--c-fill)]'}`}
          >
            <o.Icon size={15} className={value === o.key ? 'text-[var(--c-gold-deep)]' : 'text-[var(--c-label2)]'} />
            <p className="text-[12px] font-medium text-[var(--c-text)] mt-1">{o.label}</p>
            <p className="text-[10px] text-[var(--c-label2)] leading-tight">{o.desc}</p>
          </button>
        ))}
      </div>
      {value === 'lo_personal' && (
        <p className="text-[11px] text-[var(--c-gold-deep)] mt-1.5">✓ This contact is part of your personal book and travels with you.</p>
      )}
    </div>
  );
}
