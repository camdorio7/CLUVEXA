import test from "node:test";
import assert from "node:assert/strict";
import { individualEmailMessages } from "../lib/email-messages.ts";
test("each announcement recipient receives a private message", () => {
  const result = individualEmailMessages(
    ["first@example.test", "second@example.test"],
    {
      from: "NADORIO <notifications@example.test>",
      subject: "Notice",
      html: "<p>Hello</p>",
    },
  );
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].to, ["first@example.test"]);
  assert.deepEqual(result[1].to, ["second@example.test"]);
  assert.equal(
    JSON.stringify(result[0]).includes("second@example.test"),
    false,
  );
  assert.equal(JSON.stringify(result[1]).includes("first@example.test"), false);
});
