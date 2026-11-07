# Search Date and Time Follow-Up, 31 October 2026

Scope: native Android search controls and simulated component actions. This is
not acceptance of a physical calendar interaction, complete search or booking
recovery, real maps, payments, iOS, screen-reader accessibility or release readiness.

## Controls and Source

The raw ISO input is replaced by native date and 24-hour time dialogs. Labels
use Belgian local time; the existing wire instant and server contract remain
unchanged. Nonexistent and repeated local hours are rejected explicitly rather
than silently converted. Cancellation keeps the accepted choice.

The candidate APK is `be.sportgreenmoove.app.local`, SHA-256
`c7c6f2a4b806c20a81c646b8d3fa0f06087f03c28babf26c80e7f9e23f35b08b`.
It was built from working-tree sources on `ea648f6`, not an attested clean
checkout. Its production-source hashes match the final retained production
sources. Test-source changes are archived separately. Installed phone bytes
were not independently measured.

## Separate Simulated Results

Ten JVM cases cover winter/summer conversion, midnight, device-zone independence,
DST gaps and overlaps, explicit ambiguous instants, leap/month boundaries,
invalid input and preserved clock precision. Original XML and build logs remain.

An independent local disposable Android trial passes eleven selected cases in
97.304 seconds: five picker actions, four light/dark and narrow/wide enlarged-text
layouts, and two existing search-option retention/invalidation cases. Its raw
transcript, APK/source hashes and one-use runner remain separate from hosted CI.
The locally installed app file has the same SHA-256 as the uploaded candidate;
the AndroidTest APK is rebuilt with the corrected test actions.
The store background pause is verified and restored; no installation guard was
enabled in this local trial. Both apps, the device and its newly created AVD
were independently confirmed absent afterward. The first attempted ATD image
was unavailable. A separate initial runner identity check rejected CRLF output
before installation, policy changes or instrumentation; the exact identity was
then checked using normal line boundaries.

The source-specific hosted native selection is retained from its original
artifact, with server digest/size validation, exact member-byte hashes and the
actual instrumentation transcript. Eleven selected cases must execute and pass;
no missing, skipped, failed or duplicated selected case is accepted. Overall
workflow/job conclusions remain explicit in `review.json`; selected cases never
stand in for acceptance of the whole gate.

The 03b8d23 hosted ordinary matrix completes with 214 passes, 54 explicit skips
and no failures across 268 discovered cases. All eleven independent safety jobs
also pass. The complete main replay fails later in
`LocalChatNetworkFlowTest`, line 82, waiting for `preparedSnapshot()` for 30
seconds. It has not yet disconnected the test network or exercised offline
message sending/retry. This is not a new primary-copy failure, an accepted
complete replay, proof of a chat product defect or an established preparation
root cause. The separately passing case does not replace the failed sequence.
No timeout increase, automatic retry, transport replacement or guard removal is
introduced for this failure.

Three superseded hosted runs were cancelled by the agent after test-harness
issues were identified. The first original transcript reports two failures:
a missing scrollable parent in the test host and an unsuccessful Back-command
assertion in the time-cancellation test. Its parameter labels also violate the
unchanged strict result decoder. The test host now matches the scrollable form,
the cancellation case edits then presses the actual native Cancel button, and
parameter identities satisfy the existing decoder. All three original run/job
conclusions and source hashes remain; none is accepted as a completed passing
gate. The initial local helper compilation failure is retained separately.

## Physical Attempts Remain Incomplete

The 30 October phone attempt is interrupted before authenticated Home/calendar.
Only its before-record checkpoint exists. Original process exit codes,
uninstallation, clipboard restoration, session closure by the agent and the
interruption cause were not independently established.

A fresh 31 October Android phone trial selects the same uploaded candidate APK,
enters the isolated account and displays `E-mail ou mot de passe incorrect.`,
before Home/calendar. The original `auth-timeout` filenames and capture phase
are retained as recorded, but that label does not establish a timeout. The
review explicitly corrects the classification to the visible credentials error;
neither the SDK error code nor exact masked password entry was independently
observed. No credential, account or transport root cause is established.
It never submits search, booking or payment. Its independent observer stops with
only the before checkpoint; it does not report a completed phone flow. The
observer successfully signs into the same isolated fixture from the host before
the phone attempt. The post-failure comparison confirms unchanged fixture documents, claims and live
trips, allowing only the already-defined parent initialization timestamp. The
first comparison failed because serialized timestamps were compared with live
SDK objects; the corrected comparison preserves exact seconds/nanoseconds.
This collector preparation issue is not a product defect or auth diagnosis.

The original session JPEG and faithful, unscaled phone-window crop are retained
but not published. The provider acknowledges app uninstallation and the session
returns to Uploaded Apps before closure. Independent phone package absence and
in-app sign-out are not claimed. The fresh trial's clipboard restoration result
is retained separately from the unverified older attempt. Owned runtime/helper
processes exit, their private directories and fixture credential are absent,
and all selected loopback ports independently refuse connections.

Only the four existing private service ports were enabled. No invitation-page
port, additional alias, force-local mode, request logging, real-map request,
real payment, production write, plan change or personal-device change is accepted.
The authentication failure's cause remains unknown.

## Publication and Remaining Scope

Publish short calendar and incomplete-sequence notes with the incomplete phone result. Keep
the public audience, October 24 physical-search date/gallery and partial status.
Publish none of the new diagnostic captures. Actual phone date choice, several
matches/ranking, interrupted search/booking recovery and iOS remain to replay.
No earlier capture-copy failure is claimed repaired by this follow-up.
