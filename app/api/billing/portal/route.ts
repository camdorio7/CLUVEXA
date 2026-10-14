import { NextRequest, NextResponse } from "next/server";
import {
  organizationAdmin,
  serviceClient,
  apiError,
  HttpError,
  appOrigin,
} from "../../../../lib/server-access";
import { stripe } from "../../../../lib/stripe";
export async function POST(req: NextRequest) {
  try {
    const { clubId } = await req.json();
    await organizationAdmin(req, clubId);
    const { data, error } = await serviceClient()
      .from("organization_subscriptions")
      .select("customer_id")
      .eq("club_id", clubId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.customer_id)
      throw new HttpError(
        400,
        "Start a subscription before opening the billing portal.",
      );
    const session = await stripe(
      "billing_portal/sessions",
      "POST",
      new URLSearchParams({
        customer: data.customer_id,
        return_url: `${appOrigin()}/workspace/${clubId}/billing`,
      }),
    );
    return NextResponse.json(
      { url: session.url },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
