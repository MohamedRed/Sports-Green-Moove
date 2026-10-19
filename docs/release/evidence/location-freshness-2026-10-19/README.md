# Location Observation Freshness

The original formatter treated receipt time as position age. The preserved
ten-case unit reproduction had nine failures: a two-minute-old point uploaded
just now appeared fresh, future upload timestamps hid age, missing/invalid/future
observation times appeared recent, and delayed child observations displaced newer
captures in the summary. The missing-first-point case already passed.

The repair computes age from the observation's `capturedAt`, preserves the existing
ninety-second boundary, and labels absent, malformed or future observation times
as unverified. Receipt time cannot make an old observation fresh. Native upload
receipt time is server-owned; submitted identity and source remain server-bound.
No guessed timestamp, automatic legacy backfill or new fallback is introduced.

`before.xml`/`before.txt` preserve that original negative unit run; `after.xml`
contains twenty passing targeted cases and `full-functions.xml` preserves all 318
passing function unit cases. Sources are bound to original bytes, with the base
commit and changed worktree sources distinguished.

`services.json` comes from a separate clean isolated run of actual authenticated
driver/parent callables. Five groups verified the initial missing-point warning,
server-owned identity/source/receipt time, a delayed position remaining old in the
parent snapshot, refusal of parent driver uploads without modifying the stored
point, and a recent observation showing its capture age rather than upload age.
The administrative client was closed before the positive result was written;
the original script exited zero and all owned emulators shut down.

The first service harness completed five observations but left its administrative
database client open. It was explicitly terminated and is retained only as
`initial-unclosed-client.*`, not an accepted completed run. The later clean run
has a different identity and cannot inherit or promote that preliminary result.

This is unit and local service evidence, not native screen, physical GPS, delayed
live webhook, real network-loss recovery or release acceptance. Automatic screen
refresh, live map positions, child-specific stale warnings, out-of-order delivery,
device clock differences and physical-device tracking still need implementation
or verification. No production data, paid provider request or real payment was
used. The separate native account-switch replay is not proved by these checks.

`ci-time-budget.json` separately retains the a7dae8a web-smoke job's authoritative
15-minute timeout annotation and skipped remaining checks. That cancellation is
not an accepted run. The workflow budget is now 30 minutes to accommodate its
expanded isolated suites while preserving every assertion, rule check, build and
cleanup artifact. No retry, disabled check or successful outcome is substituted;
the complete new-head workflow must still execute.
