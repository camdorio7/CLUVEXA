"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useWorkspace } from "../../../../components/WorkspaceShell";
import { createClient } from "../../../../lib/supabase/client";
import { canUseModule } from "../../../../lib/modules";
const empty = {
  title: "",
  description: "",
  starts_at: "",
  location: "",
  capacity: "",
  registration_deadline: "",
  status: "published",
};
export default function Events() {
  const { club, access, userId } = useWorkspace();
  const [rows, setRows] = useState<any[]>([]),
    [regs, setRegs] = useState<any[]>([]),
    [counts, setCounts] = useState<any[]>([]),
    [form, setForm] = useState(empty),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const create = canUseModule(access, "events", "create"),
    edit = canUseModule(access, "events", "edit");
  async function load() {
    try {
      const sb = createClient();
      const [events, registrations, totals] = await Promise.all([
        sb
          .from("club_events")
          .select("*")
          .eq("club_id", club.id)
          .order("starts_at"),
        sb.from("event_registrations").select("*").eq("club_id", club.id),
        sb.rpc("v11_event_counts", { target_club: club.id }),
      ]);
      if (events.error || registrations.error || totals.error)
        throw events.error || registrations.error || totals.error;
      setRows(events.data || []);
      setRegs(registrations.data || []);
      setCounts(totals.data || []);
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [club.id]);
  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (
        form.capacity &&
        (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1)
      )
        throw Error("Capacity must be a positive whole number.");
      const { error } = await createClient()
        .from("club_events")
        .insert({
          ...form,
          club_id: club.id,
          created_by: userId,
          starts_at: new Date(form.starts_at).toISOString(),
          registration_deadline: form.registration_deadline
            ? new Date(form.registration_deadline).toISOString()
            : null,
          capacity: form.capacity ? Number(form.capacity) : null,
        });
      if (error) throw error;
      setForm(empty);
      setMessage("Event saved.");
      await load();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function register(id: string, cancel = false) {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient().rpc("v11_register_event", {
        target_event: id,
        cancel,
      });
      if (error) throw error;
      setMessage(
        cancel ? "Registration cancelled." : "Registration confirmed.",
      );
      await load();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function status(row: any, value: string) {
    setBusy(true);
    const { error } = await createClient()
      .from("club_events")
      .update({ status: value })
      .eq("id", row.id)
      .eq("club_id", club.id);
    setMessage(error?.message || "Event status saved.");
    if (!error) await load();
    setBusy(false);
  }
  return (
    <>
      <h1>Events</h1>
      <p>
        Organization events and registrations. Event times use your browser's
        local timezone when entered.
      </p>
      {message && (
        <p role="status" className="v11Notice">
          {message}
        </p>
      )}
      {create && (
        <form className="panel v11Form" onSubmit={add}>
          <h2>Create event</h2>
          <label>
            Event title
            <input
              required
              maxLength={160}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Start date and time
            <input
              required
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            />
          </label>
          <label>
            Location
            <input
              value={form.location}
              maxLength={200}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </label>
          <label>
            Capacity (blank means unlimited)
            <input
              type="number"
              min="1"
              step="1"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </label>
          <label>
            Registration deadline
            <input
              type="datetime-local"
              value={form.registration_deadline}
              onChange={(e) =>
                setForm({ ...form, registration_deadline: e.target.value })
              }
            />
          </label>
          <label>
            Description
            <textarea
              maxLength={5000}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label>
            Publish status
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
          <button className="button gradient" disabled={busy}>
            Save event
          </button>
        </form>
      )}
      {loading && <p role="status">Loading events…</p>}
      <div className="v11Grid">
        {rows.map((row) => {
          const count = Number(
            counts.find((c) => c.event_id === row.id)?.registered || 0,
          );
          const mine = regs.find(
            (r) =>
              r.event_id === row.id &&
              r.user_id === userId &&
              r.status === "registered",
          );
          const closed =
            row.status !== "published" ||
            new Date(row.starts_at).getTime() <= Date.now() ||
            (row.registration_deadline &&
              new Date(row.registration_deadline).getTime() <= Date.now());
          const full = row.capacity !== null && count >= row.capacity;
          return (
            <section className="panel" key={row.id}>
              <h2>{row.title}</h2>
              <p>
                {new Date(row.starts_at).toLocaleString()} · {row.location}
              </p>
              <p>{row.description}</p>
              <p>
                {count}
                {row.capacity !== null ? ` / ${row.capacity}` : ""} registered ·{" "}
                {row.status}
              </p>
              {access.role === "member" &&
                (mine ? (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => register(row.id, true)}
                  >
                    Cancel my registration
                  </button>
                ) : (
                  <button
                    className="button gradient"
                    disabled={busy || !!closed || full}
                    onClick={() => register(row.id)}
                  >
                    {closed
                      ? "Registration closed"
                      : full
                        ? "Event full"
                        : "Register"}
                  </button>
                ))}
              {edit && (
                <label>
                  Event status
                  <select
                    value={row.status}
                    disabled={busy}
                    onChange={(e) => status(row, e.target.value)}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              )}
              {access.role !== "member" && (
                <details>
                  <summary>View registrations</summary>
                  {regs
                    .filter((r) => r.event_id === row.id)
                    .map((r) => (
                      <p key={r.id}>
                        {r.attendee_name} · {r.status}
                      </p>
                    ))}
                </details>
              )}
            </section>
          );
        })}
      </div>
      {!loading && !rows.length && <p>No events are available.</p>}
    </>
  );
}
