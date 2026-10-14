"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
export default function Billing() {
  const [rows, setRows] = useState<any[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(""),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState(0),
    [subscriptions, setSubscriptions] = useState<any[]>([]);
  useEffect(() => {
    createClient()
      .from("clubs")
      .select("id,name,plan,subscription_status,billing_email")
      .order("name")
      .order("id")
      .range(page * 50, page * 50 + 49)
      .then(async ({ data, error }) => {
        let subscriptionError = "";
        if (data?.length) {
          const result = await createClient()
            .from("organization_subscriptions")
            .select("club_id,status,plan_key,current_period_end")
            .in(
              "club_id",
              data.map((c) => c.id),
            );
          if (result.error) subscriptionError = result.error.message;
          else setSubscriptions(result.data || []);
        }
        setRows(data || []);
        setMessage(error?.message || subscriptionError);
        setLoading(false);
      });
  }, [page]);
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
    <>
      <h1>Plans & billing status</h1>
      <p className="v11Notice">
        Stripe subscription status appears alongside each organization.
        Commercial plan records below remain CD7-managed; saving them does not
        charge the customer or change module licenses.
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
            <p>
              Stripe:{" "}
              <strong>
                {subscriptions.find((s) => s.club_id === c.id)?.status ||
                  "Not connected"}
              </strong>{" "}
              ·{" "}
              {subscriptions.find((s) => s.club_id === c.id)?.plan_key ||
                "No provider plan"}
            </p>
            <Link
              className="button secondary"
              href={`/workspace/${c.id}/billing`}
            >
              Open subscription & invoices
            </Link>
            <label>
              Commercial plan
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
              Legacy recorded billing status
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
      <div className="v12Actions">
        <button
          disabled={!page || !!busy}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          disabled={rows.length < 50 || !!busy}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
