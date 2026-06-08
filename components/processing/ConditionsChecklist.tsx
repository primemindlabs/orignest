'use client';

import { useState, useEffect, useTransition, useOptimistic } from 'react';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Check,
  FileText,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDistanceToNow } from 'date-fns';
import { createClient } from '@/lib/supabase/client';

type ConditionStatus = 'issued' | 'submitted' | 'received' | 'under_review' | 'cleared' | 'suspended';
type ConditionCategory = 'income' | 'credit' | 'assets' | 'property' | 'title' | 'insurance' | 'other';
type ConditionPriority = 'standard' | 'prior_to_docs' | 'prior_to_funding' | 'prior_to_closing';

interface Condition {
  id: string;
  lead_id: string;
  condition_text: string;
  category: ConditionCategory;
  priority: ConditionPriority;
  status: ConditionStatus;
  assigned_to: string | null;
  due_date: string | null;
  notes: string | null;
  cleared_at: string | null;
  document_request_id: string | null;
  created_at: string;
}

interface Props {
  leadId: string;
  inline?: boolean;
}

const CATEGORY_LABELS: Record<ConditionCategory, string> = {
  income: 'Income',
  credit: 'Credit',
  assets: 'Assets',
  property: 'Property',
  title: 'Title',
  insurance: 'Insurance',
  other: 'Other',
};

const PRIORITY_CONFIG: Record<ConditionPriority, { label: string; color: string; badgeVariant: 'danger' | 'warning' | 'info' | 'neutral' }> = {
  standard: { label: 'Standard', color: 'text-label-2', badgeVariant: 'neutral' },
  prior_to_docs: { label: 'Prior to Docs', color: 'text-blue', badgeVariant: 'info' },
  prior_to_funding: { label: 'Prior to Funding', color: 'text-orange', badgeVariant: 'warning' },
  prior_to_closing: { label: 'Prior to Closing', color: 'text-red', badgeVariant: 'danger' },
};

const STATUS_FLOW: ConditionStatus[] = ['issued', 'submitted', 'received', 'under_review', 'cleared'];

const STATUS_LABELS: Record<ConditionStatus, string> = {
  issued: 'Issued',
  submitted: 'Submitted',
  received: 'Received',
  under_review: 'Under Review',
  cleared: 'Cleared',
  suspended: 'Suspended',
};

const CATEGORY_ORDER: ConditionCategory[] = ['income', 'credit', 'assets', 'property', 'title', 'insurance', 'other'];

