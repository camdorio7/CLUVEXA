"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "../../../../../components/WorkspaceShell";
import { createClient } from "../../../../../lib/supabase/client";
import {
  PublicOrganizationSite,
  publicSiteStyles as s,
} from "../../../../../components/PublicOrganizationSite";
export default function Preview() {
  const { club } = useWorkspace();
  const [site, setSite] = useState<any>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    createClient()
      .from("site_drafts")
      .select("data")
      .eq("club_id", club.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (live) {
          if (error) setMessage(error.message);
          else if (!data) setMessage("Save a draft in Website Builder first.");
          else setSite(data.data);
        }
      });
    return () => {
      live = false;
    };
  }, [club.id]);
  return (
    <>
      <p className="v11Notice">
        Private preview of the saved draft. Unsaved editor changes are not
        included.{" "}
        <Link href={`/workspace/${club.id}/site-builder`}>Back to editor</Link>
      </p>
      {message && <p role="status">{message}</p>}
      {site && (
        <PublicOrganizationSite id={club.id} club={club} site={site} preview>
          <section className={s.hero}>
            <div className={s.heroInner}>
              <div className={s.eyebrow}>{club.name}</div>
              <h1>{site.title}</h1>
              <p>{site.tagline}</p>
            </div>
          </section>
          <section className={s.content}>
            <h2>Welcome</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{site.about}</p>
            {site.services?.map((v: string, i: number) => (
              <p key={i}>{v}</p>
            ))}
          </section>
          {site.pages?.map((p: any) => (
            <section className={s.content} id={p.slug} key={p.slug}>
              <h2>
                {p.title} {p.published === false ? "(Draft page)" : ""}
              </h2>
              <p style={{ whiteSpace: "pre-wrap" }}>{p.body}</p>
            </section>
          ))}
          <section className={s.content} id="contact">
            <h2>Contact</h2>
            <p>
              {site.contact_email} · {site.phone}
            </p>
            <p>{site.address}</p>
          </section>
        </PublicOrganizationSite>
      )}
    </>
  );
}
