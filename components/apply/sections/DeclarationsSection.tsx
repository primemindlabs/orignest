'use client';

import { useState } from 'react';
import { SectionShell, SectionHeader, ToggleRow, ContinueButton } from '../fields';
import type { Application, ApplicationSection } from '@/types/apply';

interface Props {
  application: Partial<Application>;
  onAutosave: (data: Partial<Application>) => void;
  onNext: (section: ApplicationSection) => void;
}

const QUESTIONS: { key: keyof Application; label: string }[] = [
  { key: 'declaration_bankruptcy', label: 'Have you declared bankruptcy in the past 7 years?' },
  { key: 'declaration_foreclosure', label: 'Have you had a property foreclosed in the past 7 years?' },
  { key: 'declaration_lawsuit', label: 'Are you a party to a lawsuit?' },
  { key: 'declaration_delinquent', label: 'Are you delinquent on any federal debt?' },
  { key: 'declaration_alimony', label: 'Are you obligated to pay alimony or child support?' },
  { key: 'declaration_borrowed_down', label: 'Is any part of the down payment borrowed?' },
  { key: 'declaration_us_citizen', label: 'Are you a U.S. citizen?' },
  { key: 'declaration_primary_res', label: 'Will you occupy the property as your primary residence?' },
];

export function DeclarationsSection({ application, onAutosave, onNext }: Props) {
  const [answers, setAnswers] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const q of QUESTIONS) init[q.key as string] = !!application[q.key];
    return init;
  });

  function set(key: string, val: boolean) {
    setAnswers((prev) => ({ ...prev, [key]: val }));
  }

  function next() {
    onAutosave(answers as Partial<Application>);
    onNext('review');
  }

  return (
    <SectionShell>
      <SectionHeader title="Declarations" subtitle="A few yes / no questions required on every application." />
      <div className="space-y-4">
        {QUESTIONS.map((q) => (
          <ToggleRow key={q.key as string} label={q.label} checked={answers[q.key as string]} onChange={(v) => set(q.key as string, v)} />
        ))}
      </div>
      <ContinueButton onClick={next} label="Review my application →" />
    </SectionShell>
  );
}
