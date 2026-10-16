# Local Search Options And Native Seat Request

Verified on 2026-10-16 UTC by [Native CI run 38829666254](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38829666254),
source commit `3bb7c3398bfadadc3c01703982a7e0e57157dc41`.
The unchanged `results.json` records isolated run
`f612856576eb723d56e426336d92f6d6`, completed at `2026-10-16T00:42:26.651Z`.

## Accepted Results

General instrumentation reported 57 cases: 48 passed and nine intentional
local/live-auth gates were skipped; original XML is retained separately. The isolated local execution
then passed all 14 instrumentation cases across six invocations: nine in the
combined app/search group and one each for theme restart, native seat request,
ride lifecycle, messaging and conversation directory. All six original text
outputs are retained. The 15 result group IDs are not 15 independent journeys.

Four search component UI cases use explicit fake gateways, not real provider
matching. The two new cases check retention across host navigation, all selected
options and the exact child/two-seat booking callback; changing any of seven
options removes the previous results and refuses a stale booking action. The
other two cover edited place coordinates and simulated account identity changes.
This is not a real sign-out/sign-in or full app-navigation test.

The SDK-only case signs in the isolated parent and uses the actual native gateway
to request two seats. Independent authenticated service checks inspect exactly
one persisted request with the expected guardian, child, status and two seats;
approval reduces four available seats to two; cancellation restores four;
repeated cancellation is rejected. Approval/cancellation here are service calls,
not UI. No payment is attempted.

The existing ride, review, ledger and chat cases also pass. These remain local
checks using synthetic locations/seeded history, not new physical-phone evidence.

## Reviewed Captures

- `local-search-retained-options.png`: selected child, two seats, baggage, return,
  tracking/consent and explicit QA result, with keyboard hidden.
- `local-search-options-invalidated.png`: changed date, zero stale matches and
  the relaunch requirement, with keyboard hidden.

Both original 1080x2400 app captures were visually reviewed, copied unchanged and
contain only synthetic fixtures. No other new captures from this run are accepted
for the partner site. Older site captures retain their own dates and provenance.

## Limits And Diagnostics

The [October 15 state/payload/service evidence](../local-search-criteria-2026-10-15/README.md)
remains unchanged. Earlier attempts `38826908503` and `38828218654` are not accepted
complete runs: the first exposed selector defects; the second exposed rotation
cleanup enabling sensors despite an inherited portrait lock. Cleanup now preserves
that setting and waits for portrait restoration. This passing replay does not
explain the separately recorded earlier SlotWriter crash.

Real route matching/ranking, full account transitions, network/restart booking
idempotency, a proper date/time picker, remaining management actions, live
payments/push and all physical tracking/safety evidence remain open. iOS is
unchanged. No production data, billing, infrastructure or release-manifest
acceptance was changed.

## Subsequent Replay

Run `38831538641` at commit `32102d2` passed the combined nine-case group, theme,
native seat request and ride phases, then stopped at the driver's first chat
send. The composer did not clear within 30 seconds; the service log contained
only the earlier parent's send, with no driver send invocation. There was no
crash-buffer output. This is not a second successful complete replay.

The older send helper hid the keyboard without waiting for its insets/layout to
settle and could count the editable draft as the expected message text. It now
explicitly focuses the composer, waits for the keyboard to open/close and the
composer to return to its resting position, then requires acknowledgement/empty
draft before checking the bubble. Failed sends retain a diagnostic capture and
still fail the test. This changes test synchronization, not message delivery,
timeouts or provider behavior. A new full replay is required; the accepted run
above remains a dated snapshot, not a claim of repeatable stability.
