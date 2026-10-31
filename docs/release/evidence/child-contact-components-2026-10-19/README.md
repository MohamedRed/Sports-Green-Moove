# Child Contact: Executed Components, Not Account Access

At source `f23512c8ae46b40c2e286104b6c6baa2716ffe60`, run `39337180296`'s
main Android job passed. Original artifact `12227954145` contains the retained
JUnit suite and six captures. All five `ChildRideEmergencyFlowTest` cases ran
without failure, error or skip. Other emulator-only scenarios intentionally skip
in this ordinary build profile; their skips are not child-component passes.

These cases use in-memory gateway and dialer callbacks. They verify the read-only
screen, large-text/narrow phone/action bounds, authority failure clearing the
number, changed contact requiring another tap, simulated phone unavailability,
explicit absence and denial of settings access without a ride. They do **not**
prove a child login, account approval, connected backend, ride discovery, real
phone application, physical device or production deployment.

The original three window captures were visually inspected. The narrow window
reveals an ellipsized title despite the phone/action bounds passing. Consequently
`visualCompletenessVerified` is false. No child contact capture is published as a
finished screen. Original images are not cropped or repaired to hide the defect.
Only the reviewed denied-access and simulated unavailable-phone window captures
enter the separate partial child gallery. Their captions explicitly say simulated;
the narrow capture remains unpublished until the corrected heading is verified.

The source correction now opts emergency headers into two lines, keeps a fixed
font size and removes extra header letter spacing. Both child and parent
large-text tests additionally inspect the actual text layout for visual overflow.
The corrected layout still requires a new executed run and capture review.

The main job's command statuses and independent device restoration are retained.
The separately required focused job failed its identity scenario; its outcome
remains negative in `emergency-selection-race-2026-10-19`. A passing main job
cannot establish that every required native check passed or accept release proof.

`results.json` is a scoped index derived from the original JUnit and artifact,
not a device-exported success marker. Source archives bind the executed source,
not later fixes. `artifact-sha256.json` protects original retained bytes.
