import { existsSync, readFileSync, readdirSync } from "node:fs";
import { modules, workspaceRouteAccess } from "../lib/modules.ts";
let failures = 0;
function check(ok, message) {
  console.log(`${ok ? "PASS" : "FAIL"} ${message}`);
  if (!ok) failures++;
}
for (const file of [
  "proxy.ts",
  "lib/modules.ts",
  "lib/organization-types.ts",
  "lib/access-context.ts",
  "supabase/migrations/019_nadorio_v11_access.sql",
  "tests/database-access.sql",
  "tests/browser/portals.spec.ts",
  "docs/V11-DEPLOYMENT.md",
  "docs/V11-AUDIT.md",
  "supabase/migrations/020_nadorio_v12_operations.sql",
  "tests/database-v12.sql",
  "docs/V12-DEPLOYMENT.md",
])
  check(existsSync(file), file);
for (const module of modules.filter((m) => m.available))
  check(
    existsSync(`app/workspace/[id]/${module.path}/page.tsx`),
    `${module.key} route exists`,
  );
const source = readFileSync("app/api/email/announcement/route.ts", "utf8");
check(
  source.includes("v12_publish_announcement") &&
    /to:\s*\[job.recipient\]/.test(readFileSync("lib/email-worker.ts", "utf8")),
  "Announcements queue isolated recipient messages",
);
const contact = readFileSync("app/api/site/[id]/contact/route.ts", "utf8");
check(
  contact.includes("v11_public_site") &&
    contact.includes("body.website") &&
    contact.includes("SUPABASE_SERVICE_ROLE_KEY"),
  "Contact retains published-site check, honeypot and server insertion",
);
const manifest = JSON.parse(readFileSync("package.json", "utf8")),
  lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
check(
  manifest.version === lock.version &&
    lock.packages[""].version === manifest.version,
  "Manifest and lockfile release versions agree",
);
const access = {
  role: "member",
  active: true,
  status: "active",
  modules: [],
  permissions: [],
};
for (const dir of readdirSync("app/workspace/[id]", {
  withFileTypes: true,
}).filter((d) => d.isDirectory())) {
  check(
    !workspaceRouteAccess(access, dir.name) ||
      ["profile", "card"].includes(dir.name),
    `Unlicensed member cannot open ${dir.name}`,
  );
}
check(
  !readFileSync("app/(platform)/billing/page.tsx", "utf8").includes(
    "Manage plan <",
  ),
  "No inert billing actions",
);
console.log(
  "Live Supabase Auth, email delivery, migrations on existing production data, and full acceptance testing remain deployment checks.",
);
if (failures) process.exitCode = 1;
