# Submitted review history, 29 October 2026

The authenticated isolated regression creates 26 completed ride fixtures with four
other participants each, then submits 104 immutable reviews through the actual
local `submitRating` HTTP callable. The old `getInbox` handler returns a review
prompt that was already submitted: its author-wide query stops at 100 rating
documents. Repeating the same scenario with the corrected handler returns none.

`before.json` and `after.json` retain the independent runs, executed source/module
fingerprints and endpoint/client disposal. Both use the same current fixture and
test-controller sources. For the controlled before run only, the disposable
Functions runtime's inbox module is compiled from the exact original source in
`4c73caa24aa7f4bc4ee394790052db336f671425`. The canonical checkout is not reverted,
and other runtime modules are unchanged. The original and executed compiled bytes
are archived separately. The normal after run has no override. This is a test
comparison, not a production fallback or a full old-branch replay.

All seven after checks pass:

- 104 authenticated submissions remain stored without a returning prompt.
- A new unreviewed ride still produces exactly one distinct prompt.
- The other account keeps its own 27 independent prompts.
- A new explicit submission disappears across three refreshes; resubmission is
  rejected without adding or changing a rating.
- The parent's submission hides only that parent's own prompt.
- Unauthenticated inbox access is rejected and 158 original records and the
  original actors' claims remain unchanged.

The final total is 106 stored submissions across the two actors. Completed rides
are fixture-prepared, not performed through this test's ride UI. No star-average
or ranking policy is changed. The implementation point-reads exact immutable
rating IDs for the existing loaded ride candidates, with at most 60 reads and no
read when there are no candidates. Notification/chat contracts are unchanged.

`regression.json` retains all 24 passing local service groups; `units.txt` retains
501 passing backend unit cases. Independent endpoint binding confirms all four
owned emulator ports are closed after disposal. Original failed and successful
results are separate and checksummed. Initial temporary receipts were cleared by
the host; these are fresh retained replays, not reconstructed missing receipts.

Limits: existing ride queries remain bounded to 30 rows each. Discovery beyond
those windows, received-rating presentation, physical phone UI, simultaneous
devices, iOS, production deployment, payments, push and release acceptance remain
open. No real provider, map request, customer account, native screenshot or new
video is used or accepted. Existing October 23 phone evidence keeps its date.
No Terraform or index change is needed for the existing point reads.

CI adds `npm run test:review-history`, retains its receipt even on failure, and
validates this bundle without shortening any original smoke workload.
