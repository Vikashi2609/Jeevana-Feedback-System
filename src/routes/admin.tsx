import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  adminLogin,
  adminLogout,
  adminStatus,
  listResponses,
  listTeachers,
  upsertTeacher,
  deleteTeacher,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Feedback Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminPage,
});

type Row = {
  id: number;
  submitted_at: string;
  class: string;
  section: string;
  subject: string;
  teacher: string;
  q1: number; q2: number; q3: number; q4: number; q5: number;
  q6: number; q7: number; q8: number; q9: number; q10: number;
  comment: string | null;
  submission_id: string | null;
};

type Teacher = {
  id: number;
  class: string;
  section: string;
  subject: string;
  teacher: string;
  is_optional: boolean;
};

const CSV_HEADERS = [
  "id", "submitted_at", "submission_id", "class", "section", "subject", "teacher",
  "q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "avg", "comment",
];

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCSV(rows: Row[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    const avg = ((r.q1 + r.q2 + r.q3 + r.q4 + r.q5 + r.q6 + r.q7 + r.q8 + r.q9 + r.q10) / 10).toFixed(2);
    lines.push([
      r.id, r.submitted_at, r.submission_id ?? "", r.class, r.section, r.subject, r.teacher,
      r.q1, r.q2, r.q3, r.q4, r.q5, r.q6, r.q7, r.q8, r.q9, r.q10, avg, r.comment ?? "",
    ].map(csvEscape).join(","));
  }
  return lines.join("\n");
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    adminStatus()
      .then((r) => setAuthed(r.authenticated))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return <div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>;
  }
  if (!authed) return <LoginForm onLoggedIn={() => setAuthed(true)} />;
  return <Dashboard onLogout={() => setAuthed(false)} />;
}

