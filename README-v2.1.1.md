# NADORIO v2.1.1

Hotfix for invitation and authentication URLs.

- Invitation emails now use `NEXT_PUBLIC_APP_URL` server-side and never trust the Vercel request origin.
- Copy-link actions use the configured NADORIO production URL.
- Supabase signup confirmation uses the configured NADORIO URL and preserves the invitation token.
- Re-inviting an email with an existing pending invitation updates and resends that invitation instead of violating the unique constraint.
- Pending invitations now include Resend, Copy Link, and Revoke controls.

No new SQL migration is required.
