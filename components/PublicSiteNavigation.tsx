"use client";
import { useState } from "react";
import Link from "next/link";
import styles from "./PublicOrganizationSite.module.css";
export default function PublicSiteNavigation({
  id,
  pages,
  active,
}: {
  id: string;
  pages: { slug: string; title: string }[];
  active?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.menuButton}
        aria-controls="public-site-navigation"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Close menu" : "Menu"}
      </button>
      <nav
        id="public-site-navigation"
        className={`${styles.nav} ${open ? styles.navOpen : ""}`}
        aria-label="Main navigation"
      >
        <Link
          aria-current={!active ? "page" : undefined}
          href={`/site/${id}`}
          onClick={() => setOpen(false)}
        >
          Home
        </Link>
        {pages.map((p) => (
          <Link
            key={p.slug}
            aria-current={active === p.slug ? "page" : undefined}
            href={`/site/${id}/${p.slug}`}
            onClick={() => setOpen(false)}
          >
            {p.title}
          </Link>
        ))}
        <Link href={`/site/${id}#contact`} onClick={() => setOpen(false)}>
          Contact
        </Link>
      </nav>
    </>
  );
}
