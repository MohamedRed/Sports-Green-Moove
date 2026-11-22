# Initial Payment Fee Recovery, 23 October 2026

The initial ten-case isolated payment-preparation file produced nine failing new
expectations against application baseline `412f22f7`. It found no fee frozen in
the initial payment attempt, accepted a mismatched provider fee, accepted several
malformed rates, and lacked the new verified legacy-fee persistence requirement.
The exact original red test file was not frozen. Its transcript and baseline
application sources remain intact; the final eighteen-case file is separately
frozen and includes additional concurrency, identity and settlement checks.

The corrected server freezes fee cents, amount and destination before contacting
the payment provider. A lost-response retry retains the original invoice even
after configuration changes. Provider metadata and actual application fee must
agree with the invoice before client configuration or webhook settlement.
Invalid whole-basis-point rates fail before creating an attempt. Exact integer
rounding handles half cents and safe-integer boundaries. Only absent configuration
retains the previously documented zero-fee business policy.

Known legacy provider identities are retrieved and their verified historical fee
is retained; current configuration does not reprice them. Conflicting identities
or an unknown fee-less attempt require reconciliation, without a replacement
charge or invented fee. This implements the documented
[same-key/same-parameters contract](https://docs.stripe.com/api/idempotent_requests).

The final run passes eighteen preparation cases and all 78 combined financial
cases, including the existing payout, reversal, webhook and management checks.
All 434 backend units pass, including forty new fee-boundary cases. Functions
compile, 1850 root tests pass, and the native test APK compiles the separately
corrected driver booking assertion. That new native regression was not executed
in this bundle. Later checks keep their own transcripts and source revisions.

Firestore transactions and the callable implementation execute locally. The
callable receives a synthetic authentication context directly, not a real sign-in
or HTTP transport. Provider responses and secret values use test doubles.
No provider credentials, actual charges, refunds,
physical payment screens, customer records or production mutations are used.
No new payment screenshots or video are published. Previous gallery dates remain
unchanged. Owned emulator endpoints are independently verified closed.

The native driver assertion no longer depends on the total number of approved
bookings created by earlier fixtures. It checks its own booking identity. A new
component case includes three unrelated approvals, but still needs execution.
This does not assert that the global count was the sole cause of the previous
native timeout, whose exact post-failure stored booking state was not retained.

The later full root run found an unrelated harness race: the private FIFO reader
correctly rejected oversized input before the test attached its rejection
assertion. `root-harness/` retains the failing excerpt, before/after test sources
and passing focused check. The test now joins the reader assertion and writer
concurrently; no production permission, length, input or credential guard changes.
The initially frozen 1850-pass root transcript above remains its original result,
not a claim that the later failed run passed.
