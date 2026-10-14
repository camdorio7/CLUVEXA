"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import styles from "./PortalFrame.module.css";
export type NavItem = { href: string; label: string; group?: string };
export default function PortalFrame({
  name,
  subtitle,
  logo,
  items,
  children,
  onSignOut,
  theme,
  footer,
  appearance = "organization",
}: {
  name: string;
  subtitle: string;
  logo?: string;
  items: NavItem[];
  children: ReactNode;
  onSignOut: () => void;
  theme?: CSSProperties;
  footer?: ReactNode;
  appearance?: "organization" | "platform";
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  const groups = [...new Set(items.map((i) => i.group || ""))];
  const link = (i: NavItem) => (
    <Link
      key={i.href}
      href={i.href}
      prefetch={false}
      aria-current={path === i.href ? "page" : undefined}
    >
      {i.label}
    </Link>
  );
  return (
    <div
      className={`${styles.shell} ${appearance === "platform" ? styles.platform : ""}`}
      style={theme}
    >
      <header className={styles.mobile}>
        <b>{name}</b>
        <button
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="portal-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      {open && (
        <button
          className={styles.backdrop}
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="portal-navigation"
        className={`${styles.sidebar} ${open ? styles.open : ""}`}
      >
        <div className={styles.brand}>
          {logo ? (
            <img src={logo} alt="" />
          ) : (
            <span className={styles.mark}>
              {name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div>
            <b>{name}</b>
            <small>{subtitle}</small>
          </div>
        </div>
        <nav className={styles.nav} aria-label={subtitle}>
          {groups.map((group) =>
            group ? (
              <details
                key={`${group}:${path}`}
                open={
                  items.some((i) => i.group === group && i.href === path) ||
                  groups.length < 4
                }
              >
                <summary>{group}</summary>
                {items.filter((i) => i.group === group).map(link)}
              </details>
            ) : (
              <div key="home">{items.filter((i) => !i.group).map(link)}</div>
            ),
          )}
        </nav>
        <div className={styles.footer}>
          {footer}
          <button onClick={onSignOut}>Sign out</button>
          <small>NADORIO v11 · CD7 Technologies</small>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
