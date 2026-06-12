'use client';

import type { ReactNode } from 'react';

const GOLD = '#C9A95C';

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

export function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: 'numeric' | 'decimal' | 'tel' | 'email' | 'text';
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30"
      />
    </div>
  );
}

export function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <InputField label={label} value={value} onChange={onChange} type="number" inputMode="decimal" placeholder="0" />;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30"
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Card-style single choice (used for employment type, loan purpose, etc.). */
export function ChoiceGrid<T extends string>({
  value,
  onChange,
  options,
  cols = 2,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string; description?: string }[];
  cols?: 1 | 2;
}) {
  return (
    <div className={`grid gap-3 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`p-4 rounded-2xl border text-left transition-all ${
              active ? 'border-[#C9A95C] bg-[#C9A95C]/5' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className={`font-semibold text-sm ${active ? 'text-[#C9A95C]' : 'text-gray-900'}`}>{o.label}</p>
            {o.description && <p className="text-xs text-gray-400 mt-0.5">{o.description}</p>}
          </button>
        );
      })}
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 cursor-pointer">
      <span>
        <span className="text-sm text-gray-800">{label}</span>
        {description && <span className="block text-xs text-gray-400 mt-0.5">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${checked ? 'bg-[#C9A95C]' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  );
}

export function ContinueButton({ onClick, disabled, label = 'Continue →' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ background: GOLD }}
      className="w-full py-3.5 rounded-2xl text-white font-semibold hover:brightness-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}

export function SectionShell({ children }: { children: ReactNode }) {
  return <div className="space-y-5">{children}</div>;
}
