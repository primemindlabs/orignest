/**
 * Phase 129 — File Intelligence Suite: pure scoring engine.
 *
 * PURE function: no DB calls. All inputs are fetched before calling it, which
 * keeps it deterministic and unit-testable. The scoring math is the spec's
 * algorithm verbatim; the only adaptation is the LoanStage union — this app's
 * real pipeline stages (no `closing`/`funded`/`denied`; terminal is `closed`,
 * negatives are `declined`/`withdrawn`, plus `new_inquiry`).
 */

export type LoanStage =
  | 'new_inquiry'
  | 'pre_qual'
  | 'application'
  | 'processing'
  | 'underwriting'
  | 'conditional_approval'
  | 'clear_to_close'
  | 'closed'
  | 'declined'
  | 'withdrawn';

export type LoanTypeKey = 'conv' | 'fha' | 'va' | 'dscr' | 'jumbo';

export interface IntelLoan {
  id: string;
  stage: LoanStage;
}

export interface IntelCondition {
  name: string;
  required_for_uw: boolean;
  status: 'satisfied' | 'outstanding' | string;
  age_days: number;
}

export interface IntelDocument {
  document_type: string;
}

export type FalloutSeverity = 'high' | 'medium' | 'low';
export interface FalloutFlag {
  flag_type: string;
  severity: FalloutSeverity;
  description: string;
}

export type FileIntelligenceInput = {
  loan: IntelLoan;
  conditions: IntelCondition[];
  documents: IntelDocument[];
  stage: LoanStage;
  daysSinceCreation: number;
  daysSinceLastActivity: number;
  loanType: LoanTypeKey;
  historicalAvgDaysToClose: number | null; // org's closed loans, same loan type
};

export type FileIntelligenceResult = {
  fileHealthScore: number; // 0–100
  closeProbability: number; // 0.0–1.0
  uwReadinessScore: number; // 0–100
  predictedCloseDate: Date | null;
  predictedCloseConfidence: 'high' | 'medium' | 'low';
  falloutFlags: FalloutFlag[];
  healthDrivers: { positive: string[]; negative: string[] };
  uwDrivers: { ready: string[]; missing: string[] };
};

// Core documents expected per loan type. Presence is matched loosely against
// documents.document_type (case-insensitive substring) so it tolerates the
// org's exact doc taxonomy.
const CORE_DOCS_BY_TYPE: Record<LoanTypeKey, string[]> = {
  conv: ['paystub', 'w2', 'bank', 'id'],
  fha: ['paystub', 'w2', 'bank', 'id'],
  va: ['paystub', 'w2', 'bank', 'id', 'coe'],
  dscr: ['lease', 'bank', 'id', 'entity'],
  jumbo: ['paystub', 'w2', 'bank', 'id', 'asset'],
};

function checkCoreDocuments(documents: IntelDocument[], loanType: LoanTypeKey): boolean {
  const needed = CORE_DOCS_BY_TYPE[loanType] ?? CORE_DOCS_BY_TYPE.conv;
  const have = documents.map((d) => (d.document_type ?? '').toLowerCase());
  return needed.every((kw) => have.some((t) => t.includes(kw)));
}

