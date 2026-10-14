"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
import { modules } from "../../../lib/modules";
import { organizationTypes } from "../../../lib/organization-types";
export default function Catalog() {
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    createClient()
      .from("module_catalog")
      .select("*")
      .order("sort_order")
      .then(({ data, error }) => {
        setRows(data || []);
        setError(error?.message || "");
        setLoading(false);
      });
  }, []);
  function edit(key: string, patch: any) {
    setRows((old) =>
      old.map((r) => (r.module_key === key ? { ...r, ...patch } : r)),
    );
  }
  async function save(row: any) {
    setBusy(row.module_key);
    setError("");
    const { error } = await createClient()
      .from("module_catalog")
      .update({
        name: row.name,
        description: row.description,
        available: row.available,
        compatible_types: row.compatible_types,
      })
      .eq("module_key", row.module_key);
    setError(
      error?.message ||
        "Catalog saved. Existing licenses are retained; unavailable modules cannot be opened.",
    );
    setBusy("");
  }
  return (
    <>
      <h1>Module catalog</h1>
      <p>
        Database-backed availability and descriptions. Compatibility labels
        guide onboarding; they do not restrict an organization's customization.
      </p>
      <p>
        <Link href="/module-licensing">
          License modules to an organization →
        </Link>
      </p>
      {error && (
        <p role="status" className="v11Notice">
          {error}
        </p>
      )}
      {loading && <p role="status">Loading catalog…</p>}
      <div className="v11Grid">
        {rows.map((row) => {
          const supported =
            modules.find((m) => m.key === row.module_key)?.available === true;
          return (
            <form
              className="panel v11Form"
              key={row.module_key}
              onSubmit={(e) => {
                e.preventDefault();
                void save(row);
              }}
            >
              <small>{row.module_key}</small>
              <label>
                Display name
                <input
                  required
                  maxLength={100}
                  value={row.name}
                  onChange={(e) =>
                    edit(row.module_key, { name: e.target.value })
                  }
                />
              </label>
              <label>
                Description
                <textarea
                  maxLength={1000}
                  value={row.description || ""}
                  onChange={(e) =>
                    edit(row.module_key, { description: e.target.value })
                  }
                />
              </label>
              <label>
                Recommended organization types
                <select
                  multiple
                  value={row.compatible_types || []}
                  onChange={(e) =>
                    edit(row.module_key, {
                      compatible_types: Array.from(
                        e.target.selectedOptions,
                        (o) => o.value,
                      ),
                    })
                  }
                >
                  {Object.entries(organizationTypes).map(([key, t]) => (
                    <option key={key} value={key}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <small>No selection means universal.</small>
              </label>
              {supported ? (
                <label>
                  <span>
                    <input
                      type="checkbox"
                      checked={row.available}
                      onChange={(e) =>
                        edit(row.module_key, { available: e.target.checked })
                      }
                    />{" "}
                    Available
                  </span>
                </label>
              ) : (
                <p>
                  Unavailable in v11: implementation or database support is
                  incomplete.
                </p>
              )}
              <button
                className="button gradient"
                disabled={!!busy || !supported}
              >
                {busy === row.module_key ? "Saving…" : "Save module"}
              </button>
            </form>
          );
        })}
      </div>
    </>
  );
}
