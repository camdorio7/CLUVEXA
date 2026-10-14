"use client";
import { ChangeEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import WorkspaceHeader from "../../../../components/WorkspaceHeader";
import { createClient } from "../../../../lib/supabase/client";
import { useWorkspace } from "../../../../components/WorkspaceShell";
import { organizationTypes } from "../../../../lib/organization-types";
import { modules as definitions } from "../../../../lib/modules";
import { organizationTheme } from "../../../../lib/organization-theme";

type Module = {
  module_key: string;
  licensed: boolean;
  club_enabled: boolean;
  member_visible?: boolean;
  sort_order?: number;
  module_catalog?: { name: string; description: string } | null;
};
export default function OrganizationSettings() {
  const { refresh } = useWorkspace();
  const { id } = useParams<{ id: string }>();
  const [club, setClub] = useState<any>(null),
    [mods, setMods] = useState<Module[]>([]),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const sb = createClient();
    const [
      { data: c, error: ce },
      { data: m, error: me },
      { data: catalog, error: catalogError },
    ] = await Promise.all([
      sb.from("clubs").select("*").eq("id", id).single(),
      sb
        .from("club_modules")
        .select("*")
        .eq("club_id", id)
        .eq("licensed", true)
        .order("sort_order"),
      sb.from("module_catalog").select("module_key,name,description"),
    ]);
    if (ce || me) {
      setMsg(ce?.message || me?.message || "Could not load settings");
      return;
    }
    const catalogByKey = new Map(
      (catalog || []).map((entry: any) => [entry.module_key, entry]),
    );
    setClub(c);
    setMods(
      (m || []).map((entry: any) => ({
        ...entry,
        module_catalog: catalogByKey.get(entry.module_key) || null,
      })) as Module[],
    );
    setMsg(
      catalogError ? "Module descriptions are temporarily unavailable." : "",
    );
  }
  useEffect(() => {
    void load();
  }, [id]);
  async function save() {
    if (!club) return;
    setBusy(true);
    setMsg("");
    const { error } = await createClient()
      .from("clubs")
      .update({
        name: club.name,
        contact_email: club.contact_email,
        website_url: club.website_url,
        primary_color: club.primary_color,
        portal_title: club.portal_title,
        welcome_message: club.welcome_message,
        organization_type: club.organization_type,
        checkin_activities: club.checkin_activities,
      })
      .eq("id", id);
    setBusy(false);
    setMsg(error ? error.message : "Organization settings saved.");
    if (!error) refresh();
  }
  async function logo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setMsg("Choose an image smaller than 5 MB.");
      return;
    }
    setBusy(true);
    const sb = createClient();
    const path = `${id}/logo-${Date.now()}.${file.name.split(".").pop() || "png"}`;
    const { error } = await sb.storage.from("club-branding").upload(path, file);
    if (error) {
      setMsg(error.message);
      setBusy(false);
      return;
    }
    const { data } = sb.storage.from("club-branding").getPublicUrl(path);
    const result = await sb
      .from("clubs")
      .update({ logo_url: data.publicUrl })
      .eq("id", id);
    setMsg(result.error?.message || "Logo uploaded.");
    setBusy(false);
    await load();
  }
  async function toggle(m: Module, field: "club_enabled" | "member_visible") {
    setBusy(true);
    setMsg("");
    const value =
      field === "club_enabled" ? !m.club_enabled : !m.member_visible;
    const patch =
      field === "club_enabled"
        ? { club_enabled: value, enabled: value }
        : { member_visible: value };
    const { error } = await createClient()
      .from("club_modules")
      .update(patch)
      .eq("club_id", id)
      .eq("module_key", m.module_key)
      .eq("licensed", true);
    if (error) {
      setMsg(error.message);
    } else {
      await load();
      setMsg("Module settings updated.");
      refresh();
    }
    setBusy(false);
  }
  if (!club)
    return (
      <div className="loading">{msg || "Loading organization settings…"}</div>
    );
  const theme = organizationTheme(club.primary_color);
  return (
    <>
      <WorkspaceHeader
        title="Organization Settings"
        subtitle="One brand color, automatic portal styling, and licensed features"
      />
      <div className="settingsGrid">
        <section className="panel nomargin">
          <div className="panelhead">Brand & appearance</div>
          <div className="settingsBody">
            <div className="brandEditor">
              {club.logo_url && (
                <img
                  className="joinLogo"
                  src={club.logo_url}
                  alt="Organization logo"
                />
              )}
              <label className="button secondary fileButton">
                Upload logo
                <input
                  type="file"
                  accept="image/*"
                  onChange={logo}
                  disabled={busy}
                />
              </label>
            </div>
            <div className="field">
              <label>Organization name</label>
              <input
                value={club.name || ""}
                onChange={(e) => setClub({ ...club, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Organization type</label>
              <select
                value={club.organization_type || "other"}
                onChange={(e) =>
                  setClub({ ...club, organization_type: e.target.value })
                }
              >
                {Object.entries(organizationTypes).map(([key, type]) => (
                  <option value={key} key={key}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Check-in activities (one per line)</label>
              <textarea
                value={(club.checkin_activities || ["General"]).join("\n")}
                onChange={(e) =>
                  setClub({
                    ...club,
                    checkin_activities: e.target.value.split("\n").slice(0, 30),
                  })
                }
              />
            </div>
            <div className="field">
              <label>Portal heading</label>
              <input
                value={club.portal_title || ""}
                onChange={(e) =>
                  setClub({ ...club, portal_title: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>Welcome message</label>
              <textarea
                value={club.welcome_message || ""}
                onChange={(e) =>
                  setClub({ ...club, welcome_message: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>Primary brand color</label>
              <input
                aria-label="Primary brand color"
                type="color"
                value={
                  /^#[0-9a-fA-F]{6}$/.test(club.primary_color || "")
                    ? club.primary_color
                    : "#275e72"
                }
                onChange={(e) =>
                  setClub({ ...club, primary_color: e.target.value })
                }
              />
              <small>All supporting colors are generated automatically.</small>
            </div>
            <div
              style={{
                padding: 16,
                background: theme["--club-bg"],
                borderRadius: 12,
                color: theme["--club-text"],
              }}
            >
              <strong>Live theme preview</strong>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 12,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    background: theme["--club-primary"],
                    color: theme["--club-on-primary"],
                    padding: "10px 16px",
                    borderRadius: 8,
                  }}
                >
                  Primary action
                </span>
                <span
                  style={{
                    background: theme["--club-primary-soft"],
                    padding: "10px 16px",
                    borderRadius: 8,
                  }}
                >
                  Secondary surface
                </span>
              </div>
            </div>
            <button className="button gradient" onClick={save} disabled={busy}>
              Save appearance
            </button>
          </div>
        </section>
        <section className="panel nomargin">
          <div className="panelhead">Licensed modules</div>
          <div className="settingsBody">
            <p className="muted">
              CD7 Technologies licenses modules. You decide which licensed
              features are active and visible to members. Changes are reflected
              in portal navigation.
            </p>
            {mods.length === 0 && (
              <p>No modules are licensed yet. Contact CD7 Technologies.</p>
            )}
            {mods.map((m) => (
              <div className="moduleToggle" key={m.module_key}>
                <div>
                  <b>{m.module_catalog?.name || m.module_key}</b>
                  <small>{m.module_catalog?.description}</small>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !definitions.find((d) => d.key === m.module_key)
                        ?.available
                    }
                    aria-pressed={!!m.club_enabled}
                    className={"toggle " + (m.club_enabled ? "on" : "")}
                    onClick={() => toggle(m, "club_enabled")}
                  >
                    {m.club_enabled ? "Active" : "Inactive"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !m.club_enabled ||
                      !definitions.find((d) => d.key === m.module_key)?.member
                    }
                    aria-pressed={!!m.member_visible}
                    className={
                      "toggle " +
                      (m.member_visible && m.club_enabled ? "on" : "")
                    }
                    onClick={() => toggle(m, "member_visible")}
                  >
                    {m.member_visible ? "Members: On" : "Members: Off"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      {msg && (
        <p role="status" className="successMsg">
          {msg}
        </p>
      )}
    </>
  );
}
