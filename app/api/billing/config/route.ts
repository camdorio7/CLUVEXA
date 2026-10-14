import { NextRequest, NextResponse } from "next/server";
import { organizationAdmin, apiError } from "../../../../lib/server-access";
import { billingPlans } from "../../../../lib/stripe";
export async function GET(req: NextRequest) {
  try {
    await organizationAdmin(req, req.nextUrl.searchParams.get("clubId"));
    const enabled = !!(
      process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.NEXT_PUBLIC_APP_URL
    );
    return NextResponse.json(
      {
        configured: enabled,
        plans: enabled
          ? Object.entries(billingPlans()).map(([key, p]) => ({
              key,
              name: p.name,
            }))
          : [],
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
