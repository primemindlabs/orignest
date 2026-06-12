'use client';

import { IconCheck } from '@tabler/icons-react';
import {
  APPLICATION_SECTIONS,
  SECTION_LABELS,
  computeCompletionPct,
  type Application,
  type ApplicationSection,
} from '@/types/apply';

interface Props {
  currentSection: ApplicationSection;
  application: Partial<Application>;
  onSectionClick: (section: ApplicationSection) => void;
}

export function ProgressStepper({ currentSection, application, onSectionClick }: Props) {
  const completionPct = computeCompletionPct(application);
  const currentIdx = APPLICATION_SECTIONS.indexOf(currentSection);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{SECTION_LABELS[currentSection]}</span>
        <span>{completionPct}% complete</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-[#C9A95C] transition-all duration-500" style={{ width: `${completionPct}%` }} />
      </div>

      <div className="flex justify-between">
        {APPLICATION_SECTIONS.map((section, i) => {
          const isDone = i < currentIdx;
          const isActive = section === currentSection;
          return (
            <button
              key={section}
              onClick={() => i <= currentIdx && onSectionClick(section)}
              disabled={i > currentIdx}
              aria-label={SECTION_LABELS[section]}
              title={SECTION_LABELS[section]}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all ${
                isDone
                  ? 'bg-[#C9A95C] text-white'
                  : isActive
                    ? 'bg-white border-2 border-[#C9A95C] text-[#C9A95C] font-bold'
                    : 'bg-gray-200 text-gray-400'
              }`}
            >
              {isDone ? <IconCheck size={12} /> : i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
