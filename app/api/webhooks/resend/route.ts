import { NextRequest, NextResponse } from "next/server";
import { verifyResend } from "../../../../lib/webhook-signatures";
import {
  serviceClient,
  apiError,
  HttpError,
} from "../../../../lib/server-access";
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) throw new HttpError(503, "Email webhooks are not configured.");
    const body = await req.text();
    if (body.length > 1000000)
      throw new HttpError(413, "Webhook payload too large.");
    const id = req.headers.get("svix-id") || "";
    if (
      !verifyResend(
        body,
        id,
        req.headers.get("svix-timestamp") || "",
        req.headers.get("svix-signature") || "",
        secret,
      )
    )
      throw new HttpError(400, "Invalid webhook signature.");
    const event = JSON.parse(body);
    if (
      ["email.delivered", "email.bounced", "email.complained"].includes(
        event.type,
      ) &&
      typeof event.data?.email_id === "string"
    ) {
      const { error } = await serviceClient().rpc("v12_email_event", {
        event_key: id,
        email_id: event.data.email_id,
        event_kind: event.type,
        event_at: event.created_at,
      });
      if (error) throw error;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    return apiError(error);
  }
}
