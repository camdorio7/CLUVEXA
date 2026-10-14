"use client";
import { useEffect, useState } from "react";
import { useWorkspace } from "../../../../components/WorkspaceShell";
import { createClient } from "../../../../lib/supabase/client";
import { portalApi } from "../../../../lib/portal-api";
import { stripeAmount } from "../../../../lib/money";
export default function Billing() {
  const { club } = useWorkspace();
  const [sub, setSub] = useState<any>(null),
    [invoices, setInvoices] = useState<any[]>([]),
    [config, setConfig] = useState<any>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const sb = createClient();
      const [s, i, c] = await Promise.all([
        sb
          .from("organization_subscriptions")
          .select(
            "status,plan_key,current_period_end,cancel_at_period_end,customer_id",
          )
          .eq("club_id", club.id)
          .maybeSingle(),
        sb
          .from("subscription_invoices")
          .select("*")
          .eq("club_id", club.id)
          .order("created_at", { ascending: false })
          .limit(50),
        portalApi(`/api/billing/config?clubId=${club.id}`),
      ]);
      if (s.error || i.error) throw s.error || i.error;
      setSub(s.data);
      setInvoices(i.data || []);
      setConfig(c);
    } catch (e: any) {
      setMessage(e.message);
    }
  }
  useEffect(() => {
    void load();
  }, [club.id]);
  async function open(kind: string, plan?: string) {
    setBusy(true);
    setMessage("");
    try {
      const out = await portalApi(`/api/billing/${kind}`, {
        clubId: club.id,
        plan,
      });
      const url = new URL(out.url);
      if (
        url.protocol !== "https:" ||
        !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)
      )
        throw Error("Invalid payment provider redirect.");
      window.location.assign(url.href);
    } catch (e: any) {
      setMessage(e.message);
      setBusy(false);
    }
  }
  const existing = [
    "active",
    "trialing",
    "past_due",
    "unpaid",
    "incomplete",
    "paused",
  ].includes(sub?.status);
  return (
    <>
      <h1>Subscription & billing</h1>
      <p>Your organization’s NADORIO software subscription.</p>
      {message && (
        <p className="v11Notice" role="status">
          {message}
        </p>
      )}
      <section className="panel v11Form">
        <h2>{sub?.plan_key || "Organization subscription"}</h2>
        <p>
          Status: <strong>{sub?.status || "No subscription connected"}</strong>
        </p>
        {sub?.current_period_end && (
          <p>
            {sub.cancel_at_period_end
              ? "Scheduled to end"
              : "Current period ends"}{" "}
            {new Date(sub.current_period_end).toLocaleDateString()}
          </p>
        )}
        <p>
          Payments are confirmed by Stripe. After checkout, refresh to see the
          confirmed status.
        </p>
        <div className="v12Actions">
          <button className="button secondary" onClick={load}>
            Refresh billing
          </button>
          {sub?.customer_id && (
            <button
              className="button gradient"
              disabled={busy || !config?.configured}
              onClick={() => open("portal")}
            >
              Manage subscription & payment method
            </button>
          )}
        </div>
      </section>
      {config && !config.configured && (
        <p className="v11Notice">
          Online billing is awaiting platform configuration. Contact CD7
          Technologies to activate it.
        </p>
      )}
      {!existing && config?.configured && (
        <section className="panel v11Form">
          <h2>Choose a subscription</h2>
          <p>
            Review the price, currency, and billing interval securely in Stripe
            before paying.
          </p>
          <div className="v12Actions">
            {config.plans.map((p: any) => (
              <button
                className="button gradient"
                key={p.key}
                disabled={busy}
                onClick={() => open("checkout", p.key)}
              >
                {p.name} — review checkout
              </button>
            ))}
          </div>
          {!config.plans.length && <p>No plans are currently available.</p>}
        </section>
      )}
      <section className="panel">
        <div className="panelhead">Recent invoices</div>
        {invoices.map((i) => (
          <div className="datarow" key={i.id}>
            <span>{new Date(i.created_at).toLocaleDateString()}</span>
            <span>{i.status}</span>
            <span>{stripeAmount(i.amount_due, i.currency)}</span>
            {i.hosted_url?.startsWith("https://invoice.stripe.com/") && (
              <a href={i.hosted_url} target="_blank" rel="noreferrer">
                View invoice
              </a>
            )}
          </div>
        ))}
        {!invoices.length && (
          <p className="empty">No subscription invoices yet.</p>
        )}
      </section>
    </>
  );
}
