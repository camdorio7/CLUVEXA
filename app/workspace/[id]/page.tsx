"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "../../../components/WorkspaceShell";
import { createClient } from "../../../lib/supabase/client";
import { canUseModule, isAdmin } from "../../../lib/modules";
import { getOrganizationType } from "../../../lib/organization-types";
import s from "../../../components/WorkspaceDashboard.module.css";
export default function Dashboard() {
  const { club, access, userId } = useWorkspace();
  const [profile, setProfile] = useState<any>(null);
  const [member, setMember] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const admin = isAdmin(access.role);
  const base = `/workspace/${club.id}`;
  const type = getOrganizationType(club.organization_type);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const sb = createClient();
        const [p, m] = await Promise.all([
          sb
            .from("profiles")
            .select("full_name")
            .eq("id", userId)
            .maybeSingle(),
          sb
            .from("members")
            .select(
              "full_name,member_number,status,good_standing,membership_types(name)",
            )
            .eq("club_id", club.id)
            .eq("profile_id", userId)
            .maybeSingle(),
        ]);
        if (p.error || m.error) throw p.error || m.error;
        if (live) {
          setProfile(p.data);
          setMember(m.data);
        }
        const tasks: PromiseLike<any>[] = [];
        const labels: string[] = [];
        if (canUseModule(access, "events")) {
          tasks.push(
            sb
              .from("club_events")
              .select("id,title,starts_at,location")
              .eq("club_id", club.id)
              .eq("status", "published")
              .gte("starts_at", new Date().toISOString())
              .order("starts_at")
              .limit(5),
          );
          labels.push("events");
        }
        if (admin && canUseModule(access, "members")) {
          tasks.push(
            sb
              .from("members")
              .select("id", { count: "exact", head: true })
              .eq("club_id", club.id)
              .eq("status", "active"),
            sb
              .from("member_join_requests")
              .select("id", { count: "exact", head: true })
              .eq("club_id", club.id)
              .eq("status", "pending"),
          );
          labels.push(type.memberLabel, "Pending applications");
        }
        if (canUseModule(access, "operations")) {
          tasks.push(
            sb
              .from("operational_tasks")
              .select("id", { count: "exact", head: true })
              .eq("club_id", club.id)
              .eq("status", "open"),
          );
          labels.push("Open tasks");
        }
        if (admin && canUseModule(access, "email_center")) {
          tasks.push(
            sb
              .from("organization_site_messages")
              .select("id", { count: "exact", head: true })
              .eq("club_id", club.id),
          );
          labels.push("Website inquiries");
        }
        const results = await Promise.all(tasks);
        const next: Record<string, number> = {};
        results.forEach((r, i) => {
          if (r.error) throw r.error;
          if (labels[i] === "events") {
            if (live) setEvents(r.data || []);
          } else next[labels[i]] = r.count ?? 0;
        });
        if (live) setCounts(next);
      } catch (e) {
        if (live)
          setError(
            e instanceof Error
              ? e.message
              : (e as any)?.message || "Dashboard data could not be loaded.",
          );
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [club.id, access, userId, type.memberLabel, admin]);
  return (
    <>
      <header className={s.header}>
        <div>
          <span className={s.label}>
            {type.label} · {access.role.replace("_", " ")}
          </span>
          <h1>
            Welcome
            {profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.
          </h1>
          <p>
            {club.welcome_message ||
              `Your overview of ${club.name}. Use the sidebar to open the services available to you.`}
          </p>
        </div>
      </header>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      {access.role === "member" && (
        <section className={s.identity}>
          <div className={s.avatar}>
            {(profile?.full_name || "M").slice(0, 1)}
          </div>
          <div>
            <h2>
              {member?.full_name || profile?.full_name || "Your membership"}
            </h2>
            <p>
              {member?.membership_types?.name ||
                "Membership level not assigned"}{" "}
              · {member?.member_number || "No member number"}
            </p>
            <p>
              {member
                ? member.good_standing
                  ? "Good standing"
                  : "Membership review needed"
                : "Member record not connected"}
            </p>
            <Link href={base + "/card"}>View membership card</Link>
          </div>
        </section>
      )}
      {loading ? (
        <p role="status">Loading your summary…</p>
      ) : (
        <div className={s.metrics}>
          {Object.entries(counts).map(([label, value]) => (
            <div className={s.metric} key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      )}
      <div className={s.columns}>
        <section className={s.panel}>
          <h2>
            {canUseModule(access, "events")
              ? "Upcoming events"
              : "Your workspace"}
          </h2>
          {canUseModule(access, "events") ? (
            events.length ? (
              events.map((event) => (
                <div className={s.row} key={event.id}>
                  <div>
                    <b>{event.title}</b>
                    <small>
                      {new Date(event.starts_at).toLocaleString()}
                      {event.location ? ` · ${event.location}` : ""}
                    </small>
                  </div>
                  <Link href={base + "/events"}>View</Link>
                </div>
              ))
            ) : (
              <p className={s.empty}>
                {loading ? "Loading events…" : "No upcoming published events."}
              </p>
            )
          ) : (
            <p className={s.empty}>
              Your sidebar reflects the features licensed and enabled for this
              organization and your assigned permissions.
            </p>
          )}
        </section>
        <aside className={s.panel}>
          <h2>{admin ? "Organization status" : "Account"}</h2>
          {admin ? (
            <>
              <div className={s.row}>
                <span>Licensed modules</span>
                <b>{access.modules.filter((m) => m.licensed).length}</b>
              </div>
              <div className={s.row}>
                <span>Active modules</span>
                <b>
                  {
                    access.modules.filter((m) =>
                      canUseModule(access, m.module_key),
                    ).length
                  }
                </b>
              </div>
              <div className={s.row}>
                <Link href={base + "/settings"}>Manage branding & modules</Link>
              </div>
              {(counts["Pending applications"] || 0) > 0 && (
                <div className={s.row}>
                  <Link href={base + "/people"}>
                    Review {counts["Pending applications"]} applications
                  </Link>
                </div>
              )}
            </>
          ) : (
            <>
              <p className={s.empty}>
                {access.role === "member"
                  ? "Keep your contact details up to date."
                  : "Your organization administrator controls which operational tools you can use."}
              </p>
              <Link href={base + "/profile"}>Open my profile</Link>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
