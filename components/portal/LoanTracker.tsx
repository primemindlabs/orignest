'use client';

// Phase 123 — Uber-style 6-stage loan tracker (presentational). Gold-only, dark header.
import { IconCheck } from '@tabler/icons-react';

interface LoanTrackerProps {
  currentStage: number; // 1-6
  stagePct: number; // 0-100 within current stage
  stageLabels: string[];
  propertyAddress: string | null;
  daysToClosing: number | null;
}

export function LoanTracker({ currentStage, stagePct, stageLabels, propertyAddress, daysToClosing }: LoanTrackerProps) {
  const progressToNextStage = (currentStage - 1) / 5 + (stagePct / 100) * (1 / 5);

  return (
    <div className="bg-[#0F0D0B] rounded-2xl px-6 py-6">
      <p className="text-[11px] font-medium text-[rgba(201,169,92,.55)] mb-1">Welcome back</p>
      <h1 className="text-xl font-medium text-[#F5F3F0] tracking-tight mb-6">
        {propertyAddress ?? 'Your home'} —{' '}
        <span className="text-[#C9A95C]">{daysToClosing != null && daysToClosing >= 0 ? `closing in ${daysToClosing} days` : 'funded'}</span>
      </h1>

      <div className="relative px-2">
        <div className="absolute top-[10px] left-2 right-2 h-[2px] bg-white/[.08]">
          <div className="h-full bg-[#C9A95C] transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, progressToNextStage * 100))}%` }} />
        </div>
        <div className="flex justify-between relative z-10">
          {stageLabels.map((label, i) => {
            const stageNum = i + 1;
            const isDone = stageNum < currentStage;
            const isActive = stageNum === currentStage;
            return (
              <div key={stageNum} className="flex flex-col items-center gap-[7px] w-[88px]">
                {isDone && (
                  <div className="w-[21px] h-[21px] rounded-full bg-[#C9A95C] flex items-center justify-center flex-shrink-0">
                    <IconCheck size={11} color="#5A3E15" stroke={2.5} />
                  </div>
                )}
                {isActive && (
                  <div className="w-[21px] h-[21px] rounded-full bg-[#1A1816] border-2 border-[#C9A95C] flex items-center justify-center flex-shrink-0">
                    <div className="w-[6px] h-[6px] rounded-full bg-[#C9A95C]" />
                  </div>
                )}
                {!isDone && !isActive && <div className="w-[21px] h-[21px] rounded-full bg-white/[.05] border border-white/[.15] flex-shrink-0" />}
                <p className={`text-[11px] font-medium text-center leading-[1.3] ${isDone ? 'text-[#C9A95C]' : isActive ? 'text-[#FAFAF8]' : 'text-white/[.36]'}`}>{label}</p>
                {isActive && (
                  <>
                    <div className="w-[64px] h-[3px] bg-white/[.14] rounded-sm overflow-hidden">
                      <div className="h-full bg-[#C9A95C] rounded-sm transition-all" style={{ width: `${stagePct}%` }} />
                    </div>
                    <p className="text-[11px] text-[#C9A95C] font-mono font-medium">{stagePct}%</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
