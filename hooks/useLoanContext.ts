'use client';

/**
 * Phase 28.3 — useLoanContext
 *
 * Subscribes to the lead row via Supabase Realtime and re-derives LoanContext
 * whenever loan program / property type / employment changes, so FIELD_RULES
 * re-evaluate and fields show/hide without a page reload. Seeded from the
 * server-derived context to avoid a flash.
 */
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { deriveLoanContext, type LoanContext, type ApplicationLike } from '@/lib/ui/fieldAdapter';

export function useLoanContext(loanId: string, initial: LoanContext, app?: ApplicationLike | null): LoanContext {
  const [ctx, setCtx] = useState<LoanContext>(initial);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`loan-context-${loanId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${loanId}` },
        (payload) => {
          const lead = payload.new as Record<string, unknown>;
          setCtx(deriveLoanContext(lead, app));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loanId, app]);

  return ctx;
}
