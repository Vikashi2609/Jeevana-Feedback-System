import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { CLASSES, QUESTIONS, type ClassName } from "@/lib/evaluation-config";
import { getClassMeta, submitFeedback } from "@/lib/feedback.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Teacher Feedback" },
      { name: "description", content: "Anonymous teacher evaluation." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FeedbackApp,
});

type Step = "class" | "section" | "optional" | "rate" | "done";

interface AnswerState {
  ratings: Record<number, number | null>;
  comment: string;
}

interface ClassMeta {
  sections: string[];
  bySection: Record<string, { required: string[]; optional: string[] }>;
}

const SCALE_COLORS: Record<number, { base: string; selected: string }> = {
  1: { base: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100", selected: "bg-rose-500 text-white border-rose-500" },
  2: { base: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100", selected: "bg-orange-500 text-white border-orange-500" },
  3: { base: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100", selected: "bg-amber-500 text-white border-amber-500" },
  4: { base: "bg-lime-50 text-lime-800 border-lime-200 hover:bg-lime-100", selected: "bg-lime-600 text-white border-lime-600" },
  5: { base: "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100", selected: "bg-emerald-600 text-white border-emerald-600" },
};

const SUBMITTED_FLAG = "feedback_submitted_v1";

function emptyAnswer(): AnswerState {
  return { ratings: Object.fromEntries(QUESTIONS.map((_, i) => [i + 1, null])), comment: "" };
}

function newSubmissionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback (very unlikely path in modern browsers)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        <header className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-indigo-950">Teacher Feedback</h1>
          <p className="mt-2 text-sm md:text-base text-slate-600">
            Anonymous · Your response helps your teachers improve.
          </p>
        </header>
        {children}
      </div>
    </div>
  );
}

function StepChip({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div
      className={
        "px-3 py-1 rounded-full text-xs font-medium border " +
        (active
          ? "bg-indigo-600 text-white border-indigo-600"
          : done
            ? "bg-indigo-100 text-indigo-700 border-indigo-200"
            : "bg-white text-slate-500 border-slate-200")
      }
    >
      {label}
    </div>
  );
}

function FeedbackApp() {
  const [step, setStep] = useState<Step>("class");
  const [className, setClassName] = useState<ClassName | null>(null);
  const [classMeta, setClassMeta] = useState<ClassMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [section, setSection] = useState<string | null>(null);
  const [optionalKey, setOptionalKey] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingSubjects, setMissingSubjects] = useState<Set<string>>(new Set());

  // Stable submission id for this browser session — prevents duplicate rows
  // on double-click / retry (DB has a unique index too).
  const submissionIdRef = useRef<string>(newSubmissionId());

  // Guard: this browser already submitted — don't let it submit again.
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem(SUBMITTED_FLAG)) {
        setStep("done");
      }
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const sectionMeta = section && classMeta ? classMeta.bySection[section] : null;
  const optChoices = sectionMeta && sectionMeta.optional.length > 1 ? sectionMeta.optional : [];

  const subjectList = useMemo(() => {
    if (!sectionMeta) return [] as string[];
    const list = [...sectionMeta.required];
    if (sectionMeta.optional.length === 1) list.push(sectionMeta.optional[0]);
    else if (sectionMeta.optional.length > 1 && optionalKey) list.push(optionalKey);
    return list;
  }, [sectionMeta, optionalKey]);

  async function pickClass(c: ClassName) {
    setClassName(c);
    setSection(null);
    setOptionalKey(null);
    setMetaError(null);
    setClassMeta(null);
    setLoadingMeta(true);
    try {
      const meta = await getClassMeta({ data: { className: c } });
      setClassMeta(meta);
      setStep("section");
    } catch (e) {
      setMetaError(e instanceof Error ? e.message : "Failed to load class info.");
    } finally {
      setLoadingMeta(false);
    }
  }

  function pickSection(s: string) {
    if (!classMeta) return;
    const meta = classMeta.bySection[s];
    if (!meta) return;
    setSection(s);
    setOptionalKey(null);
    if (meta.optional.length > 1) {
      setStep("optional");
    } else {
      seedAnswers(meta, null);
      setStep("rate");
    }
  }

  function pickOptional(k: string) {
    if (!sectionMeta) return;
    setOptionalKey(k);
    seedAnswers(sectionMeta, k);
    setStep("rate");
  }

  function seedAnswers(meta: { required: string[]; optional: string[] }, optK: string | null) {
    const list = [...meta.required];
    if (meta.optional.length === 1) list.push(meta.optional[0]);
    else if (optK) list.push(optK);
    const seeded: Record<string, AnswerState> = {};
    for (const subj of list) seeded[subj] = emptyAnswer();
    setAnswers(seeded);
  }

  function setRating(subject: string, q: number, v: number) {
    setAnswers((prev) => ({
      ...prev,
      [subject]: { ...prev[subject], ratings: { ...prev[subject].ratings, [q]: v } },
    }));
    if (missingSubjects.has(subject)) {
      const next = new Set(missingSubjects);
      next.delete(subject);
      setMissingSubjects(next);
    }
  }

  function setComment(subject: string, val: string) {
    setAnswers((prev) => ({ ...prev, [subject]: { ...prev[subject], comment: val } }));
  }

  async function handleSubmit() {
    if (!className || !section || submitting) return;
    setError(null);

    const missing = new Set<string>();
    for (const subj of subjectList) {
      const a = answers[subj];
      if (!a) { missing.add(subj); continue; }
      for (let i = 1; i <= 10; i++) if (a.ratings[i] == null) { missing.add(subj); break; }
    }
    if (missing.size > 0) {
      setMissingSubjects(missing);
      setError(`Please answer every question. ${missing.size} subject card${missing.size > 1 ? "s are" : " is"} incomplete.`);
      setTimeout(() => {
        const first = document.querySelector<HTMLElement>("[data-missing='true']");
        first?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      return;
    }

    setSubmitting(true);
    try {
      const payloadAnswers = subjectList.map((subject) => {
        const a = answers[subject];
        return {
          subject,
          q1: a.ratings[1]!, q2: a.ratings[2]!, q3: a.ratings[3]!, q4: a.ratings[4]!, q5: a.ratings[5]!,
          q6: a.ratings[6]!, q7: a.ratings[7]!, q8: a.ratings[8]!, q9: a.ratings[9]!, q10: a.ratings[10]!,
          comment: a.comment.trim() || null,
        };
      });
      await submitFeedback({
        data: {
          submissionId: submissionIdRef.current,
          className,
          section,
          optionalSubjectKey: optionalKey,
          answers: payloadAnswers,
        },
      });
      try { window.localStorage.setItem(SUBMITTED_FLAG, "1"); } catch { /* ignore */ }
      setStep("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(`Submission failed: ${msg}. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done") {
    return (
      <Shell>
        <div className="rounded-3xl bg-white shadow-xl border border-indigo-100 p-10 md:p-14 text-center">
          <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-emerald-600" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-indigo-950">Thank you!</h2>
          <p className="mt-3 text-slate-600">Your feedback has been submitted.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-center gap-2 justify-center">
        <StepChip label={className ? `Class ${className}` : "Class"} active={step === "class"} done={step !== "class" && !!className} />
        <StepChip label={section ? `Section ${section}` : "Section"} active={step === "section"} done={!!section && step !== "section"} />
        {optChoices.length > 0 && (
          <StepChip label={optionalKey ?? "Optional Subject"} active={step === "optional"} done={!!optionalKey && step === "rate"} />
        )}
        <StepChip label="Rate Subjects" active={step === "rate"} done={false} />
      </div>

      {step === "class" && (
        <Card title="Select your class">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {CLASSES.map((c) => (
              <button
                key={c}
                onClick={() => void pickClass(c)}
                disabled={loadingMeta}
                className="rounded-2xl border-2 border-indigo-100 bg-white px-6 py-8 text-2xl font-bold text-indigo-900 hover:border-indigo-500 hover:bg-indigo-50 transition min-h-[88px] disabled:opacity-60"
              >
                Class {c}
              </button>
            ))}
          </div>
          {loadingMeta && <p className="mt-4 text-sm text-slate-500 text-center">Loading…</p>}
          {metaError && (
            <div className="mt-4 rounded-xl border-2 border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {metaError}{" "}
              <button className="underline" onClick={() => className && void pickClass(className)}>Retry</button>
            </div>
          )}
        </Card>
      )}

      {step === "section" && className && classMeta && (
        <Card title={`Class ${className} — select your section`} onBack={() => setStep("class")}>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {classMeta.sections.map((s) => (
              <button
                key={s}
                onClick={() => pickSection(s)}
                className="rounded-2xl border-2 border-indigo-100 bg-white px-4 py-6 text-xl font-bold text-indigo-900 hover:border-indigo-500 hover:bg-indigo-50 transition min-h-[80px]"
              >
                {s}
              </button>
            ))}
          </div>
        </Card>
      )}

      {step === "optional" && className && section && (
        <Card title="Select your optional subject" onBack={() => setStep("section")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {optChoices.map((k) => (
              <button
                key={k}
                onClick={() => pickOptional(k)}
                className="rounded-2xl border-2 border-indigo-100 bg-white px-6 py-6 text-lg font-semibold text-indigo-900 hover:border-indigo-500 hover:bg-indigo-50 transition min-h-[80px]"
              >
                {k}
              </button>
            ))}
          </div>
        </Card>
      )}

      {step === "rate" && className && section && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-indigo-600 text-white p-5 md:p-6 shadow-lg">
            <div>
              <div className="text-xs uppercase tracking-wider text-indigo-200">Feedback for</div>
              <div className="text-xl md:text-2xl font-bold">
                Class {className} · Section {section}{optionalKey ? ` · ${optionalKey}` : ""}
              </div>
            </div>
            <p className="mt-2 text-sm text-indigo-100">
              Rate each subject on the 10 questions below. All ratings are required. Take your time.
            </p>
          </div>

          {subjectList.map((subj) => (
            <SubjectCard
              key={subj}
              subject={subj}
              answer={answers[subj]}
              missing={missingSubjects.has(subj)}
              onRate={(q, v) => setRating(subj, q, v)}
              onComment={(v) => setComment(subj, v)}
            />
          ))}

          {error && (
            <div className="rounded-xl border-2 border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
          )}

          <div className="sticky bottom-4 z-10">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-2xl bg-indigo-600 text-white font-semibold text-lg py-4 shadow-xl hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {submitting ? "Submitting…" : "Submit Feedback"}
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Card({ title, children, onBack }: { title: string; children: React.ReactNode; onBack?: () => void }) {
  return (
    <div className="rounded-3xl bg-white shadow-xl border border-indigo-100 p-6 md:p-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-indigo-950">{title}</h2>
        {onBack && (
          <button onClick={onBack} className="text-sm text-indigo-600 hover:text-indigo-800 underline underline-offset-4">
            ← Back
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function SubjectCard({
  subject, answer, missing, onRate, onComment,
}: {
  subject: string;
  answer: AnswerState;
  missing: boolean;
  onRate: (q: number, v: number) => void;
  onComment: (v: string) => void;
}) {
  return (
    <div
      data-missing={missing ? "true" : "false"}
      className={
        "rounded-3xl bg-white shadow-lg border-2 p-6 md:p-8 " +
        (missing ? "border-rose-300" : "border-indigo-100")
      }
    >
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h3 className="text-2xl md:text-3xl font-bold text-indigo-950">{subject}</h3>
        {missing && (
          <span className="text-xs font-semibold text-rose-700 bg-rose-100 px-2 py-1 rounded-full">
            Please complete
          </span>
        )}
      </div>

      <div className="space-y-5">
        {QUESTIONS.map((q, i) => {
          const qn = i + 1;
          const val = answer?.ratings[qn] ?? null;
          return (
            <div key={qn} className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
              <div className="text-sm md:text-base font-medium text-slate-800 mb-3">
                <span className="text-indigo-500 mr-2">{qn}.</span>
                {q}
              </div>
              <div className="grid grid-cols-5 gap-2 md:gap-3">
                {[1, 2, 3, 4, 5].map((n) => {
                  const c = SCALE_COLORS[n];
                  const selected = val === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onRate(qn, n)}
                      className={
                        "w-full min-h-[52px] rounded-xl border-2 font-bold text-lg transition " +
                        (selected ? c.selected : c.base)
                      }
                      aria-label={`Rate ${n}`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>1 · Strongly Disagree</span>
                <span>5 · Strongly Agree</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 border-t border-slate-100 pt-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Anything else to mention? <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={answer?.comment ?? ""}
          onChange={(e) => onComment(e.target.value)}
          maxLength={2000}
          rows={3}
          className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none transition"
          placeholder="Optional comment"
        />
      </div>
    </div>
  );
}