export function computeFileIntelligence(input: FileIntelligenceInput): FileIntelligenceResult {
  const {
    conditions, documents, stage,
    daysSinceLastActivity, loanType, historicalAvgDaysToClose,
  } = input;

  // ---------------------------------------------------------------
  // UNDERWRITING READINESS SCORE (0–100)
  // ---------------------------------------------------------------
  const requiredConditions = conditions.filter((c) => c.required_for_uw);
  const satisfiedConditions = requiredConditions.filter((c) => c.status === 'satisfied');
  const uwReadinessBase = requiredConditions.length > 0
    ? (satisfiedConditions.length / requiredConditions.length) * 100
    : 0;

  const agingConditions = requiredConditions.filter(
    (c) => c.status === 'outstanding' && c.age_days >= 5
  );
  const uwReadinessPenalty = agingConditions.length * 8; // -8pts per aging condition
  const uwReadinessScore = Math.max(0, Math.round(uwReadinessBase - uwReadinessPenalty));

  const uwDrivers = {
    ready: satisfiedConditions.map((c) => c.name),
    missing: conditions
      .filter((c) => c.required_for_uw && c.status === 'outstanding')
      .map((c) => `${c.name}${c.age_days >= 5 ? ` (${c.age_days}d outstanding)` : ''}`),
  };

  // ---------------------------------------------------------------
  // FILE HEALTH SCORE (0–100)
  // ---------------------------------------------------------------
  let healthScore = 100;
  const negativeDrivers: string[] = [];
  const positiveDrivers: string[] = [];

  // UW readiness contributes 40% of health score.
  healthScore = Math.round(healthScore * 0.6 + uwReadinessScore * 0.4);

  const expectedDaysPerStage: Record<LoanStage, number> = {
    new_inquiry: 2,
    pre_qual: 3,
    application: 5,
    processing: 10,
    underwriting: 7,
    conditional_approval: 5,
    clear_to_close: 3,
    closed: 0,
    declined: 0,
    withdrawn: 0,
  };
  const expectedDays = expectedDaysPerStage[stage] ?? 7;
  if (daysSinceLastActivity > expectedDays * 1.5) {
    const overage = daysSinceLastActivity - expectedDays;
    healthScore -= Math.min(20, overage * 2);
    negativeDrivers.push(`No activity for ${daysSinceLastActivity} days (expected ≤ ${expectedDays})`);
  } else {
    positiveDrivers.push('Loan moving at expected pace');
  }

  const allAgingConditions = conditions.filter(
    (c) => c.status === 'outstanding' && c.age_days >= 7
  );
  if (allAgingConditions.length > 0) {
    healthScore -= allAgingConditions.length * 5;
    negativeDrivers.push(`${allAgingConditions.length} condition(s) outstanding 7+ days`);
  }

  const hasAllCoreDocuments = checkCoreDocuments(documents, loanType);
  if (hasAllCoreDocuments) {
    positiveDrivers.push('All core documents received');
  } else {
    healthScore -= 10;
    negativeDrivers.push('Missing core documents');
  }

  const fileHealthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  // ---------------------------------------------------------------
  // CLOSE PROBABILITY (0.0–1.0)
  // ---------------------------------------------------------------
  const stageBaseProb: Record<LoanStage, number> = {
    new_inquiry: 0.40,
    pre_qual: 0.45,
    application: 0.55,
    processing: 0.65,
    underwriting: 0.72,
    conditional_approval: 0.82,
    clear_to_close: 0.94,
    closed: 1.0,
    declined: 0.0,
    withdrawn: 0.0,
  };
  const stageProb = stageBaseProb[stage] ?? 0.5;
  const healthModifier = ((fileHealthScore - 70) / 100) * 0.15; // ±15%
  const closeProbability = Math.max(0, Math.min(1, stageProb + healthModifier));

  // ---------------------------------------------------------------
  // PREDICTED CLOSE DATE
  // ---------------------------------------------------------------
  const avgDaysRemainingByStage: Record<LoanStage, number> = {
    new_inquiry: 40,
    pre_qual: 35,
    application: 30,
    processing: 22,
    underwriting: 15,
    conditional_approval: 10,
    clear_to_close: 5,
    closed: 0,
    declined: -1,
    withdrawn: -1,
  };
  const avgDaysRemaining = avgDaysRemainingByStage[stage] ?? 14;
  const orgAvgAdjustment = historicalAvgDaysToClose
    ? (historicalAvgDaysToClose - 30) * 0.3
    : 0;
  const predictedDays = Math.max(1, Math.round(avgDaysRemaining + orgAvgAdjustment));
  const isTerminal = stage === 'closed' || stage === 'withdrawn' || stage === 'declined';
  const predictedCloseDate = isTerminal
    ? null
    : new Date(Date.now() + predictedDays * 24 * 60 * 60 * 1000);

  const predictedCloseConfidence: 'high' | 'medium' | 'low' =
    closeProbability >= 0.85 && fileHealthScore >= 75 ? 'high'
    : closeProbability >= 0.65 ? 'medium'
    : 'low';

  // ---------------------------------------------------------------
  // FALLOUT FLAGS
  // ---------------------------------------------------------------
  const falloutFlags: FalloutFlag[] = [];

  if (uwReadinessScore < 50) {
    falloutFlags.push({
      flag_type: 'low_uw_readiness',
      severity: 'high',
      description: `UW Readiness is ${uwReadinessScore}/100 — ${uwDrivers.missing.length} conditions still needed`,
    });
  }

  if (agingConditions.length > 0) {
    agingConditions.forEach((c) => {
      falloutFlags.push({
        flag_type: 'aging_condition',
        severity: c.age_days >= 10 ? 'high' : 'medium',
        description: `${c.name} outstanding for ${c.age_days} days`,
      });
    });
  }

  if (daysSinceLastActivity > 10) {
    falloutFlags.push({
      flag_type: 'stale_file',
      severity: 'medium',
      description: `No file activity in ${daysSinceLastActivity} days`,
    });
  }

  if (closeProbability < 0.30) {
    falloutFlags.push({
      flag_type: 'low_close_probability',
      severity: 'high',
      description: `Close probability is ${Math.round(closeProbability * 100)}% — intervention needed`,
    });
  }

  return {
    fileHealthScore,
    closeProbability,
    uwReadinessScore,
    predictedCloseDate,
    predictedCloseConfidence,
    falloutFlags,
    healthDrivers: { positive: positiveDrivers, negative: negativeDrivers },
    uwDrivers,
  };
}

/** Normalize a free-text leads.loan_type into the scoring engine's union. */
export function normalizeLoanType(raw: string | null | undefined): LoanTypeKey {
  const t = (raw ?? '').toLowerCase();
  if (t.includes('fha')) return 'fha';
  if (t.includes('va')) return 'va';
  if (t.includes('dscr')) return 'dscr';
  if (t.includes('jumbo')) return 'jumbo';
  return 'conv';
}
