"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import WorkspaceHeader from "../../../../components/WorkspaceHeader";
import { useWorkspace } from "../../../../components/WorkspaceShell";
import { canUseModule } from "../../../../lib/modules";
import { createClient } from "../../../../lib/supabase/client";
import { parseMemberCsv } from "../../../../lib/member-csv";
const blank = {
  full_name: "",
  email: "",
  phone: "",
  member_number: "",
  membership_type_id: "",
  status: "active",
  good_standing: true,
};
export default function Members() {
  const { club, access } = useWorkspace();
  const [rows, setRows] = useState<any[]>([]),
    [types, setTypes] = useState<any[]>([]),
    [form, setForm] = useState(blank),
    [editing, setEditing] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(0),
    [count, setCount] = useState(0),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [history, setHistory] = useState<any[] | null>(null),
    [csv, setCsv] = useState<Record<string, string>[]>([]),
    [validation, setValidation] = useState<any>(null);
  const create = canUseModule(access, "members", "create"),
    edit = canUseModule(access, "members", "edit");
  useEffect(() => {
    let live = true;
    createClient()
      .from("membership_types")
      .select("id,name")
      .eq("club_id", club.id)
      .eq("active", true)
      .then(({ data, error }) => {
        if (live) {
          if (error) setMessage(error.message);
          else setTypes(data || []);
        }
      });
    return () => {
      live = false;
    };
  }, [club.id]);
  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        let q = createClient()
          .from("members")
          .select(
            "id,full_name,email,phone,member_number,membership_type_id,status,good_standing,membership_types(name)",
            { count: "exact" },
          )
          .eq("club_id", club.id)
          .order("full_name")
          .order("id")
          .range(page * 50, page * 50 + 49)
          .abortSignal(controller.signal);
        if (query.trim())
          q = q.ilike(
            "full_name",
            `%${query.trim().replace(/[\\%_]/g, "\\$&")}%`,
          );
        if (filter !== "all") q = q.eq("status", filter);
        const { data, error, count } = await q;
        if (error) throw error;
        if (live) {
          setRows(data || []);
          setCount(count || 0);
        }
      } catch (e: any) {
        if (live) setMessage(e.message);
      } finally {
        if (live) setLoading(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [club.id, page, query, filter, revision]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        ...form,
        club_id: club.id,
        membership_type_id: form.membership_type_id || null,
      };
      const sb = createClient();
      const result = editing
        ? await sb
            .from("members")
            .update(payload)
            .eq("club_id", club.id)
            .eq("id", editing)
            .select("id")
            .single()
        : await sb.from("members").insert(payload).select("id").single();
      if (result.error) throw result.error;
      setMessage(
        "Member saved. Manage login access separately in People & roles.",
      );
      setEditing("");
      setForm(blank);
      setRevision((v) => v + 1);
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function showHistory(id: string) {
    const { data, error } = await createClient()
      .from("member_history")
      .select("id,action,changes,created_at")
      .eq("club_id", club.id)
      .eq("member_id", id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) setMessage(error.message);
    else setHistory(data || []);
  }
  async function importRows(dry: boolean) {
    setBusy(true);
    try {
      const { data, error } = await createClient().rpc("v12_import_members", {
        target_club: club.id,
        rows_json: csv,
        default_type: form.membership_type_id || null,
        dry_run: dry,
      });
      if (error) throw error;
      setValidation(data);
      if (!dry && data.valid) {
        setCsv([]);
        setMessage(
          `${data.imported} members imported. Login invitations are managed in People & roles.`,
        );
        setRevision((v) => v + 1);
      }
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <WorkspaceHeader
        title="Members"
        subtitle="Search, update, and import your organization’s member records"
      />
      {message && (
        <p role="status" className="v11Notice">
          {message}
        </p>
      )}
      {(create || editing) && (
        <form className="panel v11Form" onSubmit={save}>
          <h2>{editing ? "Edit member" : "Add member"}</h2>
          <div className="v11Grid">
            {(["full_name", "email", "phone", "member_number"] as const).map(
              (key) => (
                <label key={key}>
                  {
                    {
                      full_name: "Full name",
                      email: "Email",
                      phone: "Phone",
                      member_number: "Member number",
                    }[key]
                  }
                  <input
                    required={key === "full_name"}
                    type={key === "email" ? "email" : "text"}
                    maxLength={key === "full_name" ? 160 : 254}
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </label>
              ),
            )}
            <label>
              Membership level
              <select
                value={form.membership_type_id}
                onChange={(e) => {
                  setForm({ ...form, membership_type_id: e.target.value });
                  setValidation(null);
                }}
              >
                <option value="">Unassigned</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Membership status
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
          </div>
          <label>
            <input
              type="checkbox"
              checked={form.good_standing}
              onChange={(e) =>
                setForm({ ...form, good_standing: e.target.checked })
              }
            />{" "}
            In good standing
          </label>
          <p className="muted">
            Membership status controls eligibility. Disable a person’s portal
            access in{" "}
            <Link href={`/workspace/${club.id}/team-access`}>
              People & roles
            </Link>
            .
          </p>
          <div className="v12Actions">
            <button className="button gradient" disabled={busy}>
              {editing ? "Save changes" : "Add member"}
            </button>
            {editing && (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setEditing("");
                  setForm(blank);
                }}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      )}
      {create && (
        <details className="panel v11Form">
          <summary>Import members from CSV</summary>
          <p>
            Up to 500 rows. Headers: full_name, email, phone, member_number. The
            selected membership level above applies to this import. Every row is
            checked before any records are added.
          </p>
          <a
            download="nadorio-members.csv"
            href="data:text/csv;charset=utf-8,full_name%2Cemail%2Cphone%2Cmember_number%0A"
          >
            Download blank template
          </a>
          <input
            type="file"
            aria-label="Member CSV"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={async (e) => {
              setValidation(null);
              setCsv([]);
              try {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 1024 * 1024)
                    throw Error("CSV must be smaller than 1 MB.");
                  setCsv(parseMemberCsv(await file.text()));
                }
              } catch (e: any) {
                setMessage(e.message);
              }
            }}
          />
          {csv.length > 0 && (
            <>
              <p>
                {csv.length} rows selected. Preview:{" "}
                {csv
                  .slice(0, 3)
                  .map((r) => r.full_name)
                  .join(", ")}
              </p>
              <div className="v12Actions">
                <button
                  disabled={busy}
                  className="button secondary"
                  onClick={() => importRows(true)}
                >
                  Validate import
                </button>
                <button
                  disabled={busy || !validation?.valid}
                  className="button gradient"
                  onClick={() => importRows(false)}
                >
                  Import {csv.length} members
                </button>
              </div>
            </>
          )}
          {validation && (
            <div role="status">
              {validation.valid ? (
                "All rows passed validation."
              ) : (
                <ul>
                  {validation.errors.map((e: any, i: number) => (
                    <li key={i}>
                      Data row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </details>
      )}
      <section className="panel">
        <div className="panelhead">Member directory · {count}</div>
        <div className="inlineForm">
          <input
            aria-label="Search members by name"
            placeholder="Search by name"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
          <select
            aria-label="Filter membership status"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        {loading ? (
          <p className="empty" role="status">
            Loading members…
          </p>
        ) : (
          rows.map((r) => (
            <div className="datarow" key={r.id}>
              <div>
                <b>{r.full_name}</b>
                <div className="muted">
                  {r.email || "No email"} · {r.member_number || "No number"}
                </div>
              </div>
              <span>{r.membership_types?.name || "Unassigned"}</span>
              <span className="chip">{r.status}</span>
              <div className="v12Actions">
                {edit && (
                  <button
                    className="button secondary"
                    onClick={() => {
                      setEditing(r.id);
                      setForm({
                        ...blank,
                        ...Object.fromEntries(
                          Object.keys(blank).map((k) => [
                            k,
                            r[k] ?? blank[k as keyof typeof blank],
                          ]),
                        ),
                      });
                    }}
                  >
                    Edit
                  </button>
                )}
                <button
                  className="button secondary"
                  onClick={() => showHistory(r.id)}
                >
                  History
                </button>
              </div>
            </div>
          ))
        )}
        {!loading && !rows.length && (
          <p className="empty">No matching members.</p>
        )}
        <div className="inlineForm">
          <button
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {Math.max(1, Math.ceil(count / 50))}
          </span>
          <button
            disabled={(page + 1) * 50 >= count || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </section>
      {history && (
        <section className="panel v11Form" aria-label="Member history">
          <h2>Member history</h2>
          <button className="button secondary" onClick={() => setHistory(null)}>
            Close history
          </button>
          {history.map((h) => (
            <div key={h.id}>
              <b>
                {h.action} · {new Date(h.created_at).toLocaleString()}
              </b>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {JSON.stringify(h.changes, null, 2)}
              </pre>
            </div>
          ))}
          {!history.length && <p>No changes recorded since the v12 upgrade.</p>}
        </section>
      )}
    </>
  );
}
