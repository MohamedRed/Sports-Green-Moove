# Startup Contract Unit Checks

The retained original XML reports contain 388 Android unit cases and 352 Functions
unit cases, with no failures, errors or skips. New cases cover exact per-point
acknowledgement identity/counts, valid retained and invalid captures, transaction
clock reevaluation, preservation of actual-commit semantics, failure propagation,
and clearing a previous resume error without affecting another account.

`unit-results.json` records hashes of the changed implementation and focused test
sources; those exact files are preserved in the shared content-addressed source
archive. These are unit checks only. They do not override the separately retained
full-replay startup ANR, the earlier independent cleanup failures, or the later
first-resume acquisition failure. No native, physical-device or release result is
inferred from these counts.

The separate `location-order.json` retains ten actual local ordering groups,
including twelve concurrent authenticated requests, duplicate/delayed batches,
parent authorization, native/provider register ordering, independent child
registers, invalid timestamps and preservation of delayed-event audit records.
It binds the new receipt API to exact archived source. These remain synthetic
local service checks, not real provider delivery or accepted safety-audit events.
