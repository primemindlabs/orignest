'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface OptimisticState<T> {
  value: T | null;
  loading: boolean;
}

export function useOptimisticLead(leadId: string) {
  const [optimisticStage, setOptimisticStage] = useState<string | null>(null);
  const [stageLoading, setStageLoading] = useState(false);

  const updateStage = useCallback(
    async (newStage: string, currentStage: string, onClosed?: (name: string, amount: number) => void) => {
      setOptimisticStage(newStage); // instant UI
      setStageLoading(true);
      try {
        const res = await fetch(`/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: newStage }),
        });
        if (!res.ok) throw new Error('Failed to update stage');

        const data = await res.json() as { lead?: { first_name?: string; last_name?: string; loan_amount?: number } };
        if (newStage === 'closed' && onClosed && data.lead) {
          const name = `${data.lead.first_name ?? ''} ${data.lead.last_name ?? ''}`.trim();
          const amount = data.lead.loan_amount ?? 0;
          onClosed(name, amount);
        }
      } catch {
        setOptimisticStage(currentStage); // revert on error
        toast.error('Failed to update stage. Please try again.');
      } finally {
        setStageLoading(false);
      }
    },
    [leadId]
  );

  return { optimisticStage, stageLoading, updateStage };
}

// ─── Generic field optimistic update ──────────────────────────────────────────

export function useOptimisticField<T>(leadId: string, field: string) {
  const [state, setState] = useState<OptimisticState<T>>({ value: null, loading: false });

  const updateField = useCallback(
    async (newValue: T, currentValue: T) => {
      setState({ value: newValue, loading: true });
      try {
        const res = await fetch(`/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: newValue }),
        });
        if (!res.ok) throw new Error('Update failed');
        setState({ value: newValue, loading: false });
      } catch {
        setState({ value: currentValue, loading: false });
        toast.error(`Failed to update. Please try again.`);
      }
    },
    [leadId, field]
  );

  return { optimisticValue: state.value, fieldLoading: state.loading, updateField };
}

// ─── Task completion optimistic update ────────────────────────────────────────

export function useOptimisticTask() {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const completeTask = useCallback(async (taskId: string, leadId: string) => {
    setCompletedIds((prev) => new Set(prev).add(taskId));
    setLoadingIds((prev) => new Set(prev).add(taskId));
    try {
      const res = await fetch(`/api/leads/${leadId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      });
      if (!res.ok) throw new Error('Failed to complete task');
    } catch {
      setCompletedIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      toast.error('Failed to complete task. Please try again.');
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, []);

  return { completedIds, loadingIds, completeTask };
}
