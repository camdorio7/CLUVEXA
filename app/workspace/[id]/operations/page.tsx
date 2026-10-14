"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useWorkspace } from "../../../../components/WorkspaceShell";
import { createClient } from "../../../../lib/supabase/client";
import { canUseModule } from "../../../../lib/modules";
export default function Operations() {
  const { club, access, userId } = useWorkspace();
  const [rows, setRows] = useState<any[]>([]),
    [title, setTitle] = useState(""),
    [priority, setPriority] = useState("normal"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  async function load() {
    const { data, error } = await createClient()
      .from("operational_tasks")
      .select("*")
      .eq("club_id", club.id)
      .order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    else setRows(data || []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, [club.id]);
  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await createClient()
      .from("operational_tasks")
      .insert({
        club_id: club.id,
        title: title.trim(),
        priority,
        created_by: userId,
      });
    setMessage(error?.message || "Task created.");
    if (!error) {
      setTitle("");
      await load();
    }
    setBusy(false);
  }
  async function done(row: any) {
    setBusy(true);
    const { error } = await createClient()
      .from("operational_tasks")
      .update({ status: row.status === "complete" ? "open" : "complete" })
      .eq("id", row.id)
      .eq("club_id", club.id);
    setMessage(error?.message || "Task updated.");
    if (!error) await load();
    setBusy(false);
  }
  return (
    <>
      <h1>Daily operations</h1>
      {message && (
        <p role="status" className="v11Notice">
          {message}
        </p>
      )}
      {canUseModule(access, "operations", "create") && (
        <form className="panel v11Form" onSubmit={add}>
          <label>
            New task
            <input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
          <button className="button gradient" disabled={busy || !title.trim()}>
            Add task
          </button>
        </form>
      )}
      {loading ? (
        <p role="status">Loading tasks…</p>
      ) : (
        <div className="v11TableWrap">
          <table className="v11Table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.priority}</td>
                  <td>{row.status}</td>
                  <td>
                    {canUseModule(access, "operations", "edit") && (
                      <button disabled={busy} onClick={() => done(row)}>
                        {row.status === "complete" ? "Reopen" : "Complete"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p>No tasks recorded.</p>}
        </div>
      )}
    </>
  );
}
