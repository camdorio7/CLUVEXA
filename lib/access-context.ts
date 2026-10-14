import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessContext } from "./modules";

export class AccessError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function loadWorkspaceAccess(
  sb: SupabaseClient,
  clubId: string,
  userId: string,
) {
  const [club, membership, platform, licenses, permissions, catalog] =
    await Promise.all([
      sb.from("clubs").select("*").eq("id", clubId).maybeSingle(),
      sb
        .from("club_users")
        .select("role,active")
        .eq("club_id", clubId)
        .eq("user_id", userId)
        .maybeSingle(),
      sb.rpc("is_super_admin"),
      sb
        .from("club_modules")
        .select("module_key,licensed,club_enabled,member_visible,nav_label")
        .eq("club_id", clubId),
      sb
        .from("club_user_permissions")
        .select("module_key,can_view,can_create,can_edit,can_delete")
        .eq("club_id", clubId)
        .eq("user_id", userId),
      sb.from("module_catalog").select("module_key,available"),
    ]);
  if (
    [club, membership, platform, licenses, permissions, catalog].some(
      (r) => r.error,
    )
  )
    throw new AccessError(
      503,
      "Unable to verify organization access. Check the v11 migration and database connection.",
    );
  if (!club.data) throw new AccessError(403, "Organization access denied.");
  const role =
    platform.data === true ? "super_admin" : membership.data?.role || "";
  const access: AccessContext = {
    role,
    active: platform.data === true || membership.data?.active === true,
    status: club.data.status,
    modules: (licenses.data || []).map((m) => ({
      ...m,
      available:
        catalog.data?.find((c) => c.module_key === m.module_key)?.available ===
        true,
    })),
    permissions: permissions.data || [],
  };
  if (!access.active || !role)
    throw new AccessError(403, "Organization access denied.");
  if (access.status !== "active" && role !== "super_admin")
    throw new AccessError(403, "This organization is inactive.");
  return { club: club.data, access };
}
