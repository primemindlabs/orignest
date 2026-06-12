'use client';

import { useState } from 'react';
import { ConditionalSection } from '../ConditionalSection';
import { SectionShell, SectionHeader, InputField, ToggleRow, ContinueButton } from '../fields';
import type { Application, ApplicationSection } from '@/types/apply';

interface Props {
  application: Partial<Application>;
  onAutosave: (data: Partial<Application>) => void;
  onNext: (section: ApplicationSection) => void;
}

export function PersonalSection({ application, onAutosave, onNext }: Props) {
  const [first, setFirst] = useState(application.borrower_first_name ?? '');
  const [last, setLast] = useState(application.borrower_last_name ?? '');
  const [dob, setDob] = useState(application.borrower_dob ?? '');
  const [ssn4, setSsn4] = useState(application.borrower_ssn_last4 ?? '');
  const [phone, setPhone] = useState(application.borrower_phone ?? '');
  const [email, setEmail] = useState(application.borrower_email ?? '');
  const [smsConsent, setSmsConsent] = useState(!!application.sms_consent);
  const [coBorrower, setCoBorrower] = useState(!!application.co_borrower);
  const [coFirst, setCoFirst] = useState(application.coborrower_first_name ?? '');
  const [coLast, setCoLast] = useState(application.coborrower_last_name ?? '');
  const [coEmail, setCoEmail] = useState(application.coborrower_email ?? '');
  const [coPhone, setCoPhone] = useState(application.coborrower_phone ?? '');

  const valid = first.trim() && last.trim() && dob && phone.trim();

  function next() {
    onAutosave({
      borrower_first_name: first,
      borrower_last_name: last,
      borrower_dob: dob || null,
      borrower_ssn_last4: ssn4.slice(0, 4) || null,
      borrower_phone: phone,
      borrower_email: email || null,
      sms_consent: smsConsent,
      co_borrower: coBorrower,
      coborrower_first_name: coBorrower ? coFirst : null,
      coborrower_last_name: coBorrower ? coLast : null,
      coborrower_email: coBorrower ? coEmail : null,
      coborrower_phone: coBorrower ? coPhone : null,
    });
    onNext('employment');
  }

  return (
    <SectionShell>
      <SectionHeader title="Let's get started" subtitle="A few details about you." />
      <div className="grid grid-cols-2 gap-3">
        <InputField label="First name" value={first} onChange={setFirst} />
        <InputField label="Last name" value={last} onChange={setLast} />
      </div>
      <InputField label="Date of birth" value={dob} onChange={setDob} type="date" />
      <div className="grid grid-cols-2 gap-3">
        <InputField label="SSN (last 4)" value={ssn4} onChange={(v) => setSsn4(v.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" />
        <InputField label="Phone" value={phone} onChange={setPhone} type="tel" inputMode="tel" />
      </div>
      <InputField label="Email" value={email} onChange={setEmail} type="email" inputMode="email" />

      <div className="rounded-xl bg-gray-50 p-4 space-y-3">
        <ToggleRow
          label="Text me updates about my application"
          description="Standard message rates may apply. Reply STOP to opt out."
          checked={smsConsent}
          onChange={setSmsConsent}
        />
      </div>

      <ToggleRow label="Add a co-borrower" checked={coBorrower} onChange={setCoBorrower} />
      <ConditionalSection show={coBorrower}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Co-borrower first name" value={coFirst} onChange={setCoFirst} />
            <InputField label="Co-borrower last name" value={coLast} onChange={setCoLast} />
          </div>
          <InputField label="Co-borrower email" value={coEmail} onChange={setCoEmail} type="email" />
          <InputField label="Co-borrower phone" value={coPhone} onChange={setCoPhone} type="tel" />
        </div>
      </ConditionalSection>

      <ContinueButton onClick={next} disabled={!valid} />
    </SectionShell>
  );
}
