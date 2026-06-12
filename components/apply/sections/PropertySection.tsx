'use client';

import { useState } from 'react';
import { ConditionalSection } from '../ConditionalSection';
import { SectionShell, SectionHeader, InputField, MoneyField, ChoiceGrid, SelectField, ContinueButton } from '../fields';
import type { Application, ApplicationSection, LoanPurpose, PropertyType } from '@/types/apply';

interface Props {
  application: Partial<Application>;
  onAutosave: (data: Partial<Application>) => void;
  onNext: (section: ApplicationSection) => void;
}

const PURPOSES: { value: LoanPurpose; label: string; description: string }[] = [
  { value: 'purchase', label: 'Purchase', description: 'Buying a home' },
  { value: 'refinance', label: 'Refinance', description: 'Lower rate / term' },
  { value: 'cash_out', label: 'Cash-Out', description: 'Tap equity' },
];

export function PropertySection({ application, onAutosave, onNext }: Props) {
  const [purpose, setPurpose] = useState<LoanPurpose | null>(application.loan_purpose ?? null);
  const [addr, setAddr] = useState(application.property_address ?? '');
  const [city, setCity] = useState(application.property_city ?? '');
  const [state, setState] = useState(application.property_state ?? '');
  const [zip, setZip] = useState(application.property_zip ?? '');
  const [propType, setPropType] = useState<PropertyType | ''>(application.property_type ?? '');
  const [price, setPrice] = useState(application.purchase_price?.toString() ?? '');
  const [estValue, setEstValue] = useState(application.estimated_value?.toString() ?? '');

  const valid = purpose && city.trim() && state.trim() && propType;

  function next() {
    onAutosave({
      loan_purpose: purpose,
      property_address: addr || null,
      property_city: city,
      property_state: state.toUpperCase().slice(0, 2),
      property_zip: zip || null,
      property_type: (propType || null) as PropertyType | null,
      purchase_price: purpose === 'purchase' ? parseFloat(price) || null : null,
      estimated_value: purpose !== 'purchase' ? parseFloat(estValue) || null : null,
    });
    onNext('loan');
  }

  return (
    <SectionShell>
      <SectionHeader title="Property" subtitle="What are you financing?" />
      <ChoiceGrid value={purpose} onChange={setPurpose} options={PURPOSES} cols={1} />

      <InputField label="Property address" value={addr} onChange={setAddr} />
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
          <InputField label="City" value={city} onChange={setCity} />
        </div>
        <InputField label="State" value={state} onChange={(v) => setState(v.toUpperCase().slice(0, 2))} />
        <InputField label="ZIP" value={zip} onChange={(v) => setZip(v.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" />
      </div>

      <SelectField
        label="Property type"
        value={propType}
        onChange={(v) => setPropType(v as PropertyType)}
        options={[
          { value: 'primary', label: 'Primary residence' },
          { value: 'second_home', label: 'Second home' },
          { value: 'investment', label: 'Investment property' },
        ]}
      />

      <ConditionalSection show={purpose === 'purchase'}>
        <MoneyField label="Purchase price ($)" value={price} onChange={setPrice} />
      </ConditionalSection>
      <ConditionalSection show={purpose === 'refinance' || purpose === 'cash_out'}>
        <MoneyField label="Estimated home value ($)" value={estValue} onChange={setEstValue} />
      </ConditionalSection>

      <ContinueButton onClick={next} disabled={!valid} />
    </SectionShell>
  );
}
