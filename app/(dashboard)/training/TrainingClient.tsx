'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GraduationCap, Plus, X, ShieldCheck, CheckCircle2, Award, Trash2 } from 'lucide-react';

export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  is_compliance: boolean;
  is_onboarding: boolean;
  is_published: boolean;
  pass_threshold: number;
  lessons: { title: string; content: string }[];
  questions: { q: string; options: string[]; correct: number }[];
}
export interface Enrollment {
  course_id: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'failed';
  score: number | null;
  certificate_code: string | null;
}

export default function TrainingClient({ courses, enrollments, isAdmin }: { courses: Course[]; enrollments: Enrollment[]; isAdmin: boolean }) {
  const [playing, setPlaying] = useState<Course | null>(null);
  const [building, setBuilding] = useState(false);
  const enrollMap = new Map(enrollments.map((e) => [e.course_id, e]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-label tracking-tight">Training</h1>
          <p className="text-[13px] text-label-2 mt-0.5">Courses, quizzes &amp; compliance certifications</p>
        </div>
        {isAdmin && (
          <button onClick={() => setBuilding(true)} className="btn-primary inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2">
            <Plus className="w-4 h-4" /> New course
          </button>
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
            return (
              <button key={c.id} onClick={() => setPlaying(c)} className="text-left bg-surface rounded-2xl border border-border p-5 card-shadow hover:bg-fill transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  {c.is_compliance && <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gold-50 text-gold-700 px-1.5 py-0.5 rounded"><ShieldCheck className="w-3 h-3" /> Compliance</span>}
                  {!c.is_published && <span className="text-[10px] text-label-3 border border-border rounded px-1.5 py-0.5">draft</span>}
                  <span className="text-[10px] text-label-3 capitalize">{c.category}</span>
                </div>
                <p className="text-[15px] font-semibold text-label leading-snug">{c.title}</p>
                <p className="text-[12px] text-label-2 mt-1 line-clamp-2">{c.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-label-3">{c.lessons.length} lessons · {c.questions.length} questions</span>
                  {e?.status === 'completed' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success"><CheckCircle2 className="w-3.5 h-3.5" /> {e.score}%</span>
                  ) : e?.status === 'failed' ? (
                    <span className="text-[11px] font-semibold text-danger">Retry · {e.score}%</span>
                  ) : (
                    <span className="text-[11px] font-semibold text-gold-700">Start →</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {playing && <CoursePlayer course={playing} enrollment={enrollMap.get(playing.id)} onClose={() => setPlaying(null)} />}
      {building && <CourseBuilder onClose={() => setBuilding(false)} />}
    </div>
  );
}

function CoursePlayer({ course, enrollment, onClose }: { course: Course; enrollment?: Enrollment; onClose: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<'lessons' | 'quiz'>('lessons');
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; passed: boolean; certificate_code: string | null } | null>(
    enrollment?.status === 'completed' ? { score: enrollment.score ?? 0, passed: true, certificate_code: enrollment.certificate_code } : null,
  );
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (answers.length < course.questions.length || answers.some((a) => a == null)) return toast.error('Answer every question first');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/training/${course.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Submit failed');
      setResult({ score: j.score, passed: j.passed, certificate_code: j.certificate_code });
      toast[j.passed ? 'success' : 'error'](j.passed ? `Passed — ${j.score}%` : `Didn't pass — ${j.score}%`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl border border-border w-full max-w-2xl max-h-[88vh] flex flex-col card-shadow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[16px] font-semibold text-label">{course.title}</h2>
          <button onClick={onClose} className="text-label-3 hover:text-label"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-1 px-5 pt-3">
          {(['lessons', 'quiz'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-[13px] font-medium px-3 py-1.5 rounded-lg capitalize ${tab === t ? 'bg-gold-50 text-gold-700' : 'text-label-2 hover:bg-fill'}`}>{t}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'lessons' ? (
            <div className="space-y-4">
              {course.lessons.length === 0 ? <p className="text-sm text-label-3">No lessons — go straight to the quiz.</p> :
                course.lessons.map((l, i) => (
                  <div key={i}>
                    <h3 className="text-[14px] font-semibold text-label mb-1">{i + 1}. {l.title}</h3>
                    <p className="text-[13px] text-label-2 whitespace-pre-wrap leading-relaxed">{l.content}</p>
                  </div>
                ))}
            </div>
          ) : result ? (
            <div className="text-center py-8">
              {result.passed ? <Award className="w-10 h-10 text-gold-600 mx-auto mb-3" /> : <X className="w-10 h-10 text-danger mx-auto mb-3" />}
              <p className="text-[20px] font-semibold text-label">{result.score}%</p>
              <p className="text-[13px] text-label-2 mt-1">{result.passed ? 'Passed — certification issued' : `Below ${course.pass_threshold}% pass mark`}</p>
              {result.certificate_code && <p className="font-mono text-[12px] text-gold-700 mt-2">{result.certificate_code}</p>}
              {!result.passed && <button onClick={() => { setResult(null); setAnswers([]); }} className="btn-primary text-[13px] font-semibold px-4 py-2 mt-4">Retake</button>}
            </div>
          ) : (
            <div className="space-y-5">
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
              {course.questions.length > 0 && (
                <button onClick={submit} disabled={submitting} className="btn-primary text-[13px] font-semibold px-4 py-2 disabled:opacity-50">{submitting ? 'Grading…' : 'Submit quiz'}</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CourseBuilder({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState({ title: '', description: '', category: 'general', is_compliance: false, pass_threshold: '80' });
  const [lessons, setLessons] = useState<{ title: string; content: string }[]>([{ title: '', content: '' }]);
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
          lessons: lessons.filter((l) => l.title.trim()),
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
              </div>
            ))}
            <button type="button" onClick={() => setLessons((ls) => [...ls, { title: '', content: '' }])} className="text-[12px] font-medium text-gold-700">+ Add lesson</button>
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
