"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useWorkspace } from "../../../../components/WorkspaceShell";
import { createClient } from "../../../../lib/supabase/client";
import { canUseModule } from "../../../../lib/modules";
export default function Checkin() {
  const { club, access, userId } = useWorkspace();
  const [members, setMembers] = useState<any[]>([]),
    [rows, setRows] = useState<any[]>([]),
    [member, setMember] = useState(""),
    [guest, setGuest] = useState(""),
    [type, setType] = useState((club.checkin_activities || ["General"])[0]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const sb = createClient();
    const [m, l] = await Promise.all([
      sb
        .from("members")
        .select("id,full_name,member_number,good_standing")
        .eq("club_id", club.id)
        .eq("status", "active")
        .order("full_name"),
      sb
        .from("access_log")
        .select("*,members(full_name)")
        .eq("club_id", club.id)
        .order("checked_in_at", { ascending: false })
        .limit(100),
    ]);
    if (m.error || l.error)
      setMessage(
        m.error?.message || l.error?.message || "Unable to load check-ins",
      );
    else {
      setMembers(m.data || []);
      setRows(l.data || []);
    }
  }
  useEffect(() => {
    void load();
  }, [club.id]);
  async function checkin(e: FormEvent) {
    e.preventDefault();
    if ((!member && !guest.trim()) || (member && guest.trim()))
      return setMessage("Select a member or enter a guest, not both.");
    setBusy(true);
    const { error } = await createClient()
      .from("access_log")
      .insert({
        club_id: club.id,
        member_id: member || null,
        guest_name: guest.trim() || null,
        access_type: type,
        checked_in_by: userId,
      });
    setMessage(error?.message || "Check-in recorded.");
    if (!error) {
      setMember("");
      setGuest("");
      await load();
    }
    setBusy(false);
  }
  return (
    <>
      <h1>Sign-in & check-in</h1>
      <p>
        Record attendance for the activities configured by your organization.
      </p>
      {message && (
        <p role="status" className="v11Notice">
          {message}
        </p>
      )}
      {canUseModule(access, "access", "create") && (
        <form className="panel v11Form" onSubmit={checkin}>
          <label>
            Member
            <select
              value={member}
              onChange={(e) => {
                setMember(e.target.value);
                setGuest("");
              }}
            >
              <option value="">Select a member, or enter a guest below</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} · {m.member_number || "No number"}
                  {m.good_standing ? "" : " · Review standing"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Guest name
            <input
              maxLength={120}
              value={guest}
              onChange={(e) => {
                setGuest(e.target.value);
                setMember("");
              }}
            />
          </label>
          <label>
            Activity
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {(club.checkin_activities || ["General"])
                .filter(Boolean)
                .map((a: string) => (
                  <option key={a}>{a}</option>
                ))}
            </select>
          </label>
          <button
            className="button gradient"
            disabled={busy || (!member && !guest.trim())}
          >
            Record check-in
          </button>
        </form>
      )}
      <div className="v11TableWrap">
        <table className="v11Table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Activity</th>
              <th>Checked in</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.members?.full_name || r.guest_name}</td>
                <td>{r.access_type}</td>
                <td>{new Date(r.checked_in_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p>No attendance recorded.</p>}
      </div>
    </>
  );
}
