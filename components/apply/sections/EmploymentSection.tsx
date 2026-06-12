'use client';

import { useState } from 'react';
import { ConditionalSection } from '../ConditionalSection';
import { SectionShell, SectionHeader, InputField, MoneyField, ChoiceGrid, ContinueButton } from '../fields';
import type { Application, ApplicationSection, EmploymentType } from '@/types/apply';

interface Props {
  application: Partial<Application>;
  onAutosave: (data: Partial<Application>) => void;
  onNext: (section: ApplicationSection) => void;
}

const TYPES: { value: EmploymentType; label: string; description: string }[] = [
  { value: 'employed', label: 'Employed', description: 'W-2 employee' },
  { value: 'self_employed', label: 'Self-Employed', description: 'Business owner / contractor' },
  { value: 'retired', label: 'Retired', description: 'Pension or Social Security' },
  { value: 'other', label: 'Other', description: 'VA disability, rental, etc.' },
];

export function EmploymentSection({ application, onAutosave, onNext }: Props) {
  const [empType, setEmpType] = useState<EmploymentType | null>(application.employment_type ?? null);
  const [employer, setEmployer] = useState(application.employer_name ?? '');
  const [title, setTitle] = useState(application.job_title ?? '');
  const [years, setYears] = useState(application.years_at_job?.toString() ?? '');
  const [gross, setGross] = useState(application.gross_monthly_income?.toString() ?? '');
  const [bizName, setBizName] = useState(application.self_emp_business_name ?? '');
  const [bizYears, setBizYears] = useState(application.self_emp_years?.toString() ?? '');
  const [net, setNet] = useState(application.self_emp_monthly_net?.toString() ?? '');
  const [retire, setRetire] = useState(application.monthly_retirement_income?.toString() ?? '');

  function pickType(t: EmploymentType) {
    setEmpType(t);
    onAutosave({ employment_type: t });
  }

  function next() {
    const data: Partial<Application> = { employment_type: empType! };
    if (empType === 'employed') {
      Object.assign(data, {
        employer_name: employer,
        job_title: title,
        years_at_job: parseFloat(years) || null,
        gross_monthly_income: parseFloat(gross) || null,
      });
    } else if (empType === 'self_employed') {
      Object.assign(data, {
        self_emp_business_name: bizName,
        self_emp_years: parseInt(bizYears, 10) || null,
        self_emp_monthly_net: parseFloat(net) || null,
        gross_monthly_income: parseFloat(net) || null,
      });
    } else if (empType === 'retired') {
      Object.assign(data, {
        monthly_retirement_income: parseFloat(retire) || null,
        gross_monthly_income: parseFloat(retire) || null,
      });
    } else if (empType === 'other') {
      Object.assign(data, { gross_monthly_income: parseFloat(gross) || null });
    }
    onAutosave(data);
    onNext('property');
  }

  return (
    <SectionShell>
      <SectionHeader title="Employment" subtitle="How would you describe your current work situation?" />
      <ChoiceGrid value={empType} onChange={pickType} options={TYPES} />

      <ConditionalSection show={empType === 'employed'}>
        <div className="space-y-3">
          <InputField label="Employer name" value={employer} onChange={setEmployer} />
          <InputField label="Job title" value={title} onChange={setTitle} />
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Years at job" value={years} onChange={setYears} type="number" inputMode="decimal" />
            <MoneyField label="Gross monthly income ($)" value={gross} onChange={setGross} />
          </div>
        </div>
      </ConditionalSection>

      <ConditionalSection show={empType === 'self_employed'}>
        <div className="space-y-3">
          <InputField label="Business name" value={bizName} onChange={setBizName} />
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Years in business" value={bizYears} onChange={setBizYears} type="number" inputMode="numeric" />
            <MoneyField label="Monthly net income ($)" value={net} onChange={setNet} />
          </div>
        </div>
      </ConditionalSection>

      <ConditionalSection show={empType === 'retired'}>
        <MoneyField label="Monthly retirement income ($)" value={retire} onChange={setRetire} />
      </ConditionalSection>

      <ConditionalSection show={empType === 'other'}>
        <MoneyField label="Gross monthly income ($)" value={gross} onChange={setGross} />
      </ConditionalSection>

      <ContinueButton onClick={next} disabled={!empType} />
    </SectionShell>
  );
}
