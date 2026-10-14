"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useWorkspace } from "../../../../components/WorkspaceShell";
import { createClient } from "../../../../lib/supabase/client";
import { canUseModule } from "../../../../lib/modules";
export default function Amenities() {
  const { club, access } = useWorkspace();
  const [rows, setRows] = useState<any[]>([]),
    [name, setName] = useState(""),
    [type, setType] = useState("general"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const { data, error } = await createClient()
      .from("amenities")
      .select("*")
      .eq("club_id", club.id)
      .order("name");
    if (error) setMessage(error.message);
    else setRows(data || []);
  }
  useEffect(() => {
    void load();
  }, [club.id]);
  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await createClient()
      .from("amenities")
      .insert({
        club_id: club.id,
        name: name.trim(),
        amenity_type: type.trim(),
      });
    setMessage(error?.message || "Amenity added.");
    if (!error) {
      setName("");
      await load();
    }
    setBusy(false);
  }
  return (
    <>
      <h1>Amenities</h1>
      <p>Facilities and services at {club.name}.</p>
      {message && <p role="status">{message}</p>}
      {canUseModule(access, "amenities", "create") && (
        <form className="panel v11Form" onSubmit={add}>
          <label>
            Amenity name
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Category
            <input
              required
              maxLength={80}
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
          </label>
          <button className="button gradient" disabled={busy || !name.trim()}>
            Add amenity
          </button>
        </form>
      )}
      <div className="v11Grid">
        {rows.map((r) => (
          <section className="panel" key={r.id}>
            <h2>{r.name}</h2>
            <p>
              {r.amenity_type} · {r.active ? "Active" : "Inactive"}
            </p>
          </section>
        ))}
      </div>
      {!rows.length && <p>No amenities to display.</p>}
    </>
  );
}
