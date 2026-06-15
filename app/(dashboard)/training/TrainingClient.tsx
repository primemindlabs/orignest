'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GraduationCap, Plus, X, ShieldCheck, CheckCircle2, Award, Trash2, Sparkles, Loader2, Wand2, PlayCircle, Circle, FileText, ChevronRight } from 'lucide-react';

export interface Lesson { title: string; content: string; video_url?: string | null }
export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  is_compliance: boolean;
  is_onboarding: boolean;
  is_published: boolean;
  pass_threshold: number;
  lessons: Lesson[];
  questions: { q: string; options: string[]; correct: number }[];
}
export interface Enrollment {
  course_id: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'failed';
  score: number | null;
  certificate_code: string | null;
}

// Turn a pasted video URL into an embeddable src (YouTube / Vimeo / Loom), else null.
function toEmbedSrc(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace('www.', '');
    if (host === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (host.endsWith('youtube.com')) {
      const id = u.searchParams.get('v') ?? u.pathname.split('/').pop();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host.endsWith('vimeo.com')) return `https://player.vimeo.com/video/${u.pathname.split('/').filter(Boolean).pop()}`;
    if (host.endsWith('loom.com')) return url.replace('/share/', '/embed/');
    return null;
  } catch { return null; }
}

function LessonMedia({ url }: { url: string }) {
  const embed = toEmbedSrc(url);
  if (embed) {
    return (
      <div className="relative w-full rounded-xl overflow-hidden bg-black mb-3" style={{ aspectRatio: '16 / 9' }}>
        <iframe src={embed} className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Lesson video" />
      </div>
    );
  }
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
    return <video src={url} controls className="w-full rounded-xl bg-black mb-3" />;
  }
  return <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gold-700 mb-3"><PlayCircle className="w-4 h-4" /> Watch video</a>;
}

export interface LearnerStats { xp: number; streak: number; lessonsDone: number; coursesCompleted: number }

