# Support Replay Diagnostics, 22 October

The second physical attempt is **incomplete**, not a successful retry or restart
flow. No release item or production deployment is accepted.

The same isolated APK (`ef083e497c53c834ddd61c869d61d9cb811560acc64c7845b0b1766f855a2c79`)
ran on a fresh physical Android session. Its native source was unchanged between
`bafc9d02` and the run's base commit `000ed178`. The parent signed in, the native
Android App info stop route was inspected without stopping the app, and one
urgent request was sent. A timestamped operator-action wrapper was used from
setup onward. It is not an independent device-event recorder.

The first handler receipt was fresh at 20:21:33.873Z. A same-identity replay reached
the handler at 20:22:11.180Z, before any further native input was recorded and
before the held response was released. Only provider network controls intervened.
A third receipt was recorded at 20:25:53.280Z after network restoration. The
controller stopped after prepared/committed, with its original assertion failure;
the unreleased gate subsequently expired. Neither record has been changed into a
passing run. The unconfirmed screen remains diagnostic evidence only.

Afterward, independent read-only checks verified exactly one unchanged report and
private operation, the same identity on all receipts, and denied foreign reads.
These checks cover those records, not all baseline fixtures after the failed
checkpoint. They do not establish the number of app-side SDK calls, a completed
offline/restart protocol, or whether the SDK or private forwarding service replayed
the request. The original three-attempt transcript is retained.

## Next Diagnostic

The new `SGM_LOCAL_SUPPORT_TRACE=true` Gradle property is restricted to an emulator
backend build and enables logging only in a debug build. Release's generated flag
is always false. The observer records only SDK call start/terminal, UUID operation,
process ID and per-process call number under `SgmQaSupport`. It never reads request
text, user IDs, credentials, exception details or the task response. It does not
retry, cancel, replace or change awaiting the original callable.

Five actual JVM observer tests pass; the Android debug APK builds. The generated
debug and release configuration flags are retained without secrets. A production-
backend tracing configuration is rejected by Gradle. The prepared traced APK has
**not yet been observed on a physical phone**. Its hash and source hashes are in
`prepared-apk.json` and `source-sha256.json`; no APK binary or credential is committed.

## Runner Readiness

The `000ed178` Native CI run passes its ordinary test task, then cannot select a
ready emulator for evidence collection/replay or restoration. Original terminal
metadata and failed-step output are retained. Selection previously excluded
offline emulator identities before the existing bounded readiness gate could run.
The new selector retains a uniquely selected offline identity, then uses that gate
before runtime creation or device changes. Missing, ambiguous, unauthorized and
non-emulator targets remain refused. No alternate target, server restart, test
retry or evidence-copy retry is introduced. Selection/readiness unit tests pass;
the new source still needs remote verification. This does not establish the cause
of the earlier mid-copy transport failures or fix them by assumption.

## Cleanup And Publication

Network simulation was removed and connected Wi-Fi observed. Provider uninstall
was explicitly confirmed; its success state and the native app drawer without
the app are retained. The phone session ended at the dashboard. No administration
policy was changed. Clipboard, backend/helper processes, private session/handoff
paths and local listening ports were restored/removed as recorded in `cleanup.json`.
The expired experiment remains incomplete. No new video is claimed.

The canonical portal update is local only. Publication remains held pending the
requested owner-private audience and exposed-token renewal. The partner email is
still unknown. The previous physical and local proofs keep their original scope.
All 1,596 Node checks pass. The local portal browser run also passes at 320, 390,
768 and 1440 pixels, including short-video playback, navigation and asset loading.
Its transcript is retained separately from the incomplete phone experiment.
