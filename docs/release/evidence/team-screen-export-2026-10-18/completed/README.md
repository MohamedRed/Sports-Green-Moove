# Completed Team Component Capture Replay

[Native CI 39167178722](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39167178722)
completed successfully at source `0cb8e4c4cfdcc51f25201bfe1af8a90ec7bd3b36`.
All current-head non-skipped PR checks were green when inspected.

The original `ordinary-tests.xml` has 143 cases, 33 intentional skips, no failures
or errors. All four team component cases executed. `component-results.json`
derives its exact case names and time from that XML and binds eight unchanged
original artifacts plus six relevant source files. These component tests use an
in-memory gateway: they do not prove enrollment storage, a real club response or
an authenticated team conversation.

The corrected exporter recovered all four team PNGs. The two full-device window
captures were reviewed: nonblank, no obstructing system UI, no overlapping text
or clipped actions. The narrow capture deliberately uses a 320dp content column
and 1.3 font scale inside the wider test window. An approved status there is
preloaded simulated state, not a manager approval. Both unedited window captures
are allowlisted in the partner portal with explicit simulated-test captions.

`local-replay.json` separately retains 35 passed groups / 37 instrumented cases
for run `1d6cf0c01fe85db4566bb5610e13d919`. `native-suite-status.json` has zero
for ordinary tests, component evidence and local replay. Store restoration is
verified. The older failed capture run remains unchanged in the parent directory.

Still required: actual team enrollment SDK navigation, owned request history,
manager-facing team decisions, conversation access, physical-phone replay and
the explicit release tracking/safety/payment requirements. No production code
was deployed and no release-manifest item is accepted by these local captures.
