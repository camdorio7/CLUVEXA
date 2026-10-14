import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { parseMemberCsv } from "../lib/member-csv.ts";
import { eventCalendar } from "../lib/calendar.ts";
import { verifyStripe, verifyResend } from "../lib/webhook-signatures.ts";
import { processEmailJob } from "../lib/email-worker.ts";
test("CSV supports BOM, quoted commas, escaped quotes, CRLF and optional fields", () => {
  assert.deepEqual(
    parseMemberCsv(
      '\uFEFFfull_name,email\r\n"Morgan, Alex",alex@example.test\r\n"Pat ""PJ"" Jones",\r\n',
    ),
    [
      { full_name: "Morgan, Alex", email: "alex@example.test" },
      { full_name: 'Pat "PJ" Jones', email: "" },
    ],
  );
});
test("CSV rejects malformed quoting, duplicate headers, oversized batches and columns", () => {
  for (const csv of [
    'full_name,email\n"broken,x',
    "full_name,full_name\na,b",
    "email\nx@y.com",
    "full_name\na,b",
    'full_name\n"a"bad',
    "full_name\n" + Array(501).fill("Name").join("\n"),
  ])
    assert.throws(() => parseMemberCsv(csv));
});
test("calendar escapes injection and folds Unicode by UTF-8 bytes", () => {
  const value = eventCalendar(
    {
      id: "event",
      title: "Golf\r\nATTENDEE:bad",
      starts_at: "2026-11-01T12:00:00Z",
      description: "🏌".repeat(100),
      location: "North, South; Hall",
    },
    new Date("2026-10-01T00:00:00Z"),
  );
  assert.match(value, /DTSTART:20261101T120000Z/);
  assert.match(value, /SUMMARY:Golf\\nATTENDEE:bad/);
  assert.ok(!value.includes("\r\nATTENDEE:"));
  for (const line of value.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
  assert.equal(value.replace(/\r\n /g, "").includes("🏌".repeat(100)), true);
});
test("Stripe signature supports rotation and rejects tampering, stale and future replay", () => {
  const body = '{"id":"evt_1"}',
    secret = "test-secret",
    now = 1700000000000,
    t = String(now / 1000),
    sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  assert.ok(verifyStripe(body, `t=${t},v1=bad,v1=${sig}`, secret, now));
  assert.equal(
    verifyStripe(body + " ", `t=${t},v1=${sig}`, secret, now),
    false,
  );
  assert.equal(
    verifyStripe(body, `t=${t},v1=${sig}`, secret, now + 301000),
    false,
  );
  assert.equal(
    verifyStripe(body, `t=${t},v1=${sig}`, secret, now - 301000),
    false,
  );
});
test("Resend signatures bind message ID, timestamp and payload", () => {
  const body = '{"type":"email.delivered"}',
    id = "msg_1",
    t = "1700000000",
    key = Buffer.from("test-signing-key"),
    secret = "whsec_" + key.toString("base64"),
    sig = createHmac("sha256", key)
      .update(`${id}.${t}.${body}`)
      .digest("base64");
  assert.ok(verifyResend(body, id, t, `v1,${sig}`, secret, 1700000000000));
  assert.equal(
    verifyResend(body, "msg_2", t, `v1,${sig}`, secret, 1700000000000),
    false,
  );
  assert.equal(
    verifyResend(body, id, t, `v1,${sig}`, secret, 1700000400000),
    false,
  );
});
test("email worker isolates recipient and retries uncertain delivery with the same key", async () => {
  const calls = [],
    finished = [];
  const sb = {
    rpc: async (name, args) => {
      finished.push(args);
      return { data: true, error: null };
    },
  };
  const job = {
    id: "one",
    lease_token: "lease",
    recipient: "one@example.test",
    subject: "Notice",
    body: "Private message",
  };
  await processEmailJob(sb, job, async (url, init) => {
    calls.push(init);
    throw Error("network failure");
  });
  await processEmailJob(sb, job, async (url, init) => {
    calls.push(init);
    return Response.json({ id: "provider-1" });
  });
  assert.deepEqual(JSON.parse(calls[0].body).to, ["one@example.test"]);
  assert.equal(
    calls[0].headers["Idempotency-Key"],
    calls[1].headers["Idempotency-Key"],
  );
  assert.equal(finished[0].accepted_id, null);
  assert.equal(finished[0].permanent, false);
  assert.equal(finished[1].accepted_id, "provider-1");
});
test("email worker distinguishes permanent rejection from throttling", async () => {
  for (const [status, permanent] of [
    [422, true],
    [429, false],
    [503, false],
  ]) {
    let finish;
    await processEmailJob(
      {
        rpc: async (n, v) => {
          finish = v;
          return { data: true, error: null };
        },
      },
      { id: "job", recipient: "a@example.test" },
      async () => new Response("", { status }),
    );
    assert.equal(finish.permanent, permanent);
  }
});

import { stripeAmount } from "../lib/money.ts";
test("Stripe invoice amounts handle zero, two, three decimal and legacy currencies", () => {
  assert.equal(stripeAmount(1250, "usd", "en-US"), "$12.50");
  assert.match(stripeAmount(1250, "jpy", "en-US"), /1,250/);
  assert.match(stripeAmount(1250, "kwd", "en-US"), /1.250/);
  assert.match(stripeAmount(1250, "isk", "en-US"), /13/);
});
