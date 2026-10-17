# Confirmed Trip Consent After Process Death

This required local test is implemented in two separately instrumented stages.
Compilation and configuration checks alone do not establish its runtime result.
The [completed native replay](../release/evidence/local-trip-consent-restart-native-2026-10-17/README.md)
now verifies this confirmed-consent scope in all 28 required local groups. The
older 27-group schedule replay remains unchanged historical evidence.

The driver proposes a EUR 2.50 to EUR 4.00 change through the real app. The parent
signs into their own account, opens their affected reservation and accepts. The
app records its process ID, proposal identity and confirmed/unapplied state.
The host independently checks the one stored proposal, one parent decision,
unchanged trip/booking, no quote/balance and exactly three unique notices.
It saves hashes of the entire trip, booking, proposal and notice records.

The shared disposable-process helper accepts only the known local app ID,
emulator identity, demo project and run-bound private session. It validates the
prepared receipt before issuing force-stop and independently verifies that no
app process remains. It never clears data, changes permissions, touches the
production package or records the private login credential. Chat restart uses
the same implementation with its own preparation validator and file names.

The second instrumentation must have a different process ID. The app must
restore the parent session without a login action, reopen the original proposal,
show the saved decision and one agreement, and offer no duplicate accept/refuse
action. Two explicit review refreshes must preserve that state. Switching to
the driver account must show the same confirmed proposal and prices, still
unapplied with no apply control before a route calculation.

The driver's initial trip has no proposal and opens its edit action. After
restart/account switching, the test must require the exact saved proposal and
open the review action instead, with edit absent. These are two explicitly
expected states, not alternative controls tried until one succeeds.

Only after the second stage and acknowledged named evidence copy can host
verification require every stored record hash to match the pre-stop checkpoint.
It also checks scoped parent review, outsider denial, the unresolved-change ride
start guard and three non-empty native captures. A run-bound stage receipt is
not a full replay; all 28 groups remain mandatory for `results.json`.

Scope is confirmed single-parent price consent only. Pending/partially accepted,
refused and withdrawn proposal recovery, unsent drafts, route computation,
application, real payment/refund and physical-device scenarios remain separate.
No screenshot or success claim is published before an actual completed run and
visual review. No production code, provider substitute or fallback is added.
