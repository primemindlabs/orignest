'use client';

import type { SocialPlatform, LoProfileInfo } from '@/types/closingPosts';

interface PostPreviewProps {
  copy: string;
  platform: SocialPlatform;
  loProfile: LoProfileInfo;
}

export function PostPreview({ copy, platform, loProfile }: PostPreviewProps) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Preview ({platform})</label>
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-[#C9A95C]/20 flex items-center justify-center">
            <span className="text-xs font-bold text-[#8A6310]">{loProfile.name.charAt(0)}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{loProfile.name}</p>
            <p className="text-xs text-gray-400">{loProfile.company}{loProfile.nmls ? ` · NMLS# ${loProfile.nmls}` : ''}</p>
          </div>
        </div>
        <div className="px-4 py-4">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{copy}</p>
        </div>
        <div className="h-32 bg-gradient-to-br from-[#C9A95C]/10 to-[#C9A95C]/5 flex items-center justify-center border-t border-gray-100">
          <span className="text-3xl">🏡</span>
        </div>
      </div>
    </div>
  );
}
