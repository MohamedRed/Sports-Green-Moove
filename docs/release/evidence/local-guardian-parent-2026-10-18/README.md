# Parent Verification Request Implementation And Service Proof

The 13 HTTP groups in `services.json` completed on 2026-10-18 at 16:55:35 UTC,
run `2d8dcd75f0a49550daddca977b0a7b36`. These are actual signed-in callable
requests against isolated Auth/Functions/Firestore, not a native UI replay.
No production data or provider calls were used.

## Verified Locally

- Parent identity comes from authentication, never a supplied owner field.
- An eligible absent tuple is explicit null/revision zero, not an empty-page guess.
- Request, manager refusal, reopening, verification, withdrawal and revocation
  read their actual revisions. Eleven real transition events are checked.
- The selected record is correctly read beyond the first history page.
- Child and club choices continue past 20 entries, with owner/kind-bound cursors.
- Removed relationships do not expose a child's current name. Inactive/forged
  memberships do not offer clubs. Closed/inactive grants remain unavailable,
  while existing verification can still be withdrawn.
- Malformed state fails closed; read-only choices/target reads do not mutate data.
- 17 new Android unit tests pass: nine state, three pagination and five wire cases.
  The original JUnit XMLs are retained with their execution timestamps. Later
  unchanged-input Gradle runs reused those test outputs; they are not redated.
- App and instrumentation-test compilation pass. Four Compose route cases and
  one authenticated local app case compile. This is not evidence they ran.

`artifact-sha256.json` protects the unchanged service report, unit XMLs and
generated `build-checks.json`. Source hashes matched when retained. No screenshot
from a component, emulator or physical device is accepted by this report.

## Native Replay Pending

The new app case is first in the isolated native replay. It tests cancel without
writing, request, stale withdrawal refusal, manager refusal/reopen/verification,
recreation with a fresh read, parent withdrawal/reopening, manager revocation and
another account's empty history. Manager decisions use a separate authenticated
local SDK instance, not the management UI. That management UI has its own
[completed browser proof](../local-guardian-review-2026-10-18/README.md).
The earlier [membership refresh](../local-membership-refresh-2026-10-16/README.md)
and [team-ownership boundary](../local-team-ownership-2026-10-16/README.md) proofs
remain dated, separate evidence; this change does not implement team enrollment.

A successful app replay requires the instrumentation transcript, all eight
device assertions, hashes of five current screenshots, a same-run completed
primary copy receipt, and independently checked eight audit events/actors. A
failed primary copy cannot be replaced by cleanup. Only then is the separate
`guardian-parent-results.json` emitted. This report is not yet present here.

The full native matrix now has 34 groups/36 native cases, preserving all previous
33 groups and adding the parent flow. Earlier 33-group reports are unchanged
historical runs, not executions of the expanded matrix.

## Remaining Scope

Native app/device execution, screenshots and physical-device verification remain
unproven for this new flow. The iOS parent screen, child/team enrollment, team
conversations and personal emergency contacts remain incomplete. Nothing has
been deployed to production; no safety-audit or final-release manifest item is
accepted. Existing booking/search authority has not been migrated or granted
from a verification screen. The overall release goal remains open.

Replay services with `npm run test:guardian-parent`. Android native UI runs via
the existing disposable-emulator native workflow; it requires the isolated
session and successful primary evidence transfer. Do not use production users.
