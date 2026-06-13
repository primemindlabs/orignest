'use client';

// Phase 123 — Elite Borrower Portal orchestrator. Token-based, self-contained, gold
// design. Loads the tracker once (drives the header + celebrations) and exposes the 8
// features behind a sub-nav. Mounted as the "My Home" tab of the borrower portal.
import { useEffect, useState } from 'react';
import { IconRoute, IconHeartRateMonitor, IconCoin, IconBuildingEstate, IconLock, IconSparkles, IconMessageChatbot } from '@tabler/icons-react';
import { LoanTracker } from './LoanTracker';
import { AshleyAI } from './AshleyAI';
import { MortgageHealthScore } from './MortgageHealthScore';
import { HomeWealthDashboard } from './HomeWealthDashboard';
import { PortfolioCenter } from './PortfolioCenter';
import { FinancialConcierge } from './FinancialConcierge';
import { ClosingVault } from './ClosingVault';
import { AnnualReviewCard } from './AnnualReviewCard';
import { ExplainerVideoCard } from './explainers/ExplainerVideoCard';
import { UnderContractBanner } from './celebrations/UnderContractBanner';
import { FundedCelebration } from './celebrations/FundedCelebration';

interface TrackerData {
  loan: { id: string; propertyAddress: string | null; closingDate: string | null; daysToClosing: number | null };
  progress: { current_stage_order: number; current_stage_pct: number };
  stages: { stage_order: number; stage_label: string }[];
  pendingCelebrations: ('under_contract' | 'funded')[];
}

type Section = 'home' | 'health' | 'wealth' | 'portfolio' | 'vault' | 'concierge' | 'ashley';
const NAV: { key: Section; label: string; icon: React.ElementType }[] = [
  { key: 'home', label: 'My Home', icon: IconRoute },
  { key: 'health', label: 'Health Score', icon: IconHeartRateMonitor },
  { key: 'wealth', label: 'Wealth', icon: IconCoin },
  { key: 'portfolio', label: 'Portfolio', icon: IconBuildingEstate },
  { key: 'concierge', label: 'Concierge', icon: IconSparkles },
  { key: 'vault', label: 'Vault', icon: IconLock },
  { key: 'ashley', label: 'Ask Ashley', icon: IconMessageChatbot },
];

export function ElitePortal({ token, summary }: { token: string; summary?: { homePrice: number | null; rate: number | null; monthlyPayment: number | null } }) {
  const [tracker, setTracker] = useState<TrackerData | null>(null);
  const [section, setSection] = useState<Section>('home');
  const [showUnderContract, setShowUnderContract] = useState(false);
  const [showFunded, setShowFunded] = useState(false);

  useEffect(() => {
    fetch(`/api/borrower-portal/${token}/tracker`).then((r) => (r.ok ? r.json() : null)).then((d: TrackerData | null) => {
      if (!d) return;
      setTracker(d);
      setShowUnderContract(d.pendingCelebrations?.includes('under_contract') && !d.pendingCelebrations?.includes('funded'));
      setShowFunded(d.pendingCelebrations?.includes('funded'));
    }).catch(() => {});
  }, [token]);

  const stageLabels = tracker?.stages?.length ? tracker.stages.map((s) => s.stage_label) : ['Application received', 'Documents verified', 'Initial approval', 'Appraisal ordered', 'Clear to close', 'Closing scheduled'];

  return (
    <div className="space-y-4">
      {showFunded && (
        <FundedCelebration token={token} homePrice={summary?.homePrice ?? null} rate={summary?.rate ?? null} monthlyPayment={summary?.monthlyPayment ?? null} onContinue={() => { setShowFunded(false); setSection('wealth'); }} />
      )}
      {showUnderContract && <UnderContractBanner token={token} onDismiss={() => setShowUnderContract(false)} />}

      {/* Sub-nav */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = section === n.key;
          return (
            <button key={n.key} onClick={() => setSection(n.key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${active ? 'bg-[#1A1816] text-[#F5F3F0]' : 'bg-white border border-[#EDEAE4] text-[#6B6560] hover:border-[#C9A95C]'}`}>
              <Icon size={14} className={active ? 'text-[#C9A95C]' : 'text-[#9B9590]'} /> {n.label}
            </button>
          );
        })}
      </div>

      {section === 'home' && (
        <div className="space-y-4">
          {tracker && <LoanTracker currentStage={tracker.progress.current_stage_order} stagePct={tracker.progress.current_stage_pct} stageLabels={stageLabels} propertyAddress={tracker.loan.propertyAddress} daysToClosing={tracker.loan.daysToClosing} />}
          <div className="grid sm:grid-cols-2 gap-3">
            <ExplainerVideoCard title="Understanding your loan estimate" subtitle="2 min with Ashley" />
            <ExplainerVideoCard title="What happens at closing" subtitle="3 min with Ashley" />
          </div>
          <AnnualReviewCard closingDate={tracker?.loan.closingDate ?? null} />
        </div>
      )}
      {section === 'health' && <MortgageHealthScore token={token} onAskAshley={() => setSection('ashley')} />}
      {section === 'wealth' && <HomeWealthDashboard token={token} onAskAshley={() => setSection('ashley')} />}
      {section === 'portfolio' && <PortfolioCenter token={token} onAskAshley={() => setSection('ashley')} />}
      {section === 'concierge' && <FinancialConcierge token={token} />}
      {section === 'vault' && <ClosingVault token={token} onAskAshley={() => setSection('ashley')} />}
      {section === 'ashley' && <AshleyAI token={token} />}
    </div>
  );
}
