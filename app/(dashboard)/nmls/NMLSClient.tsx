'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import {
  ShieldCheck, AlertTriangle, Clock, CheckCircle2,
  RefreshCw, Plus, X, Building2, User, GraduationCap
} from 'lucide-react';

interface License {
  id: string;
  nmls_id: string;
  license_type: string;
  state: string;
  status: string;
  expiration_date: string | null;
  last_verified_at: string | null;
  ce_hours_required: number;
  ce_hours_completed: number;
  profiles?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    nmls_id: string | null;
  } | null;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  nmls_id: string | null;
  role: string;
}

interface NMLSClientProps {
  orgId: string;
  orgName: string;
  orgNmlsId: string | null;
  licenses: License[];
  team: TeamMember[];
  expiringCount: number;
}

const STATE_OPTIONS = [
  { value: '', label: 'Select State' },
  ...['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
     'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
     'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
     'VA','WA','WV','WI','WY'].map((s) => ({ value: s, label: s })),
];

const STATE_CE_REQUIREMENTS: Record<string, { total: number; renewal: string; notes: string }> = {
  CA: { total: 10, renewal: 'Dec 31', notes: 'California DBO requires 2 additional state-specific hours' },
  FL: { total: 8, renewal: 'Dec 31', notes: 'Florida Office of Financial Regulation — no additional state hours' },
  GA: { total: 10, renewal: 'Dec 31', notes: 'No temporary licenses; 2 additional state hours required' },
  NY: { total: 11, renewal: 'Dec 31', notes: '3 NY-specific hours; no streamlined licensing' },
  TX: { total: 8, renewal: 'Dec 31', notes: 'Texas SML — no additional state hours' },
  OH: { total: 8, renewal: 'Dec 31', notes: 'Ohio Division of Financial Institutions' },
  PA: { total: 8, renewal: 'Dec 31', notes: 'Pennsylvania Department of Banking' },
  IL: { total: 10, renewal: 'Dec 31', notes: '2 Illinois-specific CE hours required' },
  NJ: { total: 8, renewal: 'Dec 31', notes: 'New Jersey Department of Banking and Insurance' },
  WA: { total: 8, renewal: 'Dec 31', notes: 'Washington DFI' },
};