export function ConditionsChecklist({ leadId, inline = false }: Props) {
  const sb = createClient();
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Add condition form state
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState<ConditionCategory>('income');
  const [newPriority, setNewPriority] = useState<ConditionPriority>('standard');
  const [addingCondition, setAddingCondition] = useState(false);

  // Import state
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [parsedConditions, setParsedConditions] = useState<Omit<Condition, 'id' | 'lead_id' | 'assigned_to' | 'due_date' | 'document_request_id' | 'cleared_at' | 'created_at'>[] | null>(null);
  const [savingParsed, setSavingParsed] = useState(false);

  // Expanded notes
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // AI document review (Phase 5.1)
  const [aiReviewing, setAiReviewing] = useState(false);
  const [aiResult, setAiResult] = useState<
    { documentsReviewed: number; autoSatisfied: number; flagged: number; evaluated: number } | null
  >(null);
  const [aiError, setAiError] = useState<string | null>(null);

  async function runAutoSatisfy() {
    setAiReviewing(true);
    setAiError(null);
    setAiResult(null);
    try {
      const res = await fetch('/api/conditions/auto-satisfy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAiError(json.error ?? 'AI review failed');
      } else {
        setAiResult(json);
        fetchConditions(); // realtime also refreshes, but make it instant
      }
    } catch {
      setAiError('AI review failed');
    } finally {
      setAiReviewing(false);
    }
  }

  useEffect(() => {
    fetchConditions();
    // Subscribe to realtime changes
    const channel = sb
      .channel(`conditions:${leadId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'loan_conditions',
        filter: `lead_id=eq.${leadId}`,
      }, () => { fetchConditions(); })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [leadId]);

  async function fetchConditions() {
    const { data } = await sb
      .from('loan_conditions')
      .select('*')
      .eq('lead_id', leadId)
      .order('priority', { ascending: false }) // prior_to_closing first
      .order('created_at', { ascending: true });
    setConditions(data ?? []);
    setLoading(false);
  }

  async function updateStatus(id: string, newStatus: ConditionStatus) {
    // Optimistic update
    setConditions((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status: newStatus, cleared_at: newStatus === 'cleared' ? new Date().toISOString() : c.cleared_at }
          : c
      )
    );

    await sb
      .from('loan_conditions')
      .update({
        status: newStatus,
        cleared_at: newStatus === 'cleared' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  async function addCondition() {
    if (!newText.trim()) return;
    setAddingCondition(true);

    const { data: org } = await sb.from('organizations').select('id').single();
    if (!org) { setAddingCondition(false); return; }

    const { data } = await sb
      .from('loan_conditions')
      .insert({
        lead_id: leadId,
        org_id: org.id,
        condition_text: newText.trim(),
        category: newCategory,
        priority: newPriority,
        status: 'issued',
      })
      .select()
      .single();

    if (data) {
      setConditions((prev) => [...prev, data]);
      setNewText('');
      setNewCategory('income');
      setNewPriority('standard');
      setShowAddForm(false);
    }
    setAddingCondition(false);
  }

  async function parseConditions() {
    if (!importText.trim()) return;
    setImporting(true);

    try {
      const res = await fetch('/api/ai/parse-conditions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditionsText: importText }),
      });
      const json = await res.json();
      setParsedConditions(json.conditions ?? []);
    } catch {
      // no-op
    } finally {
      setImporting(false);
    }
  }

  async function saveParsedConditions() {
    if (!parsedConditions) return;
    setSavingParsed(true);

    const { data: org } = await sb.from('organizations').select('id').single();
    if (!org) { setSavingParsed(false); return; }

    const rows = parsedConditions.map((c) => ({
      lead_id: leadId,
      org_id: org.id,
      condition_text: c.condition_text,
      category: c.category,
      priority: c.priority,
      status: 'issued' as ConditionStatus,
      notes: c.notes ?? null,
    }));

    const { data } = await sb.from('loan_conditions').insert(rows).select();
    if (data) {
      setConditions((prev) => [...prev, ...data]);
      setParsedConditions(null);
      setImportText('');
      setShowImport(false);
    }
    setSavingParsed(false);
  }

  async function saveNote(id: string, note: string) {
    await sb
      .from('loan_conditions')
      .update({ notes: note, updated_at: new Date().toISOString() })
      .eq('id', id);
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, notes: note } : c))
    );
  }

  const cleared = conditions.filter((c) => c.status === 'cleared').length;
  const total = conditions.length;

  const grouped = CATEGORY_ORDER.reduce<Record<string, Condition[]>>((acc, cat) => {
    const items = conditions.filter((c) => c.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="py-8 flex items-center justify-center gap-2 text-label-3">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Loading conditions…</span>
      </div>
    );
  }

  return (
    <div className={inline ? '' : 'space-y-4'}>
      {/* ── Header + Progress ──────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-sm font-semibold text-black">
            Conditions
          </span>
          {total > 0 && (
            <>
              <span className="text-xs text-label-2">
                {cleared} of {total} cleared
              </span>
              <div className="flex-1 max-w-[180px] h-1.5 rounded-full bg-fill overflow-hidden">
                <div
                  className="h-full rounded-full bg-green transition-all duration-500"
                  style={{ width: `${total > 0 ? (cleared / total) * 100 : 0}%` }}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            loading={aiReviewing}
            leftIcon={<Sparkles size={13} />}
            onClick={runAutoSatisfy}
            title="Let AI read uploaded documents and match them to open conditions"
          >
            {aiReviewing ? 'Reviewing…' : 'Auto-match docs'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Sparkles size={13} />}
            onClick={() => setShowImport(!showImport)}
          >
            Import from UW
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus size={13} />}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            Add Condition
          </Button>
        </div>
      </div>

      {/* ── AI review result ──────────────────────────────────────── */}
      {aiResult && (
        <div className="bg-gold/10 rounded-card border border-gold/30 px-4 py-3 flex items-start justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-2.5">
            <Sparkles size={15} className="text-gold mt-0.5 flex-shrink-0" />
            <p className="text-sm text-black leading-snug">
              AI reviewed{' '}
              <span className="font-data">{aiResult.documentsReviewed}</span> document(s):{' '}
              <span className="font-data text-green">{aiResult.autoSatisfied}</span> auto-cleared,{' '}
              <span className="font-data text-orange">{aiResult.flagged}</span> flagged for your review
              {aiResult.evaluated === 0 && ' — no open conditions matched'}.
            </p>
          </div>
          <button onClick={() => setAiResult(null)}>
            <X size={14} className="text-label-3 hover:text-label-2" />
          </button>
        </div>
      )}
      {aiError && (
        <div className="bg-red/5 rounded-card border border-red/20 px-4 py-3 flex items-center justify-between gap-3 animate-fade-in">
          <p className="text-sm text-red leading-snug">{aiError}</p>
          <button onClick={() => setAiError(null)}>
            <X size={14} className="text-label-3 hover:text-label-2" />
          </button>
        </div>
      )}

      {/* ── Import Panel ──────────────────────────────────────────── */}
      {showImport && (
        <div className="bg-navy/5 rounded-card border border-border p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-black">Paste UW conditions block</p>
            <button onClick={() => { setShowImport(false); setParsedConditions(null); setImportText(''); }}>
              <X size={14} className="text-label-3 hover:text-label-2" />
            </button>
          </div>

          {!parsedConditions ? (
            <>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste the full underwriting conditions text here…"
                rows={6}
                className="w-full px-3 py-2 rounded-[8px] bg-surface border border-border text-sm text-black placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-blue/30 resize-none"
              />
              <Button
                variant="primary"
                size="sm"
                loading={importing}
                leftIcon={<Sparkles size={13} />}
                onClick={parseConditions}
                disabled={!importText.trim()}
              >
                Parse with AI
              </Button>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-label-2">{parsedConditions.length} conditions parsed — review and save:</p>
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {parsedConditions.map((c, i) => (
                  <div key={i} className="bg-surface rounded-[8px] border border-border px-3 py-2 flex items-start justify-between gap-2">
                    <p className="text-sm text-black flex-1">{c.condition_text}</p>
                    <div className="flex gap-1 flex-shrink-0">
                      <Badge variant={PRIORITY_CONFIG[c.priority].badgeVariant} size="sm">
                        {PRIORITY_CONFIG[c.priority].label}
                      </Badge>
                      <Badge variant="neutral" size="sm">
                        {CATEGORY_LABELS[c.category]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  loading={savingParsed}
                  onClick={saveParsedConditions}
                >
                  Save {parsedConditions.length} conditions
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setParsedConditions(null)}
                >
                  Re-parse
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add Condition Form ────────────────────────────────────── */}
      {showAddForm && (
        <div className="bg-surface rounded-card border border-border p-4 space-y-3 animate-fade-in">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Condition text (e.g., 'Provide updated pay stub dated within 30 days')"
            rows={2}
            className="w-full px-3 py-2 rounded-[8px] bg-fill border border-border text-sm text-black placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-blue/30 resize-none"
          />
          <div className="flex gap-2 flex-wrap">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as ConditionCategory)}
              className="h-8 px-2.5 rounded-[8px] bg-fill border border-border text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue/30"
            >
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as ConditionPriority)}
              className="h-8 px-2.5 rounded-[8px] bg-fill border border-border text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue/30"
            >
              {Object.entries(PRIORITY_CONFIG).map(([v, cfg]) => (
                <option key={v} value={v}>{cfg.label}</option>
              ))}
            </select>
            <Button
              variant="primary"
              size="sm"
              loading={addingCondition}
              onClick={addCondition}
              disabled={!newText.trim()}
            >
              Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowAddForm(false); setNewText(''); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── Conditions by Category ────────────────────────────────── */}
      {total === 0 ? (
        <div className="py-8 text-center text-sm text-label-3">
          No conditions added yet
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(grouped).map(([cat, items]) => {
            const isCollapsed = collapsedCategories.has(cat);
            const catCleared = items.filter((c) => c.status === 'cleared').length;

            return (
              <div key={cat} className="rounded-card border border-border overflow-hidden">
                {/* Category header */}
                <button
                  onClick={() => {
                    setCollapsedCategories((prev) => {
                      const next = new Set(prev);
                      if (next.has(cat)) next.delete(cat);
                      else next.add(cat);
                      return next;
                    });
                  }}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-fill/30 hover:bg-fill/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight size={14} className="text-label-3" /> : <ChevronDown size={14} className="text-label-3" />}
                    <span className="text-[12px] font-semibold text-label-2 uppercase tracking-wide">
                      {CATEGORY_LABELS[cat as ConditionCategory]}
                    </span>
                    <span className="text-[11px] text-label-3">
                      {catCleared}/{items.length}
                    </span>
                  </div>
                </button>

                {/* Conditions */}
                {!isCollapsed && (
                  <div className="divide-y divide-border/60">
                    {items.map((cond) => (
                      <ConditionCard
                        key={cond.id}
                        condition={cond}
                        onStatusChange={updateStatus}
                        onSaveNote={saveNote}
                        expandedNotes={expandedNotes}
                        setExpandedNotes={setExpandedNotes}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConditionCard({
  condition,
  onStatusChange,
  onSaveNote,
  expandedNotes,
  setExpandedNotes,
}: {
  condition: Condition;
  onStatusChange: (id: string, status: ConditionStatus) => void;
  onSaveNote: (id: string, note: string) => void;
  expandedNotes: Set<string>;
  setExpandedNotes: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const isCleared = condition.status === 'cleared';
  const isSuspended = condition.status === 'suspended';
  const noteExpanded = expandedNotes.has(condition.id);
  const [noteText, setNoteText] = useState(condition.notes ?? '');
  const priorityCfg = PRIORITY_CONFIG[condition.priority];

  const currentIdx = STATUS_FLOW.indexOf(condition.status);
  const canAdvance = currentIdx < STATUS_FLOW.length - 1 && !isSuspended;
  const nextStatus = canAdvance ? STATUS_FLOW[currentIdx + 1] : null;

  const borderLeft =
    condition.priority === 'prior_to_closing'
      ? 'border-l-2 border-l-red'
      : condition.priority === 'prior_to_funding'
      ? 'border-l-2 border-l-orange'
      : condition.priority === 'prior_to_docs'
      ? 'border-l-2 border-l-blue'
      : '';

  return (
    <div
      className={`px-4 py-3 bg-surface ${borderLeft} ${
        isCleared ? 'opacity-60' : ''
      } transition-opacity`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onStatusChange(condition.id, isCleared ? 'issued' : 'cleared')}
          className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-all ${
            isCleared
              ? 'bg-green border-green'
              : 'border-border hover:border-blue'
          }`}
        >
          {isCleared && <Check size={11} className="text-white" strokeWidth={3} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <p
            className={`text-sm text-black leading-snug ${
              isCleared ? 'line-through text-label-3' : ''
            }`}
          >
            {condition.condition_text}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={priorityCfg.badgeVariant} size="sm">
              {priorityCfg.label}
            </Badge>
            <Badge variant="neutral" size="sm">
              {STATUS_LABELS[condition.status]}
            </Badge>
            {condition.due_date && (
              <span className="text-[11px] text-label-3">
                Due {new Date(condition.due_date).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Notes */}
          {noteExpanded && (
            <div className="pt-1 space-y-1.5">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note…"
                rows={2}
                className="w-full px-2.5 py-1.5 rounded-[6px] bg-fill border border-border text-xs text-black placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-blue/30 resize-none"
              />
              <button
                onClick={() => { onSaveNote(condition.id, noteText); setExpandedNotes((prev) => { const next = new Set(prev); next.delete(condition.id); return next; }); }}
                className="text-xs text-blue hover:underline"
              >
                Save note
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setExpandedNotes((prev) => { const next = new Set(prev); if (next.has(condition.id)) next.delete(condition.id); else next.add(condition.id); return next; })}
            className="p-1 rounded hover:bg-fill text-label-3 hover:text-label-2 transition-colors"
            title="Notes"
          >
            <FileText size={13} />
          </button>
          {!isCleared && nextStatus && (
            <button
              onClick={() => onStatusChange(condition.id, nextStatus)}
              className="h-7 px-2.5 rounded-[6px] bg-blue/8 text-blue text-[11px] font-medium hover:bg-blue/14 transition-colors"
            >
              {nextStatus === 'cleared' ? 'Mark Cleared' : `Mark ${STATUS_LABELS[nextStatus]}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
