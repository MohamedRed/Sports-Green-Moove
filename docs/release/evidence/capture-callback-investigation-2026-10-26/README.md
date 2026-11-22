# Capture Callback Investigation, 26 October 2026

## Passing Baseline

PR head `95d008152ee843e24c7dc8bf75ca1bcdbeba0cd8` completed all 20 enabled
checks successfully. The five intentional skips are the three paid-map lanes
and two iOS lanes. The existing required-check verifier accepts this exact head.
Native run `40325155790`, main job `121579832539`, completes 224 ordinary cases:
170 passed, 54 intentionally skipped, zero failed. All three native suite exit
statuses are zero. Original failed runs remain separately retained.

This proves a successful baseline, not that the earlier screen-copy wait failure
has been repaired. There was no capture-code change between the preceding failed
run and this passing head. Intermittence does not establish a graphics root cause.

## SDK Inspection

The local offline dependency report resolves `ui-test-android:1.10.6`, despite the
older requested BOM. Its original source JAR and AAR were inspected, with artifact
hashes recorded. Both the published source and installed bytecode use the main
looper for the copy-completion callback and wait one second for its latch. The
observed `Failed waiting for PixelCopy!` is that wait expiring, not a returned
`PixelCopy.ERROR_TIMEOUT` status. This local inspection does not establish which
thread or operation was late in an earlier CI failure.

References: [Android PixelCopy API](https://developer.android.com/reference/android/view/PixelCopy),
[published source artifact](https://dl.google.com/dl/android/maven2/androidx/compose/ui/ui-test-android/1.10.6/ui-test-android-1.10.6-sources.jar).
Original dependency, source and bytecode excerpts remain in this evidence bundle;
the binary SDK artifacts remain private and can be independently re-fetched by hash.

## Opt-In Probe

The new test-only observer wraps the same `captureToImage` call without changing
its callback deadline, retrying it or substituting another image. It observes
only the six trip-change captures on the ordinary disposable-device lane. A
monotonic clock, bounded main-queue heartbeats and at most three bounded stack
samples can help distinguish queue delay from a copy still awaiting completion.
Primary duration is measured after observer preparation. Pulse/sample timestamps
and the primary start offset keep setup delays separate from the capture interval;
missing heartbeat observations are null, not an assertion of zero queue delay.
The observer writes no image, UI text, account data, exception message, request
content or credential. Observation can itself affect scheduling; a passing
instrumented run must not be called a root-cause repair.
The SDK's existing internal no-data retry behaviour is unchanged; the observer
invokes the capture method once and cannot replace a callback-wait failure.

The collector performs one bounded copy, validates an allowlisted metadata schema,
hashes the original JSON and rejects partial/duplicate/stale observations. It keeps
the ordinary test failure authoritative. Diagnostic failure cannot replace the
primary capture result, and incomplete collection cannot silently accept a gate.
The existing device image, installation guard, capture quality checks and primary
image-transfer requirements remain unchanged.

The test APK builds and four void instrumentation contract methods compile.
Those four cases and the timing observer have **not yet executed** in this
preparation record. Local host protocol tests exercise argument parsing, strict
metadata validation, one-shot collection and failure preservation. The next CI
run supplies the runtime experiment; this record does not predict its result.

No new screenshot, phone journey, child invitation, provider/dashboard action,
production write, iOS or release acceptance is added. The public site remains a
dated partial follow-up, with previous media unchanged and no raw diagnostics.
