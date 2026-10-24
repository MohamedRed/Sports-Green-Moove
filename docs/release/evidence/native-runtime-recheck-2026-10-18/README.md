# Native Runtime Recheck

Compilation now precedes disposable-phone policy setup. This does not claim an
update-prevention guarantee or erase earlier failed runs.

## Completed Older Matrix

Source `b292317c8c3bc99161787520db11ecb88f2f4205`, Native CI
[39090160432](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39090160432)
completed successfully. Original JSON receipts and 25 instrumentation transcripts
are retained in `completed/`, local run `7fd23eda3c41d705b3a911fb24f1fbe8`,
result time `2026-10-18T02:52:34.152Z`.

All 33 local groups passed, containing 33 native cases across 25 transcripts;
all eleven primary evidence copies completed. Build, ordinary suite, component
evidence and local replay exit statuses were zero. Setup and cleanup observed
Play services `26.40.32`; Maps/store and location remained enabled, both temporary
background restrictions held, and original store state was restored with
verification true. This is one complete successful execution, not stability
across all machines or proof of physical-device/provider/payment readiness.

## Latest Matrix Incomplete

Source `22b7b03a60402038702d3d36c05adbd7e80d4088`, Native CI
[39090908168](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39090908168)
**failed**. Selected unchanged receipts are retained in `copy-failed/`, local run
`a6c6f812821fad8dfdf1d7089ec912da`. Build, ordinary suite and component evidence
passed. Setup/cleanup again observed the same service version and restored the
store policy successfully. The existing schedule-consent native case passed,
but its primary `adb pull` exited 1 during directory enumeration. It had no
signal or typed process error, and no complete `results.json` exists.

It stopped **before** the new date/time/arrival private-draft restart stage.
Therefore the older 33-group pass does not establish that new subscenario, and
neither successful cleanup nor a recovered diagnostic file turns the failed
copy into a pass. The repeated file-sync failure still needs its root cause
identified; no retry, transfer fallback or timeout increase was added here.
