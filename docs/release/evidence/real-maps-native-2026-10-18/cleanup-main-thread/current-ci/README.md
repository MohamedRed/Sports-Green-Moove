# Current-Source Regression Run, Still Incomplete

- Native CI: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39122871928
- Source: `a4e933d20d9219a4e0fdcb266cfb9cb31d8619f4`
- Artifact: `android-connected-ui-test-results`, ID `12135525795`.
- Raw ordinary XML: 121 cases, 0 failures, 0 errors, 31 intentional skips.
  The 31 local integration cases run separately in the existing phased runner;
  this XML alone does not prove those cases or the full job.
- All nine previously failing off-main map-cleanup cases are present, executed,
  and passed. The real-map provider test is skipped here and framing is unproven.

The subsequent local replay reached `LocalTripChangeFlowTest`, which reported
`OK (1 test)` at 11:40:14 UTC. Its mandatory evidence copy failed immediately:
`adb-pull-trip-change-parent-confirmation.json` reports exit 1, no signal and no
process error code. ADB 37.0.1 logs end at `pull: building file list...`; there is
no specific cause in that receipt. Read-only diagnostics show normal
instrumentation force-stop and no crash-buffer entry, not an application crash.

The collector threw and CI remained failed. Do not infer a transport root cause,
retry that named copy, promote the later failure-cleanup transfer, or accept this
as a complete local replay. No retry, alternate copy, timeout relaxation, new
skip, version pin or fallback was added to turn this failed run green. New map
framing, route/provider application and physical tracking evidence remain required.

Files are retained unchanged; `artifact-sha256.json` pins original bytes. The
existing evidence XML `-text` attribute also covers this directory.
