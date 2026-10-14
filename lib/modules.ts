export type ModuleDefinition = {
  key: string;
  name: string;
  path: string;
  group: string;
  member: boolean;
  available: boolean;
  adminOnly?: boolean;
};
const module = (
  key: string,
  name: string,
  path: string,
  group: string,
  member = false,
  available = true,
  adminOnly = false,
): ModuleDefinition => ({
  key,
  name,
  path,
  group,
  member,
  available,
  adminOnly,
});
export const modules: ModuleDefinition[] = [
  module("members", "Members", "members", "People & access", true),
  module(
    "memberships",
    "Membership levels",
    "memberships",
    "People & access",
    false,
    true,
    true,
  ),
  module("staff", "Staff & time clock", "staff", "People & access"),
  module("events", "Events", "events", "Operations", true),
  module("access", "Sign-in & check-in", "access", "Operations"),
  module("operations", "Daily operations", "operations", "Operations"),
  module("amenities", "Amenities", "amenities", "Operations", true),
  module("golf", "Golf & tournaments", "golf", "Organization services", true),
  module(
    "tee_sheet",
    "Tee sheet settings",
    "tee-sheet",
    "Organization services",
    false,
    true,
    true,
  ),
  module(
    "communications",
    "Announcements",
    "communications",
    "Communication",
    true,
  ),
  module(
    "email_center",
    "Email Center",
    "email-center",
    "Communication",
    false,
    true,
    true,
  ),
  module(
    "website_builder",
    "Website Builder",
    "site-builder",
    "Communication",
    false,
    true,
    true,
  ),
  module("reports", "Reports", "reports", "Insights"),
  module(
    "connected_platforms",
    "Integrations",
    "platforms",
    "Organization",
    false,
    true,
    true,
  ),
  module(
    "website_management",
    "External Website Integration",
    "website",
    "Organization",
    false,
    true,
    true,
  ),
  module("documents", "Documents", "documents", "Communication", true, false),
  module(
    "reservations",
    "Reservations",
    "reservations",
    "Operations",
    true,
    false,
  ),
  module(
    "automations",
    "Automations",
    "automations",
    "Organization",
    false,
    false,
  ),
  module(
    "intelligence",
    "Intelligence",
    "intelligence",
    "Insights",
    false,
    false,
  ),
];
export type License = {
  module_key: string;
  licensed: boolean;
  club_enabled: boolean;
  member_visible?: boolean;
  nav_label?: string | null;
  available?: boolean;
};
export type Permission = {
  module_key: string;
  can_view: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
};
export type AccessContext = {
  role: string;
  active: boolean;
  status: string;
  modules: License[];
  permissions: Permission[];
};
export const isAdmin = (role: string) =>
  ["owner", "admin", "super_admin"].includes(role);
export function canUseModule(
  access: AccessContext,
  key: string,
  action: "view" | "create" | "edit" | "delete" = "view",
): boolean {
  if (
    !access.active ||
    (access.status !== "active" && access.role !== "super_admin")
  )
    return false;
  const definition = modules.find((m) => m.key === key);
  if (!definition?.available) return false;
  const license = access.modules.find((m) => m.module_key === key);
  if (
    !license?.licensed ||
    !license.club_enabled ||
    license.available === false
  )
    return false;
  if (isAdmin(access.role)) return true;
  if (definition.adminOnly) return false;
  if (access.role === "member")
    return (
      action === "view" && definition.member && license.member_visible === true
    );
  if (!["manager", "staff"].includes(access.role)) return false;
  const permission = access.permissions.find((p) => p.module_key === key);
  return permission?.can_view === true && permission[`can_${action}`] === true;
}
export function workspaceRouteAccess(
  access: AccessContext,
  path: string,
): boolean {
  if (
    !access.active ||
    (access.status !== "active" && access.role !== "super_admin")
  )
    return false;
  if (path === "" || path === "profile" || path === "card") return true;
  if (["settings", "audit", "permissions", "team-access"].includes(path))
    return isAdmin(access.role);
  if (path === "members" && access.role === "member") return false;
  if (path === "people")
    return isAdmin(access.role) && canUseModule(access, "members");
  if (path === "directory")
    return (
      (access.role === "member" &&
        canUseModule({ ...access, role: "member" }, "members")) ||
      (isAdmin(access.role) && canUseModule(access, "members"))
    );
  const key = ["scorecard", "golf-index"].includes(path)
    ? "golf"
    : modules.find((m) => m.path === path)?.key;
  return key ? canUseModule(access, key) : false;
}
export function navigationFor(access: AccessContext) {
  return modules
    .filter((m) => canUseModule(access, m.key))
    .map((m) => ({
      ...m,
      name:
        access.modules.find((l) => l.module_key === m.key)?.nav_label || m.name,
    }));
}
