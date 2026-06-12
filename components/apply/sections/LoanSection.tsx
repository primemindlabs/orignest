'use client';

import { useState } from 'react';
import { SectionShell, SectionHeader, MoneyField, SelectField, ContinueButton } from '../fields';
import type { Application, ApplicationSection } from '@/types/apply';

interface Props {
  application: Partial<Application>;
  onAutosave: (data: Partial<Application>) => void;
  onNext: (section: ApplicationSection) => void;
}

export function LoanSection({ application, onAutosave, onNext }: Props) {
  const [amount, setAmount] = useState(application.desired_loan_amount?.toString() ?? '');
  const [type, setType] = useState(application.loan_type_preference ?? '');
  const [down, setDown] = useState(application.down_payment_amount?.toString() ?? '');
  const [source, setSource] = useState(application.down_payment_source ?? '');

  const isPurchase = application.loan_purpose === 'purchase';
  const valid = parseFloat(amount) > 0;

  function next() {
    onAutosave({
      desired_loan_amount: parseFloat(amount) || null,
      loan_type_preference: type || null,
      down_payment_amount: isPurchase ? parseFloat(down) || null : null,
      down_payment_source: isPurchase ? source || null : null,
    });
    onNext('assets');
  }

  return (
    <SectionShell>
      <SectionHeader title="Loan details" subtitle="What kind of loan works for you?" />
      <MoneyField label="Desired loan amount ($)" value={amount} onChange={setAmount} />
      <SelectField
        label="Loan type preference"
        value={type}
        onChange={setType}
        options={[
          { value: 'Conventional', label: 'Conventional' },
          { value: 'FHA', label: 'FHA' },
          { value: 'VA', label: 'VA' },
          { value: 'USDA', label: 'USDA' },
          { value: 'Jumbo', label: 'Jumbo' },
          { value: 'Not sure', label: "Not sure — help me decide" },
        ]}
      />
      {isPurchase && (
        <>
          <MoneyField label="Down payment amount ($)" value={down} onChange={setDown} />
          <SelectField
            label="Down payment source"
            value={source}
            onChange={setSource}
            options={[
              { value: 'savings', label: 'Savings' },
              { value: 'gift', label: 'Gift' },
              { value: '401k', label: '401(k) / retirement' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </>
      )}
      <ContinueButton onClick={next} disabled={!valid} />
    </SectionShell>
  );
}
