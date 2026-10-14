import type { SupabaseClient } from "@supabase/supabase-js";
import { withRequestTimeout } from "./request-fetch.ts";
export async function processEmailJob(
  sb: SupabaseClient,
  job: any,
  send: typeof fetch = withRequestTimeout(),
) {
  let accepted: string | null = null,
    errorValue: string | null = null,
    permanent = false;
  try {
    const response = await send("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `nadorio-delivery-${job.id}`,
      },
      body: JSON.stringify({
        from:
          process.env.NADORIO_EMAIL_FROM ||
          "NADORIO <notifications@nadorio.com>",
        to: [job.recipient],
        subject: job.subject,
        text: job.body,
        reply_to: job.reply_to || process.env.NADORIO_REPLY_TO || undefined,
      }),
      cache: "no-store",
    });
    if (response.ok) {
      const result = await response.json();
      if (typeof result.id !== "string")
        throw Error("Provider did not return a message ID");
      accepted = result.id;
    } else {
      errorValue = `Provider HTTP ${response.status}`;
      permanent =
        response.status >= 400 &&
        response.status < 500 &&
        ![408, 409, 429].includes(response.status);
    }
  } catch {
    errorValue =
      "Provider request did not confirm acceptance; retry uses the same idempotency key";
  }
  const { data, error } = await sb.rpc("v12_finish_email", {
    delivery_id: job.id,
    lease: job.lease_token,
    accepted_id: accepted,
    error_value: errorValue,
    permanent,
  });
  if (error || !data) throw Error("Delivery result could not be recorded");
  return accepted ? "accepted" : permanent ? "failed" : "retry";
}
