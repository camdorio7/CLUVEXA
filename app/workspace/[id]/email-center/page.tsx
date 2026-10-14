"use client";
import { useEffect, useState } from "react";
import { useWorkspace } from "../../../../components/WorkspaceShell";
import { createClient } from "../../../../lib/supabase/client";
export default function EmailCenter() {
  const { club } = useWorkspace();
  const [messages, setMessages] = useState<any[]>([]),
    [filter, setFilter] = useState("new"),
    [page, setPage] = useState(0),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    (async () => {
      try {
        let q = createClient()
          .from("organization_site_messages")
          .select("id,sender_name,sender_email,message,created_at,status")
          .eq("club_id", club.id)
          .order("created_at", { ascending: false })
          .order("id")
          .range(page * 25, page * 25 + 24);
        if (filter !== "all") q = q.eq("status", filter);
        const { data, error } = await q;
        if (error) throw error;
        if (live) setMessages(data || []);
      } catch (e: any) {
        if (live) setError(e.message);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [club.id, page, filter, revision]);
  async function status(id: string, value: string) {
    setBusy(true);
    try {
      const { error } = await createClient().rpc("v12_message_status", {
        message_id: id,
        status_value: value,
      });
      if (error) throw error;
      setRevision((v) => v + 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Email Center</h1>
      <p>
        Website inquiries received by your organization. Replies open your email
        application; mark an inquiry resolved once you have handled it.
      </p>
      {error && (
        <p role="alert" className="v11Notice">
          {error}
        </p>
      )}
      <div className="v12Actions">
        <label>
          Inbox status{" "}
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="new">New</option>
            <option value="read">Read</option>
            <option value="resolved">Resolved</option>
            <option value="all">All inquiries</option>
          </select>
        </label>
        <button
          className="button secondary"
          onClick={() => setRevision((v) => v + 1)}
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <p role="status">Loading inbox…</p>
      ) : (
        messages.map((m) => (
          <section className="panel v11Form" key={m.id}>
            <div className="v12Actions">
              <strong>{m.sender_name}</strong>
              <span className="chip">{m.status}</span>
              <small>{new Date(m.created_at).toLocaleString()}</small>
            </div>
            <p>{m.sender_email}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{m.message}</p>
            <div className="v12Actions">
              <a
                className="button secondary"
                href={`mailto:${encodeURIComponent(m.sender_email)}?subject=Re%3A%20Website%20inquiry`}
              >
                Reply in email
              </a>
              <label>
                Mark as{" "}
                <select
                  disabled={busy}
                  value={m.status}
                  onChange={(e) => status(m.id, e.target.value)}
                >
                  <option value="new">New</option>
                  <option value="read">Read</option>
                  <option value="resolved">Resolved</option>
                </select>
              </label>
            </div>
          </section>
        ))
      )}
      {!loading && !messages.length && <p>No inquiries in this view.</p>}
      <div className="v12Actions">
        <button
          disabled={page === 0 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          disabled={messages.length < 25 || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
