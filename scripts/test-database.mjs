import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const container = process.env.NADORIO_TEST_CONTAINER || "nadorio-v11-db";
const database = `nadorio_test_${process.pid}_${Date.now()}`;
function docker(args, input) {
  const r = spawnSync("docker", ["exec", "-i", container, ...args], {
    input,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  if (r.status !== 0)
    throw Error(r.stderr || r.stdout || `Docker exited ${r.status}`);
  return r.stdout;
}
try {
  docker(["createdb", "-U", "postgres", database]);
  const sql = (source) =>
    docker(
      ["psql", "-X", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"],
      source,
    );
  sql(readFileSync("tests/database-bootstrap.sql", "utf8"));
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    sql(readFileSync(`supabase/migrations/${file}`, "utf8"));
    console.log(`Migration PASS ${file}`);
  }
  console.log(sql(readFileSync("tests/database-access.sql", "utf8")));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    docker(["dropdb", "-U", "postgres", "--if-exists", database]);
  } catch (error) {
    console.error(`Test database cleanup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
