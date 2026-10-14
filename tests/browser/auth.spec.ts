import { test, expect } from "@playwright/test";
const invite = "/join?token=40000000-0000-0000-0000-000000000001";
test("failed login can be retried instead of leaving the button busy", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("member@example.test");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Invalid or expired",
  );
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
});
test("password recovery sends an application callback URL and displays confirmation", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("member@example.test");
  const request = page.waitForRequest(
    (req) => req.url().includes("/auth/v1/recover") && req.method() === "POST",
  );
  await page.getByRole("button", { name: "Send reset link" }).click();
  const recovery = new URL((await request).url());
  const redirect = new URL(recovery.searchParams.get("redirect_to")!);
  expect(redirect.pathname).toBe("/auth/callback");
  expect(redirect.searchParams.get("next")).toBe("/reset-password");
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
});
test("a verified PKCE recovery callback writes a session and opens the password form", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "sb-127-auth-token-flow-0123456789abcdef0123456789abcdef-code-verifier",
      value:
        "base64-" +
        Buffer.from(JSON.stringify("fixture-verifier")).toString("base64url"),
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto(
    "/auth/callback?code=valid-recovery-code&next=%2Freset-password&sb_flow_id=0123456789abcdef0123456789abcdef",
  );
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill("new-password");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("different-password");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "do not match",
  );
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("new-password");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/organizations$/);
});
test("invalid callback remains on this origin and provides a useful error", async ({
  page,
}) => {
  await page.goto("/auth/callback?code=expired&next=https%3A%2F%2Fevil.test");
  await expect(page).toHaveURL(/127\.0\.0\.1:3100\/login\?/);
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "expired",
  );
});
test("reset page without a session offers a new reset link", async ({
  page,
}) => {
  await page.goto("/reset-password");
  await expect(
    page.getByRole("link", { name: "Request a new reset link" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save new password" }),
  ).toHaveCount(0);
});
test("new invitees see email confirmation rather than a false accepted-invitation message", async ({
  page,
}) => {
  await page.goto(invite);
  await page.getByLabel("Password", { exact: true }).fill("new-password");
  await page
    .getByRole("button", { name: "Create account & accept invitation" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in to an existing account" }),
  ).toBeVisible();
});
test("existing invitees can explicitly sign in and accept their invitation", async ({
  page,
}) => {
  await page.goto(invite);
  await page
    .getByRole("button", { name: "Already have an account? Sign in" })
    .click();
  await page.getByLabel("Password", { exact: true }).fill("valid-password");
  await page
    .getByRole("button", { name: "Sign in & accept invitation" })
    .click();
  await expect(page).toHaveURL(
    /\/workspace\/20000000-0000-0000-0000-000000000001$/,
  );
  await expect(
    page.getByRole("heading", { name: "Welcome, Alex." }),
  ).toBeVisible();
});

test("membership signup distinguishes a failed organization query from an empty list", async ({
  page,
}) => {
  await page.route("**/rest/v1/rpc/list_public_nadorio_clubs", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Database temporarily unavailable" }),
    }),
  );
  await page.goto("/member/join");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Organizations could not be loaded",
  );
  await expect(
    page.getByText("No organizations match your search."),
  ).toHaveCount(0);
});
test("membership completion exposes a retry when its database request fails", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "sb-127-auth-token-code-verifier",
      value:
        "base64-" +
        Buffer.from(JSON.stringify("fixture-verifier")).toString("base64url"),
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  const route = "**/rest/v1/rpc/request_club_membership_v41";
  await page.route(route, (request) =>
    request.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Application service unavailable" }),
    }),
  );
  const next =
    "/member/complete?club=20000000-0000-0000-0000-000000000001&plan=30000000-0000-0000-0000-000000000001";
  await page.goto(
    "/auth/callback?code=valid-recovery-code&next=" + encodeURIComponent(next),
  );
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Application service unavailable",
  );
  await page.unroute(route);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL(/\/member\/pending$/);
});
