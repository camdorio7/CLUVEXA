# NADORIO Website Management integration (initial release)

This release adds an organization-scoped Website Management page, with server-side authenticated GitHub content publishing. It edits the existing Linderhof `content/site.json` and preserves the current public website deployment.

## Setup
1. Deploy the updated NADORIO project.
2. In Supabase, add `website_management` to `module_catalog` using the same schema and conventions as other modules; license and enable it for the Linderhof club in `club_modules`. Do not disable row-level security.
3. Find the Linderhof `clubs.id` UUID in NADORIO.
4. Set the NADORIO Vercel server-only environment variables:
   - `NADORIO_WEBSITE_CONFIGS` = `{"YOUR_LINDERHOF_CLUB_UUID":{"repo":"GITHUB_OWNER/WEBSITE_REPOSITORY","branch":"main","url":"https://YOUR_PUBLIC_WEBSITE_DOMAIN","tokenEnv":"NADORIO_WEBSITE_GITHUB_TOKEN"}}`
   - `NADORIO_WEBSITE_GITHUB_TOKEN` = fine-grained GitHub token with Contents read/write for the website repo only.
5. Redeploy NADORIO and visit `/workspace/YOUR_LINDERHOF_CLUB_UUID/website` as an active owner/admin.

## Limitations
- Current content editor covers existing JSON-backed fields (headings, announcements, events, rates, LPOA details, photo selections). It does not yet provide arbitrary page layout editing, image uploads, revision rollback, scheduled publishing, or website template provisioning.
- Public website already reads `content/site.json`; a successful GitHub commit triggers its existing Vercel build.
- Publishing uses the GitHub SHA to detect stale revisions. No credentials are sent to the browser.
- Configure separate scoped token env vars per website if multiple organizations are added.
- GitHub token permissions and organization licensing must be configured before the feature is usable.
