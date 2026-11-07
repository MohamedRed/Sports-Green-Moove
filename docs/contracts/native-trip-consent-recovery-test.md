# Four-State Consent Recovery After Process Death

The [completed 32-group replay](../release/evidence/local-trip-consent-recovery-native-2026-10-17/README.md)
now verifies this recovery scope. The first interrupted native preparation and its
test-readiness correction remain in the
[interruption report](../release/evidence/local-consent-restart-interruption-2026-10-17/README.md).
Completion is based on actual native receipts and independent saved-record checks,
not compilation or a passing validator alone.

The existing isolated runner now requires 32 groups: all previous 28 plus pending,
partially accepted, declined and withdrawn proposal recovery. Two separately
instrumented methods cover four distinct trips, each with two approved parent
reservations. Fixtures create trips/bookings only; the real app creates every
proposal, acceptance, refusal and withdrawal. No provider replacement is added.

The native readiness helper requires the expected status, the end of the existing
busy state and no error before inspecting or using the next action. Status text
alone does not prove the proposal operation's surrounding refresh has completed.

## Preparation

The driver proposes EUR 2.50 to EUR 4.00 for four trips, withdrawing only the
withdrawal fixture. The first parent accepts only the partial fixture and refuses
only the declined fixture. Pending remains 0/2; partial remains 1/2. Before exit,
the native test verifies the corresponding parent screens and stores four exact
proposal identities, run identity and process ID. The host verifies one proposal
per trip, unchanged original details and both reservations, exact actors/votes,
no quote/balance, and exactly two proposal notices or five terminal notices.
It hashes full trip, bookings, proposal and notification records.

The existing guarded helper accepts one additional named preparation receipt.
It still verifies the disposable emulator, local package, demo project and private
run session, then requires no process after force-stop. It does not clear data,
pause updates, change permissions, touch production or copy credentials.

## Reopening

A different process must restore the first parent session without login. Pending
shows both choices and 0/2; partial shows their saved agreement and 1/2 without
duplicate choices. Two explicit refreshes retain each state and original/proposed
prices. The second parent sees only their own booking and may still respond to
pending/partial. The driver sees the same proposal/counts and withdrawal action,
but no parent decision or premature apply action.

For declined/withdrawn proposals, both parents must retain the approved original
reservation at EUR 2.50 with no active change action, including after two explicit
list refreshes. The driver must see edit rather than review and the original
unchanged draft price with submission disabled. These are the current terminal
entry points, **not proposal-history retrieval**; history remains a separate gap.

After the named evidence copy succeeds, the host requires every full record hash
to match its checkpoint. It independently checks both scoped parent reviews and
outsider denial. The four native captures remain unreviewed until actual output
exists; no images or completed status are pre-published.

This does not exercise unsent drafts, changed-route calculation, applying terms,
real money, production, push delivery or physical tracking. Earlier failed runs
and their diagnostic records remain unchanged. The successful confirmed-consent
replay does not repair earlier intermittent device or copy failures.
