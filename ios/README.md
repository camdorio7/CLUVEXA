# NADORIO for iOS

Native SwiftUI companion for existing NADORIO accounts, targeting iOS 17+ on iPhone and iPad. Organization subscriptions, billing, and licensing stay in the web portal. There is no embedded web portal or payment checkout.

Implemented: Keychain-backed password sign-in and refresh, organization switching, membership card, event registration/waitlist/cancellation, attendance, native Calendar editor and share sheet, announcements and publishing, member directory, staff task completion, phone updates, privacy/support links, sign-out, and an in-app account deletion request. Native tabs, navigation stacks, lists, forms, pickers, confirmation dialogs, Dynamic Type and system accessibility labels are used. RLS remains the authority for all data access; UI visibility is not a security boundary. Network reads are paginated. No service-role secret belongs in the app.

## Run on a Mac

1. Install Xcode 16+ and its iOS simulator. The included `Nadorio.xcodeproj` opens directly; no project generator is needed.
2. From `ios/`, copy `Nadorio/Resources/Configuration.example.plist` to `Nadorio/Resources/Configuration.plist`. Set the Supabase HTTPS project URL, **public anon/publishable key**, live privacy-policy URL, live support URL, and the deletion processing commitment your team can meet. The configuration file is ignored by Git. The public key will be readable in a shipped app; never use a service-role key.
3. Ensure database migrations through 020 are applied, then apply **only** `supabase/migrations/021_native_account_deletion.sql` once. This repository's earlier migration-history reconciliation issue must be resolved before running a blanket `supabase db push`. Do not replay migration 001 or delete the existing `platform_role` enum.
4. Open `Nadorio.xcodeproj`, select your Apple Developer team and your registered bundle identifier, then run on a simulator/device. Use separate staging credentials and test organizations first.
5. Run Product → Test. GitHub's `Native iOS` workflow also validates the project and runs the XCTest suite on a Mac; its placeholder configuration intentionally cannot connect to production.

The Linux development environment cannot compile SwiftUI or run Xcode. A green macOS build and real device testing are required before release; source and database checks are not a substitute.

## Account deletion operations — required before distribution

The app **requests deletion; it does not automatically erase an account**. Requests persist in `public.account_deletion_requests` and are idempotent. Only the requesting account and platform super-admins can read them through RLS. Clients cannot change status. A service operator must process the queue daily, within the configured processing period, and communicate completion using the account's verified contact before removing it. Do not submit to Apple without a staffed, tested fulfillment process.

Use Supabase's trusted SQL/admin tooling (never the app) to inspect the queue:

```sql
select r.id, r.user_id, r.created_at, r.status, u.email
from public.account_deletion_requests r
left join auth.users u on u.id = r.user_id
where r.status <> 'completed'
order by r.created_at;
```

For each request, record its ID and account UUID, mark `in_review`, resolve organization ownership continuity, and review personal data across all organizations. Remove/anonymize associated member contact data, registration names, invitations, queued email addresses/content, site messages, support cases, uploaded files and other personal data according to the published retention policy. Check audit/member-history copies too: deleting a row alone may create a history entry. Resolve restrictive support-case profile references before deleting the Auth account through Supabase Admin. Do not blindly delete an organization or its subscription. Document any legally retained records and applicable backup retention. Send the user completion information through the established support process.

After erasure is verified and the Auth account is removed, its request `user_id` becomes null. Only then mark that specific request completed:

```sql
-- Replace the example UUID with the verified request ID.
update public.account_deletion_requests
set status = 'completed', completed_at = now()
where id = '00000000-0000-0000-0000-000000000000'
  and user_id is null and status <> 'completed';
```

The completion constraint prevents marking a still-linked account complete. It cannot verify erasure of every data copy; that responsibility belongs to the operator. Retain request metadata only as long as the privacy policy requires. Organization admins cannot read other users' deletion requests.

## TestFlight and App Store release gates

Native controls help usability; they do not guarantee App Review approval. Before archiving and submitting:

- Confirm the macOS CI build/tests pass and test sign-in, expired sessions, two-organization switching, permission revocation, offline/error recovery, registration/waitlist/cancellation, calendar denial, staff attendance, announcements and deletion end to end against staging.
- Test on physical iPhone/iPad, VoiceOver, largest Dynamic Type, landscape, keyboard navigation, and slow connections. Calendar end time defaults to one hour because the service stores a start time; the user can edit it in Apple's editor.
- Add the approved NADORIO app icon in an `Assets.xcassets/AppIcon.appiconset` resource and set `ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon` in `project.yml`. Supply an opaque 1024×1024 marketing icon and the sizes required by Xcode. The current source does not include a final App Store icon.
- Set the registered bundle ID, signing team, version/build number, live support/privacy URLs, and accurate App Store privacy disclosures. Review `PrivacyInfo.xcprivacy` against the final app and backend behavior, including organization-entered data. Review Apple's export-compliance questions for the shipped binary; the current app uses system HTTPS/Keychain, with no custom cryptography.
- Provide Apple a working non-production demo account with populated organization/events and reviewer instructions. Explain this is an existing-account organizational companion and that platform subscriptions are handled by organizations on the web. Confirm the applicable business/enterprise payment rules for your actual audience; adding digital purchase links later needs a separate policy review.
- If users can publish content to broad audiences, establish reporting, moderation, blocking and support appropriate to that distribution before release. This initial build is intended for organization-managed memberships and announcements, not a public social network.
- Archive with a physical-device destination, validate in Xcode Organizer, upload to App Store Connect, complete TestFlight testing and submit screenshots, descriptions, privacy answers and review notes.

References: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [account deletion requirements](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [app privacy details](https://developer.apple.com/app-store/app-privacy-details/).

Not included in this initial native build: push notifications, offline writes, Apple Wallet credentials, public self-signup, native password recovery, digital purchases, and the full platform-owner administration suite. Password recovery remains available through the organization's existing account support process. Membership cards are informational; staff must check current eligibility in NADORIO.

To regenerate the checked-in project after adding files, run `python3 scripts/generate_project.py` from `ios/`. The XcodeGen specification is also retained as an optional alternative.
