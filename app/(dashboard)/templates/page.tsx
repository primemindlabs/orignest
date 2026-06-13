'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { clsx } from 'clsx';
import {
  FileText,
  Plus,
  Search,
  Edit3,
  Copy,
  Clock,
  ChevronRight,
  Download,
  Mail,
  X,
  Bold,
  Italic,
  List,
  Sparkles,
  Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateCategory =
  | 'pre_approval'
  | 'loe'
  | 'rate_lock'
  | 'conditions'
  | 'gift_letter'
  | 'closing'
  | 'marketing'
  | 'other';

interface DocumentTemplate {
  id: string;
  org_id: string | null;
  category: TemplateCategory;
  name: string;
  description: string | null;
  template_html: string;
  variables: string[];
  is_system: boolean;
  is_active: boolean;
  use_count: number;
  created_at: string;
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  loan_amount: number | null;
  loan_type: string | null;
  stage: string;
  email: string;
  phone: string | null;
  property_address: string | null;
  closing_date: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  pre_approval: 'Pre-Approval',
  loe: 'Letter of Explanation',
  rate_lock: 'Rate Lock',
  conditions: 'Conditions',
  gift_letter: 'Gift Letter',
  closing: 'Closing',
  marketing: 'Marketing',
  other: 'Other',
};

const CATEGORY_VARIANT: Record<TemplateCategory, 'info' | 'warning' | 'success' | 'gold' | 'neutral'> = {
  pre_approval: 'success',
  loe: 'warning',
  rate_lock: 'info',
  conditions: 'warning',
  gift_letter: 'neutral',
  closing: 'gold',
  marketing: 'info',
  other: 'neutral',
};

const ALL_CATEGORIES: TemplateCategory[] = [
  'pre_approval', 'loe', 'rate_lock', 'conditions', 'gift_letter', 'closing', 'marketing', 'other',
];

const TEMPLATE_VARIABLES = [
  'borrower_first_name', 'borrower_last_name', 'loan_amount', 'property_address',
  'lo_name', 'lo_nmls', 'lo_phone', 'company_name', 'date', 'rate', 'expiration_date',
];

// ─── Variable substitution ────────────────────────────────────────────────────

function substituteVariables(
  content: string,
  lead: Lead | null,
  loName: string,
  loNmls: string,
  loPhone: string,
  companyName: string,
): string {
  const today = format(new Date(), 'MMMM d, yyyy');
  const vars: Record<string, string> = {
    borrower_first_name: lead?.first_name ?? '[First Name]',
    borrower_last_name: lead?.last_name ?? '[Last Name]',
    loan_amount: lead?.loan_amount
      ? `$${lead.loan_amount.toLocaleString()}`
      : '[Loan Amount]',
    property_address: lead?.property_address ?? '[Property Address]',
    lo_name: loName || '[Loan Officer Name]',
    lo_nmls: loNmls || '[NMLS#]',
    lo_phone: loPhone || '[Phone Number]',
    company_name: companyName || '[Company Name]',
    date: today,
    rate: '[Interest Rate]',
    expiration_date: '[Expiration Date]',
  };

  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onUse,
  onEdit,
}: {
  template: DocumentTemplate;
  onUse: (t: DocumentTemplate) => void;
  onEdit: (t: DocumentTemplate) => void;
}) {
  const preview = template.template_html
    .replace(/<[^>]*>/g, '')
    .replace(/\{\{[^}]*\}\}/g, '…')
    .slice(0, 160);

  return (
    <div className="bg-white rounded-[12px] border border-[rgba(60,60,67,0.10)] shadow-card p-4 flex flex-col gap-3 hover:shadow-elevated transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant={CATEGORY_VARIANT[template.category]} size="sm">
              {CATEGORY_LABELS[template.category]}
            </Badge>
            {template.is_system && (
              <span className="text-[10px] text-label-3 font-medium">System</span>
            )}
          </div>
          <h3 className="text-[14px] font-semibold text-black truncate">{template.name}</h3>
        </div>
        <FileText size={18} className="text-label-3 flex-shrink-0 mt-0.5" />
      </div>

      <p className="text-[12px] text-label-2 leading-relaxed line-clamp-3 flex-1">
        {preview}
      </p>

      <div className="flex items-center justify-between pt-2 border-t border-[rgba(60,60,67,0.07)]">
        <div className="flex items-center gap-2 text-[11px] text-label-3">
          <Clock size={11} />
          {template.use_count > 0
            ? `Used ${template.use_count} time${template.use_count !== 1 ? 's' : ''}`
            : 'Not used yet'}
        </div>
        <div className="flex items-center gap-1.5">
          {!template.is_system && (
            <button
              onClick={() => onEdit(template)}
              className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px] font-medium text-label-2 hover:bg-[rgba(60,60,67,0.07)] transition-colors"
            >
              <Edit3 size={11} />
              Edit
            </button>
          )}
          <button
            onClick={() => onUse(template)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-blue text-white text-[12px] font-medium hover:bg-blue/90 transition-colors"
          >
            Use
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Editor / Use modal ───────────────────────────────────────────────────────

interface EditorModalProps {
  template: DocumentTemplate;
  leads: Lead[];
  loName: string;
  loNmls: string;
  loPhone: string;
  companyName: string;
  mode: 'use' | 'edit';
  onClose: () => void;
  onSave?: (content: string) => void;
}

function EditorModal({
  template,
  leads,
  loName,
  loNmls,
  loPhone,
  companyName,
  mode,
  onClose,
}: EditorModalProps) {
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sending, setSending] = useState(false);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;

  const renderedContent = substituteVariables(
    template.template_html,
    selectedLead,
    loName,
    loNmls,
    loPhone,
    companyName,
  );

  const filteredLeads = leadSearch.trim()
    ? leads.filter((l) =>
        `${l.first_name} ${l.last_name}`.toLowerCase().includes(leadSearch.toLowerCase())
      )
    : leads.slice(0, 6);

  async function handleCopy() {
    const plainText = renderedContent.replace(/<[^>]*>/g, '');
    await navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${template.name}</title>
          <style>
            body { font-family: -apple-system, Georgia, serif; max-width: 680px; margin: 40px auto; padding: 0 20px; color: #1c1c1e; line-height: 1.7; font-size: 14px; }
            @media print { @page { margin: 1in; } }
          </style>
        </head>
        <body>${renderedContent.replace(/\n/g, '<br>')}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  async function handleEmail() {
    if (!selectedLead) return;
    setSending(true);
    try {
      await fetch('/api/inbox/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          channel: 'email',
          body: renderedContent.replace(/<[^>]*>/g, ''),
          toAddress: selectedLead.email,
          subject: template.name,
        }),
      });
      setEmailSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-[16px] shadow-sheet flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(60,60,67,0.10)] flex-shrink-0">
          <div>
            <h2 className="text-[16px] font-semibold text-black">{template.name}</h2>
            <Badge variant={CATEGORY_VARIANT[template.category]} size="sm" className="mt-1">
              {CATEGORY_LABELS[template.category]}
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[rgba(60,60,67,0.08)] flex items-center justify-center text-label-2 hover:bg-[rgba(60,60,67,0.14)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Lead selector */}
          {mode === 'use' && (
            <div className="px-5 pt-4 pb-3 border-b border-[rgba(60,60,67,0.07)]">
              <label className="text-[12px] font-medium text-label-2 mb-2 block">
                Borrower (optional — auto-fills variables)
              </label>
              <input
                type="text"
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                placeholder="Search borrowers…"
                className="w-full h-8 px-3 rounded-[8px] bg-[rgba(60,60,67,0.06)] text-[13px] outline-none focus:bg-[rgba(60,60,67,0.09)] mb-2"
              />
              <div className="flex flex-wrap gap-1.5">
                {filteredLeads.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLeadId(l.id === selectedLeadId ? '' : l.id)}
                    className={clsx(
                      'px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors',
                      selectedLeadId === l.id
                        ? 'bg-blue text-white'
                        : 'bg-[rgba(60,60,67,0.07)] text-label-2 hover:bg-[rgba(60,60,67,0.12)]'
                    )}
                  >
                    {l.first_name} {l.last_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Document preview */}
          <div className="px-8 py-6">
            <div
              className="text-[14px] text-black leading-relaxed whitespace-pre-wrap font-[Georgia,serif] border border-[rgba(60,60,67,0.10)] rounded-[8px] p-6 bg-[#FAFAF9] min-h-[300px]"
              dangerouslySetInnerHTML={{ __html: renderedContent.replace(/\n/g, '<br>') }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[rgba(60,60,67,0.10)] flex-shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-[12px] font-medium border border-[rgba(60,60,67,0.15)] text-label-2 hover:bg-[rgba(60,60,67,0.05)] transition-colors"
            >
              {copied ? <Check size={13} className="text-green" /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-[12px] font-medium border border-[rgba(60,60,67,0.15)] text-label-2 hover:bg-[rgba(60,60,67,0.05)] transition-colors"
            >
              <Download size={13} />
              PDF / Print
            </button>
          </div>

          {mode === 'use' && selectedLead && (
            <Button
              onClick={handleEmail}
              loading={sending}
              leftIcon={emailSent ? <Check size={13} /> : <Mail size={13} />}
              size="sm"
              variant={emailSent ? 'secondary' : 'primary'}
            >
              {emailSent ? 'Sent!' : `Email to ${selectedLead.first_name}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create template modal ────────────────────────────────────────────────────

function CreateTemplateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const sb = createClient();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('other');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);

    const { error: err } = await sb.from('document_templates').insert({
      name: name.trim(),
      category,
      template_html: content,
      variables: TEMPLATE_VARIABLES.filter((v) => content.includes(`{{${v}}}`)),
      is_system: false,
    });

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    onCreated();
    onClose();
  }

  function insertVariable(v: string) {
    setContent((c) => `${c}{{${v}}}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-[16px] shadow-sheet flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(60,60,67,0.10)]">
          <h2 className="text-[16px] font-semibold text-black">New Template</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-[rgba(60,60,67,0.08)] flex items-center justify-center text-label-2 hover:bg-[rgba(60,60,67,0.14)] transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-medium text-label-2 mb-1.5 block">Template name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pre-Approval Letter"
                className="w-full h-9 px-3 rounded-[8px] border border-[rgba(60,60,67,0.15)] text-[13px] outline-none focus:border-blue/60 focus:shadow-input transition-all"
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-label-2 mb-1.5 block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className="w-full h-9 px-3 rounded-[8px] border border-[rgba(60,60,67,0.15)] text-[13px] outline-none focus:border-blue/60 bg-white appearance-none"
              >
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Variable chips */}
          <div>
            <p className="text-[12px] font-medium text-label-2 mb-2">Insert variable</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v}
                  onClick={() => insertVariable(v)}
                  className="px-2 py-0.5 rounded-[6px] bg-[rgba(60,60,67,0.07)] text-[11px] font-mono text-label-2 hover:bg-blue/10 hover:text-blue transition-colors"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Content editor */}
          <div>
            <label className="text-[12px] font-medium text-label-2 mb-1.5 block">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your template here. Use {{variable_name}} for dynamic values."
              rows={14}
              className="w-full px-3 py-2.5 rounded-[8px] border border-[rgba(60,60,67,0.15)] text-[13px] text-black leading-relaxed font-[Georgia,serif] resize-none outline-none focus:border-blue/60 focus:shadow-input transition-all"
            />
          </div>

          {error && <p className="text-[12px] text-red">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[rgba(60,60,67,0.10)]">
          <Button variant="secondary" onClick={onClose} size="sm">Cancel</Button>
          <Button onClick={handleSave} loading={saving} size="sm">Save Template</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const sb = createClient();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>('all');
  const [selected, setSelected] = useState<DocumentTemplate | null>(null);
  const [editorMode, setEditorMode] = useState<'use' | 'edit'>('use');
  const [showCreate, setShowCreate] = useState(false);

  // LO merge tokens come from the signed-in profile (Settings → Profile).
  // Fetched via the API because profiles aren't readable from the browser
  // client under Clerk (RLS keys off auth.uid(), which is never set).
  const [loName, setLoName] = useState('');
  const [loNmls, setLoNmls] = useState('');
  const [loPhone, setLoPhone] = useState('');
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings/profile');
        if (!res.ok) return;
        const { profile, company } = await res.json();
        if (cancelled) return;
        const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
        setLoName(name);
        setLoNmls(profile?.nmls_id ?? '');
        setLoPhone(profile?.phone ?? '');
        setCompanyName(company ?? '');
      } catch {
        /* fall back to the [Bracketed] merge-field placeholders */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadData = useCallback(async () => {
    const [{ data: tmplData }, { data: leadData }] = await Promise.all([
      sb
        .from('document_templates')
        .select('*')
        .eq('is_active', true)
        .order('is_system', { ascending: false })
        .order('use_count', { ascending: false }),
      sb
        .from('leads')
        .select('id,first_name,last_name,loan_amount,loan_type,stage,email,phone,property_address,closing_date')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    setTemplates((tmplData ?? []) as DocumentTemplate[]);
    setLeads((leadData ?? []) as Lead[]);
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = templates.filter((t) => {
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.template_html.toLowerCase().includes(q);
    }
    return true;
  });

  const grouped = ALL_CATEGORIES.reduce<Record<string, DocumentTemplate[]>>((acc, cat) => {
    const items = filtered.filter((t) => t.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="max-w-5xl space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-black tracking-tight">Document Templates</h1>
          <p className="text-[14px] text-label-2 mt-0.5">
            Pre-built letters and documents — click Use to auto-fill with borrower data.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          leftIcon={<Plus size={14} />}
          size="md"
        >
          New Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-shrink-0">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-label-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="h-9 pl-8 pr-3 w-56 rounded-[8px] border border-[rgba(60,60,67,0.15)] text-[13px] outline-none focus:border-blue/60 focus:shadow-input transition-all bg-white"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setCategoryFilter('all')}
            className={clsx(
              'flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors whitespace-nowrap',
              categoryFilter === 'all' ? 'bg-navy text-white' : 'text-label-2 hover:bg-[rgba(60,60,67,0.07)]'
            )}
          >
            All
          </button>
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={clsx(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors whitespace-nowrap',
                categoryFilter === cat ? 'bg-navy text-white' : 'text-label-2 hover:bg-[rgba(60,60,67,0.07)]'
              )}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Template grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[180px] bg-[rgba(60,60,67,0.04)] rounded-[12px] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="w-14 h-14 rounded-[20px] bg-[rgba(60,60,67,0.06)] flex items-center justify-center">
            <FileText size={26} className="text-label-3" />
          </div>
          <p className="text-[15px] font-semibold text-black">No templates found</p>
          <p className="text-[13px] text-label-2">Try a different search or category.</p>
          <Button onClick={() => setShowCreate(true)} leftIcon={<Plus size={14} />} size="sm">
            Create template
          </Button>
        </div>
      ) : categoryFilter !== 'all' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onUse={(tmpl) => { setSelected(tmpl); setEditorMode('use'); }}
              onEdit={(tmpl) => { setSelected(tmpl); setEditorMode('edit'); }}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <h2 className="text-[14px] font-semibold text-label-2 mb-3 flex items-center gap-2">
                <span>{CATEGORY_LABELS[cat as TemplateCategory]}</span>
                <span className="w-5 h-5 rounded-full bg-[rgba(60,60,67,0.08)] text-[10px] font-bold text-label-3 flex items-center justify-center">
                  {items.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onUse={(tmpl) => { setSelected(tmpl); setEditorMode('use'); }}
                    onEdit={(tmpl) => { setSelected(tmpl); setEditorMode('edit'); }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {selected && (
        <EditorModal
          template={selected}
          leads={leads}
          loName={loName}
          loNmls={loNmls}
          loPhone={loPhone}
          companyName={companyName}
          mode={editorMode}
          onClose={() => setSelected(null)}
          onSave={() => {
            setSelected(null);
            void loadData();
          }}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateTemplateModal
          onClose={() => setShowCreate(false)}
          onCreated={loadData}
        />
      )}
    </div>
  );
}
