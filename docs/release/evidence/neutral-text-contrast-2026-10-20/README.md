# Neutral Text Contrast, 20 October 2026

## Observed Failure And Correction

The actual JVM regression executes thirty combinations: light/dark semantic
primary, secondary and muted text against app, surface, card, elevated and input
backgrounds. The original palette has ten failures, all muted text. The corrected
production tokens pass all thirty cases, with a minimum computed ratio of
4.637437556587171. Foreground alpha is composited over the opaque background
before calculating luminance; threshold comparisons are not rounded.

The 4.5:1 normal-text threshold and specified-color measurement follow the
[W3C contrast criterion](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
This bounded token test is not an assertion that the app meets WCAG overall.

Only two semantic values change: light muted text `#7A9E82` to `#56735E`, dark
muted text `#4E6E56` to `#8AA892`. Palette definitions move out of the theme file
into the smaller `SgmColors.kt`; legacy duplicate definitions are removed. Brand,
background, hero, primary/secondary text and white hero text stay unchanged.

`before/` contains the actual failing JUnit XML and command log, not the earlier
compilation-error attempt. The later-retained source snapshots document the
working-tree palette and test, not a clean-Git checkout attestation. `after/`
contains the real passing XML with thirty emitted measurements, the successful
full native-unit/Android-test compilation command log and source hashes. Exact
corrected sources are retained in `../source-archive/` by SHA-256.

## Visual Verification Pending

Eight new instrumentation cases render the actual stateless Search/Trips screen
components in light/dark themes, with font scale 1.3, at 320-by-700 and 900-by-600
dp. These are explicit density-constrained component viewports on an emulator,
not a physical phone/tablet or a connected multi-account flow. The tests exercise
scrollable search fields/actions or named trip navigation controls, reject blank
component captures, save original viewport/window PNGs and bind them to markers.

The ordinary suite must collect all twenty-four nonempty files. A failed or stale
copy cannot produce a successful component result, nor suppress the independent
full local replay. Execution and visual review of the new captures are still
pending. No new screenshot is accepted or published from compilation alone.

## Remaining Scope

The matrix excludes accent/error/success text, text on brand-colored buttons,
disabled-state opacity, hero gradients, image backgrounds and other platform
palettes. White text on brand green/orange and colored text on pale surfaces need
their own role-specific review; changing the shared white hero text globally
would break its existing dark-background use. Layout, overlapping text, other
screens, actual screen readers, physical devices and release requirements remain
open. No map/provider request or real account/payment is used in this trial.
