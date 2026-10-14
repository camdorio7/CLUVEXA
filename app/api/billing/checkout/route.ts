import { NextRequest, NextResponse } from "next/server";
import {
  organizationAdmin,
  serviceClient,
  apiError,
  HttpError,
  appOrigin,
} from "../../../../lib/server-access";
import { billingPlans, stripe } from "../../../../lib/stripe";
export async function POST(req: NextRequest) {
  try {
    const { clubId, plan } = await req.json();
    const { club, user } = await organizationAdmin(req, clubId);
    const plans = billingPlans();
    const selected =
      typeof plan === "string" && Object.hasOwn(plans, plan)
        ? plans[plan]
        : null;
    if (!selected)
      throw new HttpError(400, "Choose an available subscription plan.");
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET)
      throw new HttpError(
        503,
        "Stripe checkout and webhooks must both be configured.",
      );
    const origin = appOrigin(),
      sb = serviceClient();
    const { data: reservation, error } = await sb.rpc("v12_reserve_checkout", {
      target_club: clubId,
      plan_value: plan,
    });
    if (error) throw new HttpError(409, error.message);
    let customer = reservation.customer_id;
    if (!customer) {
      const result = await stripe(
        "customers",
        "POST",
        new URLSearchParams({
          name: club.name,
          email: club.billing_email || user.email || "",
          "metadata[club_id]": clubId,
        }),
        `nadorio-customer-${clubId}`,
      );
      customer = result.id;
      const saved = await sb
        .from("organization_subscriptions")
        .update({ customer_id: customer })
        .eq("club_id", clubId);
      if (saved.error) throw saved.error;
    }
    // Provider truth prevents a delayed webhook from allowing a second paid subscription.
    const current = await stripe(
      `subscriptions?customer=${encodeURIComponent(customer)}&status=all&limit=100`,
    );
    if (
      current.has_more ||
      current.data?.some((item: { status: string }) =>
        [
          "active",
          "trialing",
          "past_due",
          "unpaid",
          "incomplete",
          "paused",
        ].includes(item.status),
      )
    )
      throw new HttpError(
        409,
        "An existing subscription needs attention. Use Manage subscription, then refresh billing.",
      );
    // The reserved token serializes competing plan requests and makes retries reuse the session.
    const expires = Math.floor(
      new Date(reservation.checkout_reserved_until).getTime() / 1000,
    );
    const session = await stripe(
      "checkout/sessions",
      "POST",
      new URLSearchParams({
        customer,
        mode: "subscription",
        "line_items[0][price]": selected.price,
        "line_items[0][quantity]": "1",
        success_url: `${origin}/workspace/${clubId}/billing?checkout=success`,
        cancel_url: `${origin}/workspace/${clubId}/billing?checkout=cancelled`,
        "subscription_data[metadata][club_id]": clubId,
        "subscription_data[metadata][plan]": plan,
        client_reference_id: clubId,
        expires_at: String(expires),
      }),
      `nadorio-checkout-${reservation.checkout_token}`,
    );
    return NextResponse.json(
      { url: session.url },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
