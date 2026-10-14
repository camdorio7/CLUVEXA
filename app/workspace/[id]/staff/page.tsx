"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useWorkspace } from "../../../../components/WorkspaceShell";
import { createClient } from "../../../../lib/supabase/client";
import { isAdmin } from "../../../../lib/modules";
export default function Staff() {
  const { club, access, userId } = useWorkspace();
  const [entries, setEntries] = useState<any[]>([]),
    [people, setPeople] = useState<any[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [role, setRole] = useState("staff"),
    [inviteLink, setInviteLink] = useState("");
  const admin = isAdmin(access.role);
  const open = entries.find((e) => e.user_id === userId && !e.clock_out);
  async function load() {
    try {
      const sb = createClient();
      const times = await sb
        .from("staff_time_entries")
        .select("*,profiles(full_name)")
        .eq("club_id", club.id)
        .order("clock_in", { ascending: false })
        .limit(100);
      if (times.error) throw times.error;
      setEntries(times.data || []);
      if (admin) {
        const members = await sb
          .from("club_users")
          .select("id,user_id,role,active,profiles(full_name,email)")
          .eq("club_id", club.id)
          .in("role", ["owner", "admin", "staff", "manager"]);
        if (members.error) throw members.error;
        setPeople(members.data || []);
      }
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [club.id, admin]);
  async function clock() {
    setBusy(true);
    const sb = createClient();
    const result = open
      ? await sb
          .from("staff_time_entries")
          .update({ clock_out: new Date().toISOString() })
          .eq("id", open.id)
          .eq("user_id", userId)
      : await sb
          .from("staff_time_entries")
          .insert({ club_id: club.id, user_id: userId });
    setMessage(
      result.error?.message || (open ? "Clocked out." : "Clocked in."),
    );
    if (!result.error) await load();
    setBusy(false);
  }
  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setInviteLink("");
    try {
      const sb = createClient();
      const pending = await sb
        .from("club_invitations")
        .select("id")
        .eq("club_id", club.id)
        .eq("email", email.trim().toLowerCase())
        .eq("status", "pending")
        .maybeSingle();
      if (pending.error) throw pending.error;
      const record = {
        club_id: club.id,
        email: email.trim().toLowerCase(),
        full_name: name.trim(),
        role,
        invited_by: userId,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      };
      const saved = pending.data
        ? await sb
            .from("club_invitations")
            .update(record)
            .eq("id", pending.data.id)
            .select("token")
            .single()
        : await sb
            .from("club_invitations")
            .insert(record)
            .select("token")
            .single();
      if (saved.error) throw saved.error;
      setInviteLink(`${window.location.origin}/join?token=${saved.data.token}`);
      setMessage("Invitation saved. Sending email…");
      const {
        data: { session },
      } = await sb.auth.getSession();
      try {
        const r = await fetch("/api/email/invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ token: saved.data.token }),
        });
        const out = await r.json();
        setMessage(
          r.ok
            ? "Invitation saved and accepted by the email provider."
            : `Invitation saved. Email was not sent: ${out.error || "Provider error"}`,
        );
      } catch {
        setMessage(
          "Invitation saved, but email could not be sent. Share the link below.",
        );
      }
      setName("");
      setEmail("");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Staff & time clock</h1>
      <p>
        Staff access is assigned by organization administrators. Time records
        use the database clock.
      </p>
      {message && (
        <p role="status" className="v11Notice">
          {message}
        </p>
      )}
      {loading ? (
        <p role="status">Loading staff workspace…</p>
      ) : (
        <section className="panel">
          <h2>{open ? "Your shift is open" : "Start your shift"}</h2>
          {open && <p>Started {new Date(open.clock_in).toLocaleString()}</p>}
          <button className="button gradient" disabled={busy} onClick={clock}>
            {open ? "Clock out" : "Clock in"}
          </button>
        </section>
      )}
      {admin && (
        <>
          <p>
            <Link href={`/workspace/${club.id}/permissions`}>
              Manage staff permissions →
            </Link>
          </p>
          <form className="panel v11Form" onSubmit={invite}>
            <h2>Invite a team member</h2>
            <label>
              Name
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Role
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
            <button className="button gradient" disabled={busy}>
              Save & email invitation
            </button>
            {inviteLink && (
              <label>
                Invitation link (share with the invited person)
                <input readOnly value={inviteLink} />
              </label>
            )}
          </form>
          <div className="v11TableWrap">
            <table className="v11Table">
              <thead>
                <tr>
                  <th>Team member</th>
                  <th>Role</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.profiles?.full_name || "User"}
                      <small>{p.profiles?.email}</small>
                    </td>
                    <td>{p.role}</td>
                    <td>{p.active ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <h2>{admin ? "Recent time records" : "My time records"}</h2>
      <div className="v11TableWrap">
        <table className="v11Table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Clock in</th>
              <th>Clock out</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{e.profiles?.full_name || "Staff"}</td>
                <td>{new Date(e.clock_in).toLocaleString()}</td>
                <td>
                  {e.clock_out
                    ? new Date(e.clock_out).toLocaleString()
                    : "Open shift"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Time correction requests, shift scheduling, and receipt uploads are not
        available in this release.
      </p>
    </>
  );
}
