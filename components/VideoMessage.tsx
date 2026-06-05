'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Video,
  Square,
  RotateCcw,
  Send,
  Play,
  Pause,
  Loader2,
  MessageSquare,
  Mail,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  sms_consent: boolean;
}

interface VideoMessageProps {
  lead: Lead;
  onClose: () => void;
  onSent?: () => void;
}

type RecordState = 'idle' | 'recording' | 'preview' | 'uploading' | 'sent';

const MAX_SECONDS = 60;

export function VideoMessage({ lead, onClose, onSent }: VideoMessageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<RecordState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [sendChannel, setSendChannel] = useState<'email' | 'sms'>('email');
  const [customMessage, setCustomMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(`Video message for ${lead.first_name}`);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [blobUrl]);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setError('Camera access denied. Please allow camera and microphone access in your browser settings.');
    }
  }, []);

  useEffect(() => {
    void startCamera();
  }, [startCamera]);

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const mr = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = () => {
      const b = new Blob(chunksRef.current, { type: 'video/webm' });
      setBlob(b);
      const url = URL.createObjectURL(b);
      setBlobUrl(url);
      setState('preview');
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };

    mr.start(250);
    setState('recording');
    setElapsed(0);

    timerRef.current = setInterval(() => {
      setElapsed((s) => {
        if (s + 1 >= MAX_SECONDS) {
          stopRecording();
          return MAX_SECONDS;
        }
        return s + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }

  function retake() {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setBlob(null);
    setElapsed(0);
    setState('idle');
    void startCamera();
  }

  function togglePlayPreview() {
    if (!previewRef.current) return;
    if (isPlaying) {
      previewRef.current.pause();
      setIsPlaying(false);
    } else {
      void previewRef.current.play();
      setIsPlaying(true);
    }
  }

  async function generateAiMessage() {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Write a short, warm, professional message (2-3 sentences) from a mortgage loan officer to accompany a video message being sent to ${lead.first_name} ${lead.last_name}. The message should introduce the video naturally and encourage them to watch. Include a {{VIDEO_LINK}} placeholder where the video link should appear. Channel: ${sendChannel}.`,
        }),
      });
      if (res.ok) {
        const { reply } = await res.json() as { reply: string };
        setCustomMessage(reply ?? '');
      }
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSend() {
    if (!blob) return;
    setState('uploading');
    setError(null);

    const formData = new FormData();
    formData.append('video', blob, 'recording.webm');
    formData.append('leadId', lead.id);
    formData.append('title', title);
    formData.append('duration', String(elapsed));
    formData.append('channel', sendChannel);
    formData.append('message', customMessage);

    try {
      const res = await fetch('/api/video-messages', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const { error: e } = await res.json() as { error: string };
        setError(e ?? 'Upload failed');
        setState('preview');
        return;
      }

      setState('sent');
      onSent?.();
    } catch {
      setError('Network error during upload');
      setState('preview');
    }
  }

  const countdown = MAX_SECONDS - elapsed;
  const progressPct = (elapsed / MAX_SECONDS) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-[520px] bg-white rounded-[16px] shadow-sheet overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(60,60,67,0.10)]">
          <div>
            <h2 className="text-[16px] font-semibold text-black">Video Message</h2>
            <p className="text-[12px] text-label-2 mt-0.5">
              To: {lead.first_name} {lead.last_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[rgba(60,60,67,0.08)] flex items-center justify-center text-label-2 hover:bg-[rgba(60,60,67,0.14)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {state === 'sent' ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-14 h-14 rounded-full bg-green/10 flex items-center justify-center">
                <Video size={24} className="text-green" />
              </div>
              <p className="text-[16px] font-semibold text-black">Video sent!</p>
              <p className="text-[13px] text-label-2 text-center">
                {lead.first_name} will receive a notification when they watch it.
              </p>
              <Button onClick={onClose} variant="secondary" size="sm">Done</Button>
            </div>
          ) : (
            <>
              {/* Video preview / camera */}
              <div className="relative w-full aspect-video bg-black rounded-[12px] overflow-hidden">
                {state !== 'preview' ? (
                  <>
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    {state === 'idle' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <p className="text-white/70 text-[13px]">Camera preview</p>
                      </div>
                    )}
                    {state === 'recording' && (
                      <div className="absolute top-3 left-3 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red animate-pulse" />
                        <span className="text-white text-[12px] font-mono font-semibold">
                          {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
                        </span>
                      </div>
                    )}
                    {state === 'recording' && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                        <div
                          className="h-full bg-red transition-all duration-1000"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}
                    {state === 'recording' && countdown <= 10 && (
                      <div className="absolute top-3 right-3 bg-red/80 text-white text-[11px] font-bold px-2 py-1 rounded-full">
                        {countdown}s left
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {blobUrl && (
                      <video
                        ref={previewRef}
                        src={blobUrl}
                        className="w-full h-full object-cover scale-x-[-1]"
                        onEnded={() => setIsPlaying(false)}
                      />
                    )}
                    <button
                      onClick={togglePlayPreview}
                      className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors group"
                    >
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-elevated group-hover:scale-105 transition-transform">
                        {isPlaying ? <Pause size={18} className="text-black" /> : <Play size={18} className="text-black translate-x-0.5" />}
                      </div>
                    </button>
                    <div className="absolute top-3 right-3 bg-black/50 text-white text-[11px] font-medium px-2 py-1 rounded-full">
                      Preview
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnail note */}
              {state === 'preview' && (
                <p className="text-[11px] text-label-3 text-center -mt-1">
                  Your borrower will see a thumbnail with a play button
                </p>
              )}

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                {state === 'idle' && (
                  <Button
                    onClick={startRecording}
                    leftIcon={<Video size={15} />}
                    className="w-36"
                  >
                    Record
                  </Button>
                )}
                {state === 'recording' && (
                  <Button
                    onClick={stopRecording}
                    variant="danger"
                    leftIcon={<Square size={15} />}
                    className="w-36"
                  >
                    Stop
                  </Button>
                )}
                {state === 'preview' && (
                  <Button
                    onClick={retake}
                    variant="secondary"
                    leftIcon={<RotateCcw size={14} />}
                  >
                    Retake
                  </Button>
                )}
              </div>

              {/* Send options — shown in preview state */}
              {state === 'preview' && (
                <div className="space-y-3 border-t border-[rgba(60,60,67,0.08)] pt-4">
                  {/* Title */}
                  <div>
                    <label className="text-[12px] font-medium text-label-2 mb-1 block">Video title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full h-9 px-3 rounded-[8px] border border-[rgba(60,60,67,0.15)] text-[13px] text-black outline-none focus:border-blue/60 focus:shadow-input transition-all"
                    />
                  </div>

                  {/* Channel */}
                  <div>
                    <label className="text-[12px] font-medium text-label-2 mb-1 block">Send via</label>
                    <div className="flex gap-2">
                      {(['email', 'sms'] as const).map((ch) => (
                        <button
                          key={ch}
                          onClick={() => setSendChannel(ch)}
                          className={clsx(
                            'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-[8px] text-[13px] font-medium border transition-colors',
                            sendChannel === ch
                              ? 'bg-blue text-white border-blue'
                              : 'border-[rgba(60,60,67,0.15)] text-label-2 hover:bg-[rgba(60,60,67,0.05)]'
                          )}
                        >
                          {ch === 'email' ? <Mail size={13} /> : <MessageSquare size={13} />}
                          {ch === 'email' ? 'Email' : 'SMS'}
                          {ch === 'sms' && !lead.sms_consent && (
                            <span className="text-[10px] text-orange ml-1">(no consent)</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[12px] font-medium text-label-2">Message</label>
                      <button
                        onClick={generateAiMessage}
                        disabled={aiLoading}
                        className="flex items-center gap-1 text-[11px] text-gold hover:text-gold/80 font-medium transition-colors"
                      >
                        {aiLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                        AI generate
                      </button>
                    </div>
                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder={`Hi ${lead.first_name}, I recorded a quick video for you about your loan — {{VIDEO_LINK}}`}
                      rows={3}
                      className="w-full px-3 py-2 rounded-[8px] border border-[rgba(60,60,67,0.15)] text-[13px] text-black resize-none outline-none focus:border-blue/60 focus:shadow-input transition-all"
                    />
                    <p className="text-[11px] text-label-3 mt-1">
                      {"{{VIDEO_LINK}}"} will be replaced with the video URL
                    </p>
                  </div>

                  {error && (
                    <p className="text-[12px] text-red">{error}</p>
                  )}

                  <Button
                    onClick={handleSend}
                    loading={state === 'uploading'}
                    disabled={(sendChannel === 'sms' && !lead.sms_consent) || state === 'uploading'}
                    leftIcon={<Send size={14} />}
                    className="w-full"
                    size="lg"
                  >
                    {state === 'uploading' ? 'Uploading…' : `Send via ${sendChannel === 'email' ? 'Email' : 'SMS'}`}
                  </Button>
                </div>
              )}

              {error && state !== 'preview' && (
                <p className="text-[12px] text-red text-center">{error}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
