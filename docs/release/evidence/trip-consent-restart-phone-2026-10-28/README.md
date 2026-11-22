# Physical Android consent recovery, 28 October 2026

## Observed flow

One disposable Pixel 9 Pro / Android 15 runs the retained isolated app. Driver,
first parent and second parent sign in separately through the actual app UI.
Only that phone proposes, accepts, declines or withdraws. No peer service performs
those business actions. The price draft EUR 2.50 -> EUR 4.00 survives leaving and
reopening its editor without creating a proposal.

Five separate Android App info Force stop / confirmation / disabled-control /
Open sequences were manually witnessed, with the target app identity checked
each time. Every reopening restores the same account without credentials:

- Pending proposal returns with 0/2 agreements in the driver's review.
- First parent's approval returns as 1/2 with their own agreement recorded and
  no second accept/refuse action. The other parent's account still offers its own
  independent decision; it does not inherit that approval.
- Second parent's approval returns as 2/2. Original terms remain unapplied.
- A refusal on a separate booked trip returns through booking history and its
  review. The booking is still approved at EUR 2.50; refusal cannot be sent twice.
- Driver withdrawal on a third trip returns through its history and review,
  without a second withdrawal action or application of the proposed terms.

Ten ordered original checkpoint receipts, the baseline and final report are in
`completed/`. The observer checks six bookings, unrelated root records, all
claims and live-trip data. Its baseline contains 187 root records, not every
nested collection. Profile timestamps and the expected proposal/notification
records are normalized as specified in its retained source. Parent review reads
remain scoped to each parent's booking; an outsider is denied. The observer
explicitly does not itself prove phone UI or process restart: `ui-review.json`
is the separate manual observation, without independent PID measurements.

## Preparation failure and controls

`preparation-failed/` preserves the original zero-checkpoint failed preparation
and its cleanup receipt. A child-account runtime produced the wrong account-file
shape for this observer. The observer had seeded trips before failing its actor
sign-in. No phone account had been entered. That runtime was disposed, and the
actual trial used the existing `start-local-ui.mjs` launcher with a fresh run ID.
The observer now validates the flat isolated actor contract before importing any
clients or seeding. Historical source snapshots remain byte-for-byte unchanged.

One initial scrolling-adjacent tap opened the ride-start explanation. It was
cancelled before permission or tracking. Later independent checkpoints preserve
live data and show no ride was created. This is not a tracking test.

An initial local Node test run overlapped the live disposable backend and five
test-server bindings failed with EADDRINUSE on port 5001. It is not accepted as a
suite pass or product failure. The full suite then passes after backend disposal.

## Media, isolation and disposal

No native capture export or recording is attempted or accepted in this trial.
Session-window observations are not native exports; no new gallery image is
published while alternate-image approval is pending. Earlier dated media stays
unchanged. Application, maps, real payments/refunds, two simultaneous phones,
iOS, physical GPS and release readiness remain open.

The APK hash and origin are in the manual review. Production Android source and
build configuration have no diff between that origin and a850ea2; the installed
bytes are not independently hashed. No production writes or map requests occur.
The final sign-out shows a blank login. The provider acknowledges app uninstall
and Stop Session returns to its idle dashboard; package absence is not queried.

`runtime-cleanup.json` independently binds disposal to the observed process group
21340: it is absent, all four endpoints pass bind/close checks, the private session
and runtime are absent, and both supervised commands exit 130. The helper's private
handoff directory is absent. Both observer clients close cleanly. No credentials
are retained. `artifact-sha256.json` binds all original receipts and this review;
observer sources are retained by content hash in `../source-archive/`.

Separately, a850ea2's complete Android CI job fails during its primary
trip-change-parent-confirmation file transfer. This phone result does not repair
or replace that gate; the original downloaded artifact and failed run remain open.
