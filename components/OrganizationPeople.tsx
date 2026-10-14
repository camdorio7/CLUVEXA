"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Copy,
  MailPlus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { createClient } from "../lib/supabase/client";

type Person = {
  id: string;
  role: string;
  active: boolean;
  user_id: string;
  profiles?: { full_name?: string; email?: string } | null;
};
type Invite = {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  status: string;
  token: string;
  expires_at: string;
};
export default function OrganizationPeople() {
  const { id } = useParams<{ id: string }>();
  const [currentUser, setCurrentUser] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const sb = createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    setCurrentUser(user?.id || "");
    const [{ data: p, error: pe }, { data: i, error: ie }] = await Promise.all([
      sb
        .from("club_users")
        .select("id,role,active,user_id,profiles(full_name,email)")
        .eq("club_id", id)
        .order("role"),
      sb
        .from("club_invitations")
        .select("id,email,full_name,role,status,token,expires_at")
        .eq("club_id", id)
        .order("created_at", { ascending: false }),
    ]);
    if (pe || ie) setMsg(pe?.message || ie?.message || "Unable to load people");
    setPeople((p as any) || []);
    setInvites((i as any) || []);
  }
  useEffect(() => {
    load();
  }, [id]);
  const pending = useMemo(
    () => invites.filter((i) => i.status === "pending"),
    [invites],
  );
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "")
  ).replace(/\/$/, "");
  async function sendInviteEmail(token: string) {
    const sb = createClient();
    const {
      data: { session },
    } = await sb.auth.getSession();
    try {
      return await fetch("/api/email/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ token }),
      });
    } catch {
      return { ok: false };
    }
  }
  async function invite() {
    if (!email.trim()) return setMsg("Enter an email address.");
    setBusy(true);
    setMsg("");
    const sb = createClient();
    const normalized = email.trim().toLowerCase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    let token: string | undefined;
    const { data: existing } = await sb
      .from("club_invitations")
      .select("id,token")
      .eq("club_id", id)
      .eq("email", normalized)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) {
      const expires = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data, error } = await sb
        .from("club_invitations")
        .update({
          full_name: name.trim() || null,
          role,
          invited_by: user?.id,
          expires_at: expires,
        })
        .eq("id", existing.id)
        .select("token")
        .single();
      if (error) {
        setBusy(false);
        return setMsg(error.message);
      }
      token = data.token;
    } else {
      const { data, error } = await sb
        .from("club_invitations")
        .insert({
          club_id: id,
          email: normalized,
          full_name: name.trim() || null,
          role,
          invited_by: user?.id,
        })
        .select("token")
        .single();
      if (error) {
        setBusy(false);
        return setMsg(error.message);
      }
      token = data.token;
    }
    const sent = await sendInviteEmail(token!);
    setBusy(false);
    if (sent.ok) {
      setMsg(
        existing
          ? "Existing invitation updated and resent successfully."
          : "Invitation created and emailed successfully.",
      );
    } else {
      const url = `${appUrl}/join?token=${token}`;
      try {
        await navigator.clipboard.writeText(url);
        setMsg(
          "Invitation saved, but email could not be sent. The NADORIO sign-up link was copied instead.",
        );
      } catch {
        setMsg(`Invitation saved, but email could not be sent: ${url}`);
      }
    }
    setEmail("");
    setName("");
    await load();
  }
  async function resend(token: string) {
    setBusy(true);
    const sent = await sendInviteEmail(token);
    setBusy(false);
    setMsg(
      sent.ok
        ? "Invitation resent successfully."
        : "Email could not be sent. Check the Email Center for details.",
    );
  }
  async function copy(token: string) {
    const url = `${appUrl}/join?token=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setMsg("NADORIO invitation link copied.");
    } catch {
      setMsg("Copy this invitation link: " + url);
    }
  }
  async function revoke(inviteId: string) {
    if (!confirm("Revoke this pending invitation?")) return;
    const { error } = await createClient()
      .from("club_invitations")
      .update({ status: "revoked" })
      .eq("id", inviteId);
    if (error) setMsg(error.message);
    else {
      setMsg("Invitation revoked.");
      load();
    }
  }
  async function remove(person: Person) {
    if (person.user_id === currentUser) return;
    if (
      !confirm(
        `${person.active ? "Deactivate" : "Reactivate"} this person's organization access?`,
      )
    )
      return;
    const { error } = await createClient()
      .from("club_users")
      .update({ active: !person.active })
      .eq("id", person.id)
      .eq("club_id", id);
    if (error) setMsg(error.message);
    else {
      setMsg("Organization access updated.");
      void load();
    }
  }
  async function changeRole(person: Person, role: string) {
    if (person.user_id === currentUser) return;
    setBusy(true);
    const { error } = await createClient()
      .from("club_users")
      .update({ role })
      .eq("id", person.id)
      .eq("club_id", id);
    setMsg(error?.message || "Role updated.");
    if (!error) await load();
    setBusy(false);
  }
  return (
    <>
      <h1>People & access</h1>
      <p>
        Invite people, change organization roles, and deactivate access while
        preserving records.
      </p>
      <div className="cards">
        <div className="card">
          <div className="label">Club Admins</div>
          <div className="metric">
            {people.filter((p) => ["owner", "admin"].includes(p.role)).length}
          </div>
        </div>
        <div className="card">
          <div className="label">Managers & Staff</div>
          <div className="metric">
            {people.filter((p) => ["manager", "staff"].includes(p.role)).length}
          </div>
        </div>
        <div className="card">
          <div className="label">Members with Logins</div>
          <div className="metric">
            {people.filter((p) => p.role === "member").length}
          </div>
        </div>
        <div className="card">
          <div className="label">Pending Invites</div>
          <div className="metric">{pending.length}</div>
        </div>
      </div>
      <div className="panel">
        <div className="panelhead">
          <span>
            <MailPlus size={19} /> Invite a person
          </span>
        </div>
        <div className="muted" style={{ marginBottom: 16 }}>
          Create the first Club Admin here. Club Admins can then manage their
          own organization workspace, staff and members.
        </div>
        <div className="inlineForm">
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="admin">Club Admin</option>
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
            <option value="member">Member</option>
          </select>
          <button className="button gradient" disabled={busy} onClick={invite}>
            {busy ? "Creating…" : "Create Invitation"}
          </button>
        </div>
        {msg && <div className="successMsg">{msg}</div>}
      </div>
      <div className="panel">
        <div className="panelhead">
          <span>
            <ShieldCheck size={19} /> Organization access
          </span>
          <button className="iconButton" onClick={load} title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
        {people.map((p) => (
          <div className="datarow" key={p.id}>
            <div>
              <b>{p.profiles?.full_name || "NADORIO User"}</b>
              <div className="muted">{p.profiles?.email || p.user_id}</div>
            </div>
            <select
              aria-label={`Role for ${p.profiles?.full_name || p.user_id}`}
              value={p.role}
              disabled={busy || p.user_id === currentUser}
              onChange={(e) => changeRole(p, e.target.value)}
            >
              {["owner", "admin", "manager", "staff", "member"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <span className={p.active ? "status" : "chip"}>
              {p.active ? "Active" : "Inactive"}
            </span>
            <button
              className="button secondary"
              disabled={busy || p.user_id === currentUser}
              onClick={() => remove(p)}
            >
              {p.active ? "Deactivate" : "Reactivate"}
            </button>
          </div>
        ))}
        {!people.length && (
          <div className="empty">
            <Users size={26} />
            <div>No one has joined this organization yet.</div>
            <small>Create the first Club Admin invitation above.</small>
          </div>
        )}
      </div>
      <div className="panel">
        <div className="panelhead">Pending invitations</div>
        {pending.map((i) => (
          <div className="datarow" key={i.id}>
            <div>
              <b>{i.full_name || i.email}</b>
              <div className="muted">{i.email}</div>
            </div>
            <span className="chip">{i.role}</span>
            <span className="muted">
              Expires {new Date(i.expires_at).toLocaleDateString()}
            </span>
            <button
              className="button secondary small"
              disabled={busy}
              onClick={() => resend(i.token)}
            >
              <RefreshCw size={14} /> Resend
            </button>
            <button
              className="button secondary small"
              onClick={() => copy(i.token)}
            >
              <Copy size={14} /> Copy Link
            </button>
            <button className="textDanger" onClick={() => revoke(i.id)}>
              Revoke
            </button>
          </div>
        ))}
        {!pending.length && (
          <div className="empty">No pending invitations.</div>
        )}
      </div>
    </>
  );
}
