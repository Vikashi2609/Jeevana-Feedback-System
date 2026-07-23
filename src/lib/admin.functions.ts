import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function serverAdminClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        // Opaque sb_ keys aren't JWTs — send only apikey, not the default Authorization bearer.
        if ((key.startsWith("sb_") || !key.includes(".")) && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ username: z.string().min(1).max(200), password: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    const u = process.env.ADMIN_USERNAME ?? "";
    const p = process.env.ADMIN_PASSWORD ?? "";
    if (!u || !p) throw new Error("Admin credentials not configured");
    const ok = timingSafeEq(data.username, u) && timingSafeEq(data.password, p);
    if (!ok) {
      // Slow down brute-force a bit
      await new Promise((r) => setTimeout(r, 500));
      return { ok: false as const };
    }
    const { adminSession } = await import("./admin-session.server");
    const s = await adminSession();
    await s.update({ admin: true });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { adminSession } = await import("./admin-session.server");
  const s = await adminSession();
  await s.clear();
  return { ok: true };
});

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { adminSession } = await import("./admin-session.server");
  const s = await adminSession();
  return { authenticated: !!s.data.admin };
});

export const listResponses = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const sb = serverAdminClient();
  const { data, error } = await sb
    .from("responses")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(50000);
  if (error) throw new Error(error.message);
  return { rows: data ?? [] };
});

export const listTeachers = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const sb = serverAdminClient();
  const { data, error } = await sb
    .from("teachers")
    .select("*")
    .order("class", { ascending: true })
    .order("section", { ascending: true })
    .order("is_optional", { ascending: true })
    .order("subject", { ascending: true });
  if (error) throw new Error(error.message);
  return { rows: data ?? [] };
});

const upsertSchema = z.object({
  id: z.number().int().nullable().optional(),
  class: z.string().min(1).max(20),
  section: z.string().min(1).max(20),
  subject: z.string().min(1).max(100),
  teacher: z.string().min(1).max(200),
  is_optional: z.boolean(),
});

export const upsertTeacher = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const sb = serverAdminClient();
    if (data.id) {
      const { error } = await sb
        .from("teachers")
        .update({
          class: data.class,
          section: data.section,
          subject: data.subject,
          teacher: data.teacher,
          is_optional: data.is_optional,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("teachers").upsert(
        {
          class: data.class,
          section: data.section,
          subject: data.subject,
          teacher: data.teacher,
          is_optional: data.is_optional,
        },
        { onConflict: "class,section,subject" },
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteTeacher = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const sb = serverAdminClient();
    const { error } = await sb.from("teachers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const getSystemSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();

  const sb = serverAdminClient();

  const { data, error } = await sb
    .from("system_settings")
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return { settings: data };
});


const systemSettingsSchema = z.object({
  evaluation_open: z.boolean(),
  refresh_version: z.number().int(),
  show_vi: z.boolean(),
  show_vii: z.boolean(),
  show_viii: z.boolean(),
  show_ix: z.boolean(),
  show_x: z.boolean(),
  show_xi: z.boolean(),
});
export const refreshStudentScreens = createServerFn({ method: "POST" })
  .handler(async () => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();

    const sb = serverAdminClient();

    const { data, error } = await sb
      .from("system_settings")
      .select("refresh_version")
      .eq("id", 1)
      .single();

    if (error) throw new Error(error.message);

    const { error: updateError } = await sb
      .from("system_settings")
      .update({
        refresh_version: (data?.refresh_version ?? 0) + 1,
      })
      .eq("id", 1);

    if (updateError) throw new Error(updateError.message);

    return { ok: true };
  });

export const updateSystemSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => systemSettingsSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();

    const sb = serverAdminClient();

    const { error } = await sb
      .from("system_settings")
      .update({
        evaluation_open: data.evaluation_open,
        refresh_version: data.refresh_version,
        show_vi: data.show_vi,
        show_vii: data.show_vii,
        show_viii: data.show_viii,
        show_ix: data.show_ix,
        show_x: data.show_x,
        show_xi: data.show_xi,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) throw new Error(error.message);

    return { ok: true };
  });