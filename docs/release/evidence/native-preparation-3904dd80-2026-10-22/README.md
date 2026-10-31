# Native Preparation Failure Before Application Tests

22 October 2026, source `3904dd80bdc823ebe256673c8b0a8bc86432cdb7`.
[Native run 39862722989](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39862722989)
is terminal failure. Full-matrix job `120117190780` fails during device
preparation, before ordinary UI tests, component captures or the 36-flow replay.
The successful `a6d8a630` matrix remains a separate historical result.

The original setup receipt reports `Store pause was not applied` at
`stopped-verification`, with `storeStopped: false`. Its bounded process event
shows `com.android.vending:instant_app_installer` starting as a service. Background
and stopped-state restoration both report true. Administration setup was not
reached. Launcher restoration is not verified: the setup code disabled it before
the failing stage, but the error handler did not re-enable it. The new source
restores it independently after setup failure and final cleanup, including when
no store pause was selected. Unit/shell checks do not prove that new cleanup ran
on a real emulator yet. This does not prove what initiated the service or justify weakening
installation/update protection. The build succeeded before device startup.

All ten separate focused jobs and their aggregate gate are terminal success.
They do not replace the unexecuted full matrix. No new application captures,
full-matrix pass, physical-device, real tracking, payment, audit or release result
is accepted from this preparation failure.

The four retained JSON files are original artifact/API outputs. Their hashes,
this report and the scoped summary are bound in `artifact-sha256.json`. The
artifact metadata preserves the platform archive digest separately from this
retained subset. No raw credentials or unrestricted device logs are included.

The new read-only host-shutdown observer is prepared separately and did not run
in this source. Its deterministic process-record and shell-status tests pass
locally; actual Linux CI observations remain pending. No forced shutdown,
automatic test retry, alternate SDK/renderer or provider fallback is added.
The canonical portal records this dated failure, without republishing while its
audience is public.