function LoginForm({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await adminLogin({ data: { username, password } });
      if (r.ok) onLoggedIn();
      else setError("Invalid username or password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-200 p-6 space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Admin sign in</h1>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
        {error && <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-800 p-2 text-sm">{error}</div>}
        <button type="submit" disabled={busy || !username || !password}
          className="w-full rounded-lg bg-indigo-600 text-white font-semibold py-2 hover:bg-indigo-700 disabled:opacity-60">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"responses" | "teachers">("responses");

  async function logout() {
    try { await adminLogout(); } catch { /* ignore */ }
    onLogout();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <TabBtn active={tab === "responses"} onClick={() => setTab("responses")}>Responses</TabBtn>
            <TabBtn active={tab === "teachers"} onClick={() => setTab("teachers")}>Teachers</TabBtn>
          </div>
          <button onClick={() => void logout()} className="text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-100">
            Sign out
          </button>
        </div>
        {tab === "responses" ? <ResponsesTab /> : <TeachersTab />}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={
      "px-4 py-2 rounded-lg text-sm font-medium " +
      (active ? "bg-indigo-600 text-white" : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100")
    }>{children}</button>
  );
}

function ResponsesTab() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function load() {
    setError(null);
    try {
      const res = await listResponses();
      setRows(res.rows as Row[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (classFilter && r.class !== classFilter) return false;
      if (sectionFilter && r.section !== sectionFilter) return false;
      if (subjectFilter && !r.subject.toLowerCase().includes(subjectFilter.toLowerCase())) return false;
      if (teacherFilter && !r.teacher.toLowerCase().includes(teacherFilter.toLowerCase())) return false;
      return true;
    });
  }, [rows, classFilter, sectionFilter, subjectFilter, teacherFilter]);

  const submissions = useMemo(() => {
    const seen = new Set<string>();
    for (const r of filtered) {
      seen.add(r.submission_id ?? `${r.submitted_at.slice(0, 16)}|${r.class}|${r.section}`);
    }
    return seen.size;
  }, [filtered]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const submissionKeys = new Set<string>();
    const perClass = new Map<string, Set<string>>();
    let sum = 0, count = 0, lastTs = 0, last60s = 0;
    const now = Date.now();
    for (const r of rows) {
      const key = r.submission_id ?? `${r.submitted_at.slice(0, 16)}|${r.class}|${r.section}`;
      submissionKeys.add(key);
      if (!perClass.has(r.class)) perClass.set(r.class, new Set());
      perClass.get(r.class)!.add(key);
      const qs = [r.q1, r.q2, r.q3, r.q4, r.q5, r.q6, r.q7, r.q8, r.q9, r.q10];
      sum += qs.reduce((a, b) => a + b, 0);
      count += 10;
      const ts = new Date(r.submitted_at).getTime();
      if (ts > lastTs) lastTs = ts;
      if (now - ts < 60_000) last60s++;
    }
    return {
      totalRows: rows.length,
      totalSubmissions: submissionKeys.size,
      avg: count ? (sum / count).toFixed(2) : "—",
      lastTs, last60s,
      perClass: Array.from(perClass.entries()).map(([k, v]) => ({ class: k, count: v.size })).sort((a, b) => b.count - a.count),
    };
  }, [rows]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Feedback Admin</h1>
          <p className="text-sm text-slate-600 mt-1">
            {rows == null ? "Loading…" : `${filtered.length} row${filtered.length === 1 ? "" : "s"} · ~${submissions} submission${submissions === 1 ? "" : "s"} (filtered)`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-slate-700 px-3 py-2 rounded-lg border border-slate-300 bg-white">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Live (5s)
          </label>
          <button onClick={() => rows && download(`feedback-all-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows))}
            disabled={!rows} className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
            Download all CSV
          </button>
          <button onClick={() => download(`feedback-filtered-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(filtered))}
            disabled={filtered.length === 0} className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            Download filtered CSV
          </button>
          <button onClick={() => void load()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100">Refresh</button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <StatCard label="Total submissions" value={stats.totalSubmissions} accent="indigo" />
          <StatCard label="Total rows (subjects)" value={stats.totalRows} accent="slate" />
          <StatCard label="Last 60s" value={stats.last60s} accent="emerald" pulse={stats.last60s > 0} />
          <StatCard label="Overall avg rating" value={stats.avg} accent="amber" />
          <StatCard label="Last submission" value={stats.lastTs ? timeAgo(stats.lastTs) : "—"} accent="slate" />
        </div>
      )}

      {stats && stats.perClass.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4">
          <div className="text-sm font-semibold text-slate-700 mb-3">Submissions by class</div>
          <div className="space-y-2">
            {stats.perClass.map((c) => {
              const max = stats.perClass[0].count || 1;
              const pct = (c.count / max) * 100;
              return (
                <div key={c.class} className="flex items-center gap-3">
                  <div className="w-16 text-sm font-medium text-slate-700">Class {c.class}</div>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-10 text-right text-sm tabular-nums text-slate-600">{c.count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <input value={classFilter} onChange={(e) => setClassFilter(e.target.value)} placeholder="Class (e.g. VI)"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        <input value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} placeholder="Section (e.g. A)"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        <input value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} placeholder="Subject contains…"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        <input value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} placeholder="Teacher contains…"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      </div>

      {error && <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-800 p-3 text-sm mb-4">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="text-left px-3 py-2">When</th>
              <th className="text-left px-3 py-2">Class</th>
              <th className="text-left px-3 py-2">Sec</th>
              <th className="text-left px-3 py-2">Subject</th>
              <th className="text-left px-3 py-2">Teacher</th>
              {Array.from({ length: 10 }, (_, i) => (<th key={i} className="px-2 py-2">Q{i + 1}</th>))}
              <th className="px-2 py-2">Avg</th>
              <th className="text-left px-3 py-2">Comment</th>
            </tr>
          </thead>
          <tbody>
            {rows == null && (<tr><td colSpan={17} className="p-6 text-center text-slate-500">Loading…</td></tr>)}
            {rows && filtered.length === 0 && (<tr><td colSpan={17} className="p-6 text-center text-slate-500">No rows</td></tr>)}
            {filtered.map((r) => {
              const avg = ((r.q1 + r.q2 + r.q3 + r.q4 + r.q5 + r.q6 + r.q7 + r.q8 + r.q9 + r.q10) / 10).toFixed(2);
              return (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{new Date(r.submitted_at).toLocaleString()}</td>
                  <td className="px-3 py-2 font-medium">{r.class}</td>
                  <td className="px-3 py-2">{r.section}</td>
                  <td className="px-3 py-2">{r.subject}</td>
                  <td className="px-3 py-2 font-medium">{r.teacher}</td>
                  {[r.q1, r.q2, r.q3, r.q4, r.q5, r.q6, r.q7, r.q8, r.q9, r.q10].map((v, i) => (
                    <td key={i} className="px-2 py-2 text-center">{v}</td>
                  ))}
                  <td className="px-2 py-2 text-center font-semibold">{avg}</td>
                  <td className="px-3 py-2 max-w-xs truncate" title={r.comment ?? ""}>{r.comment}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeachersTab() {
  const [rows, setRows] = useState<Teacher[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [filter, setFilter] = useState("");

  async function load() {
    setError(null);
    try {
      const r = await listTeachers();
      setRows(r.rows as Teacher[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }
  useEffect(() => { void load(); }, []);

  async function save(t: Teacher) {
    setBusy(true); setError(null);
    try {
      await upsertTeacher({ data: {
        id: t.id || undefined, class: t.class, section: t.section,
        subject: t.subject, teacher: t.teacher, is_optional: t.is_optional,
      } });
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (!confirm("Delete this teacher assignment?")) return;
    setBusy(true); setError(null);
    try {
      await deleteTeacher({ data: { id } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally { setBusy(false); }
  }

  const filtered = useMemo(() => {
    if (!rows) return [];
    const f = filter.toLowerCase();
    if (!f) return rows;
    return rows.filter((r) =>
      r.class.toLowerCase().includes(f) ||
      r.section.toLowerCase().includes(f) ||
      r.subject.toLowerCase().includes(f) ||
      r.teacher.toLowerCase().includes(f),
    );
  }, [rows, filter]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teachers</h1>
          <p className="text-sm text-slate-600 mt-1">
            Edit class → section → subject → teacher assignments live. Changes take effect immediately for new submissions.
          </p>
        </div>
        <div className="flex gap-2">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search…"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <button onClick={() => setEditing({ id: 0, class: "", section: "", subject: "", teacher: "", is_optional: false })}
            className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700">
            + Add assignment
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-800 p-3 text-sm mb-4">{error}</div>}

      {editing && (
        <TeacherForm value={editing} busy={busy} onCancel={() => setEditing(null)} onSave={save} />
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="text-left px-3 py-2">Class</th>
              <th className="text-left px-3 py-2">Section</th>
              <th className="text-left px-3 py-2">Subject</th>
              <th className="text-left px-3 py-2">Teacher</th>
              <th className="text-left px-3 py-2">Optional</th>
              <th className="text-left px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows == null && (<tr><td colSpan={6} className="p-6 text-center text-slate-500">Loading…</td></tr>)}
            {rows && filtered.length === 0 && (<tr><td colSpan={6} className="p-6 text-center text-slate-500">No assignments</td></tr>)}
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{t.class}</td>
                <td className="px-3 py-2">{t.section}</td>
                <td className="px-3 py-2">{t.subject}</td>
                <td className="px-3 py-2 font-medium">{t.teacher}</td>
                <td className="px-3 py-2">{t.is_optional ? "Yes" : "—"}</td>
                <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => setEditing(t)} className="text-indigo-600 hover:underline">Edit</button>
                  <button onClick={() => void remove(t.id)} className="text-rose-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeacherForm({ value, busy, onCancel, onSave }: {
  value: Teacher;
  busy: boolean;
  onCancel: () => void;
  onSave: (t: Teacher) => void | Promise<void>;
}) {
  const [t, setT] = useState<Teacher>(value);
  useEffect(() => { setT(value); }, [value]);

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 mb-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <input placeholder="Class (VI)" value={t.class} onChange={(e) => setT({ ...t, class: e.target.value.toUpperCase() })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        <input placeholder="Section (A)" value={t.section} onChange={(e) => setT({ ...t, section: e.target.value.toUpperCase() })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        <input placeholder="Subject" value={t.subject} onChange={(e) => setT({ ...t, subject: e.target.value })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2" />
        <input placeholder="Teacher" value={t.teacher} onChange={(e) => setT({ ...t, teacher: e.target.value })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2" />
        <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
          <input type="checkbox" checked={t.is_optional} onChange={(e) => setT({ ...t, is_optional: e.target.checked })} />
          Optional-subject slot (IX/X only — mark both alternatives as optional to let students choose)
        </label>
        <div className="md:col-span-4 flex gap-2 justify-end">
          <button onClick={onCancel} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100">Cancel</button>
          <button
            disabled={busy || !t.class || !t.section || !t.subject || !t.teacher}
            onClick={() => void onSave(t)}
            className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : t.id ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const ACCENTS: Record<string, string> = {
  indigo: "bg-indigo-50 border-indigo-200 text-indigo-900",
  slate: "bg-slate-50 border-slate-200 text-slate-900",
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
  amber: "bg-amber-50 border-amber-200 text-amber-900",
};

function StatCard({ label, value, accent = "slate", pulse = false }: { label: string; value: number | string; accent?: string; pulse?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${ACCENTS[accent] ?? ACCENTS.slate} ${pulse ? "animate-pulse" : ""}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
    </div>
  );
}
