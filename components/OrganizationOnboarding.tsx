"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../lib/supabase/client";
export default function OrganizationOnboarding({ id }: { id: string }) {
  const [state, setState] = useState<any>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const { data, error } = await createClient().rpc("v12_onboarding", {
      target_club: id,
    });
    if (error) setMessage(error.message);
    else setState(data);
  }
  useEffect(() => {
    void load();
  }, [id]);
  async function finish() {
    setBusy(true);
    try {
      const { error } = await createClient().rpc("v12_complete_setup", {
        target_club: id,
      });
      if (error) throw error;
      setMessage("Organization setup recorded.");
      await load();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  const steps = [
    ["identity", "Organization details", "settings", true],
    ["administrator", "Administrator access", "team-access", true],
    ["modules", "Enabled modules", "settings", true],
    ["branding", "Logo and colors", "settings", false],
    ["members", "Member records", "members", false],
    ["website", "Published website", "site-builder", false],
  ] as const;
  return (
    <>
      <h1>Organization launch checklist</h1>
      <p>
        Progress comes from your organization’s actual configuration. Complete
        the required items, then review the optional services you use.
      </p>
      {message && (
        <p role="status" className="v11Notice">
          {message}
        </p>
      )}
      {state ? (
        <>
          <section className="panel">
            {steps.map(([key, label, path, required]) => (
              <div className="datarow" key={key}>
                <strong>{label}</strong>
                <span>{required ? "Required" : "Optional"}</span>
                <span className={state[key] ? "status" : "chip"}>
                  {state[key] ? "Complete" : "Needs setup"}
                </span>
                <Link href={`/workspace/${id}/${path}`}>Review</Link>
              </div>
            ))}
            <div className="datarow">
              <strong>Software subscription</strong>
              <span>Optional for launch</span>
              <span>{state.billing}</span>
              <Link href={`/workspace/${id}/billing`}>Billing</Link>
            </div>
          </section>
          <div className="v12Actions">
            <button className="button secondary" onClick={load}>
              Refresh progress
            </button>
            <button
              className="button gradient"
              disabled={
                busy ||
                !state.identity ||
                !state.administrator ||
                !state.modules
              }
              onClick={finish}
            >
              Record setup complete
            </button>
          </div>
          {state.recorded?.completed_at && (
            <p>
              Setup last recorded{" "}
              {new Date(state.recorded.completed_at).toLocaleString()}.
            </p>
          )}
        </>
      ) : (
        <p>Loading checklist…</p>
      )}
    </>
  );
}
