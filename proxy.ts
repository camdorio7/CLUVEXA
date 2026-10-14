import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { AccessError, loadWorkspaceAccess } from "./lib/access-context";
import { withRequestTimeout } from "./lib/request-fetch";
import { workspaceRouteAccess } from "./lib/modules";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const started = performance.now();
  let response = NextResponse.next({ request });
  const finish = (res: NextResponse) => {
    for (const cookie of response.cookies.getAll()) res.cookies.set(cookie);
    res.headers.set("Cache-Control", "private, no-store");
    res.headers.set(
      "Server-Timing",
      `authorization;dur=${(performance.now() - started).toFixed(1)}`,
    );
    return res;
  };
  const denied = (status: number, message: string) =>
    finish(
      new NextResponse(
        `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NADORIO · Access</title><body style="font:18px system-ui;max-width:640px;margin:15vh auto;padding:24px"><h1>${status === 503 ? "Workspace unavailable" : "Access restricted"}</h1><p>${message}</p><a href="/login">Sign in</a> · <a href="/organizations">Your organizations</a></body></html>`,
        { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
      ),
    );
  if (!url || !key)
    return denied(
      503,
      "Authentication is not configured. Add the Supabase environment variables to start this workspace.",
    );
  const sb = createServerClient(url, key, {
    global: { fetch: withRequestTimeout() },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  try {
    const {
      data: { user },
      error,
    } = await sb.auth.getUser();
    if (error || !user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", request.nextUrl.pathname);
      return finish(NextResponse.redirect(login));
    }
    if (request.nextUrl.pathname === "/organizations") return finish(response);
    const match = /^\/workspace\/([^/]+)(?:\/(.*))?$/.exec(
      request.nextUrl.pathname,
    );
    if (match) {
      if (!/^[0-9a-f-]{36}$/i.test(match[1]))
        return denied(403, "Organization access denied.");
      const { access } = await loadWorkspaceAccess(sb, match[1], user.id);
      if (!workspaceRouteAccess(access, (match[2] || "").replace(/\/$/, "")))
        return denied(
          403,
          "This feature is unavailable, disabled, or outside your assigned permissions.",
        );
    } else {
      const { data, error } = await sb.rpc("is_super_admin");
      if (error)
        return denied(503, "Platform permissions could not be verified.");
      if (data !== true)
        return denied(403, "CD7 platform owner access is required.");
    }
    return finish(response);
  } catch (error) {
    return denied(
      error instanceof AccessError ? error.status : 503,
      error instanceof AccessError
        ? error.message
        : "Unable to verify your access. Please retry.",
    );
  }
}
export const config = {
  matcher: [
    "/workspace/:path*",
    "/organizations",
    "/dashboard",
    "/clubs/:path*",
    "/launch-center",
    "/members",
    "/settings",
    "/module-licensing",
    "/marketplace",
    "/integrations",
    "/billing",
    "/plans",
    "/analytics",
    "/support",
    "/security",
    "/health",
    "/organization-types",
  ],
};
