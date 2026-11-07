# New-Budget Native Gate: Primary Transfer Failure

Source `91c4a09fa70a7d4e0d2537f46000767275ca83ba`,
[run 41106555169](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41106555169),
main job `124237793442`. This execution uses the 50-minute outer budget and
terminates with failure after 20 minutes 37 seconds. It is not another timeout.

## What Completed

The complete ordinary inventory passes 205 cases, explicitly skips 54 and fails
none. All eleven independently executed safety jobs, backend, web, release and
transport-diagnostic checks finish successfully at this exact head. The full
replay reaches 21 successful instrumentation transcripts containing 29 native
cases, through preparing and reopening confirmed trip consent. This is a partial
replay, not the complete 37-group/40-case suite. The missing final `results.json`
and replay exit status 1 prevent complete-gate acceptance.

Ten primary evidence copies finish successfully. The next, named
`trip-consent-restart`, returns exit 1 during directory transfer. Its failure
receipt is retained verbatim. A later `failure-cleanup` copy retrieves the
remaining files; it does not retroactively pass the primary transfer. Device
restoration independently verifies app removal, background/stopped/launcher state,
removal of temporary administration, and the original installation policy.

## What The Failure Shows

The host process observations immediately before and after the failed primary
copy contain the same bridge PID and start time. A new bounded daemon event is
`connection-terminated-read-failed`; the earlier emulator TCP socket disappears.
Three subsequent directory probes report the device offline. The guest service
log reports a transport write failure and then a new authenticated transport.
These establish an interrupted host/guest connection, not why it interrupted.
They do not prove a bridge-process restart, product crash, out-of-memory cause,
device-service defect or renderer repair. Later memory observations cannot rule
out an earlier transient condition.

The independent generated-file diagnostic passed at this head; its earlier
account-free failure remains separate evidence that a product app is not needed
to reproduce some transfer failures. A passing diagnostic is not a transport fix.
The earlier complete success at `13767b4` remains intact and predates this budget
change. No retry, alternate transport, additional timeout change, relaxed capture
guard, replacement screenshot or other workaround is introduced here.

## Scope And Preservation

Metadata binds the terminal head, job and downloaded artifact. Original selected
transcripts, primary/failure-cleanup receipts, ordinary results and restoration
are copied without editing. The complete private artifact's filename/hash
inventory records that no final replay result exists. Checksums cover every
retained file except this README and the checksum file itself. The original
workflow is retained to verify its actual 50-minute budget.

Publish one brief incomplete-result note, update the existing blocker, preserve
all galleries and original dates, and keep public access unchanged. No new media
is published. This is local automated evidence, not physical tracking, a new
cancellation-conflict phone trial, support delivery, safety-audit or release proof.
