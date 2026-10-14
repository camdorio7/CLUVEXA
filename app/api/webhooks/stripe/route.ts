import { NextRequest, NextResponse } from "next/server";
import { verifyStripe } from "../../../../lib/webhook-signatures";
import {
  serviceClient,
  apiError,
  HttpError,
} from "../../../../lib/server-access";
import { stripe, billingPlans } from "../../../../lib/stripe";
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret)
      throw new HttpError(503, "Payment webhooks are not configured.");
    const body = await req.text();
    if (body.length > 1000000)
      throw new HttpError(413, "Webhook payload too large.");
    if (!verifyStripe(body, req.headers.get("stripe-signature") || "", secret))
      throw new HttpError(400, "Invalid webhook signature.");
    const event = JSON.parse(body),
      sb = serviceClient();
    if (
      typeof event.id !== "string" ||
      typeof event.created !== "number" ||
      typeof event.type !== "string"
    )
      throw new HttpError(400, "Invalid provider event.");
    if (event.type.startsWith("customer.subscription.")) {
      const sub = await stripe(
        `subscriptions/${encodeURIComponent(event.data.object.id)}`,
      );
      const price = sub.items?.data?.[0]?.price?.id;
      const plan =
        Object.entries(billingPlans()).find(
          ([, p]) => p.price === price,
        )?.[0] || null;
      const { error } = await sb.rpc("v12_apply_subscription", {
        event_key: event.id,
        event_at: new Date(event.created * 1000).toISOString(),
        customer_value:
          typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        subscription_value: sub.id,
        status_value: sub.status,
        price_value: price || null,
        plan_value: plan,
        period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        cancel_value: !!sub.cancel_at_period_end,
      });
      if (error) throw error;
    } else if (
      [
        "invoice.paid",
        "invoice.payment_failed",
        "invoice.finalized",
        "invoice.voided",
      ].includes(event.type)
    ) {
      const invoice = await stripe(
        `invoices/${encodeURIComponent(event.data.object.id)}`,
      );
      const { error } = await sb.rpc("v12_apply_invoice", {
        event_key: event.id,
        event_at: new Date(event.created * 1000).toISOString(),
        invoice: {
          ...invoice,
          customer:
            typeof invoice.customer === "string"
              ? invoice.customer
              : invoice.customer.id,
        },
      });
      if (error) throw error;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    return apiError(error);
  }
}
