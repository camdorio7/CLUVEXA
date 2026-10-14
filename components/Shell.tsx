"use client";
import { useEffect, useState } from "react";
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
  ["/billing", "Plans & billing status", "Configuration"],
  ["/integrations", "Integrations", "Configuration"],
  ["/analytics", "Analytics", "Oversight"],
  ["/security", "Audit history", "Oversight"],
  ["/health", "Platform health", "Oversight"],
  ["/support", "Support cases", "Oversight"],
  ["/settings", "Management directory", "Account"],
].map(([href, label, group]) => ({ href, label, group }));
export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const sb = createClient();
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) {
          router.replace("/login");
          return;
        }
        const { data, error } = await sb.rpc("is_super_admin");
        if (error) throw error;
        if (data !== true) {
          router.replace("/organizations");
          return;
        }
        if (active) setReady(true);
      } catch {
        if (active)
          setError(
            "Platform access could not be verified. Please reload or sign in again.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);
  async function out() {
    const { error } = await createClient().auth.signOut();
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/login");
    router.refresh();
  }
  if (error)
    return (
      <main className="v11State" role="alert">
        {error}
      </main>
    );
  if (!ready)
    return (
      <main className="v11State" role="status">
        Verifying platform access…
      </main>
    );
  return (
    <PortalFrame
      appearance="platform"
      name="NADORIO"
      subtitle="CD7 Platform Owner"
      logo="/cd7-technologies.png"
      items={items}
      onSignOut={out}
    >
      {children}
    </PortalFrame>
  );
}
