# Private Schedule Draft Restart

The existing private-draft group now requires a second actual app scenario in
addition to the original invalid-price/unresolved-address scenario. Its two
instrumentation stages use the real app, local authenticated driver and real
private preferences. No fake UI gateway or provider replacement is added.

The driver uses the native date/time pickers to change the departure date and
time, enables a desired arrival, and chooses its date/time. Price and original
endpoints stay unchanged. This is a valid **unsubmitted** draft: the proposal
button must be enabled but is never pressed. Closing and reopening must preserve
the same schedule, while another booked trip stays empty.

A guarded host stop separates the two stages. The new process must restore the
same signed-in driver, dates, times, arrival switch and exact private-record
hash without another login. Both the displayed fields and decoded stored input
are checked. The original process may already have exited when the host checks;
a null observed PID is retained, not described as killing a live process.

The host independently compares the before/after raw trip, booking and entire
notification hashes and requires no proposals, route quotes, balances or rides
for either fixture. Schedule expectations are independently converted to
Europe/Brussels with the host's date formatter. Neither device JSON nor a matching
image alone can qualify the scenario. Both instrumentation transcripts, typed
receipts, guarded stop, evidence copy, private hash and independent saved-data
checks must succeed before the stage result is written.

The full replay still reports 33 user-flow groups; private drafts now include
both raw-input and schedule subscenarios. It requires 35 actual local
instrumentation cases across 27 transcripts rather than the earlier 33 cases
across 25. Historical 33-group reports remain byte-exact and do not prove this
new schedule subscenario. Its stage is not a full-suite or release acceptance.

The same existing guard suite runs in Native CI and Web Integration Smoke. No
production resource, Terraform, network policy, provider, test deadline or
fallback changes. The test is implemented and compilation/guard checks are run
locally; actual device execution and reviewed captures are still pending.
It does not prove physical/iOS recovery, route/application, payment/refunds,
cross-account UI recovery or stale-draft conflict handling after a real edit.
