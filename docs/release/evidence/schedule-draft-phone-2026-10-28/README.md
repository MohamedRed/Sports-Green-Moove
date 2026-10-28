# Schedule draft on a physical Android phone, 28 October 2026

## Completed, bounded trial

Manual observation on a Pixel 9 Pro / Android 15 verified sign-in, native date
and time pickers, switching between two booked trips, Android App info Force stop
and its confirmation, disabled Force stop afterward, reopening from App info,
return without credentials, draft recovery, separate-trip isolation and sign-out.
The draft retained 30 October 2026, departure 12:00 and desired arrival 13:00
(Europe/Brussels). The other trip retained 29 October at 10:00 with no arrival.
No proposal was submitted. Both displayed prices stayed EUR 2.50.

The twelve original `completed/` JSON files bind nine ordered, independent
stored-state checkpoints to run `9241a517826f08df719333adbed6dcac`. Those reports
explicitly do not prove UI, process lifecycle or private draft storage; the
separate `ui-review.json` records the manual observation. No independent PID
measurement, installed-byte hash or package-absence query was made. The verifier
normalizes the driver's user-document `updatedAt`; remaining compared records,
claims and live data were unchanged. It found no proposal or ride created.

The retained APK SHA-256 is recorded in the review. Its production Android
source/build configuration has no diff between origin 1518a8b and reviewed head
3c89905. This does not imply a newly built binary or proof of installed bytes.
Accounts and services were disposable and isolated. No production writes,
payments, map requests, other-account draft or iOS result is claimed.

## Earlier incomplete attempt

`attempt-1/` retains six original reports for the separate run ending in ENOSPC
while writing its fourth checkpoint. Only three checkpoints were saved;
`completed` remains false. No force stop/relaunch took place in that attempt.
The host disk exhaustion's cause is unproven. The later trial does not erase it.

## Media and cleanup

Recording failed to start due to screen-sharing permission. Chrome was not
restarted and permissions were not changed. Native screenshot actions produced
no recoverable export. No new video or gallery image is accepted or published.
Session-window images require separate approval and must retain that provenance.

Both runtime cleanup receipts report group exit, removal of private session and
runtime, closed endpoints and no cleanup failure. Both private helper groups
were stopped and removed their credential handoff directories. Each phone
acknowledged uninstall and its session was stopped. Package absence was not
independently queried. No credentials or raw private baseline are retained here.

`artifact-sha256.json` hashes this report, the manual review and all eighteen
original JSON receipts. Source files referenced by the completed observer report
are retained by content hash in `../source-archive/`. The release manifest,
full Android CI gate and real provider/physical tracking requirements remain open.
