"use client";
import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { useParams } from "next/navigation";
import Shell from "../../../../components/Shell";
import ClubHeader from "../../../../components/ClubHeader";
import { createClient } from "../../../../lib/supabase/client";
import { organizationTypes } from "../../../../lib/organization-types";
export default function Settings() {
  const { id } = useParams<{ id: string }>();
  const [club, setClub] = useState<any>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const { data, error } = await createClient()
      .from("clubs")
      .select("*")
      .eq("id", id)
      .single();
    if (error) setMessage(error.message);
    else setClub(data);
  }
  useEffect(() => {
    void load();
  }, [id]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await createClient()
      .from("clubs")
      .update({
        name: club.name.trim(),
        organization_type: club.organization_type,
        plan: club.plan,
        primary_color: club.primary_color,
        contact_email: club.contact_email,
        website_url: club.website_url,
        timezone: club.timezone,
      })
      .eq("id", id);
    setMessage(error?.message || "Organization settings saved.");
    setBusy(false);
  }
  async function lifecycle(status: string) {
    if (
      !confirm(
        `${status === "active" ? "Reactivate" : "Deactivate"} ${club.name}? Data will be retained.`,
      )
    )
      return;
    setBusy(true);
    const { error } = await createClient()
      .from("clubs")
      .update({
        status,
        archived_at: status === "archived" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    setMessage(error?.message || "Organization status updated.");
    if (!error) await load();
    setBusy(false);
  }
  async function logo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setMessage("Choose a PNG, JPEG, or WebP image under 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const sb = createClient();
      const path = `${id}/logo-${Date.now()}.${file.type.split("/")[1]}`;
      const { error } = await sb.storage
        .from("club-branding")
        .upload(path, file);
      if (error) throw error;
      const { data } = sb.storage.from("club-branding").getPublicUrl(path);
      const result = await sb
        .from("clubs")
        .update({ logo_url: data.publicUrl })
        .eq("id", id);
      if (result.error) throw result.error;
      setMessage("Logo updated.");
      await load();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <ClubHeader id={id} title="Organization settings" />
      {message && (
        <p className="v11Notice" role="status">
          {message}
        </p>
      )}
      {club ? (
        <div className="v11Grid">
          <form className="panel v11Form" onSubmit={save}>
            <h2>Identity & configuration</h2>
            <label>
              Organization name
              <input
                required
                maxLength={160}
                value={club.name}
                onChange={(e) => setClub({ ...club, name: e.target.value })}
              />
            </label>
            <label>
              Organization type
              <select
                value={club.organization_type}
                onChange={(e) =>
                  setClub({ ...club, organization_type: e.target.value })
                }
              >
                {Object.entries(organizationTypes).map(([key, t]) => (
                  <option key={key} value={key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Contact email
              <input
                type="email"
                value={club.contact_email || ""}
                onChange={(e) =>
                  setClub({ ...club, contact_email: e.target.value })
                }
              />
            </label>
            <label>
              Website
              <input
                type="url"
                value={club.website_url || ""}
                onChange={(e) =>
                  setClub({ ...club, website_url: e.target.value })
                }
              />
            </label>
            <label>
              Timezone
              <input
                required
                value={club.timezone}
                onChange={(e) => setClub({ ...club, timezone: e.target.value })}
              />
            </label>
            <label>
              Plan
              <select
                value={club.plan}
                onChange={(e) => setClub({ ...club, plan: e.target.value })}
              >
                {[
                  ...new Set([
                    "starter",
                    "professional",
                    "enterprise",
                    club.plan,
                  ]),
                ].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Primary color
              <input
                type="color"
                value={club.primary_color || "#275e72"}
                onChange={(e) =>
                  setClub({ ...club, primary_color: e.target.value })
                }
              />
            </label>
            <button className="button gradient" disabled={busy}>
              Save settings
            </button>
            <label>
              Organization logo
              <input
                disabled={busy}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={logo}
              />
            </label>
          </form>
          <section className="panel">
            <h2>Organization lifecycle</h2>
            <p>
              Current status: <strong>{club.status}</strong>
            </p>
            <p>
              Inactive organizations retain their data. Their normal workspace
              access and public website are disabled.
            </p>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                lifecycle(club.status === "active" ? "suspended" : "active")
              }
            >
              {club.status === "active"
                ? "Suspend organization"
                : "Reactivate organization"}
            </button>
            <p>
              <button
                className="button secondary"
                disabled={busy || club.status === "archived"}
                onClick={() => lifecycle("archived")}
              >
                Archive organization
              </button>
            </p>
          </section>
        </div>
      ) : (
        <p role="status">
          {message ? "Organization could not be loaded." : "Loading settings…"}
        </p>
      )}
    </Shell>
  );
}
