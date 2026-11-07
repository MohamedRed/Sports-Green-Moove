# Review Trip Context, 29 October 2026

The generic review title previously did not identify the completed trip.
The response now adds bounded, read-only context from that exact linked trip:
the recorded name and departure in Belgian time. Invalid, deleted or unrelated
details remain explicitly unavailable; the request is never dropped or given
an invented date. See `docs/contracts/review-trip-context.md`.

## Verified

- Seven authenticated isolated service groups pass. Two accounts each traverse
  25 contextual and seven unavailable requests in two pages. First-page context,
  daylight-saving/local-date boundaries, cross-account rejection and all 158
  original records/claims are checked. One later-page five-star rating removes
  only that parent's exact request; all driver requests remain unchanged.
- Nine local Android component cases pass, including three new context cases.
  Two same-named trips retain distinct dates and the selected ride ID reaches
  the fixture submission. Long text at 280 dp / 1.8 font scale renders every
  character, without ellipsis or hiding any score. Explicit unavailable context
  invents no date and sending disables all five scores.
- All 636 Android and 538 backend unit cases pass. iOS model/wire checks and the
  separate booking wire/process-recovery model checks pass after the model split.
  This does not compile/execute the complete iOS app UI or test an iOS phone.

The three original native PNGs were reviewed unedited and their hashes matched
the device files. App and test APK bytes were also independently matched on the
local emulator; retained binaries stay outside Git. The choices image is a
component inbox fixture, not a signed-in live account. The unavailable image is
a landscape-shaped component canvas, not phone-rotation evidence.

## Preparation And Limits

Two initial service preparations stopped before tests because the CLI found
Java 17 on PATH despite JAVA_HOME. The explicit local Java 21 executable fixed
the command environment without changing system settings. Those original logs
are retained. An initial new test compilation failed on a Kotlin fixture syntax
error; the repaired compilation and exact final nine-case transcript are retained.
Earlier passing intermediate transcripts are not attributed to final source.

The service runner destroys its isolated environment and closes clients. The
read-only disposable emulator and owned bridge daemon exit, their ports close,
and no local runtime directory remains. Saved virtual-device data is preserved.

No physical phone, native-to-service integration, real network loss, application
restart, maps, payments, production change or release-manifest acceptance is
claimed. The existing phone pagination/history evidence remains independently
dated. Replaying contextual reviews on a real phone and handling actual legacy
data remain open, as do full native CI, tracking, safety and operational gaps.
