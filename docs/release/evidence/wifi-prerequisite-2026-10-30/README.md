# Passive Wi-Fi prerequisite observation

On 30 October 2026 the new passive prerequisite was exercised once against an
existing Android 35 Google APIs arm64 test AVD on macOS, launched read-only with
no snapshots, UI or installed SGM apps. This is not a pristine CI device, a
physical phone or a product user-flow test.

The observation ended unsuccessfully after 180003 ms and 59 samples. Cellular
remained the validated default; Wi-Fi was available but did not meet the strict
default/INTERNET/VALIDATED/non-captive predicate. Existing system history included
Wi-Fi DNS-resolution failures and successful cellular probes. These non-atomic
observations do not identify the DNS cause. Waiting alone did not fix it.

`observation/` retains the original sanitized start, all samples, existing history
and failed outcome. `source-digests.json` was recorded before execution; the five
files were unchanged after execution. No addresses, network IDs, targets, raw
dumps or credentials are retained. The `fallback` history enum describes an
existing Android system probe, not an application fallback introduced here.

Only the owned emulator was stopped afterward. Its process exited successfully,
ADB listed no devices and ports 5588/5589 had no listeners. No SGM app, device
owner, setting, logging property or radio was installed/changed for this trial.
The two base userdata files retained their observed metadata and their
during-probe hashes after stop (no pre-launch hashes were taken):

- qcow2: `f0c3d9ec78831249b1295553af91d4a12860a16759c3cccfad174c0193cc71a0`,
  mtime 1792869910, 1484455936 bytes.
- img: `686e872867548b54e7b12e4e161ddc1c3d16312ae51e0e3c203e5deb92ba82d5`,
  mtime 1792858916, 6356992 bytes.

Separately, the preceding `9abc639` focused chat job 124201947693 in run
41096043272 completed successfully without this change. That job status is not
artifact-level proof here, nor evidence that this prerequisite repaired anything.
The full run was still active when this note was written. Existing failed trials
and all physical/release requirements remain open. No public flow status or
media is promoted by this diagnostic-only observation.

The focused runner now checks the prerequisite before app installation, with a
fixed budget, bounded commands, immutable sanitized receipts and no new probes.
The actual handover/offline/retry assertions and their 30-second preparation
deadline remain unchanged, as does the required full-matrix path. Existing
`test:local-flow-isolation` covers both test files in web/native CI; no new
workflow lane, paid map request, production deployment or Terraform is needed.

Local verification after the retained trial: 80 targeted tests and all 3063 root
Node tests passed, with no skipped or failed cases. These are harness/parser
checks, not additional completed phone flows. `git diff --check` also passed.
