# Pending Reviews, 29 October

The original 31-ride failure is retained separately in
`../received-ratings-2026-10-29/review-window-gap.json` with its original source
archive. Its active fail-expecting probe was superseded, not rewritten into a
passing historical result. This bundle records a new implementation and run.

## Verified Scope

- Eight authenticated isolated service groups pass. The old 31st-ride case now
  returns one driver request and all 31 parent requests across two pages.
- A larger dataset has 320 completed rides and 240 authenticated immutable driver
  ratings. Two empty continuation pages lead to all 80 remaining driver requests.
  The parent reaches all 320 across 16 pages. Driver/participant overlaps do not
  duplicate rides; active/cancelled and unrelated rides are excluded.
- Repeating a cursor is idempotent. Deleting its fully rated anchor preserves
  traversal. Foreign-account/foreign-list, anonymous and forged requests fail.
  A later-page submission leaves 79 driver requests; its parent counterpart is
  unaffected. Existing ratings, 158 original records and original claims remain
  unchanged except the explicitly deleted disposable fixture ride.
- The first preparation stopped before any test group because the controller
  selected an unseeded manager login. Its original receipt and controller remain
  retained; the successful run uses the actual seeded manager. Both runtimes
  were disposed. Do not relabel the first attempt as a passed run.
- One physical Google Pixel 9 Pro / Android 15 session used the isolated app and
  two accounts sequentially. The phone sent the driver's 31st-trip review, loaded
  the parent's second page (20 to 31 requests), then sent that same trip's parent
  review while preserving the other 30 loaded requests. Six independent
  read-only record checkpoints validate the two new immutable five-star ratings.
  The observer prepared only the first 30 driver ratings, not either phone action.
- Nine original session-window JPEG captures are retained; six are selected for
  publication. They are not native screenshot exports or recordings. Separate
  manual UI review confirms the displayed counts and confirmation states.
- Backend units: 527 passed. Android units: 630 passed, zero failures/skips/errors.
  Three new instrumented pagination cases were built, not executed locally.
  Local iOS model/wire/state checks pass, including stale-account disposal; this
  is not iOS UI, Firebase SDK integration or a physical iOS replay.

## Boundaries

The source APK hash identifies the retained local test APK. Its installed bytes
were not independently hashed. The feature was uncommitted on baseline
`3641ea1add6196cd19742d94bb7c28cf16960d74`; archived native sources and build logs
describe that build. No process restart, real payment, map request, GPS movement,
production callable/index rollout or overall release completion is claimed.

Raw review comments remain private to their author. The received-score summary
is separate from pending requests. Review cards still lack a useful trip title
or date, so the flow remains partial pending that context and interruption replay.

The first bulk phone password entry was rejected; Android's native Paste control
then signed in. No credential was changed or retained. A first tap after scrolling
stopped motion; a settled tap activated continuation. These observations are not
claimed as product root causes. The session ended signed out. The remote
clipboard was visibly replaced by `test-session-ended`, the original local
clipboard restored, and the idle provider dashboard verified after stopping.
Owned helper/services exited; their private session/directory/process are absent,
and all six local service/helper ports are free. No device administration or OS
settings were changed in this replay. Existing public Site access is preserved.
