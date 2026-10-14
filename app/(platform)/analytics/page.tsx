"use client";
import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { getOrganizationType } from "../../../lib/organization-types";
export default function Analytics() {
  const [clubs, setClubs] = useState<any[]>([]),
    [metrics, setMetrics] = useState<Record<string, number>>({}),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const sb = createClient();
        const orgs = await sb
          .from("clubs")
          .select("id,status,plan,organization_type");
        if (orgs.error) throw orgs.error;
        setClubs(orgs.data || []);
        const tables = {
          Profiles: "profiles",
          "Member records": "members",
          Events: "club_events",
          "Check-ins": "access_log",
        };
        const entries = await Promise.all(
          Object.entries(tables).map(async ([label, table]) => {
            const { count, error } = await sb
              .from(table)
              .select("*", { count: "exact", head: true });
            if (error) throw error;
            return [label, count ?? 0] as const;
          }),
        );
        setMetrics(Object.fromEntries(entries));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  const group = (key: string) =>
    Object.entries(
      clubs.reduce((acc: Record<string, number>, c) => {
        const label =
          key === "organization_type"
            ? getOrganizationType(c[key]).label
            : c[key] || "Unassigned";
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {}),
    );
  return (
    <>
      <h1>Platform analytics</h1>
      <p>
        Database counts and recorded organization configuration. No estimated
        revenue or demonstration data.
      </p>
      {error && (
        <p className="error" role="alert">
          Metrics could not be verified: {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading analytics…</p>
      ) : (
        !error && (
          <>
            <div className="v11Grid">
              {Object.entries({
                Organizations: clubs.length,
                "Active organizations": clubs.filter(
                  (c) => c.status === "active",
                ).length,
                ...metrics,
              }).map(([label, value]) => (
                <section className="panel" key={label}>
                  <p>{label}</p>
                  <h2>{value}</h2>
                </section>
              ))}
            </div>
            <div className="v11Grid">
              {["organization_type", "plan"].map((key) => (
                <section className="panel" key={key}>
                  <h2>{key === "plan" ? "Plans" : "Organization types"}</h2>
                  {group(key).map(([label, count]) => (
                    <p key={label}>
                      {label}: <b>{count}</b>
                    </p>
                  ))}
                </section>
              ))}
            </div>
          </>
        )
      )}
    </>
  );
}
