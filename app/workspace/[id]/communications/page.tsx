"use client";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../../../../components/WorkspaceShell";
import { canUseModule, isAdmin } from "../../../../lib/modules";
import { createClient } from "../../../../lib/supabase/client";
import { portalApi } from "../../../../lib/portal-api";
export default function Communications() {
  const { club, access } = useWorkspace();
  const admin = isAdmin(access.role),
    canCreate = canUseModule(access, "communications", "create");
  const [rows, setRows] = useState<any[]>([]),
    [campaigns, setCampaigns] = useState<any[]>([]),
    [counts, setCounts] = useState<any[]>([]),
    [deliveries, setDeliveries] = useState<any[] | null>(null),
    [templates, setTemplates] = useState<any[]>([]),
    [form, setForm] = useState({ title: "", body: "", audience: "all" }),
    [email, setEmail] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const request = useRef({ payload: "", key: "" });
  async function load() {
    try {
      const sb = createClient();
      const announcements = await sb
        .from("announcements")
        .select("*")
        .eq("club_id", club.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (announcements.error) throw announcements.error;
      setRows(announcements.data || []);
      if (admin) {
        const [c, n, t] = await Promise.all([
          sb
            .from("email_campaigns")
            .select("id,subject,created_at,source")
            .eq("club_id", club.id)
            .order("created_at", { ascending: false })
            .limit(30),
          sb.rpc("v12_campaign_counts", { target_club: club.id }),
          sb
            .from("email_templates")
            .select("*")
            .eq("club_id", club.id)
            .order("name")
            .limit(100),
        ]);
        if (c.error || n.error || t.error) throw c.error || n.error || t.error;
        setCampaigns(c.data || []);
        setCounts(n.data || []);
        setTemplates(t.data || []);
      }
    } catch (e: any) {
      setMessage(e.message);
    }
  }
  useEffect(() => {
    void load();
  }, [club.id]);
  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload = JSON.stringify({ clubId: club.id, ...form, email });
      if (request.current.payload !== payload)
        request.current = { payload, key: crypto.randomUUID() };
      if (email) {
        const out = await portalApi("/api/email/announcement", {
          clubId: club.id,
          ...form,
          requestKey: request.current.key,
        });
        setMessage(
          `Published. ${out.queued} private emails queued. Delivery status will update as the scheduler processes them.`,
        );
      } else {
        const { error } = await createClient().rpc("v12_publish_announcement", {
          target_club: club.id,
          request_key_value: request.current.key,
          subject_value: form.title,
          body_value: form.body,
          audience_value: form.audience,
          email_value: false,
        });
        if (error) throw error;
        setMessage("Announcement published.");
      }
      setForm({ title: "", body: "", audience: "all" });
      request.current = { payload: "", key: "" };
      await load();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveTemplate() {
    setBusy(true);
    try {
      const { error } = await createClient()
        .from("email_templates")
        .insert({
          club_id: club.id,
          name: form.title,
          subject: form.title,
          body: form.body,
        });
      if (error) throw error;
      setMessage("Template saved.");
      await load();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function details(id: string) {
    const { data, error } = await createClient()
      .from("email_deliveries")
      .select("id,recipient,status,attempts,last_error")
      .eq("club_id", club.id)
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) setMessage(error.message);
    else setDeliveries(data || []);
  }
  return (
    <>
      <h1>Communications</h1>
      <p>
        Publish organization announcements and track private email delivery.
      </p>
      {message && (
        <p className="v11Notice" role="status">
          {message}
        </p>
      )}
      {canCreate && (
        <form className="panel v11Form" onSubmit={publish}>
          <h2>New announcement</h2>
          {admin && (
            <label>
              Start from a template
              <select
                disabled={busy}
                defaultValue=""
                onChange={(e) => {
                  const t = templates.find((t) => t.id === e.target.value);
                  if (t) setForm({ ...form, title: t.subject, body: t.body });
                }}
              >
                <option value="">Choose a saved template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Title
            <input
              required
              maxLength={180}
              disabled={busy}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Audience
            <select
              disabled={busy}
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
            >
              <option value="all">Everyone</option>
              <option value="members">Members</option>
              <option value="staff">Staff</option>
            </select>
          </label>
          <label>
            Message
            <textarea
              required
              rows={6}
              maxLength={12000}
              disabled={busy}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </label>
          {admin && (
            <label>
              <input
                type="checkbox"
                disabled={busy}
                checked={email}
                onChange={(e) => setEmail(e.target.checked)}
              />{" "}
              Also queue email delivery
            </label>
          )}
          <div className="v12Actions">
            <button className="button gradient" disabled={busy}>
              {busy ? "Publishing…" : "Publish announcement"}
            </button>
            {admin && (
              <button
                type="button"
                className="button secondary"
                disabled={busy || !form.title.trim() || !form.body.trim()}
                onClick={saveTemplate}
              >
                Save as template
              </button>
            )}
          </div>
        </form>
      )}
      {admin && (
        <section className="panel">
          <div className="panelhead">
            Email delivery{" "}
            <button className="button secondary" onClick={load}>
              Refresh
            </button>
          </div>
          <p className="empty">
            Queued → accepted by provider → delivered. Acceptance alone does not
            confirm delivery. Transient failures retry automatically for up to
            23 hours.
          </p>
          {campaigns.map((c) => (
            <div className="datarow" key={c.id}>
              <div>
                <b>{c.subject}</b>
                <p className="muted">
                  {new Date(c.created_at).toLocaleString()}
                </p>
              </div>
              <span>
                {counts
                  .filter((n) => n.campaign_id === c.id)
                  .map((n) => `${n.total} ${n.status}`)
                  .join(" · ") || "No recipients"}
              </span>
              <button
                className="button secondary"
                onClick={() => details(c.id)}
              >
                Delivery details
              </button>
            </div>
          ))}
          {!campaigns.length && (
            <p className="empty">No email campaigns yet.</p>
          )}
        </section>
      )}
      {deliveries && (
        <section className="panel v11Form">
          <h2>Recent delivery attempts (up to 100)</h2>
          <button
            className="button secondary"
            onClick={() => setDeliveries(null)}
          >
            Close details
          </button>
          {deliveries.map((d) => (
            <div key={d.id}>
              <b>{d.recipient}</b> — {d.status} · {d.attempts} attempts
              {d.last_error && <p>{d.last_error}</p>}
            </div>
          ))}
        </section>
      )}
      <section className="panel">
        <div className="panelhead">Recent announcements</div>
        {rows.map((r) => (
          <article className="v11Form" key={r.id}>
            <h2>{r.title}</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{r.body}</p>
            <small>
              {r.audience} · {new Date(r.created_at).toLocaleString()}
            </small>
          </article>
        ))}
        {!rows.length && <p className="empty">No announcements yet.</p>}
      </section>
    </>
  );
}
