"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useWorkspace } from "../../../../components/WorkspaceShell";
import { createClient } from "../../../../lib/supabase/client";
import { canUseModule } from "../../../../lib/modules";
import EventAttendance from "../../../../components/EventAttendance";
import { downloadCalendar } from "../../../../lib/calendar";
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
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(""),
    [page, setPage] = useState(0),
    [future, setFuture] = useState(true);
  const create = canUseModule(access, "events", "create"),
    edit = canUseModule(access, "events", "edit");
  async function load() {
    try {
      const sb = createClient();
      let query = sb
        .from("club_events")
        .select("*")
        .eq("club_id", club.id)
        .order("starts_at", { ascending: future })
        .order("id")
        .range(page * 25, page * 25 + 24);
      query = future
        ? query.gte("starts_at", new Date().toISOString())
        : query.lt("starts_at", new Date().toISOString());
      const events = await query;
      if (events.error) throw events.error;
      const ids = (events.data || []).map((e) => e.id);
      const [registrations, totals] = await Promise.all([
        ids.length
          ? sb
              .from("event_registrations")
              .select("id,event_id,user_id,status")
              .eq("club_id", club.id)
              .in("event_id", ids)
              .eq("user_id", userId)
              .limit(1000)
          : Promise.resolve({ data: [], error: null }),
        sb.rpc("v12_event_counts", { target_club: club.id, event_ids: ids }),
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
  }, [club.id, page, future]);
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
      const payload = {
        ...form,
        starts_at: new Date(form.starts_at).toISOString(),
        registration_deadline: form.registration_deadline
          ? new Date(form.registration_deadline).toISOString()
          : null,
        capacity: form.capacity ? Number(form.capacity) : null,
      };
      const query = createClient().from("club_events");
      const { error } = editing
        ? await query
            .update(payload)
            .eq("id", editing)
            .eq("club_id", club.id)
            .select("id")
            .single()
        : await query.insert({
            ...payload,
            club_id: club.id,
            created_by: userId,
          });
      if (error) throw error;
      setForm(empty);
      setEditing("");
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
      const { data, error } = await createClient().rpc("v12_register_event", {
        target_event: id,
        cancel,
      });
      if (error) throw error;
      setMessage(
        cancel
          ? "Registration cancelled."
          : data.status === "waitlisted"
            ? "You joined the waitlist. We will confirm when a seat opens."
            : "Registration confirmed.",
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
      {(create || editing) && (
        <form className="panel v11Form" onSubmit={add}>
          <h2>{editing ? "Edit event" : "Create event"}</h2>
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
          {editing && (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setEditing("");
                setForm(empty);
              }}
            >
              Cancel edit
            </button>
          )}
        </form>
      )}
      <div className="v12Actions">
        <label>
          Show{" "}
          <select
            value={future ? "upcoming" : "past"}
            onChange={(e) => {
              setFuture(e.target.value === "upcoming");
              setPage(0);
            }}
          >
            <option value="upcoming">Upcoming events</option>
            <option value="past">Past events</option>
          </select>
        </label>
        <button disabled={!page || busy} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          disabled={rows.length < 25 || busy}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
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
              ["registered", "waitlisted"].includes(r.status),
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
              <button
                className="button secondary"
                onClick={() => downloadCalendar(row)}
              >
                Add to calendar
              </button>
              {mine?.status === "waitlisted" && (
                <p className="chip">You are on the waitlist</p>
              )}
              {edit && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    const local = (s: string) => {
                      if (!s) return "";
                      const d = new Date(s);
                      return new Date(
                        d.getTime() - d.getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16);
                    };
                    setEditing(row.id);
                    setForm({
                      ...empty,
                      ...row,
                      capacity: row.capacity?.toString() || "",
                      starts_at: local(row.starts_at),
                      registration_deadline: local(row.registration_deadline),
                    });
                  }}
                >
                  Edit event
                </button>
              )}
              <p>
                {new Date(row.starts_at).toLocaleString()} · {row.location}
              </p>
              <p>{row.description}</p>
              {edit && <EventAttendance clubId={club.id} eventId={row.id} />}
              <p>
                {count}
                {row.capacity !== null ? ` / ${row.capacity}` : ""} registered ·{" "}
                {row.status} ·{" "}
                {Number(
                  counts.find((c) => c.event_id === row.id)?.waiting || 0,
                )}{" "}
                waiting
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
                    disabled={busy || !!closed}
                    onClick={() => register(row.id)}
                  >
                    {closed
                      ? "Registration closed"
                      : full
                        ? "Join waitlist"
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
