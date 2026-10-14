# NADORIO 12.0.0-rc.1

Organizations can manage software subscriptions through Stripe Checkout and the customer portal, inspect invoices, and see provider-confirmed status. Signed, replay-resistant webhooks update service-owned records; browser clients cannot forge payment state. Existing subscription checks and checkout reservations reduce duplicate charge risks. Module licensing remains under CD7 control.

- Launch checklist derives progress from organization identity, access, enabled modules, members, website and subscription data.
- Member management adds indexed search, pagination, edits, history and all-or-nothing CSV imports with duplicate validation.
- Announcements publish atomically with optional private-recipient email jobs. Templates, campaign counts, delivery details, leases, backoff, provider idempotency and signed delivery/bounce events make failures visible.
- Events add waitlists, automatic eligible-member promotion, capacity protection, attendance, private notifications, scheduled reminders and standards-compliant calendar export. Events and attendance lists are paginated.
- Website drafts are separate from public content. Explicit publication validates content and checks versions; private previews, 50-version history and optimized hero uploads support editing safely.
- Website inquiries have new/read/resolved handling with paginated views.
- Platform billing shows Stripe state alongside legacy commercial records. Health checks distinguish database readiness, provider configuration and real delivery/payment verification.
- Operational endpoints expose database readiness and authenticated queue/worker health. CI covers the expanded workflows and a configurable uptime workflow is included.

Migration 020 is required. Deploy it with the matching application; the old website editor cannot save against the new publishing restrictions. Production activation and external acceptance steps are in [V12-DEPLOYMENT.md](V12-DEPLOYMENT.md).

Not included: individual member dues, a complete reservations/inventory engine, new automation/intelligence modules, automatic module licensing from Stripe prices, or certification of hosted production. These remain separately scoped work.
