"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Shell from "../../../../components/Shell";
import ClubHeader from "../../../../components/ClubHeader";
import { modules as definitions } from "../../../../lib/modules";
import { createClient } from "../../../../lib/supabase/client";
export default function Modules() {
  const { id } = useParams<{ id: string }>();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    const sb = createClient();
    const { data: catalog, error: catalogError } = await sb
      .from("module_catalog")
      .select("*")
      .order("sort_order");
    const { data: mods, error: moduleError } = await sb
      .from("club_modules")
      .select("*")
      .eq("club_id", id);
    if (catalogError || moduleError) {
      setMessage(
        catalogError?.message ||
          moduleError?.message ||
          "Could not load modules",
      );
      return;
    }
    setRows(
      (catalog || []).map((m) => ({
        ...m,
        ...(mods || []).find((x) => x.module_key === m.module_key),
      })),
    );
  }
  useEffect(() => {
    load();
  }, [id]);
  async function setLicensed(r: any, value: boolean) {
    setBusy(r.module_key);
    setMessage("");
    const sb = createClient();
    const { error } = await sb
      .from("club_modules")
      .upsert(
        {
          club_id: id,
          module_key: r.module_key,
          enabled: value ? !!r.club_enabled : false,
          licensed: value,
          club_enabled: value ? !!r.club_enabled : false,
          member_visible: value ? !!r.member_visible : false,
          licensed_at: value ? new Date().toISOString() : null,
          sort_order: r.sort_order,
        },
        { onConflict: "club_id,module_key" },
      );
    if (error) {
      setMessage(error.message);
    } else {
      await load();
    }
    setBusy("");
  }
  return (
    <Shell>
      <ClubHeader id={id} />
      <div className="top">
        <div>
          <div className="eyebrow cyan">PLATFORM OWNER CONTROL</div>
          <h1>Modules & Licensing</h1>
          <p className="muted">
            You decide which capabilities this organization is allowed to use.
            New licenses remain inactive until an organization administrator
            activates them. Revoking a license also disables member visibility.
          </p>
        </div>
      </div>
      {message && <p role="alert">{message}</p>}
      <div className="moduleList">
        <div className="moduleHeader">
          <span>Module</span>
          <span>Licensed by CD7</span>
          <span>Club enabled</span>
        </div>
        {rows.map((r) => (
          <div className="moduleRow" key={r.module_key}>
            <div>
              <b>{r.name}</b>
              <p>{r.description}</p>
            </div>
            <button
              aria-label={`${r.licensed ? "Revoke" : "Grant"} ${r.name} license`}
              aria-pressed={!!r.licensed}
              disabled={
                busy === r.module_key ||
                (!r.licensed &&
                  (!r.available ||
                    !definitions.find((m) => m.key === r.module_key)
                      ?.available))
              }
              className={"licenseSwitch " + (r.licensed ? "on" : "")}
              onClick={() => setLicensed(r, !r.licensed)}
            >
              <i />
            </button>
            <span
              className={"chip " + (r.club_enabled && r.licensed ? "good" : "")}
            >
              {r.licensed
                ? r.club_enabled
                  ? "Enabled"
                  : "Available to club"
                : "Locked"}
            </span>
          </div>
        ))}
      </div>
    </Shell>
  );
}
