import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withRequestTimeout } from "../../../lib/request-fetch";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw Error("Unconfigured");
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: withRequestTimeout(4000) },
    });
    const { data, error } = await sb.rpc("v12_health");
    if (error || data?.schema !== 12) throw Error("Database unavailable");
    return NextResponse.json(
      { status: "ok", release: "12.0.0-rc.1" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
