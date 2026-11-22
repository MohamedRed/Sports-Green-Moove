# Four Consent States Survive A New App Process

- Tested source: `ed19578ad66e5c39bf68e418063e4290473b4327`.
- Native run: `39079313231`; Android UI job: `117532838423` (success).
- Artifact: `12119060479`; local run: `223ded56b4c8c9eca5ab8d6f2ea61fbc`.
- Full replay completed: `2026-10-17T23:53:35.827Z`.
- Four-state stage completed: `2026-10-17T23:52:07.098Z`.

All 32 required local groups passed: the previous 28 plus pending, partially
accepted, declined and withdrawn proposal recovery. The 23 instrumentation
transcripts contain 31 native cases and all ten named evidence copies succeeded.
Ordinary instrumentation separately reports 108 cases: 82 passed, 26 local-only
conditional skips, no failures/errors. The skips do not prove recovery; the
separate local transcripts and independently checked records do.

`completed/` preserves 83 unchanged original files: 72 local JSON/text records,
seven consent/recovery PNGs, ordinary XML, suite exit status and two keyboard-probe
logs. The SHA-256 inventory covers their original bytes. Historical failed runs
remain unchanged and failed, including the early-withdrawal readiness defect and
the separate file-copy interruption in the
[interruption report](../local-consent-restart-interruption-2026-10-17/README.md).

## Verified Scope

The real app created four price proposals, one partial acceptance, one refusal
and one withdrawal. Each trip had two approved reservations belonging to two
different parents. The preparation process was 11111. The guarded host helper
issued force-stop and verified no app process; reopening ran in process 11308.

The first parent session restored without login. Pending stayed 0/2 with decision
actions available; partial stayed 1/2 with the saved agreement and no duplicate
decision actions. Two explicit refreshes retained each state. The second parent
could view only their own bookings and still respond to pending/partial. The
driver saw the same proposal identities/counts and the appropriate actions.

Declined/withdrawn cases retained approved original-price reservations without
an active change entry after repeated list refreshes. The driver returned to the
original unchanged editor, not an active proposal review. This verifies terminal
entry state, **not a decline/withdrawal proposal-history screen**.

The host's final snapshot exactly matched every complete trip, both bookings,
proposal and notification hash captured before the process boundary. Decision
counts remained 0/1/1/0; notification counts remained 2/2/5/5. No quote or balance
was created. Both parent review scopes and outsider denial were independently
checked. The stage receipt still has `fullAppReplay: false`; only `results.json`
records the complete 32-group replay.

## Capture Review And Remaining Work

Pending and partial captures show their respective counts and decision controls.
The declined and withdrawn captures are byte-identical, showing both unchanged
reservations together. Both originals are retained; only one is published, along
with pending/partial. Images are unedited. Older gallery images keep their dates.

The review also exposes an existing time-display mismatch: change dialogs show
13:50 +02:00, while the reservation cards show 11:50 for the same trips. The shared
server summary formatter uses its process timezone rather than explicitly using
Europe/Brussels. Timezone-consistent trip/booking labels remain a separate defect;
this consent-state pass does not accept their correctness.

Unsent-draft recovery, successful real routes, applying changes through the app,
proposal history, real charges/refunds, push delivery and physical tracking remain
open. The successful copy does not prove the earlier intermittent copy/update or
keyboard failures repaired. No production deployment, release-manifest promotion,
provider substitute, updater pause, fixed sleep or action retry was introduced.
