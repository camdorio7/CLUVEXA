"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { loadWorkspaceAccess } from "../lib/access-context";
import {
  type AccessContext,
  isAdmin,
  navigationFor,
  canUseModule,
  workspaceRouteAccess,
} from "../lib/modules";
import { getOrganizationType } from "../lib/organization-types";
import { organizationTheme } from "../lib/organization-theme";
import PortalLoading from "./PortalLoading";
import PortalFrame, { type NavItem } from "./PortalFrame";
export type WorkspaceContext = {
  club: any;
  access: AccessContext;
  userId: string;
  refresh: () => void;
};
const Context = createContext<WorkspaceContext | null>(null);
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Workspace context is unavailable");
  return value;
}
export default function WorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { id } = useParams<{ id: string }>();
  const path = usePathname();
  const router = useRouter();
  const [data, setData] = useState<Omit<WorkspaceContext, "refresh"> | null>(
    null,
  );
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;

    setError("");
    (async () => {
      try {
        const sb = createClient();
        const {
          data: { user },
          error,
        } = await sb.auth.getUser();
        if (error || !user) {
          router.replace("/login");
          return;
        }
        const result = await loadWorkspaceAccess(sb, id, user.id);
        if (live) setData({ ...result, userId: user.id });
      } catch (e) {
        if (live)
          setError(
            e instanceof Error ? e.message : "Unable to open this workspace.",
          );
      }
    })();
    return () => {
      live = false;
    };
  }, [id, router, revision]);
  if (error)
    return (
      <main className="v11State" role="alert">
        <h1>Workspace unavailable</h1>
        <p>{error}</p>
        <button onClick={() => setRevision((v) => v + 1)}>Retry</button>{" "}
        <Link href="/organizations">Your organizations</Link>
      </main>
    );
  if (!data || data.club.id !== id) return <PortalLoading />;
  const { club, access } = data;
  const base = `/workspace/${id}`;
  const member = access.role === "member";
  const admin = isAdmin(access.role);
  const type = getOrganizationType(club.organization_type);
  const items: NavItem[] = [{ href: base, label: "Dashboard" }];
  if (member)
    items.push({
      href: base + "/card",
      label: "My membership",
      group: "My account",
    });
  for (const m of navigationFor(access)) {
    if (member && m.key === "members") {
      items.push({
        href: base + "/directory",
        label: "Directory",
        group: "Organization services",
      });
      continue;
    }
    items.push({
      href: base + "/" + m.path,
      label: m.key === "members" ? type.memberLabel : m.name,
      group: member ? type.serviceLabel : m.group,
    });
  }
  if (admin && canUseModule(access, "members"))
    items.push({
      href: base + "/people",
      label: "Membership applications",
      group: "People & access",
    });
  if (canUseModule(access, "golf"))
    items.push(
      {
        href: base + "/scorecard",
        label: "My scorecard",
        group: member ? type.serviceLabel : "Organization services",
      },
      {
        href: base + "/golf-index",
        label: "My golf index",
        group: member ? type.serviceLabel : "Organization services",
      },
    );
  if (admin)
    items.push(
      {
        href: base + "/team-access",
        label: "People & roles",
        group: "People & access",
      },
      {
        href: base + "/permissions",
        label: "Staff permissions",
        group: "People & access",
      },
      {
        href: base + "/settings",
        label: "Branding & modules",
        group: "Organization",
      },
      { href: base + "/audit", label: "Audit history", group: "Organization" },
    );
  items.push({
    href: base + "/profile",
    label: "My profile",
    group: "Account",
  });
  async function out() {
    const { error } = await createClient().auth.signOut();
    if (error) {
      setError("Sign out failed. Please retry.");
      return;
    }
    router.replace("/login");
    router.refresh();
  }
  return (
    <Context.Provider
      value={{ ...data, refresh: () => setRevision((v) => v + 1) }}
    >
      <PortalFrame
        name={club.name}
        subtitle={
          member
            ? "Member portal"
            : admin
              ? "Organization management"
              : "Staff workspace"
        }
        logo={club.logo_url}
        items={items}
        theme={organizationTheme(club.primary_color) as CSSProperties}
        onSignOut={out}
        footer={
          <>
            <Link href="/organizations">Switch organization</Link>
            {access.role === "super_admin" && (
              <Link href="/dashboard">CD7 platform</Link>
            )}
          </>
        }
      >
        {workspaceRouteAccess(
          access,
          path.slice(base.length).replace(/^\//, ""),
        ) ? (
          children
        ) : (
          <section role="alert">
            <h1>Feature unavailable</h1>
            <p>
              This feature is disabled or outside your assigned permissions.
            </p>
          </section>
        )}
      </PortalFrame>
    </Context.Provider>
  );
}
