'use client';

import { useState, useCallback } from 'react';

export interface CelebrationData {
  name: string;
  amount: number;
  leadId: string;
}

export function useClosingCelebration() {
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);

  const trigger = useCallback((borrowerName: string, loanAmount: number, leadId: string) => {
    // Don't replay if already seen for this lead
    const seen = localStorage.getItem(`conduit_closed_${leadId}`);
    if (seen) return;

    localStorage.setItem(`conduit_closed_${leadId}`, '1');
    setCelebration({ name: borrowerName, amount: loanAmount, leadId });

    setTimeout(() => setCelebration(null), 5500);
  }, []);

  const dismiss = useCallback(() => {
    setCelebration(null);
  }, []);

  return { celebration, trigger, dismiss };
}
