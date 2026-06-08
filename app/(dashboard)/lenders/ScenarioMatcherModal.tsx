'use client';

import { useState } from 'react';
import { X, SlidersHorizontal, CheckCircle2, XCircle, AlertCircle, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Lender {
  id: string;
  name: string;
  channel: string;
  products: string[];
  licensed_states: string[];
  min_fico: number;
  max_ltv: number;
  specialty_tags: string[];
  avg_turnaround_days: number;
  isSample: boolean;
}

interface Props {
  lenders: Lender[];
  onClose: () => void;
}

const LOAN_TYPES = [
  'Conventional', 'FHA', 'VA', 'USDA', 'Jumbo', 'Non-QM',
  'DSCR', 'Bank Statement', 'Bridge', 'Commercial', 'SBA', 'Construction',
];

const PROPERTY_TYPES = [
  'Primary Residence', 'Second Home', 'Investment Property',
  'Multi-Family (2-4)', 'Commercial', 'Land',
];

const INCOME_TYPES = [
  'W-2 / Salaried', 'Self-Employed', 'Bank Statement', '1099 / Contract',
  'Social Security / Retirement', 'Investment Income', 'No Income (DSCR)',
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

interface MatchResult {
  lender: Lender;
  eligible: boolean;
  reason: string;
  score: number;
}

export default function ScenarioMatcherModal({ lenders, onClose }: Props) {
  const [scenario, setScenario] = useState({
    loan_type: '',
    fico: '',
    ltv: '',
    state: '',
    loan_amount: '',
    property_type: '',
    income_type: '',
  });
  const [results, setResults] = useState<MatchResult[] | null>(null);

  function runMatch() {
    if (!scenario.loan_type) return;
    const fico = Number(scenario.fico) || 0;
    const ltv = Number(scenario.ltv) || 0;

    const matched: MatchResult[] = lenders.map((l) => {
      const issues: string[] = [];
      let score = 100;

      // Product match
      const hasProduct = l.products.some(
        (p) => p.toLowerCase().includes(scenario.loan_type.toLowerCase()) ||
               scenario.loan_type.toLowerCase().includes(p.toLowerCase())
      );
      if (!hasProduct) {
        issues.push(`Does not offer ${scenario.loan_type}`);
        score -= 50;
      }

      // FICO check
      if (l.min_fico > 0 && fico > 0 && fico < l.min_fico) {
        issues.push(`FICO ${fico} below minimum ${l.min_fico}`);
        score -= 40;
      }

      // LTV check
      if (ltv > 0 && ltv > l.max_ltv) {
        issues.push(`LTV ${ltv}% exceeds max ${l.max_ltv}%`);
        score -= 40;
      }

      // State check
      if (scenario.state && l.licensed_states.length > 0) {
        if (!l.licensed_states.includes(scenario.state)) {
          issues.push(`Not licensed in ${scenario.state}`);
          score -= 30;
        }
      }

      // Turnaround bonus
      if (l.avg_turnaround_days > 0 && l.avg_turnaround_days <= 10) score += 10;
      if (l.avg_turnaround_days > 0 && l.avg_turnaround_days <= 15) score += 5;

      return {
        lender: l,
        eligible: issues.length === 0,
        reason: issues.length > 0 ? issues[0] : 'All criteria met',
        score: Math.max(0, Math.min(100, score)),
      };
    });

    const sorted = [...matched].sort((a, b) => {
      if (a.eligible && !b.eligible) return -1;
      if (!a.eligible && b.eligible) return 1;
      return b.score - a.score;
    });

    setResults(sorted);
  }

  const isReady = scenario.loan_type.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-4 h-4 text-blue" />
            <h2 className="text-[17px] font-semibold text-navy">Scenario Matcher</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/[0.05] transition-colors">
            <X className="w-4 h-4 text-label2" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Scenario inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Loan Type *</label>
              <select
                value={scenario.loan_type}
                onChange={(e) => setScenario((s) => ({ ...s, loan_type: e.target.value }))}
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30 bg-white"
              >
                <option value="">Select type...</option>
                {LOAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">State</label>
              <select
                value={scenario.state}
                onChange={(e) => setScenario((s) => ({ ...s, state: e.target.value }))}
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30 bg-white"
              >
                <option value="">Any state</option>
                {US_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Borrower FICO</label>
              <input
                type="number"
                value={scenario.fico}
                onChange={(e) => setScenario((s) => ({ ...s, fico: e.target.value }))}
                placeholder="e.g. 680"
                min={300}
                max={850}
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">LTV (%)</label>
              <input
                type="number"
                value={scenario.ltv}
                onChange={(e) => setScenario((s) => ({ ...s, ltv: e.target.value }))}
                placeholder="e.g. 80"
                min={1}
                max={105}
                step={0.5}
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Loan Amount</label>
              <input
                type="number"
                value={scenario.loan_amount}
                onChange={(e) => setScenario((s) => ({ ...s, loan_amount: e.target.value }))}
                placeholder="e.g. 425000"
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-label2 mb-1.5">Income Type</label>
              <select
                value={scenario.income_type}
                onChange={(e) => setScenario((s) => ({ ...s, income_type: e.target.value }))}
                className="w-full px-3 py-2.5 border border-black/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue/30 bg-white"
              >
                <option value="">Select income type...</option>
                {INCOME_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={runMatch}
            disabled={!isReady}
            className="w-full py-2.5 rounded-xl bg-[#C9A95C] text-white text-sm font-semibold hover:bg-[#B08D3C] disabled:opacity-40 transition-colors"
          >
            Find Matching Lenders
          </button>

          {/* Results */}
          {results !== null && (
            <div className="space-y-3 border-t border-black/[0.04] pt-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-label2 uppercase tracking-wide">
                  {results.filter((r) => r.eligible).length} eligible · {results.filter((r) => !r.eligible).length} ineligible
                </p>
              </div>
              {results.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 text-label3 mx-auto mb-2" />
                  <p className="text-sm text-label2">No lenders in your network yet</p>
                </div>
              ) : (
                results.map((r) => (
                  <div
                    key={r.lender.id}
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-xl border',
                      r.eligible
                        ? 'bg-success/[0.04] border-success/20'
                        : 'bg-black/[0.02] border-black/[0.06]'
                    )}
                  >
                    {r.eligible
                      ? <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                      : <XCircle className="w-5 h-5 text-label3 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', r.eligible ? 'text-navy' : 'text-label2')}>
                        {r.lender.name}
                        {r.lender.isSample && (
                          <span className="ml-1.5 text-[10px] font-medium text-label3 bg-black/[0.04] px-1.5 py-0.5 rounded-full">Sample</span>
                        )}
                      </p>
                      <p className={cn('text-xs mt-0.5', r.eligible ? 'text-success' : 'text-label3')}>
                        {r.reason}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-[11px] text-label3">Match score</p>
                        <p className={cn('text-sm font-mono font-semibold', r.score >= 80 ? 'text-success' : r.score >= 50 ? 'text-warning' : 'text-danger')}>
                          {r.score}%
                        </p>
                      </div>
                      {r.lender.avg_turnaround_days > 0 && (
                        <div className="text-right">
                          <p className="text-[11px] text-label3">Turnaround</p>
                          <p className="text-sm font-mono font-semibold text-navy">~{r.lender.avg_turnaround_days}d</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-black/[0.06] flex-shrink-0">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-black/[0.1] text-sm font-medium text-label2 hover:text-label hover:bg-black/[0.02] transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
