# iPhone Fixture Pass, 4 November 2026

Run `41911781988`, job `126862422870`, succeeds at source
`3e7cd40e62798ba503c383e044e25231dc3072bd` within the approved 50-minute limit.
The actual SDK-linked app and all test bundles compile once; all seven fixture
cases then pass without rebuilding, rerunning or reducing the test selection.
Both search-consent cases, rating submission and the original five identifier
cases are present. Simulator disposal also succeeds.

`summary.json` retains the exact job/step timestamps and seven case results.
`build-and-test-result.txt` contains unchanged success/case/aggregate lines from
the original private job log, whose complete digest is retained. The source
fingerprint inventory binds all 143 tracked iOS files and the three relevant
workflow/preflight inputs to the tested commit. They are unchanged in this
release-evidence update. The complete private log remains outside Git.

This PR run does not opt into capture retention. Both capture steps are skipped
and the artifact inventory is empty. No new image, recording, manual device
session, account or paid provider request is added. Earlier failed/cancelled runs
and their evidence remain intact; this result does not establish their causes.

The release manifest accepts only `ios_sdk_build_ci` and `ios_fixture_ui_ci`
for these exact sources. The dated cumulative automated-evidence index adds only
those two source-bound entries, preserving the earlier entries and their original
source metadata; it does not reverify or redate earlier Android/provider proofs.
Synthetic fixture screens do not prove complete iPhone
user flows, live authentication, SDK transport drainage, complete sign-out,
conversation delivery, emergency contact, real payments, physical GPS or release
readiness. Those requirements remain open for Android and iPhone.
