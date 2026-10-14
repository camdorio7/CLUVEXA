import { NextRequest, NextResponse } from "next/server";
import { loadWorkspaceAccess } from "../../../../lib/access-context";
import { canUseModule } from "../../../../lib/modules";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: noStore });

/** Only an authorized member of the organization may read its integration metrics. */
export async function GET(req: NextRequest) {
  try {
    const clubId = req.nextUrl.searchParams.get("clubId")?.trim();
    if (
      !clubId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        clubId,
      )
    ) {
      return json({ error: "Valid organization ID required." }, 400);
    }
    const authorization = req.headers.get("authorization") || "";
    if (!/^Bearer\s+\S+$/i.test(authorization))
      return json({ error: "Sign in required." }, 401);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key)
      return json({ error: "Authentication is not configured." }, 503);

    const sb = createClient(url, key, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authError,
    } = await sb.auth.getUser();
    if (authError || !user)
      return json({ error: "Session expired. Sign in again." }, 401);

    const { access } = await loadWorkspaceAccess(sb, clubId, user.id);
    if (
      access.status !== "active" ||
      !canUseModule(access, "connected_platforms")
    )
      return json({ error: "Integration access denied." }, 403);

    const { data: platform, error: platformError } = await sb
      .from("connected_platforms")
      .select("platform_key,status")
      .eq("club_id", clubId)
      .eq("platform_key", "lindex")
      .maybeSingle();
    if (platformError)
      return json({ error: "Unable to verify integration access." }, 503);
    if (!platform || platform.status !== "connected")
      return json(
        { error: "LINDEX is not connected to this organization." },
        403,
      );

    // The current upstream is the Linderhof-specific LINDEX deployment. Never
    // serve its metrics under a different organization's ID.
    const configuredClubId = process.env.LINDEX_INTEGRATION_CLUB_ID;
    if (!configuredClubId)
      return json(
        {
          connected: false,
          error:
            "LINDEX_INTEGRATION_CLUB_ID must be configured for tenant-safe metrics.",
        },
        503,
      );
    if (configuredClubId.toLowerCase() !== clubId.toLowerCase())
      return json(
        {
          error:
            "This organization does not own the configured LINDEX integration.",
        },
        403,
      );

    const endpoint =
      process.env.LINDEX_INTEGRATION_URL ||
      "https://linderhofmembers.com/api/cluvexa-metrics";
    const secret = process.env.LINDEX_INTEGRATION_SECRET;
    if (!secret)
      return json(
        {
          connected: false,
          error: "LINDEX integration credentials are missing.",
        },
        503,
      );
    const upstream = await fetch(endpoint, {
      headers: {
        "x-cluvexa-integration-key": secret,
        accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok)
      return json(
        { connected: false, error: `LINDEX returned HTTP ${upstream.status}.` },
        502,
      );
    const payload: unknown = await upstream.json().catch(() => null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      return json({ connected: false, error: "Invalid LINDEX response." }, 502);
    return json({ ...payload, connected: true });
  } catch {
    return json(
      { connected: false, error: "Unable to retrieve integration metrics." },
      502,
    );
  }
}
