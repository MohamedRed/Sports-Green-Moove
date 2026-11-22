# Review Display And Controlled Session Recovery

29 October 2026, isolated local Android execution. Not physical-phone,
real-network-loss, full-gate or production evidence. The public portal remains
public and receives three reviewed images, not a new video.

## Original Failure And Diagnosis

The retained ordinary CI result at `3641ea1` has 189 passes, 54 skips and one
failure among 244 cases: the narrow, large-font received-rating case. Its original
result and transcript are retained. A local baseline reproduces that assertion
(one case, one failure). Changing only the count grouping still fails the same
assertion among six cases, specifically on `4,9 / 5`, not on the count.

The actual average line is 197 px wide in a 197 px measured node. The paragraph
was allocated 471 px; `hasVisualOverflow` compares the measured width against that
allocation, producing a false-positive width flag. The original diagnostic and
the subsequent per-line geometry are retained. This is not proof of a visibly
clipped average or its repair. See the primary
[TextLayoutResult implementation](https://android.googlesource.com/platform/frameworks/support/+/989d459515075659fd81e8d04fbc7572f45c4ed4/compose/ui/ui-text/src/commonMain/kotlin/androidx/compose/ui/text/TextLayoutResult.kt).

The replacement assertion checks every rendered line's left, right and bottom,
rejects ellipsis, verifies the final character and keeps frame/refresh separation.
All six received-summary/pagination cases pass. The original 280 dp width,
1.8 font scale and maximum count remain. French integer grouping now uses
breakable ordinary spaces; no digits, precision or controls are removed.
All 633 Android unit tests pass, including three new formatting cases.

`received-ratings-large-text.png` is the unedited native component capture
(735 x 349); device and local hashes matched. The extreme count is synthetic,
not a real account's reviews. Its landscape-shaped component canvas does not
prove phone rotation. Installed app/test bytes were hash-verified on the local
emulator only; APK binaries are retained outside Git.

## Session Recovery Integration

The bounded restoration proxy did not permit the new profile summary read.
The new positive contract fails before the allowlist change and passes afterward;
all 13 proxy cases pass. Only `getReceivedRatingSummary` is added. Authentication,
parent UID, recovered phase, empty request and upstream owner checks remain;
writes and unrelated methods are still rejected.

One complete native restoration case then passes on a separate disposable local
emulator. Controlled restoration statuses are exactly 503, 503, 200, 200, followed
by a successful parent-owned summary read. Error, rotation, explicit retry,
same-account recovery, profile identity and sign-out pass. The primary copy,
transcript hashes, five original native images, all record/claim comparisons,
proxy closure and isolated-environment destruction are retained. Two reviewed
images are published: the error and recovered home. Older captures remain dated.

The first emulator launch failed before boot because its old image path no
longer existed. Its log is retained; an already-installed image was then selected
explicitly. No device test ran during that failed preparation.

## Limits And Cleanup

Both read-only emulator processes and the owned bridge daemon exited; their
ports and local service ports are closed. Saved virtual-device data is preserved.
No phone provider, real maps, payments, production writes or infrastructure
changes were used. Full native CI, chat interruption repeatability, physical
tracking and safety-audit requirements remain open. This targeted pass does not
replace earlier failed native gates or accept any release-manifest scenario.
