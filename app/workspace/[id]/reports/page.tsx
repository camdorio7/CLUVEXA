"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import WorkspaceHeader from "../../../../components/WorkspaceHeader";
import { createClient } from "../../../../lib/supabase/client";
function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<any>({}),
    [message, setMessage] = useState("");
  useEffect(() => {
    (async () => {
      const sb = createClient();
      const [m, a, e, s] = await Promise.all([
        sb
          .from("members")
          .select("*", { count: "exact", head: true })
          .eq("club_id", id),
        sb
          .from("access_log")
          .select("*", { count: "exact", head: true })
          .eq("club_id", id),
        sb
          .from("club_events")
          .select("*", { count: "exact", head: true })
          .eq("club_id", id),
        sb
          .from("club_users")
          .select("*", { count: "exact", head: true })
          .eq("club_id", id)
          .in("role", ["owner", "admin", "manager", "staff"]),
      ]);
      if (m.error || a.error || e.error || s.error) {
        setMessage(
          m.error?.message ||
            a.error?.message ||
            e.error?.message ||
            s.error?.message ||
            "Unable to load reports",
        );
        return;
      }
      setC({
        members: m.count,
        checkins: a.count,
        events: e.count,
        staff: s.count,
      });
    })();
  }, [id]);
  async function exportMembers() {
    const { data, error } = await createClient()
      .from("members")
      .select(
        "member_number,full_name,email,status,good_standing,joined_at,expires_at",
      )
      .eq("club_id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    const rows = data || [];
    if (!rows.length) {
      setMessage("No member records to export.");
      return;
    }
    const keys = Object.keys(rows[0]);
    const csv = [
      keys.join(","),
      ...rows.map((r: any) => keys.map((k) => csvCell(r[k])).join(",")),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "nadorio-members.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    setMessage("Export downloaded.");
  }
  return (
    <>
      <WorkspaceHeader
        title="Reports"
        subtitle="Live organization KPIs and exports"
      />
      {message && (
        <p role="status" className="v11Notice">
          {message}
        </p>
      )}
      <div className="metricGrid">
        <div className="metric">
          <span>Members</span>
          <b>{c.members ?? "—"}</b>
        </div>
        <div className="metric">
          <span>Total Check-ins</span>
          <b>{c.checkins ?? "—"}</b>
        </div>
        <div className="metric">
          <span>Events</span>
          <b>{c.events ?? "—"}</b>
        </div>
        <div className="metric">
          <span>Staff & Admins</span>
          <b>{c.staff ?? "—"}</b>
        </div>
      </div>
      <div className="panel">
        <div className="panelhead">Exports</div>
        <div className="settingsBody">
          <p className="muted">
            Download organization data for analysis, accounting or
            recordkeeping.
          </p>
          <button className="button gradient" onClick={exportMembers}>
            Export Members CSV
          </button>
        </div>
      </div>
    </>
  );
}
