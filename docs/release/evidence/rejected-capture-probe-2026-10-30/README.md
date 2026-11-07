# Rejected Capture Investigation, 30 October

This is diagnostic progress, not a renderer repair, production change or completed
release gate. No alternative screenshot, repeated primary capture, longer SDK
deadline or lower image-quality threshold was introduced. No new public media.

## Unchanged Baseline

At source `1cc8f12e19db286491f1ec6dfff76be0ba836946`, the three original
`TeamConversationFlowTest` cases pass on one disposable Android 35 / ARM64
Google APIs emulator. All eight original component/window PNGs are retained.
This includes the one-message retry and final `team-chat-confirmed` image rejected
in the earlier 9bb6346 full matrix. This separate pass does not reproduce or
explain that rejection. The local renderer/image/architecture differ from CI.

The first preflight incorrectly assumed the app store was absent from the AVD
configuration. The device inventory contradicted that assumption. An isolated
APK install was undone before guarded preparation; no instrumentation ran then.
The actual trial uses the existing approved installation policy and exact
installed-APK hash checks. Its original setup bytes, readable copy and complete
restoration receipt remain separate. No accounts or backend services were used.

## Rejected-Bitmap Retention

Only explicit diagnostic mode and `team-chat-confirmed.png` can persist the
already returned, rejected bitmap. It is written under `rejected-primary-captures`,
not the accepted screenshot directory. Metadata retains dimensions, the exact
sampled ARGB values, stride, unchanged threshold and PNG digest, with image/flow
acceptance and replacement-capture flags all false. A persistence error cannot
replace the original quality exception. The bitmap remains subject to recycling.

The host makes one directory observation and at most one file copy. It validates
the allowlisted names, JSON shape, PNG header dimensions and digest; it explicitly
does not claim independent pixel decoding, successful app rendering or a root
cause. Raw command output is discarded. Missing or failed diagnostics never
accept the original failed test. The ordinary-suite failure status is unchanged.

## Failed And Fresh Candidate Trials

The first candidate exits before any test case: instrumentation reports
`Process crashed`, and Android records `failed to complete startup`. No rejected
bitmap or successful primary transfer exists. The original process log, exit
record, failed result and complete device restoration are preserved. The broad
Node suite was running concurrently; resource pressure was observed, but its
causal role is not proven. This is not an executed calibration or UI pass.

A different disposable emulator then executes the same two APK hashes and source
hashes, without that concurrent broad suite. All seven cases pass: four native
diagnostic calibrations and the three unchanged team components. The calibrations
check opt-out/other names, exact bitmap identity and one persistence call, original
failure preservation, and actual PNG decode/digest/no-overwrite/threshold guards.
The controlled blank bitmap is a unit fixture, not the naturally rejected CI image.
The final conversation capture is visually correct. All eight original successful
PNGs and their four component receipts are retained. The diagnostic collector
correctly reports `not-observed`: the real CI rejection was not reproduced.

Both candidate trials restore the approved device administration, original
installation policy, app-store background/stopped state and launcher, and remove
the isolated apps. Each uses a distinct device serial; all owned emulator processes
subsequently exit and their serials disappear. No personal device was controlled.
These use fake gateways; they do not establish service exchange, physical phones,
push delivery, tracking, map requests, payments or release acceptance.

## Last Complete CI Observation

The pre-diagnostic 1cc8f12 native run `41056764259`, main job `124066142558`,
artifact `12978553187`, is terminal failure. Its ordinary matrix passes all 199
executed cases with 54 skips, including all three team component cases. Renderer
color-buffer warnings also appear in this run; those messages alone are not a
proven cause of the earlier rejected bitmap.

The separate component-transfer and integrated-replay exits are both 1. A host
snapshot during the component copy sees one offline emulator. The replay later
times out at `LocalChatNetworkFlowTest.kt:82`, before the tested radio sequence:
Wi-Fi and the isolated backend are reachable, but there is no default data
subscription, connected cellular network or cellular-available callback. The
read-only validation history retains successful DNS/204 probes for Wi-Fi only.
These sequential observations do not prove why cellular service is unavailable
or why the bridge disconnected. Both requested-network callbacks are released.
This is not a completed 40-case replay or a successful full native gate.

The new diagnostic APKs were built from uncommitted test-only changes on 1cc8f12;
their exact source snapshots and installed-byte hashes are retained. The 1cc8f12
CI result does not cover the new diagnostic. Earlier 9bb6346 failures remain
unchanged. Physical tracking, emergency dialer action, safety audit, support
delivery, child search recovery, iOS and other release requirements stay open.
