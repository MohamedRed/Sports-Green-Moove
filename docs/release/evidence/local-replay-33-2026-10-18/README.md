# Completed Local Replay, Failed Runtime-Stability Check

[Native CI 39087981053](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39087981053)
executed source `608bc4168c99ff9726aa49c093986b607e0569fd`.
Artifact `12122425055` contains 16,045,095 bytes. Local run
`e4d6f943e6f1663e6881db88a72d344c` completed all **33 planned local groups**
at `2026-10-18T02:12:02.122Z`. The broader CI job remains **failed**.

## What Ran

`originals/` retains 85 byte-exact files and their SHA-256 manifest: all 55 local
JSON observations/results, all 25 instrumentation transcripts, the ordinary
component XML, device setup and restoration receipts, suite exit statuses, and
a bounded original CI log excerpt of the runtime mismatch. Screenshots are not
copied into this evidence set; the existing reviewed gallery keeps its original
images and dates. There is no new recording.

All 25 local transcripts passed, totaling 33 instrumentation cases. All 11
same-run evidence copies succeeded. The ordinary component report declares
116 cases: 88 passed, 28 conditional local-only cases skipped, no failures or
errors. Its three private-draft component cases ran. The suite status is
ordinary=0, componentEvidence=0, localReplay=0; this precedes the separate
runtime verification failure and does not make the overall job successful.

The completed replay includes the actual two-stage private draft recovery,
parent/driver consent and closed history, booking retry from the search screen,
messaging after response loss, account switching, and the strict Wi-Fi/cellular
handover followed by full disconnection and confirmed messaging after recovery.
The default data subscription is valid in this run; earlier missing-default
failures remain retained and their cause is not proven repaired by this pass.

The draft recovery uses new process IDs 10953 and 11097 with the same private
draft hash, unchanged trip/booking/notification hashes and no automatic proposal.
The host issued the guarded stop and observed no process afterward; its
`observedBeforePid` is null, so it does not prove that the host killed a process
that was still running. Other draft field variants and physical phones remain
outside this receipt.

## Why The Job Is Still Failed

Store-only background restrictions remained `RUN_IN_BACKGROUND=ignore` and
`RUN_ANY_IN_BACKGROUND=deny` at cleanup. Location remained enabled, no active
store installation was observed at cleanup, and the original background modes
and stopped state were restored (`restored: true`). However, runtime verification
failed (`verified: false`): Google Play services changed from `24.23.35` at setup
to `26.40.32` at cleanup. Both services and store remained enabled.

The retained original CI excerpt proves that version mismatch. These end-state
observations do not identify the update initiator, when installation occurred,
whether it was already scheduled at setup, or whether this change caused any
earlier PixelCopy or subscription failure. No process crash is inferred here.
The restricted background modes alone therefore do **not** prove updates stayed
paused for the entire replay. Do not ignore the mismatch, disable location/maps,
relax the invariant or call this runtime control accepted.

The next source change adds read-only current carrier-loader observations and
moves website report uploads after checks. Those changes are not present in this
run and their device execution is not established by these receipts.

## Remaining Scope

This is a completed local replay, not all product flows or a launch approval.
Successful place/route changes and application in the real app, real payments
and refunds, team enrollment/group chat, emergency contact, physical tracking,
and real safety-audit exports remain open. No production deployment or final
release manifest item is promoted. Previous failures and their raw receipts are
preserved. The wider goal remains active.
