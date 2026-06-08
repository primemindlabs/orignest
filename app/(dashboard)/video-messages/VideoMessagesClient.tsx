'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Video, Eye, Play, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { VideoMessage } from '@/components/VideoMessage';
import { formatDistanceToNow, format } from 'date-fns';

interface VideoMsg {
  id: string;
  lead_id: string | null;
  title: string | null;
  public_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  view_count: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  created_at: string;
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  stage: string;
  sms_consent: boolean;
}

interface Props {
  videos: VideoMsg[];
  leads: Lead[];
  profileId: string;
}

export function VideoMessagesClient({ videos, leads, profileId }: Props) {
  const [showRecorder, setShowRecorder] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadSearch, setLeadSearch] = useState('');

  const filteredLeads = leadSearch.trim()
    ? leads.filter((l) =>
        `${l.first_name} ${l.last_name}`.toLowerCase().includes(leadSearch.toLowerCase())
      )
    : leads.slice(0, 8);

  function formatDuration(secs: number | null): string {
    if (!secs) return '--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  return (
    <div className="max-w-5xl space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black tracking-tight">Video Messages</h1>
          <p className="text-[14px] text-label-2 mt-0.5">
            Record a quick video for your borrowers — personal, memorable, and effective.
          </p>
        </div>
        <Button
          onClick={() => setShowRecorder(true)}
          leftIcon={<Video size={15} />}
          size="md"
        >
          Record Video
        </Button>
      </div>

      {/* Lead picker — shown when recorder not yet open */}
      {!showRecorder && (
        <div className="bg-white rounded-[12px] border border-[rgba(60,60,67,0.10)] p-5 shadow-card">
          <h3 className="text-[14px] font-semibold text-black mb-3">Choose a borrower to record for</h3>
          <input
            type="text"
            value={leadSearch}
            onChange={(e) => setLeadSearch(e.target.value)}
            placeholder="Search borrowers…"
            className="w-full h-9 px-3 rounded-[8px] border border-[rgba(60,60,67,0.15)] text-[13px] outline-none focus:border-blue/60 focus:shadow-input transition-all mb-3"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {filteredLeads.map((lead) => (
              <button
                key={lead.id}
                onClick={() => {
                  setSelectedLead(lead);
                  setShowRecorder(true);
                }}
                className={clsx(
                  'flex flex-col items-start p-3 rounded-[10px] border text-left transition-colors',
                  'border-[rgba(60,60,67,0.10)] hover:border-blue/40 hover:bg-blue/3'
                )}
              >
                <div className="w-8 h-8 rounded-full bg-blue/10 flex items-center justify-center text-[12px] font-semibold text-blue mb-2">
                  {lead.first_name[0]}{lead.last_name[0]}
                </div>
                <p className="text-[13px] font-medium text-black truncate w-full">
                  {lead.first_name} {lead.last_name}
                </p>
                <p className="text-[11px] text-label-3 truncate w-full">{lead.stage.replace('_', ' ')}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Video library */}
      {videos.length > 0 && (
        <div>
          <h2 className="text-[16px] font-semibold text-black mb-3">Sent Videos</h2>
          <div className="space-y-2">
            {videos.map((v) => {
              const lead = leads.find((l) => l.id === v.lead_id);
              return (
                <div
                  key={v.id}
                  className="bg-white rounded-[12px] border border-[rgba(60,60,67,0.10)] shadow-card px-4 py-3 flex items-center gap-4"
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-16 h-10 rounded-[6px] bg-navy/5 flex items-center justify-center overflow-hidden">
                    {v.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Play size={16} className="text-label-3" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-black truncate">
                      {v.title ?? 'Untitled video'}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {lead && (
                        <span className="text-[12px] text-label-2">
                          {lead.first_name} {lead.last_name}
                        </span>
                      )}
                      <span className="text-[12px] text-label-3">{formatDuration(v.duration_seconds)}</span>
                      <span className="text-[12px] text-label-3">
                        {format(new Date(v.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-[12px] text-label-2 justify-center">
                        <Eye size={11} />
                        <span className="font-semibold text-black">{v.view_count}</span>
                      </div>
                      <p className="text-[10px] text-label-3">views</p>
                    </div>
                    {v.first_viewed_at && (
                      <div className="text-right">
                        <p className="text-[11px] text-label-3">First watched</p>
                        <p className="text-[11px] text-label-2">
                          {formatDistanceToNow(new Date(v.first_viewed_at), { addSuffix: true })}
                        </p>
                      </div>
                    )}
                    {!v.first_viewed_at && (
                      <Badge variant="neutral" size="sm">Not viewed</Badge>
                    )}
                    <a
                      href={v.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] text-blue hover:underline flex items-center gap-1"
                    >
                      <Send size={11} />
                      Link
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {videos.length === 0 && !showRecorder && (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="w-14 h-14 rounded-[20px] bg-blue/8 flex items-center justify-center">
            <Video size={26} className="text-blue" />
          </div>
          <p className="text-[15px] font-semibold text-black">No videos yet</p>
          <p className="text-[13px] text-label-2">
            Record a personal video message for your next borrower interaction.
          </p>
          <Button onClick={() => setShowRecorder(true)} leftIcon={<Plus size={14} />} size="sm">
            Record your first video
          </Button>
        </div>
      )}

      {/* Video recorder modal */}
      {showRecorder && selectedLead && (
        <VideoMessage
          lead={selectedLead}
          onClose={() => {
            setShowRecorder(false);
            setSelectedLead(null);
          }}
          onSent={() => {
            setShowRecorder(false);
            setSelectedLead(null);
            // Reload is handled by the server component on next navigation
          }}
        />
      )}
    </div>
  );
}
