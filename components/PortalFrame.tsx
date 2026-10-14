"use client";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  LayoutDashboard,
  Building2,
  Users,
  Rocket,
  Shapes,
  ShieldCheck,
  Blocks,
  CreditCard,
  Plug,
  ChartNoAxesCombined,
  History,
  Activity,
  LifeBuoy,
  Settings,
  UserRound,
  CalendarDays,
  BadgeCheck,
  Clock3,
  ClipboardList,
  MapPin,
  Flag,
  CalendarRange,
  Megaphone,
  Mail,
  Globe,
  FileChartColumn,
  UserCheck,
  KeyRound,
  ContactRound,
  LogOut,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import styles from "./PortalFrame.module.css";
export type NavItem = { href: string; label: string; group?: string };
const icons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  clubs: Building2,
  members: Users,
  "launch-center": Rocket,
  "organization-types": Shapes,
  "module-licensing": ShieldCheck,
  marketplace: Blocks,
  billing: CreditCard,
  integrations: Plug,
  analytics: ChartNoAxesCombined,
  security: History,
  health: Activity,
  support: LifeBuoy,
  settings: Settings,
  profile: UserRound,
  card: BadgeCheck,
  directory: ContactRound,
  memberships: BadgeCheck,
  staff: Clock3,
  events: CalendarDays,
  access: UserCheck,
  operations: ClipboardList,
  amenities: MapPin,
  golf: Flag,
  scorecard: Flag,
  "golf-index": ChartNoAxesCombined,
  "tee-sheet": CalendarRange,
  communications: Megaphone,
  "email-center": Mail,
  "site-builder": Globe,
  reports: FileChartColumn,
  platforms: Plug,
  website: Globe,
  people: Users,
  "team-access": Users,
  permissions: KeyRound,
  audit: History,
};
function NavigationLabel({ label, Icon }: { label: string; Icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <Icon size={19} aria-hidden="true" />
      <span>{label}</span>
      {pending && (
        <LoaderCircle
          className={styles.pending}
          size={16}
          aria-label="Opening page"
        />
      )}
    </>
  );
}
function NavigationLink({ item, active }: { item: NavItem; active: boolean }) {
  const [intent, setIntent] = useState(false);
  const key = item.href.split("/").pop() || "dashboard";
  const Icon = icons[key] || LayoutDashboard;
  return (
    <Link
      href={item.href}
      prefetch={intent ? null : false}
      onMouseEnter={() => setIntent(true)}
      onFocus={() => setIntent(true)}
      aria-current={active ? "page" : undefined}
    >
      <NavigationLabel label={item.label} Icon={Icon} />
    </Link>
  );
}
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
  const main = useRef<HTMLElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const previousPath = useRef(path);
  useEffect(() => {
    if (previousPath.current !== path) {
      setOpen(false);
      main.current?.focus({ preventScroll: true });
      previousPath.current = path;
    }
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menu.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  const groups = [...new Set(items.map((i) => i.group || ""))];
  const activeHref = items
    .filter((i) => path === i.href || path.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  useEffect(() => {
    const nav = navigation.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !current) return;
    const viewport = nav.getBoundingClientRect();
    const link = current.getBoundingClientRect();
    if (link.top < viewport.top) nav.scrollTop += link.top - viewport.top - 8;
    else if (link.bottom > viewport.bottom)
      nav.scrollTop += link.bottom - viewport.bottom + 8;
  }, [activeHref]);
  const currentLabel =
    items.find((i) => i.href === activeHref)?.label || "Dashboard";
  return (
    <div
      className={`${styles.shell} ${appearance === "platform" ? styles.platform : ""}`}
      style={theme}
    >
      <a href="#portal-content" className={styles.skipLink}>
        Skip to content
      </a>
      <header className={styles.mobile}>
        <div>
          <b>{name}</b>
          <small>{currentLabel}</small>
        </div>
        <button
          ref={menu}
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
          onClick={() => {
            setOpen(false);
            menu.current?.focus();
          }}
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
        <nav ref={navigation} className={styles.nav} aria-label={subtitle}>
          {groups.map((group) => (
            <div className={styles.navGroup} key={group || "home"}>
              {group && <p className={styles.groupLabel}>{group}</p>}
              {items
                .filter((i) => (i.group || "") === group)
                .map((item) => (
                  <NavigationLink
                    key={item.href}
                    item={item}
                    active={item.href === activeHref}
                  />
                ))}
            </div>
          ))}
        </nav>
        <div className={styles.footer}>
          {footer}
          <button onClick={onSignOut}>
            <LogOut size={17} aria-hidden="true" />
            Sign out
          </button>
          <small>NADORIO · CD7 Technologies</small>
        </div>
      </aside>
      <main
        id="portal-content"
        tabIndex={-1}
        ref={main}
        className={styles.main}
      >
        {children}
      </main>
    </div>
  );
}
