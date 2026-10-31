# Primary Capture Runtime Observation, 26 October 2026

Source head: `f06c61df32127a317684bbeba6924ddbdfbf1acd`.
Native run: `40335351161`, main job `121615319155`.
The original reports and six diagnostic JSON files are retained without edits.
`artifact-sha256.json` binds these files and the separately generated analysis.
The earlier preparation/baseline report is unchanged.

## Observed Results

- All enabled PR checks succeeded: twenty successes and five intentional skips.
- Ordinary Android matrix: 228 cases, 174 passes, 54 intentional skips, no failure.
- All four new observer contract cases actually executed and passed.
- Ordinary tests, component evidence and the local replay all exited successfully.
- Six observed primary SDK calls returned, each invoked once, in 126-432 ms.
- Probe setup took 3-8 ms and is excluded from primary-call durations.
- The largest sampled main-queue delay was 166 ms. All observers closed.
- One 250 ms sample saw drawing/main-thread synchronization before copy; another
  saw the copy latch wait. Both calls subsequently returned successfully.

## Limits

The intermittent failure was not reproduced. These successful samples do not
establish its cause or prove a repair; observer scheduling can affect timing.
No primary capture API, deadline, outer retry or alternate capture was introduced.
Existing SDK-internal behavior remains unchanged. These are isolated emulator
checks, not physical tracking, a child invitation, a dialer handoff, production,
new accepted screenshots or release acceptance. Earlier negative evidence stays
retained with its original scope. No raw diagnostics are published on the portal.
