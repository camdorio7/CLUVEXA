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
  return token;
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
      "Organization subscriptions use Stripe Checkout, signed webhooks, and the customer portal. Confirm a test payment before enabling live billing.",
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

test("v12 administrator launch checklist and billing use persistent navigation", async ({
  page,
  context,
}) => {
  await login(context, "admin");
  await page.goto(`/workspace/${id}/onboarding`);
  await expect(
    page.getByRole("heading", { name: "Organization launch checklist" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record setup complete" }),
  ).toBeEnabled();
  await page
    .getByRole("link", { name: "Subscription & billing", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Subscription & billing", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Online billing is awaiting platform configuration."),
  ).toBeVisible();
});
test("v12 CSV validation requires review before importing", async ({
  page,
  context,
}) => {
  await login(context, "admin");
  await page.goto(`/workspace/${id}/members`);
  await page.getByText("Import members from CSV", { exact: true }).click();
  await page.getByLabel("Member CSV").setInputFiles({
    name: "members.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("full_name,email\nAlex Test,alex@example.test\n"),
  });
  await expect(
    page.getByRole("button", { name: "Import 1 members" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Validate import" }).click();
  await expect(
    page.getByRole("button", { name: "Import 1 members" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Import 1 members" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "1 members imported." }),
  ).toBeVisible();
});
test("v12 website draft saves preserve live status and preview stays private", async ({
  page,
  context,
}) => {
  await login(context, "admin");
  await page.goto(`/workspace/${id}/site-builder`);
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Draft saved. The live website is unchanged.",
  );
  await expect(
    page.getByRole("button", { name: "Unpublish website", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Preview saved draft" }).click();
  await expect(
    page.getByRole("heading", { name: "Private draft title" }),
  ).toBeVisible();
  await expect(
    page.getByText("Private preview of the saved draft.", { exact: false }),
  ).toBeVisible();
});
test("members cannot navigate to billing or private preview", async ({
  page,
  context,
}) => {
  await login(context, "member");
  for (const path of ["billing", "onboarding", "site-builder/preview"]) {
    expect((await page.goto(`/workspace/${id}/${path}`))?.status()).toBe(403);
    await expect(
      page.getByRole("heading", { name: "Access restricted" }),
    ).toBeVisible();
  }
});
test("public health exposes readiness without operational information", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    status: "ok",
    release: "12.0.0-rc.1",
  });
  const internal = await request.get("/api/operations/health");
  expect([401, 503]).toContain(internal.status());
  expect(await internal.text()).not.toContain("overdueEmails");
});

test("full event offers waitlist and downloads a valid calendar", async ({
  page,
  context,
}) => {
  await login(context, "member");
  let joined = false;
  await page.route("**/rest/v1/rpc/v12_register_event", async (route) => {
    joined = true;
    await route.fulfill({
      json: { id: "registration-1", status: "waitlisted" },
    });
  });
  await page.route("**/rest/v1/event_registrations?**", async (route) =>
    route.fulfill({
      json: joined
        ? [
            {
              id: "registration-1",
              event_id: "50000000-0000-0000-0000-000000000001",
              user_id: "10000000-0000-0000-0000-000000000004",
              status: "waitlisted",
            },
          ]
        : [],
    }),
  );
  await page.goto(`/workspace/${id}/events`);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add to calendar" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("nadorio-event.ics");
  await page.getByRole("button", { name: "Join waitlist" }).click();
  await expect(page.getByRole("status")).toContainText(
    "You joined the waitlist",
  );
  await expect(
    page.getByText("You are on the waitlist", { exact: true }),
  ).toBeVisible();
});
test("billing API rejects missing authentication and member roles", async ({
  context,
  request,
}) => {
  const missing = await request.post("/api/billing/checkout", {
    data: { clubId: id, plan: "professional" },
  });
  expect(missing.status()).toBe(401);
  const token = await login(context, "member");
  const member = await request.post("/api/billing/checkout", {
    headers: { Authorization: `Bearer ${token}` },
    data: { clubId: id, plan: "professional" },
  });
  expect(member.status()).toBe(403);
});
