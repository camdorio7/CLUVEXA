"use client";
import { useEffect, useState } from "react";
import { useWorkspace } from "../../../../components/WorkspaceShell";
import { createClient } from "../../../../lib/supabase/client";
import { modules } from "../../../../lib/modules";
export default function Permissions() {
  const { club, access } = useWorkspace();
  const [people, setPeople] = useState<any[]>([]),
    [selected, setSelected] = useState(""),
    [rows, setRows] = useState<any[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    createClient()
      .from("club_users")
      .select("user_id,role,profiles(full_name,email)")
      .eq("club_id", club.id)
      .eq("active", true)
      .in("role", ["staff", "manager"])
      .then(({ data, error }) => {
        if (error) setMessage(error.message);
        else setPeople(data || []);
      });
  }, [club.id]);
  useEffect(() => {
    setRows([]);
    if (!selected) return;
    createClient()
      .from("club_user_permissions")
      .select("*")
      .eq("club_id", club.id)
      .eq("user_id", selected)
      .then(({ data, error }) => {
        if (error) setMessage(error.message);
        else setRows(data || []);
      });
  }, [selected, club.id]);
  async function toggle(key: string, field: string) {
    setBusy(true);
    setMessage("");
    const row = rows.find((r) => r.module_key === key) || {
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
    };
    const patch = {
      can_view: row.can_view,
      can_create: row.can_create,
      can_edit: row.can_edit,
      can_delete: row.can_delete,
      [field]: !row[field],
    };
    if (field === "can_view" && row.can_view)
      Object.assign(patch, {
        can_create: false,
        can_edit: false,
        can_delete: false,
      });
    const { data, error } = await createClient()
      .from("club_user_permissions")
      .upsert(
        { club_id: club.id, user_id: selected, module_key: key, ...patch },
        { onConflict: "club_id,user_id,module_key" },
      )
      .select()
      .single();
    if (error) setMessage(error.message);
    else {
      setRows((old) => [...old.filter((r) => r.module_key !== key), data]);
      setMessage("Permission saved. Changes apply on the next page request.");
    }
    setBusy(false);
  }
  return (
    <>
      <h1>Staff permissions</h1>
      <p>
        Managers and staff receive only explicit module permissions. Owners and
        administrators manage access.
      </p>
      <label>
        Team member
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Choose a team member</option>
          {people.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.profiles?.full_name || p.profiles?.email || p.user_id} ·{" "}
              {p.role}
            </option>
          ))}
        </select>
      </label>
      {message && <p role="status">{message}</p>}
      {selected && (
        <div className="v11TableWrap">
          <table className="v11Table">
            <thead>
              <tr>
                <th>Module</th>
                <th>View</th>
                <th>Create</th>
                <th>Edit</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {modules
                .filter(
                  (m) =>
                    m.available &&
                    !m.adminOnly &&
                    access.modules.some(
                      (l) => l.module_key === m.key && l.licensed,
                    ),
                )
                .map((m) => {
                  const row = rows.find((r) => r.module_key === m.key);
                  return (
                    <tr key={m.key}>
                      <th>{m.name}</th>
                      {["can_view", "can_create", "can_edit", "can_delete"].map(
                        (field) => (
                          <td key={field}>
                            <input
                              aria-label={`${m.name}: ${field.replace("can_", "")}`}
                              type="checkbox"
                              checked={!!row?.[field]}
                              disabled={
                                busy || (field !== "can_view" && !row?.can_view)
                              }
                              onChange={() => toggle(m.key, field)}
                            />
                          </td>
                        ),
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
