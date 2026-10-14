import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { loadWorkspaceAccess } from "./access-context";
import { withRequestTimeout } from "./request-fetch";
import { isAdmin } from "./modules";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function serviceClient(timeoutMs = 12000) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new HttpError(503, "Server services are not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: withRequestTimeout(timeoutMs) },
  });
}
export async function organizationAdmin(req: NextRequest, id: unknown) {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))
    throw new HttpError(400, "A valid organization ID is required.");
  const authorization = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization))
    throw new HttpError(401, "Sign in required.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new HttpError(503, "Authentication is not configured.");
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: withRequestTimeout(),
      headers: { Authorization: authorization },
    },
  });
  const {
    data: { user },
    error,
  } = await sb.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
  if (error || !user) throw new HttpError(401, "Your session has expired.");
  const result = await loadWorkspaceAccess(sb, id, user.id);
  if (!isAdmin(result.access.role) || result.access.status !== "active")
    throw new HttpError(
      403,
      "Active organization administrator access required.",
    );
  return { sb, user, ...result };
}
export function apiError(error: unknown) {
  const status = error instanceof HttpError ? error.status : 500;
  return NextResponse.json(
    {
      error:
        error instanceof HttpError
          ? error.message
          : "The request could not complete. Please retry.",
    },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
export function appOrigin() {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!value)
    throw new HttpError(503, "The application URL is not configured.");
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" &&
    parsed.hostname !== "localhost" &&
    parsed.hostname !== "127.0.0.1"
  )
    throw new HttpError(503, "The application URL must use HTTPS.");
  return parsed.origin;
}
