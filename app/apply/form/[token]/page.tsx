'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ProgressStepper } from '@/components/apply/ProgressStepper';
import { PersonalSection } from '@/components/apply/sections/PersonalSection';
import { EmploymentSection } from '@/components/apply/sections/EmploymentSection';
import { PropertySection } from '@/components/apply/sections/PropertySection';
import { LoanSection } from '@/components/apply/sections/LoanSection';
import { AssetsSection } from '@/components/apply/sections/AssetsSection';
import { HMDASection } from '@/components/apply/sections/HMDASection';
import { DeclarationsSection } from '@/components/apply/sections/DeclarationsSection';
import { ReviewSection } from '@/components/apply/sections/ReviewSection';
import { SubmitSuccessPage } from '@/components/apply/SubmitSuccessPage';
import { APPLICATION_SECTIONS, type Application, type ApplicationSection } from '@/types/apply';

export default function ApplyFormPage() {
  const { token } = useParams<{ token: string }>();
  const [application, setApplication] = useState<Partial<Application> | null>(null);
  const [currentSection, setCurrentSection] = useState<ApplicationSection>('personal');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/apply/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.application) {
          setApplication(d.application);
          const hash = window.location.hash?.replace('#section=', '') as ApplicationSection;
          if (hash && (APPLICATION_SECTIONS as readonly string[]).includes(hash)) setCurrentSection(hash);
        } else {
          setNotFound(true);
        }
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [token]);

  const autosave = useCallback(
    async (sectionData: Partial<Application>) => {
      setSaving(true);
      setApplication((prev) => (prev ? { ...prev, ...sectionData } : prev));
      await fetch(`/api/apply/${token}/section/${currentSection}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sectionData),
      }).catch(() => undefined);
      setSaving(false);
    },
    [token, currentSection]
  );

  const goToSection = useCallback((section: ApplicationSection) => {
    setCurrentSection(section);
    window.location.hash = `section=${section}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSubmit = useCallback(async () => {
    await fetch(`/api/apply/${token}/submit`, { method: 'POST' }).catch(() => undefined);
    setSubmitted(true);
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#C9A95C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading your application…</p>
        </div>
      </div>
    );
  }

  if (submitted && application) return <SubmitSuccessPage application={application} />;

  if (notFound || !application) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex items-center justify-center p-6">
        <p className="text-gray-500 text-center">This application was not found or has already been submitted.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9]">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <p className="font-semibold text-gray-900 text-sm">Mortgage Application</p>
          {saving && <p className="text-xs text-gray-400">Saving…</p>}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <ProgressStepper currentSection={currentSection} application={application} onSectionClick={goToSection} />
        <div className="mt-6">
          {currentSection === 'personal' && <PersonalSection application={application} onAutosave={autosave} onNext={goToSection} />}
          {currentSection === 'employment' && <EmploymentSection application={application} onAutosave={autosave} onNext={goToSection} />}
          {currentSection === 'property' && <PropertySection application={application} onAutosave={autosave} onNext={goToSection} />}
          {currentSection === 'loan' && <LoanSection application={application} onAutosave={autosave} onNext={goToSection} />}
          {currentSection === 'assets' && <AssetsSection application={application} onAutosave={autosave} onNext={goToSection} />}
          {currentSection === 'hmda' && <HMDASection application={application} onAutosave={autosave} onNext={goToSection} />}
          {currentSection === 'declarations' && <DeclarationsSection application={application} onAutosave={autosave} onNext={goToSection} />}
          {currentSection === 'review' && <ReviewSection application={application} onNext={goToSection} onSubmit={handleSubmit} />}
        </div>
      </div>
    </div>
  );
}
