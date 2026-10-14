import { createClient } from "./supabase/client";
import { withRequestTimeout } from "./request-fetch";
export async function portalApi(path: string, body?: unknown) {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  if (!session) throw Error("Sign in again to continue.");
  const response = await withRequestTimeout(30000)(path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw Error(result.error || "Unable to complete this request.");
  return result;
}
