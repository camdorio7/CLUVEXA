# NADORIO v11 — Universal Website Template (Phase 1)

Based on the attached Linderhof website design: full-width photo hero, editorial typography, introduction, feature tiles, consistent interior navigation, contact form, mobile-responsive layout. No Linderhof-specific images, names, or external services are bundled.

## Deploy
1. Back up Supabase and run `supabase/migrations/018_nadorio_website_template.sql` in SQL Editor.
2. Copy the application files into the same paths in your NADORIO repository (do not copy this guide or migration into `app/`).
3. Deploy to Vercel. No new environment variables are required.
4. Open an organization with Website Builder enabled, enter an optional HTTPS image URL, add/edit/reorder tabs, and publish.
5. Verify home, every tab, contact form, mobile view, and a second organization's different branding.

## Limitations / launch gates
- This package updates the **public website template** and its editor, not every NADORIO module.
- Images use externally hosted HTTPS URLs; a managed media library, upload moderation, custom domains and image optimization are not implemented here.
- Tabs are stored in the existing `organization_sites.pages` JSON field. Up to 20 pages are supported by the editor.
- Contact form continues to use existing NADORIO backend and its existing rate-limit migration.
- Confirm your environment has already applied migrations 014–017 and any earlier migration dependencies.
- Syntax checks are not equivalent to a complete Next.js production build, RLS tests, or live browser tests.
- Do not remove the optional LINDEX integration from an existing organization merely to install this update.
