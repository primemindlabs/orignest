'use client';

import { useState } from 'react';
import { SectionShell, SectionHeader, MoneyField, ContinueButton } from '../fields';
import type { Application, ApplicationSection } from '@/types/apply';

interface Props {
  application: Partial<Application>;
  onAutosave: (data: Partial<Application>) => void;
  onNext: (section: ApplicationSection) => void;
}

export function AssetsSection({ application, onAutosave, onNext }: Props) {
  const [checking, setChecking] = useState(application.checking_balance?.toString() ?? '');
  const [savings, setSavings] = useState(application.savings_balance?.toString() ?? '');
  const [retirement, setRetirement] = useState(application.retirement_balance?.toString() ?? '');
  const [other, setOther] = useState(application.other_assets?.toString() ?? '');
  const [debts, setDebts] = useState(application.monthly_debts?.toString() ?? '');

  function next() {
    onAutosave({
      checking_balance: parseFloat(checking) || null,
      savings_balance: parseFloat(savings) || null,
      retirement_balance: parseFloat(retirement) || null,
      other_assets: parseFloat(other) || null,
      monthly_debts: parseFloat(debts) || null,
    });
    onNext('hmda');
  }

  return (
    <SectionShell>
      <SectionHeader title="Assets & debts" subtitle="A snapshot of your finances." />
      <div className="grid grid-cols-2 gap-3">
        <MoneyField label="Checking ($)" value={checking} onChange={setChecking} />
        <MoneyField label="Savings ($)" value={savings} onChange={setSavings} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MoneyField label="Retirement ($)" value={retirement} onChange={setRetirement} />
        <MoneyField label="Other assets ($)" value={other} onChange={setOther} />
      </div>
      <MoneyField label="Total monthly debt payments ($)" value={debts} onChange={setDebts} />
      <p className="text-xs text-gray-400">
        Include car loans, student loans, credit cards, and other monthly obligations.
      </p>
      <ContinueButton onClick={next} />
    </SectionShell>
  );
}
