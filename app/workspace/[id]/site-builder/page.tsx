"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";
import { optimizeWebsiteImage } from "../../../../lib/optimize-image";
type Page = { slug: string; title: string; body: string; published?: boolean };
type Site = {
  pages: Page[];
  club_id: string;
  title: string;
  tagline: string;
  about: string;
  services: string[];
  contact_email: string;
  phone: string;
  address: string;
  hero_image_url: string;
  published: boolean;
};
export default function SiteBuilder() {
  const { id } = useParams<{ id: string }>();
  const [version, setVersion] = useState(0),
    [revisions, setRevisions] = useState<any[]>([]);
  const [site, setSite] = useState<Site>({
    pages: [],
    club_id: id,
    title: "Welcome",
    tagline: "",
    about: "",
    services: [],
    contact_email: "",
    phone: "",
    address: "",
    hero_image_url: "",
    published: false,
  });
  const [ready, setReady] = useState(false),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [authorized, setAuthorized] = useState(false);
  async function load() {
    try {
      const sb = createClient();
      const [draft, live, history] = await Promise.all([
        sb.from("site_drafts").select("*").eq("club_id", id).maybeSingle(),
        sb
          .from("organization_sites")
          .select("published")
          .eq("club_id", id)
          .maybeSingle(),
        sb
          .from("site_revisions")
          .select("id,version,action,created_at,data")
          .eq("club_id", id)
          .order("version", { ascending: false })
          .limit(50),
      ]);
      if (draft.error || live.error || history.error)
        throw draft.error || live.error || history.error;
      setVersion(draft.data?.version || 0);
      setRevisions(history.data || []);
      setSite((s) => ({
        ...s,
        ...draft.data?.data,
        published: !!live.data?.published,
      }));
      setAuthorized(true);
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setReady(true);
    }
  }
  useEffect(() => {
    void load();
  }, [id]);
  async function upload(file: File) {
    setSaving(true);
    try {
      const blob = await optimizeWebsiteImage(file);
      const sb = createClient(),
        path = `${id}/website-${crypto.randomUUID()}.webp`;
      const { error } = await sb.storage
        .from("club-branding")
        .upload(path, blob, {
          contentType: "image/webp",
          cacheControl: "31536000",
        });
      if (error) throw error;
      change(
        "hero_image_url",
        sb.storage.from("club-branding").getPublicUrl(path).data.publicUrl,
      );
      setMessage(
        "Photo optimized and uploaded. Save your draft to keep this change.",
      );
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  }
  function change<K extends keyof Site>(key: K, value: Site[K]) {
    setSite((s) => ({ ...s, [key]: value }));
  }
  function movePage(index: number, direction: number) {
    setSite((current) => {
      const pages = [...current.pages];
      const target = index + direction;
      if (target < 0 || target >= pages.length) return current;
      [pages[index], pages[target]] = [pages[target], pages[index]];
      return { ...current, pages };
    });
  }
  function addPage() {
    setSite((current) => {
      let n = current.pages.length + 1;
      while (current.pages.some((p) => p.slug === `page-${n}`)) n++;
      return {
        ...current,
        pages: [
          ...current.pages,
          { slug: `page-${n}`, title: "New page", body: "", published: false },
        ],
      };
    });
  }
  function editPage(index: number, patch: Partial<Page>) {
    setSite((current) => ({
      ...current,
      pages: current.pages.map((page, i) =>
        i === index ? { ...page, ...patch } : page,
      ),
    }));
  }
  function removePage(index: number) {
    if (
      !window.confirm(
        "Remove this page? Save the website to apply the removal.",
      )
    )
      return;
    setSite((current) => ({
      ...current,
      pages: current.pages.filter((_, i) => i !== index),
    }));
  }
  async function save(published: boolean) {
    setSaving(true);
    setMessage("");
    try {
      const slugs = site.pages.map((p) => p.slug);
      if (
        site.hero_image_url &&
        !/^https:\/\/[^\s]+$/i.test(site.hero_image_url)
      ) {
        setMessage("Hero image must be a valid HTTPS image URL.");
        return;
      }
      if (
        new Set(slugs).size !== slugs.length ||
        site.pages.some(
          (p) =>
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug) ||
            ["contact", "home"].includes(p.slug),
        )
      ) {
        setMessage(
          "Page addresses must be unique lowercase words separated by hyphens (not home or contact).",
        );
        return;
      }
      const { data, error } = await createClient().rpc("v12_save_site", {
        target_club: id,
        content: site,
        expected_version: version,
        publish_now: published,
      });
      if (error) throw error;
      setVersion(data.version);
      change("published", data.published);
      setMessage(
        published
          ? "Website published."
          : "Draft saved. The live website is unchanged.",
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save website");
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="v6WorkspacePage" style={{ maxWidth: 1050 }}>
      <div className="v6PageHead">
        <div>
          <div className="eyebrow cyan">NADORIO WEBSITE BUILDER</div>
          <h1>Public website</h1>
          <p>
            Build your organization website with a polished template and
            customizable navigation tabs.
          </p>
        </div>
        {authorized && (
          <Link
            className="button secondary"
            target="_blank"
            href={`/site/${id}`}
          >
            View website ↗
          </Link>
        )}
      </div>
      {message && (
        <p role="status" className="successMsg">
          {message}
        </p>
      )}
      {!ready && <p>Loading…</p>}
      {authorized && (
        <div style={{ display: "grid", gap: 18 }}>
          <section className="panel" style={{ padding: 20 }}>
            <h2>Homepage</h2>
            {(
              [
                ["title", "Website title"],
                ["tagline", "Short introduction"],
                ["about", "About your organization"],
              ] as const
            ).map(([key, label]) => (
              <div className="field" key={key}>
                <label>{label}</label>
                <textarea
                  rows={key === "about" ? 5 : 2}
                  maxLength={
                    key === "about" ? 5000 : key === "title" ? 160 : 500
                  }
                  value={site[key]}
                  onChange={(e) => change(key, e.target.value)}
                />
              </div>
            ))}
          </section>
          <section className="panel" style={{ padding: 20 }}>
            <h2>Website appearance</h2>
            <p className="muted">
              Your own photography, name, logo and brand colors across every
              page.
            </p>
            <div className="field">
              <label>
                Upload a hero photo (JPEG, PNG, WebP; up to 10 MB)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={saving}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                  }}
                />
              </label>
              <p className="muted">
                Uploads are resized to 1,600 pixels and compressed for faster
                loading.
              </p>
              <label>Hero background image (HTTPS URL, optional)</label>
              <input
                type="url"
                placeholder="https://example.com/your-photo.jpg"
                value={site.hero_image_url || ""}
                onChange={(e) => change("hero_image_url", e.target.value)}
              />
            </div>
          </section>
          <section className="panel" style={{ padding: 20 }}>
            <h2>Services and highlights</h2>
            <p className="muted">One item per line (up to 20).</p>
            <textarea
              aria-label="Services"
              rows={5}
              value={site.services.join("\n")}
              onChange={(e) =>
                change("services", e.target.value.split("\n").slice(0, 20))
              }
            />
          </section>
          <section className="panel" style={{ padding: 20 }}>
            <h2>Additional pages</h2>
            <p className="muted">
              Create pages for services, programs, FAQs, or other business
              information. Save to publish your changes.
            </p>
            {site.pages.map((page, index) => (
              <div
                key={index}
                style={{
                  border: "1px solid #9ca3af55",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={page.published !== false}
                    onChange={(e) =>
                      editPage(index, { published: e.target.checked })
                    }
                  />{" "}
                  Publish this page when the website is published
                </label>
                <div className="field">
                  <label>Page title</label>
                  <input
                    maxLength={120}
                    value={page.title}
                    onChange={(e) => editPage(index, { title: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Page URL (lowercase, hyphens)</label>
                  <input
                    maxLength={80}
                    value={page.slug}
                    onChange={(e) =>
                      editPage(index, {
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, ""),
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>Page content</label>
                  <textarea
                    rows={6}
                    maxLength={12000}
                    value={page.body}
                    onChange={(e) => editPage(index, { body: e.target.value })}
                  />
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <a
                    className="button secondary"
                    href={`/site/${id}/${page.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Preview published page ↗
                  </a>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={index === 0}
                    onClick={() => movePage(index, -1)}
                  >
                    ↑ Move up
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={index === site.pages.length - 1}
                    onClick={() => movePage(index, 1)}
                  >
                    ↓ Move down
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => removePage(index)}
                  >
                    Remove page
                  </button>
                </div>
              </div>
            ))}
            <button
              className="button secondary"
              type="button"
              disabled={site.pages.length >= 20}
              onClick={addPage}
            >
              + Add page
            </button>
          </section>
          <section className="panel" style={{ padding: 20 }}>
            <h2>Contact details</h2>
            {(
              [
                ["contact_email", "Email"],
                ["phone", "Phone"],
                ["address", "Address"],
              ] as const
            ).map(([key, label]) => (
              <div className="field" key={key}>
                <label>{label}</label>
                <input
                  value={site[key]}
                  onChange={(e) => change(key, e.target.value)}
                />
              </div>
            ))}
          </section>
          <section className="panel" style={{ padding: 20 }}>
            <h2>Publishing</h2>
            <p className="muted">
              {site.published ? "Currently published." : "Currently a draft."}{" "}
              Draft edits stay private until you select Publish. Saving a draft
              keeps the live website available.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className="button secondary"
                disabled={saving}
                onClick={() => save(false)}
              >
                Save draft
              </button>
              <button
                className="button gradient"
                disabled={saving || !site.title.trim()}
                onClick={() => save(true)}
              >
                Publish changes
              </button>
              <Link
                className="button secondary"
                href={`/workspace/${id}/site-builder/preview`}
              >
                Preview saved draft
              </Link>
              {site.published && (
                <button
                  className="button secondary"
                  disabled={saving}
                  onClick={async () => {
                    if (
                      !confirm(
                        "Take the public website offline? Your draft will be preserved.",
                      )
                    )
                      return;
                    setSaving(true);
                    try {
                      const { error } = await createClient().rpc(
                        "v12_unpublish_site",
                        { target_club: id },
                      );
                      if (error) throw error;
                      change("published", false);
                      setMessage("Website unpublished.");
                    } catch (e: any) {
                      setMessage(e.message);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Unpublish website
                </button>
              )}
            </div>
          </section>
          <section className="panel v11Form">
            <h2>Revision history</h2>
            <p>
              Last 50 saved versions. Loading a revision changes your editor;
              save it as a draft before publishing.
            </p>
            <button
              className="button secondary"
              disabled={saving}
              onClick={() => {
                if (
                  confirm(
                    "Reload the latest saved draft and discard unsaved edits?",
                  )
                )
                  void load();
              }}
            >
              Reload latest draft
            </button>
            {revisions.map((r) => (
              <div className="v12Actions" key={r.id}>
                <span>
                  Version {r.version} · {r.action} ·{" "}
                  {new Date(r.created_at).toLocaleString()}
                </span>
                <button
                  className="button secondary"
                  disabled={saving}
                  onClick={() => {
                    if (confirm("Replace unsaved edits with this revision?")) {
                      setSite((s) => ({
                        ...s,
                        ...r.data,
                        published: s.published,
                      }));
                      setMessage(
                        `Version ${r.version} loaded into editor. Save to restore it.`,
                      );
                    }
                  }}
                >
                  Load revision
                </button>
              </div>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}
