# Input Window Readiness

## Retained Before-Change Result

Commit `696f50c052eb46088d855280961de9bde211ac07`,
[Native CI 39032094118](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39032094118),
passed all 80 executed ordinary cases (99 declared, 19 conditional skips).
This is important counterevidence to any claim that the keyboard failure was
deterministic or already causally explained. The separate replay
`b9568cc71ef6d04b63f2b0a48eb21d04` failed before the network cut: both internet
transports existed and the SIM/default-data subscription were ready, but the
active default remained cellular rather than Wi-Fi. Both request resources were
released. No complete replay result was emitted. `before/` retains original XML,
network receipt/transcript and read-only modem/subscription/default-history files.

## Observed After-Change Result

Commit `48cb2592e3454122dcdd4a93de87e22cfa4dfd39`,
[Native CI 39032609510](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39032609510),
compiled the [own-window readiness helper](../../../contracts/android-input-readiness.md)
and passed all 82 executed ordinary cases: 101 declared, no failures/errors,
19 conditional local-backend skips. Both new activity/dialog keyboard probes,
all six conversation cases, all seven trip-change cases and all three cancellation
cases executed successfully. The nine retained per-case logs show an actually
visible keyboard with the composition's view served and accepting text.

Every retained pre-touch sample already had native window focus in this run.
Therefore this success does not prove the new focus wait caused the improvement,
nor that it resolves every intermittent keyboard failure. The helper corrects an
unverified prerequisite and removes the unrelated-window keyboard check. The
original seven-keyboard-failure report stays unchanged in
`../local-dual-transport-2026-10-17/repeat/general-ui.xml`.

The separate replay `f19cdf4a9a5f0586554667f8c9a4635e` again failed before the
cut, but this time Wi-Fi was the default and cellular never became available.
The SIM was loaded, while the default-data/active-data subscription was invalid,
data was disconnected and no cellular callback arrived. Both requests were
released. These are different readiness conditions from the before-change result;
neither is a successful handover or offline send. Both histories contain zero
recognized default-selection events and null readiness, not evidence of health.
The 30-second preparation wait was unchanged. `after/` retains the corresponding
original artifacts. Hashes cover all 27 retained files, including raw line endings.

## Scope

The overall Native job failed in both runs. The separate successful 24-case replay
and its reviewed images remain historical, truthful evidence in
`../local-dual-transport-2026-10-17/completed/`; these failures do not replace them.
No new recording or map capture is approved here. The portal keeps the existing
dated images, records the new screen results and leaves stability incomplete.
Physical keyboard/layout, draft process death, send-time cuts, cross-phone flows,
maps, tracking, live provider/payment outcomes and six safety-audit events remain
open. No release requirement is accepted and the full goal remains active.
