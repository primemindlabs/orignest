'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronDown, ChevronRight, Loader2, Info } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';

type Section = 'appraisal' | 'title' | 'hoi' | 'flood' | 'closing';

interface ChecklistItem {
  id: string;
  lead_id: string;
  org_id: string;
  section: Section;
  item_key: string;
  item_label: string;
  completed: boolean;
  completed_at: string | null;
  value_field: string | null;
  date_field: string | null;
  notes: string | null;
}

interface Props {
  leadId: string;
  loanAmount?: number | null;
}

const SECTION_LABELS: Record<Section, string> = {
  appraisal: 'Appraisal',
  title: 'Title',
  hoi: "Homeowner's Insurance",
  flood: 'Flood',
  closing: 'Closing',
};

const SECTION_ITEMS: Record<Section, Array<{ key: string; label: string; hasValue?: boolean; hasDate?: boolean; valueLabel?: string; dateLabel?: string }>> = {
  appraisal: [
    { key: 'appraisal_ordered', label: 'Appraisal ordered', hasDate: true, dateLabel: 'Order date' },
    { key: 'inspection_scheduled', label: 'Inspection scheduled', hasDate: true, dateLabel: 'Scheduled date' },
    { key: 'report_received', label: 'Report received', hasDate: true, hasValue: true, dateLabel: 'Received date', valueLabel: 'Appraised value' },
    { key: 'value_sufficient', label: 'Value sufficient for loan amount / LTV check passed' },
    { key: 'appraisal_reviewed_uw', label: 'Appraisal reviewed by underwriting' },
  ],
  title: [
    { key: 'title_search_ordered', label: 'Title search ordered' },
    { key: 'title_commitment_received', label: 'Title commitment received', hasDate: true, dateLabel: 'Received date' },
    { key: 'title_exceptions_reviewed', label: 'Title exceptions reviewed' },
    { key: 'final_title_policy', label: 'Final title policy issued' },
  ],
  hoi: [
    { key: 'hoi_quote_provided', label: 'HOI quote provided by borrower' },
    { key: 'hoi_meets_requirements', label: 'Policy meets lender requirements (coverage ≥ loan amount)' },
    { key: 'hoi_binder_received', label: 'HOI binder received', hasDate: true, dateLabel: 'Received date' },
    { key: 'hoi_paid_current', label: 'HOI paid current' },
  ],
  flood: [
    { key: 'flood_cert_ordered', label: 'Flood certification ordered' },
    { key: 'flood_zone_determined', label: 'Flood zone determination complete', hasValue: true, valueLabel: 'Zone (standard / SFHA)' },
    { key: 'flood_insurance_required', label: 'Flood insurance required (if SFHA)' },
    { key: 'flood_policy_received', label: 'Flood policy received (if required)', hasDate: true, dateLabel: 'Received date' },
  ],
  closing: [
    { key: 'rate_locked', label: 'Rate locked', hasDate: true, dateLabel: 'Lock expiration date' },
    { key: 'cd_prepared', label: 'CD prepared' },
    { key: 'cd_sent', label: 'CD sent to borrower (3-bus-day countdown starts)', hasDate: true, dateLabel: 'Date sent' },
    { key: 'cd_receipt_confirmed', label: 'CD receipt confirmed by borrower' },
    { key: 'final_cd_issued', label: 'Final CD issued' },
    { key: 'wire_instructions_confirmed', label: 'Wire instructions confirmed' },
    { key: 'closing_scheduled', label: 'Closing scheduled', hasDate: true, hasValue: true, dateLabel: 'Closing date/time', valueLabel: 'Location/notary' },
  ],
};

const SECTION_ORDER: Section[] = ['appraisal', 'title', 'hoi', 'flood', 'closing'];

