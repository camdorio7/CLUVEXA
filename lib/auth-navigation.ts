/** Keep authentication redirects on this application, including encoded URL tricks. */
export function safeNextPath(
  value: string | null | undefined,
  fallback = "/organizations",
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u001f]/.test(decoded))
      return fallback;
    const parsed = new URL(value, "https://nadorio.invalid");
    if (
      parsed.origin !== "https://nadorio.invalid" ||
      parsed.pathname.startsWith("/auth/")
    )
      return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}
export function authCallbackUrl(origin: string, next: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", safeNextPath(next));
  return url.toString();
}
