# Isolated App And Management Flow Verification

Date: 2026-10-15. Synthetic accounts and records only, under
`demo-sgm-local-qa`. No production accounts, privileged production roles, live
payment transactions or paid infrastructure were created by these checks.

## Confirmed Management Checks

- Signed in with the disposable local administrator.
- Moved a report from `open` to `reviewing`, then `closed`, with review notes.
- The Android app submitted report `YZkHYdPFzgIT3ueXDvou` as `sgm-qa-parent`.
  The management screen displayed that author and report, then successfully
  reviewed and closed it; this was confirmed in the UI tree. The retained
  `local-support-reviewed.png` was retaken with a fresh seeded report after the
  original export framed the wrong section. It proves the operator review/close
  action, not the identity of that earlier app submission. It contains only the
  report section, without unrelated provider/account panels or real customer data.
- Signed in as the disposable parent on the management site: access was refused
  and no management controls were exposed. Restored the local administrator.

These are manual checks through the actual management UI and local backend, not
an Admin SDK mutation presented as an operator action.

## App Verification And Capture Requirements

The app now has a local-only package identity and explicit demo configuration.
It ignores live Firebase configuration and external provider keys in local mode.
The management site's local mode likewise supplies its own demo configuration.
The shared Functions runtime blocks non-loopback egress and has no cloud
credentials or real provider keys.

The earlier local app checks passed for parent login, calendar navigation,
support submission, landscape login and activity/theme recreation. However,
the ATD device image produced black captures. Those images were rejected and
are not included here. A rendering-enabled replacement could not start because
the workstation lacked sufficient free disk space. The newly downloaded images
and empty replacement device were removed; existing devices/data were preserved.

`npm run test:local-android-flows` provides the repeatable verification. It uses
fresh fixtures, the real app and local services, strict instrumentation completion
checks, and rejects blank captures. It separately starts a fresh app process to
verify theme persistence. Native CI runs the same suite after component tests.
Only a successful rendering-enabled run and reviewed captures may be attached
as new app UI evidence; passing semantic assertions alone is not visual proof.

The first rendering-enabled CI run passed, but visual review found its landscape
capture was still portrait and its home capture preceded fixture loading. Those
captures/results were not accepted. The runner now requires landscape resources
and landscape screenshot dimensions, and waits for the actual home trip to load.

## Retained Native Evidence

Source: [Native CI run 38759091076](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38759091076),
commit `805017cdb53b128c0e273cc05901f54005e2f93f`, artifact
`android-connected-ui-test-results`, local run `abbef5a061e4936c4126ae2b5d2f23e4`.
Six instrumentation cases passed in two app-process invocations. The sanitized
`results.json` is copied unchanged from that run.

Reviewed and retained app-window evidence:

- `local-trips-calendar.png`: current month, real seeded trip, month arrows tested.
- `local-parent-home.png`: actual loaded trip, current date and remaining places.
- `local-search-empty.png`: completed empty search. Consent initially unchecked is
  asserted before the search; the retained screen follows the explicit selection.
- `local-driver-booking-approved.png`: approval confirmed and both cards approved.
- `local-login-landscape.png`: actually landscape, empty inputs and submit visible
  after scrolling; the same test subsequently authenticated successfully.
- `local-theme-after-process-restart.png`: saved dark theme after a fresh process,
  with the authenticated parent and updated trip data.

These are synchronized Compose window captures, without system chrome. No app
pixels were edited. The earlier home and empty-search display-buffer captures were
rejected because they showed preceding frames. The new captures were visually
reviewed and show the expected loaded/empty-result states. Fixture booking notes
are ordinary synthetic passenger messages, not internal implementation comments.

`local-parent-messages.png` retains the complete reviewed conversation-preview
capture from [run 38756774445](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38756774445),
commit `f029cb4aafc748082117244e2710edce71eaa933`, run ID
`b90408c1a10ed8934987c2cd1fab4cd7`. The newer capture clipped its heading and was
not substituted. Both runs assert the same loaded preview; neither proves reply UI.

The support submission capture is also excluded from the partner gallery because
unrelated technical payment labels were visible. Its successful submission remains
covered by assertions and the separately documented manual management check.

Calendar/empty-search/consent component cases use controlled inputs. They do not
prove a complete live-provider search or a booking initiated through that screen.
No new videos were produced by this suite; earlier short recordings remain dated.

## Remaining Product Gaps

- Conversations display previews but cannot be opened or replied to in the app.
- Membership requests have no accept/reject controls in the management site.
- Trip editing and cancellation have no end-user UI or corresponding callable.
- Drivers can approve a booking, but explicit rejection has no UI/callable.
- Parent booking cancellation has a backend operation but no app control.
- Emergency contact, notification status and fees in account settings are static.
- Secondary text contrast, screen insets, missing booking card dates and the
  transient empty home state still need product work. Theme
  persistence does not establish complete accessibility or visual readiness.
- Publication/search with live place/routing services, payment completion/refund
  settlement and real push delivery are not proven by these local checks.
- Physical tracking and required safety-audit exports remain unaccepted. This
  report does not change the release evidence manifest or complete the goal.

## Regression Checks

- Backend: 108 unit tests passed.
- Local service suite: 10/10 scenario groups passed again after runtime extraction.
- Android unit tests and local debug/instrumentation APK compilation passed.
- Local configuration/isolation and strict instrumentation-result tests passed.
- Native flow identifiers, store/privacy/provider readiness and release-gap
  contracts passed. Green checks do not replace the remaining product/device work.
