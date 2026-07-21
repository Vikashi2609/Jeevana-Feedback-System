import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const answerSchema = z.object({
  subject: z.string().min(1),
  q1: z.number().int().min(1).max(5),
  q2: z.number().int().min(1).max(5),
  q3: z.number().int().min(1).max(5),
  q4: z.number().int().min(1).max(5),
  q5: z.number().int().min(1).max(5),
  q6: z.number().int().min(1).max(5),
  q7: z.number().int().min(1).max(5),
  q8: z.number().int().min(1).max(5),
  q9: z.number().int().min(1).max(5),
  q10: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});

function serverSupabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

// Public: load which sections/subjects exist for the student form.
export const getClassMeta = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ className: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const sb = serverSupabase();
    const { data: rows, error } = await sb
      .from("teachers")
      .select("section, subject, is_optional")
      .eq("class", data.className);
    if (error) throw new Error(error.message);

    const sectionMap = new Map<string, { required: string[]; optional: string[] }>();
    for (const r of rows ?? []) {
      if (!sectionMap.has(r.section)) sectionMap.set(r.section, { required: [], optional: [] });
      const bucket = sectionMap.get(r.section)!;
      (r.is_optional ? bucket.optional : bucket.required).push(r.subject);
    }
    // Sort deterministically.
    for (const v of sectionMap.values()) {
      v.required.sort();
      v.optional.sort();
    }
    const sections = Array.from(sectionMap.keys()).sort();
    const bySection: Record<string, { required: string[]; optional: string[] }> = {};
    for (const s of sections) bySection[s] = sectionMap.get(s)!;
    return { sections, bySection };
  });

const submitSchema = z.object({
  submissionId: z.string().uuid(),
  className: z.string().min(1),
  section: z.string().min(1),
  optionalSubjectKey: z.string().optional().nullable(),
  answers: z.array(answerSchema).min(1).max(20),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = serverSupabase();

    // Resolve teachers from DB (source of truth — no redeploy needed for edits).
    const { data: teachers, error: te } = await sb
      .from("teachers")
      .select("subject, teacher, is_optional")
      .eq("class", data.className)
      .eq("section", data.section);
    if (te) throw new Error(te.message);
    if (!teachers || teachers.length === 0) throw new Error("Unknown class/section.");

    const required = teachers.filter((t) => !t.is_optional);
    const optionals = teachers.filter((t) => t.is_optional);
    const teacherBySubject = new Map<string, string>();
    for (const r of required) teacherBySubject.set(r.subject, r.teacher);

    if (optionals.length === 1) {
      teacherBySubject.set(optionals[0].subject, optionals[0].teacher);
    } else if (optionals.length > 1) {
      const pick = optionals.find((o) => o.subject === data.optionalSubjectKey);
      if (!pick) throw new Error("Optional subject choice required.");
      teacherBySubject.set(pick.subject, pick.teacher);
    }

    const expected = new Set(teacherBySubject.keys());
    const got = new Set(data.answers.map((a) => a.subject));
    if (expected.size !== got.size || [...expected].some((s) => !got.has(s))) {
      throw new Error("Answers do not match required subjects.");
    }

    const rows = data.answers.map((a) => ({
      submission_id: data.submissionId,
      class: data.className,
      section: data.section,
      subject: a.subject,
      teacher: teacherBySubject.get(a.subject)!,
      q1: a.q1, q2: a.q2, q3: a.q3, q4: a.q4, q5: a.q5,
      q6: a.q6, q7: a.q7, q8: a.q8, q9: a.q9, q10: a.q10,
      comment: a.comment?.trim() ? a.comment.trim() : null,
    }));

    const { error } = await sb.from("responses").insert(rows);
    if (error) {
      // Duplicate submission_id (retry / double-click) — treat as success.
      if (error.code === "23505" || /duplicate/i.test(error.message)) {
        return { ok: true as const, duplicate: true, inserted: 0 };
      }
      throw new Error(error.message);
    }
    return { ok: true as const, duplicate: false, inserted: rows.length };
  });
