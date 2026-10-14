import { timingSafeEqual } from "node:crypto";
import { HttpError } from "./server-access";
export function requireScheduler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 24)
    throw new HttpError(503, "The job scheduler is not configured.");
  const supplied = Buffer.from(req.headers.get("authorization") || ""),
    expected = Buffer.from(`Bearer ${secret}`);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    throw new HttpError(401, "Invalid scheduler credentials.");
}
