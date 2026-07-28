import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "./admin-session.server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// helper
function serverAdminClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if ((key.startsWith("sb_") || !key.includes(".")) && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

// =========================================================================
// ORIGINAL FUNCTIONS (keep these!)
// =========================================================================

export const getTeacherSummary = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const sb = serverAdminClient();
  const { data, error } = await sb.from("responses").select("*");
  if (error) throw error;

  const teachers = new Map<string, {
    teacher: string; subject: string; class: string; section: string;
    responses: number; total: number;
  }>();

  for (const row of data) {
    const key = `${row.teacher}|${row.subject}|${row.class}|${row.section}`;
    if (!teachers.has(key)) {
      teachers.set(key, {
        teacher: row.teacher, subject: row.subject, class: row.class, section: row.section,
        responses: 0, total: 0,
      });
    }
    const t = teachers.get(key)!;
    t.responses++;
    const score = row.q1 + row.q2 + row.q3 + row.q4 + row.q5 + row.q6 + row.q7 + row.q8 + row.q9 + row.q10;
    t.total += score / 10;
  }

  return {
    teachers: [...teachers.values()].map((t) => ({
      ...t,
      average: Number((t.total / t.responses).toFixed(2)),
    })),
  };
});

export const getTeacherDetails = createServerFn({ method: "GET" })
  .validator((data: { teacher: string; subject: string; className: string; section: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = serverAdminClient();
    const { data: rows, error } = await sb
      .from("responses").select("*")
      .eq("teacher", data.teacher).eq("subject", data.subject)
      .eq("class", data.className).eq("section", data.section);
    if (error) throw error;
    return { rows };
  });

export const getTeacherReportData = createServerFn({ method: "GET" })
  .validator((data: { teacher: string; subject: string; className: string; section: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = serverAdminClient();
    const { data: rows, error } = await sb
      .from("responses").select("*")
      .eq("teacher", data.teacher).eq("subject", data.subject)
      .eq("class", data.className).eq("section", data.section);
    if (error) throw error;

    const questions = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"];
    const questionAverage = questions.map((q) => {
      const total = rows.reduce((sum, r) => sum + Number(r[q]), 0);
      return { question: q.toUpperCase(), average: rows.length > 0 ? Number((total / rows.length).toFixed(2)) : 0 };
    });

    return { teacher: data.teacher, subject: data.subject, class: data.className, section: data.section, responses: rows.length, rows, questionAverage };
  });

// =========================================================================
// NEW FUNCTIONS
// =========================================================================

export const getReportDownloadUrl = createServerFn({ method: "GET" })
  .validator((data: { teacher: string; format: "pdf" | "xlsx" }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = serverAdminClient();
    const extension = data.format === "pdf" ? "pdf" : "xlsx";
    
    const filename = data.format === "pdf" 
      ? `${data.teacher}_Report.${extension}`
      : `${data.teacher}.${extension}`;
    
    const path = `${data.teacher}/${filename}`;

    // Try getting a public URL instead of signed
    const { data: publicData } = sb
      .storage
      .from("teacher-reports")
      .getPublicUrl(path);

    console.log("Public URL:", publicData.publicUrl);
    return { url: publicData.publicUrl };
  });