function getExpiryBadge(expirationDate: string | null): { color: string; label: string; daysLeft: number | null } {
  if (!expirationDate) return { color: 'text-label-3', label: 'No expiry', daysLeft: null };
  const today = new Date();
  const exp = new Date(expirationDate);
  const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 0) return { color: 'text-red font-semibold', label: 'Expired', daysLeft };
  if (daysLeft <= 30) return { color: 'text-red font-semibold', label: `${daysLeft}d`, daysLeft };
  if (daysLeft <= 90) return { color: 'text-orange font-semibold', label: `${daysLeft}d`, daysLeft };
  return { color: 'text-green-600', label: `${daysLeft}d`, daysLeft };
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function NMLSClient({ orgId: _orgId, orgName, orgNmlsId, licenses, team, expiringCount }: NMLSClientProps) {
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, { status: string; source: string; disciplinaryFlag: boolean }>>({});
  const [showAddLicense, setShowAddLicense] = useState(false);
  const [addForm, setAddForm] = useState({
    profileId: '', nmlsId: '', state: '', licenseNumber: '',
    expirationDate: '', ceRequired: '8', ceCompleted: '0',
  });
  const [addLoading, setAddLoading] = useState(false);
  const [selectedState, setSelectedState] = useState('');
  const [activeTab, setActiveTab] = useState<'licenses' | 'ce' | 'states'>('licenses');

  async function handleVerify(license: License) {
    setVerifyingId(license.id);
    try {
      const r = await fetch('/api/nmls/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nmlsId: license.nmls_id, profileId: license.profiles?.id, state: license.state }),
      });
      const data = await r.json() as { result?: { status: string; source: string; disciplinaryFlag: boolean } };
      if (data.result) setVerifyResult((p) => ({ ...p, [license.id]: data.result! }));
    } catch { /* ignore */ }
    finally { setVerifyingId(null); }
  }

  async function handleAddLicense(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    try {
      const r = await fetch('/api/nmls/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nmlsId: addForm.nmlsId, profileId: addForm.profileId || undefined, state: addForm.state }),
      });
      if (r.ok) { setShowAddLicense(false); window.location.reload(); }
    } finally { setAddLoading(false); }
  }

  const licensesByProfile: Record<string, { member: TeamMember | null; licenses: License[] }> = {};
  for (const lic of licenses) {
    const pid = lic.profiles?.id ?? 'company';
    if (!licensesByProfile[pid]) {
      licensesByProfile[pid] = { member: team.find((t) => t.id === pid) ?? null, licenses: [] };
    }
    licensesByProfile[pid].licenses.push(lic);
  }

  const activeLicenses = licenses.filter((l) => l.status === 'active').length;
  const ceDeficient = licenses.filter((l) => l.ce_hours_completed < l.ce_hours_required).length;

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-black tracking-tight">NMLS Compliance Center</h1>
          <p className="text-label-2 text-sm mt-0.5">{orgName} · Company NMLS: {orgNmlsId ?? 'Not set'}</p>
        </div>
        <Button onClick={() => setShowAddLicense(true)} leftIcon={<Plus size={15} />}>Add License</Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Licenses', value: licenses.length, icon: <ShieldCheck size={16} />, color: 'text-blue' },
          { label: 'Active', value: activeLicenses, icon: <CheckCircle2 size={16} />, color: 'text-green-600' },
          { label: 'Expiring ≤90d', value: expiringCount, icon: <Clock size={16} />, color: expiringCount > 0 ? 'text-orange' : 'text-label-2' },
          { label: 'CE Deficient', value: ceDeficient, icon: <GraduationCap size={16} />, color: ceDeficient > 0 ? 'text-red' : 'text-label-2' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-4">
            <div className={`flex items-center gap-1.5 mb-2`}>
              <span className={kpi.color}>{kpi.icon}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-label-2">{kpi.label}</span>
            </div>
            <p className={`text-[28px] font-bold font-mono ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {expiringCount > 0 && (
        <div className="flex items-start gap-3 bg-orange/10 border border-orange/20 rounded-2xl p-4">
          <AlertTriangle size={16} className="text-orange mt-0.5 flex-shrink-0" />
          <p className="text-[13px] text-orange font-medium">
            {expiringCount} license{expiringCount > 1 ? 's' : ''} expiring within 90 days.
            Initiate renewals promptly — SAFE Act requires an active license before originating in that state.
          </p>
        </div>
      )}

      <div className="flex gap-1 bg-[rgba(118,118,128,0.12)] rounded-xl p-1 w-fit">
        {(['licenses', 'ce', 'states'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-[9px] text-[13px] font-medium transition-colors ${
              activeTab === tab ? 'bg-white shadow-sm text-black' : 'text-label-2 hover:text-black'
            }`}>
            {tab === 'licenses' ? 'Team Licenses' : tab === 'ce' ? 'CE Tracker' : 'State Requirements'}
          </button>
        ))}
      </div>

      {activeTab === 'licenses' && (
        <div className="bg-white border border-black/[0.06] shadow-sm rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['LO / Entity', 'NMLS ID', 'State', 'Status', 'Expires', 'Last Verified', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {licenses.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-label-2 text-sm">
                  No licenses on file. Click &ldquo;Add License&rdquo; to get started.
                </td></tr>
              )}
              {licenses.map((lic) => {
                const expiry = getExpiryBadge(lic.expiration_date);
                const vr = verifyResult[lic.id];
                const isVerifying = verifyingId === lic.id;
                const memberName = lic.profiles ? `${lic.profiles.first_name} ${lic.profiles.last_name}` : orgName;
                return (
                  <tr key={lic.id} className="hover:bg-[rgba(60,60,67,0.02)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {lic.license_type === 'individual'
                          ? <User size={13} className="text-label-2 flex-shrink-0" />
                          : <Building2 size={13} className="text-label-2 flex-shrink-0" />}
                        <span className="text-[13px] font-medium text-black">{memberName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-mono text-black">{lic.nmls_id}</td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-black">{lic.state}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={lic.status === 'active' ? 'success' : lic.status === 'pending' ? 'warning' : 'danger'}
                        size="sm"
                      >
                        {lic.status}
                      </Badge>
                      {vr && (
                        <span className={`ml-1.5 text-[11px] font-medium ${vr.status === 'active' ? 'text-green-600' : 'text-red'}`}>
                          {vr.source === 'mock' ? '· NMLS_API_URL not configured' : `· Live: ${vr.status}`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[13px] ${expiry.color}`}>
                        {lic.expiration_date ? formatDate(lic.expiration_date) : '—'}
                      </span>
                      {expiry.daysLeft !== null && expiry.daysLeft > 0 && expiry.daysLeft <= 90 && (
                        <span className="ml-1 text-[11px] text-orange">({expiry.daysLeft}d)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-label-2">
                      {lic.last_verified_at ? formatDate(lic.last_verified_at) : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => handleVerify(lic)}
                        loading={isVerifying} leftIcon={<RefreshCw size={12} />}>
                        Verify
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'ce' && (
        <div className="space-y-3">
          {Object.entries(licensesByProfile).map(([pid, { member, licenses: pLics }]) => {
            const name = member ? `${member.first_name} ${member.last_name}` : orgName;
            const totalRequired = pLics.reduce((s, l) => Math.max(s, l.ce_hours_required), 0);
            const totalCompleted = pLics[0]?.ce_hours_completed ?? 0;
            const pct = totalRequired > 0 ? Math.min(100, (totalCompleted / totalRequired) * 100) : 100;
            const deficient = totalCompleted < totalRequired;
            return (
              <div key={pid} className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[15px] font-semibold text-black">{name}</p>
                    {member?.nmls_id && <p className="text-[12px] text-label-2 font-mono mt-0.5">NMLS #{member.nmls_id}</p>}
                  </div>
                  <Badge variant={deficient ? 'danger' : 'success'} size="sm">
                    {deficient ? 'CE Deficient' : 'CE Current'}
                  </Badge>
                </div>
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-label-2">{totalCompleted} / {totalRequired} hours completed</span>
                    <span className={`text-[12px] font-semibold ${deficient ? 'text-red' : 'text-green-600'}`}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[rgba(60,60,67,0.12)] overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${deficient ? 'bg-orange' : 'bg-green'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <p className="text-[12px] text-label-2">Federal: 8 hrs/yr · Deadline: Dec 31 · SAFE Act mandatory annual renewal</p>
              </div>
            );
          })}
          {Object.keys(licensesByProfile).length === 0 && (
            <div className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-8 text-center text-label-2 text-sm">
              No licenses on file.
            </div>
          )}
        </div>
      )}

      {activeTab === 'states' && (
        <div className="space-y-4">
          <Select label="Select a State" options={STATE_OPTIONS} value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)} />
          {selectedState && (
            <div className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-5 animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck size={18} className="text-blue" />
                <h3 className="text-[16px] font-bold text-black">{selectedState} License Requirements</h3>
              </div>
              {(() => {
                const req = STATE_CE_REQUIREMENTS[selectedState];
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#F2F2F7] rounded-xl p-3">
                        <p className="text-[11px] text-label-2 uppercase font-semibold tracking-wide">CE Hours Required</p>
                        <p className="text-[20px] font-bold text-black font-mono mt-1">{req?.total ?? 8}</p>
                      </div>
                      <div className="bg-[#F2F2F7] rounded-xl p-3">
                        <p className="text-[11px] text-label-2 uppercase font-semibold tracking-wide">Renewal Deadline</p>
                        <p className="text-[20px] font-bold text-black mt-1">{req?.renewal ?? 'Dec 31'}</p>
                      </div>
                    </div>
                    <p className="text-[13px] text-label-2">
                      {req?.notes ?? `Verify current ${selectedState} requirements at the NMLS Resource Center.`}
                    </p>
                    <div className="flex items-start gap-2 bg-blue/5 border border-blue/15 rounded-xl p-3">
                      <AlertTriangle size={14} className="text-blue mt-0.5 flex-shrink-0" />
                      <p className="text-[12px] text-blue">
                        Always verify at <strong>nmlsconsumeraccess.org</strong> — requirements change annually. This is reference data only.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          {!selectedState && (
            <div className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-8 text-center text-label-2 text-sm">
              Select a state above to view CE requirements and renewal details.
            </div>
          )}
        </div>
      )}

      {showAddLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-sheet w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
              <h2 className="text-[16px] font-bold text-black">Add State License</h2>
              <button onClick={() => setShowAddLicense(false)} className="text-label-2 hover:text-black"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddLicense} className="p-5 space-y-4">
              <Select
                label="Team Member (individual license)"
                options={[{ value: '', label: 'Company license' }, ...team.map((m) => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))]}
                value={addForm.profileId}
                onChange={(e) => setAddForm((p) => ({ ...p, profileId: e.target.value }))}
              />
              <Input label="NMLS ID *" value={addForm.nmlsId}
                onChange={(e) => setAddForm((p) => ({ ...p, nmlsId: e.target.value }))} required />
              <Select label="State *" options={STATE_OPTIONS} value={addForm.state}
                onChange={(e) => setAddForm((p) => ({ ...p, state: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="License Number" value={addForm.licenseNumber}
                  onChange={(e) => setAddForm((p) => ({ ...p, licenseNumber: e.target.value }))} />
                <Input label="Expiration Date" type="date" value={addForm.expirationDate}
                  onChange={(e) => setAddForm((p) => ({ ...p, expirationDate: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="CE Hours Required" type="number" value={addForm.ceRequired}
                  onChange={(e) => setAddForm((p) => ({ ...p, ceRequired: e.target.value }))} />
                <Input label="CE Hours Completed" type="number" value={addForm.ceCompleted}
                  onChange={(e) => setAddForm((p) => ({ ...p, ceCompleted: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddLicense(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" loading={addLoading}>Add License</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
