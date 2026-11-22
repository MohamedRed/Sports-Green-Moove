# Schedule Replay Interrupted Before The New Case

Source: [Native CI 39050116840](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39050116840),
head `b72ee7f8f9e229e7e5e40b3ef2cebc9a5e78099c`, Android job
`117446805588`, artifact `12107203326`, uploaded on 2026-10-17 at 16:51 UTC.
The job failed. The eight original files listed in `artifact-sha256.json` are
diagnostics, not an accepted full replay or schedule result.

## Ordinary Screens

The unchanged XML declares 104 cases: 73 passed, nine failed, 22 conditionally
skipped, zero errors. All nine failures are native-window focus waits, before
typing: four conversation cases, both activity/dialog readiness probes, one
cancellation case and two trip-change cases. The two retained probe logs show
attachment, a window token and a resumed lifecycle, but `windowFocused=false`
both before the wait and at failure. These observations do not identify the
display/lock/window cause and do not prove production typing is broken.

The earlier passing keyboard evidence remains historical evidence; repeat-run
reliability is contradicted by this run. Added read-only state diagnostics still
need execution. No focus force, wake/unlock, longer wait, retry or alternative
typing path is introduced.

## Independent App Replay

Run `c125527403f0a0f684268a4f1fbb46b0` completed the three-account price-consent
instrumentation and wrote its device receipt. Its named primary copy then exited
1 while building the file list, without a signal, process error or explanation.
The cleanup copy exited zero and recovered diagnostic files, but cannot repair
the failed named copy or establish independent host verification.

The time/address case and new date/desired-arrival case were not reached in this
replay. There is no accepted schedule stage or full `results.json`. The ordinary
suite's conditional skip of these local-only cases is not their app replay.
Native assertions alone must not promote this run to a complete result. The
silent file-sync failure remains unexplained; the earlier successful 26-group
run does not explain or resolve this recurrence.

No new screenshot is published. Existing reviewed captures keep their original
source and date. No application, real payment, live route, physical-device,
tracking or safety-audit evidence is accepted by these diagnostics.

The [later 27-group replay](../local-trip-change-schedule-native-2026-10-17/README.md)
passed on the same app/test implementation and reached the date/arrival case.
It does not explain or repair this run's nine focus failures or primary-copy
failure. This directory remains failed diagnostic evidence, not that later run.
