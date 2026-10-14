import { createClient } from "@supabase/supabase-js";
import { loadWorkspaceAccess } from "./access-context";
import { canUseModule, isAdmin } from "./modules";
import type { NextRequest } from "next/server";

/** Authorize email actions using the requester's JWT and organization membership. */
export async function authorizeOrganizationEmail(
  req: NextRequest,
  clubId: string,
  allowedRoles: readonly string[],
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = req.headers.get("authorization") || "";
  if (!url || !anon)
    return {
      ok: false as const,
      status: 503,
      error: "Authentication is not configured.",
    };
  if (!/^Bearer\s+\S+$/i.test(authorization))
    return { ok: false as const, status: 401, error: "Sign in required." };
  const sb = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: authError,
  } = await sb.auth.getUser();
  if (authError || !user)
    return {
      ok: false as const,
      status: 401,
      error: "Session expired. Sign in again.",
    };
  try {
    const { access } = await loadWorkspaceAccess(sb, clubId, user.id);
    if (!isAdmin(access.role))
      return {
        ok: false as const,
        status: 403,
        error: "Organization administrator permission required.",
      };
    if (
      req.nextUrl.pathname.endsWith("/announcement") &&
      !canUseModule(access, "communications", "create")
    )
      return {
        ok: false as const,
        status: 403,
        error: "Communications is not enabled.",
      };
    return { ok: true as const, sb, user };
  } catch {
    return {
      ok: false as const,
      status: 403,
      error: "Active organization access could not be verified.",
    };
  }
}
