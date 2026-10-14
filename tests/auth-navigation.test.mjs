import test from "node:test";
import assert from "node:assert/strict";
import { safeNextPath, authCallbackUrl } from "../lib/auth-navigation.ts";
import { withRequestTimeout } from "../lib/request-fetch.ts";
test("authentication redirects reject external, encoded and malformed targets", () => {
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/%2f%2fevil.test",
    "/%5cevil.test",
    "/%00evil",
    "/\nevil",
    "/%zz",
    "/auth/callback?next=/auth/callback",
    "/../auth/callback",
  ])
    assert.equal(safeNextPath(value), "/organizations", value);
  assert.equal(
    safeNextPath("/workspace/123?tab=events"),
    "/workspace/123?tab=events",
  );
  assert.equal(safeNextPath("/join?token=abc"), "/join?token=abc");
  assert.equal(safeNextPath(null, ""), "");
});
test("callback URLs retain the intended account completion path on the configured origin", () => {
  const url = new URL(
    authCallbackUrl(
      "https://app.example.test",
      "/member/complete?club=1&plan=2",
    ),
  );
  assert.equal(url.origin, "https://app.example.test");
  assert.equal(url.pathname, "/auth/callback");
  assert.equal(url.searchParams.get("next"), "/member/complete?club=1&plan=2");
});
function pendingFetch(_input, init) {
  return new Promise((resolve, reject) => {
    if (init.signal.aborted) reject(init.signal.reason);
    else
      init.signal.addEventListener("abort", () => reject(init.signal.reason), {
        once: true,
      });
  });
}
test("upstream requests time out without retrying a mutation", async () => {
  let calls = 0;
  const request = withRequestTimeout(20, async (input, init) => {
    calls++;
    assert.equal(init.method, "POST");
    return pendingFetch(input, init);
  });
  await assert.rejects(request("https://example.test", { method: "POST" }), {
    name: "TimeoutError",
  });
  assert.equal(calls, 1);
});
test("caller cancellation survives the request timeout wrapper", async () => {
  const controller = new AbortController();
  const request = withRequestTimeout(1000, pendingFetch);
  const result = request("https://example.test", { signal: controller.signal });
  controller.abort();
  await assert.rejects(result, { name: "AbortError" });
});
test("successful requests preserve the response", async () => {
  const request = withRequestTimeout(
    1000,
    async () => new Response("ok", { status: 201 }),
  );
  const response = await request("https://example.test");
  assert.equal(response.status, 201);
  assert.equal(await response.text(), "ok");
});
