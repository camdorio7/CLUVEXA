"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "../../components/Shell";
import { createClient } from "../../lib/supabase/client";
export default function Billing() {
  const [rows, setRows] = useState<any[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    createClient()
      .from("clubs")
      .select("id,name,plan,subscription_status,billing_email")
      .order("name")
      .then(({ data, error }) => {
        setRows(data || []);
        setMessage(error?.message || "");
        setLoading(false);
      });
  }, []);
  function edit(id: string, patch: any) {
    setRows((r) => r.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  async function save(c: any) {
    setBusy(c.id);
    const { error } = await createClient()
      .from("clubs")
      .update({
        plan: c.plan,
        subscription_status: c.subscription_status,
        billing_email: c.billing_email || null,
      })
      .eq("id", c.id);
    setMessage(error?.message || `Saved billing configuration for ${c.name}.`);
    setBusy("");
  }
  return (
    <Shell>
      <h1>Plans & billing status</h1>
      <p className="v11Notice">
        Payment processing is not configured. These are manually maintained
        commercial records. Saving a plan does not charge a customer, create
        invoices, or change module licenses.
      </p>
      {message && <p role="status">{message}</p>}
      {loading && <p role="status">Loading organizations…</p>}
      <div className="v11Grid">
        {rows.map((c) => (
          <form
            className="panel v11Form"
            key={c.id}
            onSubmit={(e) => {
              e.preventDefault();
              void save(c);
            }}
          >
            <h2>
              <Link href={`/clubs/${c.id}`}>{c.name}</Link>
            </h2>
            <label>
              Plan
              <select
                value={c.plan}
                onChange={(e) => edit(c.id, { plan: e.target.value })}
              >
                {[
                  ...new Set(["starter", "professional", "enterprise", c.plan]),
                ].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Recorded billing status
              <select
                value={c.subscription_status}
                onChange={(e) =>
                  edit(c.id, { subscription_status: e.target.value })
                }
              >
                {[
                  ...new Set([
                    "unconfigured",
                    "trial",
                    "active",
                    "past_due",
                    "paused",
                    "canceled",
                    c.subscription_status,
                  ]),
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Billing contact
              <input
                type="email"
                value={c.billing_email || ""}
                onChange={(e) => edit(c.id, { billing_email: e.target.value })}
              />
            </label>
            <button className="button gradient" disabled={!!busy}>
              {busy === c.id ? "Saving…" : "Save configuration"}
            </button>
          </form>
        ))}
      </div>
    </Shell>
  );
}
