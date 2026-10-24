# Native Directory Verification Still Open

These runs are diagnostic attempts, not accepted nine-case evidence. The last
accepted eight-case conversation run remains unchanged in the earlier directory.

- [38808160633](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38808160633),
  `b7fdc6a`: the new case traversed the old conversation page, then attempted to
  select a booking while its list was still loading. The harness now waits for
  the exact server-loaded booking row, rather than just the screen container.
- [38810358711](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38810358711),
  `6200e27`: exposed a real context-contract error. Publication writes an ISO
  departure date, whereas historical fixtures used Firestore timestamps. Fixed
  by explicitly parsing both valid representations, with no default date. A real
  local publication/request/approval/first-send service regression now passes.
- [38812028442](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38812028442),
  `504acaa`: the process crashed during the preceding driver approval/account
  switch case, before the new directory case ran. The reported stack ends in
  `SlotWriter.moveSlotGapTo` / `CompositionImpl.dispose`; the cause is not yet
  established. No exception swallowing, automatic test retry or speculative
  dependency upgrade is being used to claim a fix.

The harness now preserves each sanitized instrumentation result and captures the
crash buffer on failure. Failed attempts retain diagnostic screenshots but never
emit a successful `results.json`. These diagnostics are not partner media or
proof that the complete directory UI passed. Reproduce/investigate the lifecycle
crash and complete the nine-case run before accepting the new app captures.

Separately, live unread updates on deep pages across multiple devices, new group
conversation initiation, network recovery and push delivery remain unverified.
Local service counts and a passing older app exchange do not complete those flows.
