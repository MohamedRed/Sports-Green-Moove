# iPhone Fixture Observation

On 4 November 2026, run [41843194537](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41843194537)
at source `01a2f0585183f2a6d20b004f8f1cfd2374ca070b` compiled and launched the
SDK-linked app on an isolated iPhone simulator. All seven XCTest cases executed:
six passed, one failed. `summary.json` preserves each case and its duration.

Both added search-consent cases passed: explicit consent, changing the child or
tracking mode, and invalidation of the accepted selection after a seat change.
The five older cases are primarily identifier checks, not full transaction proof.
The messages/rating case failed because `messages.rating-prompt.action.5` was not
found. The containing review card was found. No original accessibility hierarchy
was exported, so the exact cause of the missing child control is not established.

The test suite ended at 14:32:40 UTC. The combined build/test step was cancelled
later under the unchanged 35-minute job limit. The reason its process did not
finalize promptly is unknown. Simulator disposal succeeded; the overall run is
**cancelled**, not successful. SDK compilation and launch were observed, but this
does not accept the complete build/UI release gate or any end-to-end iPhone flow.

The complete original workflow ZIP was downloaded, integrity-checked and kept
privately alongside the formatted job log. Their sizes and SHA-256 hashes are in
the summary. Raw logs are not published. Earlier live log snapshots were buffered
and incomplete; only the complete terminal log supplies these case outcomes.

The candidate adds separate accessibility containment, unique spoken star labels
and 44-point targets. The existing rating test keeps its original assertions and
also checks successful submission. Failure diagnostics are bounded to 32,000
characters of the synthetic fixture hierarchy, with the same six-second wait.
All seven cases remain selected. Build and UI execution now have separate steps,
without retries, a higher deadline, artifacts, signing or provider secrets.
These candidate changes are not proven until their own complete run succeeds.

No real authentication, payments, location journey, production writes, physical
iPhone safety scenario or new screenshot/video is accepted by this observation.
Android and iPhone release requirements remain open.
