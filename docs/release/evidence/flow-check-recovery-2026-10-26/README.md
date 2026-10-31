# Flow Check Recovery, 26 October 2026

The original pushed source is `82662bd8f226fceb9480432e3236d38673ed3495`.
The saved original job metadata is allowlisted directly from GitHub, not rebuilt
from intended test outcomes. Raw diagnostic logs remain private.

## Original CI Outcomes

- Web job `121500489068`, run `40301577020`, reached its 30-minute limit during
  `Test Stripe webhook flow`. Earlier checks passed; the payment check was
  cancelled and later checks did not execute. The longest individual completed
  step took 133 seconds. This is cumulative sequential workload, not evidence
  that the payment test hung or passed.
- Main Android job `121500489834`, run `40301577198`, succeeded, including
  `Run Android Compose UI tests`. This does not make the whole workflow green.
- Focused job `121500490477` failed its emulator-runner action. The retained
  private log ends preparation at `settings put global transition_animation_scale
  0.0` with exit 255, before the owned test script. The underlying device failure
  is not diagnosed or fixed by the web-workload change.

## Workload Correction

People and safety service checks now use a separate runner, with their own
dependency installation, Functions build, media tools and evidence uploads.
The original main 30-minute limit is unchanged; the new group has a 20-minute
limit. No command, conditional, environment, producer ID or upload was removed.
The semantic fingerprint test retains all 111 original non-setup workload steps
and all nine artifact uploads. Both groups must succeed before the original
required `Functions, admin, and website smoke` check can succeed. Failure,
cancellation, skipped or empty results cannot pass the gate.

Local partitioning tests and the 2,275-case Node suite pass. The first broad
local replay collided with the intentionally live phone fixture on port 5001;
five cases failed. That output is retained privately. The owned fixture was
closed, all four endpoints were verified closed, and the unchanged test commands
then passed. No port fallback, skip, timeout extension or application change was
introduced. A new CI execution is required before claiming this correction is
verified on GitHub.

## Third Phone Attempt

One new disposable Pixel 9 Pro / Android 15 session reached a responsive launcher
but remained at the provider's installation status. The isolated app was not
visible in the app drawer. The documented package query was rejected by the
provider as unsupported, so independent package absence is not proven. No login,
pairing code, approval or actual child-flow checkpoint occurred.

The session was deliberately stopped and returned to the dashboard; it was not
restarted after an observation timeout. The read-only observer retained zero
checkpoints and `completed: false`, then closed its Firestore and Admin clients.
The owned helper exited and removed its private directory. The owned local
runtime, private session file and four endpoints were independently closed.
No device policy was changed, map request made, payment sent or production data
written. No new screenshot or recording is published from this startup attempt.
The two earlier incomplete phone attempts and their reviewed media stay intact.
