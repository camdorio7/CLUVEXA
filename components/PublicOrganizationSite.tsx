import Link from "next/link";
import PublicSiteNavigation from "./PublicSiteNavigation";
import type { CSSProperties, ReactNode } from "react";
import { organizationTheme } from "../lib/organization-theme";
import styles from "./PublicOrganizationSite.module.css";
export type PublicPage = { slug: string; title: string; body: string };
export type PublicSiteData = {
  title: string;
  tagline?: string | null;
  about?: string | null;
  services?: string[] | null;
  pages?: PublicPage[] | null;
  contact_email?: string | null;
  phone?: string | null;
  address?: string | null;
  hero_image_url?: string | null;
};
export type PublicClubData = {
  name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
};
export function PublicOrganizationSite({
  id,
  club,
  site,
  active,
  preview = false,
  children,
}: {
  id: string;
  club: PublicClubData | null;
  site: PublicSiteData;
  active?: string;
  preview?: boolean;
  children: ReactNode;
}) {
  const pages = (Array.isArray(site.pages) ? site.pages : []).filter(
    (p) =>
      p &&
      typeof p.slug === "string" &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug) &&
      typeof p.title === "string",
  );
  const hero =
    site.hero_image_url && /^https:\/\/[^\s]+$/i.test(site.hero_image_url)
      ? site.hero_image_url
      : null;
  return (
    <div
      className={styles.shell}
      style={
        {
          ...organizationTheme(club?.primary_color),
          "--site-hero-image": hero
            ? `url("${hero.replace(/["\\]/g, "")}")`
            : "none",
        } as CSSProperties
      }
    >
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link
            className={styles.brand}
            href={preview ? "#" : `/site/${id}`}
            aria-label={`${club?.name || site.title} home`}
          >
            {club?.logo_url && (
              <img src={club.logo_url} alt="" className={styles.logo} />
            )}
            <span>{club?.name || site.title}</span>
          </Link>
          {preview ? (
            <nav aria-label="Draft preview navigation">
              {pages.map((p) => (
                <a key={p.slug} href={`#${p.slug}`} style={{ marginRight: 16 }}>
                  {p.title}
                </a>
              ))}
              <a href="#contact">Contact</a>
            </nav>
          ) : (
            <PublicSiteNavigation id={id} pages={pages} active={active} />
          )}
        </div>
      </header>
      {children}
      <footer className={styles.footer}>
        <strong>{club?.name || site.title}</strong>
        <span>Powered by CD7 Technologies · NADORIO</span>
      </footer>
    </div>
  );
}
export { styles as publicSiteStyles };
