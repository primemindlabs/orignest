'use client';

import { useState } from 'react';
import { SectionShell, SectionHeader, SelectField, ContinueButton } from '../fields';
import type { Application, ApplicationSection } from '@/types/apply';

interface Props {
  application: Partial<Application>;
  onAutosave: (data: Partial<Application>) => void;
  onNext: (section: ApplicationSection) => void;
}

const HMDA_DISCLOSURE =
  'The following information is requested by the Federal Government for certain types of loans related to a dwelling in order to monitor the lender’s compliance with equal credit opportunity, fair housing and home mortgage disclosure laws. You are not required to furnish this information, but are encouraged to do so. The law provides that a lender may not discriminate either on the basis of this information, or on whether you choose to furnish it.';

const NO_ANSWER = { value: 'prefer_not', label: 'I do not wish to provide this information' };

export function HMDASection({ application, onAutosave, onNext }: Props) {
  const [ethnicity, setEthnicity] = useState(application.hmda_ethnicity ?? '');
  const [race, setRace] = useState(application.hmda_race ?? '');
  const [sex, setSex] = useState(application.hmda_sex ?? '');

  function next() {
    onAutosave({
      hmda_ethnicity: ethnicity || null,
      hmda_race: race || null,
      hmda_sex: sex || null,
      // hmda_collected_at is in the section allowlist; stamp it on save.
      ...(ethnicity || race || sex ? { hmda_collected_at: new Date().toISOString() } : {}),
    } as Partial<Application>);
    onNext('declarations');
  }

  return (
    <SectionShell>
      <SectionHeader title="Demographics" />
      <p className="text-xs text-gray-400 leading-relaxed">{HMDA_DISCLOSURE}</p>

      <SelectField
        label="Ethnicity"
        value={ethnicity}
        onChange={setEthnicity}
        options={[NO_ANSWER, { value: 'hispanic_or_latino', label: 'Hispanic or Latino' }, { value: 'not_hispanic', label: 'Not Hispanic or Latino' }]}
      />
      <SelectField
        label="Race"
        value={race}
        onChange={setRace}
        options={[
          NO_ANSWER,
          { value: 'american_indian', label: 'American Indian or Alaska Native' },
          { value: 'asian', label: 'Asian' },
          { value: 'black', label: 'Black or African American' },
          { value: 'pacific_islander', label: 'Native Hawaiian or Other Pacific Islander' },
          { value: 'white', label: 'White' },
        ]}
      />
      <SelectField
        label="Sex"
        value={sex}
        onChange={setSex}
        options={[NO_ANSWER, { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]}
      />

      <ContinueButton onClick={next} />
    </SectionShell>
  );
}
