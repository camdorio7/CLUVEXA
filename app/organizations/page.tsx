"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
export default function Organizations() {
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [owner, setOwner] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const sb = createClient();
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) throw Error("Sign in to choose an organization.");
        const [roles, platform] = await Promise.all([
          sb
            .from("club_users")
            .select("role,clubs(id,name,status,logo_url)")
            .eq("user_id", user.id)
            .eq("active", true),
          sb.rpc("is_super_admin"),
        ]);
        if (roles.error || platform.error) throw roles.error || platform.error;
        setRows(roles.data || []);
        setOwner(platform.data === true);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  return (
    <main className="v11State">
      <h1>Your organizations</h1>
      <p>Choose the workspace you want to use.</p>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Loading…</p>}
      {owner && (
        <p>
          <Link href="/dashboard">CD7 Platform Owner →</Link>
        </p>
      )}
      {rows.map((r) => (
        <div className="panel" key={r.clubs?.id}>
          <h2>{r.clubs?.name}</h2>
          <p>
            {r.role} · {r.clubs?.status}
          </p>
          {r.clubs?.status === "active" ? (
            <Link href={`/workspace/${r.clubs.id}`}>Open workspace →</Link>
          ) : (
            <p>This organization is inactive.</p>
          )}
        </div>
      ))}
      {!loading && !error && !rows.length && !owner && (
        <p>
          No active organization membership.{" "}
          <Link href="/member/pending">Review applications</Link>
        </p>
      )}
      <p>
        <Link href="/login">Back to sign in</Link>
      </p>
    </main>
  );
}
