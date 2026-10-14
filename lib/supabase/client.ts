import { createBrowserClient } from "@supabase/ssr";
import { withRequestTimeout } from "../request-fetch";
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error(
      "Sign-in is temporarily unavailable. Please contact your organization administrator.",
    );
  return createBrowserClient(url, key, {
    global: { fetch: withRequestTimeout() },
  });
}
