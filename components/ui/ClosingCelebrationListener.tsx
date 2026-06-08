'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ClosingCelebration } from './ClosingCelebration';

interface ClosingData {
  borrowerFirstName: string;
  borrowerLastName: string;
  loanAmount: number | null;
  loName?: string;
}

interface ClosingCelebrationListenerProps {
  loName?: string;
}

export function ClosingCelebrationListener({ loName }: ClosingCelebrationListenerProps) {
  const [closingData, setClosingData] = useState<ClosingData | null>(null);

  useEffect(() => {
    const sb = createClient();

    // Listen for realtime updates on leads table where stage becomes 'closed'
    const channel = sb
      .channel('closing-celebration')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
          filter: 'stage=eq.closed',
        },
        (payload) => {
          const lead = payload.new as {
            first_name: string;
            last_name: string;
            loan_amount: number | null;
            stage: string;
          };
          const oldStage = (payload.old as { stage?: string }).stage;

          // Only trigger if this is a fresh transition to 'closed'
          if (lead.stage === 'closed' && oldStage && oldStage !== 'closed') {
            setClosingData({
              borrowerFirstName: lead.first_name,
              borrowerLastName: lead.last_name,
              loanAmount: lead.loan_amount,
              loName,
            });
          }
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [loName]);

  return (
    <ClosingCelebration
      data={closingData}
      onDismiss={() => setClosingData(null)}
    />
  );
}
