import { withRequestTimeout } from "./request-fetch";
import { HttpError } from "./server-access";
export function billingPlans(): Record<
  string,
  { price: string; name: string }
> {
  try {
    const raw = JSON.parse(process.env.NADORIO_STRIPE_PLANS || "{}");
    return Object.fromEntries(
      Object.entries(raw).filter(
        ([key, value]: [string, any]) =>
          /^[a-z0-9_-]{1,40}$/.test(key) &&
          typeof value?.price === "string" &&
          /^price_[a-zA-Z0-9]+$/.test(value.price) &&
          typeof value.name === "string",
      ),
    ) as Record<string, { price: string; name: string }>;
  } catch {
    return {};
  }
}
export async function stripe(
  path: string,
  method = "GET",
  body?: URLSearchParams,
  idempotencyKey?: string,
) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new HttpError(503, "Subscription billing is not configured.");
  const response = await withRequestTimeout()(
    "https://api.stripe.com/v1/" + path,
    {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Stripe-Version": "2024-06-20",
        ...(body
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body?.toString(),
      cache: "no-store",
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new HttpError(
      502,
      "The payment provider could not complete the request. Please retry.",
    );
  return data;
}
