'use client';

import { useRef, useState } from 'react';
import { IconCheck, IconUpload, IconUser, IconInfoCircle } from '@tabler/icons-react';
import { getInitials } from '@/lib/utils';
import { SettingsField } from './SettingsField';

const GOLD = '#C9A95C';
const GREEN = '#1a7a3c';
const NMLS_REGEX = /^\d{6,7}$/;

export interface ProfileData {
  first_name: string | null;
  last_name: string | null;
  nmls_id: string | null;
  phone: string | null;
  title: string | null;
  email: string | null;
  avatar_url: string | null;
  comp_rate: number | null;
  monthly_volume_goal: number | null;
}

function validateNmls(value: string): string | null {
  if (!value) return 'NMLS # is required for compliance documents.';
  if (!NMLS_REGEX.test(value)) return 'NMLS # must be 6–7 digits.';
  return null;
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-black/[0.10] bg-white text-sm text-label focus:outline-none focus:border-[#C9A95C]';

export function ProfileSettings({ profile, company }: { profile: ProfileData; company: string | null }) {
  const [form, setForm] = useState({
    first_name: profile.first_name ?? '',
    last_name: profile.last_name ?? '',
    nmls_id: profile.nmls_id ?? '',
    phone: profile.phone ?? '',
    title: profile.title ?? '',
    monthly_volume_goal: profile.monthly_volume_goal ?? 4_000_000,
    comp_rate: profile.comp_rate ?? 1.25,
  });
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? null);
  const [nmlsError, setNmlsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    const err = validateNmls(form.nmls_id);
    if (err) {
      setNmlsError(err);
      return;
    }
    setNmlsError(null);
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.field === 'nmls_id') setNmlsError(j.error);
        else setError(j.error ?? 'Could not save.');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/settings/avatar', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) setError(j.error ?? 'Upload failed.');
      else setAvatarUrl(j.avatar_url);
    } catch {
      setError('Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const fullName = `${form.first_name} ${form.last_name}`.trim();

  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-6 space-y-6 max-w-2xl">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-bg flex items-center justify-center flex-shrink-0">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : fullName ? (
            <span className="text-lg font-semibold text-label-2">{getInitials(fullName)}</span>
          ) : (
            <IconUser size={28} className="text-label-3" />
          )}
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatar} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-black/[0.10] hover:bg-bg transition-colors disabled:opacity-50"
            style={{ color: '#876830' }}
          >
            <IconUpload size={13} /> {uploading ? 'Uploading…' : 'Upload photo'}
          </button>
          <p className="text-[11px] text-label-3 mt-1">JPG or PNG, under 5 MB.</p>
        </div>
      </div>

      {/* Goal & comp — above the fold */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl" style={{ background: 'rgba(201,169,92,0.07)' }}>
        <SettingsField label="Monthly volume goal" hint="Powers your goal ring on the dashboard">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-label-3">$</span>
            <input
              type="number"
              value={form.monthly_volume_goal}
              onChange={(e) => set('monthly_volume_goal', Number(e.target.value))}
              className={inputCls + ' pl-6 tabular-nums'}
            />
          </div>
        </SettingsField>
        <SettingsField label="Commission rate" hint="Drives commission on every loan + the pipeline page">
          <div className="relative">
            <input
              type="number"
              step="0.01"
              value={form.comp_rate}
              onChange={(e) => set('comp_rate', Number(e.target.value))}
              className={inputCls + ' pr-7 tabular-nums'}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-label-3">%</span>
          </div>
        </SettingsField>
        <p className="sm:col-span-2 flex items-start gap-1.5 text-[11px] text-label-3">
          <IconInfoCircle size={13} className="flex-shrink-0 mt-px" />
          Comp rate is for internal dashboard math only — it does not flow into loan disclosures (RESPA). Manage full
          plans in Compensation.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SettingsField label="First name">
          <input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} className={inputCls} />
        </SettingsField>
        <SettingsField label="Last name">
          <input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} className={inputCls} />
        </SettingsField>
      </div>

      <SettingsField label="NMLS #" hint="6–7 digits · required for compliance documents" error={nmlsError}>
        <input
          value={form.nmls_id}
          onChange={(e) => set('nmls_id', e.target.value.replace(/[^\d]/g, ''))}
          inputMode="numeric"
          maxLength={7}
          className={inputCls + ' tabular-nums'}
        />
      </SettingsField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SettingsField label="Phone">
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} />
        </SettingsField>
        <SettingsField label="Title" hint='e.g. "Senior Loan Officer"'>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCls} />
        </SettingsField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SettingsField label="Company" hint="Manage in Organization settings">
          <input value={company ?? '—'} disabled className={inputCls + ' bg-bg text-label-3'} />
        </SettingsField>
        <SettingsField label="Email" hint="Managed by your sign-in account">
          <input value={profile.email ?? '—'} disabled className={inputCls + ' bg-bg text-label-3'} />
        </SettingsField>
      </div>

      {error && <p className="text-xs text-red">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-50"
          style={{ background: saved ? GREEN : GOLD }}
        >
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-xs font-medium" style={{ color: GREEN }}>
            <IconCheck size={14} /> Profile updated
          </span>
        )}
      </div>
    </div>
  );
}
