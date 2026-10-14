"use client";
import { useEffect, useState, type FormEvent } from "react";
import Shell from "../../components/Shell";
import { createClient } from "../../lib/supabase/client";
export default function Support() {
  const [rows, setRows] = useState<any[]>([]),
    [clubs, setClubs] = useState<any[]>([]),
    [club, setClub] = useState(""),
    [subject, setSubject] = useState(""),
    [detail, setDetail] = useState(""),
    [priority, setPriority] = useState("normal"),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const sb = createClient();
      const [cases, orgs] = await Promise.all([
        sb
          .from("support_cases")
          .select("*,clubs(name)")
          .order("created_at", { ascending: false })
          .limit(200),
        sb.from("clubs").select("id,name").order("name"),
      ]);
      if (cases.error || orgs.error) throw cases.error || orgs.error;
      setRows(cases.data || []);
      setClubs(orgs.data || []);
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      const { error } = await sb
        .from("support_cases")
        .insert({
          club_id: club || null,
          opened_by: user?.id,
          subject: subject.trim(),
          detail,
          priority,
        });
      if (error) throw error;
      setSubject("");
      setDetail("");
      setMessage("Support case created.");
      await load();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save(row: any) {
    setBusy(true);
    const { error } = await createClient()
      .from("support_cases")
      .update({
        status: row.status,
        priority: row.priority,
        resolution: row.resolution,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    setMessage(error?.message || "Case updated.");
    setBusy(false);
    if (!error) await load();
  }
  function edit(id: string, patch: any) {
    setRows((old) => old.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  return (
    <Shell>
      <h1>Support cases</h1>
      <p>
        Internal CD7 case tracking. No inbound support email or automatic
        notifications are connected.
      </p>
      {message && (
        <p className="v11Notice" role="status">
          {message}
        </p>
      )}
      <form className="panel v11Form" onSubmit={add}>
        <h2>Open a case</h2>
        <label>
          Organization
          <select value={club} onChange={(e) => setClub(e.target.value)}>
            <option value="">Platform / general</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Subject
          <input
            value={subject}
            maxLength={200}
            required
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>
        <label>
          Details
          <textarea
            value={detail}
            maxLength={10000}
            onChange={(e) => setDetail(e.target.value)}
          />
        </label>
        <label>
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {["low", "normal", "high", "urgent"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <button className="button gradient" disabled={busy || !subject.trim()}>
          Create case
        </button>
      </form>
      {loading && <p role="status">Loading cases…</p>}
      <div className="v11Grid">
        {rows.map((row) => (
          <form
            className="panel v11Form"
            key={row.id}
            onSubmit={(e) => {
              e.preventDefault();
              void save(row);
            }}
          >
            <h2>{row.subject}</h2>
            <p>
              {row.clubs?.name || "Platform"} ·{" "}
              {new Date(row.created_at).toLocaleDateString()}
            </p>
            <p>{row.detail}</p>
            <label>
              Status
              <select
                value={row.status}
                onChange={(e) => edit(row.id, { status: e.target.value })}
              >
                {["open", "in_progress", "waiting", "resolved", "closed"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Priority
              <select
                value={row.priority}
                onChange={(e) => edit(row.id, { priority: e.target.value })}
              >
                {["low", "normal", "high", "urgent"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Resolution / follow-up notes
              <textarea
                value={row.resolution || ""}
                maxLength={10000}
                onChange={(e) => edit(row.id, { resolution: e.target.value })}
              />
            </label>
            <button className="button secondary" disabled={busy}>
              Save case
            </button>
          </form>
        ))}
      </div>
      {!loading && !rows.length && <p>No cases recorded.</p>}
    </Shell>
  );
}
