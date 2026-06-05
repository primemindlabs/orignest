'use client';

import { useState } from 'react';
import { Copy, Check, RefreshCw, Code2, Eye, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WidgetSettingsPage() {
  const [token] = useState('demo_widget_token_abc123');
  const [copied, setCopied] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#0F1D2E');
  const [loName, setLoName] = useState('');
  const [loNmls, setLoNmls] = useState('');
  const [successMessage, setSuccessMessage] = useState('A loan officer will contact you within 5 minutes!');
  const [tab, setTab] = useState<'config' | 'embed' | 'preview'>('config');

  const widgetUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://app.orignest.com'}/widget/${token}`;

  const embedCode = `<!-- Orignest Pre-Qual Widget -->
<div id="orignest-widget"></div>
<script>
(function(w,d,t,o){
  var f=d.createElement(t);
  f.src='${widgetUrl}';
  f.style='border:none;width:100%;min-height:600px;';
  var c=d.getElementById('orignest-widget');
  if(c)c.appendChild(f);
})(window,document,'iframe','${token}');
</script>`;

  async function copyEmbed() {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-label tracking-tight">Pre-Qual Widget</h1>
        <p className="text-sm text-label-2 mt-0.5">Embed a lead capture form on your website or partner sites</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Leads Captured', value: '—', color: 'text-navy' },
          { label: 'This Month', value: '—', color: 'text-blue' },
          { label: 'Conversion Rate', value: '—', color: 'text-green' },
        ].map((s) => (
          <div key={s.label} className="bg-surface rounded-[10px] border border-black/[0.06] p-4 shadow-card">
            <div className={cn('text-xl font-bold mb-1', s.color)}>{s.value}</div>
            <div className="text-xs text-label-2">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-black/[0.06] rounded-[10px] p-1">
        {[
          { id: 'config', label: 'Configure', icon: RefreshCw },
          { id: 'embed', label: 'Embed Code', icon: Code2 },
          { id: 'preview', label: 'Preview', icon: Eye },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as typeof tab)}
            className={cn(
              'flex items-center gap-2 flex-1 px-3 py-2 rounded-[8px] text-sm font-medium transition-colors',
              tab === id ? 'bg-white text-label shadow-card' : 'text-label-3 hover:text-label',
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'config' && (
        <div className="bg-surface rounded-[10px] border border-black/[0.06] p-5 shadow-card space-y-4">
          <h2 className="text-sm font-semibold text-label">Widget Configuration</h2>

          <div>
            <label className="block text-xs font-medium text-label-2 mb-1">Widget Token</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={token}
                readOnly
                className="flex-1 px-3 py-2 rounded-[8px] border border-black/[0.12] bg-bg text-sm text-label-2 font-mono"
              />
              <button className="px-3 py-2 rounded-[8px] bg-black/[0.06] text-label-2 text-sm hover:bg-black/[0.10]">
                <RefreshCw size={14} />
              </button>
            </div>
            <p className="text-xs text-label-3 mt-1">Regenerating the token will break existing embeds.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-label-2 mb-1">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded-[8px] border border-black/[0.12] cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="px-3 py-2 rounded-[8px] border border-black/[0.12] bg-bg text-sm font-mono w-28"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-label-2 mb-1">LO Display Name</label>
              <input
                type="text"
                value={loName}
                onChange={(e) => setLoName(e.target.value)}
                placeholder="John Smith"
                className="w-full px-3 py-2 rounded-[8px] border border-black/[0.12] bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-blue/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-label-2 mb-1">NMLS ID</label>
              <input
                type="text"
                value={loNmls}
                onChange={(e) => setLoNmls(e.target.value)}
                placeholder="1234567"
                className="w-full px-3 py-2 rounded-[8px] border border-black/[0.12] bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-blue/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-label-2 mb-1">Success Message</label>
            <input
              type="text"
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
              className="w-full px-3 py-2 rounded-[8px] border border-black/[0.12] bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-blue/20"
            />
          </div>

          <button className="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-[12px] hover:bg-navy/90 transition-colors">
            Save Configuration
          </button>
        </div>
      )}

      {tab === 'embed' && (
        <div className="bg-surface rounded-[10px] border border-black/[0.06] p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-label">Embed Code</h2>
            <button
              onClick={copyEmbed}
              className="flex items-center gap-2 px-3 py-1.5 bg-black/[0.06] text-label text-sm font-medium rounded-[8px] hover:bg-black/[0.10] transition-colors"
            >
              {copied ? <Check size={14} className="text-green" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
          <pre className="bg-navy text-green/80 text-xs rounded-[10px] p-4 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
            {embedCode}
          </pre>
          <div className="bg-blue/10 border border-blue/20 rounded-[8px] p-3">
            <p className="text-xs text-blue font-medium mb-1">How to embed</p>
            <p className="text-xs text-blue/80">Paste this code into any webpage, landing page, or CMS where you want the widget to appear. Works in any website builder (Wix, Squarespace, WordPress, custom HTML).</p>
          </div>
        </div>
      )}

      {tab === 'preview' && (
        <div className="bg-surface rounded-[10px] border border-black/[0.06] shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-black/[0.06] bg-bg flex items-center gap-2">
            <Eye size={14} className="text-label-3" />
            <span className="text-sm text-label-2">Widget Preview (max-width 420px)</span>
          </div>
          <div className="p-5 flex justify-center bg-[#f0f0f5]">
            <iframe
              src={widgetUrl}
              className="w-full max-w-[420px] rounded-[10px] shadow-elevated"
              style={{ minHeight: 600, border: 'none' }}
              title="Widget Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}
