import { createHmac, timingSafeEqual } from "node:crypto";
function equal(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}
export function verifyStripe(
  body: string,
  header: string,
  secret: string,
  now = Date.now(),
) {
  const parts = header.split(",").map((p) => p.split("="));
  const timestamp = parts.find(([k]) => k === "t")?.[1];
  if (
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest();
  return parts.some(
    ([key, value]) =>
      key === "v1" &&
      /^[0-9a-f]{64}$/i.test(value || "") &&
      equal(expected, Buffer.from(value, "hex")),
  );
}
export function verifyResend(
  body: string,
  id: string,
  timestamp: string,
  signature: string,
  secret: string,
  now = Date.now(),
) {
  if (
    !id ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300
  )
    return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest();
  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    return (
      version === "v1" &&
      !!value &&
      equal(expected, Buffer.from(value, "base64"))
    );
  });
}
