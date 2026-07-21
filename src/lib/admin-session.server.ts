import { useSession } from "@tanstack/react-start/server";

export type AdminSessionData = { admin?: boolean };

export function adminSession() {
  const password = process.env.ADMIN_SESSION_SECRET;
  if (!password) throw new Error("ADMIN_SESSION_SECRET not configured");
  return useSession<AdminSessionData>({
    password,
    name: "admin_session",
    maxAge: 60 * 60 * 8, // 8 hours
    cookie: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
  });
}

export async function requireAdmin() {
  const s = await adminSession();
  if (!s.data.admin) throw new Error("Unauthorized");
}
