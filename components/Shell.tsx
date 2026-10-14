"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import PortalFrame from "./PortalFrame";
const items = [
  ["/dashboard", "Overview", ""],
  ["/clubs", "Organizations", "Customers"],
  ["/members", "Platform users", "Customers"],
  ["/launch-center", "Launch checklist", "Customers"],
  ["/organization-types", "Organization types", "Configuration"],
  ["/module-licensing", "Module licensing", "Configuration"],
  ["/marketplace", "Module catalog", "Configuration"],
  ["/billing", "Plans & billing", "Configuration"],
  ["/integrations", "Integrations", "Configuration"],
  ["/analytics", "Analytics", "Oversight"],
  ["/security", "Audit history", "Oversight"],
  ["/health", "Platform health", "Oversight"],
  ["/support", "Support cases", "Oversight"],
  ["/settings", "Settings", "Account"],
].map(([href, label, group]) => ({ href, label, group }));
export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [error, setError] = useState("");
  // The server proxy authorizes every platform request; the shared layout persists.
  async function out() {
    const { error } = await createClient().auth.signOut();
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/login");
    router.refresh();
  }
  return (
    <PortalFrame
      appearance="platform"
      name="NADORIO"
      subtitle="CD7 Platform Owner"
      logo="/cd7-technologies.png"
      items={items}
      onSignOut={out}
    >
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {children}
    </PortalFrame>
  );
}
