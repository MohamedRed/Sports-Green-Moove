# Parent Loading Failure

GitHub Native CI run `39148556687` failed on source
`d824a84811f9319c87949f4b1da98cf021d7387e`:
https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39148556687
Original artifact `android-connected-ui-test-results`, ID `12145055917`.

The retained original ordinary-suite JUnit has 129 cases: 97 passed, 32 skipped,
zero failures and zero errors. All four `GuardianVerificationFlowTest` component
cases passed. The actual local SDK test is intentionally skipped in that suite;
it subsequently ran separately and failed. These results cannot be combined
into a passing local multi-account replay.

Local run `b2bd4c4e01584c9678b8c087a2d328db` failed at 17:27:44 UTC on
the first child selection. The actual node `guardian.child` existed but was
disabled while its choices loaded. The test waited only for its existence,
then asserted enabled. Its nine-second failure was not a 60-second network
timeout, a manager decision or a verified contact/child operation.

The new test helper waits for both the exact tag and `isEnabled()` within the
existing 60-second deadline, then still asserts enabled before clicking. No
sleep, retry, skipped assertion, fallback or deadline extension was added.
The corrected replay still requires a new actual successful run.

The cleanup pull failed because no evidence directory had yet been created.
Its original receipt is retained and is not a primary-copy success. No device
marker, five screenshots, eight audit events or successful parent result is
accepted from this run. No physical-device or production behavior is proven.
