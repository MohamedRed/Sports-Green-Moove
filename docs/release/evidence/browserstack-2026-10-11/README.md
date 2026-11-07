# BrowserStack Android Manual Flow Verification

Date: 2026-10-11. This is a partial manual verification report, not release approval.

## Build And Environment

- Source: `codex/implement-plan@1fca24582f7855c9301a58ccd85abc3c2ad32b08`.
- App: `app-debug.apk`, version 0.1.0.
- BrowserStack upload: `bs://53bbdaef4c9a49a475e282ae419bb26df1e8f5d8`.
- Upload workflow: run `38142915857`, attempt 2, successful.
- App Live device: Google Pixel 8, Android 14.
- Device session: `67ff4394732c6bc7fc75538e7f10373624b4b200`.
- Firebase: `sports-green-moove-prod`.
- Existing enabled BrowserStack parent test account reused. Credentials and account identifiers are omitted.
- Account had no child, club membership, driver role, bookings, or active ride.

## Observed Results

| Flow | Result | Evidence |
| --- | --- | --- |
| Existing-account email/password login | Reached authenticated Home | 01 |
| Trips upcoming / past / pending tabs | Navigation and empty states observed | 02, 04, 05 |
| Search with unresolved places | Submission rejected with required-places message | 07 |
| Live Google Places suggestions and selection | Wavre and Louvain-la-Neuve resolved | 08, 09, 10 |
| Child tracking without a selected child | Submission rejected with required-child message | 09 |
| Adult route search | Loading finished without visible provider error, zero matches | 10 |
| Parent attempts to publish | Driver-required restriction displayed | 11 |
| Chats / notifications / reviews | Tabs and empty states observed, not delivery or exchange | 12, 13, 14 |
| Profile to Payments | Zero due, empty state, return to Profile worked | 15 |
| Profile to Clubs | No memberships or public clubs displayed | 16 |
| Profile to Impact / Rewards | Empty history and zero balances displayed | 17, 18 |
| Profile to Options | Screen and support form reachable; account controls are static | 19, 20 |
| Support without description | Validation rejected submission; no support report created | 21 |
| Theme toggle | Dark rendered, then light restored; persistence not tested | 22 |
| Force-stop / relaunch while authenticated | Authenticated Home restored | 23 |
| Home landscape / scroll / return to portrait | Content scrollable and bottom navigation visible | 24, 25 |
| Sign-out on original build | Failed: app exited, relaunch remained authenticated | 26, 27 |

Numbers refer to the corresponding numbered JPGs in this directory. `09-search-result.jpg`
records the child-required guard, not a completed search result. Search reaching zero matches
does not establish booking, route ranking, capacity changes, or notification delivery.

## Defects And Follow-Up

1. **Resolved and retested:** sign-out exited the app and left the Firebase session authenticated. The app called Meta
   logout before Firebase logout, although Meta configuration is deferred. The gateway invokes
   `LoginManager.getInstance()` without checking SDK initialization. A guard and Android
   regression coverage are included with this report. The fresh build retest below verifies
   the fix; the original screenshots preserve the failure rather than overwrite it.
2. Home displays a hard-coded November 2022 date. Trips displays `NOVEMBRE 2022`, and both
   month arrows have empty handlers. Advancing the month did not change the screen (03).
3. Options displays a hard-coded emergency number, notification states, and fee value.
   Rows have no setting handlers; they do not prove account preferences or emergency setup.
4. A completed zero-match search still displays the initial instruction to choose places
   and launch the search. The empty-results UI does not distinguish idle from searched-empty.
5. Dark appearance renders the system status icons with poor contrast. Further device and
   accessibility coverage is required before considering theme support complete.

## Remaining Flows

Driver publication, club membership requests, booking request/approval, chat exchange,
notification delivery, child consent, pickup/dropoff, ride completion, payment/onboarding,
and reconciliation remain unverified in this manual run. No real charge, withdrawal,
identity submission, location permission change, or participant record mutation was made.

The cold authentication restart here is **not** the required active-ride `app_restart`
scenario. None of the nine tracking scenarios for either platform or the six final
safety-audit requirements were marked accepted in the release manifest.

## Sign-Out Fix Retest

- Source: `codex/implement-plan@d21e0ea85936976848842912bd4d39b146ef01e0`.
- Successful build/upload workflow: `38171453569` (4m20s).
- Upload completed at `2026-10-11T20:20:02Z`.
- Uploaded app: `bs://b88a8b683dc92cb89be917cf4314bf0500df075f`.
- Fresh App Live session: `822b7e24a3f02b35bb0c9cdb96794199512241ad`.
- Google Pixel 8 / Android 14, same existing parent test account.
- Existing-account login reached Home (29).
- Profile sign-out returned to the login screen without exiting the app (30).
- Force-stop and relaunch remained on login rather than restoring the old session (31).
- Device session ended after evidence capture. No production fixtures were created.

Native CI run `38171455926` passed unit and instrumentation jobs. The downloaded report
for `FacebookSignOutTest.signOutDoesNotInitializeDisabledFacebookSdk` records `passed`
and zero skipped tests for that class. The live-backend disposable signup test is
intentionally skipped in routine Native CI; its new sign-out/re-login steps require a
separate live-backend instrumentation run. They are not claimed as executed here.

## Staging Fixture Blocker

- Read-only inventory found 16 enabled BrowserStack accounts, all parent-only.
- User requested isolated driver/parent/club/synthetic-child fixtures and chose staging
  rather than temporary production QA records.
- `.firebaserc` configures `sports-green-moove-staging`, but API access returns 403.
- Google Cloud Console also shows missing `resourcemanager.projects.get` and
  `resourcemanager.projects.getIamPolicy` for staging.
- The console denial was also confirmed under the same administrator account used by
  application-default credentials, not only the initially selected browser account.
- Production is the only Sports Green-Moove project visible to the current Firebase API
  credentials. This does not prove staging does not exist.
- No staging access, project, billing attachment, or fixtures have been created. An owner
  must establish project access before a staging APK and the multi-user test setup can be
  deployed. Any infrastructure/IAM changes should be codified in Terraform.

Staging fixtures must use synthetic participants, a clearly named QA club, a zero-cost
ride, no real Stripe account details, explicit cleanup ownership, and no production user
IDs. Backend fixture setup must not be presented as proof of native user interactions.

## Verification Scope

Android sign-out coverage belongs in Native CI and the BrowserStack live-auth test.
No web implementation changed, so `web-integration-smoke.yml` does not need a new web
scenario for this fix. Existing required PR checks must remain green. This report does
not replace end-to-end release evidence or close the overall user-flow goal.

Local `test:native-ui-coverage` passed (31 identifiers), and `git diff --check` passed.
Local Gradle unit/instrumentation compilation stopped during dependency extraction with
`No space left on device`; it did not establish local test results. Remote CI subsequently
passed those checks. Only the failed build's regenerable Gradle dependency-transform
cache was removed to recover space for saving the report.
