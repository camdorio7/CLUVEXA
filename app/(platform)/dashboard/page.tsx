"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  CalendarDays,
  Activity,
  ArrowRight,
  Plus,
  ShieldCheck,
} from "lucide-react";
import NadorioLogo from "../../../components/NadorioLogo";
import { createClient } from "../../../lib/supabase/client";
type Club = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  logo_url?: string;
  club_type?: string;
};
export default function Dashboard() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [members, setMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    (async () => {
      const sb = createClient();
      try {
        const [
          { data: c, error: clubError },
          { count: m, error: memberError },
        ] = await Promise.all([
          sb
            .from("clubs")
            .select("id,name,slug,status,plan,logo_url,club_type")
            .order("created_at", { ascending: false }),
          sb.from("members").select("*", { count: "exact", head: true }),
        ]);
        if (clubError || memberError) {
          setLoadError(
            clubError?.message ||
              memberError?.message ||
              "Could not load dashboard",
          );
        } else {
          setClubs(c || []);
          setMembers(m || 0);
        }
      } catch {
        setLoadError("Dashboard could not load. Please refresh.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  return (
    <>
      <div className="ownerHero">
        <div>
          <div className="eyebrow cyan">CD7 TECHNOLOGIES · PLATFORM OWNER</div>
          <NadorioLogo />
          <p>
            The operating system for modern organizations. Manage customers,
            industries, modules, subscriptions and platform health from one
            control center.
          </p>
        </div>
        <Link className="button gradient" href="/clubs/new">
          <Plus size={17} /> Add Organization
        </Link>
      </div>
      <div className="statGrid">
        <div className="statCard">
          <Building2 />
          <div>
            <span>Organizations</span>
            <strong>{loading ? "—" : loadError ? "—" : clubs.length}</strong>
          </div>
        </div>
        <div className="statCard">
          <ShieldCheck />
          <div>
            <span>Active Organizations</span>
            <strong>
              {loading
                ? "—"
                : loadError
                  ? "—"
                  : clubs.filter((c) => c.status === "active").length}
            </strong>
          </div>
        </div>
        <div className="statCard">
          <Users />
          <div>
            <span>People & Members</span>
            <strong>
              {loading ? "—" : loadError ? "—" : members.toLocaleString()}
            </strong>
          </div>
        </div>
        <div className="statCard">
          <Activity />
          <div>
            <span>Platform</span>
            <strong>
              {loading
                ? "Checking…"
                : loadError
                  ? "Needs attention"
                  : "Dashboard connected"}
            </strong>
          </div>
        </div>
      </div>
      {loadError && (
        <p role="alert" className="error">
          Dashboard data could not be verified: {loadError}
        </p>
      )}
      <div className="sectionHead">
        <div>
          <div className="eyebrow">YOUR NETWORK</div>
          <h2>Organizations</h2>
        </div>
        <Link href="/clubs">Manage all</Link>
      </div>
      <div className="clubGrid">
        {clubs.map((c) => (
          <Link className="clubTile" href={"/clubs/" + c.id} key={c.id}>
            <div className="clubLogo">
              {c.logo_url ? <img src={c.logo_url} alt="" /> : <Building2 />}
            </div>
            <div className="clubTileCopy">
              <h3>{c.name}</h3>
              <p>
                {c.club_type?.replaceAll("_", " ") || "Organization"} · {c.plan}
              </p>
              <div className="chips">
                <span
                  className={
                    "chip " + (c.status === "active" ? "good" : "warn")
                  }
                >
                  {c.status}
                </span>
              </div>
            </div>
            <ArrowRight className="arrow" />
          </Link>
        ))}
      </div>
    </>
  );
}
