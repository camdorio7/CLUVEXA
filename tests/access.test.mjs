import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  canUseModule,
  workspaceRouteAccess,
  navigationFor,
  modules,
} from "../lib/modules.ts";
import {
  organizationTypes,
  getOrganizationType,
} from "../lib/organization-types.ts";
import { organizationTheme } from "../lib/organization-theme.ts";
const license = {
  module_key: "golf",
  licensed: true,
  club_enabled: true,
  member_visible: true,
  available: true,
};
const member = {
  role: "member",
  active: true,
  status: "active",
  modules: [license],
  permissions: [],
};
test("member navigation matches licensed visible services", () => {
  assert.equal(canUseModule(member, "golf"), true);
  assert.equal(workspaceRouteAccess(member, "scorecard"), true);
  assert.deepEqual(
    navigationFor(member).map((m) => m.key),
    ["golf"],
  );
});
test("disabled, unavailable, unlicensed and invisible modules fail closed", () => {
  for (const field of [
    "licensed",
    "club_enabled",
    "member_visible",
    "available",
  ])
    assert.equal(
      canUseModule(
        { ...member, modules: [{ ...license, [field]: false }] },
        "golf",
      ),
      false,
      field,
    );
});
test("inactive account, organization and unknown roles fail closed", () => {
  assert.equal(workspaceRouteAccess({ ...member, active: false }, ""), false);
  assert.equal(
    workspaceRouteAccess({ ...member, status: "suspended" }, "profile"),
    false,
  );
  assert.equal(canUseModule({ ...member, role: "unknown" }, "golf"), false);
});
test("platform owners also require module licensing", () =>
  assert.equal(
    canUseModule({ ...member, role: "super_admin", modules: [] }, "golf"),
    false,
  ));
test("staff and managers need explicit per-module capabilities", () => {
  for (const role of ["staff", "manager"]) {
    const staff = { ...member, role };
    assert.equal(canUseModule(staff, "golf"), false);
    const allowed = {
      ...staff,
      permissions: [{ module_key: "golf", can_view: true, can_create: true }],
    };
    assert.equal(canUseModule(allowed, "golf"), true);
    assert.equal(canUseModule(allowed, "golf", "create"), true);
    assert.equal(canUseModule(allowed, "golf", "edit"), false);
  }
});
test("admin route, private member list and unsupported routes denied to members", () => {
  for (const path of [
    "settings",
    "audit",
    "permissions",
    "people",
    "members",
    "household",
    "industry",
    "notifications",
    "anything",
  ])
    assert.equal(workspaceRouteAccess(member, path), false, path);
});
test("organization types are recommendations, not authorization", () => {
  assert.ok(getOrganizationType("hoa").modules.includes("members"));
  assert.ok(!getOrganizationType("hoa").modules.includes("golf"));
  assert.ok(getOrganizationType("golf_club").modules.includes("golf"));
  assert.equal(canUseModule(member, "golf"), true);
  assert.equal(getOrganizationType("unknown"), organizationTypes.other);
});
test("all supported module routes exist; unsupported modules remain inaccessible", () => {
  for (const m of modules) {
    assert.ok(existsSync(`app/workspace/[id]/${m.path}/page.tsx`), m.path);
    if (!m.available)
      assert.equal(
        canUseModule(
          {
            ...member,
            role: "super_admin",
            modules: [{ ...license, module_key: m.key }],
          },
          m.key,
        ),
        false,
      );
  }
});
test("foreground contrast meets WCAG AA for organization primary colors", () => {
  const luminance = (hex) => {
    const rgb = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((s) => (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  for (const color of [
    "#000000",
    "#ffffff",
    "#808080",
    "#ff0000",
    "#275e72",
    "#00ff00",
    "#0000ff",
    "#a08060",
    ...Array.from(
      { length: 256 },
      (_, i) => "#" + i.toString(16).padStart(2, "0").repeat(3),
    ),
  ]) {
    const theme = organizationTheme(color);
    const a = luminance(color),
      b = luminance(theme["--club-on-primary"]);
    assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, color);
  }
});
test("invalid brand values fall back safely", () =>
  assert.equal(
    organizationTheme("url(javascript:bad)")["--club-primary"],
    "#275e72",
  ));

test("brand text remains readable on light surfaces", () => {
  for (const color of ["#ffffff", "#ffff00", "#00ff00", "#000000"]) {
    const theme = organizationTheme(color);
    const rgb = [1, 3, 5]
      .map(
        (i) => parseInt(theme["--club-primary-text"].slice(i, i + 2), 16) / 255,
      )
      .map((s) => (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4));
    const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    assert.ok(1.05 / (luminance + 0.05) >= 4.5);
  }
});