export function ClosingChecklist({ leadId, loanAmount }: Props) {
  const sb = createClient();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Set<Section>>(new Set());
  const [editingValues, setEditingValues] = useState<Record<string, { value?: string; date?: string }>>({});

  useEffect(() => {
    loadItems();
  }, [leadId]);

  async function loadItems() {
    const { data } = await sb
      .from('closing_checklist_items')
      .select('*')
      .eq('lead_id', leadId)
      .order('section')
      .order('item_key');

    if (!data || data.length === 0) {
      await seedItems();
    } else {
      setItems(data);
    }
    setLoading(false);
  }

  async function seedItems() {
    const { data: org } = await sb.from('organizations').select('id').single();
    if (!org) return;

    const rows: Array<{
      lead_id: string;
      org_id: string;
      section: Section;
      item_key: string;
      item_label: string;
      completed: boolean;
    }> = [];

    for (const section of SECTION_ORDER) {
      for (const item of SECTION_ITEMS[section]) {
        rows.push({
          lead_id: leadId,
          org_id: org.id,
          section,
          item_key: item.key,
          item_label: item.label,
          completed: false,
        });
      }
    }

    const { data } = await sb.from('closing_checklist_items').insert(rows).select();
    if (data) setItems(data);
  }

  async function toggleItem(id: string, completed: boolean) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, completed, completed_at: completed ? new Date().toISOString() : null }
          : it
      )
    );

    await sb
      .from('closing_checklist_items')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', id);
  }

  async function saveValueField(id: string, value: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, value_field: value } : it))
    );
    await sb
      .from('closing_checklist_items')
      .update({ value_field: value })
      .eq('id', id);
  }

  async function saveDateField(id: string, date: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, date_field: date || null } : it))
    );
    await sb
      .from('closing_checklist_items')
      .update({ date_field: date || null })
      .eq('id', id);
  }

  if (loading) {
    return (
      <div className="py-6 flex items-center justify-center gap-2 text-label-3">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-sm">Loading checklist…</span>
      </div>
    );
  }

  const totalCompleted = items.filter((i) => i.completed).length;
  const total = items.length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-black">Closing Checklist</span>
        <span className="text-xs text-label-2">
          {totalCompleted} of {total} complete
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-fill overflow-hidden">
          <div
            className="h-full rounded-full bg-gold transition-all duration-500"
            style={{ width: `${total > 0 ? (totalCompleted / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {SECTION_ORDER.map((section) => {
          const sectionItems = items.filter((i) => i.section === section);
          const sectionCompleted = sectionItems.filter((i) => i.completed).length;
          const isCollapsed = collapsedSections.has(section);
          const allDone = sectionCompleted === sectionItems.length && sectionItems.length > 0;

          return (
            <div key={section} className="rounded-card border border-border overflow-hidden">
              <button
                onClick={() => {
                  setCollapsedSections((prev) => {
                    const next = new Set(prev);
                    if (next.has(section)) next.delete(section);
                    else next.add(section);
                    return next;
                  });
                }}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-fill/30 hover:bg-fill/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight size={14} className="text-label-3" />
                  ) : (
                    <ChevronDown size={14} className="text-label-3" />
                  )}
                  <span className={`text-[12px] font-semibold uppercase tracking-wide ${allDone ? 'text-green' : 'text-label-2'}`}>
                    {SECTION_LABELS[section]}
                  </span>
                  {allDone ? (
                    <Check size={12} className="text-green" />
                  ) : (
                    <span className="text-[11px] text-label-3">
                      {sectionCompleted}/{sectionItems.length}
                    </span>
                  )}
                </div>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-border/60">
                  {SECTION_ITEMS[section].map((template) => {
                    const item = sectionItems.find((i) => i.item_key === template.key);
                    if (!item) return null;

                    const editing = editingValues[item.id] ?? {};

                    return (
                      <div key={item.id} className="px-4 py-3 bg-surface">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleItem(item.id, !item.completed)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                              item.completed
                                ? 'bg-green border-green'
                                : 'border-border hover:border-green'
                            }`}
                          >
                            {item.completed && (
                              <Check size={11} className="text-white" strokeWidth={3} />
                            )}
                          </button>

                          <div className="flex-1 space-y-1.5">
                            <span
                              className={`text-sm ${
                                item.completed ? 'line-through text-label-3' : 'text-black'
                              }`}
                            >
                              {item.item_label}
                            </span>

                            {/* Date / value fields */}
                            {(template.hasDate || template.hasValue) && (
                              <div className="flex flex-wrap gap-2">
                                {template.hasDate && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-label-3">{template.dateLabel ?? 'Date'}:</span>
                                    <input
                                      type="date"
                                      value={item.date_field ?? editing.date ?? ''}
                                      onChange={(e) => {
                                        setEditingValues((prev) => ({
                                          ...prev,
                                          [item.id]: { ...prev[item.id], date: e.target.value },
                                        }));
                                      }}
                                      onBlur={(e) => saveDateField(item.id, e.target.value)}
                                      className="h-7 px-2 rounded-[6px] bg-fill border border-border text-xs text-black focus:outline-none focus:ring-2 focus:ring-blue/30"
                                    />
                                  </div>
                                )}
                                {template.hasValue && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-label-3">{template.valueLabel ?? 'Value'}:</span>
                                    <input
                                      type="text"
                                      value={item.value_field ?? editing.value ?? ''}
                                      onChange={(e) => {
                                        setEditingValues((prev) => ({
                                          ...prev,
                                          [item.id]: { ...prev[item.id], value: e.target.value },
                                        }));
                                        setItems((prev) =>
                                          prev.map((it) => it.id === item.id ? { ...it, value_field: e.target.value } : it)
                                        );
                                      }}
                                      onBlur={(e) => saveValueField(item.id, e.target.value)}
                                      placeholder={template.valueLabel}
                                      className="h-7 px-2 rounded-[6px] bg-fill border border-border text-xs text-black placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-blue/30 w-36"
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            {item.completed && item.completed_at && (
                              <p className="text-[11px] text-label-3">
                                Completed {format(new Date(item.completed_at), 'MMM d, yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
