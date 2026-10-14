"use client";
import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
export default function Security() {
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    createClient()
      .from("audit_log")
      .select(
        "id,club_id,actor_id,action,target_type,target_id,detail,created_at,clubs(name)",
      )
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        setRows(data || []);
        setError(error?.message || "");
        setLoading(false);
      });
  }, []);
  return (
    <>
      <h1>Security audit history</h1>
      <p>
        Latest 200 recorded administrative changes. v11 records organization,
        role, license, permission, invitation, website, catalog, and support
        changes in database triggers. Authentication provider sign-in logs are
        not included.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading audit history…</p>
      ) : (
        <div className="v11TableWrap">
          <table className="v11Table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Organization</th>
                <th>Action</th>
                <th>Actor / changed fields</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{r.clubs?.name || "Platform"}</td>
                  <td>
                    {r.action} · {r.target_type}
                    <small>{r.target_id}</small>
                  </td>
                  <td>
                    {r.actor_id || "System"}
                    <small>
                      {Array.isArray(r.detail?.changed_fields)
                        ? r.detail.changed_fields.join(", ")
                        : "Legacy event"}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !error && <p>No audit events have been recorded.</p>}
        </div>
      )}
    </>
  );
}
