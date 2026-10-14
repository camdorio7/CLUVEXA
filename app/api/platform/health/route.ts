import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { withRequestTimeout } from "../../../../lib/request-fetch";
export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503, headers },
    );
  try {
    const jar = await cookies();
    const sb = createServerClient(url, key, {
      global: { fetch: withRequestTimeout() },
      cookies: { getAll: () => jar.getAll(), setAll: () => {} },
    });
    const auth = await sb.auth.getUser();
    if (auth.error || !auth.data.user)
      return NextResponse.json(
        { error: "Sign in required." },
        { status: 401, headers },
      );
    const owner = await sb.rpc("is_super_admin");
    if (owner.error || owner.data !== true)
      return NextResponse.json(
        { error: "Platform owner access required." },
        { status: 403, headers },
      );
    const [db, migration] = await Promise.all([
      sb.from("clubs").select("id", { count: "exact", head: true }),
      sb.from("module_catalog").select("module_key,available").limit(1),
    ]);
    return NextResponse.json(
      {
        checkedAt: new Date().toISOString(),
        checks: [
          {
            name: "Authentication",
            status: "Operational",
            detail: "The current session was verified by Supabase Auth.",
          },
          {
            name: "Database",
            status: db.error ? "Unavailable" : "Operational",
            detail: db.error
              ? "Organization query failed."
              : "Authenticated organization query succeeded.",
          },
          {
            name: "v11 schema",
            status: migration.error ? "Unavailable" : "Operational",
            detail: migration.error
              ? "Module availability could not be queried. Apply migration 019."
              : "The v11 module catalog is queryable.",
          },
          {
            name: "Email provider",
            status: process.env.RESEND_API_KEY
              ? "Not verified"
              : "Not configured",
            detail:
              "Delivery requires a verified sender and an authorized test send.",
          },
          {
            name: "Website contact service",
            status: process.env.SUPABASE_SERVICE_ROLE_KEY
              ? "Not verified"
              : "Not configured",
            detail:
              "Service key presence only; test an inquiry against a published test site.",
          },
          {
            name: "External website publishing",
            status: process.env.NADORIO_WEBSITE_CONFIGS
              ? "Not verified"
              : "Not configured",
            detail: "Optional per-organization GitHub connection.",
          },
          {
            name: "Payments",
            status: "Not configured",
            detail:
              "Billing records are maintained manually; no payment processor is connected.",
          },
        ],
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Health checks could not complete." },
      { status: 503, headers },
    );
  }
}
