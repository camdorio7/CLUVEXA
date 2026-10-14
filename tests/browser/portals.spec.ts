import { test, expect, type BrowserContext } from "@playwright/test";
const id = "20000000-0000-0000-0000-000000000001";
async function login(context: BrowserContext, role: string) {
  const sub = "10000000-0000-0000-0000-000000000004";
  const claims = {
    sub,
    aud: "authenticated",
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    test_role: role,
  };
  const token =
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(JSON.stringify(claims)).toString("base64url") +
    ".testsignature";
  const session = {
    access_token: token,
    refresh_token: "fixture-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: claims.exp,
    user: {
      id: sub,
      email: role + "@example.test",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
    },
  };
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value:
        "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"),
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
}
test("anonymous protected route redirects to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
test("member dashboard and organization navigation render without a button grid", async ({
  page,
  context,
}) => {
  await login(context, "member");
  await page.goto(`/workspace/${id}`);
  await expect(
    page.getByRole("heading", { name: "Welcome, Alex." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Alex Morgan" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "My scorecard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Staff permissions" }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Quick access" })).toHaveCount(
    0,
  );
});
test("member cannot open administrator URL", async ({ page, context }) => {
  await login(context, "member");
  const r = await page.goto(`/workspace/${id}/settings`);
  expect(r?.status()).toBe(403);
  await expect(
    page.getByRole("heading", { name: "Access restricted" }),
  ).toBeVisible();
});
test("disabled module URL denied before rendering", async ({
  page,
  context,
}) => {
  await login(context, "disabled");
  const r = await page.goto(`/workspace/${id}/scorecard`);
  expect(r?.status()).toBe(403);
});
test("inactive organization denied", async ({ page, context }) => {
  await login(context, "inactive");
  expect((await page.goto(`/workspace/${id}`))?.status()).toBe(403);
});
test("different organization URL denied", async ({ page, context }) => {
  await login(context, "member");
  expect(
    (
      await page.goto("/workspace/20000000-0000-0000-0000-000000000002")
    )?.status(),
  ).toBe(403);
});
test("staff read grant does not display create or edit controls", async ({
  page,
  context,
}) => {
  await login(context, "staff");
  await page.goto(`/workspace/${id}/operations`);
  await expect(
    page.getByRole("cell", { name: "Prepare meeting room" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add task" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Complete", exact: true }),
  ).toHaveCount(0);
  expect((await page.goto(`/workspace/${id}/events`))?.status()).toBe(403);
});
test("HOA navigation does not require golf", async ({ page, context }) => {
  await login(context, "hoa");
  await page.goto(`/workspace/${id}`);
  await expect(
    page.getByRole("heading", { name: "Welcome, Alex." }),
  ).toBeVisible();
  await expect(
    page.locator("aside").getByRole("link", { name: "My scorecard" }),
  ).toHaveCount(0);
  expect((await page.goto(`/workspace/${id}/golf`))?.status()).toBe(403);
});
test("mobile portal navigation opens, closes and fits viewport", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(context, "admin");
  await page.goto(`/workspace/${id}`);
  await expect(
    page.getByRole("heading", { name: "Welcome, Alex." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("link", { name: "Dashboard", exact: true }),
  ).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/admin-mobile.png", fullPage: true });
});
test("platform health distinguishes live checks from configuration presence", async ({
  page,
  context,
}) => {
  await login(context, "super");
  await page.goto("/health");
  await expect(
    page.getByRole("heading", { name: "Database", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Authenticated organization query succeeded."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Billing records are maintained manually; no payment processor is connected.",
    ),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/platform-health.png",
    fullPage: true,
  });
});
test("platform health API refuses member access", async ({ context, page }) => {
  await login(context, "member");
  const r = await page.request.get("/api/platform/health");
  expect(r.status()).toBe(403);
});
test("public universal website renders organization content on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/site/${id}`);
  await expect(
    page.getByRole("heading", { name: "A place to belong" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("link", { name: "About us", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Our organization brings people together."),
  ).toBeVisible();
});

test("public contact validation and missing configuration are explicit", async ({
  request,
}) => {
  const path = `/api/site/${id}/contact`;
  expect(
    (
      await request.post(path, {
        data: { name: "", email: "bad", message: "" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (await request.post(path, { data: { website: "spam" } })).status(),
  ).toBe(200);
  expect(
    (
      await request.post(path, {
        data: {
          name: "Test",
          email: "test@example.test",
          message: "A test inquiry",
        },
      })
    ).status(),
  ).toBe(503);
});

test("platform sidebar persists through navigation and browser back without a verification screen", async ({
  page,
  context,
}) => {
  await login(context, "super");
  await page.goto("/dashboard");
  const sidebar = page.locator("#portal-navigation");
  await expect(
    sidebar.getByRole("link", { name: "Platform health", exact: true }),
  ).toBeVisible();
  await sidebar.evaluate((el) =>
    el.setAttribute("data-persistence-check", "original"),
  );
  let browserAuthChecks = 0;
  page.on("request", (req) => {
    if (req.url().includes("/auth/v1/user")) browserAuthChecks++;
  });
  await sidebar
    .getByRole("link", { name: "Platform health", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Platform health", exact: true }),
  ).toBeVisible();
  await expect(sidebar).toHaveAttribute("data-persistence-check", "original");
  await expect(
    sidebar.getByRole("link", { name: "Platform health", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Verifying platform access…")).toHaveCount(0);
  expect(browserAuthChecks).toBe(0);
  await page.goBack();
  await expect(
    sidebar.getByRole("link", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(sidebar).toHaveAttribute("data-persistence-check", "original");
  await page.screenshot({
    path: "artifacts/platform-navigation.png",
    fullPage: true,
  });
});

for (const role of ["admin", "staff", "member"]) {
  test(`${role} navigation keeps the organization shell and exposes links directly`, async ({
    page,
    context,
  }) => {
    await login(context, role);
    await page.goto(`/workspace/${id}`);
    const sidebar = page.locator("#portal-navigation");
    await expect(
      sidebar.getByRole("link", { name: "My profile", exact: true }),
    ).toBeVisible();
    await expect(sidebar.locator("details")).toHaveCount(0);
    await sidebar.evaluate((el) =>
      el.setAttribute("data-persistence-check", "original"),
    );
    let moduleReloads = 0;
    page.on("request", (req) => {
      if (req.url().includes("/rest/v1/club_modules")) moduleReloads++;
    });
    await sidebar
      .getByRole("link", { name: "My profile", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/workspace/${id}/profile$`));
    await expect(sidebar).toHaveAttribute("data-persistence-check", "original");
    await expect(
      sidebar.getByRole("link", { name: "My profile", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    expect(moduleReloads).toBe(0);
    await sidebar.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome, Alex." }),
    ).toBeVisible();
    await expect(sidebar).toHaveAttribute("data-persistence-check", "original");
  });
}

test("mobile navigation closes after choosing a page and restores focus to content", async ({
  page,
  context,
}) => {
  await login(context, "member");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/workspace/${id}`);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .locator("#portal-navigation")
    .getByRole("link", { name: "My profile", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#portal-content")).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
