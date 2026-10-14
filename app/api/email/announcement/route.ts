import { NextRequest, NextResponse } from "next/server";
import {
  organizationAdmin,
  apiError,
  HttpError,
} from "../../../../lib/server-access";
import { canUseModule } from "../../../../lib/modules";
export async function POST(req: NextRequest) {
  try {
    const {
      clubId,
      title,
      body,
      audience = "all",
      requestKey,
    } = await req.json();
    const { sb, access } = await organizationAdmin(req, clubId);
    if (!canUseModule(access, "communications", "create"))
      throw new HttpError(403, "Communications is not enabled.");
    if (
      !process.env.RESEND_API_KEY ||
      (process.env.CRON_SECRET?.length || 0) < 24
    )
      throw new HttpError(
        503,
        "Email delivery and its scheduler must be configured before queueing.",
      );
    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.length > 180 ||
      typeof body !== "string" ||
      !body.trim() ||
      body.length > 12000 ||
      !["all", "staff", "members"].includes(audience) ||
      typeof requestKey !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(requestKey)
    )
      throw new HttpError(400, "Invalid message, audience, or request key.");
    const { data, error } = await sb.rpc("v12_publish_announcement", {
      target_club: clubId,
      request_key_value: requestKey,
      subject_value: title,
      body_value: body,
      audience_value: audience,
      email_value: true,
    });
    if (error) throw new HttpError(400, error.message);
    return NextResponse.json(
      { ...data, status: "queued" },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
