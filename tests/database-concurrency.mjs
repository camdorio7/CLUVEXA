import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const exec = promisify(execFile);
export async function concurrencyTests(container, database) {
  const sql = async (source) => {
    const { stdout } = await exec("docker", [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-qAt",
      "-U",
      "postgres",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      source,
    ]);
    return stdout.trim().split("\n").at(-1);
  };
  const fixture = readFileSync("tests/database-access.sql", "utf8").split(
    "set local role authenticated;",
  )[0];
  await sql(fixture + "commit;");
  const org = "20000000-0000-0000-0000-000000000001",
    event = "50000000-0000-0000-0000-000000000001";
  const asUser = (suffix, query) =>
    sql(
      `begin;set local role authenticated;select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-00000000000${suffix}',true);${query};commit;`,
    );
  await Promise.all(
    [4, 8].map((user) =>
      asUser(user, `select public.v12_register_event('${event}')`),
    ),
  );
  assert.equal(
    await sql(
      `select count(*) from event_registrations where event_id='${event}' and status='registered'`,
    ),
    "1",
  );
  assert.equal(
    await sql(
      `select count(*) from event_registrations where event_id='${event}' and status='waitlisted'`,
    ),
    "1",
  );
  console.log(
    "Concurrency PASS competing registrations never oversell the last seat",
  );
  const edits = await Promise.allSettled(
    ["One", "Two"].map((title) =>
      asUser(
        2,
        `select public.v12_save_site('${org}','{"title":"${title}","about":"Introduction"}',0,false)`,
      ),
    ),
  );
  assert.equal(edits.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    await sql(`select version from site_drafts where club_id='${org}'`),
    "1",
  );
  console.log(
    "Concurrency PASS simultaneous draft edits reject a stale writer",
  );
  await Promise.all(
    [1, 2].map((i) =>
      asUser(
        2,
        `select public.v12_import_members('${org}','[{"full_name":"Import ${i}","email":"concurrent@example.test"}]',null,false)`,
      ),
    ),
  );
  assert.equal(
    await sql(
      `select count(*) from members where club_id='${org}' and email='concurrent@example.test'`,
    ),
    "1",
  );
  console.log(
    "Concurrency PASS simultaneous imports cannot create duplicate emails",
  );
  const checkout = await Promise.allSettled(
    ["professional", "enterprise"].map((plan) =>
      sql(
        `begin;set local role service_role;select public.v12_reserve_checkout('${org}','${plan}');commit;`,
      ),
    ),
  );
  assert.equal(checkout.filter((r) => r.status === "fulfilled").length, 1);
  console.log("Concurrency PASS competing checkout plans serialize");
  await asUser(
    2,
    `select public.v12_publish_announcement('${org}','70000000-0000-0000-0000-000000000001','Notice','Hello','all',true)`,
  );
  const claims = await Promise.all(
    Array.from({ length: 12 }, () =>
      sql(
        "begin;set local role service_role;select public.v12_claim_email();commit;",
      ),
    ),
  );
  const ids = claims
    .filter((v) => v && v !== "null")
    .map((v) => JSON.parse(v).id);
  assert.ok(ids.length > 0);
  assert.equal(new Set(ids).size, ids.length);
  console.log(
    "Concurrency PASS parallel email workers claim distinct deliveries",
  );
}
