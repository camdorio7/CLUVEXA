# V11 local validation

Verified 2026-10-14 against base commit `56ab239d5d7e6531b2674c4c2538615ebbf4f2da` plus the uncommitted v11 changes.

| Check | Result |
| --- | --- |
| Frozen dependency installation | `npm ci --cache /tmp/nadorio-npm-cache` passed; 46 packages installed. The writable cache override is needed in this cloud sandbox. |
| Unit tests | 12 passed, 0 failed. |
| PostgreSQL migration/authorization suite | All historical migrations plus 019 applied to a disposable PostgreSQL 16 database; 63 assertions passed. |
| Chromium browser suite | 13 passed, 0 failed, using local deterministic Auth/REST fixtures. |
| TypeScript | `npm run typecheck` passed. |
| Release structure checks | 60 passed. |
| Optimized production build | `npm run build` passed on Next.js 16.4.0 / Node 24.19.0. |
| Production process smoke test | `next start` launched; login returned 200; protected dashboard and health returned the expected 503 with Supabase configuration absent. |
| Patch whitespace | `git diff --check` passed. |

Mobile administrator and platform health screenshots are available separately in `artifacts/`. Screenshot data comes from test fixtures. The database tests use test-only Auth/storage shims and do not assert equivalence to a hosted Supabase project. Browser sessions are fixtures, not real email/password logins.

No live Supabase credentials were present. No production migration, deploy, external publication, or actual email delivery was performed. Existing-data migration rehearsal and the live acceptance checklist in V11-DEPLOYMENT.md remain required. See V11-AUDIT.md for unsupported capabilities and workflow limitations.
