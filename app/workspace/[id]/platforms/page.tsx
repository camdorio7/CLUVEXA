"use client";
import { useEffect, useState } from "react";
import { useWorkspace } from "../../../../components/WorkspaceShell";
import { createClient } from "../../../../lib/supabase/client";
export default function Integrations() {
  const { club } = useWorkspace();
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    createClient()
      .from("connected_platforms")
      .select("id,name,description,status,portal_url")
      .eq("club_id", club.id)
      .order("name")
      .then(({ data, error }) => {
        setRows(data || []);
        setError(error?.message || "");
        setLoading(false);
      });
  }, [club.id]);
  return (
    <>
      <h1>Organization integrations</h1>
      <p>
        Connections configured by CD7. Status below is configuration metadata,
        not a live service check. LINDEX is optional.
      </p>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Loading connections…</p>}
      <div className="v11Grid">
        {rows.map((r) => (
          <section className="panel" key={r.id}>
            <h2>{r.name}</h2>
            <p>{r.description}</p>
            <p>Recorded status: {r.status}</p>
            {/^https:\/\//.test(r.portal_url || "") && (
              <a href={r.portal_url} target="_blank" rel="noopener noreferrer">
                Open service ↗
              </a>
            )}
          </section>
        ))}
      </div>
      {!loading && !rows.length && (
        <p>
          No integrations are configured. Contact CD7 to connect an external
          service.
        </p>
      )}
    </>
  );
}
