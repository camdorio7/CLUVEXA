import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "../../../lib/auth-navigation";
import { withRequestTimeout } from "../../../lib/request-fetch";
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  // Relative redirects preserve the browser origin behind hosting proxies.
  const redirect = (path: string) =>
    new NextResponse(null, { status: 303, headers: { Location: path } });
  const response = redirect(next);
  response.headers.set("Cache-Control", "private, no-store");
  const failure = () => {
    const query = new URLSearchParams({ error: "auth_link_expired", next });
    const failed = redirect(`/login?${query}`);
    failed.headers.set("Cache-Control", "private, no-store");
    for (const cookie of response.cookies.getAll()) failed.cookies.set(cookie);
    return failed;
  };
  const code = request.nextUrl.searchParams.get("code");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!code || !url || !key) return failure();
  try {
    const sb = createServerClient(url, key, {
      global: { fetch: withRequestTimeout() },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    const { error } = await sb.auth.exchangeCodeForSession(
      code,
      request.nextUrl.searchParams.has("sb_flow_id")
        ? { flowId: request.nextUrl.searchParams.get("sb_flow_id")! }
        : undefined,
    );
    if (error) return failure();
    return response;
  } catch {
    return failure();
  }
}
