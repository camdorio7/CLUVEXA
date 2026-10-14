import Link from "next/link";
import Shell from "../../components/Shell";
import {
  Building2,
  Boxes,
  PlugZap,
  ShieldCheck,
  ChartNoAxesCombined,
  LifeBuoy,
  CreditCard,
  ArrowRight,
} from "lucide-react";
const areas = [
  {
    href: "/clubs",
    title: "Organizations",
    description:
      "Create organizations, assign administrators and manage status.",
    icon: Building2,
  },
  {
    href: "/module-licensing",
    title: "Module licensing",
    description: "Grant organizations access to products and services.",
    icon: ShieldCheck,
  },
  {
    href: "/marketplace",
    title: "Module catalog",
    description: "Review the features available to organizations.",
    icon: Boxes,
  },
  {
    href: "/integrations",
    title: "Integrations",
    description: "Review connected platforms and organization integrations.",
    icon: PlugZap,
  },
  {
    href: "/billing",
    title: "Plans and billing",
    description: "Review plan configuration and commercial controls.",
    icon: CreditCard,
  },
  {
    href: "/analytics",
    title: "Analytics",
    description: "View network metrics and organization activity.",
    icon: ChartNoAxesCombined,
  },
  {
    href: "/support",
    title: "Support",
    description: "Review and manage organization support requests.",
    icon: LifeBuoy,
  },
];
export default function Settings() {
  return (
    <Shell>
      <div className="v6PageHead">
        <div>
          <div className="eyebrow cyan">CD7 TECHNOLOGIES</div>
          <h1>Platform management</h1>
          <p>
            Manage NADORIO from the appropriate workspace. Changes to individual
            organizations belong in their organization settings.
          </p>
        </div>
      </div>
      <div className="v6FeatureGrid">
        {areas.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="panel"
            style={{ padding: 22, display: "block", textDecoration: "none" }}
          >
            <a.icon size={24} />
            <h2>{a.title}</h2>
            <p>{a.description}</p>
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              Open <ArrowRight size={16} />
            </span>
          </Link>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 24 }}>
        NADORIO v11 Release Candidate. This page links to existing management
        tools; it does not imply that billing, monitoring, or integrations have
        passed production verification.
      </p>
    </Shell>
  );
}
