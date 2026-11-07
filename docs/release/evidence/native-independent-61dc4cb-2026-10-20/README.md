# Independent Safety Trials And Full Android Replay

Native CI `39345199425`, source
`61dc4cbbfe7be43b14f878f86e358b17bd53d2e7`, completed successfully. The main
artifact is `12231741557`. Focused artifacts are `12230374151` (emergency
identity), `12231336459` (ride observation), `12230424198` (native startup), and
`12230598072` (remote completion). Each focused case ran on a different fresh
GitHub-hosted disposable emulator, not merely a new account on one shared phone.

## Executed Scope

The ordinary XML has 167 entries: **126 executed and 41 explicitly skipped** for
the build profile. The declared suite size includes those skips; neither the
Gradle summary nor a compiled test count is used to count passes. Five child and
seven parent contact components are among the executed cases.

The full isolated replay retains all 36 groups and 38 native cases, with 30
original successful instrumentation transcripts and primary transfer receipts.
The network record proves the required Wi-Fi start, actual cellular handover,
offline unconfirmed send with draft retention, restored delivery and transport
request release. Two messages, no duplicates, and the known synthetic-data
boundaries remain. This successful repetition does not explain why the preceding
run selected cellular during preparation or establish long-term reliability.

The four focused cases independently retain their original native markers,
transcripts, transfers, app/service result checks and environment disposal:

- The parent selects the child, saves the original contact, keeps an old form
  open during host-side profile recreation, and cannot write or read with the
  obsolete authorization. A fresh manager verification does not inherit the old
  contact; the newly saved contact survives Activity recreation.
- The parent observes fresh, stale and recovered synthetic driver positions,
  pickup, dropoff, ride completion and history through the isolated SDK backend.
- Native startup distinguishes a written point, valid retained duplicate and
  invalid capture; it resumes and stops on sign-out.
- Remote ride completion stops the background tracking service before the
  driver returns, without signing the driver out or changing unrelated rides.

## Device And Data Cleanup

Every focused APK preparation is bound to the exact raw setup receipt digest and
both installed APK hashes. Original setup, one-use claim and final restoration
files are retained. The guard remained asserted at the preflight and postflight
checks; the source path opens no installation window between them. Store process
observations may be false while the independent installation guard is active.
Own apps, background modes, stopped state, launcher and temporary administrator
were independently restored or removed, with no failed cleanup flag.

The three owned-runtime cases report successful CLI exit, destruction of their
owned temporary environment and closed local endpoints. Observation additionally
verifies its fixture cleanup and package removal. This is disposable test data,
not deletion of a Firebase project or customer records. The main lane retains its
older store/admin restoration receipt; it does not claim full launcher restoration.

Receipts and checksums establish consistency of the retained artifacts. They do
not provide cryptographic attestation of an emulator, prove claim uniqueness
across copied bundles, or independently authenticate GitHub. Provenance is the
recorded source/run, separately named job artifacts and successful cleanup-aware
CI gates. No setup receipt alone accepts a user flow.

## Publication And Limits

Only the four emergency-identity captures have been visually reviewed for new
publication. Other focused captures are retained as test output, not newly
approved layouts. Earlier clipping findings remain open. No image is edited to
hide a defect. Profile recreation and manager re-verification are controlled
host-side actions in this isolated scenario, not a newly tested manager UI.

The child does not log in during this trial. Child-account linking, normal ride
discovery, real phone handoff, physical GPS/background behavior, live payments,
provider push and safety-audit acceptance remain outside this evidence. iOS and
paid real-map jobs were intentionally skipped. Neither green Android CI nor this
partial visual gallery completes the release goal or publishes the app itself.

Earlier failures remain unchanged under `emergency-selection-race-2026-10-19`
and `child-contact-heading-pass-2026-10-19`. Raw bytes are protected by Git
attributes and the checksum manifest; archived source hashes bind all four host
reports to their executed code.

## Later Attempts On 20 October

The success above remains the original `61dc4cb` snapshot, not a claim that every
subsequent replay passed. At `a9b716a`, run `39417800031` passed the trip-change
native method but failed its mandatory primary evidence transfer. Read-only
diagnostics recorded `adb: device offline` and an adbd transport disconnect; the
cleanup-time copy of 90 files cannot promote that failed primary copy to success.
One independent emergency-identity job also failed dependency acquisition before
device preparation; the same-head restoration job compiled and passed. No source
regression or exact acquisition/transport cause was established by those logs.

At `62eef1c`, [run 39420260518](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39420260518)
completed with all six independent cases successful, including explicit session
disconnect across two app processes. The ordinary UI job `118619147543` compiled
successfully, booted its emulator and then lost the adb shell connection with
`error: closed` while disabling animations. The action terminated the device
before the test script, ordinary suite or local replay began. This remains a
failed full job, not an app-flow failure with a proven root cause. Neither an
automatic retry nor a production workaround was added. The new disconnect proof
is retained separately in `session-disconnect-native-2026-10-20/`.

The subsequent `588fb21` recheck, run `39422026774`, completed successfully:
the ordinary suite, full local replay and all six focused CI jobs passed. Its
original transcripts, primary-copy receipts, final report and independent device
restoration are retained in `native-recheck-588fb21-2026-10-20/`. This later pass
does not explain or erase the earlier transport/acquisition failures, or verify
the subsequently prepared real-provider search/booking trial.

Later observations: the `b158a75` run `39426320715` fails at a mandatory primary
capture transfer after the native trip-change input test passes. Its selected
original negative receipts, raw transcript, ordinary XML and independent device
restoration remain in `native-copy-failure-b158a75-2026-10-20/`. A subsequent
separate approved search/two-seat booking trial at `7d93569` passes with six real
map calls and three independent saved-state checkpoints; see
`parent-search-booking-native-2026-10-20/`. That targeted success does not accept
the failed complete replay, physical tracking, payments or release readiness.
