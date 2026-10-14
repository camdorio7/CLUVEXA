"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "../../components/Shell";
import { createClient } from "../../lib/supabase/client";
export default function Users() {
  const [rows, setRows] = useState<any[]>([]),
    [memberships, setMemberships] = useState<any[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [page, setPage] = useState(0),
    [total, setTotal] = useState(0);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const sb = createClient();
      let q = sb
        .from("profiles")
        .select("id,full_name,email,platform_role,created_at", {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .range(page * 50, page * 50 + 49);
      if (query.trim()) {
        const term = query.trim().replace(/[%_,().]/g, "");
        q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
      }
      const users = await q;
      if (users.error) throw users.error;
      const roles = users.data?.length
        ? await sb
            .from("club_users")
            .select("id,user_id,role,active,clubs(id,name)")
            .in(
              "user_id",
              users.data.map((p) => p.id),
            )
        : { data: [], error: null };
      if (roles.error) throw roles.error;
      setRows(users.data || []);
      setTotal(users.count || 0);
      setMemberships(roles.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 200);
    return () => clearTimeout(timer);
  }, [page, query]);
  async function toggle(row: any) {
    if (
      !confirm(
        `${row.active ? "Deactivate" : "Reactivate"} this user's access to ${row.clubs?.name}?`,
      )
    )
      return;
    setBusy(row.id);
    const { error } = await createClient()
      .from("club_users")
      .update({ active: !row.active })
      .eq("id", row.id);
    if (error) setError(error.message);
    else await load();
    setBusy("");
  }
  return (
    <Shell>
      <h1>Platform users</h1>
      <p>
        Registered NADORIO profiles and organization access. Deactivation here
        affects only the selected organization.
      </p>
      <input
        aria-label="Search platform users"
        placeholder="Search name or email"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(0);
        }}
      />
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading users…</p>
      ) : (
        <div className="v11TableWrap">
          <table className="v11Table">
            <thead>
              <tr>
                <th>User</th>
                <th>Joined NADORIO</th>
                <th>Organization access</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user.id}>
                  <td>
                    <b>{user.full_name || "Unnamed user"}</b>
                    <small>{user.email || "Email not available"}</small>
                    <small>
                      {user.platform_role === "super_admin"
                        ? "CD7 Platform Owner"
                        : "User"}
                    </small>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    {memberships
                      .filter((m) => m.user_id === user.id)
                      .map((m) => (
                        <div key={m.id}>
                          <Link href={`/clubs/${m.clubs.id}/people`}>
                            {m.clubs.name}
                          </Link>{" "}
                          · {m.role} · {m.active ? "Active" : "Inactive"}{" "}
                          <button
                            disabled={
                              !!busy || user.platform_role === "super_admin"
                            }
                            onClick={() => toggle(m)}
                          >
                            {m.active
                              ? "Deactivate access"
                              : "Reactivate access"}
                          </button>
                        </div>
                      ))}
                    {!memberships.some((m) => m.user_id === user.id) &&
                      "No organization membership"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p>No matching profiles.</p>}
        </div>
      )}
      <p>
        {total} matching profiles. Last sign-in and global Auth account
        suspension are not available in this view.
      </p>
      <button
        disabled={page === 0 || loading}
        onClick={() => setPage((p) => p - 1)}
      >
        Previous
      </button>{" "}
      <button
        disabled={(page + 1) * 50 >= total || loading}
        onClick={() => setPage((p) => p + 1)}
      >
        Next
      </button>
    </Shell>
  );
}