export default function TrainingClient({ courses, enrollments, progress, stats, isAdmin }: { courses: Course[]; enrollments: Enrollment[]; progress: Record<string, number[]>; stats?: LearnerStats; isAdmin: boolean }) {
  const [playing, setPlaying] = useState<Course | null>(null);
  const [building, setBuilding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const enrollMap = new Map(enrollments.map((e) => [e.course_id, e]));
  const progressMap = useMemo(() => {
    const m = new Map<string, Set<number>>();
    for (const [cid, idxs] of Object.entries(progress)) m.set(cid, new Set(idxs));
    return m;
  }, [progress]);

  return (
    <div className="space-y-6">
      {stats && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-gradient-to-r from-[#0F1D2E] to-[#1a2a3f] text-white px-5 py-4">
          <div className="flex-1 min-w-[160px]">
            <p className="text-[13px] text-white/70">Keep your streak alive</p>
            <p className="text-[17px] font-bold leading-tight">{stats.streak > 0 ? `${stats.streak}-day learning streak 🔥` : 'Start a streak today 🔥'}</p>
          </div>
          <div className="flex items-center gap-2.5">
            {[['🔥', `${stats.streak}d`, 'Streak'], ['⭐', `${stats.xp}`, 'XP'], ['📚', `${stats.lessonsDone}`, 'Lessons'], ['🎓', `${stats.coursesCompleted}`, 'Completed']].map(([icon, val, label]) => (
              <div key={label} className="text-center bg-white/10 rounded-xl px-3 py-1.5 min-w-[58px]">
                <p className="text-[15px] font-bold leading-none">{icon} {val}</p>
                <p className="text-[10px] text-white/60 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-label tracking-tight">Training</h1>
          <p className="text-[13px] text-label-2 mt-0.5">Courses, quizzes &amp; compliance certifications</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button onClick={() => setGenerating(true)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2 rounded-lg text-white" style={{ background: '#0F1D2E' }}>
              <Sparkles className="w-4 h-4 text-gold" /> Generate with AI
            </button>
            <button onClick={() => setBuilding(true)} className="btn-primary inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2">
              <Plus className="w-4 h-4" /> New course
            </button>
          </div>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-10 text-center card-shadow">
          <GraduationCap className="w-8 h-8 text-label-3 mx-auto mb-3" />
          <p className="text-sm font-medium text-label">No courses yet</p>
          {isAdmin && <p className="text-xs text-label-2 mt-1">Create your first course to start an onboarding or compliance path.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => {
            const e = enrollMap.get(c.id);
            const doneCount = c.lessons.length ? (progressMap.get(c.id)?.size ?? 0) : 0;
            const pct = c.lessons.length ? Math.round((Math.min(doneCount, c.lessons.length) / c.lessons.length) * 100) : 0;
            const started = doneCount > 0;
            return (
              <button key={c.id} onClick={() => setPlaying(c)} className="text-left bg-surface rounded-2xl border border-border p-5 card-shadow hover:bg-fill transition-colors flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  {c.is_compliance && <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gold-50 text-gold-700 px-1.5 py-0.5 rounded"><ShieldCheck className="w-3 h-3" /> Compliance</span>}
                  {!c.is_published && <span className="text-[10px] text-label-3 border border-border rounded px-1.5 py-0.5">draft</span>}
                  <span className="text-[10px] text-label-3 capitalize">{c.category}</span>
                </div>
                <p className="text-[15px] font-semibold text-label leading-snug">{c.title}</p>
                <p className="text-[12px] text-label-2 mt-1 line-clamp-2 flex-1">{c.description}</p>
                {/* progress bar */}
                <div className="mt-3">
                  <div className="h-1.5 rounded-full bg-fill overflow-hidden">
                    <div className="h-full rounded-full bg-[#C9A95C] transition-all" style={{ width: `${e?.status === 'completed' ? 100 : pct}%` }} />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-label-3">{doneCount}/{c.lessons.length} lessons · {c.questions.length} questions</span>
                  {e?.status === 'completed' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success"><CheckCircle2 className="w-3.5 h-3.5" /> {e.score}%</span>
                  ) : e?.status === 'failed' ? (
                    <span className="text-[11px] font-semibold text-danger">Retry · {e.score}%</span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-gold-700">{started ? 'Continue' : 'Start'} <ChevronRight className="w-3.5 h-3.5" /></span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {playing && <CoursePlayer course={playing} enrollment={enrollMap.get(playing.id)} initialDone={progressMap.get(playing.id) ?? new Set()} onClose={() => setPlaying(null)} />}
      {building && <CourseBuilder onClose={() => setBuilding(false)} />}
      {generating && <AICourseGenerator onClose={() => setGenerating(false)} />}
    </div>
  );
}

// ── AI course generator (Udemy/Thinkific-style) ───────────────────────────────
interface DraftCourse {
  title: string;
  description: string;
  category: string;
  lessons: { title: string; content: string }[];
  questions: { q: string; options: string[]; correct: number }[];
}

function AICourseGenerator({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('loan officers');
  const [lessonCount, setLessonCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DraftCourse | null>(null);
  const inputCls = 'w-full text-[13px] rounded-lg border border-border px-3 py-2 bg-surface text-label focus:outline-none focus:border-[#C9A95C]';

  const SUGGESTIONS = [
    'FHA loans from application to closing',
    'Self-employed borrower income analysis',
    'TRID timeline & disclosure compliance',
    'Handling rate objections and closing',
    'DSCR investor loans 101',
  ];

  async function generate() {
    if (!topic.trim()) return toast.error('Enter a topic');
    setLoading(true);
    setDraft(null);
    try {
      const res = await fetch('/api/training/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, audience, lessonCount }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Generation failed');
      setDraft(j.course as DraftCourse);
      toast.success('Course drafted — review and save');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch('/api/training/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, pass_threshold: 80, is_published: true }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      toast.success('Course published');
      onClose();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl border border-border w-full max-w-2xl max-h-[88vh] flex flex-col card-shadow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[16px] font-semibold text-label inline-flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-[#C9A95C]" /> Generate a course with AI
          </h2>
          <button onClick={onClose} className="text-label-3 hover:text-label"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Inputs */}
          <div className="space-y-3">
            <div>
              <label className="text-[12px] font-semibold text-label-2">Course topic</label>
              <input className={inputCls + ' mt-1'} placeholder="e.g. VA loans for first-time buyers" value={topic} onChange={(e) => setTopic(e.target.value)} />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => setTopic(s)} className="text-[11px] px-2 py-1 rounded-full bg-fill text-label-2 hover:text-black transition-colors">{s}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-semibold text-label-2">Audience</label>
                <input className={inputCls + ' mt-1'} value={audience} onChange={(e) => setAudience(e.target.value)} />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-label-2">Lessons</label>
                <select className={inputCls + ' mt-1'} value={lessonCount} onChange={(e) => setLessonCount(Number(e.target.value))}>
                  {[3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} lessons</option>)}
                </select>
              </div>
            </div>
            <button onClick={generate} disabled={loading} className="w-full inline-flex items-center justify-center gap-2 text-[13px] font-semibold px-4 py-2.5 rounded-lg text-white disabled:opacity-50" style={{ background: '#0F1D2E' }}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating course…</> : <><Sparkles className="w-4 h-4 text-gold" /> {draft ? 'Regenerate' : 'Generate course'}</>}
            </button>
          </div>

          {/* Draft preview */}
          {draft && (
            <div className="border-t border-border pt-4 space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold text-label">{draft.title}</h3>
                  <span className="text-[10px] text-label-3 capitalize border border-border rounded px-1.5 py-0.5">{draft.category}</span>
                </div>
                <p className="text-[12.5px] text-label-2 mt-0.5">{draft.description}</p>
              </div>
              <div className="space-y-2.5">
                {draft.lessons.map((l, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <p className="text-[13px] font-semibold text-label">{i + 1}. {l.title}</p>
                    <p className="text-[12px] text-label-2 mt-1 whitespace-pre-wrap leading-relaxed line-clamp-4">{l.content}</p>
                  </div>
                ))}
              </div>
              <p className="text-[12px] font-semibold text-label-2">Quiz · {draft.questions.length} questions</p>
              <p className="text-[11px] text-label-3">Saved as a published course with an 80% pass mark. You can edit it later from the catalog.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button onClick={onClose} className="text-[13px] font-medium text-label-2 px-4 py-2">Cancel</button>
          <button onClick={save} disabled={!draft || saving} className="btn-primary text-[13px] font-semibold px-4 py-2 disabled:opacity-50">{saving ? 'Saving…' : 'Save & publish'}</button>
        </div>
      </div>
    </div>
  );
}

function CoursePlayer({ course, enrollment, initialDone, onClose }: { course: Course; enrollment?: Enrollment; initialDone: Set<number>; onClose: () => void }) {
  const router = useRouter();
  const hasQuiz = course.questions.length > 0;
  const [done, setDone] = useState<Set<number>>(new Set(initialDone));
  // 'quiz' view, or a lesson index.
  const firstIncomplete = course.lessons.findIndex((_, i) => !initialDone.has(i));
  const [view, setView] = useState<number | 'quiz'>(course.lessons.length ? (firstIncomplete < 0 ? 0 : firstIncomplete) : 'quiz');
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; passed: boolean; certificate_code: string | null } | null>(
    enrollment?.status === 'completed' ? { score: enrollment.score ?? 0, passed: true, certificate_code: enrollment.certificate_code } : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [savingLesson, setSavingLesson] = useState(false);

  const pct = course.lessons.length ? Math.round((Math.min(done.size, course.lessons.length) / course.lessons.length) * 100) : 100;
  const allLessonsDone = course.lessons.length > 0 && done.size >= course.lessons.length;

  async function markComplete(idx: number) {
    setSavingLesson(true);
    const next = new Set(done); next.add(idx);
    setDone(next);
    try {
      await fetch('/api/training/progress', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: course.id, lesson_index: idx, completed: true }),
      });
      router.refresh();
    } catch { /* optimistic — keep local state */ } finally { setSavingLesson(false); }
    // advance
    if (idx + 1 < course.lessons.length) setView(idx + 1);
    else if (hasQuiz) setView('quiz');
  }

  async function submit() {
    if (answers.length < course.questions.length || answers.some((a) => a == null)) return toast.error('Answer every question first');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/training/${course.id}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Submit failed');
      setResult({ score: j.score, passed: j.passed, certificate_code: j.certificate_code });
      toast[j.passed ? 'success' : 'error'](j.passed ? `Passed — ${j.score}%` : `Didn't pass — ${j.score}%`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally { setSubmitting(false); }
  }

  const lesson = typeof view === 'number' ? course.lessons[view] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl border border-border w-full max-w-4xl h-[88vh] flex flex-col card-shadow overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h2 className="text-[15px] font-semibold text-label truncate">{course.title}</h2>
          <button onClick={onClose} className="text-label-3 hover:text-label"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* ── Curriculum sidebar ── */}
          <aside className="w-[230px] flex-shrink-0 border-r border-border flex flex-col bg-fill/40">
            <div className="px-4 pt-3.5 pb-3 border-b border-border">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-label-3">Curriculum</span>
                <span className="text-[11px] font-semibold text-gold-700">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div className="h-full rounded-full bg-[#C9A95C] transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {course.lessons.map((l, i) => {
                const isDone = done.has(i);
                const active = view === i;
                return (
                  <button key={i} onClick={() => setView(i)} className={`w-full text-left px-4 py-2.5 flex items-start gap-2.5 transition-colors ${active ? 'bg-gold-50' : 'hover:bg-fill'}`}>
                    {isDone ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" /> : l.video_url ? <PlayCircle className="w-4 h-4 text-label-3 flex-shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 text-label-3 flex-shrink-0 mt-0.5" />}
                    <span className="min-w-0">
                      <span className={`block text-[12.5px] leading-tight ${active ? 'font-semibold text-label' : 'text-label-2'}`}>{i + 1}. {l.title}</span>
                      {l.video_url && <span className="text-[10px] text-label-3 inline-flex items-center gap-0.5"><PlayCircle className="w-2.5 h-2.5" /> Video</span>}
                    </span>
                  </button>
                );
              })}
              {hasQuiz && (
                <button onClick={() => setView('quiz')} className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 border-t border-border mt-1 transition-colors ${view === 'quiz' ? 'bg-gold-50' : 'hover:bg-fill'}`}>
                  {result?.passed ? <Award className="w-4 h-4 text-gold-600 flex-shrink-0" /> : <FileText className="w-4 h-4 text-label-3 flex-shrink-0" />}
                  <span className={`text-[12.5px] ${view === 'quiz' ? 'font-semibold text-label' : 'text-label-2'}`}>Final quiz · {course.questions.length} Q</span>
                </button>
              )}
            </nav>
          </aside>

          {/* ── Lesson / quiz pane ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 min-w-0">
            {lesson ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-label-3 mb-1">Lesson {(view as number) + 1} of {course.lessons.length}</p>
                <h3 className="text-[18px] font-semibold text-label mb-3">{lesson.title}</h3>
                {lesson.video_url && <LessonMedia url={lesson.video_url} />}
                <p className="text-[13.5px] text-label-2 whitespace-pre-wrap leading-relaxed">{lesson.content}</p>
                <LessonTutor lessonTitle={lesson.title} lessonContent={lesson.content} />
                <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border">
                  {done.has(view as number) ? (
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-success"><CheckCircle2 className="w-4 h-4" /> Completed</span>
                  ) : (
                    <button onClick={() => markComplete(view as number)} disabled={savingLesson} className="btn-primary text-[13px] font-semibold px-4 py-2 disabled:opacity-50">
                      {savingLesson ? 'Saving…' : (view as number) + 1 < course.lessons.length ? 'Mark complete & continue' : hasQuiz ? 'Complete & go to quiz' : 'Mark complete'}
                    </button>
                  )}
                  {done.has(view as number) && (view as number) + 1 < course.lessons.length && (
                    <button onClick={() => setView((view as number) + 1)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-gold-700">Next lesson <ChevronRight className="w-4 h-4" /></button>
                  )}
                  {done.has(view as number) && (view as number) + 1 >= course.lessons.length && hasQuiz && (
                    <button onClick={() => setView('quiz')} className="inline-flex items-center gap-1 text-[13px] font-semibold text-gold-700">Go to quiz <ChevronRight className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            ) : result ? (
              <div className="text-center py-10">
                {result.passed ? <Award className="w-10 h-10 text-gold-600 mx-auto mb-3" /> : <X className="w-10 h-10 text-danger mx-auto mb-3" />}
                <p className="text-[22px] font-semibold text-label">{result.score}%</p>
                <p className="text-[13px] text-label-2 mt-1">{result.passed ? 'Passed — certification issued' : `Below ${course.pass_threshold}% pass mark`}</p>
                {result.certificate_code && <p className="font-mono text-[12px] text-gold-700 mt-2">{result.certificate_code}</p>}
                {!result.passed && <button onClick={() => { setResult(null); setAnswers([]); }} className="btn-primary text-[13px] font-semibold px-4 py-2 mt-4">Retake</button>}
              </div>
            ) : (
              <div className="space-y-5">
                {!allLessonsDone && <p className="text-[12px] text-label-3 bg-fill rounded-lg px-3 py-2">Finish the lessons to unlock your certificate — you can still take the quiz now.</p>}
                {course.questions.map((q, qi) => (
                  <div key={qi}>
                    <p className="text-[13px] font-medium text-label mb-2">{qi + 1}. {q.q}</p>
                    <div className="space-y-1.5">
                      {q.options.map((opt, oi) => (
                        <label key={oi} className={`flex items-center gap-2 text-[13px] px-3 py-2 rounded-lg border cursor-pointer ${answers[qi] === oi ? 'border-gold-600 bg-gold-50 text-label' : 'border-border text-label-2 hover:bg-fill'}`}>
                          <input type="radio" name={`q-${qi}`} checked={answers[qi] === oi} onChange={() => setAnswers((a) => { const n = [...a]; n[qi] = oi; return n; })} className="accent-gold-600" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={submit} disabled={submitting} className="btn-primary text-[13px] font-semibold px-4 py-2 disabled:opacity-50">{submitting ? 'Grading…' : 'Submit quiz'}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CourseBuilder({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState({ title: '', description: '', category: 'general', is_compliance: false, pass_threshold: '80' });
  const [lessons, setLessons] = useState<{ title: string; content: string; video_url: string }[]>([{ title: '', content: '', video_url: '' }]);
  const [questions, setQuestions] = useState<{ q: string; options: string[]; correct: number }[]>([{ q: '', options: ['', ''], correct: 0 }]);
  const inputCls = 'w-full text-[13px] rounded-lg border border-border px-3 py-2 bg-surface text-label focus:outline-none';

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!meta.title.trim()) return toast.error('Title required');
    setSaving(true);
    try {
      const res = await fetch('/api/training/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...meta,
          pass_threshold: Number(meta.pass_threshold) || 80,
          lessons: lessons.filter((l) => l.title.trim()).map((l) => ({ title: l.title, content: l.content, video_url: l.video_url.trim() || null })),
          questions: questions.filter((q) => q.q.trim() && q.options.filter((o) => o.trim()).length >= 2),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed');
      toast.success('Course created');
      onClose();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl border border-border w-full max-w-2xl max-h-[88vh] flex flex-col card-shadow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[16px] font-semibold text-label">New course</h2>
          <button onClick={onClose} className="text-label-3 hover:text-label"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={save} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <input className={inputCls} placeholder="Course title" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
          <textarea className={inputCls} rows={2} placeholder="Description" value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <input className={inputCls} placeholder="Category" value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })} />
            <input className={inputCls} type="number" placeholder="Pass %" value={meta.pass_threshold} onChange={(e) => setMeta({ ...meta, pass_threshold: e.target.value })} />
            <label className="flex items-center gap-2 text-[12px] text-label-2"><input type="checkbox" checked={meta.is_compliance} onChange={(e) => setMeta({ ...meta, is_compliance: e.target.checked })} className="accent-gold-600" /> Compliance</label>
          </div>

          <div>
            <p className="text-[12px] font-semibold text-label-2 mb-2">Lessons</p>
            {lessons.map((l, i) => (
              <div key={i} className="space-y-1.5 mb-2 border border-border rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  <input className={inputCls} placeholder={`Lesson ${i + 1} title`} value={l.title} onChange={(e) => setLessons((ls) => ls.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                  {lessons.length > 1 && <button type="button" onClick={() => setLessons((ls) => ls.filter((_, j) => j !== i))} className="text-label-3 hover:text-danger"><Trash2 className="w-4 h-4" /></button>}
                </div>
                <textarea className={inputCls} rows={2} placeholder="Lesson content" value={l.content} onChange={(e) => setLessons((ls) => ls.map((x, j) => j === i ? { ...x, content: e.target.value } : x))} />
                <input className={inputCls} placeholder="Video URL (optional — YouTube, Vimeo, Loom, .mp4)" value={l.video_url} onChange={(e) => setLessons((ls) => ls.map((x, j) => j === i ? { ...x, video_url: e.target.value } : x))} />
              </div>
            ))}
            <button type="button" onClick={() => setLessons((ls) => [...ls, { title: '', content: '', video_url: '' }])} className="text-[12px] font-medium text-gold-700">+ Add lesson</button>
          </div>

          <div>
            <p className="text-[12px] font-semibold text-label-2 mb-2">Quiz questions</p>
            {questions.map((q, qi) => (
              <div key={qi} className="space-y-1.5 mb-2 border border-border rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  <input className={inputCls} placeholder={`Question ${qi + 1}`} value={q.q} onChange={(e) => setQuestions((qs) => qs.map((x, j) => j === qi ? { ...x, q: e.target.value } : x))} />
                  {questions.length > 1 && <button type="button" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== qi))} className="text-label-3 hover:text-danger"><Trash2 className="w-4 h-4" /></button>}
                </div>
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input type="radio" name={`correct-${qi}`} checked={q.correct === oi} onChange={() => setQuestions((qs) => qs.map((x, j) => j === qi ? { ...x, correct: oi } : x))} className="accent-gold-600" title="Mark correct" />
                    <input className={inputCls} placeholder={`Option ${oi + 1}`} value={opt} onChange={(e) => setQuestions((qs) => qs.map((x, j) => j === qi ? { ...x, options: x.options.map((o, k) => k === oi ? e.target.value : o) } : x))} />
                  </div>
                ))}
                <button type="button" onClick={() => setQuestions((qs) => qs.map((x, j) => j === qi ? { ...x, options: [...x.options, ''] } : x))} className="text-[11px] text-gold-700">+ option</button>
              </div>
            ))}
            <button type="button" onClick={() => setQuestions((qs) => [...qs, { q: '', options: ['', ''], correct: 0 }])} className="text-[12px] font-medium text-gold-700">+ Add question</button>
          </div>

          <div className="flex justify-end gap-2 pt-1 sticky bottom-0 bg-surface">
            <button type="button" onClick={onClose} className="text-[13px] font-medium text-label-2 px-4 py-2">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-[13px] font-semibold px-4 py-2 disabled:opacity-50">{saving ? 'Saving…' : 'Create course'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Friendly AI tutor — ask Ashley about the current lesson (interactive, not just reading).
function LessonTutor({ lessonTitle, lessonContent }: { lessonTitle: string; lessonContent: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    if (!q.trim()) return;
    setBusy(true); setAnswer(null);
    try {
      const res = await fetch('/api/training/tutor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonTitle, lessonContent, question: q }),
      });
      const j = await res.json();
      setAnswer(j.answer ?? j.error ?? 'Try again in a moment.');
    } catch { setAnswer('The tutor is taking a breather — try again in a moment.'); }
    finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gold-700 hover:text-gold-800">
        <Sparkles className="w-3.5 h-3.5" /> Ask Ashley about this lesson
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-gold-100 bg-gold-50/50 p-3.5">
      <div className="flex items-center gap-1.5 mb-2 text-[12px] font-semibold text-gold-800"><Sparkles className="w-3.5 h-3.5" /> Ask Ashley</div>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') ask(); }}
          placeholder="e.g. Can you explain DSCR in simple terms?"
          className="flex-1 text-[13px] rounded-lg border border-border px-3 py-2 bg-white text-label focus:outline-none"
        />
        <button onClick={ask} disabled={busy || !q.trim()} className="btn-primary text-[13px] font-semibold px-3.5 py-2 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask'}
        </button>
      </div>
      {answer && <p className="mt-3 text-[13px] text-label whitespace-pre-wrap leading-relaxed">{answer}</p>}
    </div>
  );
}
