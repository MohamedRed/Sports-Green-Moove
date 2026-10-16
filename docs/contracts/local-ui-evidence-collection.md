# Local Android Evidence Collection

## Why Command Results Are Retained

At application commit `c9a8300cdd291ebd88d00c9ea1dc443e60a28969`, Native CI
run `38919957339` had two different failures:

- Attempt 1, local run `3b96c544b35c200db6cf14cc61e14496`: the final network
  case timed out during preparation. The device had Wi-Fi and a reachable
  backend but no default data subscription, no cellular callback, and no
  cellular internet transport. The actual disconnection test did not start.
- Attempt 2, local run `6f43720bb06338239b4827fb623124c4`: all 12 local
  instrumentation transcripts, totalling 20 cases, reported success. The final
  `adb pull` exited 1 before independent database verification and `results.json`
  generation. Cleanup subsequently printed a 55-file transfer summary. That
  summary does not prove the earlier command succeeded or the whole run passed.

Neither attempt is accepted as a complete current-head app replay. A completed
device receipt alone does not prove stored message/notification invariants.
The underlying transfer failure and intermittent data-subscription setup are
not explained or fixed by adding diagnostics.

## Collection Contract

`collect-local-ui-evidence.mjs` runs only for an explicitly disposable local
emulator and a fresh run ID. It confirms transport identity before copying and
records the actual host tool version. File-sync tracing is enabled for the copy
only; authentication, packet and raw read/write tracing are not enabled.

Each of the four boundaries has a different receipt: confirmed restart,
response loss, network recovery and failure cleanup. A cleanup copy cannot
replace the primary result. Same-phase copies are not retried. A nonzero exit,
signal, timeout, output overflow or launch error remains a failure even if stdout
contains a success-looking file count. The explicit local credential is redacted
from both streams, and raw child-process errors are not echoed by the runner.

The existing final saved-data checks and complete-results requirement remain
mandatory. Successful file sync is command evidence only, not flow evidence.
Diagnostic receipts are not automatically accepted in the release manifest or
published as app screenshots. Review all retained diagnostics before sharing.

No device restart, forced shutdown, production access, new operational fallback,
infrastructure resource or Terraform application is introduced.

## Checks

`npm run test:local-flow-isolation` includes subprocess-backed success, exit-1
summary, signal and redaction tests, launch/timeout/buffer failures, target guards,
separate cleanup receipts and the unchanged final verification ordering. Both
native and web smoke workflows run these checks. Native CI must still execute
the real replay to diagnose or verify the original transfer problem.
