# Capture Window Calibration, 30 October

Base source: `1f421382eea1417cacbd2dca267386f16dad86b3`. This changes a named,
opt-in capture observer, not the app's user flow, capture API, quality threshold,
SDK deadline or primary exception. Exactly one primary operation and at most three
stack samples remain. No alternate image, renderer change, retry or extra wait
is introduced. This is not a repair of the failed full native gate.

## Observed Gap And Controlled Baseline

The retained 8fb8731 full matrix fails its large-text parent review capture after
1069 ms in the SDK call. Only the 250 ms sample runs; the 1200/1600 ms scheduled
points are later than this operation's completion. Its last recorded heartbeat
is at 489 ms, so the earlier main-thread sample cannot explain the later interval.
The locally resolved Compose UI test 1.10.6 bytecode independently uses a one-second
callback latch. That local dependency observation is not an exact CI binary hash.

The controlled baseline uses the original version-three schedule with a test-only
cache-directory injection for the observer. It does not claim byte-identical code
to the committed base. Two calibration cases execute benign timed operations:
one lasts 1100 ms with a deliberately blocked main thread after 400 ms, and one
lasts 1750 ms. Both fail to produce the requested 750 ms observation. The five
existing wrapper cases and the actual large-text parent confirmation component
pass, giving six passes and two expected calibration failures, with no skips.

The controlled operations do not call the screenshot SDK. Their temporary JSON
stays in the app cache and is deleted; it is never exported or accepted as an
actual screenshot observation. The deliberately blocked main thread is released
independently even after an assertion failure. No real account or backend is used.

## Candidate Execution

Version four moves only the middle sample from 1200 to 750 ms, retaining the
250/1600 ms points and the same three-sample bound. Historical versions keep
their original schedules in the strict decoder; old observations cannot acquire
a newly invented sample. Neither the primary SDK nor its deadline is modified.

On a different disposable emulator, the same two controlled cases pass. The short
case observes the deliberately blocked main thread at the middle point before
finishing; the longer case still records all three points. The five wrapper cases
and the unchanged parent component pass too: eight passes, zero failures/skips.
This proves the calibration and its control, not a naturally reproduced CI failure.

The actual parent component passes in both trials. It checks original/proposed
terms, accepts one reservation, observes one of two consents and confirms no
driver application. Its primary captures and separate window images are all
retained, copied once and hash-bound. The candidate primary images were visually
reviewed. They use fake gateways and explicitly unavailable maps; no map requests,
payment, production write, physical phone or full integrated service flow occurs.
Fast successful captures do not prove that the new middle sample diagnoses a
future naturally failing SDK invocation. No new public gallery/media is added.

## Isolation And Remaining Work

Each trial uses a separate Android 35 / ARM64 Google APIs emulator instance,
read-only startup and the existing approved installation policy. Installed APK
digests, source snapshots, original outputs and independent complete policy/admin/
package restoration are retained. Both owned emulator processes subsequently exit
and their selected serials are absent. Existing personal/saved devices are untouched.

The original 8fb8731 failure and every earlier failed run remain unchanged. The
separate 1f42138 CI is not repaired by this local diagnostic change. Physical
tracking, emergency action, multi-phone exchange, safety-audit and operational
delivery evidence are still required. Keep the release goal open, public access
unchanged, historical galleries dated and flow status partial. Publish only a short
local parent-component recheck note; do not call this a renderer or transport fix.

## Separate Current-Base CI Failure

Run `41067565809` on the base source is terminal failure. Its completed failed
remote-stop job `124102901617` has artifact `12983067931` with the original output.
The single native remote-stop test passes, but the following file copy exits one.
The device-side transport log records a terminated write connection and offline
transport at that copy. The original command failure, separate diagnostic,
failed suite status and complete verified restoration are retained unchanged.
This does not identify the disconnect cause, prove every service assertion or
accept the whole flow. No retry, alternate copy or substitute capture changes
that outcome. The broader run snapshot must not be mistaken for acceptance of
its main matrix or other lanes, nor a repair caused by this local observer change.
