'use client';

import { IconBrandInstagram, IconBrandFacebook, IconBrandLinkedin } from '@tabler/icons-react';
import type { SocialPlatform } from '@/types/closingPosts';

const PLATFORMS: { value: SocialPlatform; label: string; icon: React.ComponentType<{ size?: number | string; className?: string }> }[] = [
  { value: 'instagram', label: 'Instagram', icon: IconBrandInstagram },
  { value: 'facebook', label: 'Facebook', icon: IconBrandFacebook },
  { value: 'linkedin', label: 'LinkedIn', icon: IconBrandLinkedin },
];

interface PlatformSelectorProps {
  selected: SocialPlatform[];
  onChange: (platforms: SocialPlatform[]) => void;
}

export function PlatformSelector({ selected, onChange }: PlatformSelectorProps) {
  function toggle(platform: SocialPlatform) {
    onChange(selected.includes(platform) ? selected.filter((p) => p !== platform) : [...selected, platform]);
  }

  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Share To</label>
      <div className="flex flex-wrap gap-3">
        {PLATFORMS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              selected.includes(value)
                ? 'border-[#C9A95C] bg-[#C9A95C]/10 text-[#8A6310]'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
